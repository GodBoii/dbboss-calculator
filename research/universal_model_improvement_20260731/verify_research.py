"""Read-only integrity checks for the 2026-07-31 research artifacts."""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PANEL_DIR = ROOT / "research" / "panel_top60_prospective_v2"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


baseline = load(HERE / "production_baseline_ledger.json")
results = load(HERE / "results.json")
panel_source = load(PANEL_DIR / "independent_forward_records.json")
panel_results = load(PANEL_DIR / "results.json")

ledger = baseline["ledger"]
assert baseline["strictPriorDateOnly"] is True
assert len(ledger) == 3021
keys = [(row["market"], row["isoDate"]) for row in ledger]
assert len(keys) == len(set(keys)), "Duplicate market-date baseline rows"
assert all(
    baseline["startDate"] <= row["isoDate"] <= baseline["endDate"] for row in ledger
)

blocks = {
    name: (date.fromisoformat(bounds[0]), date.fromisoformat(bounds[1]))
    for name, bounds in results["blocks"].items()
}
ordered = list(blocks.values())
assert all(ordered[i][1] < ordered[i + 1][0] for i in range(len(ordered) - 1))
assert results["baseline"]["rows"] == len(ledger)
assert results["hypothesisCounts"] == {"open": 109, "close": 109}

forward_rows = [
    row
    for market_rows in panel_source["forward"].values()
    for row in market_rows
]
assert len(forward_rows) == 110
panel_dates = sorted({row["isoDate"] for row in forward_rows})
assert (panel_dates[0], panel_dates[-1]) == ("2026-07-20", "2026-07-30")
assert all(
    audit["validationMatchRate"] == 1
    for audit in panel_source["audit"].values()
    if audit["identityAccepted"]
)
assert panel_results["design"]["newRows"] == 110
assert panel_results["design"]["promotionMinimumProspectiveRows"] == 100
assert all(not task["promotion"]["eligible"] for task in panel_results["tasks"].values())
assert all(
    not any("Only 44" in reason for reason in task["promotion"]["reasons"])
    for task in panel_results["tasks"].values()
)

with (PANEL_DIR / "ledger.csv").open(newline="", encoding="utf-8") as handle:
    panel_ledger = list(csv.DictReader(handle))
assert len(panel_ledger) == 220, "Expected Open and Close scoring rows for all 110 outcomes"

required = [
    HERE / "FINAL_RESEARCH_REPORT.md",
    HERE / "REPORT.md",
    HERE / "JOURNAL.md",
    ROOT / "backtest_reports" / "2026-07-31"
    / "2026-07-27-to-2026-07-30-production-backtest.md",
]
assert all(path.is_file() and path.stat().st_size > 0 for path in required)

print("PASS: 3,021 unique causal production rows")
print("PASS: five non-overlapping chronological evaluation blocks")
print("PASS: 109 Open and 109 Close sutta experts recorded")
print("PASS: 110 independent panel outcomes, 2026-07-20 through 2026-07-30")
print("PASS: 220 panel task ledger rows and no promoted challenger")
print("PASS: final report and dated backtest artifacts present")
