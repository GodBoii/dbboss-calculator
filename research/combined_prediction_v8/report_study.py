"""Render endpoint-specific market comparisons without blending incompatible rates."""
from __future__ import annotations

import csv
import gzip
import json
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).resolve().parent
METRICS = ("top5", "avoid2", "panel10", "sp30", "dp20")
BLOCKS = ("weight_train", "weight_validation", "late_reused", "november_reused")
BLOCK_LABELS = ("Sep 8–30", "Oct 1–15", "Oct 16–22 reused", "Oct 23–Nov 1 reused")


def read(name: str) -> Any:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def trajectory(deltas: list[int], denominators: list[int]) -> str:
    """Describe observed direction across declared blocks; zero is not improvement."""
    if len(deltas) != 4 or len(denominators) != 4:
        raise ValueError("A trajectory requires all four chronological blocks")
    if any(n == 0 for n in denominators):
        return "incomplete eligible history"
    if all(value == 0 for value in deltas):
        return "unchanged throughout"
    if all(value > 0 for value in deltas):
        return "helped in every block"
    if all(value < 0 for value in deltas):
        return "hurt in every block"
    validation, later = deltas[1], deltas[2:]
    if validation > 0 and any(value < 0 for value in later):
        return "validation gain reversed later"
    if validation < 0 and any(value > 0 for value in later):
        return "validation loss reversed later"
    if validation > 0 and all(value >= 0 for value in later):
        return "validation gain persisted or tied later"
    if validation < 0 and all(value <= 0 for value in later):
        return "validation loss persisted or tied later"
    return "mixed or tied across blocks"


def counts(base: np.ndarray, current: np.ndarray, use: np.ndarray) -> dict[str, int]:
    """Use paired eligible events; no market or endpoint rate averaging."""
    if base.shape != current.shape or base.shape != use.shape:
        raise ValueError("Mismatched hit and eligibility shapes")
    return {"n": int(use.sum()), "baseline_hits": int(base[use].sum()),
            "candidate_hits": int(current[use].sum()),
            "wins": int((current & ~base & use).sum()),
            "losses": int((base & ~current & use).sum())}


def cell(values: dict[str, Any]) -> str:
    n = values["n"]
    if not n:
        return "— / 0"
    base, current = values["baseline_hits"], values["candidate_hits"]
    return f"{base}→{current}/{n} ({current-base:+d})"


def write_csv(name: str, rows: list[dict[str, Any]]) -> str:
    if not rows:
        raise ValueError(f"Cannot write empty report ledger: {name}")
    with (HERE / name).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(dict.fromkeys(key for row in rows for key in row)))
        writer.writeheader()
        writer.writerows(rows)
    path = HERE / name
    if path.stat().st_size > 3_000_000:
        compressed = name + ".gz"
        (HERE / compressed).write_bytes(gzip.compress(path.read_bytes(), mtime=0))
        path.unlink()
        return compressed
    return name


def source_usage(records: list[dict[str, Any]]) -> tuple[str, str]:
    """Expose actual model combinations chosen by each frozen market policy."""
    catalogue = read("catalogues.json")["sources"]
    with np.load(HERE / "hits.npz", allow_pickle=False) as stored:
        archive = {key: stored[key] for key in stored.files}
    dates, markets = archive["dates"], archive["markets"]
    periods = {"weight_train": (dates >= "2026-09-08") & (dates <= "2026-09-30"),
               "weight_validation": (dates >= "2026-10-01") & (dates <= "2026-10-15"),
               "late_reused": (dates >= "2026-10-16") & (dates <= "2026-10-22"),
               "november_reused": (dates >= "2026-10-23") & (dates <= "2026-11-01")}
    ledger, latest = [], []
    for row in records:
        channel, metric, market = (row[key] for key in ("channel", "metric", "market"))
        scope = np.ones(len(dates), dtype=bool) if market == "ALL" else markets == market
        routes = archive[f"{channel}__{metric}__routes"][row["index"]]
        matrix = archive[f"{channel}__{metric}"]
        eligible = archive[f"{channel}__{metric}__eligible"]
        current = matrix[routes, np.arange(len(dates))]
        for block, period in periods.items():
            for source_index in np.unique(routes[scope & period]):
                routed = scope & period & (routes == source_index)
                source = catalogue[channel][int(source_index)]
                ledger.append({"channel": channel, "metric": metric, "market": market,
                               "policy": row["selected"], "block": block, "source_index": int(source_index),
                               "source": source["id"], "family": source["family"],
                               "routed_draws": int(routed.sum()), **counts(matrix[0], current, routed & eligible)})
        positions = np.flatnonzero(scope)
        if positions.size:
            position = positions[-1]
            source = catalogue[channel][int(routes[position])]
            latest.append({"channel": channel, "metric": metric, "market": market,
                           "frozen_policy": row["selected"], "last_observed_date": dates[position],
                           "source_index": int(routes[position]), "last_observed_source": source["id"],
                           "source_family": source["family"],
                           "note": "Historical source decision; a future source choice requires updating strictly earlier-date evidence."})
    return write_csv("selected_source_usage.csv", ledger), write_csv("last_observed_source_choices.csv", latest)


def main() -> None:
    results = read("results.json")
    records = results["summaries"] if isinstance(results, dict) else results
    if not isinstance(records, list) or not records:
        raise ValueError("Missing endpoint summaries")
    markets = sorted({row["market"] for row in records if row["market"] != "ALL"})
    if len(markets) != 12:
        raise ValueError(f"Expected twelve markets, received {len(markets)}")
    ledger: list[dict[str, Any]] = []
    directions: list[dict[str, Any]] = []
    for row in records:
        for approach, blocks in row["approaches"].items():
            deltas, denominators = [], []
            for block in BLOCKS:
                value = blocks[block]
                delta = value["candidate_hits"] - value["baseline_hits"]
                deltas.append(delta)
                denominators.append(value["n"])
                ledger.append({"channel": row["channel"], "metric": row["metric"], "market": row["market"],
                               "approach": approach, "selected": approach == row["selected"], "block": block,
                               **value, "net_hits": delta})
            directions.append({"channel": row["channel"], "metric": row["metric"], "market": row["market"],
                               "approach": approach, "selected": approach == row["selected"],
                               **dict(zip(BLOCKS, deltas, strict=True)), "trajectory": trajectory(deltas, denominators)})
    ledger_name = write_csv("market_approach_summary.csv", ledger)
    direction_name = write_csv("market_approach_directions.csv", directions)
    usage_name, latest_name = source_usage(records)
    chosen = [row for row in directions if row["selected"] and row["market"] != "ALL"]
    selection_counts: dict[str, int] = {}
    for row in chosen:
        selection_counts[row["approach"]] = selection_counts.get(row["approach"], 0) + 1
    write_csv("selection_counts.csv", [{"approach": name, "market_endpoint_choices": count}
                                        for name, count in sorted(selection_counts.items())])
    lines = ["# V8 market-specific combinations and causal online controllers", "",
             "All observations through November 1 have already been used in earlier research. These are reused retrospective results, with no fresh confirmation period. Production is unchanged.", "",
             "Each market and endpoint has its own frozen approach choice using September 8–30 training and October 1–15 validation. With at least 15 eligible training and eight validation events, it requires a strict local validation gain and no local training regression. Sparse endpoints can use guarded leave-market-out transfer: no local training or validation loss, no training loss on other markets, and at least two validation net hits on other markets; ten pseudo-observations weight that other-market validation evidence. This can select an approach tied locally. The strict local reference and selection mode remain in results.json. Neither selector uses the two later blocks. Online controllers update source choices from strictly earlier dates during later blocks. Source expert choices themselves were fitted retrospectively in earlier V7 work; causal controller routing does not make that earlier source selection prospective.", "",
             "The five component endpoints remain separate: five Sutta digits, two distinct absent digits, ten panels, thirty SP panels and twenty DP panels. SP/DP denominators condition on the actual panel type. Jodi25 is the Cartesian product of five Open and five Close-before-Open digits; it uses no known-Open forecast. No reported rates are averaged across endpoints or markets. The separate coherent controller optimizes a declared same-draw count utility: each correct output contributes one fifth, including zero for the nonmatching panel type. Its maximum is 0.8 because SP and DP cannot both hit. This utility selects source distributions; it is not an overall accuracy rate. All five reported endpoints still face separate training and validation nonregression gates.", "",
             "Each cell gives production hits → approach hits / eligible events (paired net hits). Direction labels describe the four observed blocks, not evidence of durable future advantage. A zero net hit is a tie, and sparse conditional denominators remain visible.", "",
             f"`{ledger_name}` reports every declared approach, market, endpoint and block, including paired wins and losses. `{direction_name}` identifies which gains persisted, reversed or tied. These full ledgers include unsuccessful alternatives; the tables below show frozen choices and fixed comparison approaches.", "",
             f"`{usage_name}` names the actual source model or mixture used by each frozen policy, market, endpoint and block, with routed draws and eligible paired counts. `{latest_name}` identifies each policy's source decision on its market's last observed date; it is a historical decision, not a frozen promise to reuse that source on a future date. Probability blend parameters and five-component weights are explicit in catalogues.json.", "",
             "## Frozen choices by market", ""]
    direction_lookup = {(row["channel"], row["metric"], row["market"], row["approach"]): row["trajectory"] for row in directions}
    for market in markets:
        lines += [f"### {market}", "", "| Channel | Endpoint | Frozen approach | " + " | ".join(BLOCK_LABELS) + " | Observed direction |",
                  "|---|---|---|---|---|---|---|---|"]
        rows = [row for row in records if row["market"] == market]
        if len(rows) != 16:
            raise ValueError(f"Expected sixteen channel/endpoints for {market}, received {len(rows)}")
        for row in rows:
            approach = row["selected"]
            blocks = row["approaches"][approach]
            direction = direction_lookup[row["channel"], row["metric"], market, approach]
            lines.append(f"| {row['channel']} | {row['metric']} | `{approach}` | " + " | ".join(cell(blocks[block]) for block in BLOCKS) + f" | {direction} |")
        controls = sorted({name for row in rows for name in row["approaches"]
                           if name != "baseline" and ("v7" in name.lower() or "specialist" in name.lower())})
        if controls:
            lines += ["", "Fixed reference approaches, evaluated without selecting winners from later outcomes:", "",
                      "| Channel | Endpoint | Approach | " + " | ".join(BLOCK_LABELS) + " | Observed direction |",
                      "|---|---|---|---|---|---|---|---|"]
            for row in rows:
                for approach in controls:
                    if approach not in row["approaches"]:
                        continue
                    blocks = row["approaches"][approach]
                    direction = direction_lookup[row["channel"], row["metric"], market, approach]
                    lines.append(f"| {row['channel']} | {row['metric']} | `{approach}` | " + " | ".join(cell(blocks[block]) for block in BLOCKS) + f" | {direction} |")
        lines.append("")
    lines += ["## Selection counts", "", "Counts refer to market/endpoint choices, not independent discoveries.", "",
              "| Approach | Choices |", "|---|---:|"]
    lines.extend(f"| `{name}` | {count} |" for name, count in sorted(selection_counts.items()))
    balanced = results.get("balanced_summaries", []) if isinstance(results, dict) else []
    balanced_ledger = []
    if balanced:
        lines += ["", "## One coherent source distribution per draw", "",
                  "These separately frozen controllers use the same source distribution for all five outputs. Each selected policy must preserve every endpoint in both selection blocks and strictly improve at least one endpoint in validation. Endpoint-specific choices above can instead route different sources for different outputs. The conditional denominators below remain separate.", ""]
        for market in markets:
            lines += [f"### {market}", "", "| Channel | Endpoint | Coherent approach | " + " | ".join(BLOCK_LABELS) + " | Observed direction |",
                      "|---|---|---|---|---|---|---|---|"]
            for row in balanced:
                if row["market"] != market:
                    continue
                for metric, blocks in row["metrics"].items():
                    deltas = [blocks[block]["candidate_hits"] - blocks[block]["baseline_hits"] for block in BLOCKS]
                    direction = trajectory(deltas, [blocks[block]["n"] for block in BLOCKS])
                    lines.append(f"| {row['channel']} | {metric} | `{row['selected']}` | " + " | ".join(cell(blocks[block]) for block in BLOCKS) + f" | {direction} |")
                    for block in BLOCKS:
                        balanced_ledger.append({"market": market, "channel": row["channel"], "metric": metric,
                                                "approach": row["selected"], "block": block, **blocks[block], "trajectory": direction})
        write_csv("balanced_market_summary.csv", balanced_ledger)
    lines += ["", "Each endpoint selects from many related variants on small reused blocks. Validation gains can reverse. Later blocks are diagnostics and must remain visible even when they contradict the chosen approach.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")
    decisions = ["# Frozen choices: market-by-market outcomes", "",
                 "Only the approach frozen from September training and October 1–15 validation is described here. Later outcomes do not change the recommendation. Every date is reused history; these descriptive labels provide no fresh confirmation or general improvement claim.", "",
                 "A persistent positive means validation net hits >0, both later blocks ≥0, and at least one later block >0. A reversal means validation >0 but at least one later block <0. Endpoint labels are channel/metric; each tuple is validation / Oct16–22 / Oct23–Nov1 paired net hits. Other choices include baseline, local ties and mixed results; the full report shows all sixteen endpoints per market.", "",
                 "Coverage gives total market draws in validation / Oct16–22 / Oct23–Nov1; conditional SP/DP counts can be smaller. Missing later observations cannot establish persistence or reversal.", "",
                 "| Market | Draw coverage | Persistent positives among frozen choices | Validation gains that reversed | Other frozen choices with later losses |",
                 "|---|---|---|---|---|"]
    for market in markets:
        groups: list[list[str]] = [[], [], []]
        coverage = next(row for row in records if row["market"] == market and row["channel"] == "open" and row["metric"] == "top5")
        coverage_text = "/".join(str(coverage["approaches"][coverage["selected"]][block]["n"]) for block in BLOCKS[1:])
        for row in records:
            if row["market"] != market:
                continue
            blocks = row["approaches"][row["selected"]]
            delta = [blocks[block]["candidate_hits"] - blocks[block]["baseline_hits"] for block in BLOCKS[1:]]
            label = f"{row['channel']}/{row['metric']} ({'/'.join(f'{value:+d}' for value in delta)})"
            if all(blocks[block]["n"] > 0 for block in BLOCKS[1:]) and delta[0] > 0 and all(value >= 0 for value in delta[1:]) and any(value > 0 for value in delta[1:]):
                groups[0].append(label)
            elif delta[0] > 0 and any(value < 0 for value in delta[1:]):
                groups[1].append(label)
            elif any(value < 0 for value in delta[1:]):
                groups[2].append(label)
        decisions.append(f"| {market} | {coverage_text} | " + " | ".join("; ".join(group) if group else "None" for group in groups) + " |")
    decisions += ["", "Each endpoint uses its own denominator. Gains listed together must not be summed into an overall accuracy. Coherent same-source policy outcomes and all companion endpoint tradeoffs appear market by market in REPORT.md and balanced_market_summary.csv.", ""]
    (HERE / "MARKET_DECISIONS.md").write_text("\n".join(decisions), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
