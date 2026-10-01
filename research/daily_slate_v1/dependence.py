"""Are the ~24 draws of one day dependent on each other?

Null model: for every (market, side, year, weekday) cell, shuffle which date
each panel belongs to. Each market keeps its exact panel distribution, weekday
and year effects, but any link between markets on the same day is destroyed.
A day-level statistic outside the shuffled distribution is a real
within-day pattern.

DEV = 2016-01-01..2025-12-31 (discovery), TEST = 2026 (confirmation of any
pair-level pattern picked on DEV).
"""

from __future__ import annotations

import json
import random
from collections import defaultdict
from itertools import combinations

import numpy as np

from slate import HERE, SLOTS, load_slates, weekday

N_PERM = 200
rng = random.Random(7)


def shuffle(slates):
    cells = defaultdict(list)
    for d, draws in slates.items():
        for x in draws:
            cells[(x["slot"], d[:4], weekday(d))].append((d, x))
    out = defaultdict(list)
    for items in cells.values():
        dates = [d for d, _ in items]
        draws = [x for _, x in items]
        rng.shuffle(draws)
        for d, x in zip(dates, draws):
            out[d].append(x)
    for d in out:
        out[d].sort(key=lambda x: x["slot"])
    return out


def day_stats(slates):
    dp_var, distinct, rep_sutta_earlier, n_seq = [], [], 0, 0
    panel_rep, sutta_mode, jodi_rep = 0, [], 0
    for d, draws in slates.items():
        if len(draws) < 20:  # full weekday slates only
            continue
        k = sum(x["dp"] for x in draws)
        dp_var.append(k)
        s = [x["sutta"] for x in draws]
        distinct.append(len(set(s)))
        sutta_mode.append(max(np.bincount(s, minlength=10)))
        seen_s, seen_p = set(), set()
        for x in draws:
            rep_sutta_earlier += x["sutta"] in seen_s
            panel_rep += x["panel"] in seen_p
            n_seq += 1
            seen_s.add(x["sutta"]); seen_p.add(x["panel"])
        jodis = defaultdict(dict)
        for x in draws:
            jodis[x["market"]][x["side"]] = x["sutta"]
        js = [f"{v['open']}{v['close']}" for v in jodis.values() if len(v) == 2]
        jodi_rep += len(js) - len(set(js))
    return {
        "dpCountVar": float(np.var(dp_var)), "dpCountMean": float(np.mean(dp_var)),
        "zeroDpDays": float(np.mean(np.array(dp_var) == 0)),
        "distinctSuttas": float(np.mean(distinct)), "maxSuttaRepeat": float(np.mean(sutta_mode)),
        "suttaSeenEarlierRate": rep_sutta_earlier / n_seq, "panelSeenEarlierRate": panel_rep / n_seq,
        "jodiRepeatsPerDay": jodi_rep / len(dp_var),
    }


def pair_matrix(slates):
    """For every slot pair: same-sutta rate, both-DP rate, digit-overlap mean."""
    S = len(SLOTS)
    same = np.zeros((S, S)); both = np.zeros((S, S)); ov = np.zeros((S, S)); n = np.zeros((S, S))
    for draws in slates.values():
        for a, b in combinations(draws, 2):
            i, j = a["slot"], b["slot"]
            n[i, j] += 1
            same[i, j] += a["sutta"] == b["sutta"]
            both[i, j] += a["dp"] and b["dp"]
            ov[i, j] += len(set(a["panel"]) & set(b["panel"]))
    with np.errstate(invalid="ignore", divide="ignore"):
        return same / n, both / n, ov / n, n


def split(slates, lo, hi):
    return {d: v for d, v in slates.items() if lo <= d <= hi}


def main():
    slates = load_slates("2016-01-01")
    dev = split(slates, "2016-01-01", "2025-12-31")
    test = split(slates, "2026-01-01", "9999")
    print(f"days dev={len(dev)} test={len(test)} last={max(slates)}")

    out = {}
    for name, part in (("dev", dev), ("test", test)):
        real = day_stats(part)
        perms = [day_stats(shuffle(part)) for _ in range(N_PERM if name == "dev" else N_PERM)]
        print(f"\n== Day-level statistics, {name} (real vs shuffled-day null, {N_PERM} perms) ==")
        out[name] = {}
        for k, v in real.items():
            null = np.array([p[k] for p in perms])
            z = (v - null.mean()) / (null.std() + 1e-12)
            p2 = (np.sum(np.abs(null - null.mean()) >= abs(v - null.mean())) + 1) / (len(null) + 1)
            out[name][k] = {"real": v, "nullMean": float(null.mean()), "nullSd": float(null.std()), "z": float(z), "p": float(p2)}
            print(f"  {k:22s} real={v:9.4f} null={null.mean():9.4f}±{null.std():.4f} z={z:+6.2f} p={p2:.3f}")

    # Pair-level discovery on DEV with permutation z-scores, confirmation on TEST.
    print("\n== Slot-pair links (24x24) discovered on DEV, checked on TEST ==")
    real_dev = pair_matrix(dev)
    null_dev = [pair_matrix(shuffle(dev)) for _ in range(60)]
    real_test = pair_matrix(test)
    null_test = [pair_matrix(shuffle(test)) for _ in range(60)]
    names = ["sameSutta", "bothDP", "digitOverlap"]
    S = len(SLOTS)
    pairs_out = {}
    for m, name in enumerate(names):
        nd = np.stack([x[m] for x in null_dev]); nt = np.stack([x[m] for x in null_test])
        zd = (real_dev[m] - nd.mean(0)) / (nd.std(0) + 1e-12)
        zt = (real_test[m] - nt.mean(0)) / (nt.std(0) + 1e-12)
        cand = [(zd[i, j], i, j) for i in range(S) for j in range(i + 1, S) if real_dev[3][i, j] > 300]
        cand.sort(key=lambda t: -abs(t[0]))
        n_pairs = len(cand)
        bonf = 3.29 + 0.0 * n_pairs  # |z|>3.29 ~ p<0.001 two-sided; ~0.28 false hits per 276 pairs
        sig = [c for c in cand if abs(c[0]) > bonf]
        confirmed = [c for c in sig if np.sign(zt[c[1], c[2]]) == np.sign(c[0]) and abs(zt[c[1], c[2]]) > 1.64]
        print(f"  {name}: {n_pairs} pairs, {len(sig)} with |z_dev|>3.29, {len(confirmed)} confirmed on TEST (same sign, |z|>1.64)")
        for z, i, j in cand[:8]:
            print(f"     {SLOTS[i][0]:14s}{SLOTS[i][1]:5s} ~ {SLOTS[j][0]:14s}{SLOTS[j][1]:5s} "
                  f"dev={real_dev[m][i,j]:.3f} null={nd.mean(0)[i,j]:.3f} z={z:+.2f} | test z={zt[i,j]:+.2f}")
        pairs_out[name] = [{"a": SLOTS[i], "b": SLOTS[j], "zDev": float(z), "zTest": float(zt[i, j]),
                            "devRate": float(real_dev[m][i, j]), "nullRate": float(nd.mean(0)[i, j])}
                           for z, i, j in cand[:25]]
        # global: how many dev |z|>2 vs expected under null (4.6%)
        frac2 = np.mean([abs(c[0]) > 2 for c in cand])
        print(f"     share |z_dev|>2: {frac2:.3f} (≈0.046 if no structure)")
    out["pairs"] = pairs_out
    (HERE / "dependence.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
