"""Top-10 exact-panel research: feature-based conditional-logit ranker vs production.

Split (calendar dates, strictly prior-date history for every target):
  train      2024-04-01 .. 2025-12-31
  validation 2026-01-01 .. 2026-07-02   (feature-set / regularisation choice)
  holdout    2026-07-03 .. 2026-09-30   (last 90 days; model refit on < 2026-07-03 only)

History per target mirrors production: same market, 28 calendar months, date < target.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from scipy.optimize import minimize

HERE = Path(__file__).resolve().parent
TRAIN_END = "2025-12-31"
VALID_END = "2026-07-02"
END = "2026-09-30"
WINDOWS = {"7d": "2026-09-24", "30d": "2026-09-01", "90d": "2026-07-03"}
MONTHS = 28


def all_panels() -> list[str]:
    order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    out = []
    for i in range(10):
        for j in range(i, 10):
            for k in range(j, 10):
                out.append(f"{order[i]}{order[j]}{order[k]}")
    return out


PANELS = all_panels()
PIDX = {p: i for i, p in enumerate(PANELS)}
NP = len(PANELS)
P_DIGITS = np.array([[int(c) for c in p] for p in PANELS])
P_SUTTA = P_DIGITS.sum(1) % 10
P_UNIQUE = np.array([len(set(p)) for p in PANELS])
P_KIND = np.where(P_UNIQUE == 3, 0, np.where(P_UNIQUE == 2, 1, 2))  # 0 SP, 1 DP, 2 TP
P_DIGITSET = np.zeros((NP, 10), dtype=np.float32)
for i, p in enumerate(PANELS):
    for c in set(p):
        P_DIGITSET[i, int(c)] = 1
P_PAIRS = []
for p in PANELS:
    d = sorted(int(c) for c in p)
    P_PAIRS.append([(d[0], d[1]), (d[0], d[2]), (d[1], d[2])])


def is_seq(p: str) -> bool:
    a, b, c = (int(x) for x in p)
    return (b == a + 1 and c == b + 1) or (b == a - 1 and c == b - 1) or p in {"890", "901", "012", "789"}


P_SEQ = np.array([is_seq(p) for p in PANELS], dtype=np.float32)


def cutoff(iso: str, months: int = MONTHS) -> str:
    y, m, d = map(int, iso.split("-"))
    total = y * 12 + (m - 1) - months
    ny, nm = divmod(total, 12)
    nm += 1
    nxt = date(ny + (nm // 12), nm % 12 + 1, 1)
    last = (nxt - timedelta(days=1)).day
    return date(ny, nm, min(d, last)).isoformat()


def load():
    rows = list(csv.DictReader((HERE / "chart_rows.csv").open(encoding="utf-8")))
    by_market = defaultdict(list)
    for r in rows:
        if r["open"] in PIDX and r["close"] in PIDX:
            by_market[r["market"]].append((r["date"], PIDX[r["open"]], PIDX[r["close"]]))
    for v in by_market.values():
        v.sort()
    return by_market


FEATURES = [
    "dp", "tp", "seq", "kind_share",
    "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
    "pool", "pool_side",
    "digit", "pair", "sutta", "sutta_gap", "wd_sutta",
    "prev_same_ov", "prev_other_ov", "cond_sutta",
    "prod10", "prod_inv", "prod40",
]


def build(by_market, prod):
    """Return dict side -> (X [E,220,F], y [E], meta list)."""
    # Pooled daily panel counts (both sides / per side) across markets.
    all_dates = sorted({d for v in by_market.values() for d, _, _ in v})
    dpos = {d: i for i, d in enumerate(all_dates)}
    daily = np.zeros((len(all_dates) + 1, 3, NP), dtype=np.float32)  # [:,0]=open,[:,1]=close
    for v in by_market.values():
        for d, o, c in v:
            daily[dpos[d] + 1, 0, o] += 1
            daily[dpos[d] + 1, 1, c] += 1
    daily[:, 2] = daily[:, 0] + daily[:, 1]
    cum = np.cumsum(daily, axis=0)
    date_arr = np.array(all_dates)

    def pooled(target: str, ch: int, days: int = 365) -> np.ndarray:
        start = (date.fromisoformat(target) - timedelta(days=days)).isoformat()
        a = np.searchsorted(date_arr, start)  # first index >= start
        b = np.searchsorted(date_arr, target)  # first index >= target (exclusive)
        return cum[b, ch] - cum[a, ch]

    out = {"open": ([], [], []), "close": ([], [], [])}
    for market, rows in by_market.items():
        dates = np.array([r[0] for r in rows])
        oidx = np.array([r[1] for r in rows])
        cidx = np.array([r[2] for r in rows])
        wdays = np.array([date.fromisoformat(d).weekday() for d in dates])
        for i, (t, o_act, c_act) in enumerate(rows):
            key = (market, t)
            if key not in prod:
                continue
            s = int(np.searchsorted(dates, cutoff(t)))
            n = i - s
            if n < 50:
                continue
            wd = date.fromisoformat(t).weekday()
            for side in ("open", "close"):
                own = oidx if side == "open" else cidx
                oth = cidx if side == "open" else oidx
                h = own[s:i]
                ho = oth[s:i]
                cnt = np.bincount(h, minlength=NP).astype(np.float32)
                cnt120 = np.bincount(h[-120:], minlength=NP).astype(np.float32)
                cnt_o = np.bincount(ho, minlength=NP).astype(np.float32)
                last = np.full(NP, -1)
                np.maximum.at(last, h, np.arange(n))
                gap = np.where(last >= 0, n - 1 - last, n + 1).astype(np.float32)
                kinds = np.bincount(P_KIND[h], minlength=3).astype(np.float32)
                kind_share = np.log((kinds[P_KIND] + 1) / (n + 3))
                dig = np.bincount(P_DIGITS[h].ravel(), minlength=10).astype(np.float32)
                dshare = np.log((dig + 1) / (dig.sum() + 10))
                digit_f = dshare[P_DIGITS].sum(1)
                pairc = defaultdict(float)
                for pi in h:
                    for pr in P_PAIRS[pi]:
                        pairc[pr] += 1
                ptot = 3 * n
                pair_f = np.array([
                    sum(np.log((pairc[pr] + 0.5) / (ptot + 27.5)) for pr in P_PAIRS[k]) for k in range(NP)
                ], dtype=np.float32)
                hs = P_SUTTA[h]
                sc = np.bincount(hs, minlength=10).astype(np.float32)
                sutta_f = np.log((sc + 1) / (n + 10))[P_SUTTA]
                slast = np.full(10, -1)
                np.maximum.at(slast, hs, np.arange(n))
                sgap = np.where(slast >= 0, n - 1 - slast, n + 1)[P_SUTTA].astype(np.float32)
                hw = wdays[s:i]
                wsc = np.bincount(hs[hw == wd], minlength=10).astype(np.float32)
                wd_f = np.log((wsc + 1) / (wsc.sum() + 10))[P_SUTTA]
                prev_same = h[-1]
                if side == "open":
                    prev_other = cidx[i - 1]
                    cond_src = P_SUTTA[cidx[s:i - 1]]  # previous close sutta -> next open sutta
                    cond_tgt = P_SUTTA[oidx[s + 1:i]]
                    cond_now = P_SUTTA[cidx[i - 1]]
                else:
                    prev_other = o_act  # today's open is published before close
                    cond_src = P_SUTTA[oidx[s:i]]
                    cond_tgt = P_SUTTA[cidx[s:i]]
                    cond_now = P_SUTTA[o_act]
                sel = cond_tgt[cond_src == cond_now]
                cc = np.bincount(sel, minlength=10).astype(np.float32)
                cond_f = (np.log((cc + 2) / (cc.sum() + 20)) - np.log((sc + 1) / (n + 10)))[P_SUTTA]
                ov_same = P_DIGITSET @ P_DIGITSET[prev_same]
                ov_other = P_DIGITSET @ P_DIGITSET[prev_other]
                pl = pooled(t, 2)
                pls = pooled(t, 0 if side == "open" else 1)
                prank = np.full(NP, 0.0, dtype=np.float32)
                plist = prod[key][side]
                for r, pnl in enumerate(plist):
                    prank[PIDX[pnl]] = r + 1
                X = np.stack([
                    (P_KIND == 1).astype(np.float32), (P_KIND == 2).astype(np.float32), P_SEQ, kind_share,
                    np.log1p(cnt), np.log1p(cnt120), np.log1p(cnt_o), np.log1p(gap),
                    (gap <= 3).astype(np.float32), (gap <= 10).astype(np.float32),
                    np.log1p(pl), np.log1p(pls),
                    digit_f, pair_f, sutta_f, np.log1p(sgap), wd_f,
                    ov_same, ov_other, cond_f,
                    ((prank > 0) & (prank <= 10)).astype(np.float32),
                    np.where(prank > 0, 1.0 / np.maximum(prank, 1), 0.0),
                    (prank > 0).astype(np.float32),
                ], axis=1).astype(np.float32)
                y = o_act if side == "open" else c_act
                out[side][0].append(X)
                out[side][1].append(y)
                out[side][2].append((market, t, plist))
        print(f"features: {market}", file=sys.stderr, flush=True)
    return {s: (np.stack(v[0]), np.array(v[1]), v[2]) for s, v in out.items()}


def fit(X, y, l2):
    E, P, F = X.shape
    mu = X.reshape(-1, F).mean(0)
    sd = X.reshape(-1, F).std(0) + 1e-6
    Z = (X - mu) / sd

    def obj(w):
        s = Z @ w
        s -= s.max(1, keepdims=True)
        lse = np.log(np.exp(s).sum(1))
        p = np.exp(s - lse[:, None])
        loss = -(s[np.arange(E), y] - lse).sum() / E + l2 * (w @ w)
        g = (np.einsum("ep,epf->f", p, Z) - Z[np.arange(E), y].sum(0)) / E + 2 * l2 * w
        return loss, g

    res = minimize(obj, np.zeros(F), jac=True, method="L-BFGS-B", options={"maxiter": 500})
    return res.x, mu, sd


def topk_hits(X, y, w, mu, sd, k):
    s = ((X - mu) / sd) @ w
    # stable rank of actual: count panels with higher score
    act = s[np.arange(len(y)), y]
    rank = (s > act[:, None]).sum(1) + 1
    return rank <= k


def prod_hits(meta, y, k):
    return np.array([PANELS[yy] in m[2][:k] for yy, m in zip(y, meta)])


def main():
    replay = json.loads((HERE / "production_replay.json").read_text())["ledger"]
    prod = {(r["market"], r["date"]): {"open": r["prodOpen"], "close": r["prodClose"]} for r in replay}
    by_market = load()
    data = build(by_market, prod)
    np.savez_compressed(HERE / "features.npz", **{
        f"{s}_X": data[s][0] for s in data
    }, **{f"{s}_y": data[s][1] for s in data})
    results = {}
    feature_sets = {
        "all": FEATURES,
        "no_prod": [f for f in FEATURES if not f.startswith("prod")],
        "freq_kind": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
                      "pool", "pool_side", "digit", "pair"],
        "freq_kind_prod": ["dp", "tp", "seq", "kind_share", "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
                           "pool", "pool_side", "digit", "pair", "prod10", "prod_inv", "prod40"],
    }
    for side, (X, y, meta) in data.items():
        dates = np.array([m[1] for m in meta])
        tr = dates <= TRAIN_END
        va = (dates > TRAIN_END) & (dates <= VALID_END)
        fit_mask = dates <= VALID_END
        side_res = {"prod_valid_top10": float(prod_hits([m for m, v in zip(meta, va) if v], y[va], 10).mean())}
        best = None
        for fs_name, fs in feature_sets.items():
            cols = [FEATURES.index(f) for f in fs]
            for l2 in (1e-4, 1e-3, 1e-2):
                w, mu, sd = fit(X[tr][:, :, cols], y[tr], l2)
                h10 = topk_hits(X[va][:, :, cols], y[va], w, mu, sd, 10).mean()
                h5 = topk_hits(X[va][:, :, cols], y[va], w, mu, sd, 5).mean()
                side_res[f"{fs_name}_l2={l2}"] = {"valid_top10": float(h10), "valid_top5": float(h5)}
                print(side, fs_name, l2, f"valid top10 {h10:.4f} top5 {h5:.4f}", file=sys.stderr, flush=True)
                if best is None or h10 > best[0]:
                    best = (h10, fs_name, l2)
        _, fs_name, l2 = best
        cols = [FEATURES.index(f) for f in feature_sets[fs_name]]
        w, mu, sd = fit(X[fit_mask][:, :, cols], y[fit_mask], l2)
        side_res["selected"] = {"features": fs_name, "l2": l2,
                                "weights": dict(zip(feature_sets[fs_name], map(float, w))),
                                "mu": list(map(float, mu)), "sd": list(map(float, sd))}
        for wname, start in WINDOWS.items():
            m = (dates >= start) & (dates <= END)
            ph = prod_hits([mm for mm, v in zip(meta, m) if v], y[m], 10)
            nh = topk_hits(X[m][:, :, cols], y[m], w, mu, sd, 10)
            side_res[wname] = {"n": int(m.sum()), "prod_top10": int(ph.sum()), "new_top10": int(nh.sum()),
                               "prod_only": int((ph & ~nh).sum()), "new_only": int((nh & ~ph).sum())}
            print(side, wname, side_res[wname], file=sys.stderr, flush=True)
        results[side] = side_res
    (HERE / "results.json").write_text(json.dumps(results, indent=2) + "\n")


if __name__ == "__main__":
    main()
