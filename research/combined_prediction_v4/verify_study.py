"""Independently reconstruct selected hit counts and enforce the research boundary."""
from __future__ import annotations

import json

import numpy as np

from run_study import HERE, candidates, digest, load_replay, snapshot


def main() -> None:
    results = json.loads((HERE / "results.json").read_text())
    selection = json.loads((HERE / "selection.json").read_text())
    manifest = json.loads((HERE / "input_manifest.json").read_text())
    if manifest["external_files"] != snapshot():
        raise ValueError("Files outside research folder changed")
    if results["selection_sha256"] != digest(HERE / "selection.json"):
        raise ValueError("Selection changed after evaluation")
    replay = load_replay()
    if len(replay.rows) != results["rows"]:
        raise ValueError("Replay row count changed")
    development = replay.dates <= "2026-08-16"
    validation = (replay.dates >= "2026-08-17") & (replay.dates <= "2026-09-07")
    blocks = {
        "september": (replay.dates >= "2026-09-08") & (replay.dates <= "2026-09-30"),
        "october": (replay.dates >= "2026-10-01") & (replay.dates <= "2026-10-15"),
        "oct16_17_reused": replay.dates >= "2026-10-16",
    }
    comparisons = 0
    for entry, result in zip(selection, results["items"], strict=True):
        channel, endpoint, objective = entry["key"].split("/")
        pool = candidates(replay, channel, endpoint)
        scores = {}
        for label, probs in pool.items():
            hits, _ = replay.panel_hits(channel, probs)[endpoint]
            loss = -np.log(probs[np.arange(len(replay.rows)), replay.actual(channel)])
            scores[label] = [int(hits[development].sum()), int(hits[validation].sum()),
                             float(loss[development].mean()), float(loss[validation].mean())]
        if objective == "hits":
            survivors = [k for k, v in scores.items() if v[0] >= scores["production"][0]]
            expected = min(survivors, key=lambda k: (-scores[k][1], k != "production", -scores[k][0], k))
        else:
            survivors = [k for k, v in scores.items() if v[2] <= scores["production"][2] + 1e-12]
            expected = min(survivors, key=lambda k: (scores[k][3], k != "production", k))
        if expected != entry["candidate"] or result["candidate"] != expected:
            raise ValueError(f"Selection cannot be reproduced: {entry['key']}")
        for name, mask in blocks.items():
            stats = result["blocks"][name]
            for label, field in (("production", "baseline_hits"), (expected, "candidate_hits")):
                hits, eligible = replay.panel_hits(channel, pool[label])[endpoint]
                if int(hits[mask].sum()) != stats[field] or int((eligible & mask).sum()) != stats["n"]:
                    raise ValueError(f"Count mismatch: {entry['key']}/{name}/{field}")
                comparisons += 1
    print(f"PASS: independently reproduced {len(selection)} selections and {comparisons} block hit counts; external files unchanged")


if __name__ == "__main__":
    main()
