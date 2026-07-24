from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import run_research as research


HERE = Path(__file__).resolve().parent
GLOBAL_BLEND = 0.75
GLOBAL_KEY = str(GLOBAL_BLEND)
BASELINE = "global_075"
BLOCKS = (
    "validation",
    "holdout",
    "recent",
    "post_cache",
    "independent_extension",
)
STRATEGIES = (
    {
        "name": BASELINE,
        "kind": "global",
        "window": None,
        "strength": None,
        "margin": None,
    },
    {
        "name": "local_w60_s20",
        "kind": "local",
        "window": 60,
        "strength": 20,
        "margin": 0.0,
    },
    {
        "name": "local_w120_s40",
        "kind": "local",
        "window": 120,
        "strength": 40,
        "margin": 0.0,
    },
    {
        "name": "local_w240_s80",
        "kind": "local",
        "window": 240,
        "strength": 80,
        "margin": 0.0,
    },
    {
        "name": "local_w120_s40_margin02",
        "kind": "local",
        "window": 120,
        "strength": 40,
        "margin": 0.02,
    },
    {
        "name": "local_w240_s80_margin01",
        "kind": "local",
        "window": 240,
        "strength": 80,
        "margin": 0.01,
    },
    {
        "name": "local_w240_s120_margin02",
        "kind": "local",
        "window": 240,
        "strength": 120,
        "margin": 0.02,
    },
)


def choose_blend(
    history: list[dict[str, Any]], strategy: dict[str, Any]
) -> float:
    if strategy["kind"] == "global" or len(history) < 30:
        return GLOBAL_BLEND
    selected = history[-int(strategy["window"]):]
    strength = float(strategy["strength"])
    scores = {}
    for blend in research.BLENDS:
        key = str(blend)
        hits = sum(bool(row["blendHits"][key]) for row in selected)
        scores[blend] = (
            hits + research.RANDOM_PAIR_BASE * strength
        ) / (len(selected) + strength)
    best = max(
        research.BLENDS,
        key=lambda blend: (
            scores[blend],
            -abs(blend - GLOBAL_BLEND),
        ),
    )
    margin = float(strategy["margin"])
    if scores[best] - scores[GLOBAL_BLEND] < margin:
        return GLOBAL_BLEND
    return best


def route_series(
    rows: list[dict[str, Any]], strategy: dict[str, Any]
) -> list[dict[str, Any]]:
    history: list[dict[str, Any]] = []
    output = []
    for row in rows:
        chosen = choose_blend(history, strategy)
        chosen_key = str(chosen)
        pair_index = int(row["blendPairs"][chosen_key])
        global_pair_index = int(row["blendPairs"][GLOBAL_KEY])
        output.append(
            {
                "market": row["market"],
                "side": row["side"],
                "date": row["date"],
                "block": row["block"],
                "chosenBlend": chosen,
                "blendChanged": chosen != GLOBAL_BLEND,
                "pairChanged": pair_index != global_pair_index,
                "pairIndex": pair_index,
                "hit": bool(row["blendHits"][chosen_key]),
                "globalHit": bool(row["blendHits"][GLOBAL_KEY]),
                "absentDigits": int(
                    row["blendAbsentDigits"][chosen_key]
                ),
            }
        )
        history.append(row)
    return output


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
    blend_counts = Counter(str(row["chosenBlend"]) for row in rows)
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
        "blendChangeRate": (
            sum(bool(row["blendChanged"]) for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "pairChangeRate": (
            sum(bool(row["pairChanged"]) for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "blendCounts": dict(sorted(blend_counts.items())),
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
        raise RuntimeError("Routing strategies produced misaligned rows")
    candidate_only = 0
    baseline_only = 0
    both = 0
    neither = 0
    for key, candidate in candidate_by_key.items():
        baseline = baseline_by_key[key]
        candidate_hit = bool(candidate["hit"])
        baseline_hit = bool(baseline["hit"])
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
        "exactSignP": research.exact_sign_pvalue(
            candidate_only, baseline_only
        ),
    }


def block_rows(
    rows: list[dict[str, Any]], blocks: set[str]
) -> list[dict[str, Any]]:
    return [row for row in rows if row["block"] in blocks]


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    rows_by_market, _ = research.load_rows()
    raw_by_route: dict[str, list[dict[str, Any]]] = {}
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            raw_by_route[f"{market}|{side}"] = research.run_series(
                market, side, market_rows
            )

    ledgers = {
        strategy["name"]: [
            routed
            for rows in raw_by_route.values()
            for routed in route_series(rows, strategy)
        ]
        for strategy in STRATEGIES
    }
    metrics = {
        name: {
            block: aggregate(block_rows(rows, {block}))
            for block in BLOCKS
        }
        for name, rows in ledgers.items()
    }
    selected = max(
        (strategy["name"] for strategy in STRATEGIES),
        key=lambda name: (
            metrics[name]["validation"]["strictAccuracy"],
            metrics[name]["validation"]["avgCorrectAbsentDigits"],
            name == BASELINE,
        ),
    )
    comparisons = {
        block: paired(
            block_rows(ledgers[selected], {block}),
            block_rows(ledgers[BASELINE], {block}),
        )
        for block in BLOCKS
    }
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
        selected != BASELINE
        and metrics[selected]["validation"]["strictAccuracy"]
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
        validation_improves
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
            "Causal market-side routing among the five frozen family blends. "
            "Every route uses only its own earlier fully observed outcomes."
        ),
        "baseline": BASELINE,
        "selected": selected,
        "promoted": promoted,
        "strategies": list(STRATEGIES),
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
            "selected": later_selected,
            "baseline": later_baseline,
        },
    }
    (HERE / "dynamic_route_results.json").write_text(
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
        "# Dynamic Market-Side Family-Blend Routing Audit",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        f"**{decision}** Each Open/Close route can choose among appearance "
        "weights 0%, 25%, 50%, 75%, and 100% from its own prior hit ledger.",
        "",
        "Promotion requires a validation gain, no Holdout or Recent regression, "
        "a paired confirmation win at p < .05, no combined later-extension "
        "regression, and no market-side worst-case loss beyond two points.",
        "",
        "## Validation selection",
        "",
        "| Strategy | Strict | Avg absent | Macro | Worst | Blend changes | Pair changes |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for strategy in STRATEGIES:
        name = strategy["name"]
        item = metrics[name]["validation"]
        lines.append(
            f"| `{name}` | {pct(item['strictAccuracy'])} "
            f"({item['hits']}/{item['rows']}) | "
            f"{item['avgCorrectAbsentDigits']:.3f}/2 | "
            f"{pct(item['marketMacroAccuracy'])} | "
            f"{pct(item['worstMarketSideAccuracy'])} | "
            f"{pct(item['blendChangeRate'])} | "
            f"{pct(item['pairChangeRate'])} |"
        )
    lines.extend(
        [
            "",
            "## Selected router versus global 75/25",
            "",
            "| Block | Selected | Global | Selected-only | Global-only | Pair changes | Exact sign p |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        selected_item = metrics[selected][block]
        baseline_item = metrics[BASELINE][block]
        comparison = comparisons[block]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(selected_item['strictAccuracy'])} | "
            f"{pct(baseline_item['strictAccuracy'])} | "
            f"{comparison['candidateOnly']} | "
            f"{comparison['baselineOnly']} | "
            f"{pct(selected_item['pairChangeRate'])} | "
            f"{comparison['exactSignP']:.4f} |"
        )
    lines.extend(
        [
            "",
            "## Selected blend distribution",
            "",
            "| Block | 0% A | 25% A | 50% A | 75% A | 100% A |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        counts = metrics[selected][block]["blendCounts"]
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            + " | ".join(
                str(counts.get(str(blend), 0))
                for blend in research.BLENDS
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- Full-feedback routing can score every blend after each observed "
            "panel without using the target outcome early.",
            "- Shrinkage stabilizes local hit rates; margin variants fall back "
            "to the global 75/25 blend unless the local advantage is large enough.",
            "- A dynamic route is not deployed unless its validation choice "
            "persists across every confirmation gate.",
        ]
    )
    (HERE / "DYNAMIC_ROUTE_REPORT.md").write_text(
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
