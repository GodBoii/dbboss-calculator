"""Score the frozen V3 selections on the genuinely fresh 2026-10-16+ window.

Descriptive only: the fresh window was fetched exactly once, after selection.json
was hashed, and it was never used to choose or tune any parameter. With only 14
events the numbers are a sanity check, not a powered test.

    python score_fresh.py
"""
from __future__ import annotations

import gzip
import json

import numpy as np

from study import HERE, PROTOCOL, Change, Replay, digest_bytes, item_hits, paired, selection_items, sha256, write_json


def frozen_selection() -> dict:
    manifest = json.loads((HERE / "selection_manifest.json").read_text(encoding="utf-8"))
    if manifest["selectionSHA256"] != sha256(HERE / "selection.json"):
        raise ValueError("selection.json changed after freezing")
    if manifest["protocolSHA256"] != sha256(HERE / "protocol.json"):
        raise ValueError("protocol.json changed after freezing")
    return json.loads((HERE / "selection.json").read_text(encoding="utf-8"))


def fresh_replay() -> tuple[Replay, dict]:
    meta = json.loads((HERE / "fresh_replay_metadata.json").read_text(encoding="utf-8"))
    raw = gzip.decompress((HERE / "fresh_replay.jsonl.gz").read_bytes())
    if digest_bytes(raw) != meta["sha256"]:
        raise ValueError("Fresh replay changed since export")
    rows = [json.loads(line) for line in raw.splitlines()]
    return Replay.from_rows(rows), meta


def convert(entry: dict) -> Change:
    return Change(**entry)


def main() -> None:
    selection = frozen_selection()
    replay, meta = fresh_replay()
    if meta["selectionSHA256"] != sha256(HERE / "selection.json"):
        raise ValueError("Fresh replay was exported for a different selection")
    audit = json.loads((HERE / "fresh_source_audit.json").read_text(encoding="utf-8"))
    if audit["selectionSHA256"] != sha256(HERE / "selection.json"):
        raise ValueError("Fresh rows were fetched for a different selection")
    entire = np.ones(len(replay.rows), dtype=bool)  # every fresh event is descriptive
    results = {
        "selectionSHA256": sha256(HERE / "selection.json"),
        "protocolSHA256": sha256(HERE / "protocol.json"),
        "freshReplaySHA256": meta["sha256"],
        "freshCsvSHA256": audit["csvSHA256"],
        "fetchedAtUTC": audit["fetchedAtUTC"],
        "rows": len(replay.rows),
        "dates": sorted(set(replay.dates.tolist())),
        "markets": int(len(set(replay.markets.tolist()))),
        "missingMarkets": [name for name, row in audit["markets"].items() if row["fresh_complete"] == 0],
        "items": [],
    }
    for entry in selection["items"]:
        item = {"kind": entry["kind"], "channel": entry["channel"], "endpoint": entry["endpoint"], "task": entry["task"]}
        change = convert(entry["selected"]["change"])
        baseline_probs = replay.endpoint_probs(item["channel"], item["endpoint"], Change())
        selected_probs = replay.endpoint_probs(item["channel"], item["endpoint"], change)
        baseline_hits, eligible = item_hits(replay, item, baseline_probs)
        selected_hits, _ = item_hits(replay, item, selected_probs)
        results["items"].append({
            **item, "label": change.label(),
            "fresh": paired(replay, baseline_hits, selected_hits, eligible, entire),
        })
        print(f"Fresh {item['kind']:7s} {item['channel']:11s} {item['endpoint']:6s} {item['task']:9s} -> {change.label()}", flush=True)
    chosen = {entry["channel"]: convert(entry["selected"]["change"]) for entry in selection["items"]
              if entry["kind"] == "derived" and entry["task"] == "sutta6"}
    results["jodi"] = {}
    for count in (5, 6):
        for label, close_channel in (("jodi_pre", "close_pre"), ("jodi_known", "close_known")):
            baseline_open = replay.sutta_order(replay.endpoint_probs("open", "sp30", Change()), count)
            baseline_close = replay.sutta_order(replay.endpoint_probs(close_channel, "sp30", Change()), count)
            selected_open = replay.sutta_order(replay.endpoint_probs("open", "sp30", chosen.get("open", Change())), count)
            selected_close = replay.sutta_order(replay.endpoint_probs(close_channel, "sp30", chosen.get(close_channel, Change())), count)
            results["jodi"][f"{label}{count}"] = paired(
                replay, replay.jodi_hits(baseline_open, baseline_close),
                replay.jodi_hits(selected_open, selected_close), entire, entire)
    results["probabilistic"] = {}
    for entry in selection["items"]:
        if entry["kind"] != "panel":
            continue
        channel, endpoint = entry["channel"], entry["endpoint"]
        change = convert(entry["selected"]["change"])
        key = f"{channel}/{endpoint}"
        results["probabilistic"][key] = {
            "baseline": replay.probabilistic_losses(replay.endpoint_probs(channel, endpoint, Change()), channel),
            "selected": replay.probabilistic_losses(replay.endpoint_probs(channel, endpoint, change), channel),
        }
    write_json(HERE / "fresh_results.json", results)
    print(f"Wrote fresh_results.json: {results['rows']} fresh events, {len(results['dates'])} dates, "
          f"{results['markets']} markets, missing {results['missingMarkets']}", flush=True)


if __name__ == "__main__":
    main()
