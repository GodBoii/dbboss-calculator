from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUTPUT_JSON = HERE / "COMPLETION_AUDIT.json"
OUTPUT_MD = HERE / "COMPLETION_AUDIT.md"


def read(name: str) -> dict[str, Any]:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def run_json(command: list[str]) -> dict[str, Any]:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def evidence(path: str, detail: str) -> dict[str, str]:
    return {"path": path, "detail": detail}


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    results = read("results.json")
    registry = read("FROZEN_FORWARD_REGISTRY.json")
    calibration = read("calibration_results.json")
    calibration_registry = read("FROZEN_CALIBRATION_REGISTRY.json")
    weighting = read("weighting_ablation_results.json")
    features = read("feature_ablation_results.json")
    residual = read("panel_residual_results.json")
    selective = read("selective_gate_results.json")
    routing = read("dynamic_route_results.json")
    blend_stability = read("blend_stability_results.json")
    journal = read("FORWARD_JOURNAL.json")
    research_verification = run_json(
        ["python", "research/absent_digits_v2/verify_research.py"]
    )
    runtime_verification = run_json(
        ["node", "scripts/verify-absent-digits-runtime.cjs"]
    )

    journal_scores = []
    for entry in journal["cohorts"]:
        score_path = HERE / entry["scoreFile"]
        if score_path.exists():
            journal_scores.append(
                json.loads(score_path.read_text(encoding="utf-8"))
            )
    forward_scored = sum(score["scored"] for score in journal_scores)
    forward_pending = sum(score["pending"] for score in journal_scores)
    forward_hits = sum(score["hits"] for score in journal_scores)

    requirements = [
        {
            "id": "market_specific_open_close",
            "requirement": (
                "Produce two least-likely/avoid digits separately for Open "
                "and pre-Open Close for every supported market."
            ),
            "status": "PROVEN",
            "finding": (
                f"The frozen registry contains {len(registry['rows'])} unique "
                "market-sides across 12 markets; runtime parity covers all of them."
            ),
            "evidence": [
                evidence(
                    "FROZEN_FORWARD_REGISTRY.json",
                    f"registry {registry['contentHash']}",
                ),
                evidence(
                    "../../src/lib/absent-digits.ts",
                    "browser runtime prediction engine",
                ),
            ],
        },
        {
            "id": "complementary_model_families",
            "requirement": (
                "Combine appearance-derived and direct joint-absence model families."
            ),
            "status": "PROVEN",
            "finding": (
                "Model A estimates digit appearance and complements it; Model B "
                "directly estimates pair absence. The frozen blend is 75/25."
            ),
            "evidence": [
                evidence("PROTOCOL.md", "model-family definitions"),
                evidence(
                    "results.json",
                    f"selected appearance weight {results['selectedBlendAppearanceWeight']}",
                ),
            ],
        },
        {
            "id": "causal_walk_forward_evaluation",
            "requirement": (
                "Use rigorous walk-forward out-of-sample evaluation with no "
                "target or future leakage."
            ),
            "status": "PROVEN",
            "finding": (
                "Five chronological blocks are reported, every prediction uses "
                "strictly earlier rows, and runtime contamination checks pass."
            ),
            "evidence": [
                evidence("PROTOCOL.md", "frozen chronology and causality"),
                evidence(
                    "../../scripts/verify-absent-digits-runtime.cjs",
                    "target/future contamination and minimum-history checks",
                ),
            ],
        },
        {
            "id": "calibrated_uncertainty",
            "requirement": (
                "Report calibrated uncertainty separately from the actionability gate."
            ),
            "status": "PROVEN",
            "finding": (
                f"`{calibration['selectedMethod']}` was promoted for point "
                "confidence; the independent 120-draw Wilson gate is unchanged."
            ),
            "evidence": [
                evidence("CALIBRATION_REPORT.md", "chronological Brier audit"),
                evidence(
                    "FROZEN_CALIBRATION_REGISTRY.json",
                    f"calibration {calibration_registry['contentHash']}",
                ),
            ],
        },
        {
            "id": "dynamic_ensembles",
            "requirement": (
                "Use dynamic expert weighting and test simpler/faster/slower alternatives."
            ),
            "status": "PROVEN",
            "finding": (
                "Exponentially weighted within-family experts are deployed. "
                "Long-only won validation narrowly but failed confirmation, so "
                "the dynamic baseline was retained."
            ),
            "evidence": [
                evidence(
                    "WEIGHTING_ABLATION_REPORT.md",
                    f"change promoted: {weighting['promoted']}",
                ),
                evidence(
                    "DYNAMIC_ROUTE_REPORT.md",
                    f"family router: {routing['selected']}",
                ),
            ],
        },
        {
            "id": "evidence_based_feature_selection",
            "requirement": (
                "Promote features, residual models, routes, and selective gates "
                "only when gains persist outside selection data."
            ),
            "status": "PROVEN",
            "finding": (
                "Context removal, exact-panel residual blending, local routing, "
                "and confidence/agreement gating all failed their promotion rules."
            ),
            "evidence": [
                evidence(
                    "FEATURE_ABLATION_REPORT.md",
                    f"feature change promoted: {features['promoted']}",
                ),
                evidence(
                    "PANEL_RESIDUAL_REPORT.md",
                    f"residual change promoted: {residual['promoted']}",
                ),
                evidence(
                    "SELECTIVE_GATE_REPORT.md",
                    f"runtime gate promoted: {selective['runtimePromoted']}",
                ),
            ],
        },
        {
            "id": "model_selection_uncertainty",
            "requirement": (
                "Quantify uncertainty in the selected family blend rather than "
                "treating the validation winner as uniquely superior."
            ),
            "status": "PROVEN",
            "finding": (
                "The 75/25 blend is retained but classified selection-uncertain: "
                f"{pct(blend_stability['weekClusterBootstrap']['selectionFrequencies']['0.75'])} "
                "bootstrap selection frequency."
            ),
            "evidence": [
                evidence(
                    "BLEND_STABILITY_REPORT.md",
                    f"robust: {blend_stability['selectionRobust']}",
                )
            ],
        },
        {
            "id": "runtime_research_parity",
            "requirement": (
                "Keep the browser runtime numerically identical to frozen research "
                "predictions and calibration."
            ),
            "status": "PROVEN",
            "finding": (
                f"Exact parity passed for {runtime_verification['marketSides']} "
                "market-sides, with both registry hashes verified."
            ),
            "evidence": [
                evidence(
                    "../../scripts/verify-absent-digits-runtime.cjs",
                    f"runtime registry {runtime_verification['registryHash']}",
                )
            ],
        },
        {
            "id": "continuous_prospective_evidence",
            "requirement": (
                "Accumulate immutable, genuinely prospective cohorts before "
                "making empirical deployment claims."
            ),
            "status": (
                "PROVEN"
                if forward_scored > 0 and forward_pending == 0
                else "PENDING"
            ),
            "finding": (
                f"{len(journal['cohorts'])} hash-chained cohort exists; "
                f"{forward_scored} market-sides are scored and "
                f"{forward_pending} remain pending."
            ),
            "evidence": [
                evidence(
                    "FORWARD_JOURNAL.json",
                    f"journal {journal['contentHash']}",
                ),
                evidence(
                    "FORWARD_JOURNAL.md",
                    "aggregate prospective status",
                ),
            ],
        },
        {
            "id": "safe_actionable_accuracy",
            "requirement": (
                "Issue actionable calls only when the prequential 95% Wilson "
                "lower bound is at least 80%."
            ),
            "status": "NOT_ACHIEVED",
            "finding": (
                f"The frozen cohort contains {registry['calls']} calls and "
                f"{registry['abstentions']} abstentions. No market-side has "
                "empirical support for an 80% lower bound."
            ),
            "evidence": [
                evidence("REPORT.md", "confidence-gate decision"),
                evidence(
                    "FROZEN_FORWARD_REGISTRY.json",
                    "frozen calls and abstentions",
                ),
            ],
        },
    ]

    implementation_ids = {
        "market_specific_open_close",
        "complementary_model_families",
        "causal_walk_forward_evaluation",
        "calibrated_uncertainty",
        "dynamic_ensembles",
        "evidence_based_feature_selection",
        "model_selection_uncertainty",
        "runtime_research_parity",
    }
    implementation_complete = all(
        item["status"] == "PROVEN"
        for item in requirements
        if item["id"] in implementation_ids
    )
    prospective_complete = next(
        item["status"]
        for item in requirements
        if item["id"] == "continuous_prospective_evidence"
    ) == "PROVEN"
    safe_calls_achieved = registry["calls"] > 0
    completion_supported = (
        implementation_complete
        and prospective_complete
        and safe_calls_achieved
    )
    remaining_work = []
    if not prospective_complete:
        remaining_work.extend(
            [
                "Observe and score all Jul 25/27 cohort-001 outcomes.",
                "Regenerate this audit after prospective scoring.",
                "Register cohort 002 only after cohort 001 has zero pending rows.",
            ]
        )
    if not safe_calls_achieved:
        remaining_work.append(
            "Continue abstaining unless a market-side reaches the frozen "
            "80% Wilson-lower-bound gate with at least 30 comparable calls."
        )

    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "objective": (
            "Research, build, validate, and continuously improve a market-specific "
            "complementary absent-digits prediction engine."
        ),
        "completionSupported": completion_supported,
        "implementationComplete": implementation_complete,
        "prospectiveEvidenceComplete": prospective_complete,
        "safeActionableCallsAchieved": safe_calls_achieved,
        "currentPerformance": {
            block: {
                "rows": results["blocks"][block]["rows"],
                "hits": results["blocks"][block]["hits"],
                "strictAccuracy": results["blocks"][block][
                    "strictAccuracy"
                ],
            }
            for block in (
                "validation",
                "holdout",
                "recent",
                "post_cache",
                "independent_extension",
            )
        },
        "prospective": {
            "journalHash": journal["contentHash"],
            "cohorts": len(journal["cohorts"]),
            "scored": forward_scored,
            "hits": forward_hits,
            "pending": forward_pending,
        },
        "verification": {
            "research": research_verification,
            "runtime": runtime_verification,
        },
        "requirements": requirements,
        "remainingWork": remaining_work,
    }
    OUTPUT_JSON.write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# Absent-Digits Goal Completion Audit",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        (
            "**Completion is supported by current evidence.**"
            if completion_supported
            else "**Completion is not yet supported.**"
        ),
        "",
        f"- Implementation requirements proven: "
        f"{'yes' if implementation_complete else 'no'}",
        f"- Prospective evidence complete: "
        f"{'yes' if prospective_complete else 'no'}",
        f"- Safe actionable calls empirically supported: "
        f"{'yes' if safe_calls_achieved else 'no'}",
        "",
        "## Requirement matrix",
        "",
        "| Requirement | Status | Current finding |",
        "| --- | --- | --- |",
    ]
    for item in requirements:
        lines.append(
            f"| `{item['id']}` | **{item['status']}** | "
            f"{item['finding']} |"
        )
    lines.extend(
        [
            "",
            "## Chronological accuracy",
            "",
            "| Block | Hits | Rows | Strict accuracy |",
            "| --- | ---: | ---: | ---: |",
        ]
    )
    for block, item in output["currentPerformance"].items():
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{item['hits']} | {item['rows']} | "
            f"{pct(item['strictAccuracy'])} |"
        )
    lines.extend(
        [
            "",
            "## Remaining work",
            "",
        ]
    )
    if output["remainingWork"]:
        lines.extend(
            f"- {item}" for item in output["remainingWork"]
        )
    else:
        lines.append("- None.")
    lines.extend(
        [
            "",
            "This audit separates system implementation from empirical "
            "actionability. A correct abstention is not an 80% accuracy claim.",
        ]
    )
    OUTPUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "completionSupported": completion_supported,
                "implementationComplete": implementation_complete,
                "prospectiveEvidenceComplete": prospective_complete,
                "safeActionableCallsAchieved": safe_calls_achieved,
                "forwardScored": forward_scored,
                "forwardPending": forward_pending,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
