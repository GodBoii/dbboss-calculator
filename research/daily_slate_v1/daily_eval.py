"""How many of a day's ~24 draws can we predict?

Each draw gets three predictions:
  * kind  : SP or DP (and a DP-likelihood ranking of the day's draws)
  * sutta : top-3 / top-6 of 10
  * panel : top-10 / top-30 of 220

Two modes per model:
  * MORNING : made before the first result of the day (history < D only)
  * LIVE    : the slate method. Every draw also sees all results declared
              earlier that day (by schedule time), including the same market's
              Open for its Close.

State is built chronologically from 2016 (no lookahead). Models are fitted on
FIT = 2023-07-01..2025-12-31 and scored on TEST = 2026-01-01..end, reported
per day (hits out of the day's draws), plus the last 90 days.

Run: python research/daily_slate_v1/daily_eval.py
"""

from __future__ import annotations

import json
import math
from collections import defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

import research as R
from slate import HERE, load_slates, weekday

FIT_START, FIT_END, TEST_START = "2023-07-01", "2025-12-31", "2026-01-01"
PANELS = R.ALL_PANELS
PIDX = {p: i for i, p in enumerate(PANELS)}
NP = len(PANELS)
P_SUT = np.array([R_sut for R_sut in (sum(map(int, p)) % 10 for p in PANELS)])
P_DP = np.array([len(set(p)) == 2 for p in PANELS], dtype=float)
P_DIG = np.zeros((NP, 10))
for i, p in enumerate(PANELS):
    for d in set(p):
        P_DIG[i, int(d)] = 1
HL_KEY, HL_GLOBAL = 300.0, 6000.0
DK, DG = 0.5 ** (1 / HL_KEY), 0.5 ** (1 / HL_GLOBAL)

S_FEATS = ["s_ms", "s_ga", "s_prevday", "s_today_cnt", "s_today_last", "s_open_eq", "s_jodi"]
S_LIVE = {"s_today_cnt", "s_today_last", "s_open_eq", "s_jodi"}
P_FEATS = ["p_ms", "p_ga", "p_gap", "p_sut_ms", "p_dp", "p_today_seen", "p_today_sut",
           "p_open_eq", "p_open_ov", "p_dp_x_opendp", "p_dp_x_excess", "p_jodi"]
P_LIVE = {"p_today_seen", "p_today_sut", "p_open_eq", "p_open_ov", "p_dp_x_opendp", "p_dp_x_excess", "p_jodi"}
K_FEATS = ["k_base", "k_cond", "k_prevday", "k_excess", "k_nearlier", "k_close"] + [f"k_wd{i}" for i in range(7)]
K_LIVE = {"k_cond", "k_excess", "k_nearlier"}


class KeyState:
    def __init__(self):
        self.sut = np.zeros(10); self.pan = np.zeros(NP); self.dp = 0.0; self.n = 0.0
        self.last = np.full(NP, -10_000); self.t = 0

    def update(self, x):
        self.sut *= DK; self.pan *= DK; self.dp *= DK; self.n *= DK
        self.sut[x["sutta"]] += 1; self.pan[PIDX[x["panel"]]] += 1
        self.dp += x["dp"]; self.n += 1
        self.t += 1; self.last[PIDX[x["panel"]]] = self.t


def lf(c, a=1.0):
    return np.log((c + a) / (c.sum() + a * len(c)))


def logit(p):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def build(slates):
    keys = defaultdict(KeyState)
    gl_sut = np.zeros(10); gl_pan = np.zeros(NP)
    jodi = defaultdict(lambda: np.zeros(100))
    oc = defaultdict(lambda: np.ones((2, 2)))       # [open dp][close dp] with +1 prior
    prevday = {}
    cases = []
    for d, draws in slates.items():
        store = d >= FIT_START
        wd = weekday(d)
        # expected DP count of earlier draws uses each key's base rate
        base_rate = {}
        for x in draws:
            k = keys[(x["market"], x["side"])]
            base_rate[(x["market"], x["side"])] = (k.dp + 0.25) / (k.n + 1)
        by_time = defaultdict(list)
        for x in draws:
            by_time[x["time"]].append(x)
        earlier = []
        today_open = {}
        for t in sorted(by_time):
            if store:
                for x in by_time[t]:
                    cases.append(make_case(d, wd, x, keys, gl_sut, gl_pan, jodi, oc, prevday,
                                           earlier, today_open, base_rate))
            for x in by_time[t]:
                keys[(x["market"], x["side"])].update(x)
                earlier.append(x)
                if x["side"] == "open":
                    today_open[x["market"]] = x
            gl_sut *= DG ** len(by_time[t]); gl_pan *= DG ** len(by_time[t])
            for x in by_time[t]:
                gl_sut[x["sutta"]] += 1; gl_pan[PIDX[x["panel"]]] += 1
        for m in {x["market"] for x in draws}:
            o = today_open.get(m); c = next((x for x in draws if x["market"] == m and x["side"] == "close"), None)
            if o and c:
                jodi[m] *= DK; jodi[m][o["sutta"] * 10 + c["sutta"]] += 1
                oc[m] *= DK ** 0.0  # keep counts cumulative (small table)
                oc[m][int(o["dp"]), int(c["dp"])] += 1
        for x in draws:
            prevday[(x["market"], x["side"])] = x
    return cases


def make_case(d, wd, x, keys, gl_sut, gl_pan, jodi, oc, prevday, earlier, today_open, base_rate):
    m, side = x["market"], x["side"]
    k = keys[(m, side)]
    pv = prevday.get((m, side))
    o = today_open.get(m) if side == "close" else None
    # ---- sutta
    S = np.zeros((10, len(S_FEATS)), dtype=np.float32)
    S[:, 0] = lf(k.sut); S[:, 1] = lf(gl_sut)
    if pv: S[pv["sutta"], 2] = 1
    today_cnt = np.bincount([e["sutta"] for e in earlier], minlength=10) if earlier else np.zeros(10)
    S[:, 3] = today_cnt
    if earlier: S[earlier[-1]["sutta"], 4] = 1
    if o:
        S[o["sutta"], 5] = 1
        S[:, 6] = lf(jodi[m][o["sutta"] * 10: o["sutta"] * 10 + 10], 0.5)
    # ---- kind
    base = (k.dp + 0.25) / (k.n + 1)
    exp_dp = sum(base_rate[(e["market"], e["side"])] for e in earlier)
    excess = sum(e["dp"] for e in earlier) - exp_dp
    cond = base
    if o is not None:
        t = oc[m]; cond = t[int(o["dp"]), 1] / t[int(o["dp"])].sum()
    K = np.zeros(len(K_FEATS), dtype=np.float32)
    K[0] = logit(base); K[1] = logit(cond) - logit(base); K[2] = float(pv["dp"]) if pv else 0.0
    K[3] = excess; K[4] = len(earlier); K[5] = side == "close"; K[6 + wd] = 1
    # ---- panel
    P = np.zeros((NP, len(P_FEATS)), dtype=np.float32)
    P[:, 0] = lf(k.pan); P[:, 1] = lf(gl_pan)
    P[:, 2] = np.log1p(np.minimum(k.t - k.last, 3000))
    P[:, 3] = lf(k.sut)[P_SUT]; P[:, 4] = P_DP
    seen = {e["panel"] for e in earlier}
    P[:, 5] = [1.0 if p in seen else 0.0 for p in PANELS]
    P[:, 6] = today_cnt[P_SUT]
    if o:
        P[PIDX[o["panel"]], 7] = 1
        dv = np.zeros(10)
        for c in set(o["panel"]): dv[int(c)] = 1
        P[:, 8] = P_DIG @ dv
        P[:, 9] = P_DP * float(o["dp"])
        P[:, 11] = S[:, 6][P_SUT]
    P[:, 10] = P_DP * excess
    return {"date": d, "market": m, "side": side, "panel": x["panel"], "sutta": x["sutta"],
            "dp": x["dp"], "S": S, "K": K, "P": P}


def mask(feats, live):
    return np.array([0.0 if (f in live and not keep) else 1.0 for f in feats for keep in [False]])


def zero_live(X, feats, live_set):
    cols = [i for i, f in enumerate(feats) if f in live_set]
    X = X.copy(); X[..., cols] = 0
    return X


def fit_choice(Xf, yf, l2=300.0):
    mu, sd = R.standardize_stats(Xf)
    w = R.fit_clogit((Xf - mu) / sd, yf, l2)
    return lambda X: ((X - mu) / sd) @ w, w


def main():
    slates = load_slates("2016-01-01")
    cases = build(slates)
    fit = [c for c in cases if c["date"] <= FIT_END]
    test = [c for c in cases if c["date"] >= TEST_START]
    end = max(c["date"] for c in cases)
    from datetime import date, timedelta
    last90 = (date.fromisoformat(end) - timedelta(days=89)).isoformat()
    print(f"cases fit={len(fit)} test={len(test)} (end {end})")

    preds = {mode: {} for mode in ("morning", "live")}
    weights = {}
    for mode in ("morning", "live"):
        # sutta
        Xs = np.stack([c["S"] for c in fit]).astype(np.float64); ys = np.array([c["sutta"] for c in fit])
        Xt = np.stack([c["S"] for c in test]).astype(np.float64)
        if mode == "morning": Xs, Xt = zero_live(Xs, S_FEATS, S_LIVE), zero_live(Xt, S_FEATS, S_LIVE)
        f, w = fit_choice(Xs, ys); preds[mode]["sutta"] = f(Xt); weights[f"sutta_{mode}"] = dict(zip(S_FEATS, w.round(3).tolist()))
        # panel
        Xp = np.stack([c["P"] for c in fit]).astype(np.float64); yp = np.array([PIDX[c["panel"]] for c in fit])
        Xpt = np.stack([c["P"] for c in test]).astype(np.float64)
        if mode == "morning": Xp, Xpt = zero_live(Xp, P_FEATS, P_LIVE), zero_live(Xpt, P_FEATS, P_LIVE)
        f, w = fit_choice(Xp, yp); preds[mode]["panel"] = f(Xpt); weights[f"panel_{mode}"] = dict(zip(P_FEATS, w.round(3).tolist()))
        del Xp, Xpt
        # kind
        Xk = np.stack([c["K"] for c in fit]); yk = np.array([c["dp"] for c in fit])
        Xkt = np.stack([c["K"] for c in test])
        if mode == "morning": Xk, Xkt = zero_live(Xk, K_FEATS, K_LIVE), zero_live(Xkt, K_FEATS, K_LIVE)
        lr = LogisticRegression(C=1.0, max_iter=2000).fit(Xk, yk)
        preds[mode]["kind"] = lr.predict_proba(Xkt)[:, 1]
        weights[f"kind_{mode}"] = dict(zip(K_FEATS, lr.coef_[0].round(3).tolist()))

    y_s = np.array([c["sutta"] for c in test]); y_p = np.array([PIDX[c["panel"]] for c in test])
    y_k = np.array([c["dp"] for c in test]).astype(int)
    dates = np.array([c["date"] for c in test])
    fit_rate = {}
    for c in fit:
        fit_rate.setdefault((c["market"], c["side"]), []).append(c["dp"])

    def in_top(scores, y, k):
        order = np.argsort(-scores, axis=1)[:, :k]
        return (order == y[:, None]).any(1)

    rows = {}
    for mode in ("morning", "live"):
        hits = {
            "sutta_top3": in_top(preds[mode]["sutta"], y_s, 3),
            "sutta_top6": in_top(preds[mode]["sutta"], y_s, 6),
            "panel_top10": in_top(preds[mode]["panel"], y_p, 10),
            "panel_top30": in_top(preds[mode]["panel"], y_p, 30),
            "kind_correct": (preds[mode]["kind"] >= 0.5).astype(int) == y_k,
        }
        rows[mode] = hits
    rng = np.random.default_rng(0)
    rows["random"] = {
        "sutta_top3": rng.random(len(test)) < 0.3, "sutta_top6": rng.random(len(test)) < 0.6,
        "panel_top10": rng.random(len(test)) < 10 / 220, "panel_top30": rng.random(len(test)) < 30 / 220,
        "kind_correct": y_k == 0,   # "always SP" baseline
    }

    out = {"end": end, "weights": weights, "windows": {}}
    for wname, lo in (("2026 (271d)", TEST_START), ("last 90d", last90)):
        sel = dates >= lo
        days = sorted(set(dates[sel]))
        n_per_day = np.array([np.sum(dates == d) for d in days])
        print(f"\n=== {wname}: {len(days)} days, avg {n_per_day.mean():.1f} draws/day (weekday ~23.5, Sat ~17.5, Sun ~6) ===")
        print(f"{'target':14s} {'mode':8s} {'hit%':>6s} {'avg hits/day':>13s} {'best day':>9s} {'worst':>6s} {'days>=random+2':>15s}")
        out["windows"][wname] = {}
        for tgt in ("kind_correct", "sutta_top3", "sutta_top6", "panel_top10", "panel_top30"):
            for mode in ("random", "morning", "live"):
                h = rows[mode][tgt]
                per_day = np.array([h[dates == d].sum() for d in days])
                rnd = np.array([rows["random"][tgt][dates == d].sum() for d in days])
                label = "always-SP" if (mode == "random" and tgt == "kind_correct") else mode
                print(f"{tgt:14s} {label:9s} {100*h[sel].mean():5.1f}% {per_day.mean():6.2f} / {n_per_day.mean():.1f}"
                      f" {per_day.max():9d} {per_day.min():6d}")
                out["windows"][wname][f"{tgt}:{mode}"] = {"hitRate": float(h[sel].mean()), "perDay": float(per_day.mean())}
        # kind quality beyond accuracy
        for mode in ("morning", "live"):
            p = preds[mode]["kind"][sel]
            auc = roc_auc_score(y_k[sel], p)
            # pick the k most DP-likely draws of each day
            prec = {}
            for kk in (3, 6):
                hit = tot = 0
                for d in days:
                    idx = np.where(dates == d)[0]
                    top = idx[np.argsort(-preds[mode]["kind"][idx])[:kk]]
                    hit += y_k[top].sum(); tot += len(top)
                prec[kk] = hit / tot
            calls = p >= 0.4
            print(f"  kind {mode:8s} AUC={auc:.3f}  daily top3 DP picks prec={prec[3]:.3f}  top6={prec[6]:.3f}"
                  f"  (base DP rate {y_k[sel].mean():.3f});  p>=0.40 calls={calls.sum()} prec={y_k[sel][calls].mean() if calls.any() else float('nan'):.3f}")
            out["windows"][wname][f"kindAUC:{mode}"] = auc
            out["windows"][wname][f"kindTop3:{mode}"] = prec[3]
            out["windows"][wname][f"kindTop6:{mode}"] = prec[6]

    print("\nWeights (standardized):")
    for k, v in weights.items():
        print(f"  {k}: {v}")
    (HERE / "daily_eval.json").write_text(json.dumps(out, indent=1, default=float))


if __name__ == "__main__":
    main()
