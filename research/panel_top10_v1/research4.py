"""Deployable Top-10 ranker: walk-forward check + weight export.

The browser only has the selected market plus whatever source markets are
cached, so pooled cross-market features are dropped. Close gets two variants:
  close_live    - uses today's declared Open panel (available before Close)
  close_preopen - no same-day Open inputs (used before Open is declared)
Exported weights are fit on targets dated <= 2026-07-02 so the last 90 days stay
out-of-sample for the production TypeScript replay.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import PANELS, load  # noqa: E402
from research2 import FEATURES, build, fit  # noqa: E402
from research3 import BLOCKS, WINDOWS, bootstrap_diff, ranks  # noqa: E402

HERE = Path(__file__).resolve().parent
FIT_END = "2026-07-02"
L2 = 1e-3
DEPLOY = [f for f in FEATURES if not f.startswith("pool")]
PREOPEN = [f for f in DEPLOY if f not in ("prev_other_ov", "prev_other_cut", "cond_sutta")]
VARIANTS = {"open": [("open", DEPLOY)], "close": [("close_live", DEPLOY), ("close_preopen", PREOPEN)]}


def main():
    by_market = load()
    replay = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    prod = {(r["market"], r["date"]): r for r in replay}
    results, export = {}, {}
    for side in ("open", "close"):
        X, y, meta = build(by_market, side)
        dates = np.array([m[1] for m in meta])
        pk = "prodOpen" if side == "open" else "prodClose"
        for name, fs in VARIANTS[side]:
            cols = [FEATURES.index(f) for f in fs]
            hit = np.full(len(y), np.nan)
            for start, end in BLOCKS:
                tr = dates < start
                te = np.where((dates >= start) & (dates <= end))[0]
                w, mu, sd = fit(X[tr][:, :, cols], y[tr], L2)
                hit[te] = ranks(X[te][:, :, cols], y[te], w, mu, sd) <= 10
            m = np.where(~np.isnan(hit) & np.array([mm in prod for mm in meta]))[0]
            ph = np.array([PANELS[y[k]] in prod[meta[k]][pk][:10] for k in m], dtype=float)
            nh = hit[m]
            blocks = {}
            for start, end in BLOCKS + [(v, "2026-09-30") for v in WINDOWS.values()]:
                bm = (dates[m] >= start) & (dates[m] <= end)
                blocks[f"{start}..{end}"] = {"n": int(bm.sum()), "prod_hits": int(ph[bm].sum()),
                                             "new_hits": int(nh[bm].sum()),
                                             "prod": round(100 * ph[bm].mean(), 2),
                                             "new": round(100 * nh[bm].mean(), 2)}
            lo, hi = bootstrap_diff(dates[m], nh, ph)
            results[name] = {"n": len(m), "prod_top10": round(100 * ph.mean(), 2),
                             "new_top10": round(100 * nh.mean(), 2),
                             "diff_ci95_pp": [round(100 * lo, 2), round(100 * hi, 2)], "blocks": blocks}
            print(name, json.dumps(results[name]), file=sys.stderr, flush=True)
            fm = dates <= FIT_END
            w, mu, sd = fit(X[fm][:, :, cols], y[fm], L2)
            export[name] = {"features": fs, "weights": [round(float(v), 6) for v in w],
                            "mean": [round(float(v), 6) for v in mu], "std": [round(float(v), 6) for v in sd]}
        del X
    (HERE / "results4.json").write_text(json.dumps(results, indent=2) + "\n")
    (HERE / "deploy_weights.json").write_text(json.dumps({"fitThrough": FIT_END, "l2": L2, **export}, indent=2) + "\n")


if __name__ == "__main__":
    main()
