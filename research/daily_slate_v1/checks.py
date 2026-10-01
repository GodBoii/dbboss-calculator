"""Follow-up checks for the daily slate.

1. Static baseline: always pick the 30 / 10 most frequent panels (fit period).
2. Open DP -> Close DP in the same market (the one within-day link that held
   on both DEV and TEST), per market.
3. "Hot day" theory: does a DP-heavy first half of the day raise the DP rate
   of the second half?
4. "Operator balances the day" theory: is a sutta already used today less
   likely in later draws? (sutta-seen-earlier rate by count of earlier uses)
"""

from collections import Counter, defaultdict
from datetime import date, timedelta

import numpy as np

from slate import load_slates

slates = load_slates("2016-01-01")
FIT = {d: v for d, v in slates.items() if "2023-07-01" <= d <= "2025-12-31"}
DEV = {d: v for d, v in slates.items() if d <= "2025-12-31"}
TEST = {d: v for d, v in slates.items() if d >= "2026-01-01"}
end = max(slates)
L90 = (date.fromisoformat(end) - timedelta(days=89)).isoformat()

# 1. static frequency baseline
freq = Counter(x["panel"] for v in FIT.values() for x in v)
for k in (10, 30):
    top = {p for p, _ in freq.most_common(k)}
    for name, part in (("2026", TEST), ("last90", {d: v for d, v in TEST.items() if d >= L90})):
        xs = [x for v in part.values() for x in v]
        print(f"static top{k} {name}: {np.mean([x['panel'] in top for x in xs]):.3f}")
sp_share = np.mean([not x["dp"] and len(set(x["panel"])) == 3 for v in TEST.values() for x in v])
print(f"SP share of draws in 2026: {sp_share:.3f}")

# 2. open DP -> close DP per market
print("\nP(close DP | open DP) vs P(close DP | open not DP)")
for part_name, part in (("DEV", DEV), ("TEST", TEST)):
    t = defaultdict(lambda: np.zeros((2, 2)))
    for v in part.values():
        o = {x["market"]: x for x in v if x["side"] == "open"}
        for x in v:
            if x["side"] == "close" and x["market"] in o:
                t[x["market"]][int(o[x["market"]]["dp"]), int(x["dp"])] += 1
    print(f"  {part_name}")
    for m, a in sorted(t.items()):
        p1 = a[1, 1] / a[1].sum(); p0 = a[0, 1] / a[0].sum()
        print(f"    {m:15s} openDP={p1:.3f} (n={int(a[1].sum()):4d})  openSP={p0:.3f}  lift={p1 / p0:.2f}")

# 3. hot-day theory
print("\nSecond-half DP rate by first-half DP count (draws before 17:00 vs after)")
for part_name, part in (("DEV", DEV), ("TEST", TEST)):
    rows = defaultdict(list)
    for v in part.values():
        if len(v) < 20:
            continue
        first = [x for x in v if x["time"] < 1020]; second = [x for x in v if x["time"] >= 1020]
        k = sum(x["dp"] for x in first)
        rows[min(k, 5)].append(np.mean([x["dp"] for x in second]))
    print("  " + part_name + ": " + "  ".join(f"{k}{'+' if k == 5 else ''}DP->{np.mean(r):.3f}(n={len(r)})" for k, r in sorted(rows.items())))

# 4. balancing theory
print("\nP(draw's sutta already used k times earlier today) vs uniform-expectation")
for part_name, part in (("DEV", DEV), ("TEST", TEST)):
    hits = defaultdict(lambda: [0, 0.0])
    for v in part.values():
        cnt = np.zeros(10)
        for x in sorted(v, key=lambda x: x["time"]):
            for k in range(4):
                n_with = np.sum(np.minimum(cnt, 3) == k)
                if n_with:
                    hits[k][0] += int(min(cnt[x["sutta"]], 3) == k)
                    hits[k][1] += n_with / 10
            cnt[x["sutta"]] += 1
    print("  " + part_name + ": " + "  ".join(f"used{k}{'+' if k == 3 else ''}: actual/expected={h[0] / h[1]:.3f}" for k, h in sorted(hits.items())))
