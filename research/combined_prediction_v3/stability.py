"""Per-market / per-month stability of the headline candidates (descriptive)."""
import json
from pathlib import Path

import numpy as np

from study import Change, Replay, item_hits, paired

HERE = Path(__file__).resolve().parent
replay = Replay()


def grid_stats(item: dict, change: Change, group_by: str) -> list[dict]:
    baseline = change == Change()
    probs = replay.endpoint_probs(item["channel"], item["endpoint"], change)
    hits, eligible = item_hits(replay, item, probs)
    base_probs = replay.endpoint_probs(item["channel"], item["endpoint"], Change())
    base_hits, _ = item_hits(replay, item, base_probs)
    groups = replay.markets if group_by == "market" else np.array([d[:7] for d in replay.dates])
    rows = []
    for group in sorted(set(groups)):
        mask = groups == group
        use = eligible & mask
        if not use.any():
            continue
        rows.append({
            "group": str(group),
            "n": int(use.sum()),
            "baseline_hits": int(base_hits[use].sum()),
            "candidate_hits": int(hits[use].sum()),
            "delta": int(hits[use].sum() - base_hits[use].sum()),
        })
    return rows


headline = {
    "close_pre_sutta6": {"item": {"kind": "derived", "channel": "close_pre", "endpoint": "sp30", "task": "sutta6"},
                          "change": Change(present_soft=-2.0, kind_tilt=-1.0)},
    "open_sutta6": {"item": {"kind": "derived", "channel": "open", "endpoint": "sp30", "task": "sutta6"},
                     "change": Change(present_soft=2.0, kind_tilt=-1.0)},
    "close_known_sutta6": {"item": {"kind": "derived", "channel": "close_known", "endpoint": "sp30", "task": "sutta6"},
                            "change": Change(present_soft=-0.5)},
}

output = {}
for name, spec in headline.items():
    item = spec["item"]
    entry = {
        "change": spec["change"].as_dict(),
        "blocks": {},
        "by_month": grid_stats(item, spec["change"], "month"),
        "by_market": grid_stats(item, spec["change"], "market"),
    }
    probs = replay.endpoint_probs(item["channel"], item["endpoint"], spec["change"])
    base_probs = replay.endpoint_probs(item["channel"], item["endpoint"], Change())
    hits, eligible = item_hits(replay, item, probs)
    base_hits, _ = item_hits(replay, item, base_probs)
    for block in ("development", "validation", "audit", "extension"):
        mask = getattr(replay, block)
        entry["blocks"][block] = paired(replay, base_hits, hits, eligible, mask)
    entry["descriptive_all"] = paired(replay, base_hits, hits, eligible, np.ones(len(replay.rows), dtype=bool))
    output[name] = entry

# Jodi robustness for jodi_pre5 / jodi_pre6 under the selected open/close_pre sutta changes.
selection = json.loads((HERE / "selection.json").read_text(encoding="utf-8"))
chosen = {entry["channel"]: Change(**entry["selected"]["change"]) for entry in selection["items"]
          if entry["kind"] == "derived" and entry["task"] == "sutta6"}
for count in (5, 6):
    open_order = replay.sutta_order(replay.endpoint_probs("open", "sp30", chosen.get("open", Change())), count)
    close_order = replay.sutta_order(replay.endpoint_probs("close_pre", "sp30", chosen.get("close_pre", Change())), count)
    base_open = replay.sutta_order(replay.endpoint_probs("open", "sp30", Change()), count)
    base_close = replay.sutta_order(replay.endpoint_probs("close_pre", "sp30", Change()), count)
    hits = replay.jodi_hits(open_order, close_order)
    base_hits = replay.jodi_hits(base_open, base_close)
    eligible = np.ones(len(replay.rows), dtype=bool)
    entry = {"blocks": {}, "by_month": [], "by_market": []}
    for block in ("development", "validation", "audit", "extension"):
        entry["blocks"][block] = paired(replay, base_hits, hits, eligible, getattr(replay, block))
    entry["descriptive_all"] = paired(replay, base_hits, hits, eligible, eligible)
    for group_by, key in (("month", "by_month"), ("market", "by_market")):
        groups = np.array([d[:7] for d in replay.dates]) if group_by == "month" else replay.markets
        rows = []
        for group in sorted(set(groups)):
            use = groups == group
            rows.append({"group": str(group), "n": int(use.sum()),
                         "baseline_hits": int(base_hits[use].sum()), "candidate_hits": int(hits[use].sum()),
                         "delta": int(hits[use].sum() - base_hits[use].sum())})
        entry[key] = rows
    output[f"jodi_pre{count}"] = entry

(HERE / "stability.json").write_text(json.dumps(output, indent=2, allow_nan=False) + "\n", encoding="utf-8")
for name, entry in output.items():
    months = " ".join(f"{row['group']}:{row['delta']:+d}" for row in entry["by_month"])
    markets = sorted(entry["by_market"], key=lambda row: -row["delta"])
    print(f"\n{name}")
    print(f"  blocks: " + " ".join(f"{k} {v['baseline_hits']}->{v['candidate_hits']}" for k, v in entry["blocks"].items()))
    print(f"  months: {months}")
    print(f"  best markets: " + " ".join(f"{row['group']} {row['delta']:+d}/{row['n']}" for row in markets[:4]))
    print(f"  worst markets: " + " ".join(f"{row['group']} {row['delta']:+d}/{row['n']}" for row in markets[-4:]))
