"""Nested chronological ridge research for strict absent-digit pairs."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from research.absent_digits_v2 import run_research as base


HERE = Path(__file__).resolve().parent
PROTOCOL = HERE / "PROTOCOL.md"
RESULTS = HERE / "results.json"
REPORT = HERE / "REPORT.md"

INNER_TRAIN_END = "2025-03-31"
DEVELOPMENT_END = "2025-07-13"
WINDOWS = (2, 3, 5, 7, 10, 15, 30, 60, 90, 180, 365, 730)
LAGS = (1, 2, 3, 5, 7, 10, 15, 30, 60, 90)
RIDGES = (0.1, 1.0, 10.0, 100.0)
BLENDS = (0.25, 0.5, 0.75, 1.0)
SCOPES = ("pooled", "market_side", "hierarchical")
OPPOSITE = np.array([5, 6, 7, 8, 9, 0, 1, 2, 3, 4], dtype=np.int64)
FEATURE_NAMES = [
    "v2_probability",
    "long_rate",
    *[f"rate_{window}" for window in WINDOWS],
    "momentum_5_30",
    "momentum_15_90",
    "momentum_30_180",
    *[f"present_lag_{lag}" for lag in LAGS],
    *[f"opposite_present_lag_{lag}" for lag in (1, 2, 3, 5, 7)],
    "appearance_gap",
    "appearance_streak",
    "weekday_rate",
    "month_rate",
    "previous_present",
    "previous_opposite_present",
    "equals_previous_sutta",
    "previous_sutta_distance",
    "previous_panel_unique",
    *[f"position_{position}_long" for position in range(3)],
    *[f"position_{position}_90" for position in range(3)],
]


@dataclass
class Event:
    market: str
    side: str
    route: str
    iso: str
    block: str
    mask: int
    baseline_pair: int
    baseline_hit: bool
    baseline_probability: np.ndarray
    x: np.ndarray
    y: np.ndarray


@dataclass(frozen=True)
class Config:
    scope: str
    ridge: float
    blend: float

    @property
    def name(self) -> str:
        ridge = str(self.ridge).replace(".", "p")
        blend = str(self.blend).replace(".", "p")
        return f"{self.scope}_ridge{ridge}_blend{blend}"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def panel_digits(panel: str) -> list[int]:
    return [int(value) for value in str(panel)]


def sutta(panel: str) -> int:
    return sum(panel_digits(panel)) % 10


def feature_events(
    market: str,
    side: str,
    rows: list[dict[str, Any]],
    baseline_rows: list[dict[str, Any]],
) -> list[Event]:
    count = len(rows)
    masks = np.array(
        [base.mask_for(base.panel_for(row, side)) for row in rows],
        dtype=np.int64,
    )
    digit = np.zeros((count, 10), dtype=np.float64)
    positions = np.zeros((count, 3, 10), dtype=np.float64)
    for index, row in enumerate(rows):
        panel = base.panel_for(row, side)
        for value in range(10):
            digit[index, value] = float(bool(masks[index] & (1 << value)))
        for position, value in enumerate(panel_digits(panel)):
            positions[index, position, value] = 1.0

    prefix = np.vstack([np.zeros(10), np.cumsum(digit, axis=0)])
    position_prefix = np.concatenate(
        [np.zeros((1, 3, 10)), np.cumsum(positions, axis=0)],
        axis=0,
    )
    weekdays = [str(row.get("day", "")) for row in rows]
    months = [int(str(row["isoDate"])[5:7]) for row in rows]
    baseline_by_date = {row["date"]: row for row in baseline_rows}
    events: list[Event] = []

    for index in range(base.MIN_HISTORY, count):
        baseline = baseline_by_date[rows[index]["isoDate"]]
        long_start = max(0, index - 730)
        long_n = index - long_start
        long_rate = (prefix[index] - prefix[long_start] + 0.27 * 30) / (
            long_n + 30
        )
        rates: dict[int, np.ndarray] = {}
        for window in WINDOWS:
            start = max(0, index - window)
            total = index - start
            rates[window] = (
                prefix[index] - prefix[start] + long_rate * 12
            ) / (total + 12)

        weekday_indices = [
            candidate
            for candidate in range(long_start, index)
            if weekdays[candidate] == weekdays[index]
        ]
        month_indices = [
            candidate
            for candidate in range(long_start, index)
            if months[candidate] == months[index]
        ]
        weekday_rate = base.digit_rates(
            masks.tolist(), weekday_indices, long_rate.tolist(), 18
        )
        month_rate = base.digit_rates(
            masks.tolist(), month_indices, long_rate.tolist(), 24
        )
        weekday_rate = np.asarray(weekday_rate, dtype=np.float64)
        month_rate = np.asarray(month_rate, dtype=np.float64)

        gaps = np.zeros(10)
        streaks = np.zeros(10)
        for value in range(10):
            gap = min(180, index)
            for distance in range(1, min(180, index) + 1):
                if digit[index - distance, value]:
                    gap = distance - 1
                    break
            gaps[value] = math.log1p(gap) / math.log(181)
            streak = 0
            for distance in range(1, min(15, index) + 1):
                if digit[index - distance, value]:
                    streak += 1
                else:
                    break
            streaks[value] = streak / 15

        previous_panel = base.panel_for(rows[index - 1], side)
        previous_sutta = sutta(previous_panel)
        previous_unique = int(masks[index - 1]).bit_count()
        position_long = (
            position_prefix[index] - position_prefix[long_start] + 0.1 * 20
        ) / (long_n + 20)
        position_90_start = max(0, index - 90)
        position_90 = (
            position_prefix[index]
            - position_prefix[position_90_start]
            + position_long * 12
        ) / (index - position_90_start + 12)

        feature_rows: list[list[float]] = []
        for value in range(10):
            lag_values = [
                digit[index - lag, value] if index >= lag else 0.0
                for lag in LAGS
            ]
            opposite_lags = [
                digit[index - lag, OPPOSITE[value]] if index >= lag else 0.0
                for lag in (1, 2, 3, 5, 7)
            ]
            feature_rows.append(
                [
                    float(baseline["digitProbability"][value]),
                    float(long_rate[value]),
                    *[float(rates[window][value]) for window in WINDOWS],
                    float(rates[5][value] - rates[30][value]),
                    float(rates[15][value] - rates[90][value]),
                    float(rates[30][value] - rates[180][value]),
                    *lag_values,
                    *opposite_lags,
                    float(gaps[value]),
                    float(streaks[value]),
                    float(weekday_rate[value]),
                    float(month_rate[value]),
                    float(digit[index - 1, value]),
                    float(digit[index - 1, OPPOSITE[value]]),
                    float(value == previous_sutta),
                    float((value - previous_sutta) % 10) / 9,
                    float(previous_unique) / 3,
                    *[float(position_long[position, value]) for position in range(3)],
                    *[float(position_90[position, value]) for position in range(3)],
                ]
            )

        y = digit[index].copy()
        pair = int(baseline["blendPairs"]["0.75"])
        events.append(
            Event(
                market=market,
                side=side,
                route=f"{market}|{side}",
                iso=rows[index]["isoDate"],
                block=base.block_for(rows[index]["isoDate"]),
                mask=int(masks[index]),
                baseline_pair=pair,
                baseline_hit=base.pair_hit(pair, int(masks[index])),
                baseline_probability=np.asarray(
                    baseline["digitProbability"], dtype=np.float64
                ),
                x=np.asarray(feature_rows, dtype=np.float64),
                y=y,
            )
        )
    return events


def design(
    events: list[Event],
    market_side: bool,
) -> tuple[np.ndarray, np.ndarray]:
    x = np.vstack([event.x for event in events])
    digit_one_hot = np.tile(np.eye(10), (len(events), 1))
    parts = [x, digit_one_hot]
    if market_side:
        routes = {route: index for index, route in enumerate(
            sorted({event.route for event in events})
        )}
        route_rows = np.zeros((len(events) * 10, len(routes)))
        for event_index, event in enumerate(events):
            route_rows[event_index * 10:(event_index + 1) * 10, routes[event.route]] = 1
        parts.append(route_rows)
    return np.hstack(parts), np.concatenate([event.y for event in events])


@dataclass
class RidgeModel:
    mean: np.ndarray
    scale: np.ndarray
    coefficients: np.ndarray

    def predict(self, x: np.ndarray) -> np.ndarray:
        design_x = np.hstack([np.ones((len(x), 1)), (x - self.mean) / self.scale])
        return np.clip(design_x @ self.coefficients, 0.01, 0.99)


def fit_ridge(x: np.ndarray, y: np.ndarray, ridge: float) -> RidgeModel:
    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    scale[scale < 1e-8] = 1.0
    z = (x - mean) / scale
    z = np.hstack([np.ones((len(z), 1)), z])
    penalty = np.eye(z.shape[1]) * ridge
    penalty[0, 0] = 0
    coefficients = np.linalg.solve(z.T @ z + penalty, z.T @ y)
    return RidgeModel(mean, scale, coefficients)


def event_design(
    event: Event,
    route_names: list[str] | None,
) -> np.ndarray:
    x = np.hstack([event.x, np.eye(10)])
    if route_names is not None:
        route = np.zeros((10, len(route_names)))
        route[:, route_names.index(event.route)] = 1
        x = np.hstack([x, route])
    return x


def fit_predictions(
    train: list[Event],
    score: list[Event],
    ridge: float,
) -> tuple[dict[str, dict[int, np.ndarray]], dict[str, Any]]:
    route_names = sorted({event.route for event in train})
    pooled_x, pooled_y = design(train, market_side=True)
    pooled = fit_ridge(pooled_x, pooled_y, ridge)
    pooled_predictions = {
        id(event): pooled.predict(event_design(event, route_names))
        for event in score
    }
    local_predictions: dict[int, np.ndarray] = {}
    local_importance: dict[str, list[dict[str, Any]]] = {}
    local_names = [*FEATURE_NAMES, *[f"digit_{value}" for value in range(10)]]
    for route in route_names:
        route_train = [event for event in train if event.route == route]
        route_score = [event for event in score if event.route == route]
        x, y = design(route_train, market_side=False)
        model = fit_ridge(x, y, ridge)
        local_importance[route] = sorted(
            [
                {"feature": name, "importance": abs(float(coefficient))}
                for name, coefficient in zip(local_names, model.coefficients[1:])
            ],
            key=lambda item: (item["importance"], item["feature"]),
            reverse=True,
        )[:15]
        for event in route_score:
            local_predictions[id(event)] = model.predict(event_design(event, None))
    predictions = {
        "pooled": pooled_predictions,
        "market_side": local_predictions,
        "hierarchical": {
            id(event): (
                pooled_predictions[id(event)] + local_predictions[id(event)]
            ) / 2
            for event in score
        },
    }
    pooled_names = [
        *FEATURE_NAMES,
        *[f"digit_{value}" for value in range(10)],
        *[f"route_{route}" for route in route_names],
    ]
    diagnostics = {
        "pooledTopFeatures": sorted(
            [
                {"feature": name, "importance": abs(float(coefficient))}
                for name, coefficient in zip(
                    pooled_names, pooled.coefficients[1:]
                )
            ],
            key=lambda item: (item["importance"], item["feature"]),
            reverse=True,
        )[:25],
        "marketSideTopFeatures": local_importance,
    }
    return predictions, diagnostics


def selected_pair(probability: np.ndarray) -> int:
    return min(
        range(len(base.PAIRS)),
        key=lambda index: (
            probability[base.PAIRS[index][0]]
            + probability[base.PAIRS[index][1]],
            index,
        ),
    )


def config_predictions(
    events: list[Event],
    ml: dict[int, np.ndarray],
    blend: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    hits = np.zeros(len(events), dtype=bool)
    pairs = np.zeros(len(events), dtype=np.int16)
    brier = np.zeros(len(events), dtype=np.float64)
    for index, event in enumerate(events):
        probability = (
            (1 - blend) * event.baseline_probability
            + blend * ml[id(event)]
        )
        pair = selected_pair(probability)
        pairs[index] = pair
        hits[index] = base.pair_hit(pair, event.mask)
        brier[index] = float(np.mean((probability - event.y) ** 2))
    return hits, pairs, brier


def summarize(
    events: list[Event],
    hits: np.ndarray,
    brier: np.ndarray,
    baseline_hits: np.ndarray,
) -> dict[str, Any]:
    n = len(events)
    candidate_only = int((hits & ~baseline_hits).sum())
    baseline_only = int((~hits & baseline_hits).sum())
    return {
        "n": n,
        "hits": int(hits.sum()),
        "accuracy": float(hits.mean()) if n else 0.0,
        "baselineHits": int(baseline_hits.sum()),
        "baselineAccuracy": float(baseline_hits.mean()) if n else 0.0,
        "liftPoints": (
            float((hits.mean() - baseline_hits.mean()) * 100) if n else 0.0
        ),
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "pairedPValue": base.exact_sign_pvalue(candidate_only, baseline_only),
        "digitBrier": float(brier.mean()) if n else 0.0,
        "baselineDigitBrier": (
            float(np.mean([
                np.mean((event.baseline_probability - event.y) ** 2)
                for event in events
            ]))
            if n else 0.0
        ),
    }


def block_metrics(
    events: list[Event],
    hits: np.ndarray,
    brier: np.ndarray,
) -> dict[str, Any]:
    baseline_hits = np.array([event.baseline_hit for event in events], dtype=bool)
    result: dict[str, Any] = {}
    for block in ("validation", "holdout", "recent", "post_cache", "independent_extension"):
        indices = np.array(
            [index for index, event in enumerate(events) if event.block == block]
        )
        result[block] = summarize(
            [events[index] for index in indices],
            hits[indices],
            brier[indices],
            baseline_hits[indices],
        )
    return result


def route_metrics(
    events: list[Event],
    hits: np.ndarray,
    brier: np.ndarray,
) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for route in sorted({event.route for event in events}):
        indices = np.array([
            index for index, event in enumerate(events) if event.route == route
        ])
        route_events = [events[index] for index in indices]
        baseline_hits = np.array(
            [event.baseline_hit for event in route_events], dtype=bool
        )
        output[route] = summarize(
            route_events, hits[indices], brier[indices], baseline_hits
        )
    return output


def route_gate(
    selection: list[Event],
    candidate_hits: np.ndarray,
) -> set[str]:
    selected: set[str] = set()
    for route in sorted({event.route for event in selection}):
        indices = [
            index for index, event in enumerate(selection) if event.route == route
        ]
        if len(indices) < 30:
            continue
        candidate = int(candidate_hits[indices].sum())
        baseline_hits = sum(selection[index].baseline_hit for index in indices)
        if candidate - baseline_hits >= 2:
            selected.add(route)
    return selected


def apply_route_gate(
    events: list[Event],
    hits: np.ndarray,
    pairs: np.ndarray,
    brier: np.ndarray,
    routes: set[str],
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    gated_hits = hits.copy()
    gated_pairs = pairs.copy()
    gated_brier = brier.copy()
    for index, event in enumerate(events):
        if event.route not in routes:
            gated_hits[index] = event.baseline_hit
            gated_pairs[index] = event.baseline_pair
            gated_brier[index] = np.mean(
                (event.baseline_probability - event.y) ** 2
            )
    return gated_hits, gated_pairs, gated_brier


def stability(
    events: list[Event],
    hits: np.ndarray,
) -> tuple[float, float]:
    confirmation = [
        index for index, event in enumerate(events)
        if event.block in {"holdout", "recent"}
    ]
    route_values: dict[str, list[int]] = defaultdict(list)
    month_values: dict[str, list[int]] = defaultdict(list)
    for index in confirmation:
        event = events[index]
        delta = int(hits[index]) - int(event.baseline_hit)
        route_values[event.route].append(delta)
        month_values[event.iso[:7]].append(delta)
    worst_route = min(
        100 * sum(values) / len(values) for values in route_values.values()
    )
    stable_months = sum(sum(values) >= 0 for values in month_values.values()) / len(
        month_values
    )
    return worst_route, stable_months


def promotion(
    blocks: dict[str, Any],
    worst_route: float,
    stable_months: float,
) -> tuple[bool, dict[str, bool]]:
    confirmation_events = blocks["holdout"]["n"] + blocks["recent"]["n"]
    candidate_only = (
        blocks["holdout"]["candidateOnly"] + blocks["recent"]["candidateOnly"]
    )
    baseline_only = (
        blocks["holdout"]["baselineOnly"] + blocks["recent"]["baselineOnly"]
    )
    confirmation_p = base.exact_sign_pvalue(candidate_only, baseline_only)
    later_hits = (
        blocks["post_cache"]["hits"] + blocks["independent_extension"]["hits"]
    )
    later_baseline = (
        blocks["post_cache"]["baselineHits"]
        + blocks["independent_extension"]["baselineHits"]
    )
    gates = {
        "validationImproves": blocks["validation"]["liftPoints"] > 0,
        "holdoutNonDegrading": blocks["holdout"]["liftPoints"] >= 0,
        "recentNonDegrading": blocks["recent"]["liftPoints"] >= 0,
        "confirmationPairedP": confirmation_p < 0.05,
        "laterNonDegrading": later_hits >= later_baseline,
        "worstRoute": worst_route >= -2,
        "stableMonths": stable_months >= 0.60,
        "brierNonDegrading": all(
            blocks[name]["digitBrier"] <= blocks[name]["baselineDigitBrier"]
            for name in ("holdout", "recent")
        ),
    }
    gates["confirmationRowsPresent"] = confirmation_events > 0
    return all(gates.values()), gates


def pct(value: float) -> str:
    return f"{100 * value:.2f}%"


def points(value: float) -> str:
    return f"{value:+.2f}"


def main() -> None:
    rows_by_market, source_meta = base.load_rows()
    events: list[Event] = []
    for market, rows in rows_by_market.items():
        for side in ("open", "close"):
            baseline_rows = base.run_series(market, side, rows)
            events.extend(feature_events(market, side, rows, baseline_rows))
    events.sort(key=lambda event: (event.iso, event.market, event.side))

    inner_train = [event for event in events if event.iso <= INNER_TRAIN_END]
    inner_select = [
        event for event in events
        if INNER_TRAIN_END < event.iso <= DEVELOPMENT_END
    ]
    development = [event for event in events if event.iso <= DEVELOPMENT_END]
    confirmation = [event for event in events if event.iso > DEVELOPMENT_END]

    selection_results: list[dict[str, Any]] = []
    selection_predictions: dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]] = {}
    for ridge in RIDGES:
        family, _ = fit_predictions(inner_train, inner_select, ridge)
        for scope in SCOPES:
            for blend in BLENDS:
                config = Config(scope, ridge, blend)
                hits, pairs, brier = config_predictions(
                    inner_select, family[scope], blend
                )
                baseline_hits = np.array(
                    [event.baseline_hit for event in inner_select], dtype=bool
                )
                metric = summarize(
                    inner_select, hits, brier, baseline_hits
                )
                selection_results.append({"config": config.name, **metric})
                selection_predictions[config.name] = (hits, pairs, brier)

    selection_results.sort(
        key=lambda item: (
            item["hits"],
            -item["digitBrier"],
            -item["config"].count("market_side"),
            item["config"],
        ),
        reverse=True,
    )
    selected_name = selection_results[0]["config"]
    selected = next(
        Config(scope, ridge, blend)
        for scope in SCOPES
        for ridge in RIDGES
        for blend in BLENDS
        if Config(scope, ridge, blend).name == selected_name
    )
    selected_inner_hits = selection_predictions[selected.name][0]
    enabled_routes = route_gate(inner_select, selected_inner_hits)

    final_family, feature_importance = fit_predictions(
        development, confirmation, selected.ridge
    )
    hits, pairs, brier = config_predictions(
        confirmation, final_family[selected.scope], selected.blend
    )
    raw_blocks = block_metrics(confirmation, hits, brier)
    raw_worst, raw_months = stability(confirmation, hits)
    raw_promoted, raw_gates = promotion(raw_blocks, raw_worst, raw_months)

    gated_hits, gated_pairs, gated_brier = apply_route_gate(
        confirmation, hits, pairs, brier, enabled_routes
    )
    gated_blocks = block_metrics(confirmation, gated_hits, gated_brier)
    gated_worst, gated_months = stability(confirmation, gated_hits)
    gated_promoted, gated_gates = promotion(
        gated_blocks, gated_worst, gated_months
    )

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "study": "nested chronological ridge absent-digit research",
        "source": source_meta,
        "events": {
            "innerTrain": len(inner_train),
            "innerSelection": len(inner_select),
            "development": len(development),
            "confirmation": len(confirmation),
        },
        "featureCount": int(inner_train[0].x.shape[1]),
        "featureNames": FEATURE_NAMES,
        "featureImportance": feature_importance,
        "candidateConfigurations": len(selection_results),
        "selectedConfig": selected.name,
        "enabledMarketSides": sorted(enabled_routes),
        "selectionLeaderboard": selection_results,
        "rawCandidate": {
            "blocks": raw_blocks,
            "marketSides": route_metrics(confirmation, hits, brier),
            "worstRouteLiftPoints": raw_worst,
            "stableMonthRate": raw_months,
            "promotionGates": raw_gates,
            "promoted": raw_promoted,
        },
        "marketGatedCandidate": {
            "blocks": gated_blocks,
            "marketSides": route_metrics(
                confirmation, gated_hits, gated_brier
            ),
            "worstRouteLiftPoints": gated_worst,
            "stableMonthRate": gated_months,
            "promotionGates": gated_gates,
            "promoted": gated_promoted,
        },
        "productionChanged": False,
        "hashes": {"protocolSha256": sha256(PROTOCOL)},
    }
    RESULTS.write_text(
        json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8"
    )

    lines = [
        "# Nested ML Absent-Digit Report",
        "",
        f"Generated {payload['generatedAt']}.",
        "",
        "## Decision",
        "",
        (
            "**Promote the market-gated candidate.**"
            if gated_promoted
            else "**Reject the ML candidate; preserve the validated baseline.**"
        ),
        "",
        f"Selected `{selected.name}` from {len(selection_results)} configurations "
        "using only the inner-selection block.",
        "",
        f"Market-side fallback enabled {len(enabled_routes)}/24 routes: "
        f"`{', '.join(sorted(enabled_routes)) or 'none'}`.",
        "",
        "## Chronological comparison",
        "",
        "| Block | Candidate | V2 | Lift (pp) | Candidate-only | V2-only | Paired p | Digit Brier / V2 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for block, metric in gated_blocks.items():
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{metric['hits']}/{metric['n']} ({pct(metric['accuracy'])}) | "
            f"{metric['baselineHits']}/{metric['n']} "
            f"({pct(metric['baselineAccuracy'])}) | "
            f"{points(metric['liftPoints'])} | "
            f"{metric['candidateOnly']} | {metric['baselineOnly']} | "
            f"{metric['pairedPValue']:.4g} | "
            f"{metric['digitBrier']:.5f} / "
            f"{metric['baselineDigitBrier']:.5f} |"
        )
    lines.extend(
        [
            "",
            "## Promotion gates",
            "",
            "| Gate | Passed |",
            "| --- | --- |",
            *[
                f"| `{name}` | {'yes' if passed else 'no'} |"
                for name, passed in gated_gates.items()
            ],
            "",
            f"- Worst confirmation market-side lift: {gated_worst:+.2f} pp.",
            f"- Stable confirmation months: {pct(gated_months)}.",
            f"- Production changed: **no**.",
            "",
            "## Interpretation",
            "",
            "- Configuration and route fallback decisions are frozen before Validation.",
            "- Every feature uses only prior own-market rows; current Open is not used for ordinary Close.",
            "- Failure of any gate rejects the family even when one block or route looks promising.",
            "",
            "## Reproduce",
            "",
            "```powershell",
            "python research/absent_digits_ml_v4/run_nested_ml.py",
            "```",
            "",
        ]
    )
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({
        "selectedConfig": selected.name,
        "enabledRoutes": len(enabled_routes),
        "promoted": gated_promoted,
        "results": str(RESULTS),
        "report": str(REPORT),
    }, indent=2))


if __name__ == "__main__":
    main()
