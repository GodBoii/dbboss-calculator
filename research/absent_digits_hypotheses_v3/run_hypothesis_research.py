"""Chronology-safe domain hypothesis research for the Absent Digits engine."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import sys
from bisect import bisect_left
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE_PATH = ROOT / "research" / "absent_digits_v2" / "run_research.py"
OUTPUT = HERE / "results.json"
REPORT = HERE / "REPORT.md"
EVENT_MATRIX = HERE / "event_candidate_matrix.npz"

MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day",
    "Kalyan", "Sridevi Night", "Kalyan Night", "Madhur Night",
    "Milan Night", "Rajdhani Night", "Main Bazar",
]
OPEN_MINUTE = dict(zip(
    MARKETS, [695, 790, 810, 910, 905, 945, 1155, 1305, 1230, 1265, 1295, 1320]
))
CLOSE_MINUTE = dict(zip(
    MARKETS, [755, 850, 870, 1030, 1025, 1065, 1215, 1425, 1350, 1385, 1415, 1450]
))
DAY_TO_NIGHT = {
    "Sridevi Night": "Sridevi",
    "Kalyan Night": "Kalyan",
    "Madhur Night": "Madhur Day",
    "Milan Night": "Milan Day",
    "Rajdhani Night": "Rajdhani Day",
    "Main Bazar": "Rajdhani Night",
}
LAGS = (1, 2, 3, 5, 7, 10, 15, 30, 60, 90)
SHORT_LAGS = (1, 2, 3, 5, 7, 10)
WINDOWS = (2, 3, 5, 7, 10, 15, 30, 60, 90)
EMBARGO = 15
WARMUP_END = "2025-07-13"
HOLIDAYS = {
    # Government of India gazetted dates used only for the evaluated era.
    "2025-01-26", "2025-02-26", "2025-03-14", "2025-03-31",
    "2025-04-10", "2025-04-18", "2025-05-12", "2025-06-07",
    "2025-07-06", "2025-08-15", "2025-08-16", "2025-09-05",
    "2025-10-02", "2025-10-20", "2025-11-05", "2025-12-25",
    "2026-01-26", "2026-03-04", "2026-03-21", "2026-03-26",
    "2026-03-31", "2026-04-03", "2026-05-01", "2026-05-27",
    "2026-06-26", "2026-08-15", "2026-09-04", "2026-10-02",
    "2026-10-20", "2026-11-08", "2026-11-24", "2026-12-25",
}
PRIMES = {2, 3, 5, 7}


def load_base():
    spec = importlib.util.spec_from_file_location("absent_digits_v2_frozen", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


@dataclass
class Event:
    market: str
    side: str
    row_index: int
    iso: str
    block: str
    mask: int
    baseline_probability: np.ndarray
    baseline_pair: int
    baseline_hit: bool


@dataclass
class Candidate:
    name: str
    category: str
    description: str
    contract: str
    cost: str
    complexity: str
    hit: np.ndarray
    standalone_hit: np.ndarray
    applicable: np.ndarray
    support: np.ndarray


def digits(panel: str) -> list[int]:
    return [int(value) for value in panel]


def mask_digits(mask: int) -> set[int]:
    return {digit for digit in range(10) if mask & (1 << digit)}


def appearance_rate(
    masks: list[int],
    indices: list[int] | range,
    prior: np.ndarray,
    strength: float = 16.0,
) -> tuple[np.ndarray, int]:
    selected = list(indices)
    if not selected:
        return prior.copy(), 0
    counts = np.zeros(10)
    for idx in selected:
        for digit in mask_digits(masks[idx]):
            counts[digit] += 1
    return (counts + strength * prior) / (len(selected) + strength), len(selected)


def anchor(prior: np.ndarray, present: set[int], bonus: float = 0.06) -> np.ndarray:
    result = prior.copy()
    for digit in present:
        result[digit] += bonus
    return np.clip(result, 0.01, 0.95)


def absent_anchor(prior: np.ndarray, absent: set[int], bonus: float = 0.06) -> np.ndarray:
    result = prior.copy()
    for digit in absent:
        result[digit] -= bonus
    return np.clip(result, 0.01, 0.95)


def opposite(values: set[int]) -> set[int]:
    return {(digit + 5) % 10 for digit in values}


def pair_index(probability: np.ndarray) -> int:
    selected = sorted(range(10), key=lambda digit: (probability[digit], digit))[:2]
    pair = tuple(sorted(selected))
    return BASE.PAIRS.index(pair)


def pair_hit(pair: int, mask: int) -> bool:
    a, b = BASE.PAIRS[pair]
    return not (mask & (1 << a)) and not (mask & (1 << b))


def group_signature(mask: int) -> tuple[int, int, int, int]:
    values = mask_digits(mask)
    return (
        sum(value % 2 == 0 for value in values),
        sum(value <= 4 for value in values),
        sum(value in PRIMES for value in values),
        len(values),
    )


def position_signature(panel: str) -> tuple[int, int, int]:
    return tuple(digits(panel))  # type: ignore[return-value]


def conditional_rate(
    masks: list[int],
    keys: list[Any],
    current: Any,
    index: int,
    prior: np.ndarray,
    horizon: int = 730,
    strength: float = 24.0,
) -> tuple[np.ndarray, int]:
    selected = [
        idx for idx in range(max(0, index - horizon), index)
        if keys[idx] == current
    ]
    return appearance_rate(masks, selected, prior, strength)


def index_map(values: list[Any], start: int = 0) -> dict[Any, list[int]]:
    result: dict[Any, list[int]] = defaultdict(list)
    for idx in range(start, len(values)):
        result[values[idx]].append(idx)
    return dict(result)


def prior_indices(
    mapping: dict[Any, list[int]],
    key: Any,
    index: int,
    horizon: int | None = None,
) -> list[int]:
    values = mapping.get(key, [])
    high = bisect_left(values, index)
    low = 0 if horizon is None else bisect_left(values, max(0, index - horizon))
    return values[low:high]


def build_route_contexts(
    rows_by_market: dict[str, list[dict[str, Any]]]
) -> dict[tuple[str, str], dict[str, Any]]:
    contexts = {}
    for market in MARKETS:
        rows = rows_by_market[market]
        dates = [date.fromisoformat(row["isoDate"]) for row in rows]
        for side in ("open", "close"):
            panels = [BASE.panel_for(row, side) for row in rows]
            masks = [BASE.mask_for(panel) for panel in panels]
            suttas = [sum(digits(panel)) % 10 for panel in panels]
            jodis = [str(row.get("jodi", "")).zfill(2) for row in rows]
            lag_sutta_maps = {}
            lag_jodi_maps = {}
            for lag in SHORT_LAGS:
                keys = [None] * len(rows)
                for idx in range(lag, len(rows)):
                    keys[idx] = suttas[idx - lag]
                lag_sutta_maps[lag] = index_map(keys, lag)
            for lag in (1, 2, 3, 5):
                keys = [None] * len(rows)
                for idx in range(lag, len(rows)):
                    keys[idx] = jodis[idx - lag]
                lag_jodi_maps[lag] = index_map(keys, lag)
            group_keys = [None] + [
                group_signature(masks[idx - 1]) for idx in range(1, len(rows))
            ]
            order_keys = [None] + [
                tuple(np.argsort(digits(panels[idx - 1])))
                for idx in range(1, len(rows))
            ]
            mask_keys = [None] + masks[:-1]
            sequence_keys = [None, None] + [
                (suttas[idx - 2], suttas[idx - 1])
                for idx in range(2, len(rows))
            ]
            position_maps = []
            for position in range(3):
                keys = [None] + [
                    digits(panels[idx - 1])[position]
                    for idx in range(1, len(rows))
                ]
                position_maps.append(index_map(keys, 1))
            contexts[(market, side)] = {
                "rows": rows,
                "panels": panels,
                "masks": masks,
                "suttas": suttas,
                "jodis": jodis,
                "dates": dates,
                "calendar": {
                    "same_weekday": index_map([value.weekday() for value in dates]),
                    "same_month": index_map([value.month for value in dates]),
                    "same_day_of_month": index_map([value.day for value in dates]),
                    "same_year": index_map([value.year for value in dates]),
                    "same_weekday_month": index_map([
                        (value.weekday(), value.month) for value in dates
                    ]),
                },
                "holiday": index_map([
                    is_holiday_window(row["isoDate"]) for row in rows
                ]),
                "season": index_map([(value.month % 12) // 3 for value in dates]),
                "lagSutta": lag_sutta_maps,
                "lagJodi": lag_jodi_maps,
                "group": index_map(group_keys, 1),
                "order": index_map(order_keys, 1),
                "mask": index_map(mask_keys, 1),
                "sequence": index_map(sequence_keys, 2),
                "position": position_maps,
                "openSutta": index_map([int(row["openSutta"]) for row in rows]),
            }
    return contexts


def is_holiday_window(iso: str, radius: int = 2) -> bool:
    current = date.fromisoformat(iso)
    return any(
        (current + timedelta(days=offset)).isoformat() in HOLIDAYS
        for offset in range(-radius, radius + 1)
    )


def spectral_clusters(rows_by_market: dict[str, list[dict[str, Any]]]) -> dict[int, int]:
    adjacency = np.eye(10) * 1e-3
    for market in MARKETS:
        for row in rows_by_market[market]:
            if row["isoDate"] > WARMUP_END:
                break
            for side in ("open", "close"):
                values = sorted(set(digits(BASE.panel_for(row, side))))
                for a in values:
                    for b in values:
                        adjacency[a, b] += 1
    degree = np.diag(1 / np.sqrt(np.maximum(adjacency.sum(axis=1), 1e-9)))
    normalized = degree @ adjacency @ degree
    _, vectors = np.linalg.eigh(normalized)
    embedding = vectors[:, -3:]
    centers = embedding[[0, 4, 8]].copy()
    labels = np.zeros(10, dtype=int)
    for _ in range(30):
        labels = np.argmin(
            ((embedding[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2),
            axis=1,
        )
        updated = centers.copy()
        for cluster in range(3):
            members = embedding[labels == cluster]
            if len(members):
                updated[cluster] = members.mean(axis=0)
        if np.allclose(updated, centers):
            break
        centers = updated
    return {digit: int(labels[digit]) for digit in range(10)}


def fit_hmm(observations: np.ndarray, states: int = 3, iterations: int = 18):
    symbols = 10
    start = np.full(states, 1 / states)
    transition = np.full((states, states), 0.1 / (states - 1))
    np.fill_diagonal(transition, 0.9)
    emission = np.vstack([
        np.roll(np.linspace(1, 2, symbols), state * 3)
        for state in range(states)
    ])
    emission /= emission.sum(axis=1, keepdims=True)
    for _ in range(iterations):
        length = len(observations)
        alpha = np.zeros((length, states))
        scales = np.zeros(length)
        alpha[0] = start * emission[:, observations[0]]
        scales[0] = max(alpha[0].sum(), 1e-12)
        alpha[0] /= scales[0]
        for t in range(1, length):
            alpha[t] = (alpha[t - 1] @ transition) * emission[:, observations[t]]
            scales[t] = max(alpha[t].sum(), 1e-12)
            alpha[t] /= scales[t]
        beta = np.ones((length, states))
        for t in range(length - 2, -1, -1):
            beta[t] = transition @ (emission[:, observations[t + 1]] * beta[t + 1])
            beta[t] /= max(scales[t + 1], 1e-12)
        gamma = alpha * beta
        gamma /= np.maximum(gamma.sum(axis=1, keepdims=True), 1e-12)
        xi_sum = np.zeros_like(transition)
        for t in range(length - 1):
            xi = (
                alpha[t, :, None] * transition
                * (emission[:, observations[t + 1]] * beta[t + 1])[None, :]
            )
            xi_sum += xi / max(xi.sum(), 1e-12)
        start = gamma[0]
        transition = (xi_sum + 0.25)
        transition /= transition.sum(axis=1, keepdims=True)
        emission = np.full((states, symbols), 0.25)
        for symbol in range(symbols):
            emission[:, symbol] += gamma[observations == symbol].sum(axis=0)
        emission /= emission.sum(axis=1, keepdims=True)
    return start, transition, emission, gamma


def hmm_forecasts(
    rows_by_market: dict[str, list[dict[str, Any]]]
) -> dict[tuple[str, str], dict[int, np.ndarray]]:
    result: dict[tuple[str, str], dict[int, np.ndarray]] = {}
    for market in MARKETS:
        rows = rows_by_market[market]
        for side in ("open", "close"):
            panels = [BASE.panel_for(row, side) for row in rows]
            masks = [BASE.mask_for(panel) for panel in panels]
            suttas = np.array([sum(digits(panel)) % 10 for panel in panels], dtype=int)
            warm_n = sum(row["isoDate"] <= WARMUP_END for row in rows)
            train = suttas[:warm_n]
            start, transition, emission, gamma = fit_hmm(train)
            digit_by_state = np.zeros((3, 10))
            state_weight = gamma.sum(axis=0) + 8
            for state in range(3):
                digit_by_state[state] += 8 * 0.27
            for idx in range(warm_n):
                for digit in mask_digits(masks[idx]):
                    digit_by_state[:, digit] += gamma[idx]
            digit_by_state /= state_weight[:, None]
            posterior = start.copy()
            forecasts: dict[int, np.ndarray] = {}
            for idx, observation in enumerate(suttas):
                if idx > 0:
                    forecasts[idx] = (posterior @ transition) @ digit_by_state
                posterior = (posterior @ transition) * emission[:, observation]
                posterior /= max(posterior.sum(), 1e-12)
            result[(market, side)] = forecasts
    return result


def bh_adjust(pvalues: dict[str, float]) -> dict[str, float]:
    ordered = sorted(pvalues, key=pvalues.get)
    total = len(ordered)
    adjusted: dict[str, float] = {}
    running = 1.0
    for rank in range(total, 0, -1):
        name = ordered[rank - 1]
        running = min(running, pvalues[name] * total / rank)
        adjusted[name] = min(1.0, running)
    return adjusted


def source_panel(
    source: str,
    target_market: str,
    iso: str,
    rows_by_date: dict[str, dict[str, dict[str, Any]]],
    rows_by_market: dict[str, list[dict[str, Any]]],
    source_dates: dict[str, list[str]],
) -> tuple[str | None, int]:
    cutoff = OPEN_MINUTE[target_market] - EMBARGO
    same_day = rows_by_date[source].get(iso)
    if same_day is not None:
        if CLOSE_MINUTE[source] + EMBARGO <= cutoff:
            return str(same_day["closePanel"]), 2
        if OPEN_MINUTE[source] + EMBARGO <= cutoff:
            return str(same_day["openPanel"]), 1
    prior_index = bisect_left(source_dates[source], iso) - 1
    if prior_index >= 0:
        return str(rows_by_market[source][prior_index]["closePanel"]), 0
    return None, -1


def build_events(rows_by_market: dict[str, list[dict[str, Any]]]):
    events: list[Event] = []
    series_by_route: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for market in MARKETS:
        for side in ("open", "close"):
            series = BASE.run_series(market, side, rows_by_market[market])
            series_by_route[(market, side)] = series
            index_by_date = {
                row["isoDate"]: idx for idx, row in enumerate(rows_by_market[market])
            }
            for prediction in series:
                pair = int(prediction["blendPairs"]["0.75"])
                events.append(Event(
                    market=market,
                    side=side,
                    row_index=index_by_date[prediction["date"]],
                    iso=prediction["date"],
                    block=prediction["block"],
                    mask=int(prediction["mask"]),
                    baseline_probability=np.array(
                        prediction["digitProbability"], dtype=float
                    ),
                    baseline_pair=pair,
                    baseline_hit=bool(prediction["blendHits"]["0.75"]),
                ))
    events.sort(key=lambda event: (event.iso, OPEN_MINUTE[event.market], event.market, event.side))
    return events, series_by_route


def feature_rows(
    event: Event,
    rows_by_market: dict[str, list[dict[str, Any]]],
    rows_by_date: dict[str, dict[str, dict[str, Any]]],
    clusters: dict[int, int],
    hmm: dict[tuple[str, str], dict[int, np.ndarray]],
    baseline_pair_by_route_date: dict[tuple[str, str, str], int],
    contexts: dict[tuple[str, str], dict[str, Any]],
    source_dates: dict[str, list[str]],
):
    context = contexts[(event.market, event.side)]
    rows = context["rows"]
    index = event.row_index
    side = event.side
    panels = context["panels"]
    masks = context["masks"]
    suttas = context["suttas"]
    jodis = context["jodis"]
    dates = context["dates"]
    long, _ = appearance_rate(
        masks, range(max(0, index - 730), index), np.full(10, 0.27), 36
    )

    def emit(
        name: str,
        category: str,
        description: str,
        scores: np.ndarray,
        support: int,
        contract: str = "pre_open",
        cost: str = "low",
        complexity: str = "low",
    ):
        return (name, category, description, scores, support, contract, cost, complexity)

    features = []
    for window in WINDOWS:
        scores, support = appearance_rate(
            masks, range(max(0, index - window), index), long, 12
        )
        features.append(emit(
            f"frequency_hot_w{window}", "frequency",
            f"Recent {window}-draw appearance frequency continuation.", scores, support,
        ))
        saturated = np.clip(2 * long - scores, 0.01, 0.95)
        features.append(emit(
            f"frequency_saturation_w{window}", "frequency",
            f"Recent {window}-draw frequency saturation / mean reversion.", saturated, support,
        ))

    for lag in LAGS:
        if index < lag:
            continue
        values = mask_digits(masks[index - lag])
        features.append(emit(
            f"lag_panel_repeat_{lag}", "previous_result",
            f"Digits present in the panel {lag} own-market draws ago repeat.", anchor(long, values), 1,
        ))
        features.append(emit(
            f"lag_absence_continue_{lag}", "previous_result",
            f"Digits absent {lag} own-market draws ago remain absent.", absent_anchor(long, set(range(10)) - values), 1,
        ))
        features.append(emit(
            f"lag_opposite_{lag}", "opposite_rotation",
            f"0↔5, 1↔6, … opposite mapping of the panel {lag} draws ago.", anchor(long, opposite(values)), 1,
        ))

    for lag in SHORT_LAGS:
        if index < lag:
            continue
        source_sutta = suttas[index - lag]
        selected = prior_indices(
            context["lagSutta"][lag], source_sutta, index, 730
        )
        scores, support = appearance_rate(
            masks, selected, long, strength=28
        )
        features.append(emit(
            f"lag_sutta_transition_{lag}", "sutta_jodi",
            f"Target appearance conditional on the own {lag}-lag sutta.", scores, support,
            complexity="medium",
        ))

    for lag in (1, 2, 3, 5):
        if index < lag:
            continue
        source_jodi = jodis[index - lag]
        selected = prior_indices(
            context["lagJodi"][lag], source_jodi, index, 730
        )
        scores, support = appearance_rate(
            masks, selected, long, strength=45
        )
        features.append(emit(
            f"lag_jodi_transition_{lag}", "sutta_jodi",
            f"Target appearance conditional on the own {lag}-lag jodi.", scores, support,
            complexity="medium",
        ))

    target_date = dates[index]
    calendar_keys = {
        "same_weekday": target_date.weekday(),
        "same_month": target_date.month,
        "same_day_of_month": target_date.day,
        "same_year": target_date.year,
        "same_weekday_month": (target_date.weekday(), target_date.month),
    }
    for name, key in calendar_keys.items():
        selected = prior_indices(context["calendar"][name], key, index)
        scores, support = appearance_rate(masks, selected[-730:], long, 24)
        features.append(emit(
            f"calendar_{name}", "calendar",
            f"Appearance rate among prior observations with {name.replace('_', ' ')}.", scores, support,
        ))

    holiday_key = is_holiday_window(event.iso)
    holiday_indices = prior_indices(context["holiday"], holiday_key, index)
    scores, support = appearance_rate(masks, holiday_indices[-730:], long, 36)
    features.append(emit(
        "calendar_festival_holiday_window", "calendar",
        "Government-holiday/festival proximity (±2 days) versus ordinary dates.", scores, support,
        complexity="medium",
    ))
    season = (target_date.month % 12) // 3
    season_indices = prior_indices(context["season"], season, index)
    scores, support = appearance_rate(masks, season_indices[-730:], long, 24)
    features.append(emit(
        "calendar_season", "calendar", "Three-month seasonal appearance profile.", scores, support,
    ))

    previous_mask = masks[index - 1]
    previous_group = group_signature(previous_mask)
    group_selected = prior_indices(context["group"], previous_group, index, 730)
    scores, support = appearance_rate(
        masks, group_selected, long, strength=28
    )
    features.append(emit(
        "group_transition_signature", "groups_houses",
        "Transition conditional on prior odd/even, low/high, prime and panel-kind counts.",
        scores, support, complexity="medium",
    ))

    for group_name, group in (
        ("even", {0, 2, 4, 6, 8}),
        ("low", {0, 1, 2, 3, 4}),
        ("prime", PRIMES),
    ):
        recent_masks = masks[max(0, index - 15):index]
        observed = sum(
            len(mask_digits(value) & group) for value in recent_masks
        ) / max(1, len(recent_masks))
        expected = len(group) * 0.27
        delta = np.zeros(10)
        direction = -1 if observed > expected else 1
        for digit in group:
            delta[digit] = 0.04 * direction
        features.append(emit(
            f"balance_{group_name}_w15", "balance",
            f"Recent {group_name} group imbalance reversion over 15 draws.",
            np.clip(long + delta, 0.01, 0.95), len(recent_masks),
        ))

    previous_panel = panels[index - 1]
    previous_positions = position_signature(previous_panel)
    position_scores = np.zeros(10)
    position_support = 0
    for position in range(3):
        matches = prior_indices(
            context["position"][position], previous_positions[position], index, 730
        )
        rate, support = appearance_rate(masks, matches, long, 24)
        position_scores += rate
        position_support += support
    features.append(emit(
        "position_markov", "position",
        "Position-specific transition from prior first/second/third panel digits.",
        position_scores / 3, position_support, complexity="medium",
    ))

    sorted_previous = sorted(digits(previous_panel))
    position_order = tuple(np.argsort(digits(previous_panel)))
    order_indices = prior_indices(context["order"], position_order, index, 730)
    scores, support = appearance_rate(masks, order_indices, long, 28)
    features.append(emit(
        "position_order_pattern", "position",
        f"Transition after the prior panel's positional order pattern {position_order}.",
        scores, support, complexity="medium",
    ))

    for rotation in (1, 2, 3, 5):
        rotated = {(value + rotation) % 10 for value in sorted_previous}
        features.append(emit(
            f"rotation_plus_{rotation}", "opposite_rotation",
            f"Prior panel digits rotated by +{rotation} modulo 10.", anchor(long, rotated), 1,
        ))

    clusters_present = {clusters[value] for value in mask_digits(previous_mask)}
    family = {digit for digit in range(10) if clusters[digit] in clusters_present}
    features.append(emit(
        "learned_digit_family", "learned_family",
        "Spectral co-appearance embedding: digits in prior panel families continue.",
        anchor(long, family, 0.035), 1, complexity="high", cost="medium",
    ))

    gaps = np.zeros(10)
    streaks = np.zeros(10)
    for digit in range(10):
        gap = 90
        for distance, mask in enumerate(reversed(masks[max(0, index - 90):index]), 1):
            if mask & (1 << digit):
                gap = distance - 1
                break
        gaps[digit] = gap / 90
        streak = 0
        for mask in reversed(masks[max(0, index - 30):index]):
            if mask & (1 << digit):
                streak += 1
            else:
                break
        streaks[digit] = min(streak, 5) / 5
    features.append(emit(
        "missing_pressure", "streak_pressure",
        "Long-missing digits are assigned higher reappearance probability.",
        np.clip(long + 0.08 * gaps, 0.01, 0.95), min(index, 90),
    ))
    features.append(emit(
        "missing_persistence", "streak_pressure",
        "Long-missing digits are assigned lower appearance probability.",
        np.clip(long - 0.08 * gaps, 0.01, 0.95), min(index, 90),
    ))
    features.append(emit(
        "appearance_streak_continue", "streak_pressure",
        "Consecutive appearance streaks continue.", np.clip(long + 0.06 * streaks, 0.01, 0.95),
        min(index, 30),
    ))
    features.append(emit(
        "appearance_streak_reverse", "streak_pressure",
        "Consecutive appearance streaks reverse.", np.clip(long - 0.06 * streaks, 0.01, 0.95),
        min(index, 30),
    ))

    mask_selected = prior_indices(context["mask"], previous_mask, index, 730)
    scores, support = appearance_rate(
        masks, mask_selected, long, strength=40
    )
    features.append(emit(
        "association_previous_exact_mask", "automatic_discovery",
        "Mined association rule conditioned on the exact prior digit-presence mask.",
        scores, support, complexity="high", cost="medium",
    ))
    if index >= 2:
        sequence = (suttas[index - 2], suttas[index - 1])
        sequence_selected = prior_indices(
            context["sequence"], sequence, index, 730
        )
        scores, support = appearance_rate(
            masks, sequence_selected, long, strength=45
        )
        features.append(emit(
            "sequence_two_sutta", "automatic_discovery",
            "Mined two-symbol prior-sutta sequence rule.", scores, support,
            complexity="high", cost="medium",
        ))

    hmm_score = hmm[(event.market, event.side)].get(index)
    if hmm_score is not None and event.iso > WARMUP_END:
        features.append(emit(
            "hmm_three_state_sutta", "automatic_discovery",
            "Frozen three-state HMM over suttas with state-specific digit emissions.",
            np.clip(hmm_score, 0.01, 0.95), sum(row["isoDate"] <= WARMUP_END for row in rows),
            complexity="high", cost="high",
        ))

    own_open = int(rows[index - 1]["openSutta"])
    own_close = int(rows[index - 1]["closeSutta"])
    symbolic = {
        "sum": (own_open + own_close) % 10,
        "difference": (own_open - own_close) % 10,
        "product": (own_open * own_close) % 10,
    }
    for name, value in symbolic.items():
        features.append(emit(
            f"symbolic_previous_{name}", "automatic_discovery",
            f"Symbolic prior Open/Close sutta {name} modulo 10 as an appearance anchor.",
            anchor(long, {value}), 1, complexity="medium",
        ))

    previous_prediction = baseline_pair_by_route_date.get(
        (event.market, event.side, rows[index - 1]["isoDate"])
    )
    if previous_prediction is not None:
        values = set(BASE.PAIRS[previous_prediction])
        features.append(emit(
            "previous_predicted_pair_persistence", "previous_prediction",
            "The prior V2 predicted absent pair remains absent.",
            absent_anchor(long, values), 1,
        ))
        features.append(emit(
            "previous_predicted_pair_reversal", "previous_prediction",
            "The prior V2 predicted absent pair reappears.",
            anchor(long, values), 1,
        ))

    source_values = []
    for source in MARKETS:
        if source == event.market:
            continue
        panel, availability = source_panel(
            source, event.market, event.iso, rows_by_date, rows_by_market,
            source_dates,
        )
        if panel is None:
            continue
        values = set(digits(panel))
        source_values.extend(values)
        features.append(emit(
            f"cross_source_{source.lower().replace(' ', '_')}", "cross_market",
            f"Most recent causally available {source} panel transfers to the target.",
            anchor(long, values, 0.045), 1,
            complexity="medium", cost="medium",
        ))
    if source_values:
        counts = Counter(source_values)
        cross = long.copy()
        for digit in range(10):
            cross[digit] += 0.05 * counts[digit] / max(counts.values())
        features.append(emit(
            "cross_market_consensus", "cross_market",
            "Consensus across every causally available source-market panel.",
            np.clip(cross, 0.01, 0.95), len(source_values),
            complexity="medium", cost="medium",
        ))

    day_source = DAY_TO_NIGHT.get(event.market)
    if day_source:
        panel, availability = source_panel(
            day_source, event.market, event.iso, rows_by_date, rows_by_market,
            source_dates,
        )
        if panel:
            features.append(emit(
                "day_to_night_transfer", "day_to_night",
                f"Causal day-to-night transfer from paired source {day_source}.",
                anchor(long, set(digits(panel)), 0.055), 1,
                complexity="medium", cost="medium",
            ))
            if event.iso:
                weekday_bonus = 0.01 if target_date.weekday() in (0, 1, 2) else -0.01
                features.append(emit(
                    "interaction_daynight_weekday", "interaction",
                    "Day-to-night transfer interacted with weekday regime.",
                    anchor(long, set(digits(panel)), 0.055 + weekday_bonus), 1,
                    complexity="high", cost="medium",
                ))

    if index >= 1:
        lag_values = mask_digits(masks[index - 1])
        weekday_lag_indices = [
            idx for idx in prior_indices(
                context["calendar"]["same_weekday"], target_date.weekday(), index, 730
            )
            if idx > 0 and suttas[idx - 1] == suttas[index - 1]
        ]
        scores, support = appearance_rate(masks, weekday_lag_indices, long, 36)
        features.append(emit(
            "interaction_weekday_previous_sutta", "interaction",
            "Weekday × previous-sutta conditional transition.", scores, support,
            complexity="high", cost="medium",
        ))
        features.append(emit(
            "interaction_saturation_opposite", "interaction",
            "30-draw saturation combined with the opposite of the prior panel.",
            0.6 * np.clip(
                2 * long - appearance_rate(
                    masks, range(max(0, index - 30), index), long, 12
                )[0], 0.01, 0.95
            ) + 0.4 * anchor(long, opposite(lag_values)),
            min(index, 30), complexity="high",
        ))

    if side == "close":
        current_open = str(rows[index]["openPanel"])
        current_open_sutta = int(rows[index]["openSutta"])
        conditional_indices = prior_indices(
            context["openSutta"], current_open_sutta, index, 730
        )
        scores, support = appearance_rate(masks, conditional_indices, long, 28)
        features.append(emit(
            "conditional_current_open_sutta", "open_to_close",
            "Post-Open Close appearance conditional on current Open sutta.",
            scores, support, contract="post_open_close", complexity="medium",
        ))
        features.append(emit(
            "conditional_current_open_panel", "open_to_close",
            "Post-Open current Open-panel digit transfer into Close.",
            anchor(long, set(digits(current_open))), 1,
            contract="post_open_close",
        ))
        features.append(emit(
            "conditional_current_open_opposite", "open_to_close",
            "Post-Open opposite mapping of current Open-panel digits into Close.",
            anchor(long, opposite(set(digits(current_open)))), 1,
            contract="post_open_close",
        ))

    return features


def metric(
    candidate: Candidate,
    event_mask: np.ndarray,
    baseline_hits: np.ndarray,
    events: list[Event],
) -> dict[str, Any]:
    selected = event_mask & candidate.applicable
    n = int(selected.sum())
    hits = int(candidate.hit[selected].sum())
    standalone = int(candidate.standalone_hit[selected].sum())
    baseline = int(baseline_hits[selected].sum())
    candidate_only = int((candidate.hit[selected] & ~baseline_hits[selected]).sum())
    baseline_only = int((~candidate.hit[selected] & baseline_hits[selected]).sum())
    low, high = BASE.wilson(hits, n)
    return {
        "n": n,
        "hits": hits,
        "accuracy": hits / n if n else None,
        "standaloneAccuracy": standalone / n if n else None,
        "baselineHits": baseline,
        "baselineAccuracy": baseline / n if n else None,
        "liftPoints": 100 * (hits - baseline) / n if n else None,
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "pairedPValue": BASE.exact_sign_pvalue(candidate_only, baseline_only),
        "wilson95": [low, high],
        "meanSupport": float(candidate.support[selected].mean()) if n else None,
    }


def evaluate() -> dict[str, Any]:
    rows_by_market, source_meta = BASE.load_rows()
    rows_by_date = {
        market: {row["isoDate"]: row for row in rows}
        for market, rows in rows_by_market.items()
    }
    source_dates = {
        market: [row["isoDate"] for row in rows]
        for market, rows in rows_by_market.items()
    }
    contexts = build_route_contexts(rows_by_market)
    events, series_by_route = build_events(rows_by_market)
    total = len(events)
    baseline_hits = np.array([event.baseline_hit for event in events], dtype=bool)
    blocks = np.array([event.block for event in events], dtype=object)
    clusters = spectral_clusters(rows_by_market)
    hmm = hmm_forecasts(rows_by_market)
    baseline_pair_by_route_date = {
        (market, side, row["date"]): int(row["blendPairs"]["0.75"])
        for (market, side), series in series_by_route.items()
        for row in series
    }
    candidates: dict[str, Candidate] = {}

    def register(feature, event_index: int, event: Event):
        name, category, description, scores, support, contract, cost, complexity = feature
        if name not in candidates:
            candidates[name] = Candidate(
                name=name, category=category, description=description,
                contract=contract, cost=cost, complexity=complexity,
                hit=np.zeros(total, dtype=bool),
                standalone_hit=np.zeros(total, dtype=bool),
                applicable=np.zeros(total, dtype=bool),
                support=np.zeros(total, dtype=np.float32),
            )
        candidate = candidates[name]
        standalone_pair = pair_index(scores)
        hybrid = 0.65 * event.baseline_probability + 0.35 * scores
        hybrid_pair = pair_index(hybrid)
        candidate.applicable[event_index] = True
        candidate.hit[event_index] = pair_hit(hybrid_pair, event.mask)
        candidate.standalone_hit[event_index] = pair_hit(standalone_pair, event.mask)
        candidate.support[event_index] = support

    for event_index, event in enumerate(events):
        for feature in feature_rows(
            event, rows_by_market, rows_by_date, clusters, hmm,
            baseline_pair_by_route_date, contexts, source_dates,
        ):
            register(feature, event_index, event)

    # Warm-up-only automatic lag and cross-source selection per route.
    for selector_name, prefix, description in (
        (
            "auto_warmup_lag_selector", ("lag_panel_repeat_", "lag_absence_continue_", "lag_opposite_"),
            "Warm-up-only route selector over panel lag/repeat/absence/opposite hypotheses.",
        ),
        (
            "auto_warmup_cross_source_selector", ("cross_source_",),
            "Warm-up-only route selector over causal cross-market sources.",
        ),
    ):
        selected_by_route: dict[str, str] = {}
        selector = Candidate(
            name=selector_name, category="automatic_discovery", description=description,
            contract="pre_open", cost="medium", complexity="high",
            hit=np.zeros(total, dtype=bool), standalone_hit=np.zeros(total, dtype=bool),
            applicable=np.zeros(total, dtype=bool), support=np.zeros(total, dtype=np.float32),
        )
        for market in MARKETS:
            for side in ("open", "close"):
                route = np.array([
                    event.market == market and event.side == side and event.block == "warmup"
                    for event in events
                ])
                choices = [
                    candidate for name, candidate in candidates.items()
                    if name.startswith(prefix)
                    and int((route & candidate.applicable).sum()) >= 120
                ]
                if not choices:
                    continue
                choice = max(
                    choices,
                    key=lambda candidate: (
                        int(candidate.hit[route & candidate.applicable].sum())
                        - int(baseline_hits[route & candidate.applicable].sum()),
                        candidate.name,
                    ),
                )
                selected_by_route[f"{market}|{side}"] = choice.name
                target = np.array([
                    event.market == market and event.side == side for event in events
                ])
                applicable = target & choice.applicable
                selector.applicable[applicable] = True
                selector.hit[applicable] = choice.hit[applicable]
                selector.standalone_hit[applicable] = choice.standalone_hit[applicable]
                selector.support[applicable] = choice.support[applicable]
        candidates[selector_name] = selector
        setattr(selector, "selected_by_route", selected_by_route)

    block_names = [
        "validation", "holdout", "recent", "post_cache", "independent_extension"
    ]
    candidate_results: dict[str, Any] = {}
    confirmation_pvalues: dict[str, float] = {}
    confirmation_mask = np.isin(blocks, ["holdout", "recent"])
    later_mask = np.isin(blocks, ["post_cache", "independent_extension"])

    for name, candidate in candidates.items():
        metrics = {
            block: metric(candidate, blocks == block, baseline_hits, events)
            for block in block_names
        }
        confirmation = metric(candidate, confirmation_mask, baseline_hits, events)
        later = metric(candidate, later_mask, baseline_hits, events)
        confirmation_pvalues[name] = confirmation["pairedPValue"]

        route_lifts = []
        for market in MARKETS:
            for side in ("open", "close"):
                route = np.array([
                    event.market == market and event.side == side for event in events
                ])
                value = metric(
                    candidate, confirmation_mask & route, baseline_hits, events
                )
                if value["n"]:
                    route_lifts.append(value["liftPoints"])
        month_values = defaultdict(lambda: [0, 0, 0])
        selected = confirmation_mask & candidate.applicable
        for idx in np.flatnonzero(selected):
            key = events[idx].iso[:7]
            month_values[key][0] += int(candidate.hit[idx])
            month_values[key][1] += int(baseline_hits[idx])
            month_values[key][2] += 1
        nonnegative_months = sum(
            candidate_hits >= baseline
            for candidate_hits, baseline, _ in month_values.values()
        )
        stability = (
            nonnegative_months / len(month_values) if month_values else 0
        )
        candidate_results[name] = {
            "name": name,
            "category": candidate.category,
            "description": candidate.description,
            "contract": candidate.contract,
            "computationalCost": candidate.cost,
            "complexity": candidate.complexity,
            "blocks": metrics,
            "confirmation": confirmation,
            "laterExtensions": later,
            "worstMarketSideLiftPoints": min(route_lifts) if route_lifts else None,
            "nonnegativeMonthFraction": stability,
            "overfitRisk": (
                "high" if candidate.complexity == "high"
                or (confirmation["meanSupport"] or 0) < 20
                else "medium" if candidate.complexity == "medium" else "low"
            ),
        }
        if hasattr(candidate, "selected_by_route"):
            candidate_results[name]["warmupSelections"] = getattr(
                candidate, "selected_by_route"
            )

    qvalues = bh_adjust(confirmation_pvalues)
    kept = []
    for name, result in candidate_results.items():
        validation = result["blocks"]["validation"]
        holdout = result["blocks"]["holdout"]
        recent = result["blocks"]["recent"]
        later = result["laterExtensions"]
        gates = {
            "validationImproves": (validation["liftPoints"] or -999) > 0,
            "holdoutNonDegrading": (holdout["liftPoints"] or -999) >= 0,
            "recentNonDegrading": (recent["liftPoints"] or -999) >= 0,
            "confirmationFdr05": qvalues[name] < 0.05
            and result["confirmation"]["candidateOnly"]
            > result["confirmation"]["baselineOnly"],
            "laterNonDegrading": (later["liftPoints"] or -999) >= 0,
            "worstRouteWithinTwoPoints": (
                result["worstMarketSideLiftPoints"] is not None
                and result["worstMarketSideLiftPoints"] >= -2
            ),
            "stableMonths": result["nonnegativeMonthFraction"] >= 0.60,
        }
        result["confirmationFdrQValue"] = qvalues[name]
        result["gates"] = gates
        if result["contract"] == "post_open_close":
            verdict = "RESEARCH_ONLY_CONDITIONAL"
        elif all(gates.values()):
            verdict = "KEEP_FOR_PROSPECTIVE"
            kept.append(name)
        else:
            verdict = "REJECT"
        result["verdict"] = verdict

    baseline_blocks = {}
    for block in block_names:
        selected = blocks == block
        baseline_blocks[block] = {
            "n": int(selected.sum()),
            "hits": int(baseline_hits[selected].sum()),
            "accuracy": float(baseline_hits[selected].mean()) if selected.any() else None,
        }

    # Directed source graph uses warm-up-selected cross-source candidates.
    source_selector = candidate_results["auto_warmup_cross_source_selector"]
    edge_counts = Counter(source_selector.get("warmupSelections", {}).values())
    influence_graph = [
        {"sourceHypothesis": name, "routesSelected": count}
        for name, count in edge_counts.most_common()
    ]

    payload = {
        "schemaVersion": 1,
        "createdAt": "2026-07-24",
        "study": "domain-specific absent-digit hypothesis research",
        "baseline": {
            "model": "absent-digits-complementary-online-v2",
            "appearanceBlendWeight": 0.75,
            "candidateAdjustmentWeight": 0.35,
            "blocks": baseline_blocks,
        },
        "source": source_meta,
        "schedule": {
            "timezone": "Asia/Kolkata",
            "openMinute": OPEN_MINUTE,
            "closeMinute": CLOSE_MINUTE,
            "embargoMinutes": EMBARGO,
        },
        "learnedDigitClusters": clusters,
        "holidaySources": [
            "https://www.cgca.gov.in/ccadl/list-of-holiday",
            "https://www.indiapost.gov.in/holidays-list",
        ],
        "hypothesesTested": len(candidate_results),
        "keptForProspective": kept,
        "productionChanged": False,
        "influenceGraph": influence_graph,
        "results": candidate_results,
        "limitations": [
            "The source data contains no market geography; regional/national labels were not inferred.",
            "All historical blocks were inspected before this study and are retrospective evidence.",
            "Post-Open Close hypotheses have a later information set and cannot be promoted to the pre-Open Close runtime.",
            "Holiday coding uses Government of India dates for 2025-2026 only; it is not a complete local festival calendar.",
        ],
        "hashes": {
            "baselineCodeSha256": hashlib.sha256(BASE_PATH.read_bytes()).hexdigest(),
            "protocolSha256": hashlib.sha256((HERE / "PROTOCOL.md").read_bytes()).hexdigest(),
        },
    }

    candidate_names = list(candidates)
    np.savez_compressed(
        EVENT_MATRIX,
        candidate_names=np.array(candidate_names),
        dates=np.array([event.iso for event in events]),
        markets=np.array([event.market for event in events]),
        sides=np.array([event.side for event in events]),
        blocks=np.array([event.block for event in events]),
        baseline_hits=baseline_hits,
        candidate_hits=np.vstack([
            candidates[name].hit for name in candidate_names
        ]),
        candidate_applicable=np.vstack([
            candidates[name].applicable for name in candidate_names
        ]),
    )
    return payload


def pct(value: float | None) -> str:
    return "—" if value is None else f"{100 * value:.2f}%"


def points(value: float | None) -> str:
    return "—" if value is None else f"{value:+.2f}"


def write_report(payload: dict[str, Any]) -> None:
    results = list(payload["results"].values())
    results.sort(key=lambda row: (
        row["verdict"] != "KEEP_FOR_PROSPECTIVE",
        -(row["confirmation"]["liftPoints"] or -999),
        row["name"],
    ))
    lines = [
        "# Domain-Specific Absent-Digit Hypothesis Report",
        "",
        f"Tested **{payload['hypothesesTested']}** named hypotheses against the frozen "
        "75/25 V2 baseline. The production runtime was not changed.",
        "",
        "## Outcome",
        "",
    ]
    kept = payload["keptForProspective"]
    if kept:
        lines.append(
            f"Historical gates retained {len(kept)} candidate(s) for a new prospective "
            f"cohort: {', '.join(f'`{name}`' for name in kept)}."
        )
    else:
        lines.append(
            "No pre-Open hypothesis passed every out-of-sample, multiplicity, route, "
            "and time-stability gate. All pre-Open candidates are rejected; the V2 "
            "runtime remains unchanged."
        )
    lines += [
        "",
        "Conditional Open→Close candidates are reported separately and cannot alter "
        "the ordinary pre-Open Close contract.",
        "",
        "## Baseline",
        "",
        "| Block | Hits / n | Accuracy |",
        "| --- | ---: | ---: |",
    ]
    for block, metric_value in payload["baseline"]["blocks"].items():
        lines.append(
            f"| {block} | {metric_value['hits']} / {metric_value['n']} | "
            f"{pct(metric_value['accuracy'])} |"
        )
    lines += [
        "",
        "## Every hypothesis",
        "",
        "| Hypothesis | Category | Contract | Validation lift (pp) | Holdout | Recent | "
        "Confirm p / FDR q | Later lift | Worst route | Stable months | Verdict |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for row in results:
        validation = row["blocks"]["validation"]
        holdout = row["blocks"]["holdout"]
        recent = row["blocks"]["recent"]
        confirmation = row["confirmation"]
        later = row["laterExtensions"]
        lines.append(
            f"| `{row['name']}` | {row['category']} | {row['contract']} | "
            f"{points(validation['liftPoints'])} | {points(holdout['liftPoints'])} | "
            f"{points(recent['liftPoints'])} | {confirmation['pairedPValue']:.4g} / "
            f"{row['confirmationFdrQValue']:.4g} | {points(later['liftPoints'])} | "
            f"{points(row['worstMarketSideLiftPoints'])} | "
            f"{pct(row['nonnegativeMonthFraction'])} | {row['verdict']} |"
        )
    lines += [
        "",
        "The JSON artifact contains each hypothesis's standalone accuracy, adjusted "
        "accuracy, baseline comparison, exact paired significance, Wilson interval, "
        "support, cost, overfit risk, per-block stability, and gate outcomes.",
        "",
        "## Automatic discovery",
        "",
        f"- Learned spectral digit families: `{payload['learnedDigitClusters']}`.",
        "- A frozen three-state sutta HMM was evaluated independently for every "
        "market-side.",
        "- Exact-mask association rules, two-sutta sequences, symbolic arithmetic, "
        "warm-up lag selection, and warm-up cross-source selection were evaluated.",
        "- The directed influence summary counts which source candidate each route's "
        "warm-up selector chose; selection alone is not evidence of a causal effect.",
        "",
        "## Scope and limitations",
        "",
    ]
    lines.extend(f"- {value}" for value in payload["limitations"])
    lines += [
        "",
        "Holiday/festival dates were coded from official Government of India lists: "
        "[2025 CGCA list](https://www.cgca.gov.in/ccadl/list-of-holiday) and "
        "[India Post 2026 list](https://www.indiapost.gov.in/holidays-list).",
        "",
        "See `PROTOCOL.md` for the chronology, contracts, multiplicity correction, "
        "and promotion rules.",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    payload = evaluate()
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    print(json.dumps({
        "hypothesesTested": payload["hypothesesTested"],
        "keptForProspective": payload["keptForProspective"],
        "output": str(OUTPUT),
        "report": str(REPORT),
        "eventMatrix": str(EVENT_MATRIX),
    }, indent=2))


if __name__ == "__main__":
    main()
