"""DP panel ranking research (Open DP / Close DP), production-faithful.

Task: when a draw's Open (or Close) is a DP, rank the 90 DP panels so the
actual one lands as high as possible. This is what the app's "Open DP" /
"Close DP" lists (top 30) and "DP Numbers" (2-digit pair) are judged on.

Production constraints mirrored here:
  * only the 12 app markets exist, and only a rolling 28-month history;
  * a prediction for date D sees rows dated < D (all markets). For Close, the
    same market's Open on D is optionally used ("open-aware"), since the app
    receives today's partial record once the Open is published.

Splits (chronological):
  FIT    2023-01-01 .. 2025-06-30   fit conditional-logit weights
  SELECT 2025-07-01 .. 2026-07-03   choose variant / regularisation
  TEST   2026-07-04 .. end          last 90 days, reported once (+30d, 7d)
The final weights are refit on FIT+SELECT before scoring TEST.

Run: python research/dp_panel_v3/research.py
"""

from __future__ import annotations

import bisect
import csv
import json
import math
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

APP_MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night",
    "Rajdhani Night", "Main Bazar",
]
FIT_START, FIT_END = "2023-01-01", "2025-06-30"
SEL_START, SEL_END = "2025-07-01", "2026-07-03"
TEST_START = "2026-07-04"
LOOKBACK_MONTHS = 28

ORD = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
ALL_PANELS = [f"{ORD[i]}{ORD[j]}{ORD[k]}" for i in range(10) for j in range(i, 10) for k in range(j, 10)]
DP = [p for p in ALL_PANELS if len(set(p)) == 2]
DP_INDEX = {p: i for i, p in enumerate(DP)}
N = len(DP)
assert N == 90
REP = np.array([int(next(d for d in p if p.count(d) == 2)) for p in DP])
SUT = np.array([sum(map(int, p)) % 10 for p in DP])
PAIR = [''.join(sorted(set(p))) for p in DP]
PAIRS = sorted(set(PAIR))
PAIR_IDX = np.array([PAIRS.index(x) for x in PAIR])
DIGSET = np.zeros((N, 10))
for _i, _p in enumerate(DP):
    for _d in set(_p):
        DIGSET[_i, int(_d)] = 1
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
HALF_LIVES = (60, 200)

FEATURES = [
    "ms_all",        # market+side DP panel frequency (28m window)
    "ms_h60",        # market+side, recency-decayed (half-life 60 draws)
    "ms_h200",
    "ms_wd",         # market+side, same weekday
    "mb_all",        # market, both sides
    "gs_all",        # all 12 markets, same side
    "ga_all",        # all 12 markets, both sides
    "ms_gap",        # log draws since this panel last appeared (market+side)
    "mb_recent5",    # appeared in the market's last 5 draws (either side)
    "ms_rep",        # repeated-digit frequency (market+side)
    "ms_pair",       # digit-pair frequency (market+side)
    "ms_sut",        # DP sutta frequency (market+side)
    "ga_rep",        # repeated-digit frequency (all markets)
    "ga_sut",        # DP sutta frequency (all markets)
    "prev_overlap",  # digits shared with the market's previous panel
    "open_overlap", "open_same_rep", "open_same_sut", "open_equal",  # close, open-aware
]
PRE_OPEN = [f for f in FEATURES if not f.startswith("open_")]


def history_cutoff(anchor_iso: str, months: int = LOOKBACK_MONTHS) -> str:
    """Mirror of prediction-contract.historicalCutoffISO."""
    a = date.fromisoformat(anchor_iso)
    y, m = a.year, a.month - months
    while m <= 0:
        m += 12; y -= 1
    import calendar
    day = min(a.day, calendar.monthrange(y, m)[1])
    return date(y, m, day).isoformat()


# ─── data ────────────────────────────────────────────────────────────────────
def load_rows() -> list[dict]:
    rows: dict[tuple[str, str], dict] = {}
    with open(ROOT / "research/dp_only_v1/chart_rows.csv", newline="") as fh:
        for r in csv.DictReader(fh):
            if r["market"] in APP_MARKETS:
                rows[(r["date"], r["market"])] = {"date": r["date"], "market": r["market"],
                                                  "open": r["open"] or None, "close": r["close"] or None}
    data = json.loads((HERE / "data.json").read_text())["markets"]
    for market, recs in data.items():
        for rec in recs:
            d, m, y = map(int, rec["dateRangeStart"].replace("-", "/").split("/"))
            y = y + 2000 if y < 100 else y
            iso = (date(y, m, d) + timedelta(days=DAYS.index(rec["day"]))).isoformat()
            op = rec["openPanel"] if len(rec["openPanel"] or "") == 3 else None
            cl = rec["closePanel"] if len(rec["closePanel"] or "") == 3 else None
            rows[(iso, market)] = {"date": iso, "market": market, "open": op, "close": cl}
    return sorted(rows.values(), key=lambda r: (r["date"], r["market"]))


def is_dp(p: str | None) -> bool:
    return bool(p) and len(set(p)) == 2


class Seq:
    """Chronological panel sequence for one key, queryable by date window."""

    def __init__(self):
        self.dates: list[str] = []
        self.idx: list[int] = []     # DP index or -1
        self.wd: list[int] = []
        self.panels: list[str] = []

    def add(self, d: str, panel: str):
        self.dates.append(d)
        self.idx.append(DP_INDEX.get(panel, -1))
        self.wd.append(datetime.fromisoformat(d).weekday())
        self.panels.append(panel)

    def finalize(self):
        self.idx_a = np.array(self.idx)
        self.wd_a = np.array(self.wd)

    def window(self, start: str, end_excl: str) -> tuple[int, int]:
        return bisect.bisect_left(self.dates, start), bisect.bisect_left(self.dates, end_excl)


def counts(idx: np.ndarray, weights: np.ndarray | None = None) -> np.ndarray:
    m = idx >= 0
    return np.bincount(idx[m], weights=None if weights is None else weights[m], minlength=N).astype(float)


def logfreq(c: np.ndarray, alpha: float = 1.0) -> np.ndarray:
    return np.log((c + alpha) / (c.sum() + alpha * len(c)))


def group_log(c: np.ndarray, groups: np.ndarray, k: int, alpha: float = 1.0) -> np.ndarray:
    g = np.bincount(groups, weights=c, minlength=k)
    return np.log((g + alpha) / (g.sum() + alpha * k))[groups]


def digit_vec(panel: str) -> np.ndarray:
    v = np.zeros(10)
    for d in set(panel):
        v[int(d)] = 1
    return v


def features(market: str, side: str, d: str, seqs: dict, open_today: str | None) -> np.ndarray:
    """Feature matrix (90, F) for one prediction, using only rows in [cutoff, d)."""
    prev_day = (date.fromisoformat(d) - timedelta(days=1)).isoformat()
    cut = history_cutoff(prev_day)
    other_side = "close" if side == "open" else "open"
    ms = seqs[(market, side)]; mo = seqs[(market, other_side)]
    a, b = ms.window(cut, d); oa, ob = mo.window(cut, d)
    ms_idx = ms.idx_a[a:b]; mo_idx = mo.idx_a[oa:ob]
    n = len(ms_idx)
    X = np.zeros((N, len(FEATURES)))
    c_ms = counts(ms_idx)
    X[:, 0] = logfreq(c_ms)
    ages = np.arange(n - 1, -1, -1)
    for j, h in enumerate(HALF_LIVES):
        X[:, 1 + j] = logfreq(counts(ms_idx, 0.5 ** (ages / h)), 0.5)
    wd = datetime.fromisoformat(d).weekday()
    X[:, 3] = logfreq(counts(ms_idx[ms.wd_a[a:b] == wd]), 0.5)
    c_mb = c_ms + counts(mo_idx)
    X[:, 4] = logfreq(c_mb)
    c_gs = np.zeros(N); c_ga = np.zeros(N)
    for m in APP_MARKETS:
        for s in ("open", "close"):
            q = seqs.get((m, s))
            if q is None:
                continue
            qa, qb = q.window(cut, d)
            c = counts(q.idx_a[qa:qb])
            c_ga += c
            if s == side:
                c_gs += c
    X[:, 5] = logfreq(c_gs)
    X[:, 6] = logfreq(c_ga)
    last = np.full(N, -1)
    for pos, i in enumerate(ms_idx):
        if i >= 0:
            last[i] = pos
    gap = np.where(last >= 0, n - 1 - last, 2000)
    X[:, 7] = np.log1p(np.minimum(gap, 2000))
    recent = set(ms.panels[max(a, b - 5):b]) | set(mo.panels[max(oa, ob - 5):ob])
    X[:, 8] = [1.0 if p in recent else 0.0 for p in DP]
    X[:, 9] = group_log(c_ms, REP, 10)
    X[:, 10] = group_log(c_ms, PAIR_IDX, len(PAIRS))
    X[:, 11] = group_log(c_ms, SUT, 10)
    X[:, 12] = group_log(c_ga, REP, 10)
    X[:, 13] = group_log(c_ga, SUT, 10)
    # previous panel of the same market: for open it is yesterday's close, for
    # close it is today's open when known, else yesterday's close.
    prev = open_today if (side == "close" and open_today) else None
    if prev is None:
        prev_c = mo.panels[ob - 1] if side == "open" and ob > oa else (ms.panels[b - 1] if b > a else None)
        prev = prev_c
    if prev:
        X[:, 14] = DIGSET @ digit_vec(prev)
    if side == "close" and open_today:
        X[:, 15] = DIGSET @ digit_vec(open_today)
        if is_dp(open_today):
            orep = int(next(x for x in open_today if open_today.count(x) == 2))
            X[:, 16] = (REP == orep).astype(float)
        X[:, 17] = (SUT == sum(map(int, open_today)) % 10).astype(float)
        X[:, 18] = np.array([1.0 if p == open_today else 0.0 for p in DP])
    return X


def build_cases(rows: list[dict]) -> list[dict]:
    seqs: dict = defaultdict(Seq)
    for r in rows:
        for side in ("open", "close"):
            if r[side]:
                seqs[(r["market"], side)].add(r["date"], r[side])
    for s in seqs.values():
        s.finalize()
    cases = []
    for r in rows:
        if r["date"] < FIT_START:
            continue
        for side in ("open", "close"):
            p = r[side]
            if not is_dp(p):
                continue
            q = seqs[(r["market"], side)]
            a, b = q.window(history_cutoff(r["date"]), r["date"])
            if b - a < 100:
                continue
            cases.append({
                "date": r["date"], "market": r["market"], "side": side, "actual": p,
                "y": DP_INDEX[p],
                "X_pre": features(r["market"], side, r["date"], seqs, None).astype(np.float32),
                "X_aware": features(r["market"], side, r["date"], seqs, r["open"]).astype(np.float32)
                if side == "close" else None,
            })
    return cases


# ─── conditional logit ───────────────────────────────────────────────────────
def standardize_stats(X: np.ndarray):
    flat = X.reshape(-1, X.shape[-1])
    mu = flat.mean(0); sd = flat.std(0)
    sd[sd < 1e-9] = 1.0
    return mu, sd


def fit_clogit(X: np.ndarray, y: np.ndarray, l2: float, iters: int = 400) -> np.ndarray:
    n, _, F = X.shape
    w = np.zeros(F); m = np.zeros(F); v = np.zeros(F)
    for t in range(1, iters + 1):
        s = X @ w
        s -= s.max(axis=1, keepdims=True)
        p = np.exp(s); p /= p.sum(axis=1, keepdims=True)
        grad = (np.einsum("nj,njf->f", p, X) - X[np.arange(n), y].sum(0)) / n + l2 * w / n
        m = 0.9 * m + 0.1 * grad; v = 0.999 * v + 0.001 * grad ** 2
        w -= 0.03 * (m / (1 - 0.9 ** t)) / (np.sqrt(v / (1 - 0.999 ** t)) + 1e-8)
    return w


def nll(scores: np.ndarray, y: np.ndarray) -> float:
    s = scores - scores.max(axis=1, keepdims=True)
    return float(-(s[np.arange(len(y)), y] - np.log(np.exp(s).sum(1))).mean())


def metrics(scores: np.ndarray, y: np.ndarray) -> dict:
    order = np.argsort(-(scores - np.arange(N) * 1e-9), axis=1, kind="stable")
    rank = np.argmax(order == y[:, None], axis=1) + 1
    prob = np.exp(scores - scores.max(1, keepdims=True))
    pair_scores = np.zeros((len(y), len(PAIRS)))
    for j in range(N):
        pair_scores[:, PAIR_IDX[j]] += prob[:, j]
    best_pair = pair_scores.argmax(1)
    return {
        "n": int(len(y)),
        "top10": float((rank <= 10).mean()), "top15": float((rank <= 15).mean()),
        "top20": float((rank <= 20).mean()), "top30": float((rank <= 30).mean()),
        "meanRank": float(rank.mean()), "pairExact": float((best_pair == PAIR_IDX[y]).mean()),
        "nll": nll(scores, y),
    }


def stack(cases, key, feats):
    idx = [FEATURES.index(f) for f in feats]
    X = np.stack([c[key] for c in cases])[:, :, idx].astype(np.float64)
    y = np.array([c["y"] for c in cases])
    return X, y


def fmt(r):
    return (f"n={r['n']:4d} top10={r['top10']:.3f} top15={r['top15']:.3f} top20={r['top20']:.3f} "
            f"top30={r['top30']:.3f} meanRank={r['meanRank']:.2f} pair={r['pairExact']:.3f} "
            f"nll={r['nll']:.4f}")


def main():
    rows = load_rows()
    end = rows[-1]["date"]
    print(f"rows={len(rows)} last={end}")
    cases = build_cases(rows)
    print(f"DP cases={len(cases)} (app markets, {FIT_START}..{end}); uniform nll={math.log(N):.4f}")

    fit = [c for c in cases if c["date"] <= FIT_END]
    sel = [c for c in cases if SEL_START <= c["date"] <= SEL_END]
    test = [c for c in cases if c["date"] >= TEST_START]

    variants = {
        "freq": ["ms_all", "mb_all", "gs_all", "ga_all"],
        "freq+digit": ["ms_all", "mb_all", "gs_all", "ga_all", "ms_rep", "ms_pair", "ms_sut", "ga_rep", "ga_sut"],
        "pre_open": PRE_OPEN,
        "open_aware": FEATURES,
    }
    out = {"end": end, "select": {}, "test": {}, "final": {}}
    print("\nSELECT period (fit on FIT):")
    for side in ("open", "close", "both"):
        for vname, feats in variants.items():
            if vname == "open_aware" and side != "close":
                continue
            key = "X_aware" if vname == "open_aware" else "X_pre"
            pick = (lambda c: True) if side == "both" else (lambda c, s=side: c["side"] == s)
            Xf, yf = stack([c for c in fit if pick(c)], key, feats)
            Xs, ys = stack([c for c in sel if pick(c)], key, feats)
            mu, sd = standardize_stats(Xf)
            for l2 in (10.0, 300.0, 3000.0):
                w = fit_clogit((Xf - mu) / sd, yf, l2)
                r = metrics(((Xs - mu) / sd) @ w, ys)
                out["select"][f"{side}:{vname}:{l2:g}"] = r
                print(f"  {side:5s} {vname:11s} l2={l2:<6g} {fmt(r)}")

    # choose per target (open, close-pre, close-aware) by SELECT nll, allowing
    # side-specific or pooled ("both") fitting.
    def choose(target_side, aware):
        best = None
        for k, r in out["select"].items():
            side, vname, l2 = k.split(":")
            if aware != (vname == "open_aware"):
                continue
            if side not in (target_side, "both"):
                continue
            # pooled model is evaluated on both sides; re-score on the target side
            if side == "both":
                feats = variants[vname]
                Xf, yf = stack(fit, "X_pre", feats)
                Xs, ys = stack([c for c in sel if c["side"] == target_side], "X_pre", feats)
                mu, sd = standardize_stats(Xf)
                w = fit_clogit((Xf - mu) / sd, yf, float(l2))
                r = metrics(((Xs - mu) / sd) @ w, ys)
            if best is None or r["nll"] < best[1]["nll"]:
                best = ((side, vname, float(l2)), r)
        return best

    print("\nChosen by SELECT nll:")
    choices = {"open": choose("open", False), "close": choose("close", False),
               "close_aware": choose("close", True)}
    for t, (cfg, r) in choices.items():
        print(f"  {t:12s} {cfg} {fmt(r)}")

    # refit on FIT+SELECT and score TEST windows
    dev = fit + sel
    print(f"\nTEST (refit on FIT+SELECT), windows ending {end}:")
    for t, ((side, vname, l2), _) in choices.items():
        feats = variants[vname]
        key = "X_aware" if vname == "open_aware" else "X_pre"
        target_side = "open" if t == "open" else "close"
        train = dev if side == "both" else [c for c in dev if c["side"] == target_side]
        Xd, yd = stack(train, key, feats)
        mu, sd = standardize_stats(Xd)
        w = fit_clogit((Xd - mu) / sd, yd, l2)
        out["final"][t] = {"side": side, "variant": vname, "l2": l2, "features": feats,
                           "mean": mu.tolist(), "std": sd.tolist(), "weights": w.tolist()}
        for days in (7, 30, 90):
            start = (date.fromisoformat(end) - timedelta(days=days - 1)).isoformat()
            tc = [c for c in test if c["side"] == target_side and c["date"] >= start]
            if not tc:
                continue
            Xt, yt = stack(tc, key, feats)
            r = metrics(((Xt - mu) / sd) @ w, yt)
            out["test"][f"{t}:{days}d"] = r
            print(f"  {t:12s} {days:2d}d {fmt(r)}")
        # ledger for the shared scorer
        Xt, yt = stack([c for c in test if c["side"] == target_side], key, feats)
        s = ((Xt - mu) / sd) @ w
        order = np.argsort(-(s - np.arange(N) * 1e-9), axis=1, kind="stable")
        out["final"][t]["ledger"] = [
            {"date": c["date"], "market": c["market"], "side": c["side"], "actual": c["actual"],
             "picks": [DP[j] for j in order[k][:30]]}
            for k, c in enumerate([c for c in test if c["side"] == target_side])
        ]
    print("random: top10=0.111 top15=0.167 top20=0.222 top30=0.333 meanRank=45.50 pair=0.022")
    (HERE / "research-results.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
