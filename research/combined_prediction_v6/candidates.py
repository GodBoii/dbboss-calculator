"""Joint panel/sutta/avoid research candidates, streamed at fixed output budgets.

These are parameterized hypotheses, not independent discoveries. Historical
features are market-local and updated only after all forecasts on a date.
Native model features are supplied pre-forecast by the frozen replay exporter.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterator

import numpy as np


FLOOR = 1e-15


def normalize(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values, FLOOR)
    return values / values.sum(axis=1, keepdims=True)


def softmax(values: np.ndarray) -> np.ndarray:
    return normalize(np.exp(values - values.max(axis=1, keepdims=True)))


def _standardize(values: np.ndarray) -> np.ndarray:
    centered = values - values.mean(axis=1, keepdims=True)
    return np.clip(centered / np.maximum(values.std(axis=1, keepdims=True), 1e-6), -4, 4)


def _marginal(p: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    # Small feature matrices avoid a dependency on threaded BLAS configuration.
    return np.stack([p[:, column.astype(bool)].sum(axis=1) for column in matrix.T], axis=1)


@dataclass(frozen=True)
class JointBank:
    channel: str
    rows: int
    sources: dict[str, np.ndarray]
    sutta_targets: dict[str, np.ndarray]
    digit_targets: dict[str, np.ndarray]
    gates: dict[str, np.ndarray]
    histories: dict[str, np.ndarray]
    symmetries: dict[str, np.ndarray]


def _history(replay: Any, channel: str) -> dict[str, np.ndarray]:
    actual = np.asarray(replay.actual(channel), dtype=int)
    n = len(actual)
    digits, sutta = np.asarray(replay.digits), np.asarray(replay.sutta)
    names = ["last_digits", "last_sutta"] + [
        f"{feature}_{window}" for feature in ("recent_digits", "recent_sutta", "overdue_digits", "overdue_sutta")
        for window in (7, 30, 90)
    ]
    output = {name: np.zeros((n, 220), dtype=np.float32) for name in names}
    history: dict[str, list[int]] = {}
    for day in np.unique(replay.dates):
        today = np.flatnonzero(replay.dates == day)
        for row in today:
            past = history.get(str(replay.markets[row]), [])
            if not past:
                continue
            last = past[-1]
            output["last_digits"][row] = digits @ digits[last]
            output["last_sutta"][row] = sutta == sutta[last]
            for window in (7, 30, 90):
                values = np.asarray(past[-window:], dtype=int)
                d = digits[values].mean(axis=0)
                s = np.bincount(sutta[values], minlength=10) / len(values)
                dg, sg = np.full(10, len(values) + 1.0), np.full(10, len(values) + 1.0)
                for lag, observed in enumerate(values[::-1], 1):
                    dg[(digits[observed] > 0) & (dg == len(values) + 1)] = lag
                    if sg[sutta[observed]] == len(values) + 1:
                        sg[sutta[observed]] = lag
                output[f"recent_digits_{window}"][row] = digits @ d
                output[f"recent_sutta_{window}"][row] = s[sutta]
                output[f"overdue_digits_{window}"][row] = digits @ np.log1p(dg)
                output[f"overdue_sutta_{window}"][row] = np.log1p(sg)[sutta]
        for row in today:
            history.setdefault(str(replay.markets[row]), []).append(int(actual[row]))
    return {name: _standardize(values) for name, values in output.items()}


def build_bank(replay: Any, channel: str) -> JointBank:
    """Cache reusable sources without consulting forecast-date outcomes."""
    if channel not in ("open", "close_pre", "close_known"):
        raise ValueError(f"Unknown channel {channel!r}")
    n = len(replay.dates)
    if n == 0 or len(replay.panels) != 220:
        raise ValueError("Expected nonempty 220-panel replay")
    if list(replay.dates) != sorted(replay.dates):
        raise ValueError("History requires date-sorted observations")
    if len(set(zip(replay.dates, replay.markets))) != n:
        raise ValueError("Duplicate market/date observation")
    features = replay.channels[channel]
    sources = {name: normalize(replay.endpoint_probs(channel, name)) for name in ("sp30", "all10", "dp20")}
    sources["raw"] = softmax(features["logits"])
    for name, p in sources.items():
        if p.shape != (n, 220) or not np.isfinite(p).all():
            raise ValueError(f"Invalid panel source {name}")
    sutta_targets = {"native": normalize(features["sutta"]), "conditional": normalize(features["conditional"])}
    sutta_targets["panel"] = _marginal(sources["sp30"], replay.sutta_matrix)
    digit_targets = {
        "appearance": np.clip(features["absent"], 1e-6, 1 - 1e-6),
        "present": np.clip(features["present_soft"], 1e-6, 1 - 1e-6),
    }
    digit_targets["blend"] = (digit_targets["appearance"] + digit_targets["present"]) / 2
    gates = {"native_avoid": features["avoid_count"] == 0}
    pair_scores = _marginal(sources["sp30"], replay.pair_absent)
    gates["panel_avoid"] = replay.pair_absent[:, pair_scores.argmax(axis=1)].T.astype(bool)
    for name, target in sutta_targets.items():
        order = np.argsort(-target, axis=1, kind="stable")[:, :5]
        gates[f"sutta_{name}"] = (order[:, :, None] == replay.sutta[None, None, :]).any(axis=1)
    lookup = {tuple(sorted(map(int, panel))): i for i, panel in enumerate(replay.panels)}
    transforms = {
        "mirror5": lambda d: (d + 5) % 10,
        "complement9": lambda d: 9 - d,
        "rotate1": lambda d: (d + 1) % 10,
        "rotate3": lambda d: (d + 3) % 10,
        "multiply3": lambda d: (3 * d) % 10,
    }
    symmetries = {}
    for name, transform in transforms.items():
        indices = np.array([lookup[tuple(sorted(transform(int(d)) for d in panel))] for panel in replay.panels])
        # All transforms are bijective digit permutations. Inverse pushforward.
        symmetries[name] = sources["sp30"][:, np.argsort(indices)]
    return JointBank(channel, n, sources, sutta_targets, digit_targets, gates, _history(replay, channel), symmetries)


def _metadata(family: str, description: str, **parameters: object) -> dict[str, object]:
    suffix = "/".join(f"{key}={value}" for key, value in parameters.items())
    return {"id": f"{family}/{suffix}", "family": family, "parameters": parameters, "description": description}


def _ipf(p: np.ndarray, sutta_target: np.ndarray, digit_target: np.ndarray,
         replay: Any, passes: int, damping: float) -> np.ndarray:
    """Damped alternating projections; finite passes do not imply exact feasibility."""
    q = p.copy()
    for _ in range(passes):
        current = _marginal(q, replay.sutta_matrix)
        q = normalize(q * (sutta_target / np.maximum(current, FLOOR))[:, replay.sutta] ** damping)
        # A Bernoulli I-projection per digit accounts for presence AND absence.
        for digit in range(10):
            present = replay.digits[:, digit].astype(bool)
            mass = q[:, present].sum(axis=1)
            target = digit_target[:, digit]
            q[:, present] *= (target / np.maximum(mass, FLOOR))[:, None] ** damping
            q[:, ~present] *= ((1 - target) / np.maximum(1 - mass, FLOOR))[:, None] ** damping
            q = normalize(q)
    return q


def candidates(replay: Any, channel: str, bank: JointBank | None = None
               ) -> Iterator[tuple[dict[str, object], np.ndarray]]:
    """Stream positive distributions; caller derives every output from the same q."""
    bank = build_bank(replay, channel) if bank is None else bank
    if bank.channel != channel or bank.rows != len(replay.dates):
        raise ValueError("Bank/replay channel or shape mismatch")
    base = bank.sources["sp30"]
    log_base = np.log(base)
    strengths = (-1.0, -0.5, 0.25, 0.5, 1.0, 2.0)
    for source in ("all10", "dp20", "raw"):
        other = bank.sources[source]
        for alpha in (0.15, 0.35, 0.65, 1.0):
            for mode in ("arithmetic", "geometric"):
                p = normalize((1 - alpha) * base + alpha * other) if mode == "arithmetic" else softmax((1 - alpha) * log_base + alpha * np.log(other))
                yield _metadata("source_fusion", "Fuse panel endpoints before deriving joint outputs", source=source, alpha=alpha, mode=mode), p
    sutta_terms = {}
    current_sutta = bank.sutta_targets["panel"]
    for source, target in bank.sutta_targets.items():
        # panel target would be an identity replacement, so flatten/sharpen instead.
        effective = normalize(target ** 0.5) if source == "panel" else target
        term = np.log(effective / np.maximum(current_sutta, FLOOR))[:, replay.sutta]
        sutta_terms[source] = term
        for strength in strengths:
            yield _metadata("sutta_marginal", "Replace or counter-tilt sutta marginal while preserving within-sutta ranking", source=source, strength=strength), softmax(log_base + strength * term)
    digit_terms = {}
    for source, target in bank.digit_targets.items():
        # Full likelihood includes the negative evidence of every absent digit.
        likelihood = np.log(target) @ replay.digits.T + np.log1p(-target) @ (1 - replay.digits).T
        digit_terms[source] = _standardize(likelihood)
        for strength in strengths:
            yield _metadata("bernoulli_digits", "Presence and absence likelihood across all ten digits", source=source, strength=strength), softmax(log_base + strength * digit_terms[source])
    for name, gate in bank.gates.items():
        family = "avoid2_gate" if name.endswith("avoid") else "top5_sutta_gate"
        for penalty in (0.15, 0.35, 0.65, 0.9, 1.5, 3.0, 12.0):
            yield _metadata(family, "Soft exclusion; penalty 12 approximates hard restriction with positive floor", source=name, penalty=penalty), softmax(log_base - penalty * ~gate)
        yield _metadata(family, "Hard restriction with tiny positive floor outside gate", source=name, penalty="hard"), normalize(base * gate)
    for sutta_source in bank.sutta_targets:
        sg = bank.gates[f"sutta_{sutta_source}"]
        for avoid_source in ("native_avoid", "panel_avoid"):
            ag = bank.gates[avoid_source]
            for sutta_penalty in (0.35, 1.0, 3.0, 12.0):
                for avoid_penalty in (0.35, 1.0, 3.0, 12.0):
                    yield _metadata("joint_gates", "Joint Top5Sutta and avoid-two compatibility before panel ranking", sutta=sutta_source, avoid=avoid_source, sutta_penalty=sutta_penalty, avoid_penalty=avoid_penalty), softmax(log_base - sutta_penalty * ~sg - avoid_penalty * ~ag)
            yield _metadata("joint_gates", "Hard joint intersection with positive outside floor", sutta=sutta_source, avoid=avoid_source, restriction="hard"), normalize(base * sg * ag)
    for sutta_source in sutta_terms:
        for digit_source in digit_terms:
            for strength in (0.25, 0.75, 1.5):
                yield _metadata("joint_likelihood", "Couple sutta evidence with full Bernoulli digit evidence", sutta=sutta_source, digits=digit_source, strength=strength), softmax(log_base + strength * (sutta_terms[sutta_source] + digit_terms[digit_source]))
    for mechanism, score in bank.histories.items():
        for strength in strengths:
            yield _metadata("causal_history", "Signed market-local repeat, frequency, or overdue hypothesis using prior dates only", mechanism=mechanism, strength=strength), softmax(log_base + strength * score)
    for transform, prior in bank.symmetries.items():
        for alpha in (0.1, 0.25, 0.5, 0.75, 1.0):
            yield _metadata("digit_symmetry", "Digit permutation pushforward prior mixed with baseline", transform=transform, alpha=alpha), normalize((1 - alpha) * base + alpha * prior)
    for sutta_source in ("native", "conditional", "panel"):
        for digit_source in ("appearance", "present"):
            for damping in (0.35, 0.75, 1.0):
                for passes in (1, 3):
                    yield _metadata("joint_ipf", "Damped alternating sutta and digit Bernoulli marginal projections; finite-pass compromise", sutta=sutta_source, digits=digit_source, damping=damping, passes=passes), _ipf(base, bank.sutta_targets[sutta_source], bank.digit_targets[digit_source], replay, passes, damping)
    priors = {
        "uniform_panels": np.full_like(base, 1 / 220),
        "uniform_sutta": normalize(base / current_sutta[:, replay.sutta]),
        "native_sutta": normalize(bank.sutta_targets["native"][:, replay.sutta]),
        "bernoulli": softmax(digit_terms["blend"]),
        "joint_evidence": softmax(sutta_terms["native"] + digit_terms["blend"]),
        "joint_gate": normalize(base * bank.gates["sutta_native"] * bank.gates["native_avoid"]),
    }
    for source, prior in priors.items():
        for alpha in (0.05, 0.15, 0.3, 0.5, 0.75, 1.0):
            yield _metadata("probability_mixture", "Mix full panel distributions before jointly deriving outputs", source=source, alpha=alpha), normalize((1 - alpha) * base + alpha * prior)
    for temperature in (0.4, 0.6, 0.8, 0.95, 1.05, 1.25, 1.6, 2.5):
        yield _metadata("temperature_control", "Calibration control; panel ranking is invariant and this is not an independent predictive theory", temperature=temperature), softmax(log_base / temperature)
