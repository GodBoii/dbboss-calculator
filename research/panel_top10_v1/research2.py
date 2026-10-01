"""Top-10 panel research v2: long-history feature ranker (no production-rank inputs).

Targets 2022-01-01 .. 2026-09-30, every target uses only same-market rows from the
28 calendar months before its date (pooled features use all markets, dates < target).

  train      2022-01-01 .. 2025-12-31
  validation 2026-01-01 .. 2026-07-02   (model choice by log-likelihood and Top-10)
  holdout    2026-07-03 .. 2026-09-30   (refit on <= 2026-07-02; never used for choice)
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import (  # noqa: E402
    NP, P_DIGITS, P_DIGITSET, P_KIND, P_SEQ, P_SUTTA, PANELS, PIDX, cutoff, load,
)

HERE = Path(__file__).resolve().parent
START = "2022-01-01"
TRAIN_END = "2025-12-31"
VALID_END = "2026-07-02"
END = "2026-09-30"
WINDOWS = {"7d": "2026-09-24", "30d": "2026-09-01", "90d": "2026-07-03"}

P_SORTED = np.sort(P_DIGITS, axis=1)
P_PAIR_A = np.stack([P_SORTED[:, 0], P_SORTED[:, 0], P_SORTED[:, 1]], 1)
P_PAIR_B = np.stack([P_SORTED[:, 1], P_SORTED[:, 2], P_SORTED[:, 2]], 1)
P_SUM = P_DIGITS.sum(1)
P_CUTSET = np.zeros_like(P_DIGITSET)
for _i, _p in enumerate(PANELS):
    for _c in set(_p):
        P_CUTSET[_i, (int(_c) + 5) % 10] = 1

FEATURES = [
    "dp", "tp", "seq", "kind_share",
    "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
    "pool365", "pool30", "pool_y",
    "digit", "pair", "sum_share",
    "sutta", "sutta_gap", "wd_sutta", "wd_cnt",
    "prev_same_ov", "prev_other_ov", "prev_same_cut", "prev_other_cut", "cond_sutta",
]


def build(by_market, only_side):
    all_dates = sorted({d for v in by_market.values() for d, _, _ in v})
    dpos = {d: i for i, d in enumerate(all_dates)}
    daily = np.zeros((len(all_dates) + 1, NP), dtype=np.float32)
    for v in by_market.values():
        for d, o, c in v:
            daily[dpos[d] + 1, o] += 1
            daily[dpos[d] + 1, c] += 1
    cum = np.cumsum(daily, axis=0)
    date_arr = np.array(all_dates)

    def pooled(target: str, days: int) -> np.ndarray:
        start = (date.fromisoformat(target) - timedelta(days=days)).isoformat()
        a = np.searchsorted(date_arr, start)
        b = np.searchsorted(date_arr, target)
        return cum[b] - cum[a]

    out = {"open": ([], [], []), "close": ([], [], [])}
    for market, rows in by_market.items():
        dates = np.array([r[0] for r in rows])
        oidx = np.array([r[1] for r in rows])
        cidx = np.array([r[2] for r in rows])
        wdays = np.array([date.fromisoformat(d).weekday() for d in dates])
        for i, (t, o_act, c_act) in enumerate(rows):
            if t < START or t > END:
                continue
            s = int(np.searchsorted(dates, cutoff(t)))
            n = i - s
            if n < 50:
                continue
            wd = wdays[i]
            p365, p30, p1 = pooled(t, 365), pooled(t, 30), pooled(t, 1)
            for side in (only_side,):
                own = oidx if side == "open" else cidx
                oth = cidx if side == "open" else oidx
                h, ho = own[s:i], oth[s:i]
                cnt = np.bincount(h, minlength=NP).astype(np.float32)
                cnt120 = np.bincount(h[-120:], minlength=NP).astype(np.float32)
                cnt_o = np.bincount(ho, minlength=NP).astype(np.float32)
                last = np.full(NP, -1)
                np.maximum.at(last, h, np.arange(n))
                gap = np.where(last >= 0, n - 1 - last, n + 1).astype(np.float32)
                kinds = np.bincount(P_KIND[h], minlength=3).astype(np.float32)
                kind_share = np.log((kinds[P_KIND] + 1) / (n + 3))
                dig = np.bincount(P_DIGITS[h].ravel(), minlength=10).astype(np.float32)
                digit_f = np.log((dig + 1) / (dig.sum() + 10))[P_DIGITS].sum(1)
                pm = np.zeros((10, 10), dtype=np.float32)
                np.add.at(pm, (P_PAIR_A[h].ravel(), P_PAIR_B[h].ravel()), 1)
                pair_f = np.log((pm[P_PAIR_A, P_PAIR_B] + 0.5) / (3 * n + 27.5)).sum(1)
                sums = np.bincount(P_SUM[h], minlength=28).astype(np.float32)
                sum_f = np.log((sums + 1) / (n + 28))[P_SUM]
                hs = P_SUTTA[h]
                sc = np.bincount(hs, minlength=10).astype(np.float32)
                sutta_f = np.log((sc + 1) / (n + 10))[P_SUTTA]
                slast = np.full(10, -1)
                np.maximum.at(slast, hs, np.arange(n))
                sgap = np.where(slast >= 0, n - 1 - slast, n + 1)[P_SUTTA].astype(np.float32)
                wmask = wdays[s:i] == wd
                wsc = np.bincount(hs[wmask], minlength=10).astype(np.float32)
                wd_f = np.log((wsc + 1) / (wsc.sum() + 10))[P_SUTTA]
                wd_cnt = np.bincount(h[wmask], minlength=NP).astype(np.float32)
                prev_same = h[-1]
                if side == "open":
                    prev_other = cidx[i - 1]
                    cond_src, cond_tgt, cond_now = P_SUTTA[cidx[s:i - 1]], P_SUTTA[oidx[s + 1:i]], P_SUTTA[cidx[i - 1]]
                else:
                    prev_other = o_act  # today's Open is declared before Close
                    cond_src, cond_tgt, cond_now = P_SUTTA[oidx[s:i]], P_SUTTA[cidx[s:i]], P_SUTTA[o_act]
                cc = np.bincount(cond_tgt[cond_src == cond_now], minlength=10).astype(np.float32)
                cond_f = (np.log((cc + 2) / (cc.sum() + 20)) - np.log((sc + 1) / (n + 10)))[P_SUTTA]
                X = np.stack([
                    (P_KIND == 1), (P_KIND == 2), P_SEQ, kind_share,
                    np.log1p(cnt), np.log1p(cnt120), np.log1p(cnt_o), np.log1p(gap),
                    gap <= 3, gap <= 10,
                    np.log1p(p365), np.log1p(p30), np.log1p(p1),
                    digit_f, pair_f, sum_f,
                    sutta_f, np.log1p(sgap), wd_f, np.log1p(wd_cnt),
                    P_DIGITSET @ P_DIGITSET[prev_same], P_DIGITSET @ P_DIGITSET[prev_other],
                    P_DIGITSET @ P_CUTSET[prev_same], P_DIGITSET @ P_CUTSET[prev_other],
                    cond_f,
                ], axis=1).astype(np.float32)
                out[side][0].append(X)
                out[side][1].append(o_act if side == "open" else c_act)
                out[side][2].append((market, t))
        print(f"features: {market}", file=sys.stderr, flush=True)
    v = out[only_side]
    return np.stack(v[0]), np.array(v[1]), v[2]


def fit(X, y, l2, mu=None, sd=None):
    E, P, F = X.shape
    if mu is None:
        mu = X.reshape(-1, F).mean(0)
        sd = X.reshape(-1, F).std(0) + 1e-6
    Z = ((X - mu) / sd).astype(np.float32)
    yi = (np.arange(E), y)
    Zy = Z[yi].astype(np.float64)

    def obj(w):
        s = Z @ w.astype(np.float32)
        s = s - s.max(1, keepdims=True)
        e = np.exp(s)
        lse = np.log(e.sum(1))
        p = e / e.sum(1, keepdims=True)
        loss = -(s[yi] - lse).sum() / E + l2 * (w @ w)
        g = (np.einsum("ep,epf->f", p, Z).astype(np.float64) - Zy.sum(0)) / E + 2 * l2 * w
        return float(loss), g

    res = minimize(obj, np.zeros(F), jac=True, method="L-BFGS-B", options={"maxiter": 400})
    return res.x, mu, sd


def evaluate(X, y, w, mu, sd):
    s = ((X - mu) / sd) @ w
    s = s - s.max(1, keepdims=True)
    lse = np.log(np.exp(s).sum(1))
    ll = float((s[np.arange(len(y)), y] - lse).mean() + np.log(NP))  # nats/event vs uniform
    act = s[np.arange(len(y)), y]
    rank = (s > act[:, None]).sum(1) + 1
    return {"ll_gain": ll, "top5": float((rank <= 5).mean()), "top10": float((rank <= 10).mean()),
            "top20": float((rank <= 20).mean())}, rank


SETS = {
    "kind": ["dp", "tp", "seq", "kind_share"],
    "kind_freq": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10"],
    "kind_freq_pool": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
                       "pool365", "pool30", "pool_y"],
    "kind_freq_pool_geo": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3",
                           "gap10", "pool365", "pool30", "pool_y", "digit", "pair", "sum_share"],
    "all": FEATURES,
}


def main():
    by_market = load()
    replay = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    prod = {(r["market"], r["date"]): r for r in replay}
    results = {}
    for side in ("open", "close"):
        X, y, meta = build(by_market, side)
        dates = np.array([m[1] for m in meta])
        tr, va = dates <= TRAIN_END, (dates > TRAIN_END) & (dates <= VALID_END)
        fit_mask = dates <= VALID_END
        pk = "prodOpen" if side == "open" else "prodClose"
        va_idx = np.where(va)[0]
        prod_va = np.mean([PANELS[y[k]] in prod[meta[k]][pk][:10] for k in va_idx if meta[k] in prod])
        side_res = {"n_train": int(tr.sum()), "n_valid": int(va.sum()), "prod_valid_top10": float(prod_va), "sets": {}}
        print(side, "train", tr.sum(), "valid", va.sum(), "prod valid top10", round(prod_va, 4), file=sys.stderr)
        best = None
        for name, fs in SETS.items():
            cols = [FEATURES.index(f) for f in fs]
            for l2 in (1e-4, 1e-3):
                w, mu, sd = fit(X[tr][:, :, cols], y[tr], l2)
                ev, _ = evaluate(X[va][:, :, cols], y[va], w, mu, sd)
                side_res["sets"][f"{name}|{l2}"] = ev
                print(side, name, l2, {k: round(v, 4) for k, v in ev.items()}, file=sys.stderr, flush=True)
                if best is None or ev["ll_gain"] > best[0]:
                    best = (ev["ll_gain"], name, l2)
        _, name, l2 = best
        cols = [FEATURES.index(f) for f in SETS[name]]
        w, mu, sd = fit(X[fit_mask][:, :, cols], y[fit_mask], l2)
        side_res["selected"] = {"set": name, "l2": l2, "features": SETS[name],
                                "weights": list(map(float, w)), "mu": list(map(float, mu)),
                                "sd": list(map(float, sd))}
        for wname, start in WINDOWS.items():
            m = np.where((dates >= start) & (dates <= END))[0]
            ev, rank = evaluate(X[m][:, :, cols], y[m], w, mu, sd)
            ph = np.array([PANELS[y[k]] in prod[meta[k]][pk][:10] for k in m])
            nh = rank <= 10
            side_res[wname] = {"n": len(m), "prod_top10": int(ph.sum()), "new_top10": int(nh.sum()),
                               "new_ll_gain": ev["ll_gain"]}
            print(side, wname, side_res[wname], file=sys.stderr, flush=True)
        results[side] = side_res
    (HERE / "results2.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
