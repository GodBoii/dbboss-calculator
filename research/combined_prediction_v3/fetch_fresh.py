"""Fetch the genuinely fresh window (2026-10-16 onward) after the V3 selection is frozen.

Research only: this script downloads public chart outcomes and validates them
against the already-sealed history. It never writes outside this folder and it
refuses to run if selection.json / protocol.json changed since freezing.

Identity gate: every fetched market must reproduce the sealed rows
(panel_top10_v1/chart_rows.csv + combined_prediction_v2/october_rows.csv) on the
most recent 180 overlapping dates with 100% agreement; otherwise the fetch aborts.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
V1 = ROOT / "research" / "combined_prediction_v1"
V2 = ROOT / "research" / "combined_prediction_v2"
SEALED_SOURCES = (ROOT / "research" / "panel_top10_v1" / "chart_rows.csv", V2 / "october_rows.csv")
FRESH_START = "2026-10-16"
SEALED_END = "2026-10-15"
OVERLAP_TARGET = 180
MINIMUM_OVERLAP = 100
IDENTITY_REQUIRED = 1.0

sys.path.insert(0, str(ROOT))
from research.dp_only_v1.run_research import PRIMARY, fetch_market  # noqa: E402


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_sealed() -> dict[tuple[str, str], dict]:
    rows: dict[tuple[str, str], dict] = {}
    for source in SEALED_SOURCES:
        with source.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                key = (row["market"], row["date"])
                previous = rows.get(key)
                if previous and (previous["open"], previous["close"]) != (row["open"], row["close"]):
                    raise ValueError(f"Sealed sources disagree on {key}")
                rows[key] = row
    return rows


def frozen_check() -> tuple[str, str]:
    manifest = json.loads((HERE / "selection_manifest.json").read_text(encoding="utf-8"))
    selection = sha256(HERE / "selection.json")
    protocol = sha256(HERE / "protocol.json")
    if manifest["selectionSHA256"] != selection:
        raise ValueError("selection.json changed after freezing; refusing to fetch fresh data")
    if manifest["protocolSHA256"] != protocol:
        raise ValueError("protocol.json changed after freezing; refusing to fetch fresh data")
    return selection, protocol


def main() -> None:
    if (HERE / "fresh_rows.csv").exists():
        raise ValueError("fresh_rows.csv already exists; fresh data is fetched exactly once")
    selection_sha, protocol_sha = frozen_check()
    sealed = load_sealed()
    legal = set(json.loads((V1 / "replay_metadata.json").read_text(encoding="utf-8"))["panelOrder"])
    assert len(legal) == 220
    today = date.today().isoformat()
    complete: list[dict] = []
    audits: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_market, item): item[0] for item in PRIMARY.items()}
        for future in as_completed(futures):
            market, rows, audit = future.result()
            overlap = [r for r in rows if r["date"] <= SEALED_END and (market, r["date"]) in sealed
                       and r["open"] in legal and r["close"] in legal][-OVERLAP_TARGET:]
            matched, differences = 0, []
            for row in overlap:
                previous = sealed[(market, row["date"])]
                if row["open"] == previous["open"] and row["close"] == previous["close"]:
                    matched += 1
                else:
                    differences.append({"date": row["date"], "sealed": [previous["open"], previous["close"]],
                                        "fetched": [row["open"], row["close"]]})
            identity = matched / len(overlap) if overlap else 0.0
            if len(overlap) < MINIMUM_OVERLAP or identity < IDENTITY_REQUIRED:
                raise ValueError(f"{market}: identity gate failed, {matched}/{len(overlap)} -> {differences[:5]}")
            admitted = [r for r in rows if FRESH_START <= r["date"] <= today and r["open"] in legal and r["close"] in legal]
            complete.extend(admitted)
            if not admitted:
                # Seen once and verified: a market can legitimately have no fresh
                # outcome yet (the v2 fetch on 2026-10-17T00:27Z also ended at
                # 2026-10-10 for Madhur Night). Record it instead of aborting.
                print(f"{market}: NO fresh events yet (sealed identity still {matched}/{len(overlap)})", flush=True)
            else:
                print(f"{market}: {len(admitted)} fresh events; identity {matched}/{len(overlap)}", flush=True)
            audits[market] = audit | {"overlap": len(overlap), "matched": matched, "identity": identity,
                                      "historical_differences": differences, "fresh_complete": len(admitted),
                                      "latest_fresh": admitted[-1]["date"] if admitted else None}
            print(f"{market}: {len(admitted)} fresh events; identity {matched}/{len(overlap)}", flush=True)
    if len({(r["market"], r["date"]) for r in complete}) != len(complete):
        raise ValueError("Duplicate fresh event")
    complete.sort(key=lambda r: (r["date"], r["market"]))
    with (HERE / "fresh_rows.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=("date", "market", "open", "close"))
        writer.writeheader()
        writer.writerows(complete)
    payload = {
        "fetchedAtUTC": datetime.now(timezone.utc).isoformat(),
        "freshStart": FRESH_START,
        "requestedEnd": today,
        "rows": len(complete),
        "dates": sorted({r["date"] for r in complete}),
        "csvSHA256": sha256(HERE / "fresh_rows.csv"),
        "selectionSHA256": selection_sha,
        "protocolSHA256": protocol_sha,
        "sealedSHA256": {str(source.relative_to(ROOT)).replace("\\", "/"): sha256(source) for source in SEALED_SOURCES},
        "identityGate": {"overlapTarget": OVERLAP_TARGET, "minimumOverlap": MINIMUM_OVERLAP, "requiredIdentity": IDENTITY_REQUIRED},
        "markets": audits,
    }
    (HERE / "fresh_source_audit.json").write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Saved {len(complete)} fresh rows for {len(payload['dates'])} dates under selection {selection_sha[:12]}", flush=True)


if __name__ == "__main__":
    main()
