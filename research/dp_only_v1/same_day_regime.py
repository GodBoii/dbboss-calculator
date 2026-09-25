"""Conditional same-day DP rate audit using strict current-schedule ordering."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np

from extended_matrix import (
    PRIMARY,
    TRAIN_END,
    VALID_END,
    build_events,
    cohort_metrics,
    read_rows,
)

HERE = Path(__file__).resolve().parent
OUT_JSON = HERE / "same_day_regime.json"
OUT_MD = HERE / "SAME_DAY_REGIME.md"


def period_masks(events: list[dict[str, Any]]) -> dict[str, np.ndarray]:
    return {
        "train": np.array([event["day"] <= TRAIN_END for event in events]),
        "validation": np.array([TRAIN_END < event["day"] <= VALID_END for event in events]),
        "holdout": np.array([event["day"] > VALID_END for event in events]),
    }


def event_count_band(value: int) -> str:
    if value == 0:
        return "0"
    if value <= 3:
        return "1-3"
    if value <= 7:
        return "4-7"
    if value <= 11:
        return "8-11"
    if value <= 15:
        return "12-15"
    return "16+"


def prior_rate_band(value: float, event_count: int) -> str:
    if event_count == 0:
        return "no earlier events"
    if value < 0.20:
        return "<20%"
    if value < 0.30:
        return "20-29%"
    if value < 0.40:
        return "30-39%"
    return "40%+"


def main() -> None:
    rows = read_rows()
    events, _ = build_events(rows)
    selected = np.array([event["market"] in PRIMARY for event in events])
    y = np.array([event["y"] for event in events], dtype=int)
    masks = period_masks(events)
    fields = np.array([
        (
            int(event["x"]["same_day_prior_event_count"]),
            int(event["x"]["same_day_prior_dp_count"]),
            float(event["x"]["same_day_prior_dp_rate"]),
            event["market"],
            event["side"],
        )
        for event in events
    ], dtype=object)
    scoped = selected & np.array([event["x"]["has_same_day_schedule"] == 1 for event in events])
    rows_out = []
    bands = ("0", "1-3", "4-7", "8-11", "12-15", "16+")
    rate_bands = ("no earlier events", "<20%", "20-29%", "30-39%", "40%+")
    for split, split_mask in masks.items():
        current = split_mask & scoped
        for count_band in bands:
            count_selected = np.array([
                event_count_band(int(fields[i, 0])) == count_band
                for i in range(len(events))
            ])
            for rate_band in rate_bands:
                rate_selected = np.array([
                    prior_rate_band(float(fields[i, 2]), int(fields[i, 0])) == rate_band
                    for i in range(len(events))
                ])
                cell = current & count_selected & rate_selected
                summary = cohort_metrics(y, cell)
                rows_out.append({
                    "split": split,
                    "priorEventCountBand": count_band,
                    "priorDPFractionBand": rate_band,
                    **summary,
                    "activeDates": len({events[i]["day"] for i in np.flatnonzero(cell)}),
                })

    daily: dict[str, dict[str, int]] = defaultdict(lambda: {"events": 0, "dpEvents": 0})
    for index, event in enumerate(events):
        if selected[index] and event["day"].year == 2026:
            key = event["day"].isoformat()
            daily[key]["events"] += 1
            daily[key]["dpEvents"] += int(y[index])
    daily_rows = [
        {"date": day, **value, "dpRate": round(value["dpEvents"] / value["events"], 4)}
        for day, value in sorted(daily.items())
    ]
    overall = {}
    for split, split_mask in masks.items():
        current = split_mask & scoped
        overall[split] = cohort_metrics(y, current)
    report = {
        "method": "For each 12-market event, include only same-day source events scheduled strictly earlier according to current app schedule.",
        "scheduleFile": "src/lib/market-schedule.ts",
        "historicalScheduleAssumption": "Historical event times may differ from the current schedule.",
        "holdoutPristine": False,
        "holdoutReason": "Aggregate 2026 results were disclosed in earlier work.",
        "overallPrimary12": overall,
        "conditionalCells": rows_out,
        "dailyHoldoutOutcomesAfterWarmup": daily_rows,
    }
    OUT_JSON.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    lines = [
        "# Same-day DP regime audit",
        "",
        "This analysis uses same-day outcomes only when the current app schedule places them strictly before the target. Historical schedules may differ.",
        "",
        "The table groups target events by how many prior scheduled outcomes were available and by the DP share among those prior outcomes. It describes conditional rates; it does not imply a causal regime.",
        "",
        "| Split | Prior events | Earlier DP share | Events | DPs | DP rate | 95% Wilson interval | Active dates |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in rows_out:
        if row["events"] == 0:
            continue
        interval = row["wilson95"]
        lines.append(
            f"| {row['split']} | {row['priorEventCountBand']} | {row['priorDPFractionBand']} | "
            f"{row['events']:,} | {row['dpEvents']:,} | {row['dpRate']:.1%} | "
            f"{interval[0]:.1%}-{interval[1]:.1%} | {row['activeDates']:,} |"
        )
    lines.extend([
        "",
        "The daily 2026 target counts after the 320-result warmup are in same_day_regime.json. A day with a high share of early DPs contributes evidence only for later scheduled events. The full-day DP total is not available at the start of the day.",
    ])
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({
        "overallPrimary12": overall,
        "nonemptyHoldoutCells": [row for row in rows_out if row["split"] == "holdout" and row["events"]],
        "output": str(OUT_JSON),
    }, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
