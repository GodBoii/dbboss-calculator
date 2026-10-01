"""Close-side stack: deployable features + current production Close rank features.

Production ranks exist from 2024-04-01, so walk-forward blocks are 2025 (fit on
2024-04..2024-12) and 2026-01..2026-09 (fit on 2024-04..2025-12).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import NP, PANELS, PIDX, load  # noqa: E402
from research2 import FEATURES, build, fit  # noqa: E402
from research3 import WINDOWS, bootstrap_diff, ranks  # noqa: E402
from research4 import DEPLOY, PREOPEN  # noqa: E402

HERE = Path(__file__).resolve().parent
BLOCKS = [("2025-01-01", "2025-12-31"), ("2026-01-01", "2026-09-30")]
FIT_END = "2026-07-02"


def prod_features(plist):
    rank = np.zeros(NP, dtype=np.float32)
    for r, p in enumerate(plist):
        rank[PIDX[p]] = r + 1
    return np.stack([((rank > 0) & (rank <= 10)), np.where(rank > 0, 1.0 / np.maximum(rank, 1), 0.0),
                     rank > 0], 1).astype(np.float32)


def main():
    by_market = load()
    replay = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    prod = {(r["market"], r["date"]): r for r in replay}
    out, export = {}, {}
    for side, pk, variants in (("close", "prodClose", (("close_live", DEPLOY), ("close_preopen", PREOPEN))),
                               ("open", "prodOpen", (("open", DEPLOY),))):
        X, y, meta = build(by_market, side)
        keep = np.array([m in prod for m in meta])
        X, y = X[keep], y[keep]
        meta = [m for m, k in zip(meta, keep) if k]
        P = np.stack([prod_features(prod[m][pk]) for m in meta])
        dates = np.array([m[1] for m in meta])
        ph = np.array([PANELS[y[k]] in prod[meta[k]][pk][:10] for k in range(len(y))], dtype=float)
        for name, fs in variants:
            cols = [FEATURES.index(f) for f in fs]
            XS = np.concatenate([X[:, :, cols], P], axis=2)
            hit = np.full(len(y), np.nan)
            for start, end in BLOCKS:
                tr = dates < start
                te = np.where((dates >= start) & (dates <= end))[0]
                w, mu, sd = fit(XS[tr], y[tr], 1e-3)
                hit[te] = ranks(XS[te], y[te], w, mu, sd) <= 10
            m = ~np.isnan(hit)
            res = {"n": int(m.sum()), "prod": round(100 * ph[m].mean(), 2), "new": round(100 * hit[m].mean(), 2)}
            lo, hi = bootstrap_diff(dates[m], hit[m], ph[m])
            res["diff_ci95_pp"] = [round(100 * lo, 2), round(100 * hi, 2)]
            for start, end in BLOCKS + [(v, "2026-09-30") for v in WINDOWS.values()]:
                bm = m & (dates >= start) & (dates <= end)
                res[f"{start}..{end}"] = (int(ph[bm].sum()), int(hit[bm].sum()), int(bm.sum()))
            out[f"{name}+prod"] = res
            print(name, "+prod", json.dumps(res), file=sys.stderr, flush=True)
            fm = dates <= FIT_END
            w, mu, sd = fit(XS[fm], y[fm], 1e-3)
            export[f"{name}+prod"] = {"features": fs + ["prod10", "prod_inv", "prod40"],
                                      "weights": [round(float(v), 6) for v in w],
                                      "mean": [round(float(v), 6) for v in mu],
                                      "std": [round(float(v), 6) for v in sd]}
        del X, XS
    (HERE / "results5.json").write_text(json.dumps(out, indent=2) + "\n")
    (HERE / "deploy_weights_stack.json").write_text(json.dumps(export, indent=2) + "\n")


if __name__ == "__main__":
    main()
