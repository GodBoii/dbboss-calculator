"""End-to-end verification of the combined-prediction-v3 study.

Checks, in order:
  1. Hash integrity of every frozen artifact (replays, policy, selection, fresh files).
  2. Causal invariants (strict prior history, block sizes, list shapes).
  3. Re-derivation: recompute the development/validation selection from the frozen
     replay and compare it with selection.json.
  4. Parity: reconstruct the production lists from the frozen replay features and
     compare them with real `buildCombinedAnalysis` output for the October samples
     (parity_production.json) and the fresh samples (parity_production_fresh.json).
  5. Fresh-source audit: identity gate results and selection pinning.

    python verify_study.py
"""
from __future__ import annotations

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from study import (HERE, PROTOCOL, ROOT, V1, V2, Change, Replay, candidate_changes, evaluate_change,
                   selection_items, sha256, write_json)

CHECKS: list[dict] = []


def check(name: str, passed: bool, detail: str = "") -> bool:
    CHECKS.append({"name": name, "pass": bool(passed), "detail": detail})
    if not passed:
        print(f"FAIL {name}: {detail}")
    return passed


def current_source_hashes() -> dict[str, str]:
    return {f"src/lib/{path.relative_to(ROOT / 'src/lib').as_posix()}": sha256(path)
            for path in sorted((ROOT / "src/lib").rglob("*.ts"))}


def reconstruction(replay: Replay, index: int, channel: str) -> dict[str, list]:
    """Rebuild the exact public production lists from one replay row."""
    probs_all = replay.endpoint_probs(channel, "all10", Change())
    probs_sp = replay.endpoint_probs(channel, "sp30", Change())
    probs_dp = replay.endpoint_probs(channel, "dp20", Change())

    def top(mask: np.ndarray, count: int, probs: np.ndarray) -> list[str]:
        allowed = np.nonzero(mask)[0]
        order = np.argsort(-probs[index, allowed], kind="stable")
        return [replay.panels[allowed[position]] for position in order[:count]]

    sutta_probs = probs_sp[index] @ replay.sutta_matrix
    suttas = [int(value) for value in np.argsort(-sutta_probs, kind="stable")[:10]]
    return {
        "suttas": suttas,
        "panelPicks": top(np.ones(len(replay.panels), dtype=bool), 10, probs_all),
        "spPicks": top(replay.kind == "SP", 30, probs_sp),
        "dpPicks": top(replay.kind == "DP", 20, probs_dp),
    }


def parity_checks(name: str, parity_path: Path, replay: Replay, row_index: dict) -> list[str]:
    parity = json.loads(parity_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    total = 0
    for key, sample in parity["samples"].items():
        row_key = (sample["date"], sample["market"])
        if row_key not in row_index:
            failures.append(f"{key}: no replay row")
            continue
        index = row_index[row_key]
        sides = [("open", "open"), ("closePre", "close_pre")]
        if sample["declared"]:
            sides.append(("closeKnown", "close_known"))
        for side_key, channel in sides:
            if sample[side_key] is None:
                failures.append(f"{key}: declared={sample['declared']} but {side_key} is null")
                continue
            rebuilt = reconstruction(replay, index, channel)
            for list_key, expected in sample[side_key].items():
                total += 1
                if rebuilt[list_key] != expected:
                    failures.append(f"{key}/{side_key}/{list_key}: rebuilt {rebuilt[list_key][:8]} != production {expected[:8]}")
    check(name, not failures, f"{total} list comparisons; " + "; ".join(failures[:4]))
    return failures


def verify() -> None:
    selection_sha = sha256(HERE / "selection.json")
    protocol_sha = sha256(HERE / "protocol.json")
    manifest = json.loads((HERE / "selection_manifest.json").read_text(encoding="utf-8"))
    check("selection frozen", manifest["selectionSHA256"] == selection_sha, "selection.json changed after freezing")
    check("protocol frozen", manifest["protocolSHA256"] == protocol_sha, "protocol.json changed after freezing")

    policy = json.loads((HERE / "production_policy.json").read_text(encoding="utf-8"))
    check("production policy source unchanged", policy["sourceSHA256"] == sha256(ROOT / policy["source"]),
          "src/lib/combined-policy.ts changed since dump_policy.cjs")

    v1_meta = json.loads((V1 / "replay_metadata.json").read_text(encoding="utf-8"))
    v2_meta = json.loads((V2 / "extension_replay_metadata.json").read_text(encoding="utf-8"))
    raw_v1 = gzip.decompress((V1 / "replay.jsonl.gz").read_bytes())
    raw_v2 = gzip.decompress((V2 / "extension_replay.jsonl.gz").read_bytes())
    check("V1 replay hash", hashlib.sha256(raw_v1).hexdigest() == v1_meta["replaySHA256"], "v1 replay changed")
    check("V2 extension hash", hashlib.sha256(raw_v2).hexdigest() == v2_meta["sha256"], "v2 extension changed")
    check("sealed source hashes consistent", v1_meta["productionSourceHashes"] == v2_meta["productionSourceHashes"],
          "v1/v2 recorded different production sources")

    selection = json.loads((HERE / "selection.json").read_text(encoding="utf-8"))
    fresh_audit = json.loads((HERE / "fresh_source_audit.json").read_text(encoding="utf-8"))
    fresh_meta = json.loads((HERE / "fresh_replay_metadata.json").read_text(encoding="utf-8"))
    fresh_parity = json.loads((HERE / "parity_production_fresh.json").read_text(encoding="utf-8"))
    feature_parity = json.loads((HERE / "feature_parity.json").read_text(encoding="utf-8"))
    october_parity = json.loads((HERE / "parity_production.json").read_text(encoding="utf-8"))
    fresh_csv_sha = sha256(HERE / "fresh_rows.csv")
    check("fresh csv hash chain", fresh_csv_sha == fresh_audit["csvSHA256"] == fresh_meta["freshCsvSHA256"] == fresh_parity["freshCsvSHA256"],
          "fresh_rows.csv does not match its audit/metadata/parity records")
    raw_fresh = gzip.decompress((HERE / "fresh_replay.jsonl.gz").read_bytes())
    fresh_sha = hashlib.sha256(raw_fresh).hexdigest()
    check("fresh replay hash chain", fresh_sha == fresh_meta["sha256"] == fresh_parity["freshReplaySHA256"],
          "fresh replay does not match its metadata/parity records")
    check("fresh data pinned to selection", fresh_audit["selectionSHA256"] == fresh_meta["selectionSHA256"] == selection_sha,
          "fresh files were produced for a different selection")
    check("feature parity passed", feature_parity["status"] == "pass",
          "current sources no longer reproduce the sealed feature values")

    hashes_now = current_source_hashes()
    for name, recorded in (("feature_parity", feature_parity["productionSourceHashes"]),
                           ("fresh_meta", fresh_meta["productionSourceHashes"]),
                           ("october parity", october_parity["productionSourceHashes"]),
                           ("fresh parity", fresh_parity["productionSourceHashes"])):
        check(f"production sources match {name}", recorded == hashes_now,
              "src/lib changed since that evidence file was produced")

    for market, row in fresh_audit["markets"].items():
        check(f"identity gate {market}", row["matched"] == row["overlap"] and row["identity"] == 1.0 and row["overlap"] >= 100,
              f"overlap {row['overlap']} matched {row['matched']}")

    replay = Replay()
    check("replay rows", len(replay.rows) == 1052, f"got {len(replay.rows)}")
    counts = {"development": int(replay.development.sum()), "validation": int(replay.validation.sum()),
              "audit": int(replay.audit.sum()), "extension": int(replay.extension.sum())}
    check("block counts", counts == selection["blocks"], f"{counts} != {selection['blocks']}")
    causal = all(row["historyMaxDate"] < row["date"] and row["historyCount"] >= PROTOCOL["minimum_history"] for row in replay.rows)
    check("strict priors", causal, "a replay row has future or short history")

    # Re-derive the selection exactly as run_study.py select does.
    candidates = candidate_changes()
    mismatches = []
    for item in selection_items():
        baseline_development, baseline_validation = evaluate_change(replay, item, Change())
        rows = [(change, *evaluate_change(replay, item, change)) for change in candidates]
        survivors = [row for row in rows if row[1]["rate"] >= baseline_development["rate"] - 1e-12]
        best = min(survivors, key=lambda row: (-row[2]["rate"], row[0].complexity(), -row[1]["rate"]))
        entry = next(e for e in selection["items"]
                     if (e["kind"], e["channel"], e["endpoint"], e["task"]) == (item["kind"], item["channel"], item["endpoint"], item["task"]))
        same = (entry["selected"]["change"] == best[0].as_dict()
                and entry["selected"]["development"] == best[1] and entry["selected"]["validation"] == best[2]
                and entry["baseline"]["development"] == baseline_development and entry["baseline"]["validation"] == baseline_validation)
        if not same:
            mismatches.append(f"{item['channel']}/{item['endpoint']}/{item['task']}")
    check("selection re-derivation", not mismatches, f"mismatched items: {mismatches}")

    row_index = {(row["date"], row["market"]): index for index, row in enumerate(replay.rows)}
    parity_checks("October parity reconstruction", HERE / "parity_production.json", replay, row_index)

    fresh_rows = [json.loads(line) for line in raw_fresh.splitlines()]
    fresh = Replay.from_rows(fresh_rows)
    fresh_dates = sorted(set(fresh.dates.tolist()))
    check("fresh dates strictly after sealed window", all(date >= "2026-10-16" for date in fresh_dates), str(fresh_dates))
    fresh_index = {(row["date"], row["market"]): index for index, row in enumerate(fresh.rows)}
    parity_checks("Fresh parity reconstruction", HERE / "parity_production_fresh.json", fresh, fresh_index)

    lengths_ok = True
    for name in ("parity_production.json", "parity_production_fresh.json"):
        for sample in json.loads((HERE / name).read_text(encoding="utf-8"))["samples"].values():
            for side in ("open", "closePre", "closeKnown"):
                if sample[side] is None:
                    continue
                for key, expected in (("panelPicks", 10), ("spPicks", 30), ("dpPicks", 20), ("suttas", 10)):
                    if len(sample[side][key]) != expected:
                        lengths_ok = False
    check("list sizes", lengths_ok, "a parity list has an unexpected length")

    payload = {
        "checks": CHECKS,
        "passed": sum(c["pass"] for c in CHECKS),
        "failed": sum(not c["pass"] for c in CHECKS),
        "selectionSHA256": selection_sha,
        "protocolSHA256": protocol_sha,
        "freshReplaySHA256": fresh_sha,
    }
    write_json(HERE / "verification.json", payload)
    print(f"verification.json: {payload['passed']} passed, {payload['failed']} failed")
    if payload["failed"]:
        sys.exit(1)


if __name__ == "__main__":
    verify()
