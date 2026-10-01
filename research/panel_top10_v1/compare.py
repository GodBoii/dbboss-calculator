"""Final comparison: shipped TS Top-10 model vs the previous production ranker.

Weights were fit on targets <= 2026-07-02, so the 7/30/90-day windows are
out-of-sample for the shipped model. Earlier windows overlap the fit period.
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
END = "2026-09-30"
WINDOWS = {"7d": "2026-09-24", "30d": "2026-09-01", "90d": "2026-07-03"}


def main() -> None:
    old = {(r["market"], r["date"]): r for r in json.loads((HERE / "production_replay.json").read_text())["ledger"]}
    new = {(r["market"], r["date"]): r for r in json.loads((HERE / "top10_replay.json").read_text())["ledger"]}
    legacy = json.loads((HERE / "legacy_check.json").read_text())["ledger"]
    drift = sum(1 for r in legacy for s in ("prodOpen", "prodClose")
                if r[s][:10] != old[(r["market"], r["date"])][s][:10])
    print(f"legacy-path parity: {drift} of {2 * len(legacy)} Top-10 lists differ from the frozen replay")
    report = {"legacyParityDiffs": drift, "windows": {}}
    for name, start in WINDOWS.items():
        keys = [k for k in new if start <= k[1] <= END and k in old]
        row = {"n": len(keys), "random_top10_pct": round(100 * 10 / 220, 2)}
        for side, key in (("open", "prodOpen"), ("close", "prodClose")):
            o = sum(old[k][side] in old[k][key][:10] for k in keys)
            n = sum(new[k][side] in new[k][key][:10] for k in keys)
            row[side] = {"old_hits": o, "new_hits": n,
                         "old_pct": round(100 * o / len(keys), 2), "new_pct": round(100 * n / len(keys), 2)}
        report["windows"][name] = row
        print(name, json.dumps(row))
    by_market = {}
    keys = [k for k in new if WINDOWS["90d"] <= k[1] <= END and k in old]
    for k in keys:
        m = by_market.setdefault(k[0], {"n": 0, "open_old": 0, "open_new": 0, "close_old": 0, "close_new": 0})
        m["n"] += 1
        m["open_old"] += old[k]["open"] in old[k]["prodOpen"][:10]
        m["open_new"] += new[k]["open"] in new[k]["prodOpen"][:10]
        m["close_old"] += old[k]["close"] in old[k]["prodClose"][:10]
        m["close_new"] += new[k]["close"] in new[k]["prodClose"][:10]
    report["byMarket90d"] = by_market
    (HERE / "final_comparison.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
