"""Causal component experts yielding one positive distribution over 220 panels.

This research catalogue includes the complete V6 and V5 method catalogues.
Additional native component experts and empirical pair-absence hypotheses are
parameter variants, not claims of independent predictive discoveries. Outcomes
are used only for date-batched updates to historical sufficient statistics.
"""
from __future__ import annotations

from dataclasses import dataclass
import importlib.util
from pathlib import Path
import sys
from typing import Any, Iterator

import numpy as np


def _load(name: str, relative: str) -> Any:
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parent.parent / relative)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load research catalogue {relative}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_v6 = _load("_prediction_v7_v6_candidates", "combined_prediction_v6/candidates.py")
_methods = _load("_prediction_v7_v5_methods", "combined_prediction_v5/method_candidates.py")
normalize = _v6.normalize
softmax = _v6.softmax


@dataclass(frozen=True)
class ExpertBank:
    channel: str
    rows: int
    joint: Any
    pair_counts: dict[str, np.ndarray]
    sample_sizes: dict[str, np.ndarray]


def _pair_history(replay: Any, channel: str) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    """Count pair absences before each date, including explicit zero-history priors."""
    n = len(replay.dates)
    names = ("pooled", "local", "last7", "last30", "last90")
    counts = {name: np.zeros((n, 45)) for name in names}
    sizes = {name: np.zeros((n, 1)) for name in names}
    actual = replay.actual(channel)
    pooled = np.zeros(45)
    pooled_size = 0
    local: dict[str, np.ndarray] = {}
    histories: dict[str, list[int]] = {}
    for day in np.unique(replay.dates):
        today = np.flatnonzero(replay.dates == day)
        for row in today:
            market = str(replay.markets[row])
            history = histories.get(market, [])
            counts["pooled"][row] = pooled
            sizes["pooled"][row] = pooled_size
            counts["local"][row] = local.get(market, np.zeros(45))
            sizes["local"][row] = len(history)
            for window in (7, 30, 90):
                prefix = history[-window:]
                if prefix:
                    counts[f"last{window}"][row] = replay.pair_absent[prefix].sum(axis=0)
                sizes[f"last{window}"][row] = len(prefix)
        for row in today:
            market = str(replay.markets[row])
            target = int(actual[row])
            event = replay.pair_absent[target]
            pooled += event
            pooled_size += 1
            local.setdefault(market, np.zeros(45))[:] += event
            histories.setdefault(market, []).append(target)
    return counts, sizes


def build_bank(replay: Any, channel: str) -> ExpertBank:
    """Precompute only forecast features and strictly earlier-date label counts."""
    joint = _v6.build_bank(replay, channel)
    if np.asarray(replay.pair_absent).shape != (220, 45):
        raise ValueError("Expected the complete 45-pair absence matrix")
    counts, sizes = _pair_history(replay, channel)
    return ExpertBank(channel, len(replay.dates), joint, counts, sizes)


def _meta(family: str, description: str, **parameters: object) -> dict[str, object]:
    result = _v6._metadata(family, description, **parameters)
    result["same_day_labels_excluded"] = True
    return result


def _replace_marginal(p: np.ndarray, target: np.ndarray, replay: Any) -> np.ndarray:
    current = _v6._marginal(p, replay.sutta_matrix)
    return normalize(p * (target / np.maximum(current, 1e-15))[:, replay.sutta])


def candidates(replay: Any, channel: str, bank: ExpertBank | None = None
               ) -> Iterator[tuple[dict[str, object], np.ndarray]]:
    """Stream metadata and normalized positive n-by-220 panel probabilities.

    No file access occurs while streaming. Baseline decisions remain the
    evaluator's responsibility because production uses different endpoints for
    panel10, SP30 and DP20. Every returned expert is a common probability space.
    """
    bank = build_bank(replay, channel) if bank is None else bank
    if bank.channel != channel or bank.rows != len(replay.dates):
        raise ValueError("Bank/replay channel or shape mismatch")
    joint = bank.joint
    base = joint.sources["sp30"]
    raw = joint.sources["raw"]
    log_base = np.log(base)
    for metadata, p in _v6.candidates(replay, channel, joint):
        metadata = dict(metadata, id="v6/" + str(metadata["id"]))
        yield metadata, p
    for metadata, p in _methods.candidates(replay, channel, base):
        metadata = dict(metadata, id="v5/" + str(metadata["id"]))
        yield metadata, p

    for source, p in joint.sources.items():
        yield _meta("native_endpoint", "Unmodified endpoint or raw panel distribution", source=source), p
    # Full native Sutta replacement has exactly the native Sutta marginal;
    # preserve conditional panel information rather than only gating the top 5.
    for source in ("sp30", "all10", "dp20", "raw"):
        for target in ("native", "conditional"):
            yield _meta("native_sutta_full", "Exact native Sutta marginal with source conditional ranking", source=source, target=target), _replace_marginal(joint.sources[source], joint.sutta_targets[target], replay)
    dp = np.asarray(replay.dp_index)
    native_dp = normalize(np.asarray(replay.channels[channel]["dp"]))
    for source in ("sp30", "all10", "raw"):
        p = joint.sources[source]
        mass = p[:, dp].sum(axis=1, keepdims=True)
        for alpha in (0.25, 0.5, 0.75, 1.0):
            q = p.copy()
            q[:, dp] = (1 - alpha) * p[:, dp] + alpha * mass * native_dp
            yield _meta("native_dp_inside_mass", "Native DP probabilities redistribute only existing DP mass", source=source, alpha=alpha), normalize(q)
    for source in ("raw", "all10"):
        p = joint.sources[source]
        for penalty in (0.25, 0.75, 2.0, 6.0, "hard"):
            gate = joint.gates["native_avoid"]
            q = normalize(p * gate) if penalty == "hard" else softmax(np.log(p) - float(penalty) * ~gate)
            yield _meta("native_avoid_component", "Native avoid-two pair applied to a dedicated source", source=source, penalty=penalty), q

    # All 100 empirical variants use counts excluding the entire forecast day.
    # The prior is the exact absence rate under a uniform panel distribution,
    # so a previously unseen market/window begins with a defined common prior.
    prior = np.asarray(replay.pair_absent).mean(axis=0)[None, :]
    matrix = np.asarray(replay.pair_absent)
    for history in bank.pair_counts:
        for strength in (2.0, 10.0, 30.0, 100.0, 300.0):
            rate = np.clip((bank.pair_counts[history] + strength * prior) /
                           (bank.sample_sizes[history] + strength), 1e-6, 1 - 1e-6)
            likelihood = np.log(rate) @ matrix.T + np.log1p(-rate) @ (1 - matrix).T
            likelihood = _v6._standardize(likelihood)
            winner = rate.argmax(axis=1)
            gate = matrix[:, winner].T.astype(bool)
            variants = {
                "independent": softmax(likelihood),
                "likelihood_tilt": softmax(log_base + likelihood),
                "winning_pair_soft": softmax(log_base - 2.0 * ~gate),
                "winning_pair_hard": normalize(base * gate),
            }
            for mode, p in variants.items():
                yield _meta("empirical_pair_absence", "Date-batched empirical pair absence with uniform-panel Beta shrinkage", history=history, prior_mass=strength, mode=mode), p

    # Distinct trend and counter-trend hypotheses with explicit shrinkage.
    for window in (7, 30, 90):
        recent = joint.histories[f"recent_digits_{window}"]
        for strength in (-2.0, -1.0, 0.5, 1.5):
            yield _meta("antidigit_trend", "Signed recent digit frequency on raw SP and panel evidence", window=window, strength=strength), softmax(np.log(raw) + strength * recent)
    for alpha in (0.1, 0.3, 0.6, 1.0):
        for source in ("raw", "sp30"):
            p = joint.sources[source]
            # Retains each source's within-SP ranking; includes every SP panel.
            sp = replay.kind == "SP"
            q = p.copy()
            q[:, sp] = (1 - alpha) * p[:, sp] + alpha * p[:, sp].sum(axis=1, keepdims=True) / int(sp.sum())
            yield _meta("sp_conditional_shrinkage", "Shrink full 120-panel SP conditional toward uniform while preserving SP mass", source=source, alpha=alpha), normalize(q)
