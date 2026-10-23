"""Fetch October 18-22 outcomes only after V5 policy freezing.

The source is retrospective public history, not a pre-event forecast registry.
Existing sealed rows remain authoritative; missing October 16-17 context is
saved separately, never silently substituted for an existing observation.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SEALED_SOURCES = (
    ROOT / "research/panel_top10_v1/chart_rows.csv",
    ROOT / "research/combined_prediction_v2/october_rows.csv",
    ROOT / "research/combined_prediction_v3/fresh_rows.csv",
)
FRESH_START, FRESH_END = "2026-10-18", "2026-10-22"
sys.path.insert(0, str(ROOT))
from research.dp_only_v1.run_research import PRIMARY, fetch_market  # noqa: E402


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def frozen_check() -> tuple[str, str]:
    manifest = json.loads((HERE / "selection_manifest.json").read_text(encoding="utf-8"))
    selection, protocol = sha256(HERE / "selection.json"), sha256(HERE / "protocol.json")
    if manifest["selectionSHA256"] != selection or manifest["protocolSHA256"] != protocol:
        raise ValueError("Selection or protocol changed after freezing")
    return selection, protocol


def main() -> None:
    if any((HERE / name).exists() for name in ("fresh_rows.csv", "fresh_context_rows.csv", "fresh_source_audit.json")):
        raise ValueError("Fresh fetch already exists; refusing to overwrite")
    selection, protocol = frozen_check()
    hashes = {str(path.relative_to(ROOT)).replace("\\", "/"): sha256(path) for path in SEALED_SOURCES}
    sealed: dict[tuple[str, str], dict] = {}
    for path in SEALED_SOURCES:
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                key = row["market"], row["date"]
                if key in sealed and sealed[key] != row:
                    raise ValueError(f"Conflicting sealed observation: {key}")
                sealed[key] = row
    legal = set(json.loads((ROOT / "research/combined_prediction_v1/replay_metadata.json").read_text())["panelOrder"])
    complete, context, audits = [], [], {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch_market, item) for item in PRIMARY.items()]
        for future in as_completed(futures):
            market, rows, audit = future.result()
            rows = sorted(rows, key=lambda row: row["date"])
            overlap = [row for row in rows if (market, row["date"]) in sealed
                       and row["open"] in legal and row["close"] in legal][-180:]
            differences = [row["date"] for row in overlap
                           if (row["open"], row["close"]) !=
                           (sealed[(market, row["date"])]["open"], sealed[(market, row["date"])]["close"])]
            if len(overlap) < 100 or differences:
                raise ValueError(f"{market}: source identity failed, overlap={len(overlap)}, differences={differences}")
            admitted = [row for row in rows if FRESH_START <= row["date"] <= FRESH_END
                        and row["open"] in legal and row["close"] in legal]
            missing_context = [row for row in rows if "2026-10-16" <= row["date"] < FRESH_START
                               and (market, row["date"]) not in sealed
                               and row["open"] in legal and row["close"] in legal]
            complete.extend(admitted)
            context.extend(missing_context)
            audits[market] = audit | {"overlap": len(overlap), "matched": len(overlap), "identity": 1.0,
                                      "fresh_complete": len(admitted), "missing_sealed_context": len(missing_context)}
            print(f"{market}: {len(admitted)} evaluation rows, {len(missing_context)} added prior context, identity {len(overlap)}/{len(overlap)}", flush=True)
    frozen_check()
    if any(sha256(ROOT / name) != value for name, value in hashes.items()):
        raise ValueError("Sealed history changed during fetch")
    for name, rows in (("fresh_rows.csv", complete), ("fresh_context_rows.csv", context)):
        rows.sort(key=lambda row: (row["date"], row["market"]))
        if len({(row["date"], row["market"]) for row in rows}) != len(rows):
            raise ValueError(f"Duplicate event in {name}")
        with (HERE / name).open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=("date", "market", "open", "close"))
            writer.writeheader()
            writer.writerows(rows)
    payload = {"fetchedAtUTC": datetime.now(timezone.utc).isoformat(), "freshStart": FRESH_START,
               "requestedEnd": FRESH_END, "rows": len(complete), "contextRows": len(context),
               "dates": sorted({row["date"] for row in complete}), "selectionSHA256": selection,
               "protocolSHA256": protocol, "csvSHA256": sha256(HERE / "fresh_rows.csv"),
               "contextCsvSHA256": sha256(HERE / "fresh_context_rows.csv"), "sealedSHA256": hashes,
               "identityGate": {"overlapTarget": 180, "minimumOverlap": 100, "requiredIdentity": 1.0},
               "markets": audits}
    (HERE / "fresh_source_audit.json").write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
