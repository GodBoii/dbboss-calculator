"""Reconcile isolated extended chart history against the trusted two-year cache."""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = ROOT / "scratch" / "open-sutta-records-cache.json"
EXTENDED = HERE / "extended_records.json"
OUTPUT = HERE / "extended_audit.json"
REPORT = HERE / "EXTENDED_AUDIT.md"
DAY_OFFSETS = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def all_panels() -> set[str]:
    order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    return {
        f"{order[i]}{order[j]}{order[k]}"
        for i in range(10) for j in range(i, 10) for k in range(j, 10)
    }


PANELS = all_panels()


def iso_date(record: dict[str, Any]) -> str:
    raw = record["dateRangeStart"].replace("-", "/")
    day, month, year = (int(value) for value in raw.split("/"))
    if year < 100:
        year += 2000
    return (date(year, month, day) + timedelta(days=DAY_OFFSETS.get(record["day"], 0))).isoformat()


def sutta(panel: str) -> int:
    return sum(int(digit) for digit in panel) % 10


def entropy(values: list[str]) -> float:
    counts = Counter(values)
    total = len(values)
    return -sum((count / total) * math.log2(count / total) for count in counts.values()) if total else 0.0


def js_divergence(left: list[str], right: list[str]) -> float:
    left_counts = Counter(left)
    right_counts = Counter(right)
    left_total = max(1, len(left))
    right_total = max(1, len(right))
    result = 0.0
    for panel in PANELS:
        p = left_counts[panel] / left_total
        q = right_counts[panel] / right_total
        m = (p + q) / 2
        if p:
            result += 0.5 * p * math.log2(p / m)
        if q:
            result += 0.5 * q * math.log2(q / m)
    return result


def main() -> None:
    cache_bytes = CACHE.read_bytes()
    extended_bytes = EXTENDED.read_bytes()
    cache = json.loads(cache_bytes)
    extended_payload = json.loads(extended_bytes)
    extended = extended_payload["extended"]
    market_results: dict[str, Any] = {}
    total_overlap = total_exact = total_missing = total_invalid = 0
    mismatch_examples: list[dict[str, Any]] = []

    for market, cache_records in cache.items():
        live_records = extended.get(market, [])
        cache_by_date = {iso_date(record): record for record in cache_records}
        live_by_date = {iso_date(record): record for record in live_records}
        overlap_dates = sorted(set(cache_by_date) & set(live_by_date))
        missing_dates = sorted(set(cache_by_date) - set(live_by_date))
        exact = 0
        invalid = 0
        sutta_mismatches = 0
        for raw_date, record in live_by_date.items():
            open_panel = str(record.get("openPanel", ""))
            close_panel = str(record.get("closePanel", ""))
            if open_panel not in PANELS or close_panel not in PANELS:
                invalid += 1
            if record.get("openSutta") != sutta(open_panel) or record.get("closeSutta") != sutta(close_panel):
                sutta_mismatches += 1
        for raw_date in overlap_dates:
            cached = cache_by_date[raw_date]
            live = live_by_date[raw_date]
            same = (
                cached.get("openPanel") == live.get("openPanel")
                and cached.get("closePanel") == live.get("closePanel")
                and int(cached.get("openSutta")) == int(live.get("openSutta"))
                and int(cached.get("closeSutta")) == int(live.get("closeSutta"))
            )
            if same:
                exact += 1
            elif len(mismatch_examples) < 30:
                mismatch_examples.append({
                    "market": market, "date": raw_date,
                    "cache": {key: cached.get(key) for key in ("openPanel", "openSutta", "closePanel", "closeSutta")},
                    "extended": {key: live.get(key) for key in ("openPanel", "openSutta", "closePanel", "closeSutta")},
                })

        pre_cutoff = [record for record in live_records if iso_date(record) < "2024-07-01"]
        recent = [record for record in live_records if iso_date(record) >= "2024-07-01"]
        annual = Counter(iso_date(record)[:4] for record in live_records)
        market_results[market] = {
            "extendedRows": len(live_records),
            "firstDate": min(live_by_date) if live_by_date else None,
            "lastDate": max(live_by_date) if live_by_date else None,
            "annualRows": dict(sorted(annual.items())),
            "cacheRows": len(cache_records),
            "overlapRows": len(overlap_dates),
            "exactOverlapRows": exact,
            "exactOverlapRate": exact / len(overlap_dates) if overlap_dates else 0.0,
            "cacheDatesMissingFromExtended": len(missing_dates),
            "missingExamples": missing_dates[:10],
            "invalidPanelRows": invalid,
            "suttaMismatchRows": sutta_mismatches,
            "olderRowsBefore2024July": len(pre_cutoff),
            "openEntropyOlder": entropy([record["openPanel"] for record in pre_cutoff]),
            "openEntropyRecent": entropy([record["openPanel"] for record in recent]),
            "closeEntropyOlder": entropy([record["closePanel"] for record in pre_cutoff]),
            "closeEntropyRecent": entropy([record["closePanel"] for record in recent]),
            "openOldRecentJSDivergence": js_divergence(
                [record["openPanel"] for record in pre_cutoff], [record["openPanel"] for record in recent]
            ),
            "closeOldRecentJSDivergence": js_divergence(
                [record["closePanel"] for record in pre_cutoff], [record["closePanel"] for record in recent]
            ),
        }
        total_overlap += len(overlap_dates)
        total_exact += exact
        total_missing += len(missing_dates)
        total_invalid += invalid

    payload = {
        "cacheSha256": hashlib.sha256(cache_bytes).hexdigest(),
        "extendedSha256": hashlib.sha256(extended_bytes).hexdigest(),
        "extendedGeneratedAt": extended_payload.get("generatedAt"),
        "totals": {
            "extendedRows": sum(row["extendedRows"] for row in market_results.values()),
            "cacheRows": sum(row["cacheRows"] for row in market_results.values()),
            "overlapRows": total_overlap,
            "exactOverlapRows": total_exact,
            "exactOverlapRate": total_exact / total_overlap if total_overlap else 0.0,
            "cacheDatesMissingFromExtended": total_missing,
            "invalidPanelRows": total_invalid,
        },
        "safeForResearch": total_overlap > 0 and total_exact / total_overlap >= 0.995 and total_invalid == 0,
        "safeAfterDroppingInvalidRows": total_overlap > 0 and total_exact / total_overlap >= 0.995,
        "markets": market_results,
        "mismatchExamples": mismatch_examples,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Extended-history reconciliation",
        "",
        f"Extended rows: {payload['totals']['extendedRows']:,}; trusted cache rows: {payload['totals']['cacheRows']:,}.",
        f"Exact overlapping records: {payload['totals']['exactOverlapRows']:,}/{payload['totals']['overlapRows']:,} "
        f"({100 * payload['totals']['exactOverlapRate']:.3f}%).",
        f"Invalid panel rows: {payload['totals']['invalidPanelRows']}; cache dates absent from extended source: "
        f"{payload['totals']['cacheDatesMissingFromExtended']}.",
        f"Raw research safety gate: **{'PASS' if payload['safeForResearch'] else 'FAIL'}**. "
        f"Gate after dropping non-canonical rows: **{'PASS' if payload['safeAfterDroppingInvalidRows'] else 'FAIL'}**.",
        "",
        "| Market | Extended | Date range | Exact overlap | Older rows | Open JS drift | Close JS drift |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for market, row in market_results.items():
        lines.append(
            f"| {market} | {row['extendedRows']} | {row['firstDate']} to {row['lastDate']} | "
            f"{row['exactOverlapRows']}/{row['overlapRows']} ({100 * row['exactOverlapRate']:.1f}%) | "
            f"{row['olderRowsBefore2024July']} | {row['openOldRecentJSDivergence']:.3f} | "
            f"{row['closeOldRecentJSDivergence']:.3f} |"
        )
    if mismatch_examples:
        lines.extend([
            "", "## Mismatch warning", "",
            "See `extended_audit.json` for record-level examples. Training must not proceed until the "
            "mismatch mechanism is understood or conflicting rows are resolved in favor of the trusted cache.",
        ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(payload["totals"], indent=2))
    print(f"safeForResearch={payload['safeForResearch']}")


if __name__ == "__main__":
    main()
