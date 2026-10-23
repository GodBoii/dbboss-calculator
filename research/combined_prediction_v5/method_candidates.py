"""One hundred disclosed method variants, using strictly earlier-date labels.

Ten mechanisms each have ten regularization or learning-rate settings. These
are parameterized candidates, not one hundred independent learning algorithms.
Every update happens after predictions for every market on that date.
"""
from __future__ import annotations

from datetime import date
from typing import Iterator, Protocol

import numpy as np


class ReplayLike(Protocol):
    dates: np.ndarray
    markets: np.ndarray
    digits: np.ndarray
    sutta: np.ndarray
    kind: np.ndarray
    channels: dict

    def actual(self, channel: str) -> np.ndarray: ...


PRIOR_MASSES = (1.0, 2.0, 5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0)
LEARNING_RATES = (0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 2.0)


def normalize(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values, 1e-15)
    return values / values.sum(axis=-1, keepdims=True)


def _history(replay: ReplayLike, channel: str) -> dict[str, np.ndarray]:
    """Snapshot prefix counts. No label from the prediction day enters them."""
    targets = replay.actual(channel)
    n = len(targets)
    size = replay.digits.shape[0]
    output = {name: np.zeros((n, size)) for name in
              ("global", "local", "recent", "decay", "weekday", "transition")}
    global_counts = np.zeros(size)
    local_counts: dict[str, np.ndarray] = {}
    weekday_counts: dict[tuple[str, int], np.ndarray] = {}
    transition_counts: dict[tuple[str, int], np.ndarray] = {}
    histories: dict[str, list[int]] = {}
    decay_counts: dict[str, np.ndarray] = {}
    last_date: date | None = None
    for day in np.unique(replay.dates):
        current_date = date.fromisoformat(str(day))
        if last_date is not None:
            decay = 2 ** (-(current_date - last_date).days / 30)
            for counts in decay_counts.values():
                counts *= decay
        indices = np.flatnonzero(replay.dates == day)
        for i in indices:
            market = str(replay.markets[i])
            local = local_counts.setdefault(market, np.zeros(size))
            decayed = decay_counts.setdefault(market, np.zeros(size))
            own_history = histories.setdefault(market, [])
            weekday = weekday_counts.setdefault((market, current_date.weekday()), np.zeros(size))
            output["global"][i] = global_counts
            output["local"][i] = local
            output["recent"][i] = np.bincount(own_history[-30:], minlength=size)
            output["decay"][i] = decayed
            output["weekday"][i] = weekday
            if own_history:
                output["transition"][i] = transition_counts.get((market, own_history[-1]), np.zeros(size))
        for i in indices:
            market = str(replay.markets[i])
            actual = int(targets[i])
            previous = histories[market]
            if previous:
                transition_counts.setdefault((market, previous[-1]), np.zeros(size))[actual] += 1
            global_counts[actual] += 1
            local_counts[market][actual] += 1
            decay_counts[market][actual] += 1
            weekday_counts[market, current_date.weekday()][actual] += 1
            previous.append(actual)
        last_date = current_date
    return output


def _smooth(counts: np.ndarray, prior: np.ndarray, strength: float) -> np.ndarray:
    return normalize(counts + strength * prior)


def _online_mixture(replay: ReplayLike, channel: str, experts: np.ndarray,
                    learning_rate: float) -> np.ndarray:
    """Market-local exponentially weighted experts with date-batched loss."""
    n, panels = experts.shape[1:]
    output = np.empty((n, panels))
    weights: dict[str, np.ndarray] = {}
    actual = replay.actual(channel)
    for day in np.unique(replay.dates):
        indices = np.flatnonzero(replay.dates == day)
        for i in indices:
            market = str(replay.markets[i])
            log_weights = weights.setdefault(market, np.zeros(len(experts)))
            probs = normalize(np.exp(log_weights - log_weights.max()))
            output[i] = probs @ experts[:, i, :]
        for i in indices:
            market = str(replay.markets[i])
            weights[market] += learning_rate * np.log(np.maximum(experts[:, i, actual[i]], 1e-15))
            weights[market] -= weights[market].max()
    return normalize(output)


def candidates(replay: ReplayLike, channel: str, baseline: np.ndarray
               ) -> Iterator[tuple[dict, np.ndarray]]:
    """Yield exactly 100 methods as metadata and positive normalized panel odds."""
    if channel not in ("open", "close_pre", "close_known"):
        raise ValueError(f"Unknown channel: {channel}")
    shape = (len(replay.dates), replay.digits.shape[0])
    if baseline.shape != shape or not np.isfinite(baseline).all() or (baseline <= 0).any():
        raise ValueError("Baseline must be finite, positive, and match the replay")
    if len(replay.dates) == 0 or list(replay.dates) != sorted(replay.dates):
        raise ValueError("Replay must contain date-sorted events")
    if len(set(zip(replay.dates, replay.markets))) != len(replay.dates):
        raise ValueError("Duplicate market-date events are not supported")
    baseline = normalize(baseline)
    history = _history(replay, channel)
    size = shape[1]
    uniform = np.full(shape, 1 / size)
    pooled = _smooth(history["global"], uniform, float(size))
    global_sutta = np.stack([pooled[:, replay.sutta == d].sum(axis=1) for d in range(10)], axis=1)
    local_sutta = np.stack([history["local"][:, replay.sutta == d].sum(axis=1) for d in range(10)], axis=1)
    kinds = ("SP", "DP", "TP")
    global_kind = np.stack([pooled[:, replay.kind == kind].sum(axis=1) for kind in kinds], axis=1)
    local_kind = np.stack([history["local"][:, replay.kind == kind].sum(axis=1) for kind in kinds], axis=1)
    local_digits = history["local"] @ replay.digits
    global_digits = pooled @ replay.digits
    descriptions = {
        "pooled_dirichlet": "Pooled earlier-date panel frequencies with uniform prior",
        "market_hierarchical": "Market panel frequencies shrunk to earlier pooled frequencies",
        "recent30": "Last 30 market outcomes shrunk to earlier pooled frequencies",
        "decay30": "Market frequencies with 30-calendar-day half-life and pooled prior",
        "weekday": "Same-market same-weekday frequencies with pooled prior",
        "panel_transition": "Market previous-panel transition counts with pooled prior",
        "sutta_hierarchy": "Local Sutta frequencies; retain baseline ranking within each Sutta",
        "kind_hierarchy": "Local SP/DP/TP frequencies; retain baseline ranking within kind",
        "digit_bernoulli": "Independent digit-presence likelihood blended geometrically with baseline",
    }
    for mechanism, description in descriptions.items():
        for index, strength in enumerate(PRIOR_MASSES, start=1):
            if mechanism == "pooled_dirichlet":
                probs = _smooth(history["global"], uniform, strength)
            elif mechanism in ("market_hierarchical", "recent30", "decay30", "weekday", "panel_transition"):
                name = {"market_hierarchical": "local", "recent30": "recent", "decay30": "decay",
                        "weekday": "weekday", "panel_transition": "transition"}[mechanism]
                probs = _smooth(history[name], pooled, strength)
            elif mechanism in ("sutta_hierarchy", "kind_hierarchy"):
                labels = range(10) if mechanism == "sutta_hierarchy" else kinds
                panel_labels = replay.sutta if mechanism == "sutta_hierarchy" else replay.kind
                counts, prior = (local_sutta, global_sutta) if mechanism == "sutta_hierarchy" else (local_kind, global_kind)
                masses = _smooth(counts, prior, strength)
                probs = np.empty_like(baseline)
                for j, label in enumerate(labels):
                    mask = panel_labels == label
                    probs[:, mask] = normalize(baseline[:, mask]) * masses[:, j, None]
            else:
                sample_size = history["local"].sum(axis=1, keepdims=True)
                digits = np.clip((local_digits + strength * global_digits) / (sample_size + strength), 1e-6, 1 - 1e-6)
                scores = np.log(digits) @ replay.digits.T + np.log1p(-digits) @ (1 - replay.digits).T
                scores = 0.5 * (scores + np.log(baseline))
                probs = normalize(np.exp(scores - scores.max(axis=1, keepdims=True)))
            yield {"id": f"method_{mechanism}_{index:02d}", "family": mechanism,
                   "description": description, "parameters": {"prior_mass": strength},
                   "category": "method", "same_day_labels_excluded": True}, normalize(probs)
    raw = replay.channels[channel]["logits"]
    raw = normalize(np.exp(raw - raw.max(axis=1, keepdims=True)))
    experts = np.stack((baseline, raw, pooled, _smooth(history["local"], pooled, 100)))
    for index, rate in enumerate(LEARNING_RATES, start=1):
        yield {"id": f"method_online_logloss_{index:02d}", "family": "online_logloss",
               "description": "Market-local exponential expert weighting updated after the whole date",
               "parameters": {"learning_rate": rate, "experts": ["production", "raw", "pooled", "local100"]},
               "category": "method", "same_day_labels_excluded": True}, _online_mixture(replay, channel, experts, rate)
