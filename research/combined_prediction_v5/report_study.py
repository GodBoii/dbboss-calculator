"""Report the frozen selectors without selecting again from evaluation results."""
from __future__ import annotations

import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHANNELS = ("open", "close_pre", "close_known")
ENDPOINTS = ("all10", "sp30", "dp20")
LABELS = {"open": "Open", "close_pre": "Close before Open", "close_known": "Close after full Open"}
TASKS = {"all10": "Top-10", "sp30": "SP-30", "dp20": "DP-20"}
BLOCKS = ("development", "validation", "september_reused", "october_reused", "oct16_17_reused", "fresh")


def holm_adjust(pvalues: list[float]) -> list[float]:
    """Holm step-down familywise correction, valid under dependent tests."""
    order = sorted(range(len(pvalues)), key=pvalues.__getitem__)
    adjusted = [1.0] * len(pvalues)
    running = 0.0
    for rank, index in enumerate(order):
        running = max(running, (len(pvalues) - rank) * pvalues[index])
        adjusted[index] = min(1.0, running)
    return adjusted


def _key(row: dict) -> tuple[str, str, str]:
    return row["channel"], row["endpoint"], row["market"]


def _cell(block: dict | None) -> str:
    if block is None or not block["n"]:
        return "no eligible events"
    delta = block["candidate_hits"] - block["baseline_hits"]
    return f"{block['baseline_hits']}→{block['candidate_hits']}/{block['n']} ({delta:+d})"


def main() -> None:
    history = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    protocol = json.loads((HERE / "protocol.json").read_text(encoding="utf-8"))
    fresh_path = HERE / "fresh_results.json"
    fresh = json.loads(fresh_path.read_text(encoding="utf-8")) if fresh_path.exists() else None
    rows = {_key(row): dict(row, blocks=dict(row["blocks"])) for row in history["summaries"]}
    if len(rows) != 117:
        raise ValueError(f"Expected 117 frozen selectors, received {len(rows)}")
    if fresh is not None:
        if fresh["selectionSHA256"] != history["selectionSHA256"]:
            raise ValueError("Fresh and historical reports use different selections")
        if {_key(row) for row in fresh["summaries"]} != set(rows):
            raise ValueError("Fresh selector scopes differ from historical scopes")
        for row in fresh["summaries"]:
            key = _key(row)
            if rows[key]["candidate"] != row["candidate"]:
                raise ValueError(f"Fresh selector changed: {key}")
            rows[key]["blocks"].update(row["blocks"])
    keys = list(rows)
    adjusted = holm_adjust([rows[key]["blocks"].get("fresh", {}).get("paired_p", 1.0) for key in keys])
    holm = dict(zip(keys, adjusted))
    significant = [key for key in keys if holm[key] < 0.05
                   and (rows[key]["blocks"].get("fresh", {}).get("lift_pp") or 0) > 0]
    fields = ["channel", "endpoint", "market", "candidate", "block", "n", "baseline_hits", "candidate_hits",
              "lift_pp", "wins", "losses", "paired_p", "holm_p_117", "validation_gain_reversed"]
    with (HERE / "market_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for key, row in rows.items():
            validation = row["blocks"].get("validation", {})
            val_gain = validation.get("candidate_hits", 0) - validation.get("baseline_hits", 0)
            for block_name in BLOCKS:
                if block_name not in row["blocks"]:
                    continue
                block = row["blocks"][block_name]
                gain = block["candidate_hits"] - block["baseline_hits"]
                writer.writerow({**dict(zip(("channel", "endpoint", "market"), key)),
                                 "candidate": row["candidate"], "block": block_name, **block,
                                 "holm_p_117": holm[key] if block_name == "fresh" else "",
                                 "validation_gain_reversed": val_gain > 0 and gain < 0})
    lines = ["# Combined prediction V2: 500-variant market study", ""]
    if fresh is None:
        lines += ["Fresh evaluation has not been collected. Historical results cannot establish an accuracy improvement. Keep production unchanged.", ""]
    elif not significant:
        lines += ["No frozen selector establishes a positive accuracy improvement after Holm correction across all 117 fresh comparisons. Keep production unchanged.", ""]
    else:
        lines += [f"{len(significant)} frozen selector(s) show positive fresh lift with Holm-adjusted p < 0.05. These are signals for further validation, not an automatic production promotion. The short fresh window cannot establish stable market-level performance.", ""]
    lines += ["## What was tested", "",
              "Exactly 100 patterns, 100 methods, 100 theories, 100 formulas and 100 combinations were evaluated, 500 parameterized variants plus the unchanged production baseline. The category names describe hypothesis groups. They do not mean 500 independent algorithms or scientific theories.", "",
              "Every variant was scored separately for three forecast channels and three fixed pick budgets, nine channel/endpoint settings, on all 12 markets. Selection used development and validation only. One pooled selector and 12 separate market selectors were frozen for each setting, 117 selectors in total. A market winner is never chosen from the fresh results.", "",
              "Top-10 is evaluated on every legal panel outcome. SP-30 is conditional on the actual panel having three distinct digits. DP-20 is conditional on the actual panel having exactly two distinct digits. These denominators and budgets differ, so their accuracy percentages are not added or averaged.", "",
              f"Historical input: {history['rows']} market-date events, {history['date_range'][0]} through {history['date_range'][1]}. Each market-date has Open and Close outcomes; repeating channels, endpoints or candidates does not create independent observations.", ""]
    if fresh:
        lines += [f"Combined replay after fresh collection: {fresh['rows']} market-date events through {fresh['date_range'][1]}. The requested fresh window is October 18-22, 2026. Missing market dates are not invented. Each table reports its own eligible count.", ""]
        with (HERE / "fresh_context_rows.csv").open(encoding="utf-8", newline="") as handle:
            context_count = sum(1 for _ in csv.DictReader(handle))
        lines += [f"Fresh upstream model features include {context_count} newly collected October 16-17 context draws that were absent from the sealed historical replay. The added V5 pattern counts and online method updates use the sealed replay plus fresh target rows, so they omit those context draws. This preserves the frozen historical predictions but gives those candidates a sparser history than the upstream baseline. Fresh results describe this exact replay procedure; they do not establish performance with complete online history.", ""]
    lines += ["Development is July 4-August 16. Validation is August 17-September 7, split at August 27. A candidate must avoid development regression and gain hits in both validation halves. Otherwise production is retained. September 8-October 17 is reused diagnostic history. Selection and candidate definitions were frozen and hashed before requesting the October 18-22 outcomes. This is a retrospective collection after selection freeze, not a pre-event forecast registry.", "",
              "Added historical features and online weights use only outcomes from strictly earlier dates. Online rules predict every market for a date before updating with any labels from that date. Added count histories begin at the first replay date. Frozen upstream models retain historical fitting and policy-selection bias. The Close-after-Open channel receives the full declared Open panel, matching this replay contract.", "",
              "## Pooled selectors", "",
              "Cells show production hits → selected hits / eligible events, followed by net hits. Every row keeps the same pick budget.", "",
              "| Channel / budget | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |",
              "|---|---|---|---|---|---|---|"]
    for channel in CHANNELS:
        for endpoint in ENDPOINTS:
            key = channel, endpoint, "ALL"
            row = rows[key]
            blocks = row["blocks"]
            cells = [_cell(blocks.get(name)) for name in BLOCKS[2:]]
            p = f"{holm[key]:.4g}" if fresh else "pending"
            lines.append(f"| {LABELS[channel]} / {TASKS[endpoint]} | `{row['candidate']}` | " + " | ".join(cells) + f" | {p} |")
    lines += ["", "## Market results", "",
              "Market selection is independent for every channel and budget. A positive validation result followed by negative evaluation net hits is a reversal. These comparisons are retained even when a different market improves.", ""]
    if fresh:
        lines += ["Fresh market counts compare selected hits with production separately in each of the 12 markets. Ties include selectors that retained production. Markets with zero eligible outcomes are counted separately. Counts across settings share outcomes and are not independent evidence.", "",
                  "| Channel / budget | More hits | Fewer hits | Same hits | No eligible outcomes |",
                  "|---|---:|---:|---:|---:|"]
        for channel in CHANNELS:
            for endpoint in ENDPOINTS:
                gains = regressions = ties = no_events = 0
                for market in history["markets"]:
                    block = rows[channel, endpoint, market]["blocks"].get("fresh")
                    if block is None or not block["n"]:
                        no_events += 1
                    else:
                        delta = block["candidate_hits"] - block["baseline_hits"]
                        gains += delta > 0
                        regressions += delta < 0
                        ties += delta == 0
                lines.append(f"| {LABELS[channel]} / {TASKS[endpoint]} | {gains} | {regressions} | {ties} | {no_events} |")
        lines.append("")
    for channel in CHANNELS:
        for endpoint in ENDPOINTS:
            lines += [f"### {LABELS[channel]} / {TASKS[endpoint]}", "",
                      "| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |",
                      "|---|---|---|---|---|---|---|"]
            for market in history["markets"]:
                key = channel, endpoint, market
                row = rows[key]
                cells = [_cell(row["blocks"].get(name)) for name in BLOCKS[2:]]
                p = f"{holm[key]:.4g}" if fresh else "pending"
                lines.append(f"| {market} | `{row['candidate']}` | " + " | ".join(cells) + f" | {p} |")
            lines.append("")
    lines += ["## Duplicate candidates and uncertainty", "",
              "Candidate IDs are unique. Probability-distribution fingerprints round to 12 decimal places. Equal fingerprints identify numerical duplicates across the full replay. Different distributions can still produce identical panel rankings and hit vectors; distribution counts alone do not establish distinct ranking rules or independent tests.", "",
              "| Channel / budget | Distinct historical probability distributions, including production |",
              "|---|---:|"]
    for channel in CHANNELS:
        for endpoint in ENDPOINTS:
            row = rows[channel, endpoint, "ALL"]
            lines.append(f"| {LABELS[channel]} / {TASKS[endpoint]} | {row['unique_distributions']} / 501 |")
    lines += ["", "Fresh paired p-values compare discordant hits with an exact two-sided binomial test. Holm correction covers all 117 pooled and market selectors, including selectors that retain production. Holm handles dependence between comparisons, but the underlying event-level tests still assume independent discordances. Same-date market dependence is not removed by this correction. Five days are too few to establish stable market-specific superiority.", "",
              "Probability improvements alone do not imply better fixed-budget accuracy. Log loss, Brier score and the Sutta-6/present-pair/absent-pair diagnostics are recorded in candidate_metrics.csv.gz and fresh_candidate_metrics.csv.gz. Those derived outputs are scored from SP-30 probabilities and are not additional independent panel observations.", "",
              "Promotion requires positive fresh lift after correction, adequate market support and checks that other required outputs do not suffer unacceptable regression. This report does not change production, and a short-window statistical signal alone does not satisfy all those conditions.", "",
              "## Reproduce and inspect", "",
              "`python -B research/combined_prediction_v5/report_study.py` rebuilds this report and market_summary.csv from existing result files. It does not fit models, change selectors or request new outcomes. catalogue.json gives every candidate definition. selection.json and selection_manifest.json record the frozen routing decisions and hashes. The compressed candidate metric ledgers include every variant on every market and evaluation block.", "",
              "Run these commands from the repository root with Python, NumPy and SciPy available. Existing sealed replay files and the frozen V5 files must be present. The fresh scoring command reads the already collected fresh replay and verifies frozen hashes before scoring. It does not fetch new outcomes.", "",
              "```text",
              "python -B research/combined_prediction_v5/run_study.py --fresh",
              "python -B research/combined_prediction_v5/verify_study.py --fresh-only",
              "python -B research/combined_prediction_v5/report_study.py",
              "```", "",
              "For a full candidate-distribution and label-perturbation reconstruction, run `python -B research/combined_prediction_v5/verify_study.py` instead of the shorter fresh-only audit. Historical selection is sealed; run_study.py deliberately refuses to refit it in this folder. The fresh-only audit requires the recorded successful historical reconstruction.", "",
              "The CSV contains separate rows for all 117 selectors and every available block, including validation gains, historical reversals, fresh exact paired tests and fresh Holm-adjusted p-values.", "",
              "## Research references", ""]
    source_labels = ["Scikit-learn guidance on data leakage", "Forecasting: rolling-origin evaluation", "Forecasting: forecast combinations"]
    for index, url in enumerate(protocol.get("sources", [])):
        label = source_labels[index] if index < len(source_labels) else "Research reference"
        lines.append(f"- [{label}]({url})")
    lines += ["", "These sources inform the protocol. The measured results come from this repository's historical and fresh replay files.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"selectors": len(rows), "fresh_available": fresh is not None,
                      "positive_holm_signals": len(significant), "outputs": ["REPORT.md", "market_summary.csv"]}))


if __name__ == "__main__":
    main()
