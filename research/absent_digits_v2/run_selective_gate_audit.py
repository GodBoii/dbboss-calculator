from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from random import Random
from statistics import NormalDist
from typing import Any

from run_calibration_audit import build_prequential_ledger
from run_research import wilson


HERE = Path(__file__).resolve().parent
CONFIDENCE_METHOD = "local_beta_w240_s80"
BLOCKS = (
    "validation",
    "holdout",
    "recent",
    "post_cache",
    "independent_extension",
)
GATES = (
    {"name": "all", "agreement": False, "threshold": None},
    {"name": "agreement", "agreement": True, "threshold": None},
    {"name": "confidence_ge_050", "agreement": False, "threshold": 0.50},
    {"name": "confidence_ge_052", "agreement": False, "threshold": 0.52},
    {"name": "confidence_ge_054", "agreement": False, "threshold": 0.54},
    {"name": "confidence_ge_056", "agreement": False, "threshold": 0.56},
    {
        "name": "agreement_confidence_ge_050",
        "agreement": True,
        "threshold": 0.50,
    },
    {
        "name": "agreement_confidence_ge_052",
        "agreement": True,
        "threshold": 0.52,
    },
    {
        "name": "agreement_confidence_ge_054",
        "agreement": True,
        "threshold": 0.54,
    },
)


def gate_passes(row: dict[str, Any], gate: dict[str, Any]) -> bool:
    if gate["agreement"] and not row["familyAgreement"]:
        return False
    threshold = gate["threshold"]
    return (
        threshold is None
        or row["probabilities"][CONFIDENCE_METHOD] >= threshold
    )


def filter_gate(
    rows: list[dict[str, Any]], gate: dict[str, Any]
) -> list[dict[str, Any]]:
    return [row for row in rows if gate_passes(row, gate)]


def basic_metrics(
    selected: list[dict[str, Any]], total_rows: int
) -> dict[str, Any]:
    if not selected:
        return {
            "rows": 0,
            "coverage": 0.0,
            "hits": 0,
            "strictAccuracy": 0.0,
            "wilson95": [0.0, 1.0],
            "randomReference": 0.0,
            "excessVsRandom": 0.0,
            "marketMacroAccuracy": 0.0,
            "worstMarketSideAccuracy": 0.0,
        }
    hits = sum(bool(row["hit"]) for row in selected)
    lower, upper = wilson(hits, len(selected))
    route_hits: dict[str, list[bool]] = defaultdict(list)
    for row in selected:
        route_hits[f"{row['market']}|{row['side']}"].append(bool(row["hit"]))
    route_rates = {
        route: sum(values) / len(values)
        for route, values in route_hits.items()
    }
    observed = hits / len(selected)
    random_reference = sum(
        row["randomReference"] for row in selected
    ) / len(selected)
    return {
        "rows": len(selected),
        "coverage": len(selected) / total_rows if total_rows else 0.0,
        "hits": hits,
        "strictAccuracy": observed,
        "wilson95": [lower, upper],
        "randomReference": random_reference,
        "excessVsRandom": observed - random_reference,
        "marketMacroAccuracy": sum(route_rates.values()) / len(route_rates),
        "worstMarketSideAccuracy": min(route_rates.values()),
        "marketSidesRepresented": len(route_rates),
    }


def clustered_random_excess(
    rows: list[dict[str, Any]], iterations: int = 4000
) -> dict[str, Any]:
    weekly: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        iso_year, iso_week, _ = datetime.fromisoformat(row["date"]).isocalendar()
        weekly[f"{iso_year}-W{iso_week:02d}"].append(
            int(bool(row["hit"])) - row["randomReference"]
        )
    if not weekly:
        return {
            "meanExcess": 0.0,
            "clusterBootstrap95": [0.0, 0.0],
            "probabilityPositive": 0.0,
            "weekClusters": 0,
        }
    clusters = list(weekly.values())
    observed = sum(sum(cluster) for cluster in clusters) / sum(
        len(cluster) for cluster in clusters
    )
    random = Random(20260724)
    bootstrap = []
    for _ in range(iterations):
        sampled = [random.choice(clusters) for _ in clusters]
        bootstrap.append(
            sum(sum(cluster) for cluster in sampled)
            / sum(len(cluster) for cluster in sampled)
        )
    bootstrap.sort()
    return {
        "meanExcess": observed,
        "clusterBootstrap95": [
            bootstrap[int(iterations * 0.025)],
            bootstrap[min(iterations - 1, int(iterations * 0.975))],
        ],
        "probabilityPositive": (
            sum(value > 0 for value in bootstrap) / iterations
        ),
        "weekClusters": len(clusters),
    }


def two_proportion_contrast(
    selected: list[dict[str, Any]], excluded: list[dict[str, Any]]
) -> dict[str, Any]:
    if not selected or not excluded:
        return {
            "selectedRows": len(selected),
            "excludedRows": len(excluded),
            "selectedAccuracy": 0.0,
            "excludedAccuracy": 0.0,
            "difference": 0.0,
            "z": 0.0,
            "twoSidedP": 1.0,
        }
    selected_hits = sum(bool(row["hit"]) for row in selected)
    excluded_hits = sum(bool(row["hit"]) for row in excluded)
    selected_rate = selected_hits / len(selected)
    excluded_rate = excluded_hits / len(excluded)
    pooled = (selected_hits + excluded_hits) / (
        len(selected) + len(excluded)
    )
    standard_error = math.sqrt(
        pooled
        * (1 - pooled)
        * (1 / len(selected) + 1 / len(excluded))
    )
    z_value = (
        (selected_rate - excluded_rate) / standard_error
        if standard_error
        else 0.0
    )
    p_value = 2 * (1 - NormalDist().cdf(abs(z_value)))
    return {
        "selectedRows": len(selected),
        "excludedRows": len(excluded),
        "selectedAccuracy": selected_rate,
        "excludedAccuracy": excluded_rate,
        "difference": selected_rate - excluded_rate,
        "z": z_value,
        "twoSidedP": p_value,
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    ledger, selected_blend = build_prequential_ledger()
    by_block = {
        block: [row for row in ledger if row["block"] == block]
        for block in BLOCKS
    }
    validation_grid = {}
    minimum_validation_rows = max(
        200, math.ceil(len(by_block["validation"]) * 0.10)
    )
    for gate in GATES:
        selected_rows = filter_gate(by_block["validation"], gate)
        item = basic_metrics(
            selected_rows, len(by_block["validation"])
        )
        item["eligible"] = len(selected_rows) >= minimum_validation_rows
        validation_grid[gate["name"]] = item

    eligible = [
        gate
        for gate in GATES
        if validation_grid[gate["name"]]["eligible"]
    ]
    selected_gate = max(
        eligible,
        key=lambda gate: (
            validation_grid[gate["name"]]["wilson95"][0],
            validation_grid[gate["name"]]["strictAccuracy"],
            validation_grid[gate["name"]]["coverage"],
            gate["name"] == "all",
        ),
    )
    all_gate = GATES[0]
    selected_metrics = {}
    all_metrics = {}
    for block in BLOCKS:
        rows = by_block[block]
        selected_rows = filter_gate(rows, selected_gate)
        all_rows = filter_gate(rows, all_gate)
        selected_metrics[block] = {
            **basic_metrics(selected_rows, len(rows)),
            "randomExcessInference": clustered_random_excess(selected_rows),
        }
        all_metrics[block] = {
            **basic_metrics(all_rows, len(rows)),
            "randomExcessInference": clustered_random_excess(all_rows),
        }

    confirmation_rows = (
        by_block["holdout"] + by_block["recent"]
    )
    confirmation_selected = filter_gate(
        confirmation_rows, selected_gate
    )
    confirmation_excluded = [
        row
        for row in confirmation_rows
        if not gate_passes(row, selected_gate)
    ]
    confirmation_metrics = basic_metrics(
        confirmation_selected, len(confirmation_rows)
    )
    confirmation_random = clustered_random_excess(
        confirmation_selected
    )
    confirmation_contrast = two_proportion_contrast(
        confirmation_selected, confirmation_excluded
    )
    later_rows = (
        by_block["post_cache"] + by_block["independent_extension"]
    )
    later_selected = filter_gate(later_rows, selected_gate)
    later_metrics = basic_metrics(later_selected, len(later_rows))
    later_all = basic_metrics(later_rows, len(later_rows))

    validation_improves = (
        selected_gate["name"] != "all"
        and validation_grid[selected_gate["name"]]["wilson95"][0]
        > validation_grid["all"]["wilson95"][0]
    )
    later_block_consistency = all(
        selected_metrics[block]["coverage"] >= 0.10
        and selected_metrics[block]["strictAccuracy"]
        >= all_metrics[block]["strictAccuracy"]
        for block in ("holdout", "recent")
    )
    confirmation_separates = (
        confirmation_contrast["difference"] > 0
        and confirmation_contrast["twoSidedP"] < 0.05
    )
    confirmation_beats_random = (
        confirmation_random["clusterBootstrap95"][0] > 0
    )
    later_non_degrading = (
        later_metrics["coverage"] >= 0.10
        and later_metrics["strictAccuracy"]
        >= later_all["strictAccuracy"]
    )
    retrospective_gate_passed = (
        validation_improves
        and later_block_consistency
        and confirmation_separates
        and confirmation_beats_random
        and later_non_degrading
    )
    historical_80_gate = (
        confirmation_metrics["rows"] >= 30
        and confirmation_metrics["wilson95"][0] >= 0.80
    )

    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Validation-selected causal audit of family agreement and "
            "calibrated-confidence selective gates."
        ),
        "selectedBlendAppearanceWeight": selected_blend,
        "confidenceMethod": CONFIDENCE_METHOD,
        "minimumValidationRows": minimum_validation_rows,
        "gateCandidates": list(GATES),
        "selectedGate": selected_gate,
        "validationGrid": validation_grid,
        "selectedGateMetrics": selected_metrics,
        "allRowsMetrics": all_metrics,
        "confirmation": {
            "metrics": confirmation_metrics,
            "randomExcessInference": confirmation_random,
            "selectedVsExcluded": confirmation_contrast,
        },
        "laterCombined": {
            "selected": later_metrics,
            "all": later_all,
        },
        "promotionCriteria": {
            "validationWilsonLowerImproves": validation_improves,
            "holdoutAndRecentAccuracyNonDegradingAtTenPercentCoverage": (
                later_block_consistency
            ),
            "confirmationSelectedBeatsExcludedAtPBelow005": (
                confirmation_separates
            ),
            "confirmationWeekClusteredRandomExcessAboveZero": (
                confirmation_beats_random
            ),
            "laterCombinedNonDegradingAtTenPercentCoverage": (
                later_non_degrading
            ),
        },
        "retrospectiveGatePassed": retrospective_gate_passed,
        "historical80WilsonGatePassed": historical_80_gate,
        "runtimePromoted": False,
    }
    (HERE / "selective_gate_results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )

    decision = (
        f"Retrospective gate `{selected_gate['name']}` passed all confirmation "
        "criteria but remains prospective-only."
        if retrospective_gate_passed
        else f"Rejected validation gate `{selected_gate['name']}`."
    )
    lines = [
        "# Selective Agreement and Confidence Gate Audit",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        f"**{decision}** No retrospective gate can authorize runtime calls; "
        "the frozen 80% Wilson action rule remains controlling.",
        "",
        f"Validation candidates require at least {minimum_validation_rows} rows "
        "(10% coverage, with a 200-row floor) and are ranked by Wilson lower bound.",
        "",
        "## Validation selection",
        "",
        "| Gate | Eligible | Coverage | Hits | Accuracy | Wilson 95% lower | Random reference | Excess |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for gate in GATES:
        item = validation_grid[gate["name"]]
        lines.append(
            f"| `{gate['name']}` | {'yes' if item['eligible'] else 'no'} | "
            f"{pct(item['coverage'])} | {item['hits']}/{item['rows']} | "
            f"{pct(item['strictAccuracy'])} | {pct(item['wilson95'][0])} | "
            f"{pct(item['randomReference'])} | {item['excessVsRandom'] * 100:+.1f} pp |"
        )
    lines.extend(
        [
            "",
            "## Chronological selected-gate performance",
            "",
            "| Block | Coverage | Selected | All rows | Selected Wilson lower | Random excess | Clustered 95% interval |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        selected_item = selected_metrics[block]
        all_item = all_metrics[block]
        inference = selected_item["randomExcessInference"]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(selected_item['coverage'])} | "
            f"{pct(selected_item['strictAccuracy'])} | "
            f"{pct(all_item['strictAccuracy'])} | "
            f"{pct(selected_item['wilson95'][0])} | "
            f"{inference['meanExcess'] * 100:+.1f} pp | "
            f"[{inference['clusterBootstrap95'][0] * 100:+.1f}, "
            f"{inference['clusterBootstrap95'][1] * 100:+.1f}] pp |"
        )
    lines.extend(
        [
            "",
            "## Confirmation contrasts",
            "",
            f"- Selected versus excluded: "
            f"{pct(confirmation_contrast['selectedAccuracy'])} versus "
            f"{pct(confirmation_contrast['excludedAccuracy'])}; "
            f"difference {confirmation_contrast['difference'] * 100:+.1f} pp, "
            f"two-sided z p={confirmation_contrast['twoSidedP']:.4f}.",
            f"- Selected versus panel-kind random reference: "
            f"{confirmation_random['meanExcess'] * 100:+.1f} pp; "
            f"week-clustered 95% interval "
            f"[{confirmation_random['clusterBootstrap95'][0] * 100:+.1f}, "
            f"{confirmation_random['clusterBootstrap95'][1] * 100:+.1f}] pp.",
            f"- Confirmation Wilson lower bound: "
            f"{pct(confirmation_metrics['wilson95'][0])}; "
            f"80% gate passed: {'yes' if historical_80_gate else 'no'}.",
            "",
            "## Interpretation",
            "",
            "- Model-family agreement is not independent evidence because both "
            "families learn from the same outcomes.",
            "- Confidence thresholds use only earlier market-side hits and the "
            "promoted 240-draw beta calibration.",
            "- Coverage, selected-versus-excluded separation, random-reference "
            "excess, and later stability must all agree before a gate advances.",
        ]
    )
    (HERE / "SELECTIVE_GATE_REPORT.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "decision": decision,
                "selectedGate": selected_gate["name"],
                "retrospectiveGatePassed": retrospective_gate_passed,
                "historical80WilsonGatePassed": historical_80_gate,
                "confirmation": output["confirmation"],
                "criteria": output["promotionCriteria"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
