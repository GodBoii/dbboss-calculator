"""Freeze the selected DP ranking model (pooled, open-aware, l2=3000).

Fit only on DP cases dated before TEST_START so the last-90-day production
backtest stays out-of-sample. Writes model-weights.json for the TS module.
"""

import json
import pickle
from pathlib import Path

import research as R
from rolling import stack

HERE = Path(__file__).resolve().parent
cases = pickle.loads((HERE / "cases.pkl").read_bytes())
train = [c for c in cases if c["date"] < R.TEST_START]
X, y = stack(train, "aware", R.FEATURES)
mu, sd = R.standardize_stats(X)
w = R.fit_clogit((X - mu) / sd, y, 3000.0)
out = {
    "id": "dp-panel-clogit-v3",
    "trainedThrough": max(c["date"] for c in train),
    "trainCases": len(train),
    "features": R.FEATURES,
    "mean": [round(float(v), 6) for v in mu],
    "std": [round(float(v), 6) for v in sd],
    "weights": [round(float(v), 6) for v in w],
}
(HERE / "model-weights.json").write_text(json.dumps(out, indent=1))
for f, a in zip(R.FEATURES, w):
    print(f"{f:14s} {a:+.4f}")
