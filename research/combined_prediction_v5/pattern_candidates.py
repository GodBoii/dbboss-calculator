"""Causal historical-pattern and structural-hypothesis research candidates.

The catalog has 100 pattern variants, ten mechanisms at ten observation windows,
and 100 theory variants, ten heuristic hypotheses at ten signed strengths. These
are parameterized hypotheses, not 200 independent scientific theories. Histories
start with the supplied replay and exclude every outcome on the forecast date.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterator

import numpy as np

WINDOWS = (3, 5, 7, 10, 14, 21, 30, 45, 60, 90)
STRENGTHS = (-2.0, -1.5, -1.0, -0.75, -0.25, 0.25, 0.75, 1.0, 1.5, 2.0)
PATTERNS = (
    "panel_frequency", "panel_overdue", "sutta_frequency", "digit_frequency",
    "digit_pair_frequency", "panel_kind_frequency", "weekday_panel_frequency",
    "exponential_panel_frequency", "sutta_transition", "recent_frequency_shift",
)
THEORIES = (
    "panel_persistence", "opposite_panel", "digit_persistence", "opposite_digits",
    "sutta_persistence", "sutta_trend", "sutta_reversal", "kind_persistence",
    "parity_persistence", "previous_opposite_side_digits",
)


@dataclass(frozen=True)
class SourceBank:
    """Endpoint-independent scores; callers own and reuse this cache."""

    channel: str
    rows: int
    patterns: dict[tuple[str, int], np.ndarray]
    theories: dict[str, np.ndarray]


def _center(values: np.ndarray) -> np.ndarray:
    centered = values - np.mean(values)
    return np.clip(centered / max(float(np.std(values)), 1e-6), -4.0, 4.0)


def _softmax(values: np.ndarray) -> np.ndarray:
    weights = np.exp(values - values.max(axis=1, keepdims=True))
    return weights / weights.sum(axis=1, keepdims=True)


def build_sources(replay: Any, channel: str) -> SourceBank:
    """Build score matrices using only earlier dates from each target market.

    Even close_known does not consume current-day Open. The opposite-side
    hypothesis uses the previous observed market date, so all sources obey the
    same strong prior-date causality contract.
    """
    if channel not in ("open", "close_pre", "close_known"):
        raise ValueError(f"Unknown channel: {channel}")
    actual = np.asarray(replay.actual(channel), dtype=int)
    opposite = np.asarray(replay.actual_close if channel == "open" else replay.actual_open, dtype=int)
    n, size = len(actual), len(replay.panels)
    if size != 220 or len(replay.dates) != n or len(replay.markets) != n:
        raise ValueError("Expected a compatible 220-panel replay")
    if list(replay.dates) != sorted(replay.dates):
        raise ValueError("Pattern sources require chronologically ordered rows")
    if len(set(zip(replay.dates, replay.markets))) != n:
        raise ValueError("Duplicate market/date observations")
    if np.any(actual < 0) or np.any(actual >= size):
        raise ValueError("Outcome index outside panel universe")
    weekdays = np.array([date.fromisoformat(str(day)).weekday() for day in replay.dates])
    digits = np.asarray(replay.digits, dtype=float)
    sutta = np.asarray(replay.sutta, dtype=int)
    kind = np.asarray(replay.kind)
    _, kind_codes = np.unique(kind, return_inverse=True)
    kind_sizes = np.bincount(kind_codes)[kind_codes]
    sutta_sizes = np.bincount(sutta, minlength=10)[sutta]
    pair = np.asarray(replay.pair_present, dtype=float)
    # Gram matrices map empirical panel frequencies to digit/pair similarity.
    digit_kernel = digits @ digits.T
    pair_kernel = pair @ pair.T
    parity = np.array([sum(int(d) % 2 for d in panel) for panel in replay.panels])
    opposite_digits = np.roll(digits, 5, axis=1)
    multiset_index = {tuple(sorted(map(int, panel))): i for i, panel in enumerate(replay.panels)}
    mirror = np.array([multiset_index[tuple(sorted((int(d) + 5) % 10 for d in panel))]
                       for panel in replay.panels])
    patterns = {(name, window): np.zeros((n, size), dtype=np.float32)
                for name in PATTERNS for window in WINDOWS}
    theories = {name: np.zeros((n, size), dtype=np.float32) for name in THEORIES}
    indices = np.arange(size)
    histories: dict[str, list[int]] = {}
    for day in np.unique(replay.dates):
        today = np.flatnonzero(replay.dates == day)
        for i in today:
            history = histories.get(str(replay.markets[i]), [])
            if not history:
                continue
            past = actual[history]
            last = int(past[-1])
            previous_sutta = int(sutta[past[-2]]) if len(past) > 1 else int(sutta[last])
            delta = (int(sutta[last]) - previous_sutta) % 10
            structural = {
                "panel_persistence": indices == last,
                "opposite_panel": indices == mirror[last],
                "digit_persistence": digit_kernel[:, last],
                "opposite_digits": digits @ opposite_digits[last],
                "sutta_persistence": sutta == sutta[last],
                "sutta_trend": sutta == (sutta[last] + delta) % 10,
                "sutta_reversal": sutta == (sutta[last] - delta) % 10,
                "kind_persistence": kind == kind[last],
                "parity_persistence": parity == parity[last],
                "previous_opposite_side_digits": digit_kernel[:, opposite[history[-1]]],
            }
            for name, values in structural.items():
                theories[name][i] = _center(np.asarray(values, dtype=float))
            for window in WINDOWS:
                used = history[-window:]
                values = actual[used]
                counts = np.bincount(values, minlength=size).astype(float)
                frequency = (counts + 0.5) / (len(values) + size * 0.5)
                gap = np.full(size, len(values) + 1.0)
                for lag, observed in enumerate(values[::-1]):
                    if gap[observed] == len(values) + 1:
                        gap[observed] = lag + 1
                sutta_counts = np.bincount(sutta[values], minlength=10)
                kind_counts = np.bincount(kind_codes[values], minlength=3)[kind_codes]
                weekday_values = actual[[j for j in used if weekdays[j] == weekdays[i]]]
                weekday_counts = np.bincount(weekday_values, minlength=size)
                ages = np.arange(len(values) - 1, -1, -1)
                decay_counts = np.bincount(values, weights=np.exp2(-ages / max(window / 3, 1)), minlength=size)
                next_sutta = sutta[values[1:]][sutta[values[:-1]] == sutta[last]]
                transition = np.bincount(next_sutta, minlength=10)
                split = max(1, len(values) // 2)
                older = np.bincount(values[:split], minlength=size) / split
                recent_n = len(values) - split
                recent = np.bincount(values[split:], minlength=size) / max(recent_n, 1)
                raw_scores = {
                    "panel_frequency": np.log(frequency),
                    "panel_overdue": np.log1p(gap),
                    "sutta_frequency": np.log((sutta_counts[sutta] + 1) / sutta_sizes),
                    "digit_frequency": digit_kernel @ frequency,
                    "digit_pair_frequency": pair_kernel @ frequency,
                    "panel_kind_frequency": np.log((kind_counts + 1) / kind_sizes),
                    "weekday_panel_frequency": np.log(weekday_counts + 0.5),
                    "exponential_panel_frequency": np.log(decay_counts + 0.5),
                    "sutta_transition": np.log(transition[sutta] + 1),
                    "recent_frequency_shift": recent - older if recent_n else np.zeros(size),
                }
                for name, scores in raw_scores.items():
                    patterns[name, window][i] = _center(scores)
        # Batch updates prevent any within-day market ordering from leaking labels.
        for i in today:
            histories.setdefault(str(replay.markets[i]), []).append(int(i))
    return SourceBank(channel, n, patterns, theories)


def candidates(replay: Any, channel: str, baseline: np.ndarray,
               sources: SourceBank | None = None) -> Iterator[tuple[dict[str, object], np.ndarray]]:
    """Yield exactly 100 pattern and 100 theory normalized distributions."""
    if sources is None:
        sources = build_sources(replay, channel)
    if sources.channel != channel or baseline.shape != (sources.rows, 220):
        raise ValueError("Source bank and baseline dimensions/channel disagree")
    if not np.isfinite(baseline).all() or np.any(baseline <= 0):
        raise ValueError("Baseline must contain finite, positive probabilities")
    np.testing.assert_allclose(baseline.sum(axis=1), 1.0, atol=1e-10)
    log_base = np.log(baseline)
    for mechanism in PATTERNS:
        for window in WINDOWS:
            metadata = {
                "id": f"pattern/{mechanism}/window={window}", "family": "patterns",
                "description": f"{mechanism}, previous {window} market observations, strength 0.5",
                "mechanism": mechanism, "window": window, "strength": 0.5,
            }
            yield metadata, _softmax(log_base + 0.5 * sources.patterns[mechanism, window])
    for mechanism in THEORIES:
        for strength in STRENGTHS:
            metadata = {
                "id": f"theory/{mechanism}/strength={strength:g}", "family": "theories",
                "description": f"{mechanism}, signed strength {strength:g}",
                "mechanism": mechanism, "strength": strength,
            }
            yield metadata, _softmax(log_base + strength * sources.theories[mechanism])
