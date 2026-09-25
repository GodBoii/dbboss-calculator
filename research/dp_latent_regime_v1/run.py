"""Test whether a latent same-day DP rate permits selective DP calls."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from itertools import product
from math import log
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CSV = ROOT / "research/dp_only_v1/chart_rows.csv"
TIMES = {
    "Sridevi": (695, 755), "Time Bazar": (790, 850),
    "Madhur Day": (810, 870), "Rajdhani Day": (905, 1025),
    "Milan Day": (910, 1030), "Kalyan": (945, 1065),
    "Sridevi Night": (1155, 1215), "Madhur Night": (1230, 1350),
    "Milan Night": (1265, 1385), "Rajdhani Night": (1295, 1425),
    "Kalyan Night": (1305, 1425), "Main Bazar": (1320, 1450),
}
TRAIN_END = "2024-12-31"
VALID_END = "2025-12-31"


def logit(value: float) -> float:
    value = max(0.001, min(0.999, value))
    return log(value / (1 - value))


def sigmoid(value: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-np.clip(value, -30, 30)))


def wilson_lower(hits: int, calls: int, z: float = 1.645) -> float:
    if calls == 0:
        return 0
    p = hits / calls
    return (p + z * z / (2 * calls) - z * np.sqrt(p * (1 - p) / calls + z * z / (4 * calls * calls))) / (1 + z * z / calls)


def load_events() -> list[dict]:
    events = []
    with CSV.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["market"] not in TIMES:
                continue
            for side, minute in zip(("open", "close"), TIMES[row["market"]]):
                panel = row[side]
                if len(panel) != 3 or not panel.isdigit():
                    continue
                events.append({"date": row["date"], "minute": minute,
                               "market": row["market"], "side": side,
                               "key": f"{row['market']}|{side}",
                               "dp": int(len(set(panel)) == 2)})
    events.sort(key=lambda x: (x["date"], x["minute"], x["market"], x["side"]))
    return events


def feature_arrays(events: list[dict], smoothing: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    training = [e for e in events if e["date"] <= TRAIN_END]
    global_rate = np.mean([e["dp"] for e in training])
    counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for event in training:
        counts[event["key"]][0] += event["dp"]
        counts[event["key"]][1] += 1
    base = np.array([(counts[e["key"]][0] + smoothing * global_rate)
                     / (counts[e["key"]][1] + smoothing) for e in events])
    day_hits = np.zeros(len(events), dtype=float)
    day_seen = np.zeros(len(events), dtype=float)
    prev_rate = np.full(len(events), global_rate)
    prev_day_rate = global_rate
    index = 0
    while index < len(events):
        end = index + 1
        while end < len(events) and events[end]["date"] == events[index]["date"]:
            end += 1
        for position in range(index, end):
            day_hits[position] = sum(e["dp"] for e in events[index:position]
                                     if e["minute"] < events[position]["minute"])
            day_seen[position] = sum(1 for e in events[index:position]
                                     if e["minute"] < events[position]["minute"])
            prev_rate[position] = prev_day_rate
        prev_day_rate = np.mean([e["dp"] for e in events[index:end]])
        index = end
    return base, day_hits, day_seen, prev_rate


def score(y: np.ndarray, selected: np.ndarray, dates: np.ndarray) -> dict:
    calls = int(selected.sum())
    hits = int(y[selected].sum())
    active = len(set(dates[selected]))
    by_date: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for draw_date, actual, call in zip(dates, y, selected):
        if call:
            by_date[draw_date][0] += 1
            by_date[draw_date][1] += int(actual)
    daily_5_10 = [pair for pair in by_date.values() if 5 <= pair[0] <= 10]
    return {"calls": calls, "hits": hits, "precision": round(hits / calls, 4) if calls else None,
            "lower95": round(wilson_lower(hits, calls), 4), "activeDays": active,
            "days5to10": len(daily_5_10), "callsOnDays5to10": sum(x[0] for x in daily_5_10),
            "hitsOnDays5to10": sum(x[1] for x in daily_5_10),
            "perfectDays5to10": sum(x[0] == x[1] for x in daily_5_10),
            "daysAtLeast70Of5to10": sum(x[1] / x[0] >= .7 for x in daily_5_10)}


def main() -> None:
    events = load_events()
    dates = np.array([e["date"] for e in events])
    y = np.array([e["dp"] for e in events])
    valid = (dates > TRAIN_END) & (dates <= VALID_END)
    holdout = dates > VALID_END
    global_rate = np.mean(y[dates <= TRAIN_END])
    output: list[dict] = []
    best = None
    best_mask = None
    for smoothing in (20, 100, 500):
        base, day_hits, day_seen, prev_rate = feature_arrays(events, smoothing)
        for concentration, today_weight, yesterday_weight in product(
            (2, 5, 10, 20, 40), (0, .5, 1, 1.5, 2), (0, .5, 1, 1.5)
        ):
            posterior = (concentration * global_rate + day_hits) / (concentration + day_seen)
            linear = np.array([logit(x) for x in base])
            linear += today_weight * (np.array([logit(x) for x in posterior]) - logit(global_rate))
            linear += yesterday_weight * (np.array([logit(x) for x in prev_rate]) - logit(global_rate))
            probability = sigmoid(linear)
            for threshold in np.arange(.30, .701, .01):
                chosen = probability >= threshold
                selected_valid = chosen & valid
                calls = int(selected_valid.sum())
                if calls < 30 or len(set(dates[selected_valid])) < 20:
                    continue
                hits = int(y[selected_valid].sum())
                merit = (wilson_lower(hits, calls), calls)
                if best is None or merit > best[0]:
                    best = (merit, {"smoothing": smoothing, "concentration": concentration,
                                    "todayWeight": today_weight, "yesterdayWeight": yesterday_weight,
                                    "threshold": round(float(threshold), 2)})
                    best_mask = chosen
            output.append({"smoothing": smoothing, "concentration": concentration,
                           "todayWeight": today_weight, "yesterdayWeight": yesterday_weight})
    if best is not None and best_mask is not None:
        best[1]["validation"] = score(y[valid], best_mask[valid], dates[valid])
        best[1]["holdout"] = score(y[holdout], best_mask[holdout], dates[holdout])
    report = {"design": {"candidateParameterSets": len(output),
                         "thresholdsPerSet": len(np.arange(.30, .701, .01)),
                         "trainThrough": TRAIN_END, "validationThrough": VALID_END,
                         "holdoutStarts": "2026-01-01", "events": len(events),
                         "sameDayAvailability": "Only strictly earlier scheduled minutes; actual timestamps unavailable"},
              "globalTrainDpRate": round(float(global_rate), 4), "best": best[1] if best else None}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
