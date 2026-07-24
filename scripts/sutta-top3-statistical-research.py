"""Research-only Top-3 hypothesis search with chronological, frozen baselines.

All formulas are implemented in the existing research module. This runner
changes the contract to exactly three Open digits, three Close digits, three
exact Jodis, and (reported separately) the 3x3 nine-Jodi rectangle.
"""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
HISTORICAL = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-statistical-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-statistical-research.md"
TOP_K = 3


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_top3_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()


def ledger_rows(path: Path, forward: bool) -> list[dict[str, Any]]:
    rows = json.loads(path.read_text(encoding="utf-8"))["ledger"]
    return [{**row, "forward": forward} for row in rows]


def metric(hits: list[bool], baseline: list[bool], indices: list[int]) -> dict[str, Any]:
    n = len(indices)
    candidate = sum(hits[index] for index in indices)
    base = sum(baseline[index] for index in indices)
    candidate_only = sum(hits[index] and not baseline[index] for index in indices)
    baseline_only = sum(baseline[index] and not hits[index] for index in indices)
    discordant = candidate_only + baseline_only
    sign_tail = sum(math.comb(discordant, value) for value in range(min(candidate_only, baseline_only) + 1)) / (2 ** discordant) if discordant else 1.0
    paired_p = min(1.0, 2 * sign_tail)
    return {
        "n": n,
        "baseline": base,
        "candidate": candidate,
        "delta": candidate - base,
        "baselineAccuracy": round(100 * base / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate / n, 3) if n else 0.0,
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "pairedPValue": paired_p,
    }


def build_splits(rows: list[dict[str, Any]]) -> dict[str, list[int]]:
    result = {name: [] for name in ("development", "validation", "holdout", "forward")}
    for market in F.MARKETS:
        historical = [index for index, row in enumerate(rows) if row["market"] == market and not row["forward"]]
        forward = [index for index, row in enumerate(rows) if row["market"] == market and row["forward"]]
        n = len(historical)
        dev_end = int(n * 0.70)
        val_end = int(n * 0.85)
        # The first half is treated as formula warm-up. Formula selection sees
        # only the next 20%; the final 30% remains validation and holdout.
        result["development"].extend(historical[int(n * 0.50):dev_end])
        result["validation"].extend(historical[dev_end:val_end])
        result["holdout"].extend(historical[val_end:])
        result["forward"].extend(forward)
    return {name: sorted(indices) for name, indices in result.items()}


def rank100(scores: list[float]) -> list[int]:
    return sorted(range(100), key=lambda value: (-scores[value], value))


def build_predictions(rows: list[dict[str, Any]]) -> tuple[dict[str, dict[str, list[bool]]], dict[str, list[bool]]]:
    cache = F.load_rows()
    position = {market: {row.iso: index for index, row in enumerate(market_rows)} for market, market_rows in cache.items()}
    candidates: dict[str, dict[str, list[bool]]] = defaultdict(lambda: defaultdict(list))
    baselines = defaultdict(list)

    for ledger in rows:
        market = ledger["market"]
        target_index = position[market][ledger["isoDate"]]
        target = cache[market][target_index]
        prior = cache[market][:target_index]
        open_scores = F.feature_scores(prior, "open", target)
        close_scores = F.feature_scores(prior, "close", target)
        exact_scores = F.jodi_feature_scores(prior, target)

        base_open = [int(value) for value in ledger["openRanking"][:TOP_K]]
        base_close = [int(value) for value in ledger["closeRanking"][:TOP_K]]
        baselines["open"].append(target.open in base_open)
        baselines["close"].append(target.close in base_close)
        baselines["adjustedClose"].append(target.close in base_close)
        baselines["jodiGrid"].append(target.open in base_open and target.close in base_close)

        base_exact = []
        pairs = []
        for open_rank, open_digit in enumerate(ledger["openRanking"]):
            for close_rank, close_digit in enumerate(ledger["closeRanking"]):
                pairs.append((open_rank + close_rank, max(open_rank, close_rank), open_rank, int(open_digit) * 10 + int(close_digit)))
        for pair in sorted(pairs):
            if pair[-1] not in base_exact:
                base_exact.append(pair[-1])
            if len(base_exact) == TOP_K:
                break
        actual_jodi = target.open * 10 + target.close
        baselines["exactJodi"].append(actual_jodi in base_exact)

        for name, scores in open_scores.items():
            candidates["open"][name].append(target.open in F.rank(scores)[:TOP_K])
        for name, scores in close_scores.items():
            picks = F.rank(scores)[:TOP_K]
            # The ordinary Close model runs before today's Open result exists.
            # Conditional known-open formulas belong exclusively to the
            # adjusted-Close target.
            if not name.startswith("known_open"):
                candidates["close"][name].append(target.close in picks)
            candidates["adjustedClose"][name].append(target.close in picks)
        for name, scores in exact_scores.items():
            candidates["exactJodi"][name].append(actual_jodi in rank100(scores)[:TOP_K])
        for open_name in F.JODI_OPEN_CANDIDATES:
            for close_name in F.JODI_CLOSE_CANDIDATES:
                name = f"grid:{open_name}|{close_name}"
                candidates["jodiGrid"][name].append(
                    target.open in F.rank(open_scores[open_name])[:TOP_K]
                    and target.close in F.rank(close_scores[close_name])[:TOP_K]
                )

    return candidates, dict(baselines)


def evaluate(rows: list[dict[str, Any]], candidates, baselines, splits) -> dict[str, Any]:
    output = {}
    for target, by_candidate in candidates.items():
        searched = []
        for name, hits in by_candidate.items():
            searched.append({
                "candidate": name,
                **{block: metric(hits, baselines[target], indices) for block, indices in splits.items()},
            })
        selected = max(
            searched,
            key=lambda item: (item["development"]["delta"], item["development"]["candidate"], item["candidate"]),
        )
        selected["promotable"] = (
            selected["development"]["delta"] > 0
            and selected["validation"]["delta"] >= 0
            and selected["holdout"]["delta"] >= 0
            and selected["forward"]["delta"] >= 0
        )
        durable = [item for item in searched if (
            item["development"]["delta"] > 0
            and item["validation"]["delta"] >= 0
            and item["holdout"]["delta"] >= 0
            and item["forward"]["delta"] >= 0
        )]
        durable.sort(key=lambda item: (item["forward"]["delta"], item["holdout"]["delta"], item["development"]["delta"]), reverse=True)
        selected_hits = by_candidate[selected["candidate"]]
        test_indices = sorted(splits["validation"] + splits["holdout"] + splits["forward"])
        by_market = {}
        for market in F.MARKETS:
            indices = [index for index in test_indices if rows[index]["market"] == market]
            by_market[market] = metric(selected_hits, baselines[target], indices)

        market_choices = {}
        market_hybrid_hits = [False] * len(rows)
        for market in F.MARKETS:
            market_dev = [index for index in splits["development"] if rows[index]["market"] == market]
            choice = max(
                by_candidate,
                key=lambda name: (
                    metric(by_candidate[name], baselines[target], market_dev)["delta"],
                    metric(by_candidate[name], baselines[target], market_dev)["candidate"],
                    name,
                ),
            )
            for index, row in enumerate(rows):
                if row["market"] == market:
                    market_hybrid_hits[index] = by_candidate[choice][index]
            market_choices[market] = {
                "candidate": choice,
                **{
                    block: metric(
                        by_candidate[choice],
                        baselines[target],
                        [index for index in indices if rows[index]["market"] == market],
                    )
                    for block, indices in splits.items()
                },
            }
        market_hybrid = {
            block: metric(market_hybrid_hits, baselines[target], indices)
            for block, indices in splits.items()
        }
        market_hybrid["promotable"] = (
            market_hybrid["development"]["delta"] > 0
            and market_hybrid["validation"]["delta"] >= 0
            and market_hybrid["holdout"]["delta"] >= 0
            and market_hybrid["forward"]["delta"] >= 0
        )
        output[target] = {
            "selectedOnDevelopment": selected,
            "durableCandidates": durable[:10],
            "candidateCount": len(searched),
            "selectedTestByMarket": by_market,
            "marketSpecific": {"aggregate": market_hybrid, "choices": market_choices},
        }
    return output


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baseline"]}/{value["n"]} ({value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidate"]}/{value["n"]} ({value["candidateAccuracy"]:.1f}%) ({value["delta"]:+d})'
    )


def paired_note(value: dict[str, Any]) -> str:
    return f'{value["candidateOnly"]}:{value["baselineOnly"]}, p={value["pairedPValue"]:.3f}'


def write_report(payload: dict[str, Any]) -> None:
    labels = {
        "open": "Open digit",
        "close": "Close digit",
        "adjustedClose": "Adjusted Close digit",
        "exactJodi": "Exact Jodi (3 pairs)",
        "jodiGrid": "Jodi grid (3x3 = 9 pairs)",
    }
    lines = [
        "# Top-3 Statistical Hypothesis Research",
        "",
        f'Tested {payload["totalCandidateCount"]} target-specific formula candidates. Selection uses development only; validation, chronological holdout, and the separately frozen forward week are gates, never selectors.',
        "",
        "| Target | Development-selected formula | Development | Validation | Holdout | Frozen forward | Gate |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target, result in payload["results"].items():
        selected = result["selectedOnDevelopment"]
        lines.append(
            f'| {labels[target]} | `{selected["candidate"]}` | {format_metric(selected["development"])} | '
            f'{format_metric(selected["validation"])} | {format_metric(selected["holdout"])} | '
            f'{format_metric(selected["forward"])} | {"pass" if selected["promotable"] else "reject"} |'
        )
    lines.extend([
        "",
        "## Market-specific development selection",
        "",
        "Each market selects its own formula on development rows only; all later blocks remain untouched tests.",
        "",
        "| Target | Development | Validation | Holdout | Frozen forward | Gate |",
        "| --- | --- | --- | --- | --- | --- |",
    ])
    for target, result in payload["results"].items():
        aggregate = result["marketSpecific"]["aggregate"]
        lines.append(
            f'| {labels[target]} | {format_metric(aggregate["development"])} | '
            f'{format_metric(aggregate["validation"])} | {format_metric(aggregate["holdout"])} | '
            f'{format_metric(aggregate["forward"])} | {"pass" if aggregate["promotable"] else "reject"} |'
        )
    lines.extend([
        "",
        "| Market | Open choice | Close choice | Adjusted Close choice | Exact Jodi choice | Jodi-grid choice |",
        "| --- | --- | --- | --- | --- | --- |",
    ])
    for market in F.MARKETS:
        choices = [
            payload["results"][target]["marketSpecific"]["choices"][market]["candidate"]
            for target in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")
        ]
        lines.append(f'| {market} | ' + " | ".join(f'`{choice}`' for choice in choices) + " |")
    lines.extend(["", "## Candidates passing every gate", ""])
    for target, result in payload["results"].items():
        lines.append(f'### {labels[target]}')
        lines.append("")
        durable = result["durableCandidates"]
        if not durable:
            lines.append("None.")
        else:
            lines.extend([
                "| Formula | Development | Validation | Holdout | Frozen forward |",
                "| --- | --- | --- | --- | --- |",
            ])
            for item in durable:
                lines.append(
                    f'| `{item["candidate"]}` | {format_metric(item["development"])} | '
                    f'{format_metric(item["validation"])} | {format_metric(item["holdout"])} | '
                    f'{format_metric(item["forward"])} |'
                )
        lines.append("")
    lines.extend([
        "## Paired evidence for development-selected formulas",
        "",
        "Candidate-only:baseline-only counts use an exact two-sided sign test. These paired tests are interpretable on validation, holdout, and frozen forward only because development selected the formula.",
        "",
        "| Target | Validation | Holdout | Frozen forward |",
        "| --- | --- | --- | --- |",
    ])
    for target, result in payload["results"].items():
        selected = result["selectedOnDevelopment"]
        lines.append(
            f'| {labels[target]} | {paired_note(selected["validation"])} | '
            f'{paired_note(selected["holdout"])} | {paired_note(selected["forward"])} |'
        )
    lines.extend([
        "",
        "## Out-of-selection market stability",
        "",
        "The following table combines validation, holdout, and frozen forward rows for each development-selected formula.",
        "",
        "| Market | Open | Close | Adjusted Close | Exact Jodi | 3x3 Jodi grid |",
        "| --- | --- | --- | --- | --- | --- |",
    ])
    for market in F.MARKETS:
        values = [payload["results"][target]["selectedTestByMarket"][market] for target in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")]
        lines.append(f'| {market} | ' + " | ".join(format_metric(value) for value in values) + " |")
    lines.extend([
        "## Interpretation",
        "",
        "Passing a non-regression gate is not proof of a large signal, especially after testing many formulas. A candidate must also show a practically meaningful gain and survive additional sealed forward draws before any production recommendation.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    rows = ledger_rows(HISTORICAL, False) + ledger_rows(FORWARD, True)
    rows.sort(key=lambda row: (row["isoDate"], F.MARKETS.index(row["market"])))
    splits = build_splits(rows)
    candidates, baselines = build_predictions(rows)
    results = evaluate(rows, candidates, baselines, splits)
    payload = {
        "schemaVersion": 1,
        "topK": TOP_K,
        "rows": len(rows),
        "splits": {name: len(indices) for name, indices in splits.items()},
        "totalCandidateCount": sum(value["candidateCount"] for value in results.values()),
        "results": results,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    for target, result in results.items():
        selected = result["selectedOnDevelopment"]
        print(target, selected["candidate"], "pass" if selected["promotable"] else "reject")
        for block in ("development", "validation", "holdout", "forward"):
            print(" ", block, format_metric(selected[block]))
        print("  durable", len(result["durableCandidates"]))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
