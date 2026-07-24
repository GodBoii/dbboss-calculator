"""Generate the consolidated absent-digit research deliverable."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "FINAL_RESEARCH_REPORT.md"


def load(path: str) -> dict[str, Any]:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def pct(value: float) -> str:
    return f"{100 * value:.2f}%"


def pp(value: float) -> str:
    return f"{value:+.2f}"


def main() -> None:
    v2 = load("research/absent_digits_v2/results.json")
    v3 = load("research/absent_digits_hypotheses_v3/results.json")
    recent = load(
        "research/absent_digits_hypotheses_v3/RECENT_MARKET_BACKTEST.json"
    )
    ml = load("research/absent_digits_ml_v4/results.json")
    calibration = load("research/absent_digits_v2/calibration_results.json")
    forward = load("research/absent_digits_v2/FORWARD_SCORE.json")
    completion = load("research/absent_digits_v2/COMPLETION_AUDIT.json")

    raw_routes = ml["rawCandidate"]["marketSides"]
    markets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for route, metric in raw_routes.items():
        market, _ = route.rsplit("|", 1)
        markets[market].append(metric)

    lines = [
        "# Absent-Digits Prediction Engine: Final Research Report",
        "",
        "Date: 2026-07-24",
        "",
        "## Executive decision",
        "",
        "The scientifically supported comparator is "
        "`absent-digits-complementary-online-v2`. Following an explicit "
        "user-directed decision on 2026-07-25, the guarded "
        "`absent-digits-guarded-market-routing-v3` model is the app default.",
        "",
        "- V2 combines a digit-appearance model with a direct pair-absence model "
        "at the validation-selected 75/25 weight.",
        "- The complete domain study tested 110 named hypotheses; zero survived "
        "all out-of-sample, FDR, route, and time-stability gates.",
        "- The observational V3 routes improved the inspected 180-day aggregate "
        "by 0.63 percentage points, but the paired result was not significant "
        "(`p=.0865`) and no route survived FDR. V3 is deployed by user "
        "direction with automatic V2 fallback; this caveat remains controlling.",
        "- A new nested chronological ridge family improved Validation, Holdout, "
        "and Recent, but failed paired confirmation (`p=.0579`) and worst-route "
        "stability. It was rejected.",
        "- No market-side supports the requested 80% Wilson lower confidence "
        "bound. The runtime correctly emits `NO_SAFE_CALL` while still exposing "
        "research candidates and per-digit probabilities.",
        "",
        "## 1. Current architecture",
        "",
        "1. Historical Open/Close panels are normalized, date-deduplicated, and "
        "cut off strictly before the target date.",
        "2. Model A estimates each digit's appearance probability from long, "
        "30/90-draw, weekday, and previous-panel-state experts.",
        "3. Model B directly estimates every absent pair from long, 30/90-draw, "
        "weekday, and transition experts.",
        "4. Each family updates expert weights prequentially with an exponentially "
        "weighted Brier loss; V2 blends Model A and B 75/25.",
        "5. The two digits with the strongest blended absence evidence become the "
        "candidate; the five highest appearance probabilities are also returned.",
        "6. Point confidence uses the promoted 240-event, strength-80 beta "
        "calibrator. Actionability remains controlled by an independent 120-event "
        "Wilson lower bound and a 30-event minimum.",
        "7. The UI receives per-digit appearance/absence probabilities, model "
        "contributors, agreement, reliability, confidence interval, and call/"
        "abstain status.",
        "",
        "## 2. Frozen V2 baseline",
        "",
        "| Block | Hits / N | Strict accuracy | Random reference | Macro | Worst market-side |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for block, metric in v2["blocks"].items():
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{metric['hits']}/{metric['rows']} | "
            f"{pct(metric['strictAccuracy'])} | "
            f"{pct(metric['randomReference'])} | "
            f"{pct(metric['marketMacroAccuracy'])} | "
            f"{pct(metric['worstMarketSideAccuracy'])} |"
        )

    lines.extend([
        "",
        "## 3. Candidate improvement comparison",
        "",
        "| Candidate | Evaluation | Candidate | V2 | Lift | Paired p | Decision |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ])
    for window, label in (("last180", "Last 180 days"), ("last30", "Last 30 days")):
        candidate = recent["strategies"]["promoted_guarded_market_v3"][window]
        lines.append(
            f"| Observational V3 | {label} | "
            f"{candidate['hits']}/{candidate['n']} ({pct(candidate['accuracy'])}) | "
            f"{candidate['baselineHits']}/{candidate['n']} "
            f"({pct(candidate['baselineAccuracy'])}) | "
            f"{pp(candidate['liftPoints'])} pp | "
            f"{candidate['pairedPValue']:.4g} | Research-only |"
        )
    for block, metric in ml["rawCandidate"]["blocks"].items():
        lines.append(
            f"| Nested ridge | {block.replace('_', ' ').title()} | "
            f"{metric['hits']}/{metric['n']} ({pct(metric['accuracy'])}) | "
            f"{metric['baselineHits']}/{metric['n']} "
            f"({pct(metric['baselineAccuracy'])}) | "
            f"{pp(metric['liftPoints'])} pp | "
            f"{metric['pairedPValue']:.4g} | Rejected |"
        )

    lines.extend([
        "",
        "## 4. Market-wise confirmation comparison",
        "",
        "The table aggregates Open and Close for the nested model after it was "
        "selected entirely before Validation. Positive rows remain exploratory "
        "because the family failed its global promotion gate.",
        "",
        "| Market | N | V2 | Nested ridge | Lift | Production model |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ])
    for market in sorted(markets):
        values = markets[market]
        n = sum(item["n"] for item in values)
        baseline_hits = sum(item["baselineHits"] for item in values)
        hits = sum(item["hits"] for item in values)
        lines.append(
            f"| {market} | {n} | {baseline_hits}/{n} "
            f"({pct(baseline_hits / n)}) | {hits}/{n} ({pct(hits / n)}) | "
            f"{pp(100 * (hits - baseline_hits) / n)} pp | V2 |"
        )

    lines.extend([
        "",
        "## 5. Best model and feature evidence by market-side",
        "",
        "No market-specific challenger passed the full promotion protocol, so V2 "
        "remains the best deployable model for every row. The listed ML feature "
        "is the strongest standardized local coefficient and is explanatory, "
        "not a promotion.",
        "",
        "| Market-side | Deployable model | Exploratory top feature | ML lift |",
        "| --- | --- | --- | ---: |",
    ])
    local_importance = ml["featureImportance"]["marketSideTopFeatures"]
    for route in sorted(raw_routes):
        top = local_importance[route][0]["feature"]
        lines.append(
            f"| {route} | V2 | `{top}` | "
            f"{pp(raw_routes[route]['liftPoints'])} pp |"
        )

    lines.extend([
        "",
        "## 6. Global feature importance",
        "",
        "Absolute standardized ridge coefficients for the frozen pooled component:",
        "",
        "| Rank | Feature | Importance |",
        "| ---: | --- | ---: |",
    ])
    for rank, item in enumerate(
        ml["featureImportance"]["pooledTopFeatures"][:15], 1
    ):
        lines.append(
            f"| {rank} | `{item['feature']}` | {item['importance']:.6f} |"
        )

    lines.extend([
        "",
        "## 7. Ranked successful findings",
        "",
        "1. **75/25 complementary formulation retained.** Validation selected the "
        "appearance/direct-absence blend. Its selection is still uncertain "
        "(53.2% bootstrap frequency), so it is preserved rather than overstated.",
        "2. **240-event beta confidence calibration promoted.** It improved Brier "
        "loss on Validation and both confirmation/later comparisons while leaving "
        "the independent Wilson safety gate unchanged.",
        "3. **Causal isolation and runtime parity proven.** Target/future-row "
        "contamination tests, 24 market-side registry parity, hashes, and minimum "
        "history enforcement pass.",
        "4. **Abstention retained.** No candidate has evidence for an 80% lower "
        "bound, so forcing calls would reduce reliability.",
        "",
        "No domain-specific predictive hypothesis earned production promotion.",
        "",
        "## 8. Ranked rejected hypotheses and families",
        "",
        "| Rank | Candidate | Best observed evidence | Rejection reason |",
        "| ---: | --- | --- | --- |",
    ])
    ranked = sorted(
        (
            (name, value)
            for name, value in v3["results"].items()
            if value["contract"] == "pre_open"
        ),
        key=lambda item: (
            item[1]["blocks"]["holdout"]["liftPoints"]
            + item[1]["blocks"]["recent"]["liftPoints"]
        ),
        reverse=True,
    )
    for rank, (name, value) in enumerate(ranked[:15], 1):
        holdout = value["blocks"]["holdout"]["liftPoints"]
        recent_lift = value["blocks"]["recent"]["liftPoints"]
        lines.append(
            f"| {rank} | `{name}` | Holdout {pp(holdout)} pp; "
            f"Recent {pp(recent_lift)} pp | Failed one or more validation, "
            "FDR, later, route, or month-stability gates |"
        )
    lines.append(
        f"| 16 | Nested ridge `{ml['selectedConfig']}` | Confirmation paired "
        "`p=.0579` | Not significant; worst route -6.53 pp |"
    )
    lines.append(
        "| 17 | Observational V3 route set | +0.63 pp over 180 days | "
        "Post-selection, `p=.0865`, zero FDR-confirmed routes |"
    )

    selected_calibration = calibration["selectedMethod"]
    calibration_blocks = {
        block: methods[selected_calibration]
        for block, methods in calibration["blocks"].items()
    }
    lines.extend([
        "",
        "## 9. Confidence calibration",
        "",
        f"Promoted point estimator: `{selected_calibration}`.",
        "",
        "| Block | Observed | Mean predicted | Brier | ECE | AUC |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ])
    for block, metric in calibration_blocks.items():
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(metric['observedRate'])} | {pct(metric['meanPredicted'])} | "
            f"{metric['brier']:.4f} | {pct(metric['ece'])} | "
            f"{metric['auc']:.4f} |"
        )

    lines.extend([
        "",
        "## 10. Failure analysis",
        "",
        "- Strict accuracy remains near the combinatorial random reference in the "
        "large blocks; apparent short-window lifts are small relative to noise.",
        "- Cross-market, opposite, rotation, house, calendar, streak, HMM, "
        "association, and sequence effects change across chronology and routes.",
        "- Market-specific selection overfits small samples: V2 local routing won "
        "Validation significantly but did not retain its advantage later.",
        "- V3's shortlist was chosen after viewing recent windows; its apparent "
        "lift is not independent confirmation.",
        "- Nested ridge improved average Brier loss and several aggregates, but "
        "market-side losses reached 6.53 points and its paired confirmation just "
        "missed the preregistered threshold.",
        "- Confidence has weak discrimination (AUC close to .5), so high model "
        "scores cannot be interpreted as high hit probability.",
        "",
        "## 11. Research journal",
        "",
        "| Cycle | Experiment | Result | Decision |",
        "| ---: | --- | --- | --- |",
        "| 1 | Exact V2 baseline replay | Metrics reproduced across five blocks | Freeze comparator |",
        "| 2 | Appearance/absence blend grid | 75/25 selected; bootstrap-uncertain | Retain conservatively |",
        "| 3 | Dynamic expert weighting ablation | Alternative weighting failed later gates | Retain EMA baseline |",
        "| 4 | Feature ablation | Validation winner regressed later | Reject |",
        "| 5 | Exact-panel residual model | Failed promotion | Reject |",
        "| 6 | Local blend routing | Validation gain vanished later | Reject |",
        "| 7 | Selective confidence/agreement gates | Failed confirmation and 80% bound | Reject |",
        "| 8 | Confidence calibration (44 estimators) | 240/80 beta improved Brier robustly | Promote point calibration |",
        f"| 9 | Domain hypothesis library | {v3['hypothesesTested']} tested, "
        f"{len(v3['keptForProspective'])} retained | Reject all |",
        "| 10 | Recent static/rolling/guarded routing | Small non-significant lift | Research-only, rollback default |",
        f"| 11 | Nested ridge ({ml['candidateConfigurations']} configs, "
        f"{ml['featureCount']} features) | Positive major-block lift; failed "
        "significance/stability | Reject |",
        "",
        "## 12. Forward evidence status",
        "",
        f"- Frozen cohorts: {completion['prospective']['cohorts']}.",
        f"- Pending market-side outcomes: {forward['pending']}.",
        f"- Safe calls frozen: {forward['calls']['frozen']}; scored: "
        f"{forward['calls']['scored']}.",
        "- Historical blocks are now inspected. New model-family claims require a "
        "hash-frozen prospective cohort; re-mining the same rows is exploratory.",
        "",
        "## 13. Remaining weaknesses",
        "",
        "- Outcome history alone contains little stable predictive information.",
        "- The independent extension is small, producing wide uncertainty.",
        "- Publication timestamps are approximated from schedules rather than "
        "observed event timestamps.",
        "- Holiday metadata is incomplete and geography labels are absent.",
        "- Model A and Model B are complementary formulations but not statistically "
        "independent because both use the same outcome history.",
        "- The 80% target is unsupported; current safe behavior is abstention.",
        "",
        "## 14. Prioritized roadmap",
        "",
        "1. Score cohort 001 without restarts or omissions, then register cohort "
        "002 only after every pending row is resolved.",
        "2. Freeze the nested ridge candidate as a shadow model—not production—and "
        "compare it prospectively against V2.",
        "3. Add authoritative per-event publication timestamps before using "
        "same-day cross-market inputs.",
        "4. Add genuinely new lawful pre-draw covariates; more transformations of "
        "the same outcome history are unlikely to supply independent signal.",
        "5. Reassess only at preregistered sample checkpoints with paired tests, "
        "route stability, calibration, and multiplicity control.",
        "",
        "## Reproduction",
        "",
        "```powershell",
        "python research/absent_digits_v2/run_research.py",
        "python research/absent_digits_hypotheses_v3/run_hypothesis_research.py",
        "python research/absent_digits_ml_v4/run_nested_ml.py",
        "npm run verify:absent-digits",
        "npm run verify:absent-digits-runtime",
        "npm run verify:absent-digits-v3-runtime",
        "npm run verify:absent-digits-v3-backtest",
        "npm run verify:absent-digits-ml",
        "npm run lint",
        "npm run build",
        "```",
        "",
    ])
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
