"""Rolling expanding-window validation of DP ranking candidates.

For each quarter block from 2024-07 to the end, fit on every DP case dated
before the block (from 2023-01-01) and score the block. Candidates that only
win in one window are noise; we want consistent lift across blocks.

Run after research.py: python research/dp_panel_v3/rolling.py
"""

from __future__ import annotations

import pickle
from datetime import date
from pathlib import Path

import numpy as np

import research as R

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cases.pkl"

BLOCKS = [
    ("2024-07-01", "2024-09-30"), ("2024-10-01", "2024-12-31"),
    ("2025-01-01", "2025-03-31"), ("2025-04-01", "2025-06-30"),
    ("2025-07-01", "2025-09-30"), ("2025-10-01", "2025-12-31"),
    ("2026-01-01", "2026-03-31"), ("2026-04-01", "2026-07-03"),
    ("2026-07-04", "2026-10-01"),   # = TEST (last 90 days)
]

CANDIDATES = {
    # name: (feature list, design key per side, pooled?, l2)
    "global_freq_nofit": None,
    "pooled_freq_l300": (["ms_all", "mb_all", "gs_all", "ga_all"], "pre", True, 300.0),
    "pooled_pre_l300": (R.PRE_OPEN, "pre", True, 300.0),
    "pooled_pre_l3000": (R.PRE_OPEN, "pre", True, 3000.0),
    "side_pre_l3000": (R.PRE_OPEN, "pre", False, 3000.0),
    "pooled_aware_l3000": (R.FEATURES, "aware", True, 3000.0),
    "side_aware_l3000": (R.FEATURES, "aware", False, 3000.0),
}


def design(c, key):
    if key == "aware" and c["side"] == "close":
        return c["X_aware"]
    return c["X_pre"]  # open cases have zero open_* columns


def stack(cases, key, feats):
    idx = [R.FEATURES.index(f) for f in feats]
    X = np.stack([design(c, key) for c in cases])[:, :, idx].astype(np.float64)
    y = np.array([c["y"] for c in cases])
    return X, y


def main():
    if CACHE.exists():
        cases = pickle.loads(CACHE.read_bytes())
    else:
        cases = R.build_cases(R.load_rows())
        CACHE.write_bytes(pickle.dumps(cases))
    print(f"cases={len(cases)}")
    gi = R.FEATURES.index("ga_all")
    table = {}
    for name, cfg in CANDIDATES.items():
        for side in ("open", "close"):
            per_block = []
            for b0, b1 in BLOCKS:
                blk = [c for c in cases if b0 <= c["date"] <= b1 and c["side"] == side]
                if cfg is None:
                    X = np.stack([c["X_pre"] for c in blk])[:, :, gi].astype(np.float64)
                    y = np.array([c["y"] for c in blk])
                    per_block.append(R.metrics(X, y))
                    continue
                feats, key, pooled, l2 = cfg
                train = [c for c in cases if c["date"] < b0 and (pooled or c["side"] == side)]
                Xf, yf = stack(train, key, feats)
                mu, sd = R.standardize_stats(Xf)
                w = R.fit_clogit((Xf - mu) / sd, yf, l2)
                Xb, yb = stack(blk, key, feats)
                per_block.append(R.metrics(((Xb - mu) / sd) @ w, yb))
            table[(name, side)] = per_block
            t30 = [r["top30"] for r in per_block]
            t10 = [r["top10"] for r in per_block]
            ns = [r["n"] for r in per_block]
            wavg = lambda v: sum(a * n for a, n in zip(v[:-1], ns[:-1])) / sum(ns[:-1])
            print(f"{name:20s} {side:5s} top30 blocks=" + " ".join(f"{x:.2f}" for x in t30)
                  + f" | pre-test avg30={wavg(t30):.3f} avg10={wavg(t10):.3f} "
                  + f"wins30={sum(x > 1/3 for x in t30[:-1])}/{len(t30)-1} | TEST30={t30[-1]:.3f} TEST10={t10[-1]:.3f}")
    pickle.dump(table, open(HERE / "rolling-table.pkl", "wb"))


if __name__ == "__main__":
    main()
