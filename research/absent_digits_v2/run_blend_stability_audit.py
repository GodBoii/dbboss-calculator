from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from random import Random
from typing import Any

import run_research as research


HERE = Path(__file__).resolve().parent
SELECTED_BLEND = 0.75
ITERATIONS = 6000
BLOCKS = (
    "validation",
    "holdout",
    "recent",
    "post_cache",
    "independent_extension",
)


def compact(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "market": row["market"],
        "side": row["side"],
        "date": row["date"],
        "block": row["block"],
        "hits": {
            str(blend): int(bool(row["blendHits"][str(blend)]))
            for blend in research.BLENDS
        },
        "absentDigits": {
            str(blend): int(row["blendAbsentDigits"][str(blend)])
            for blend in research.BLENDS
        },
    }


def select_blend(rows: list[dict[str, Any]]) -> float:
    if not rows:
        return SELECTED_BLEND
    totals = {
        blend: {
            "hits": sum(row["hits"][str(blend)] for row in rows),
            "absent": sum(
                row["absentDigits"][str(blend)] for row in rows
            ),
        }
        for blend in research.BLENDS
    }
    return max(
        research.BLENDS,
        key=lambda blend: (
            totals[blend]["hits"],
            totals[blend]["absent"],
            -abs(blend - 0.5),
        ),
    )


def grid(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        str(blend): {
            "rows": len(rows),
            "hits": sum(row["hits"][str(blend)] for row in rows),
            "strictAccuracy": (
                sum(row["hits"][str(blend)] for row in rows) / len(rows)
                if rows
                else 0.0
            ),
            "avgCorrectAbsentDigits": (
                sum(
                    row["absentDigits"][str(blend)] for row in rows
                )
                / len(rows)
                if rows
                else 0.0
            ),
        }
        for blend in research.BLENDS
    }


def weekly_clusters(
    rows: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    clusters: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        iso_year, iso_week, _ = datetime.fromisoformat(row["date"]).isocalendar()
        clusters[f"{iso_year}-W{iso_week:02d}"].append(row)
    return clusters


def cluster_bootstrap(
    validation: list[dict[str, Any]],
) -> tuple[dict[str, int], dict[str, Any]]:
    clusters = list(weekly_clusters(validation).values())
    random = Random(20260724)
    selection_counts: Counter[str] = Counter()
    differences: dict[str, list[float]] = {
        str(blend): []
        for blend in research.BLENDS
        if blend != SELECTED_BLEND
    }
    for _ in range(ITERATIONS):
        sampled_clusters = [
            random.choice(clusters) for _ in range(len(clusters))
        ]
        sampled = [
            row for cluster in sampled_clusters for row in cluster
        ]
        selected = select_blend(sampled)
        selection_counts[str(selected)] += 1
        selected_hits = sum(
            row["hits"][str(SELECTED_BLEND)] for row in sampled
        )
        for blend in research.BLENDS:
            if blend == SELECTED_BLEND:
                continue
            other_hits = sum(row["hits"][str(blend)] for row in sampled)
            differences[str(blend)].append(
                (selected_hits - other_hits) / len(sampled)
            )
    comparisons = {}
    for blend, values in differences.items():
        values.sort()
        comparisons[blend] = {
            "meanAccuracyDifference": sum(values) / len(values),
            "clusterBootstrap95": [
                values[int(ITERATIONS * 0.025)],
                values[min(ITERATIONS - 1, int(ITERATIONS * 0.975))],
            ],
            "probabilitySelectedBlendBetter": (
                sum(value > 0 for value in values) / len(values)
            ),
        }
    return dict(selection_counts), comparisons


def leave_one_route_out(
    validation: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    routes = sorted(
        {f"{row['market']}|{row['side']}" for row in validation}
    )
    output = []
    for route in routes:
        remaining = [
            row
            for row in validation
            if f"{row['market']}|{row['side']}" != route
        ]
        output.append(
            {
                "excludedRoute": route,
                "selectedBlend": select_blend(remaining),
                "remainingRows": len(remaining),
            }
        )
    return output


def leave_one_month_out(
    validation: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    months = sorted({row["date"][:7] for row in validation})
    return [
        {
            "excludedMonth": month,
            "selectedBlend": select_blend(
                [row for row in validation if row["date"][:7] != month]
            ),
        }
        for month in months
    ]


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    rows_by_market, _ = research.load_rows()
    ledger = []
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            ledger.extend(
                compact(row)
                for row in research.run_series(market, side, market_rows)
            )
    by_block = {
        block: [row for row in ledger if row["block"] == block]
        for block in BLOCKS
    }
    validation = by_block["validation"]
    validation_grid = grid(validation)
    selected = select_blend(validation)
    selection_counts, bootstrap_comparisons = cluster_bootstrap(
        validation
    )
    route_exclusions = leave_one_route_out(validation)
    month_exclusions = leave_one_month_out(validation)
    block_grids = {block: grid(rows) for block, rows in by_block.items()}
    block_optima = {
        block: select_blend(rows) for block, rows in by_block.items()
    }

    runner_up = max(
        (blend for blend in research.BLENDS if blend != selected),
        key=lambda blend: (
            validation_grid[str(blend)]["hits"],
            validation_grid[str(blend)]["avgCorrectAbsentDigits"],
        ),
    )
    bootstrap_frequency = (
        selection_counts.get(str(selected), 0) / ITERATIONS
    )
    route_stability = sum(
        row["selectedBlend"] == selected for row in route_exclusions
    ) / len(route_exclusions)
    month_stability = sum(
        row["selectedBlend"] == selected for row in month_exclusions
    ) / len(month_exclusions)
    runner_up_interval = bootstrap_comparisons[str(runner_up)][
        "clusterBootstrap95"
    ]
    selection_robust = (
        selected == SELECTED_BLEND
        and bootstrap_frequency >= 0.50
        and route_stability == 1.0
        and month_stability == 1.0
        and runner_up_interval[0] > 0
    )

    generated_at = datetime.now(timezone.utc).isoformat()
    output = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "purpose": (
            "Selection-stability audit for the validation-chosen global "
            "appearance/absence family blend."
        ),
        "iterations": ITERATIONS,
        "selectedBlend": selected,
        "runnerUpBlend": runner_up,
        "selectionRobust": selection_robust,
        "validationGrid": validation_grid,
        "weekClusterBootstrap": {
            "weekClusters": len(weekly_clusters(validation)),
            "selectionCounts": selection_counts,
            "selectionFrequencies": {
                str(blend): selection_counts.get(str(blend), 0) / ITERATIONS
                for blend in research.BLENDS
            },
            "selectedVsOthers": bootstrap_comparisons,
        },
        "leaveOneRouteOut": route_exclusions,
        "leaveOneRouteOutStability": route_stability,
        "leaveOneMonthOut": month_exclusions,
        "leaveOneMonthOutStability": month_stability,
        "descriptiveBlockGrids": block_grids,
        "descriptiveBlockOptima": block_optima,
    }
    (HERE / "blend_stability_results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# Family-Blend Selection Stability Audit",
        "",
        f"Generated: {generated_at}",
        "",
        "## Decision",
        "",
        (
            "**Selection is robust under every preregistered stability check.**"
            if selection_robust
            else "**The 75/25 validation winner is retained, but its selection "
            "uncertainty is material.**"
        ),
        "",
        "Later blocks are descriptive only and never feed back into blend choice.",
        "",
        "## Validation grid",
        "",
        "| Appearance weight | Hits | Strict | Avg absent | Bootstrap selection frequency |",
        "| ---: | ---: | ---: | ---: | ---: |",
    ]
    for blend in research.BLENDS:
        item = validation_grid[str(blend)]
        frequency = (
            selection_counts.get(str(blend), 0) / ITERATIONS
        )
        lines.append(
            f"| {blend * 100:.0f}% | {item['hits']}/{item['rows']} | "
            f"{pct(item['strictAccuracy'])} | "
            f"{item['avgCorrectAbsentDigits']:.3f}/2 | {pct(frequency)} |"
        )
    lines.extend(
        [
            "",
            "## Clustered uncertainty for 75% appearance",
            "",
            "| Comparator | Mean accuracy difference | 95% cluster interval | P(75% is better) |",
            "| ---: | ---: | ---: | ---: |",
        ]
    )
    for blend in research.BLENDS:
        if blend == SELECTED_BLEND:
            continue
        item = bootstrap_comparisons[str(blend)]
        lines.append(
            f"| {blend * 100:.0f}% | "
            f"{item['meanAccuracyDifference'] * 100:+.2f} pp | "
            f"[{item['clusterBootstrap95'][0] * 100:+.2f}, "
            f"{item['clusterBootstrap95'][1] * 100:+.2f}] pp | "
            f"{pct(item['probabilitySelectedBlendBetter'])} |"
        )
    lines.extend(
        [
            "",
            "## Exclusion stability",
            "",
            f"- Leave-one-market-side-out: {pct(route_stability)} retained 75%.",
            f"- Leave-one-calendar-month-out: {pct(month_stability)} retained 75%.",
            "",
            "## Descriptive block optima",
            "",
            "| Block | Best appearance weight | 75% strict | Best strict |",
            "| --- | ---: | ---: | ---: |",
        ]
    )
    for block in BLOCKS:
        optimum = block_optima[block]
        selected_item = block_grids[block][str(SELECTED_BLEND)]
        optimum_item = block_grids[block][str(optimum)]
        lines.append(
            f"| {block.replace('_', ' ').title()} | {optimum * 100:.0f}% | "
            f"{pct(selected_item['strictAccuracy'])} | "
            f"{pct(optimum_item['strictAccuracy'])} |"
        )
    lines.extend(
        [
            "",
            "## Interpretation",
            "",
            "- Week-cluster resampling preserves within-week dependence across markets.",
            "- Route and month exclusions expose whether one pocket determines the winner.",
            "- A non-robust selection remains frozen for honest forward scoring; "
            "later descriptive optima cannot replace it.",
        ]
    )
    (HERE / "BLEND_STABILITY_REPORT.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "selectedBlend": selected,
                "runnerUpBlend": runner_up,
                "selectionRobust": selection_robust,
                "bootstrapSelectionFrequency": bootstrap_frequency,
                "leaveOneRouteOutStability": route_stability,
                "leaveOneMonthOutStability": month_stability,
                "runnerUpClusterInterval": runner_up_interval,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
