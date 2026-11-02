"""Report frozen objective selectors and every companion metric without reselection."""
from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
METRICS = ("top5", "avoid2", "panel10", "sp30", "dp20", "sutta_avoid", "joint10", "joint_sp30", "joint_dp20")
BLOCKS = ("development", "validation", "refine_train", "refine_validation", "late_reused", "extension")


def read(name: str) -> object:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def key(row: dict) -> tuple[str, str, str]:
    return row["channel"], row["objective"], row["market"]


def cell(result: dict | None) -> str:
    if result is None or result["n"] == 0:
        return "—"
    delta = result["candidate_hits"] - result["baseline_hits"]
    return f"{result['baseline_hits']}→{result['candidate_hits']}/{result['n']} ({delta:+d})"


def holm_adjust(pvalues: list[float]) -> list[float]:
    order = sorted(range(len(pvalues)), key=pvalues.__getitem__)
    output = [1.0] * len(pvalues)
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, (len(pvalues) - rank) * pvalues[index])
        output[index] = min(1.0, running)
    return output


def main() -> None:
    history = read("results.json")
    selections = read("selection.json")
    catalogue, shortlist = read("catalogues.json"), read("shortlist.json")
    rows = {key(row): row for row in history["summaries"]}
    if len(rows) != len(selections) or set(rows) != {key(row) for row in selections}:
        raise ValueError("Result scopes do not match frozen selections")
    extension_path = HERE / "extension_results.json"
    if not extension_path.exists():
        extension_path = HERE / "fresh_results.json"
    extension = read(extension_path.name) if extension_path.exists() else None
    if extension:
        if extension["selectionSHA256"] != history["selectionSHA256"]:
            raise ValueError("Extension uses different frozen selections")
        if {key(row) for row in extension["summaries"]} != set(rows):
            raise ValueError("Extension result scopes differ")
        for extra in extension["summaries"]:
            row = rows[key(extra)]
            if row["candidate"] != extra["candidate"] or row["index"] != extra["index"]:
                raise ValueError("Extension changed a selected candidate")
            for metric, blocks in extra["metrics"].items():
                row["metrics"][metric].update(blocks)
    for chosen in selections:
        row = rows[key(chosen)]
        if row["candidate"] != chosen["candidate"] or row["index"] != chosen["index"]:
            raise ValueError("Historical results changed a frozen candidate")
        if set(row["metrics"]) != set(METRICS):
            raise ValueError("A companion metric is missing")
    scope_keys = list(rows)
    adjusted = holm_adjust([rows[k]["metrics"][k[1]].get("extension", {}).get("paired_p", 1.0) for k in scope_keys])
    holm = dict(zip(scope_keys, adjusted))
    significant = [k for k in scope_keys if holm[k] < .05 and rows[k]["metrics"][k[1]].get("extension", {}).get("lift_pp", 0) > 0]
    fields = ["channel", "objective", "market", "candidate", "metric", "block", "n", "all_event_n",
              "baseline_hits", "candidate_hits", "net_hits", "baseline_rate_pct", "candidate_rate_pct",
              "baseline_all_event_rate_pct", "candidate_all_event_rate_pct", "wins", "losses", "paired_p", "holm_p_objective_family", "day_bootstrap95_pp"]
    ledger = []
    for row in rows.values():
        for metric in METRICS:
            for block, result in row["metrics"][metric].items():
                total = row["metrics"]["top5"][block]["n"]
                n = result["n"]
                ledger.append({**dict(zip(("channel", "objective", "market"), key(row))),
                               "candidate": row["candidate"], "metric": metric, "block": block,
                               **{name: result[name] for name in ("n", "baseline_hits", "candidate_hits", "wins", "losses", "paired_p")},
                               "all_event_n": total, "net_hits": result["candidate_hits"] - result["baseline_hits"],
                               "holm_p_objective_family": holm[key(row)] if block == "extension" and metric == row["objective"] else "",
                               "day_bootstrap95_pp": json.dumps(result.get("day_bootstrap95_pp")),
                               "baseline_rate_pct": 100 * result["baseline_hits"] / n if n else "",
                               "candidate_rate_pct": 100 * result["candidate_hits"] / n if n else "",
                               "baseline_all_event_rate_pct": 100 * result["baseline_hits"] / total if total else "",
                               "candidate_all_event_rate_pct": 100 * result["candidate_hits"] / total if total else ""})
    with (HERE / "market_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(ledger)
    lines = ["# Combined prediction V6: joint fixed-budget study", "",
             "Production remains unchanged. These results are retrospective research and do not establish a durable accuracy improvement.", "",
             (f"{len(significant)} of {len(rows)} frozen objective selectors have positive extension lift with Holm-adjusted p < 0.05. These exploratory signals require prospective confirmation." if extension else "Final extension evaluation is pending.") if significant or not extension else f"No frozen objective selector has positive extension lift after Holm correction across all {len(rows)} objective comparisons.", "",
             "The study selects separately for Top-5 Sutta, two absent digits, panel Top-10, SP-30, DP-20, Sutta plus absent digits, and each corresponding three-component joint hit. Every selected candidate is also evaluated on all nine metrics. A joint hit requires all declared components to hit on the same event.", "",
             "Panel budgets are exactly 10 from 220 legal panels, 30 from 120 SP panels, and 20 from 90 DP panels. Sutta uses exactly five digits; avoid uses exactly two distinct digits absent from the actual panel. Ties use stable universe order. SP/DP and their joint metrics are conditional on the actual panel kind. CSV all-event rates additionally count other panel kinds as misses. Rates with different denominators are never averaged.", "",
             "Stage 1 uses development through August 16 and validation August 17–September 7. Stage 2 uses September 8–30 for refinement training and October 1–15 for refinement validation. October 16–22 is diagnostic history. October 23–November 1 is the final extension. Candidate definitions and selectors are frozen before extension retrieval, but earlier research already reused source outcomes; neither chronological retrieval nor frozen hashes makes this a genuinely untouched or pre-event test.", "",
             "The extension contains 88 complete market-date records across 11 markets; Madhur Night has no eligible extension records. Missing events are not invented. Five complete raw context records are absent from the sparse replay history used by added historical candidates, while upstream production features use the available raw history. This uneven history support limits attribution and the interpretation of comparisons." if extension else "", "",
             "Selection across many variants, objectives, channels and markets creates substantial selection bias. Channels and metrics reuse outcomes; their counts are not independent observations. New historical features can be checked for strictly earlier-date updates, while upstream fitted features retain their historical selection bias. Close after Open receives the full declared Open panel.", "",
             "## Pooled objective results", "",
             "Cells show baseline hits → selected hits / eligible events (net hits). Each row concerns its selected objective only; companion regressions appear below and in the CSV.", "",
             "| Channel | Objective | Candidate | Refinement validation | October 16–22 reused | October 23–November 1 extension | Extension Holm p | Extension day-bootstrap 95% lift pp |",
             "|---|---|---|---|---|---|---|---|"]
    if extension:
        pooled_joint = [row for row in rows.values() if row["market"] == "ALL" and row["objective"].startswith("joint")]
        largest = max(pooled_joint, key=lambda row: row["metrics"][row["objective"]]["extension"]["candidate_hits"] - row["metrics"][row["objective"]]["extension"]["baseline_hits"])
        result = largest["metrics"][largest["objective"]]["extension"]
        guardrails = []
        for metric in ("top5", "avoid2", "panel10", "sp30", "dp20", "sutta_avoid"):
            companion = largest["metrics"][metric]["extension"]
            guardrails.append(f"{metric} {companion['candidate_hits']-companion['baseline_hits']:+d}")
        narrative = (f"The largest observed pooled three-component gain is {largest['channel']}/{largest['objective']}: {cell(result)}; "
                     f"paired p={result['paired_p']:.4g}, Holm p={holm[key(largest)]:.4g}. For this same selector, companion net hits are "
                     + ", ".join(guardrails) + ". This is an observed joint gain with output tradeoffs, not a uniform accuracy gain. It is highlighted descriptively after evaluation, not chosen as a new deployment rule.")
        position = lines.index("## Pooled objective results")
        lines[position:position] = [narrative, ""]
    for row in rows.values():
        if row["market"] == "ALL":
            blocks = row["metrics"][row["objective"]]
            interval = blocks.get("extension", {}).get("day_bootstrap95_pp")
            ci = "pending" if interval is None else f"[{interval[0]:.2f}, {interval[1]:.2f}]"
            p = f"{holm[key(row)]:.4g}" if extension else "pending"
            lines.append(f"| {row['channel']} | {row['objective']} | `{row['candidate']}` | " + " | ".join(cell(blocks.get(block)) for block in BLOCKS[3:]) + f" | {p} | {ci} |")
    lines += ["", "## Candidate families and retained hypotheses", "",
              "Counts describe parameter variants, not independent theories. A stage-one variant absent from the retained column won no objective/market shortlist; it may still have positive cells. Refined counts include mixtures of the retained parents.", "",
              "| Channel | Family | Coarse variants | Distinct retained stage-one variants |", "|---|---|---:|---:|"]
    for channel, definitions in catalogue.items():
        retained = {row["candidate"] for row in shortlist if row["channel"] == channel}
        for family, count in Counter(c["family"] for c in definitions["coarse"]).items():
            survived = sum(c["id"] in retained for c in definitions["coarse"] if c["family"] == family)
            lines.append(f"| {channel} | {family} | {count} | {survived} |")
        local = [s for s in selections if s["channel"] == channel]
        lines += ["", f"{channel}: {len(definitions['refined']) - 1} refinement variants; {sum(s['candidate'] != 'production' for s in local)}/{len(local)} objective/market selectors retained an experimental refinement.", ""]
    lines += ["## Refinement added value", "",
              "This comparison uses each scope's own stage-one winner and final refinement on the same objective and events. Refinement validation influenced final selection, so apparent gains there are selected gains. October 16–22 was diagnostic history. This table measures added refinement value rather than conflating it with improvement over production.", "",
              "| Channel | Objective | Refinement validation: stage 1→final | October 16–22: stage 1→final |",
              "|---|---|---|---|"]
    stage1 = {key(row): row for row in shortlist}
    refinement_rows = []
    with np.load(HERE / "hits.npz", allow_pickle=False) as archive:
        dates, markets = archive["dates"], archive["markets"]
        for row in rows.values():
            channel, objective, market = key(row)
            previous = stage1[key(row)]
            prefix = channel + "__"
            coarse = archive[prefix + "coarse__" + objective][previous["index"]]
            refined = archive[prefix + "refined__" + objective][row["index"]]
            eligible = archive[prefix + "refined__" + objective + "__eligible"]
            scope = np.ones(len(dates), dtype=bool) if market == "ALL" else markets == market
            cells = []
            for block, period in (("refine_validation", (dates >= "2026-10-01") & (dates <= "2026-10-15")),
                                  ("late_reused", (dates >= "2026-10-16") & (dates <= "2026-10-22"))):
                used = scope & eligible & period
                before, after, n = int(coarse[used].sum()), int(refined[used].sum()), int(used.sum())
                refinement_rows.append({"channel": channel, "objective": objective, "market": market, "block": block,
                                        "stage1_candidate": previous["candidate"], "final_candidate": row["candidate"],
                                        "n": n, "stage1_hits": before, "final_hits": after, "net_added_hits": after - before})
                cells.append(f"{before}→{after}/{n} ({after-before:+d})")
            if market == "ALL":
                lines.append(f"| {channel} | {objective} | " + " | ".join(cells) + " |")
    with (HERE / "refinement_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(refinement_rows[0]))
        writer.writeheader()
        writer.writerows(refinement_rows)
    lines += ["", "## Companion-metric guardrails", "",
              "Every row counts market selectors separately, excluding pooled selectors. Improvements in one metric never cancel regressions in another. Zero-event cells are listed separately. All companion results, including regressions for the selected objective itself, remain in the CSV.", "",
              "| Block | Metric | More hits | Fewer hits | Same hits | No eligible events |",
              "|---|---|---:|---:|---:|---:|"]
    for block in BLOCKS[3:]:
        for metric in METRICS:
            counts = [0, 0, 0, 0]
            for row in rows.values():
                if row["market"] == "ALL":
                    continue
                result = row["metrics"][metric].get(block)
                if result is None:
                    continue
                delta = result["candidate_hits"] - result["baseline_hits"]
                counts[3 if not result["n"] else 0 if delta > 0 else 1 if delta < 0 else 2] += 1
            if sum(counts):
                lines.append(f"| {block} | {metric} | " + " | ".join(map(str, counts)) + " |")
    lines += ["", "## Individual market objective results", "",
              "| Channel | Objective | Market | Candidate | Refinement validation | October 16–22 reused | Extension |",
              "|---|---|---|---|---|---|---|"]
    for row in rows.values():
        if row["market"] != "ALL":
            blocks = row["metrics"][row["objective"]]
            lines.append(f"| {row['channel']} | {row['objective']} | {row['market']} | `{row['candidate']}` | " + " | ".join(cell(blocks.get(block)) for block in BLOCKS[3:]) + " |")
    lines += ["", "## Audit and reproduction", "",
              f"`market_summary.csv` contains every objective selector, companion metric, market and block, preserving eligible and all-event denominators. Holm correction covers all {len(rows)} frozen objective-specific extension comparisons, including production-retaining selectors. Companion metrics are guardrail diagnostics outside this formal family. Paired p-values are exploratory: Holm handles dependence between comparisons but cannot repair same-date dependence within event-level tests or prior outcome reuse.", "",
              "Day-bootstrap intervals resample whole dates with 2,000 replicates and a fixed seed, preserving within-date market dependence. They are unadjusted diagnostic intervals; few extension dates, serial dependence and reused history limit their interpretation. Positive significance alone never authorizes production promotion.", "",
              "The extension audit found exactly one historical hit change in an unselected numerical control: close_pre Top-5 Sutta, Time Bazar, October 22, refined uniform-Sutta alpha=1. Its panel probabilities differ by at most 1.74×10⁻¹⁷ and Sutta masses tie at the fifth-pick boundary within 10⁻¹². The batch-size arithmetic changes that control's tie ordering. No objective or market selected this control, every selected historical prediction remains identical, and no frozen definition or selector was changed. The audit records this explicit limitation rather than asserting universal historical stability.", "",
              "Run `python -B research/combined_prediction_v6/verify_study.py` to reconstruct frozen selections, hit archives, summaries, budgets and added-feature causality. Run `python -B research/combined_prediction_v6/report_study.py` to regenerate this report without selection or network requests.", "",
              "" if extension else "Final extension results have not been collected; extension cells are pending.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"selectors": len(rows), "metric_rows": len(ledger), "extension_available": extension is not None}))


if __name__ == "__main__":
    main()
