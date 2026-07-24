from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import run_research as research


HERE = Path(__file__).resolve().parent
BASELINE = "dynamic_eta35_decay097"
BLEND = 0.75
BLEND_KEY = str(BLEND)
BLOCKS = (
    "validation",
    "holdout",
    "recent",
    "post_cache",
    "independent_extension",
)
CONFIGS = (
    {
        "name": BASELINE,
        "kind": "dynamic",
        "eta": 35.0,
        "decay": 0.97,
    },
    {
        "name": "uniform",
        "kind": "uniform",
        "eta": 0.0,
        "decay": 0.97,
    },
    {
        "name": "long_only",
        "kind": "long_only",
        "eta": 0.0,
        "decay": 0.97,
    },
    {
        "name": "dynamic_slow_eta10_decay099",
        "kind": "dynamic",
        "eta": 10.0,
        "decay": 0.99,
    },
    {
        "name": "dynamic_moderate_eta15_decay095",
        "kind": "dynamic",
        "eta": 15.0,
        "decay": 0.95,
    },
    {
        "name": "dynamic_fast_eta70_decay090",
        "kind": "dynamic",
        "eta": 70.0,
        "decay": 0.90,
    },
)


def uniform_weights(losses: dict[str, float]) -> dict[str, float]:
    weight = 1 / len(losses)
    return {name: weight for name in losses}


def long_only_weights(losses: dict[str, float]) -> dict[str, float]:
    long_name = next(
        (name for name in losses if name.endswith("_long")),
        next(iter(losses)),
    )
    return {name: float(name == long_name) for name in losses}


def compact(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "market": row["market"],
        "side": row["side"],
        "date": row["date"],
        "block": row["block"],
        "hit": bool(row["blendHits"][BLEND_KEY]),
        "absentDigits": int(row["blendAbsentDigits"][BLEND_KEY]),
        "pairIndex": int(row["blendPairs"][BLEND_KEY]),
    }


def run_configuration(
    config: dict[str, Any],
    rows_by_market: dict[str, list[dict[str, Any]]],
    original_normalize: Callable[[dict[str, float]], dict[str, float]],
) -> list[dict[str, Any]]:
    research.EMA_DECAY = float(config["decay"])
    research.WEIGHT_ETA = float(config["eta"])
    if config["kind"] == "uniform":
        research.normalize_weights = uniform_weights
    elif config["kind"] == "long_only":
        research.normalize_weights = long_only_weights
    else:
        research.normalize_weights = original_normalize

    rows = []
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            rows.extend(
                compact(row)
                for row in research.run_series(market, side, market_rows)
            )
    return rows


def accuracy(values: list[bool]) -> float:
    return sum(values) / len(values) if values else 0.0


def aggregate(rows: list[dict[str, Any]]) -> dict[str, Any]:
    hits = [bool(row["hit"]) for row in rows]
    route_hits: dict[str, list[bool]] = defaultdict(list)
    for row in rows:
        route_hits[f"{row['market']}|{row['side']}"].append(bool(row["hit"]))
    route_rates = {
        route: accuracy(values) for route, values in route_hits.items()
    }
    return {
        "rows": len(rows),
        "hits": sum(hits),
        "strictAccuracy": accuracy(hits),
        "avgCorrectAbsentDigits": (
            sum(row["absentDigits"] for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "marketMacroAccuracy": (
            sum(route_rates.values()) / len(route_rates)
            if route_rates
            else 0.0
        ),
        "worstMarketSideAccuracy": (
            min(route_rates.values()) if route_rates else 0.0
        ),
        "marketSides": route_rates,
    }


def keyed(rows: list[dict[str, Any]]) -> dict[tuple[str, str, str], dict[str, Any]]:
    return {
        (row["market"], row["side"], row["date"]): row for row in rows
    }


def paired(
    candidate_rows: list[dict[str, Any]],
    baseline_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    candidate_by_key = keyed(candidate_rows)
    baseline_by_key = keyed(baseline_rows)
    if set(candidate_by_key) != set(baseline_by_key):
        raise RuntimeError("Weighting configurations produced misaligned rows")
    candidate_only = 0
    baseline_only = 0
    both = 0
    neither = 0
    pair_changes = 0
    for key, candidate in candidate_by_key.items():
        baseline = baseline_by_key[key]
        candidate_hit = bool(candidate["hit"])
        baseline_hit = bool(baseline["hit"])
        pair_changes += int(candidate["pairIndex"] != baseline["pairIndex"])
        if candidate_hit and baseline_hit:
            both += 1
        elif candidate_hit:
            candidate_only += 1
        elif baseline_hit:
            baseline_only += 1
        else:
            neither += 1
    return {
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "both": both,
        "neither": neither,
        "pairChanges": pair_changes,
        "pairChangeRate": pair_changes / len(candidate_by_key),
        "exactSignP": research.exact_sign_pvalue(
            candidate_only, baseline_only
        ),
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    rows_by_market, _ = research.load_rows()
    original_normalize = research.normalize_weights
    original_decay = research.EMA_DECAY
    original_eta = research.WEIGHT_ETA
    ledgers: dict[str, list[dict[str, Any]]] = {}
    try:
        for config in CONFIGS:
            print(f"Running {config['name']}...", flush=True)
            ledgers[config["name"]] = run_configuration(
                config, rows_by_market, original_normalize
            )
    finally:
        research.normalize_weights = original_normalize
        research.EMA_DECAY = original_decay
        research.WEIGHT_ETA = original_eta

    metrics = {
        name: {
            block: aggregate(
                [row for row in rows if row["block"] == block]
            )
            for block in BLOCKS
        }
        for name, rows in ledgers.items()
    }
    selected = max(
        (config["name"] for config in CONFIGS),
        key=lambda name: (
            metrics[name]["validation"]["strictAccuracy"],
            metrics[name]["validation"]["avgCorrectAbsentDigits"],
            name == BASELINE,
        ),
    )
    comparisons = {
        block: paired(
            [
                row
                for row in ledgers[selected]
                if row["block"] == block
            ],
            [
                row
                for row in ledgers[BASELINE]
                if row["block"] == block
            ],
        )
        for block in BLOCKS
    }
    confirmation_candidate = [
        row
        for row in ledgers[selected]
        if row["block"] in {"holdout", "recent"}
    ]
    confirmation_baseline = [
        row
        for row in ledgers[BASELINE]
        if row["block"] in {"holdout", "recent"}
    ]
    confirmation_comparison = paired(
        confirmation_candidate, confirmation_baseline
    )
    later_candidate = [
        row
        for row in ledgers[selected]
        if row["block"] in {"post_cache", "independent_extension"}
    ]
    later_baseline = [
        row
        for row in ledgers[BASELINE]
        if row["block"] in {"post_cache", "independent_extension"}
    ]
    later_candidate_metrics = aggregate(later_candidate)
    later_baseline_metrics = aggregate(later_baseline)

    validation_improves = (
        metrics[selected]["validation"]["strictAccuracy"]
        > metrics[BASELINE]["validation"]["strictAccuracy"]
    )
    holdout_recent_non_degrading = all(
        metrics[selected][block]["strictAccuracy"]
        >= metrics[BASELINE][block]["strictAccuracy"]
        for block in ("holdout", "recent")
    )
    paired_confirmation = (
        confirmation_comparison["candidateOnly"]
        > confirmation_comparison["baselineOnly"]
        and confirmation_comparison["exactSignP"] < 0.05
    )
    later_non_degrading = (
        later_candidate_metrics["strictAccuracy"]
        >= later_baseline_metrics["strictAccuracy"]
    )
    worst_route_non_degrading = all(
        metrics[selected][block]["worstMarketSideAccuracy"]
        >= metrics[BASELINE][block]["worstMarketSideAccuracy"] - 0.02
        for block in ("holdout", "recent")
    )
    promoted = (
        selected != BASELINE
        and validation_improves
        and holdout_recent_non_degrading
        and paired_confirmation
        and later_non_degrading
        and worst_route_non_degrading
    )

    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Causal ablation of within-family expert weighting. The 75/25 "
            "appearance/absence family blend is fixed throughout."
        ),
        "baseline": BASELINE,
        "selected": selected,
        "promoted": promoted,
        "configurations": list(CONFIGS),
        "selectionBlock": "validation",
        "promotionCriteria": {
            "validationImproves": validation_improves,
            "holdoutAndRecentNonDegrading": holdout_recent_non_degrading,
            "pairedConfirmationPBelow005": paired_confirmation,
            "laterExtensionsCombinedNonDegrading": later_non_degrading,
            "worstRouteWithinTwoPoints": worst_route_non_degrading,
        },
        "metrics": metrics,
        "selectedVsBaseline": comparisons,
        "confirmationSelectedVsBaseline": confirmation_comparison,
        "laterCombined": {
            "selected": later_candidate_metrics,
            "baseline": later_baseline_metrics,
        },
    }
    (HERE / "weighting_ablation_results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )

    decision = (
        f"Promoted `{selected}`."
        if promoted
        else (
            f"Retained `{BASELINE}`."
            if selected == BASELINE
            else f"Rejected validation winner `{selected}`."
        )
    )
    lines = [
        "# Dynamic Expert-Weighting Ablation",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        f"**{decision}** The family blend is fixed at 75% appearance and "
        "25% direct absence so this audit isolates only within-family weighting.",
        "",
        "Promotion requires a validation gain, no Holdout or Recent regression, "
        "a paired confirmation win at p < .05, no combined later-extension "
        "regression, and no market-side worst-case loss beyond two points.",
        "",
        "## Validation selection",
        "",
        "| Configuration | Strict | Avg absent | Macro | Worst market-side |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for config in CONFIGS:
        name = config["name"]
        item = metrics[name]["validation"]
        lines.append(
            f"| `{name}` | {pct(item['strictAccuracy'])} "
            f"({item['hits']}/{item['rows']}) | "
            f"{item['avgCorrectAbsentDigits']:.3f}/2 | "
            f"{pct(item['marketMacroAccuracy'])} | "
            f"{pct(item['worstMarketSideAccuracy'])} |"
        )
    lines.extend(
        [
            "",
            "## Chronological confirmation",
            "",
            "| Block | Selected | Baseline | Selected-only | Baseline-only | Pair changes | Exact sign p |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        candidate = metrics[selected][block]
        baseline = metrics[BASELINE][block]
        comparison = comparisons[block]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(candidate['strictAccuracy'])} | "
            f"{pct(baseline['strictAccuracy'])} | "
            f"{comparison['candidateOnly']} | "
            f"{comparison['baselineOnly']} | "
            f"{pct(comparison['pairChangeRate'])} | "
            f"{comparison['exactSignP']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- Every target uses only earlier rows; Open and Close remain separate.",
            "- Uniform and long-only are structural ablations. The remaining "
            "candidates vary loss-memory and weight sensitivity.",
            "- A validation winner is descriptive unless every promotion gate "
            "persists later. Failed candidates do not enter the runtime engine.",
        ]
    )
    (HERE / "WEIGHTING_ABLATION_REPORT.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "decision": decision,
                "selected": selected,
                "promoted": promoted,
                "confirmation": confirmation_comparison,
                "criteria": output["promotionCriteria"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
