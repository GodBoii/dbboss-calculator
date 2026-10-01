"""Freeze the twelve chart histories for the Top-10 panel research (through 2026-09-30)."""

from __future__ import annotations

import csv
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from research.dp_only_v1.run_research import PRIMARY, fetch_market  # noqa: E402


OUT = Path(__file__).resolve().parent
END_DATE = "2026-09-30"


def main() -> None:
    rows = []
    sources = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_market, item): item[0] for item in PRIMARY.items()}
        for future in as_completed(futures):
            market, fetched, audit = future.result()
            filtered = [row for row in fetched if row["date"] <= END_DATE]
            rows.extend(filtered)
            sources[market] = audit | {
                "rowsThroughEndDate": len(filtered),
                "latestThroughEndDate": filtered[-1]["date"] if filtered else None,
            }
            print(f"{market}: {len(filtered)} rows through {END_DATE}", flush=True)
    rows.sort(key=lambda row: (row["date"], row["market"]))
    with (OUT / "chart_rows.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("date", "market", "open", "close"))
        writer.writeheader()
        writer.writerows(rows)
    (OUT / "sources.json").write_text(
        json.dumps({"endDate": END_DATE, "markets": sources}, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Saved {len(rows)} dated market draws")


if __name__ == "__main__":
    main()
