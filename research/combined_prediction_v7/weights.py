"""Outcome-free fusion of five independently selected, frozen specialists.

Each candidate is one joint distribution from which the caller derives all
fixed-budget outputs. This module never reads results or selects specialists.
"""
from __future__ import annotations

from itertools import product
from typing import Any, Iterator

import numpy as np

FLOOR = 1e-15
COMPONENTS = ("top5", "avoid2", "panel10", "sp30", "dp20")


def _normalize(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values, FLOOR)
    return values / values.sum(axis=1, keepdims=True)


def _softmax(scores: np.ndarray) -> np.ndarray:
    return _normalize(np.exp(scores - scores.max(axis=1, keepdims=True)))


def _marginal(p: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    return np.stack([p[:, column.astype(bool)].sum(axis=1)
                     for column in matrix.T], axis=1)


def _metadata(family: str, description: str, **parameters: object) -> dict[str, object]:
    suffix = "/".join(f"{key}={value}" for key, value in parameters.items())
    return {"id": f"{family}/{suffix}", "family": family,
            "parameters": parameters, "description": description}


def candidates(replay: Any, channel: str, specialists: dict[str, np.ndarray]
               ) -> Iterator[tuple[dict[str, object], np.ndarray]]:
    """Yield 733 candidates, plus baseline and 61 optional Jodi controls.

    Required expert arrays have shape (events, 220). Optional ``baseline`` is
    the frozen production panel distribution. Optional ``jodi`` is a separately
    frozen early-selected expert used only for controlled sutta-target variants.
    Inputs are validated and copied
    through normalization; no input array or replay state is mutated.
    """
    if channel not in ("open", "close_pre", "close_known"):
        raise ValueError(f"Unknown channel: {channel!r}")
    rows = len(replay.dates)
    if not rows or len(replay.panels) != 220:
        raise ValueError("Expected nonempty 220-panel replay")
    missing = set(COMPONENTS) - specialists.keys()
    if missing:
        raise ValueError(f"Missing specialist distributions: {sorted(missing)}")
    experts = {}
    optional = tuple(name for name in ('baseline', 'jodi') if name in specialists)
    for name in (*COMPONENTS, *optional):
        value = np.asarray(specialists[name], dtype=np.float64)
        if value.shape != (rows, 220) or not np.isfinite(value).all():
            raise ValueError(f"Invalid specialist shape or nonfinite values: {name}")
        row_mass = value.sum(axis=1)
        if (value < 0).any() or not np.isfinite(row_mass).all() or (row_mass <= 0).any():
            raise ValueError(f"Specialist must have nonnegative positive-mass rows: {name}")
        experts[name] = _normalize(value)
    digits = np.asarray(replay.digits, dtype=float)
    sutta = np.asarray(replay.sutta, dtype=int)
    kinds = np.asarray(replay.kind)
    pair_absent = np.asarray(replay.pair_absent, dtype=bool)
    if (digits.shape != (220, 10) or sutta.shape != (220,)
            or kinds.shape != (220,) or pair_absent.shape != (220, 45)):
        raise ValueError("Invalid replay panel feature dimensions")
    if set(kinds) != {"SP", "DP", "TP"} or ((sutta < 0) | (sutta > 9)).any():
        raise ValueError("Invalid replay panel kinds or sutta indices")
    sutta_matrix = np.eye(10)[sutta]
    target_sutta = _marginal(experts['top5'], sutta_matrix)
    target_digits = np.clip(_marginal(experts['avoid2'], digits), 1e-9, 1 - 1e-9)
    target_pairs = _marginal(experts['avoid2'], pair_absent)
    best_pair = np.argmax(np.round(target_pairs, 12), axis=1)
    pair_gate = pair_absent[:, best_pair].T
    target_pair_mass = np.take_along_axis(target_pairs, best_pair[:, None], axis=1)

    for source in (*COMPONENTS, *optional):
        yield _metadata('specialist_control', 'Unmodified independently selected expert',
                        source=source), experts[source]
    equal = _normalize(sum(experts[name] for name in COMPONENTS))
    yield _metadata('simplex_control', 'Equal arithmetic mixture of all five experts',
                    weights={name: .2 for name in COMPONENTS}), equal
    yield _metadata('geometric_control', 'Equal logarithmic mixture of all five experts',
                    weights={name: .2 for name in COMPONENTS}), _softmax(
                        sum(np.log(experts[name]) for name in COMPONENTS) / 5)

    cached_key: tuple[int, float, float, int] | None = None
    cached_terms: tuple[np.ndarray, np.ndarray, np.ndarray] | None = None

    def fuse(base: np.ndarray, sp_weight: float, dp_weight: float,
             sutta_weight: float, avoid_weight: float,
             effective_sutta: np.ndarray | None = None) -> np.ndarray:
        nonlocal cached_key, cached_terms
        effective_sutta = target_sutta if effective_sutta is None else effective_sutta
        key = (id(base), sp_weight, dp_weight, id(effective_sutta))
        if key == cached_key and cached_terms is not None:
            log_q, sutta_term, avoid_term = cached_terms
            return _softmax(log_q + sutta_weight * sutta_term + avoid_weight * avoid_term)
        q = base.copy()
        # Conditional replacement preserves each kind's total probability mass.
        # SP and DP specialists can therefore affect their own rankings separately.
        for kind, source, weight in (("SP", "sp30", sp_weight), ("DP", "dp20", dp_weight)):
            mask = kinds == kind
            current = q[:, mask]
            mass = current.sum(axis=1, keepdims=True)
            target = experts[source][:, mask]
            q[:, mask] = (1 - weight) * current + weight * mass * target / target.sum(axis=1, keepdims=True)
        log_q = np.log(q)
        current_sutta = _marginal(q, sutta_matrix)
        sutta_term = np.log(effective_sutta / np.maximum(current_sutta, FLOOR))[:, sutta]
        current_digits = np.clip(_marginal(q, digits), 1e-9, 1 - 1e-9)
        present = np.log(target_digits / current_digits)
        absent = np.log((1 - target_digits) / (1 - current_digits))
        # Ten Bernoulli marginal likelihood ratios, plus the expert's most
        # likely absent pair. Soft corrections retain every panel as eligible.
        digit_term = sum(present[:, d, None] * digits[None, :, d]
                         + absent[:, d, None] * (1 - digits[None, :, d])
                         for d in range(10)) / 10
        current_pair_mass = (q * pair_gate).sum(axis=1, keepdims=True)
        pair_yes = np.log(np.maximum(target_pair_mass, FLOOR) / np.maximum(current_pair_mass, FLOOR))
        pair_no = np.log(np.maximum(1 - target_pair_mass, FLOOR) / np.maximum(1 - current_pair_mass, FLOOR))
        avoid_term = (digit_term + pair_yes * pair_gate + pair_no * ~pair_gate) / 2
        cached_key, cached_terms = key, (log_q, sutta_term, avoid_term)
        return _softmax(log_q + sutta_weight * sutta_term + avoid_weight * avoid_term)

    mixtures = ((1., 0., 0.), (.6, .2, .2), (.2, .6, .2), (.2, .2, .6))
    for panel_weight, sp_mix, dp_mix in mixtures:
        base = _normalize(panel_weight * experts['panel10']
                          + sp_mix * experts['sp30'] + dp_mix * experts['dp20'])
        for sp_weight, dp_weight, sutta_weight, avoid_weight in product(
                (0., .5, 1.), (0., .5, 1.), (0., .25, .5, 1., 2.), (0., .25, .5, 1.)):
            parameters = dict(panel10_weight=panel_weight, sp30_mixture_weight=sp_mix,
                              dp20_mixture_weight=dp_mix, sp30_conditional_weight=sp_weight,
                              dp20_conditional_weight=dp_weight, top5_weight=sutta_weight,
                              avoid2_weight=avoid_weight)
            yield _metadata('five_component_fusion',
                            'Panel simplex with independent SP/DP conditional and sutta/digit/pair marginal corrections',
                            **parameters), fuse(base, sp_weight, dp_weight, sutta_weight, avoid_weight)

    # Matched leave-one-component-out controls remove every contribution of the
    # omitted expert, including its mixture contribution where applicable.
    for omitted in (*COMPONENTS, 'none'):
        weights = {name: (0. if name == omitted else 1 / 3)
                   for name in ('panel10', 'sp30', 'dp20')}
        total = sum(weights.values())
        weights = {name: value / total for name, value in weights.items()}
        base = _normalize(sum(weights[name] * experts[name] for name in weights))
        sw, dw = (0. if omitted == 'sp30' else .5), (0. if omitted == 'dp20' else .5)
        tw, aw = (0. if omitted == 'top5' else .5), (0. if omitted == 'avoid2' else .5)
        yield _metadata('component_ablation', 'Matched removal of every use of one specialist',
                        omitted=omitted, mixture_weights=weights,
                        sp30_conditional_weight=sw, dp20_conditional_weight=dw,
                        top5_weight=tw, avoid2_weight=aw), fuse(base, sw, dw, tw, aw)

    if 'jodi' in experts:
        jodi_sutta = _marginal(experts['jodi'], sutta_matrix)
        base = _normalize((experts['panel10'] + experts['sp30'] + experts['dp20']) / 3)
        for jodi_fraction in (.25, .5, 1.):
            effective = _normalize((1 - jodi_fraction) * target_sutta + jodi_fraction * jodi_sutta)
            for sutta_weight, avoid_weight in product((0., .25, .5, 1., 2.), (0., .25, .5, 1.)):
                yield _metadata('jodi_sutta_fusion',
                                'Frozen early-selected Jodi expert blended with Top5 sutta marginal',
                                panel10_weight=1 / 3, sp30_mixture_weight=1 / 3,
                                dp20_mixture_weight=1 / 3, sp30_conditional_weight=.5,
                                dp20_conditional_weight=.5, top5_weight=sutta_weight,
                                avoid2_weight=avoid_weight, jodi_sutta_fraction=jodi_fraction), fuse(
                                    base, .5, .5, sutta_weight, avoid_weight, effective)
