from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import run_research as research
from run_weighting_ablation import (
    aggregate,
    compact,
    paired,
    pct,
)


HERE = Path(__file__).resolve().parent
BASELINE = "all_features"
BLOCKS = (
    "validation",
    "holdout",
    "recent",
    "post_cache",
    "independent_extension",
)
CONFIGS = (
    {"name": BASELINE, "excluded": ()},
    {"name": "without_weekday", "excluded": ("*_weekday",)},
    {
        "name": "without_state",
        "excluded": ("appearance_prev_kind", "absence_transition"),
    },
    {"name": "without_30", "excluded": ("*_30",)},
    {"name": "without_90", "excluded": ("*_90",)},
    {
        "name": "long_short_only",
        "excluded": (
            "*_weekday",
            "appearance_prev_kind",
            "absence_transition",
        ),
    },
)


def is_excluded(name: str, patterns: tuple[str, ...]) -> bool:
    return any(
        name == pattern
        or (pattern.startswith("*") and name.endswith(pattern[1:]))
        for pattern in patterns
    )


def masked_normalizer(
    original: Callable[[dict[str, float]], dict[str, float]],
    patterns: tuple[str, ...],
) -> Callable[[dict[str, float]], dict[str, float]]:
    def normalize(losses: dict[str, float]) -> dict[str, float]:
        dynamic = original(losses)
        retained = {
            name: weight
            for name, weight in dynamic.items()
            if not is_excluded(name, patterns)
        }
        total = sum(retained.values())
        if total <= 0:
            raise RuntimeError(f"Feature mask removed every expert: {patterns}")
        return {
            name: retained.get(name, 0.0) / total
            for name in dynamic
        }

    return normalize


def run_configuration(
    config: dict[str, Any],
    rows_by_market: dict[str, list[dict[str, Any]]],
    original_normalize: Callable[[dict[str, float]], dict[str, float]],
) -> list[dict[str, Any]]:
    research.EMA_DECAY = 0.97
    research.WEIGHT_ETA = 35.0
    research.normalize_weights = masked_normalizer(
        original_normalize, tuple(config["excluded"])
    )
    rows = []
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            rows.extend(
                compact(row)
                for row in research.run_series(market, side, market_rows)
            )
    return rows


def block_rows(
    rows: list[dict[str, Any]], blocks: set[str]
) -> list[dict[str, Any]]:
    return [row for row in rows if row["block"] in blocks]


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
        name: {
            block: paired(
                block_rows(ledgers[name], {block}),
                block_rows(ledgers[BASELINE], {block}),
            )
            for block in BLOCKS
        }
        for name in ledgers
        if name != BASELINE
    }
    selected_comparisons = (
        comparisons[selected]
        if selected != BASELINE
        else {
            block: {
                "candidateOnly": 0,
                "baselineOnly": 0,
                "both": metrics[BASELINE][block]["hits"],
                "neither": (
                    metrics[BASELINE][block]["rows"]
                    - metrics[BASELINE][block]["hits"]
                ),
                "pairChanges": 0,
                "pairChangeRate": 0.0,
                "exactSignP": 1.0,
            }
            for block in BLOCKS
        }
    )
    confirmation_comparison = paired(
        block_rows(ledgers[selected], {"holdout", "recent"}),
        block_rows(ledgers[BASELINE], {"holdout", "recent"}),
    )
    later_selected = aggregate(
        block_rows(
            ledgers[selected], {"post_cache", "independent_extension"}
        )
    )
    later_baseline = aggregate(
        block_rows(
            ledgers[BASELINE], {"post_cache", "independent_extension"}
        )
    )

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
        later_selected["strictAccuracy"]
        >= later_baseline["strictAccuracy"]
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
            "Groupwise causal feature ablation with the family blend and "
            "dynamic weighting hyperparameters held fixed."
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
        "allAblationsVsBaseline": comparisons,
        "selectedVsBaseline": selected_comparisons,
        "confirmationSelectedVsBaseline": confirmation_comparison,
        "laterCombined": {
            "selected": later_selected,
            "baseline": later_baseline,
        },
    }
    (HERE / "feature_ablation_results.json").write_text(
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
        "# Context Feature Ablation",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        f"**{decision}** The 75/25 family blend, EMA decay `0.97`, and "
        "weight sensitivity `35` are fixed so this audit isolates feature groups.",
        "",
        "Promotion requires a validation gain, no Holdout or Recent regression, "
        "a paired confirmation win at p < .05, no combined later-extension "
        "regression, and no market-side worst-case loss beyond two points.",
        "",
        "## Validation selection",
        "",
        "| Configuration | Removed | Strict | Avg absent | Macro | Worst market-side |",
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for config in CONFIGS:
        name = config["name"]
        item = metrics[name]["validation"]
        removed = ", ".join(config["excluded"]) or "nothing"
        lines.append(
            f"| `{name}` | `{removed}` | {pct(item['strictAccuracy'])} "
            f"({item['hits']}/{item['rows']}) | "
            f"{item['avgCorrectAbsentDigits']:.3f}/2 | "
            f"{pct(item['marketMacroAccuracy'])} | "
            f"{pct(item['worstMarketSideAccuracy'])} |"
        )
    lines.extend(
        [
            "",
            "## Selected configuration versus full baseline",
            "",
            "| Block | Selected | Full baseline | Selected-only | Baseline-only | Pair changes | Exact sign p |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        selected_metrics = metrics[selected][block]
        baseline_metrics = metrics[BASELINE][block]
        comparison = selected_comparisons[block]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(selected_metrics['strictAccuracy'])} | "
            f"{pct(baseline_metrics['strictAccuracy'])} | "
            f"{comparison['candidateOnly']} | "
            f"{comparison['baselineOnly']} | "
            f"{pct(comparison['pairChangeRate'])} | "
            f"{comparison['exactSignP']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## All removal effects",
            "",
            "| Ablation | Validation delta | Holdout delta | Recent delta | Post-cache delta | Independent delta |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for config in CONFIGS:
        name = config["name"]
        if name == BASELINE:
            continue
        deltas = [
            metrics[name][block]["strictAccuracy"]
            - metrics[BASELINE][block]["strictAccuracy"]
            for block in BLOCKS
        ]
        lines.append(
            f"| `{name}` | "
            + " | ".join(f"{delta * 100:+.1f} pp" for delta in deltas)
            + " |"
        )
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- Each removal is applied before dynamic weights are renormalized.",
            "- Outcomes on the target row never enter its feature estimates or weights.",
            "- A feature is removed from runtime only when the reduced model passes "
            "every later-block promotion gate.",
        ]
    )
    (HERE / "FEATURE_ABLATION_REPORT.md").write_text(
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
