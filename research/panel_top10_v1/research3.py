"""Walk-forward yearly confirmation of the v2 feature ranker against production.

For each test block the model is refit only on targets dated before the block.
Blocks: 2024-04-01..2024-12-31, 2025, 2026-01-01..2026-09-30. Production replay
exists from 2024-04-01, so every block is a paired comparison on identical events.
Ties are broken by expected rank (no credit for tied scores).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import PANELS, load  # noqa: E402
from research2 import FEATURES, build, fit  # noqa: E402

HERE = Path(__file__).resolve().parent
BLOCKS = [("2024-04-01", "2024-12-31"), ("2025-01-01", "2025-12-31"), ("2026-01-01", "2026-09-30")]
WINDOWS = {"7d": "2026-09-24", "30d": "2026-09-01", "90d": "2026-07-03"}
SETS = {
    "all": FEATURES,
    "kind_freq_pool_geo": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3",
                           "gap10", "pool365", "pool30", "pool_y", "digit", "pair", "sum_share"],
}
L2 = 1e-3


def ranks(X, y, w, mu, sd):
    s = ((X - mu) / sd) @ w
    act = s[np.arange(len(y)), y]
    greater = (s > act[:, None] + 1e-9).sum(1)
    equal = (np.abs(s - act[:, None]) <= 1e-9).sum(1)
    return greater + 1 + (equal - 1) / 2.0


def bootstrap_diff(dates, a, b, reps=2000, seed=7):
    rng = np.random.default_rng(seed)
    uniq = np.unique(dates)
    idx = {d: np.where(dates == d)[0] for d in uniq}
    diffs = []
    for _ in range(reps):
        pick = rng.choice(uniq, len(uniq))
        sel = np.concatenate([idx[d] for d in pick])
        diffs.append(a[sel].mean() - b[sel].mean())
    return float(np.percentile(diffs, 2.5)), float(np.percentile(diffs, 97.5))


def main():
    by_market = load()
    replay = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    prod = {(r["market"], r["date"]): r for r in replay}
    results = {}
    for side in ("open", "close"):
        X, y, meta = build(by_market, side)
        dates = np.array([m[1] for m in meta])
        pk = "prodOpen" if side == "open" else "prodClose"
        side_res = {}
        for set_name, fs in SETS.items():
            cols = [FEATURES.index(f) for f in fs]
            new_hit = np.full(len(y), np.nan)
            for start, end in BLOCKS:
                tr = dates < start
                te = np.where((dates >= start) & (dates <= end))[0]
                w, mu, sd = fit(X[tr][:, :, cols], y[tr], L2)
                new_hit[te] = ranks(X[te][:, :, cols], y[te], w, mu, sd) <= 10
            m = np.where(~np.isnan(new_hit) & np.array([mm in prod for mm in meta]))[0]
            ph = np.array([PANELS[y[k]] in prod[meta[k]][pk][:10] for k in m], dtype=float)
            nh = new_hit[m]
            sp_unif = np.array([len(set(PANELS[y[k]])) == 3 for k in m], dtype=float) * 10 / 120
            blocks = {}
            for start, end in BLOCKS + [(v, "2026-09-30") for v in WINDOWS.values()]:
                bm = (dates[m] >= start) & (dates[m] <= end)
                blocks[f"{start}..{end}"] = {
                    "n": int(bm.sum()), "prod": round(100 * ph[bm].mean(), 2),
                    "new": round(100 * nh[bm].mean(), 2), "sp_uniform": round(100 * sp_unif[bm].mean(), 2),
                }
            lo, hi = bootstrap_diff(dates[m], nh, ph)
            side_res[set_name] = {
                "n": len(m), "prod_top10": round(100 * ph.mean(), 2), "new_top10": round(100 * nh.mean(), 2),
                "sp_uniform_top10": round(100 * sp_unif.mean(), 2), "diff_ci95_pp": [round(100 * lo, 2), round(100 * hi, 2)],
                "blocks": blocks,
            }
            print(side, set_name, json.dumps(side_res[set_name], indent=1), file=sys.stderr, flush=True)
        results[side] = side_res
        del X
    (HERE / "results3.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
