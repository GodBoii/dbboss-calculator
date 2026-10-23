"""Explicit formula and combination variants; no outcome fitting."""
from __future__ import annotations

import numpy as np


def normalize(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values, 1e-15)
    return values / values.sum(axis=1, keepdims=True)


def sources(replay, channel: str, baseline: np.ndarray) -> dict[str, np.ndarray]:
    features = replay.channels[channel]
    logits = features["logits"]
    raw = normalize(np.exp(logits - logits.max(axis=1, keepdims=True)))
    multiplicity = np.array([6 if k == "SP" else 3 if k == "DP" else 1 for k in replay.kind])
    structural = np.broadcast_to(multiplicity / multiplicity.sum(), baseline.shape)
    digit = normalize(np.exp(np.clip(np.log(features["absent"]) @ replay.digits.T, -100, 100)))
    present = normalize(np.exp(np.clip(np.log(features["present_soft"]) @ replay.digits.T, -100, 100)))
    return {"raw": raw, "multiplicity": structural, "digit": digit, "present": present,
            "sutta": normalize(features["sutta"][:, replay.sutta]),
            "conditional": normalize(features["conditional"][:, replay.sutta]),
            "endpoint_mean": np.mean([replay.endpoint_probs(channel, e) for e in ("all10", "sp30", "dp20")], axis=0)}


def candidates(replay, channel: str, baseline: np.ndarray):
    pool = sources(replay, channel, baseline)
    raw = pool["raw"]
    ranks = np.argsort(np.argsort(-raw, axis=1, kind="stable"), axis=1, kind="stable") + 1
    base_ranks = np.argsort(np.argsort(-baseline, axis=1, kind="stable"), axis=1, kind="stable") + 1
    for family in range(10):
        for variant in range(10):
            alpha = (variant + 1) / 11
            if family == 0:
                value = (1-alpha)*baseline + alpha*raw
                description = "Arithmetic production/raw probability pool"
            elif family == 1:
                value = baseline ** (1-alpha) * raw ** alpha
                description = "Geometric production/raw probability pool"
            elif family == 2:
                value = 1 / ((1-alpha)/baseline + alpha/raw)
                description = "Harmonic production/raw probability pool"
            elif family == 3:
                value = ((1-alpha)*np.sqrt(baseline) + alpha*np.sqrt(raw))**2
                description = "Square-root power probability pool"
            elif family == 4:
                value = ((1-alpha)*baseline**2 + alpha*raw**2)**.5
                description = "Quadratic power probability pool"
            elif family == 5:
                value = (1-alpha)/(base_ranks+10) + alpha/(ranks+10)
                description = "Reciprocal rank fusion with offset 10"
            elif family == 6:
                value = baseline * np.clip(raw/baseline, 1/(variant+2), variant+2)
                description = "Clipped raw likelihood-ratio correction"
            elif family == 7:
                value = baseline * (pool["multiplicity"]/baseline)**alpha
                description = "Geometric shrinkage toward panel multiplicity"
            elif family == 8:
                threshold = np.quantile(baseline, alpha, axis=1, keepdims=True)
                value = np.minimum(baseline, threshold) + .1*raw
                description = "Winsorized production probabilities with raw tie resolution"
            else:
                value = baseline * np.exp(np.clip(alpha*(np.log(pool["digit"])-np.log(pool["present"])), -30, 30))
                description = "Contrast between absent-model and present-model soft digit scores"
            yield {"id": f"formula_{family:02d}_{variant:02d}", "family": "formulas", "mechanism": description,
                   "parameter": alpha if family != 6 else variant+2}, normalize(value)
    pairs = [("raw", "sutta"), ("raw", "conditional"), ("raw", "multiplicity"),
             ("raw", "digit"), ("raw", "present"), ("sutta", "digit"),
             ("sutta", "present"), ("conditional", "digit"),
             ("conditional", "present"), ("endpoint_mean", "multiplicity")]
    for pair_index, (left, right) in enumerate(pairs):
        for variant in range(10):
            alpha = (variant+1)/11
            value = .5*baseline + .5*((1-alpha)*pool[left] + alpha*pool[right])
            yield {"id": f"combination_{pair_index:02d}_{variant:02d}", "family": "combinations",
                   "mechanism": f"50% production plus {left}/{right} arithmetic pool", "parameter": alpha}, normalize(value)
