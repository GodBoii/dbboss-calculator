"""Fetch October only after the research policy has been frozen and hashed."""
from __future__ import annotations

import csv
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from wide_models import HERE, PROTOCOL, ROOT, history_rows, save_json, sha

sys.path.insert(0, str(ROOT))
from research.dp_only_v1.run_research import PRIMARY, fetch_market  # noqa: E402


def main() -> None:
    manifest = json.loads((HERE / "freeze_manifest.json").read_text())
    for filename, expected in manifest["files"].items():
        if sha(HERE / filename) != expected:
            raise ValueError(f"Frozen research file changed: {filename}")
    old = {(r["market"], r["date"]): r for r in history_rows()}
    complete, audits = [], {}
    legal = set(__import__("wide_models").StudyReplay().panels)
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_market, item): item[0] for item in PRIMARY.items()}
        for future in as_completed(futures):
            market, rows, audit = future.result()
            matched, mismatches = 0, []
            overlap = [r for r in rows if r["date"] <= PROTOCOL["development_end"] and (market, r["date"]) in old and r["open"] in legal and r["close"] in legal][-180:]
            for row in overlap:
                previous = old[(market, row["date"])]
                if row["open"] == previous["open"] and row["close"] == previous["close"]:
                    matched += 1
                else:
                    mismatches.append({"date": row["date"], "old": [previous["open"], previous["close"]], "fetched": [row["open"], row["close"]]})
            identity = matched / len(overlap) if overlap else 0
            if len(overlap) < PROTOCOL["fresh_source_minimum_overlap"] or identity < PROTOCOL["fresh_source_minimum_identity"]:
                raise ValueError(f"{market}: source identity failed, {matched}/{len(overlap)}")
            admitted = [r for r in rows if PROTOCOL["extension_start"] <= r["date"] <= PROTOCOL["extension_end"] and r["open"] in legal and r["close"] in legal]
            if not admitted:
                raise ValueError(f"{market}: no complete extension outcomes")
            complete.extend(admitted)
            audits[market] = audit | {"overlap": len(overlap), "matched": matched, "identity": identity, "historical_differences": mismatches, "extension_complete": len(admitted), "latest_extension": admitted[-1]["date"]}
            print(f"{market}: {len(admitted)} complete extension events; identity {matched}/{len(overlap)}", flush=True)
    complete.sort(key=lambda r: (r["date"], r["market"]))
    with (HERE / "october_rows.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=("date", "market", "open", "close"))
        writer.writeheader()
        writer.writerows(complete)
    save_json(HERE / "extension_source_audit.json", {"fetchedAtUTC": datetime.now(timezone.utc).isoformat(), "requestedEnd": PROTOCOL["extension_end"], "rows": len(complete), "csvSHA256": sha(HERE / "october_rows.csv"), "frozen_policySHA256": sha(HERE / "frozen_policy.json"), "markets": audits})


if __name__ == "__main__":
    main()
