"""Check the TypeScript ranker reproduces the Python features + exported weights."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import PANELS, load  # noqa: E402
from research2 import FEATURES, build  # noqa: E402

HERE = Path(__file__).resolve().parent
START = "2026-07-03"


def main() -> None:
    weights = json.loads((HERE / "deploy_weights.json").read_text())
    ts = {(r["market"], r["date"]): r for r in json.loads((HERE / "top10_replay.json").read_text())["ledger"]}
    by_market = load()
    for side, name, key in (("open", "open", "prodOpen"), ("close", "close_live", "prodClose")):
        X, y, meta = build(by_market, side)
        m = [i for i, mm in enumerate(meta) if mm[1] >= START and mm in ts]
        spec = weights[name]
        cols = [FEATURES.index(f) for f in spec["features"]]
        w, mu, sd = (np.array(spec[k]) for k in ("weights", "mean", "std"))
        same_set = exact = 0
        for i in m:
            s = ((X[i][:, cols] - mu) / sd) @ w
            order = sorted(range(len(PANELS)), key=lambda p: (-s[p], p))[:10]
            py = [PANELS[p] for p in order]
            tsl = ts[meta[i]][key][:10]
            same_set += set(py) == set(tsl)
            exact += py == tsl
        print(f"{side}: {len(m)} events, identical Top-10 set {same_set}, identical order {exact}")
        del X


if __name__ == "__main__":
    main()
