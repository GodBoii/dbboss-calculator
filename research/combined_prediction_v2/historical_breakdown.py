"""Publish every market's earlier-block result for each frozen panel policy."""
from __future__ import annotations

import csv
import json

import numpy as np

from wide_models import HERE, PROTOCOL, StudyReplay, Weights
from wide_search import TASKS


def main() -> None:
    frozen = json.loads((HERE / "frozen_policy.json").read_text())
    v1 = json.loads((HERE.parent / "combined_prediction_v1/selection.json").read_text())
    replay = StudyReplay()
    rows = []
    for channel in PROTOCOL["channels"]:
        history = np.load(HERE / f"history_{channel}.npz")["hits"]
        for ti, task in enumerate(TASKS):
            spec = frozen["channels"][channel]["static"]["tasks"][task]
            baseline = history[spec["baseline"], :, ti]
            kind = PROTOCOL["tasks"][task][0]
            eligible = np.ones(len(baseline), dtype=bool) if kind == "all" else replay.kind[replay.actual(channel)] == kind
            policies = {name: history[spec[name], :, ti] for name in ("global_mean", "global_stable")}
            for strength, mapping in spec["market_shrink"].items():
                value = policies["global_stable"].copy()
                for market, index in mapping.items():
                    mask = replay.markets == market
                    value[mask] = history[index, mask, ti]
                policies["market_shrink_" + strength] = value
            for family, index in spec["family_leaders"].items():
                policies["family/" + family] = history[index, :, ti]
            old = v1["channels"][channel]["tasks"][task]
            scores = replay.scores(channel, Weights(**old["selected"]))
            policies["v1_global"] = replay.hits(channel, task, scores)[0]
            for market, route in old["market_routes"].items():
                mask = replay.markets == market
                scores[mask] = replay.scores(channel, Weights(**route["weights"]))[mask]
            policies["v1_routed"] = replay.hits(channel, task, scores)[0]
            for block, (start, end) in enumerate(PROTOCOL["blocks"], 1):
                for market in sorted(set(replay.markets)):
                    use = (replay.markets == market) & (replay.dates >= start) & (replay.dates <= end) & eligible
                    for name, hits in policies.items():
                        rows.append([block, start, end, channel, task, name, market, int(use.sum()), int(baseline[use].sum()), int(hits[use].sum()), int(hits[use].sum()-baseline[use].sum())])
    with (HERE / "historical_market_matrix.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["exploratory_block", "start", "end", "channel", "task", "policy", "market", "n", "baseline_hits", "candidate_hits", "net_hits"])
        writer.writerows(rows)
    print(f"Saved {len(rows)} historical market/block comparisons. Historical policy selection reused these dates.")


if __name__ == "__main__":
    main()
