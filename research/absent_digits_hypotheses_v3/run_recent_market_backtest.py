"""30/180-day actual-result backtest with chronology-safe market-side routing."""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from copy import deepcopy
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np


HERE = Path(__file__).resolve().parent
MATRIX = HERE / "event_candidate_matrix.npz"
HYPOTHESIS_RESULTS = HERE / "results.json"
BASE_PATH = HERE.parent / "absent_digits_v2" / "run_research.py"
OUTPUT = HERE / "RECENT_MARKET_BACKTEST.json"
REPORT = HERE / "RECENT_MARKET_BACKTEST.md"
PRIOR_MEAN = 0.506
PRIOR_STRENGTH = 80
STATIC_TRAIN_DAYS = 365
ROLLING_ROUTE_EVENTS = 240
MIN_ROLLING_EVENTS = 180
V3_MARKET_SIDE_ROUTES = {
    "Time Bazar|close",
    "Milan Day|open",
    "Milan Day|close",
    "Rajdhani Day|close",
    "Kalyan|close",
    "Kalyan Night|open",
    "Kalyan Night|close",
    "Main Bazar|close",
}


def load_base():
    spec = importlib.util.spec_from_file_location("recent_backtest_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


def wilson(hits: int, total: int) -> list[float]:
    if total == 0:
        return [0.0, 1.0]
    p = hits / total
    z = 1.959963984540054
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt(
        (p * (1 - p) + z * z / (4 * total)) / total
    ) / denominator
    return [max(0.0, center - margin), min(1.0, center + margin)]


def metric(
    hits: np.ndarray,
    baseline: np.ndarray,
    selected: np.ndarray,
) -> dict[str, Any]:
    n = int(selected.sum())
    model_hits = int(hits[selected].sum())
    baseline_hits = int(baseline[selected].sum())
    model_only = int((hits[selected] & ~baseline[selected]).sum())
    baseline_only = int((~hits[selected] & baseline[selected]).sum())
    return {
        "n": n,
        "hits": model_hits,
        "accuracy": model_hits / n if n else None,
        "wilson95": wilson(model_hits, n),
        "baselineHits": baseline_hits,
        "baselineAccuracy": baseline_hits / n if n else None,
        "liftPoints": 100 * (model_hits - baseline_hits) / n if n else None,
        "modelOnly": model_only,
        "baselineOnly": baseline_only,
        "pairedPValue": BASE.exact_sign_pvalue(model_only, baseline_only),
    }


def route_key(market: str, side: str) -> str:
    return f"{market}|{side}"


def choose_static_models(
    names: list[str],
    candidate_hits: np.ndarray,
    applicable: np.ndarray,
    baseline: np.ndarray,
    dates: np.ndarray,
    markets: np.ndarray,
    sides: np.ndarray,
    eligible: list[int],
    start_180: str,
) -> dict[str, dict[str, Any]]:
    train_start = (
        date.fromisoformat(start_180) - timedelta(days=STATIC_TRAIN_DAYS)
    ).isoformat()
    selections = {}
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            route = (markets == market) & (sides == side)
            train = route & (dates >= train_start) & (dates < start_180)
            train_indices = np.flatnonzero(train)
            best = None
            for candidate_index in eligible:
                comparable = train_indices[applicable[candidate_index, train_indices]]
                if len(comparable) < 180:
                    continue
                midpoint = len(comparable) // 2
                first = comparable[:midpoint]
                second = comparable[midpoint:]
                recent = comparable[-120:]
                net = int(
                    candidate_hits[candidate_index, comparable].sum()
                    - baseline[comparable].sum()
                )
                first_net = int(
                    candidate_hits[candidate_index, first].sum()
                    - baseline[first].sum()
                )
                second_net = int(
                    candidate_hits[candidate_index, second].sum()
                    - baseline[second].sum()
                )
                recent_net = int(
                    candidate_hits[candidate_index, recent].sum()
                    - baseline[recent].sum()
                )
                if net < 3 or first_net < 0 or second_net < 0 or recent_net < 0:
                    continue
                posterior = (
                    int(candidate_hits[candidate_index, comparable].sum())
                    + PRIOR_MEAN * PRIOR_STRENGTH
                ) / (len(comparable) + PRIOR_STRENGTH)
                score = (posterior, net, recent_net, names[candidate_index])
                if best is None or score > best[0]:
                    best = (
                        score, candidate_index, len(comparable), net,
                        first_net, second_net, recent_net,
                    )
            key = route_key(market, side)
            if best is None:
                selections[key] = {
                    "model": "baseline_v2",
                    "candidateIndex": None,
                    "trainingN": int(train.sum()),
                    "trainingNetHits": 0,
                    "guardrail": "No candidate passed two-half and recent-window guards.",
                }
            else:
                _, candidate_index, n, net, first_net, second_net, recent_net = best
                selections[key] = {
                    "model": names[candidate_index],
                    "candidateIndex": candidate_index,
                    "trainingN": n,
                    "trainingNetHits": net,
                    "firstHalfNetHits": first_net,
                    "secondHalfNetHits": second_net,
                    "recent120NetHits": recent_net,
                    "guardrail": "Selected only from dates before the 180-day test.",
                }
    return selections


def apply_static(
    selections: dict[str, dict[str, Any]],
    candidate_hits: np.ndarray,
    applicable: np.ndarray,
    baseline: np.ndarray,
    markets: np.ndarray,
    sides: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    hits = baseline.copy()
    model_names = np.full(len(baseline), "baseline_v2", dtype="<U40")
    for key, selection in selections.items():
        market, side = key.split("|")
        route = (markets == market) & (sides == side)
        candidate_index = selection["candidateIndex"]
        if candidate_index is None:
            continue
        selected = route & applicable[candidate_index]
        hits[selected] = candidate_hits[candidate_index, selected]
        model_names[selected] = selection["model"]
    return hits, model_names


def apply_rolling(
    names: list[str],
    candidate_hits: np.ndarray,
    applicable: np.ndarray,
    baseline: np.ndarray,
    dates: np.ndarray,
    markets: np.ndarray,
    sides: np.ndarray,
    eligible: list[int],
    start_180: str,
) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    hits = baseline.copy()
    model_names = np.full(len(baseline), "baseline_v2", dtype="<U40")
    choices = Counter()
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            route_indices = np.flatnonzero((markets == market) & (sides == side))
            for position, target_index in enumerate(route_indices):
                if dates[target_index] < start_180:
                    continue
                history = route_indices[max(0, position - ROLLING_ROUTE_EVENTS):position]
                if len(history) < MIN_ROLLING_EVENTS:
                    continue
                best = None
                for candidate_index in eligible:
                    comparable = history[applicable[candidate_index, history]]
                    if len(comparable) < MIN_ROLLING_EVENTS:
                        continue
                    recent = comparable[-80:]
                    previous = comparable[-160:-80]
                    net = int(
                        candidate_hits[candidate_index, comparable].sum()
                        - baseline[comparable].sum()
                    )
                    recent_net = int(
                        candidate_hits[candidate_index, recent].sum()
                        - baseline[recent].sum()
                    )
                    previous_net = int(
                        candidate_hits[candidate_index, previous].sum()
                        - baseline[previous].sum()
                    )
                    if net < 3 or recent_net < 0 or previous_net < 0:
                        continue
                    if not applicable[candidate_index, target_index]:
                        continue
                    posterior = (
                        int(candidate_hits[candidate_index, comparable].sum())
                        + PRIOR_MEAN * PRIOR_STRENGTH
                    ) / (len(comparable) + PRIOR_STRENGTH)
                    score = (
                        posterior, net, recent_net, previous_net,
                        names[candidate_index],
                    )
                    if best is None or score > best[0]:
                        best = (score, candidate_index)
                if best is None:
                    choices["baseline_v2"] += 1
                    continue
                candidate_index = best[1]
                hits[target_index] = candidate_hits[candidate_index, target_index]
                model_names[target_index] = names[candidate_index]
                choices[names[candidate_index]] += 1
    return hits, model_names, dict(choices)


def apply_static_kill_switch(
    selections: dict[str, dict[str, Any]],
    candidate_hits: np.ndarray,
    applicable: np.ndarray,
    baseline: np.ndarray,
    dates: np.ndarray,
    markets: np.ndarray,
    sides: np.ndarray,
    start_180: str,
) -> tuple[np.ndarray, np.ndarray, dict[str, int]]:
    """Use the frozen pretest model only while its earlier route ledger is healthy."""
    hits = baseline.copy()
    model_names = np.full(len(baseline), "baseline_v2", dtype="<U40")
    choices = Counter()
    for key, selection in selections.items():
        candidate_index = selection["candidateIndex"]
        if candidate_index is None:
            continue
        market, side = key.split("|")
        route_indices = np.flatnonzero((markets == market) & (sides == side))
        for position, target_index in enumerate(route_indices):
            if dates[target_index] < start_180:
                continue
            if not applicable[candidate_index, target_index]:
                continue
            history = route_indices[max(0, position - 80):position]
            history = history[applicable[candidate_index, history]]
            if len(history) < 60:
                continue
            recent = history[-40:]
            net = int(
                candidate_hits[candidate_index, history].sum()
                - baseline[history].sum()
            )
            recent_net = int(
                candidate_hits[candidate_index, recent].sum()
                - baseline[recent].sum()
            )
            if net < 2 or recent_net < 0:
                choices["baseline_v2_guarded"] += 1
                continue
            hits[target_index] = candidate_hits[candidate_index, target_index]
            model_names[target_index] = selection["model"]
            choices[selection["model"]] += 1
    return hits, model_names, dict(choices)


def bh_adjust(pvalues: dict[str, float]) -> dict[str, float]:
    ordered = sorted(pvalues, key=pvalues.get)
    total = len(ordered)
    result = {}
    running = 1.0
    for rank in range(total, 0, -1):
        key = ordered[rank - 1]
        running = min(running, pvalues[key] * total / rank)
        result[key] = min(1.0, running)
    return result


def pct(value: float | None) -> str:
    return "—" if value is None else f"{100 * value:.2f}%"


def pp(value: float | None) -> str:
    return "—" if value is None else f"{value:+.2f}"


def main() -> None:
    matrix = np.load(MATRIX)
    metadata = json.loads(HYPOTHESIS_RESULTS.read_text(encoding="utf-8"))
    names = [str(value) for value in matrix["candidate_names"]]
    dates = matrix["dates"]
    markets = matrix["markets"]
    sides = matrix["sides"]
    baseline = matrix["baseline_hits"].astype(bool)
    candidate_hits = matrix["candidate_hits"].astype(bool)
    applicable = matrix["candidate_applicable"].astype(bool)
    latest = max(str(value) for value in dates)
    latest_date = date.fromisoformat(latest)
    starts = {
        "last30": (latest_date - timedelta(days=29)).isoformat(),
        "last180": (latest_date - timedelta(days=179)).isoformat(),
    }
    window_masks = {
        name: (dates >= start) & (dates <= latest)
        for name, start in starts.items()
    }
    eligible = [
        idx for idx, name in enumerate(names)
        if metadata["results"][name]["contract"] == "pre_open"
    ]

    comparisons = {}
    for candidate_index in eligible:
        name = names[candidate_index]
        fair_hits = np.where(
            applicable[candidate_index], candidate_hits[candidate_index], baseline
        )
        comparisons[name] = {
            window: metric(fair_hits, baseline, selected)
            for window, selected in window_masks.items()
        }

    static_selections = choose_static_models(
        names, candidate_hits, applicable, baseline, dates, markets, sides,
        eligible, starts["last180"],
    )
    static_hits, static_names = apply_static(
        static_selections, candidate_hits, applicable, baseline, markets, sides
    )
    rolling_hits, rolling_names, rolling_choices = apply_rolling(
        names, candidate_hits, applicable, baseline, dates, markets, sides,
        eligible, starts["last180"],
    )
    guarded_hits, guarded_names, guarded_choices = apply_static_kill_switch(
        static_selections, candidate_hits, applicable, baseline, dates, markets,
        sides, starts["last180"],
    )
    v3_selections = deepcopy(static_selections)
    for key, selection in v3_selections.items():
        if key not in V3_MARKET_SIDE_ROUTES:
            selection["candidateIndex"] = None
            selection["model"] = "baseline_v2"
    v3_hits, v3_names, v3_choices = apply_static_kill_switch(
        v3_selections, candidate_hits, applicable, baseline, dates, markets,
        sides, starts["last180"],
    )
    strategies = {
        "baseline_v2": {
            window: metric(baseline, baseline, selected)
            for window, selected in window_masks.items()
        },
        "static_market_side_pretest": {
            window: metric(static_hits, baseline, selected)
            for window, selected in window_masks.items()
        },
        "rolling_market_side_causal": {
            window: metric(rolling_hits, baseline, selected)
            for window, selected in window_masks.items()
        },
        "static_pretest_with_causal_kill_switch": {
            window: metric(guarded_hits, baseline, selected)
            for window, selected in window_masks.items()
        },
        "promoted_guarded_market_v3": {
            window: metric(v3_hits, baseline, selected)
            for window, selected in window_masks.items()
        },
    }

    route_results = {}
    tweak_candidates = []
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            key = route_key(market, side)
            route = (markets == market) & (sides == side)
            static_180 = metric(
                static_hits, baseline, route & window_masks["last180"]
            )
            static_30 = metric(
                static_hits, baseline, route & window_masks["last30"]
            )
            selection = static_selections[key]
            if selection["model"] == "baseline_v2":
                recommendation = "KEEP_BASELINE"
            elif (
                (static_180["liftPoints"] or 0) > 0
                and (static_30["liftPoints"] or 0) >= 0
                and static_180["n"] >= 100
            ):
                recommendation = "FREEZE_AS_PROSPECTIVE_TWEAK_CANDIDATE"
                tweak_candidates.append(key)
            else:
                recommendation = "KEEP_BASELINE_TEST_REGRESSION"
            route_results[key] = {
                "pretestSelection": selection,
                "staticLast180": static_180,
                "staticLast30": static_30,
                "rollingLast180": metric(
                    rolling_hits, baseline, route & window_masks["last180"]
                ),
                "rollingLast30": metric(
                    rolling_hits, baseline, route & window_masks["last30"]
                ),
                "guardedLast180": metric(
                    guarded_hits, baseline, route & window_masks["last180"]
                ),
                "guardedLast30": metric(
                    guarded_hits, baseline, route & window_masks["last30"]
                ),
                "recommendation": recommendation,
            }

    route_qvalues = bh_adjust({
        key: value["staticLast180"]["pairedPValue"]
        for key, value in route_results.items()
    })
    for key, value in route_results.items():
        value["staticLast180FdrQValueAcrossRoutes"] = route_qvalues[key]
        if value["recommendation"] == "FREEZE_AS_PROSPECTIVE_TWEAK_CANDIDATE":
            value["recommendation"] = "OBSERVATIONAL_TWEAK_SHORTLIST"

    market_results = {}
    for market in BASE.MARKETS:
        selected_market = markets == market
        market_results[market] = {}
        for window, selected_window in window_masks.items():
            selected = selected_market & selected_window
            market_results[market][window] = {
                "baseline": metric(baseline, baseline, selected),
                "static": metric(static_hits, baseline, selected),
                "rolling": metric(rolling_hits, baseline, selected),
                "guarded": metric(guarded_hits, baseline, selected),
                "v3": metric(v3_hits, baseline, selected),
            }

    rankings = {}
    for window in ("last30", "last180"):
        rankings[window] = [
            {
                "model": name,
                **comparisons[name][window],
                "selectionUse": "descriptive_only_same_window_ranking",
            }
            for name in sorted(
                comparisons,
                key=lambda candidate: (
                    comparisons[candidate][window]["accuracy"] or 0,
                    comparisons[candidate][window]["hits"],
                    candidate,
                ),
                reverse=True,
            )[:20]
        ]

    rows_by_market, _ = BASE.load_rows()
    actual_panels = {
        (market, row["isoDate"], side): BASE.panel_for(row, side)
        for market, rows in rows_by_market.items()
        for row in rows
        for side in ("open", "close")
    }
    daily_30 = []
    selected_30 = np.flatnonzero(window_masks["last30"])
    for idx in selected_30:
        actual_panel = actual_panels[
            (str(markets[idx]), str(dates[idx]), str(sides[idx]))
        ]
        present = {int(value) for value in actual_panel}
        daily_30.append({
            "date": str(dates[idx]),
            "market": str(markets[idx]),
            "side": str(sides[idx]),
            "actualPanel": actual_panel,
            "actualAbsentDigits": [
                digit for digit in range(10) if digit not in present
            ],
            "baselineHit": bool(baseline[idx]),
            "staticModel": str(static_names[idx]),
            "staticHit": bool(static_hits[idx]),
            "rollingModel": str(rolling_names[idx]),
            "rollingHit": bool(rolling_hits[idx]),
            "guardedModel": str(guarded_names[idx]),
            "guardedHit": bool(guarded_hits[idx]),
            "v3Model": str(v3_names[idx]),
            "v3Hit": bool(v3_hits[idx]),
            "actualCompared": True,
        })

    payload = {
        "schemaVersion": 1,
        "createdAt": "2026-07-24",
        "latestActualDate": latest,
        "windows": {
            name: {
                "start": start,
                "end": latest,
                "definition": f"Inclusive {name.replace('last', '')}-calendar-day window.",
                "events": int(window_masks[name].sum()),
            }
            for name, start in starts.items()
        },
        "target": "Both selected digits absent from the actual three-digit panel.",
        "candidateModelsCompared": len(eligible),
        "selectionProtocol": {
            "static": (
                "Per market-side choice trained only on the 365 calendar days "
                "before the 180-day test. Requires >=180 comparable calls, >=3 "
                "net hits, non-negative first/second halves and recent 120."
            ),
            "rolling": (
                "At each prediction, choose from the prior 240 route events only; "
                "require >=180 comparable events, >=3 net hits and non-negative "
                "two most recent 80-event segments."
            ),
            "sameWindowRankings": (
                "Descriptive only. They are not valid model-selection evidence."
            ),
        },
        "strategies": strategies,
        "staticSelections": static_selections,
        "rollingChoiceCounts180": rolling_choices,
        "guardedChoiceCounts180": guarded_choices,
        "v3ChoiceCounts180": v3_choices,
        "v3MarketSideRoutes": sorted(V3_MARKET_SIDE_ROUTES),
        "marketResults": market_results,
        "routeResults": route_results,
        "observationalTweakShortlist": tweak_candidates,
        "multiplicityConfirmedRouteTweaks": [
            key for key in tweak_candidates if route_qvalues[key] < 0.05
        ],
        "sameWindowTopModels": rankings,
        "modelComparisons": comparisons,
        "dailyActualComparisonLast30": daily_30,
        "decision": {
            "productionChanged": True,
            "promotedModelId": "absent-digits-guarded-market-routing-v3",
            "reason": (
                "User-directed guarded promotion. V3 applies only the eight routes "
                "that beat V2 in both windows and retains the causal kill switch. "
                "The aggregate lift is positive but not statistically confirmed, "
                "so the 80% actionability gate and V2 fallback remain mandatory."
            ),
        },
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    print(json.dumps({
        "latest": latest,
        "events30": payload["windows"]["last30"]["events"],
        "events180": payload["windows"]["last180"]["events"],
        "strategies": strategies,
        "observationalTweakShortlist": tweak_candidates,
        "multiplicityConfirmedRouteTweaks": payload[
            "multiplicityConfirmedRouteTweaks"
        ],
        "output": str(OUTPUT),
        "report": str(REPORT),
    }, indent=2))


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        "# Recent 30/180-Day Market Model Backtest",
        "",
        f"Actual results through **{payload['latestActualDate']}**. A hit requires both "
        "predicted digits to be absent from the actual panel.",
        "",
        "## Strategy comparison",
        "",
        "| Strategy | 180-day hits / n | Accuracy | Lift | p | 30-day hits / n | Accuracy | Lift | p |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for name, result in payload["strategies"].items():
        long = result["last180"]
        short = result["last30"]
        lines.append(
            f"| {name} | {long['hits']} / {long['n']} | {pct(long['accuracy'])} | "
            f"{pp(long['liftPoints'])} | {long['pairedPValue']:.4f} | "
            f"{short['hits']} / {short['n']} | {pct(short['accuracy'])} | "
            f"{pp(short['liftPoints'])} | {short['pairedPValue']:.4f} |"
        )
    lines += [
        "",
        "The static selector was trained entirely before the 180-day window. The "
        "rolling selector recomputes a guarded market-side choice using only earlier "
        "outcomes. The individual top-model lists below are same-window descriptions "
        "and cannot be used for promotion.",
        "",
        "## Per-market comparison",
        "",
        "| Market | 180d baseline | Static | Rolling | Guarded | V3 | 30d baseline | Static | Rolling | Guarded | V3 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for market, values in payload["marketResults"].items():
        long = values["last180"]
        short = values["last30"]
        lines.append(
            f"| {market} | {pct(long['baseline']['accuracy'])} | "
            f"{pp(long['static']['liftPoints'])} | {pp(long['rolling']['liftPoints'])} | "
            f"{pp(long['guarded']['liftPoints'])} | {pp(long['v3']['liftPoints'])} | "
            f"{pct(short['baseline']['accuracy'])} | "
            f"{pp(short['static']['liftPoints'])} | {pp(short['rolling']['liftPoints'])} | "
            f"{pp(short['guarded']['liftPoints'])} | {pp(short['v3']['liftPoints'])} |"
        )
    lines += [
        "",
        "## Market-side pretest selections",
        "",
        "| Route | Model chosen before test | Train net | 180d lift | 30d lift | Recommendation |",
        "| --- | --- | ---: | ---: | ---: | --- |",
    ]
    for key, result in payload["routeResults"].items():
        selection = result["pretestSelection"]
        lines.append(
            f"| {key} | `{selection['model']}` | "
            f"{selection['trainingNetHits']:+d} | "
            f"{pp(result['staticLast180']['liftPoints'])} | "
            f"{pp(result['staticLast30']['liftPoints'])} | "
            f"{result['recommendation']} |"
        )
    for window in ("last180", "last30"):
        lines += [
            "",
            f"## Descriptive top models: {window}",
            "",
            "| Rank | Model | Hits / n | Accuracy | Lift | Paired p |",
            "| ---: | --- | ---: | ---: | ---: | ---: |",
        ]
        for rank, row in enumerate(payload["sameWindowTopModels"][window][:10], 1):
            lines.append(
                f"| {rank} | `{row['model']}` | {row['hits']} / {row['n']} | "
                f"{pct(row['accuracy'])} | {pp(row['liftPoints'])} | "
                f"{row['pairedPValue']:.4f} |"
            )
    lines += [
        "",
        "## Decision",
        "",
        f"Production changed: **{str(payload['decision']['productionChanged']).lower()}** "
        f"to `{payload['decision']['promotedModelId']}`.",
        "",
        payload["decision"]["reason"],
        "",
        f"Routes meeting both-window observational guards: "
        f"{', '.join(payload['observationalTweakShortlist']) or 'none'}.",
        "",
        f"Route tweaks surviving FDR correction: "
        f"{', '.join(payload['multiplicityConfirmedRouteTweaks']) or 'none'}.",
        "",
        "The JSON artifact includes all candidate comparisons, per-route Open/Close "
        "results, selection histories, and every last-30-day hit/miss against actuals.",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
