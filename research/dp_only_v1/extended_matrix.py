"""Offline DP research matrix. Reads the archived CSV and writes research outputs only."""
from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Callable

import numpy as np
from scipy.stats import beta, binomtest
from sklearn.ensemble import (
    AdaBoostClassifier,
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import BernoulliNB, GaussianNB
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import Binarizer, StandardScaler
from sklearn.tree import DecisionTreeClassifier

HERE = Path(__file__).resolve().parent
DATA = HERE / "chart_rows.csv"
OUT_JSON = HERE / "extended_results.json"
OUT_MD = HERE / "EXTENDED_REPORT.md"
TRAIN_END = date(2023, 12, 31)
VALID_END = date(2025, 12, 31)
MIN_HISTORY = 320
MIN_CALLS = 30
MIN_ACTIVE_DAYS = 10
Z95_ONE_SIDED = 1.6448536269514722

PRIMARY = {
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day",
    "Kalyan", "Sridevi Night", "Kalyan Night", "Madhur Night",
    "Milan Night", "Rajdhani Night", "Main Bazar",
}
# Current schedule copied from src/lib/market-schedule.ts. Historical timing
# changes are possible, so this supplies a stated ordering assumption only.
SCHEDULE = {
    "Sridevi": (695, 755), "Time Bazar": (790, 850), "Madhur Day": (810, 870),
    "Rajdhani Day": (905, 1025), "Milan Day": (910, 1030), "Kalyan": (945, 1065),
    "Sridevi Night": (1155, 1215), "Madhur Night": (1230, 1350),
    "Milan Night": (1265, 1385), "Rajdhani Night": (1295, 1425),
    "Kalyan Night": (1305, 1425), "Main Bazar": (1320, 1450),
}
WINDOWS = (5, 10, 20, 40, 80, 160, 320)
PATTERN_FEATURES = (
    "rate_5", "rate_10", "rate_20", "rate_40", "rate_80",
    "gap_dp_events", "dp_run", "non_dp_run",
    "same_day_prior_dp_count", "same_day_prior_dp_rate",
)
THEORY_FEATURES = (
    "lag1_dp", "rate_20", "rate_80", "gap_dp_events", "dp_run",
    "same_day_prior_dp_rate", "prev_day_other_dp_rate",
    "prior_panel_entropy", "market_prior_dp_rate", "weekday_prior_dp_rate",
)


def panel_kind(panel: str) -> int:
    if not re.fullmatch(r"\d{3}", panel):
        raise ValueError(f"Invalid 3-digit panel: {panel!r}")
    return int(len(set(panel)) == 2)


def geometry(panel: str) -> tuple[float, float, float]:
    digits = [int(d) for d in panel]
    counts = Counter(digits)
    entropy = -sum((n / 3) * math.log2(n / 3) for n in counts.values())
    return float(sum(digits)), float(max(digits) - min(digits)), entropy


def safe_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def read_rows() -> list[dict[str, str]]:
    with DATA.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("Archived chart_rows.csv is empty")
    seen: set[tuple[str, str]] = set()
    for row in rows:
        date.fromisoformat(row["date"])
        key = (row["date"], row["market"])
        if key in seen:
            raise ValueError(f"Duplicate date/market chart row: {key}")
        seen.add(key)
        panel_kind(row["open"])
        panel_kind(row["close"])
    return sorted(rows, key=lambda row: (row["date"], row["market"]))


def feature_names(markets: list[str]) -> list[str]:
    names = [
        "side_close", "weekday_sin", "weekday_cos", "month_sin", "month_cos",
        "day_of_month", "day_year_sin", "day_year_cos",
        "lag1_dp", "lag2_dp", "lag3_dp", "lag4_dp", "lag5_dp",
        "rate_5", "rate_10", "rate_20", "rate_40", "rate_80", "rate_160", "rate_320",
        "gap_dp_events", "gap_dp_days", "dp_run", "non_dp_run",
        "opposite_lag1_dp", "opposite_rate_10", "opposite_rate_40",
        "same_market_expanding_rate", "market_prior_dp_rate",
        "weekday_prior_dp_rate", "month_prior_dp_rate",
        "prior_panel_sum", "prior_panel_spread", "prior_panel_entropy",
        "prior_panel_sum_rate_20", "prior_panel_spread_rate_20",
        "prev_day_other_dp_count", "prev_day_other_event_count", "prev_day_other_dp_rate",
        "has_same_day_schedule", "same_day_prior_event_count", "same_day_prior_dp_count",
        "same_day_prior_dp_rate", "same_day_prior_open_dp_count",
        "same_day_prior_close_dp_count", "same_day_prior_market_dp_count",
    ]
    names.extend("market_" + safe_name(market) for market in markets)
    return names


def daily_base_check(rows: list[dict[str, str]]) -> dict[str, Any]:
    totals: Counter[date] = Counter()
    dp_counts: Counter[date] = Counter()
    for row in rows:
        if row["market"] not in PRIMARY:
            continue
        day = date.fromisoformat(row["date"])
        for side in ("open", "close"):
            totals[day] += 1
            dp_counts[day] += panel_kind(row[side])
    covered = [
        (day, totals[day], dp_counts[day])
        for day in totals
        if day >= date(2026, 1, 1) and totals[day] >= 20
    ]
    return {
        "daysWithAtLeast20Of24PrimaryOutcomes": len(covered),
        "meanDpCount": round(float(np.mean([x[2] for x in covered])), 4) if covered else None,
        "minDpCount": min((x[2] for x in covered), default=None),
        "maxDpCount": max((x[2] for x in covered), default=None),
        "meanOutcomeCount": round(float(np.mean([x[1] for x in covered])), 4) if covered else None,
    }


def build_events(rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[str]]:
    markets = sorted({row["market"] for row in rows})
    names = feature_names(markets)
    by_market: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_day: dict[date, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in rows:
        day = date.fromisoformat(row["date"])
        by_market[row["market"]].append(row)
        by_day[day][row["market"]] = row

    events: list[dict[str, Any]] = []
    for market, series in by_market.items():
        history: dict[str, list[tuple[date, int, str]]] = {"open": [], "close": []}
        for row in series:
            day = date.fromisoformat(row["date"])
            week = day.weekday()
            year_day = day.timetuple().tm_yday
            same_date = by_day[day]
            date_before = day - timedelta(days=1)
            for side in ("open", "close"):
                past = history[side]
                labels = [item[1] for item in past]
                other_side = "close" if side == "open" else "open"
                opposite = history[other_side]
                if len(labels) >= MIN_HISTORY:
                    previous_panel = past[-1][2]
                    panel_sum, panel_spread, panel_entropy = geometry(previous_panel)
                    prior_weekday = [label for old_day, label, _ in past if old_day.weekday() == week]
                    prior_month = [label for old_day, label, _ in past if old_day.month == day.month]
                    last_dp = next((i for i in range(len(labels) - 1, -1, -1) if labels[i]), None)
                    gap = len(labels) - 1 - last_dp if last_dp is not None else len(labels)
                    gap_days = (day - past[last_dp][0]).days if last_dp is not None else (day - past[0][0]).days
                    dp_run = 0
                    for label in reversed(labels):
                        if label != 1:
                            break
                        dp_run += 1
                    non_dp_run = 0
                    for label in reversed(labels):
                        if label != 0:
                            break
                        non_dp_run += 1

                    schedule_available = market in PRIMARY
                    same_day_prior: list[tuple[int, str, int]] = []
                    timing = SCHEDULE.get(market)
                    if timing is not None:
                        target_minute = timing[0 if side == "open" else 1]
                        for source_market, source_row in same_date.items():
                            source_timing = SCHEDULE.get(source_market)
                            if source_timing is None:
                                continue
                            for source_side, source_minute in (
                                ("open", source_timing[0]), ("close", source_timing[1])
                            ):
                                if source_minute < target_minute:
                                    same_day_prior.append(
                                        (source_minute, source_side, panel_kind(source_row[source_side]))
                                    )
                    same_day_prior.sort(key=lambda item: item[0])
                    same_day_labels = [item[2] for item in same_day_prior]
                    yesterday = [
                        panel_kind(day_row[source_side])
                        for other_market, day_row in by_day.get(date_before, {}).items()
                        if other_market != market
                        for source_side in ("open", "close")
                    ]
                    prior_geometry = [geometry(item[2]) for item in past[-20:]]
                    values: dict[str, float] = {
                        "side_close": float(side == "close"),
                        "weekday_sin": math.sin(2 * math.pi * week / 7),
                        "weekday_cos": math.cos(2 * math.pi * week / 7),
                        "month_sin": math.sin(2 * math.pi * (day.month - 1) / 12),
                        "month_cos": math.cos(2 * math.pi * (day.month - 1) / 12),
                        "day_of_month": float(day.day),
                        "day_year_sin": math.sin(2 * math.pi * year_day / 366),
                        "day_year_cos": math.cos(2 * math.pi * year_day / 366),
                        "lag1_dp": float(labels[-1]), "lag2_dp": float(labels[-2]),
                        "lag3_dp": float(labels[-3]), "lag4_dp": float(labels[-4]),
                        "lag5_dp": float(labels[-5]),
                        "gap_dp_events": float(gap), "gap_dp_days": float(gap_days),
                        "dp_run": float(dp_run), "non_dp_run": float(non_dp_run),
                        "opposite_lag1_dp": float(opposite[-1][1]) if opposite else 0.0,
                        "opposite_rate_10": float(np.mean([x[1] for x in opposite[-10:]])) if opposite else 0.0,
                        "opposite_rate_40": float(np.mean([x[1] for x in opposite[-40:]])) if len(opposite) >= 40 else 0.0,
                        "same_market_expanding_rate": float(np.mean(labels)),
                        "market_prior_dp_rate": float(np.mean(labels)),
                        "weekday_prior_dp_rate": float(np.mean(prior_weekday)) if prior_weekday else float(np.mean(labels)),
                        "month_prior_dp_rate": float(np.mean(prior_month)) if prior_month else float(np.mean(labels)),
                        "prior_panel_sum": panel_sum, "prior_panel_spread": panel_spread,
                        "prior_panel_entropy": panel_entropy,
                        "prior_panel_sum_rate_20": float(np.mean([x[0] for x in prior_geometry])),
                        "prior_panel_spread_rate_20": float(np.mean([x[1] for x in prior_geometry])),
                        "prev_day_other_dp_count": float(sum(yesterday)),
                        "prev_day_other_event_count": float(len(yesterday)),
                        "prev_day_other_dp_rate": float(np.mean(yesterday)) if yesterday else 0.0,
                        "has_same_day_schedule": float(schedule_available),
                        "same_day_prior_event_count": float(len(same_day_prior)),
                        "same_day_prior_dp_count": float(sum(same_day_labels)),
                        "same_day_prior_dp_rate": float(np.mean(same_day_labels)) if same_day_labels else 0.0,
                        "same_day_prior_open_dp_count": float(sum(x[2] for x in same_day_prior if x[1] == "open")),
                        "same_day_prior_close_dp_count": float(sum(x[2] for x in same_day_prior if x[1] == "close")),
                        "same_day_prior_market_dp_count": float(sum(x[2] for x in same_day_prior)),
                    }
                    for window in WINDOWS:
                        values[f"rate_{window}"] = float(np.mean(labels[-window:]))
                    for candidate_market in markets:
                        values["market_" + safe_name(candidate_market)] = float(market == candidate_market)
                    events.append({
                        "day": day, "market": market, "side": side,
                        "y": panel_kind(row[side]), "x": values,
                    })
            # Append only after both target sides are featurized. This prevents
            # the current Close outcome leaking into the current Open features.
            for side in ("open", "close"):
                history[side].append((day, panel_kind(row[side]), row[side]))
    events.sort(key=lambda item: (item["day"], item["market"], item["side"]))
    return events, names


def split_masks(events: list[dict[str, Any]]) -> dict[str, np.ndarray]:
    return {
        "train": np.array([event["day"] <= TRAIN_END for event in events]),
        "validation": np.array([TRAIN_END < event["day"] <= VALID_END for event in events]),
        "holdout": np.array([event["day"] > VALID_END for event in events]),
    }


def lower_wilson(hits: int, count: int, z: float = Z95_ONE_SIDED) -> float:
    if count == 0:
        return 0.0
    p = hits / count
    den = 1 + z * z / count
    return (p + z * z / (2 * count) - z * math.sqrt(p * (1 - p) / count + z * z / (4 * count * count))) / den


def lower_cp(hits: int, count: int) -> float:
    if count == 0 or hits == 0:
        return 0.0
    return float(beta.ppf(0.05, hits, count - hits + 1))


def daily_stats(y: np.ndarray, selected: np.ndarray, days: list[date]) -> dict[str, Any]:
    result: dict[date, list[int]] = defaultdict(list)
    for label, use, day in zip(y, selected, days):
        if use:
            result[day].append(int(label))
    if not result:
        return {"activeDays": 0, "perfectDays": 0, "daysAtLeast90Percent": 0, "meanDailyPrecision": None, "medianDailyPrecision": None, "byCallsPerDay": {}}
    rates = [sum(values) / len(values) for values in result.values()]
    histogram: dict[str, Any] = {}
    for n in sorted({len(values) for values in result.values()}):
        group = [values for values in result.values() if len(values) == n]
        calls = len(group) * n
        hits = sum(sum(values) for values in group)
        histogram[str(n)] = {
            "days": len(group), "calls": calls, "hits": hits,
            "precision": round(hits / calls, 4),
            "perfectDays": sum(all(value == 1 for value in values) for values in group),
        }
    return {
        "activeDays": len(result),
        "perfectDays": sum(all(value == 1 for value in values) for values in result.values()),
        "daysAtLeast90Percent": sum(sum(v) / len(v) >= 0.9 for v in result.values()),
        "meanDailyPrecision": round(float(np.mean(rates)), 4),
        "medianDailyPrecision": round(float(np.median(rates)), 4),
        "byCallsPerDay": histogram,
    }


def metrics(y: np.ndarray, selected: np.ndarray, days: list[date]) -> dict[str, Any]:
    calls = int(selected.sum())
    hits = int(y[selected].sum()) if calls else 0
    return {
        "events": len(y), "calls": calls, "hits": hits, "falseCalls": calls - hits,
        "precision": round(hits / calls, 4) if calls else None,
        "coverage": round(calls / len(y), 6) if len(y) else 0.0,
        "wilsonLowerOneSided95": round(lower_wilson(hits, calls), 4) if calls else None,
        "clopperPearsonLowerOneSided95": round(lower_cp(hits, calls), 4) if calls else None,
        "supports90PercentAt95Confidence": calls >= MIN_CALLS and lower_cp(hits, calls) >= 0.90,
        "daily": daily_stats(y, selected, days),
    }


def cohort_metrics(y: np.ndarray, mask: np.ndarray) -> dict[str, Any]:
    n = int(mask.sum())
    hits = int(y[mask].sum()) if n else 0
    if not n:
        return {"events": 0, "dpEvents": 0, "dpRate": None, "wilson95": None}
    p, z = hits / n, 1.959963984540054
    den = 1 + z * z / n
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return {
        "events": n, "dpEvents": hits, "dpRate": round(p, 4),
        "wilson95": [round((p + z * z / (2 * n) - half) / den, 4),
                     round((p + z * z / (2 * n) + half) / den, 4)],
    }


def scenarios(events: list[dict[str, Any]], y: np.ndarray, masks: dict[str, np.ndarray]) -> list[dict[str, Any]]:
    definitions: list[tuple[str, Callable[[dict[str, Any]], bool]]] = []
    markets = sorted({event["market"] for event in events})
    for market in markets:
        for side in ("open", "close"):
            definitions.append((f"market_side:{market}:{side}", lambda e, m=market, s=side: e["market"] == m and e["side"] == s))
    for weekday in range(7):
        for side in ("open", "close"):
            definitions.append((f"weekday_side:{weekday}:{side}", lambda e, w=weekday, s=side: e["day"].weekday() == w and e["side"] == s))
    for month in range(1, 13):
        for side in ("open", "close"):
            definitions.append((f"month_side:{month}:{side}", lambda e, m=month, s=side: e["day"].month == m and e["side"] == s))
    periods = [
        ("2013-2015", date(2013, 1, 1), date(2015, 12, 31)),
        ("2016-2018", date(2016, 1, 1), date(2018, 12, 31)),
        ("2019-2021", date(2019, 1, 1), date(2021, 12, 31)),
        ("2022-2023", date(2022, 1, 1), date(2023, 12, 31)),
        ("2024", date(2024, 1, 1), date(2024, 12, 31)),
        ("2025-H1", date(2025, 1, 1), date(2025, 6, 30)),
        ("2025-H2", date(2025, 7, 1), date(2025, 12, 31)),
        ("2026-holdout", date(2026, 1, 1), date(2026, 12, 31)),
    ]
    for label, start, end in periods:
        for side in ("open", "close"):
            definitions.append((f"period_side:{label}:{side}", lambda e, a=start, b=end, s=side: a <= e["day"] <= b and e["side"] == s))
    for side in ("open", "close"):
        definitions.append((f"primary12_side:{side}", lambda e, s=side: e["market"] in PRIMARY and e["side"] == s))
    if len(definitions) != 100:
        raise AssertionError(f"Expected 100 scenario cohorts, got {len(definitions)}")
    output = []
    for label, predicate in definitions:
        cohort = np.array([predicate(event) for event in events])
        output.append({
            "scenario": label,
            **{split: cohort_metrics(y, cohort & split_mask) for split, split_mask in masks.items()},
        })
    return output


def catalog_rules(
    X: np.ndarray, names: list[str], train_mask: np.ndarray, feature_set: tuple[str, ...],
    prefix: str, family_fn: Callable[[str], str],
) -> list[dict[str, Any]]:
    output = []
    percentiles = np.linspace(0.1, 1.0, 10)
    for feature in feature_set:
        column = X[train_mask, names.index(feature)]
        column = column[np.isfinite(column)]
        for level, quantile in enumerate(percentiles, start=1):
            output.append({
                "id": f"{prefix}:{feature}:q{level:02d}",
                "family": family_fn(feature),
                "feature": feature,
                "quantile": round(float(quantile), 2),
                "direction": ">=" if level % 2 else "<=",
                "threshold": round(float(np.quantile(column, quantile)), 8),
            })
    if len(output) != 100:
        raise AssertionError(f"Expected 100 rule configurations, got {len(output)}")
    return output


def gate(rule: dict[str, Any], X: np.ndarray, names: list[str]) -> np.ndarray:
    column = X[:, names.index(rule["feature"])]
    mask = np.isfinite(column)
    if rule["feature"].startswith("same_day_"):
        mask &= X[:, names.index("has_same_day_schedule")] == 1
    if rule["direction"] == ">=":
        return mask & (column >= rule["threshold"])
    return mask & (column <= rule["threshold"])


def run_patterns(events: list[dict[str, Any]], X: np.ndarray, names: list[str], y: np.ndarray, masks: dict[str, np.ndarray]) -> dict[str, Any]:
    catalog = catalog_rules(
        X, names, masks["train"], PATTERN_FEATURES, "sequence_pattern",
        lambda feature: (
            "trailing DP frequency" if feature.startswith("rate_") else
            "renewal gap" if feature == "gap_dp_events" else
            "DP streak" if feature == "dp_run" else
            "non-DP streak" if feature == "non_dp_run" else
            "scheduled earlier same-day results"
        ),
    )
    days = [event["day"] for event in events]
    primary = np.array([event["market"] in PRIMARY for event in events])
    result = []
    unique_masks: set[bytes] = set()
    for rule in catalog:
        selected = gate(rule, X, names)
        unique_masks.add(np.packbits(selected).tobytes())
        row = dict(rule)
        for split, split_mask in masks.items():
            indices = np.flatnonzero(split_mask)
            row[split] = metrics(y[split_mask], selected[split_mask], [days[i] for i in indices])
            primary_mask = split_mask & primary
            primary_indices = np.flatnonzero(primary_mask)
            row[split + "Primary12"] = metrics(
                y[primary_mask], selected[primary_mask], [days[i] for i in primary_indices]
            )
        result.append(row)
    eligible = [r for r in result if r["validation"]["calls"] >= MIN_CALLS and r["validation"]["daily"]["activeDays"] >= MIN_ACTIVE_DAYS]
    primary_eligible = [
        r for r in result
        if r["validationPrimary12"]["calls"] >= MIN_CALLS
        and r["validationPrimary12"]["daily"]["activeDays"] >= MIN_ACTIVE_DAYS
    ]
    eligible.sort(key=lambda r: (r["validation"]["wilsonLowerOneSided95"] or 0, r["validation"]["precision"] or 0, r["validation"]["calls"]), reverse=True)
    primary_eligible.sort(key=lambda r: (r["validationPrimary12"]["wilsonLowerOneSided95"] or 0, r["validationPrimary12"]["precision"] or 0, r["validationPrimary12"]["calls"]), reverse=True)
    return {
        "configurations": len(catalog), "distinctTriggerMasks": len(unique_masks),
        "ruleFamilies": len({r["family"] for r in catalog}),
        "selection": "Best one-sided 95% Wilson lower bound on validation; minimum 30 calls over 10 active days.",
        "validationEligible": len(eligible),
        "validationChampion": eligible[0] if eligible else None,
        "primary12ValidationEligible": len(primary_eligible),
        "primary12ValidationChampion": primary_eligible[0] if primary_eligible else None,
        "topFiveByValidation": eligible[:5],
        "all": result,
    }


def theory_family(feature: str) -> str:
    return {
        "lag1_dp": "Markov persistence",
        "rate_20": "short-window hot hand or gambler's fallacy",
        "rate_80": "longer-window regime persistence",
        "gap_dp_events": "renewal and waiting-time process",
        "dp_run": "positive serial dependence",
        "same_day_prior_dp_rate": "within-day common regime",
        "prev_day_other_dp_rate": "cross-market information transfer",
        "prior_panel_entropy": "digit entropy association",
        "market_prior_dp_rate": "market heterogeneity",
        "weekday_prior_dp_rate": "calendar periodicity",
    }[feature]


def bh_adjust(p_values: list[float | None]) -> list[float | None]:
    valid = [(i, p) for i, p in enumerate(p_values) if p is not None]
    valid.sort(key=lambda item: item[1])
    out: list[float | None] = [None] * len(p_values)
    adjusted = 1.0
    for pos in range(len(valid) - 1, -1, -1):
        i, p = valid[pos]
        adjusted = min(adjusted, p * len(valid) / (pos + 1))
        out[i] = min(1.0, adjusted)
    return out


def run_theories(events: list[dict[str, Any]], X: np.ndarray, names: list[str], y: np.ndarray, masks: dict[str, np.ndarray]) -> dict[str, Any]:
    catalog = catalog_rules(
        X, names, masks["train"], THEORY_FEATURES, "theory_hypothesis",
        theory_family,
    )
    days = [event["day"] for event in events]
    primary = np.array([event["market"] in PRIMARY for event in events])
    baseline = float(np.mean(y[masks["train"]]))
    results = []
    for rule in catalog:
        selected = gate(rule, X, names)
        row = {**rule, "trainBaseDpRate": round(baseline, 4)}
        for split, split_mask in masks.items():
            current = selected & split_mask
            hits = int(y[current].sum())
            count = int(current.sum())
            alternative = "greater" if rule["direction"] == ">=" else "less"
            row[split + "OneSidedP"] = float(binomtest(hits, count, baseline, alternative=alternative).pvalue) if count else None
            indices = np.flatnonzero(split_mask)
            row[split] = metrics(y[split_mask], current[split_mask], [days[i] for i in indices])
            primary_mask = split_mask & primary
            primary_indices = np.flatnonzero(primary_mask)
            row[split + "Primary12"] = metrics(
                y[primary_mask], current[primary_mask], [days[i] for i in primary_indices]
            )
        results.append(row)
    for split in ("validation", "holdout"):
        q = bh_adjust([row[split + "OneSidedP"] for row in results])
        for row, adj in zip(results, q):
            row[split + "BHq"] = round(adj, 6) if adj is not None else None
    eligible = [r for r in results if r["validation"]["calls"] >= MIN_CALLS and r["validation"]["daily"]["activeDays"] >= MIN_ACTIVE_DAYS]
    primary_eligible = [
        r for r in results
        if r["validationPrimary12"]["calls"] >= MIN_CALLS
        and r["validationPrimary12"]["daily"]["activeDays"] >= MIN_ACTIVE_DAYS
    ]
    eligible.sort(key=lambda r: (r["validation"]["wilsonLowerOneSided95"] or 0, r["validation"]["precision"] or 0), reverse=True)
    primary_eligible.sort(key=lambda r: (r["validationPrimary12"]["wilsonLowerOneSided95"] or 0, r["validationPrimary12"]["precision"] or 0), reverse=True)
    return {
        "hypothesisConfigurations": 100,
        "conceptualTheoryFamilies": len({r["family"] for r in catalog}),
        "interpretation": "100 parameterized conditional hypotheses in 10 broad theory families, not 100 independent scientific theories.",
        "multipleTesting": "BH q-values are descriptive; hypotheses overlap and are dependent.",
        "trainBaseDpRate": round(baseline, 4),
        "validationEligible": len(eligible),
        "validationChampion": eligible[0] if eligible else None,
        "primary12ValidationEligible": len(primary_eligible),
        "primary12ValidationChampion": primary_eligible[0] if primary_eligible else None,
        "all": results,
    }


def make_models() -> list[tuple[str, int, Callable[[], Any]]]:
    specs: list[tuple[str, int, Callable[[], Any]]] = []
    logistic = [(c, None) for c in (0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0, 3.0)] + [(0.1, "balanced"), (1.0, "balanced")]
    for i, (c, weight) in enumerate(logistic, 1):
        specs.append(("logistic", i, lambda c=c, w=weight: LogisticRegression(C=c, class_weight=w, max_iter=500)))
    tree_params = [(3, 20), (3, 50), (5, 20), (5, 50), (7, 20), (7, 50), (10, 20), (10, 50), (None, 50), (None, 100)]
    for family, cls in (("random_forest", RandomForestClassifier), ("extra_trees", ExtraTreesClassifier)):
        for i, (depth, leaf) in enumerate(tree_params, 1):
            specs.append((family, i, lambda d=depth, l=leaf, model=cls: model(n_estimators=60, max_depth=d, min_samples_leaf=l, max_features="sqrt", n_jobs=2, random_state=13)))
    hist_params = [(5, 50, 1), (5, 100, 10), (8, 50, 1), (8, 100, 10), (12, 50, 1), (12, 100, 10), (16, 50, 1), (16, 100, 10), (20, 100, 20), (20, 200, 20)]
    for i, (leaves, leaf, reg) in enumerate(hist_params, 1):
        specs.append(("hist_gradient_boost", i, lambda n=leaves, l=leaf, r=reg: HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=n, min_samples_leaf=l, l2_regularization=r, learning_rate=0.08, random_state=13)))
    boost_params = [(30, 1, 0.03), (50, 1, 0.03), (80, 1, 0.03), (30, 1, 0.08), (50, 1, 0.08), (80, 1, 0.08), (30, 2, 0.05), (50, 2, 0.05), (30, 2, 0.1), (50, 2, 0.1)]
    for i, (n, depth, rate) in enumerate(boost_params, 1):
        specs.append(("gradient_boost", i, lambda n=n, d=depth, r=rate: GradientBoostingClassifier(n_estimators=n, max_depth=d, learning_rate=r, min_samples_leaf=50, random_state=13)))
    dt_params = [(1, 20, "gini"), (2, 20, "gini"), (3, 20, "gini"), (4, 50, "gini"), (5, 50, "gini"), (6, 100, "gini"), (3, 100, "entropy"), (5, 100, "entropy"), (8, 100, "log_loss"), (None, 200, "gini")]
    for i, (depth, leaf, criterion) in enumerate(dt_params, 1):
        specs.append(("decision_tree", i, lambda d=depth, l=leaf, c=criterion: DecisionTreeClassifier(max_depth=d, min_samples_leaf=l, criterion=c, class_weight="balanced", random_state=13)))
    ada_params = [(n, r) for r in (0.03, 0.1) for n in (20, 35, 50, 75, 100)]
    for i, (n, rate) in enumerate(ada_params, 1):
        specs.append(("adaboost", i, lambda n=n, r=rate: AdaBoostClassifier(n_estimators=n, learning_rate=r, random_state=13)))
    mlp_params = [((8,), .0001), ((16,), .0001), ((32,), .0001), ((8, 8), .0001), ((16, 8), .0001), ((8,), .001), ((16,), .001), ((32,), .001), ((8, 8), .01), ((16, 8), .01)]
    for i, (hidden, alpha_value) in enumerate(mlp_params, 1):
        specs.append(("mlp", i, lambda h=hidden, a=alpha_value: MLPClassifier(hidden_layer_sizes=h, alpha=a, max_iter=100, early_stopping=True, n_iter_no_change=8, random_state=13)))
    for i, smoothing in enumerate((1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3), 1):
        specs.append(("gaussian_nb", i, lambda v=smoothing: GaussianNB(var_smoothing=v)))
    bernoulli = [(-1.0, .1), (-.5, .1), (0.0, .1), (.25, .1), (.5, .1), (-1.0, 1.0), (-.5, 1.0), (0.0, 1.0), (.25, 1.0), (.5, 1.0)]
    for i, (threshold, alpha_value) in enumerate(bernoulli, 1):
        specs.append(("bernoulli_nb", i, lambda t=threshold, a=alpha_value: Pipeline([("imputer", SimpleImputer(strategy="median")), ("binarizer", Binarizer(threshold=t)), ("model", BernoulliNB(alpha=a))])))
    if len(specs) != 100:
        raise AssertionError(f"Expected 100 model configurations, got {len(specs)}")
    return specs


def fit_pipe(estimator: Any, family: str) -> Any:
    if family == "bernoulli_nb":
        return estimator
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", estimator),
    ])


def choose_threshold(prob: np.ndarray, y: np.ndarray, days: list[date]) -> tuple[float | None, dict[str, Any] | None]:
    best = None
    for threshold in np.linspace(0.2, 0.99, 32):
        selected = prob >= threshold
        result = metrics(y, selected, days)
        if result["calls"] < MIN_CALLS or result["daily"]["activeDays"] < MIN_ACTIVE_DAYS:
            continue
        rank = (result["wilsonLowerOneSided95"], result["precision"], result["calls"])
        if best is None or rank > best[0]:
            best = (rank, float(threshold), result)
    return (best[1], best[2]) if best else (None, None)


def run_methods(events: list[dict[str, Any]], X: np.ndarray, y: np.ndarray, masks: dict[str, np.ndarray]) -> dict[str, Any]:
    specs = make_models()
    days = [event["day"] for event in events]
    primary = np.array([event["market"] in PRIMARY for event in events])
    validation_days = [days[i] for i in np.flatnonzero(masks["validation"])]
    primary_validation = masks["validation"] & primary
    primary_validation_days = [days[i] for i in np.flatnonzero(primary_validation)]
    rows = []
    family_best: dict[str, dict[str, Any]] = {}
    for i, (family, variant, make_model) in enumerate(specs, 1):
        model = fit_pipe(make_model(), family)
        model.fit(X[masks["train"]], y[masks["train"]])
        probabilities = model.predict_proba(X)[:, 1]
        threshold, val = choose_threshold(probabilities[masks["validation"]], y[masks["validation"]], validation_days)
        threshold_primary, val_primary = choose_threshold(probabilities[primary_validation], y[primary_validation], primary_validation_days)
        row: dict[str, Any] = {
            "family": family, "variant": variant,
            "thresholdAll22": round(threshold, 4) if threshold is not None else None,
            "validationAll22": val,
            "thresholdPrimary12": round(threshold_primary, 4) if threshold_primary is not None else None,
            "validationPrimary12": val_primary,
        }
        if threshold is not None:
            selected = probabilities >= threshold
            ho = masks["holdout"]
            row["holdoutAll22"] = metrics(y[ho], selected[ho], [days[j] for j in np.flatnonzero(ho)])
            primary_ho = ho & primary
            row["holdoutPrimary12AtAll22Threshold"] = metrics(y[primary_ho], selected[primary_ho], [days[j] for j in np.flatnonzero(primary_ho)])
        else:
            row["holdoutAll22"] = None
            row["holdoutPrimary12AtAll22Threshold"] = None
        if threshold_primary is not None:
            selected = probabilities >= threshold_primary
            row["holdoutPrimary12AtPrimaryThreshold"] = metrics(y[masks["holdout"] & primary], selected[masks["holdout"] & primary], [days[j] for j in np.flatnonzero(masks["holdout"] & primary)])
        else:
            row["holdoutPrimary12AtPrimaryThreshold"] = None
        rows.append(row)
        if val is not None:
            previous = family_best.get(family)
            rank = (val["wilsonLowerOneSided95"], val["precision"], val["calls"])
            if previous is None or rank > previous["_rank"]:
                family_best[family] = {"_rank": rank, **row}
        print(f"method {i:03d}/100 {family}-{variant}: validation calls {val['calls'] if val else 0}", flush=True)
    for row in family_best.values():
        row.pop("_rank", None)
    eligible = [row for row in rows if row["validationAll22"] is not None]
    eligible.sort(key=lambda r: (r["validationAll22"]["wilsonLowerOneSided95"], r["validationAll22"]["precision"], r["validationAll22"]["calls"]), reverse=True)
    primary_eligible = [row for row in rows if row["validationPrimary12"] is not None]
    primary_eligible.sort(key=lambda r: (r["validationPrimary12"]["wilsonLowerOneSided95"], r["validationPrimary12"]["precision"], r["validationPrimary12"]["calls"]), reverse=True)
    return {
        "configurations": len(specs), "uniqueEstimatorFamilies": len({row[0] for row in specs}),
        "selection": "Each configuration selects its own probability threshold on validation with at least 30 calls over 10 days; validation one-sided 95% Wilson lower bound ranks candidates.",
        "validationEligible": len(eligible),
        "validationChampion": eligible[0] if eligible else None,
        "primary12ValidationEligible": len(primary_eligible),
        "primary12ValidationChampion": primary_eligible[0] if primary_eligible else None,
        "bestPerEstimatorFamilyByValidation": family_best,
        "all": rows,
    }


def split_summary(events: list[dict[str, Any]], y: np.ndarray, masks: dict[str, np.ndarray]) -> dict[str, Any]:
    result = {}
    for split, mask in masks.items():
        cohort = cohort_metrics(y, mask)
        dates = [events[i]["day"] for i in np.flatnonzero(mask)]
        result[split] = {
            **cohort,
            "first": min(dates).isoformat() if dates else None,
            "last": max(dates).isoformat() if dates else None,
        }
    return result


def append_daily_table(lines: list[str], title: str, result: dict[str, Any] | None) -> None:
    if not result:
        return
    lines.extend([
        "",
        f"### {title}",
        "",
        "| Calls per day | Days | Calls | Correct | Precision | Perfect days |",
        "|---:|---:|---:|---:|---:|---:|",
    ])
    for count, row in result["daily"]["byCallsPerDay"].items():
        lines.append(
            f"| {count} | {row['days']} | {row['calls']} | {row['hits']} | "
            f"{row['precision']:.1%} | {row['perfectDays']} |"
        )


def create_report(data: dict[str, Any]) -> str:
    lines = [
        "# Expanded DP-only research",
        "",
        "## Decision",
        "",
        "No tested policy earns a DP call. The validation-selected results do not support 90% holdout precision with adequate support.",
        "",
        "## Data and timing",
        "",
        f"- {data['data']['marketCount']} chart markets, {data['data']['drawRows']:,} archived draw rows, {data['data']['panelEvents']:,} open/close outcomes, {data['data']['eligibleEvents']:,} events after the 320-result history warmup.",
        "- DP means exactly two distinct digits. SP and TP are both non-DP.",
        f"- Chronological split: train through {TRAIN_END}, validate from {TRAIN_END + timedelta(days=1)} through {VALID_END}, holdout from {VALID_END + timedelta(days=1)}.",
        "- The earlier report already disclosed aggregate 2026 results, so this is a frozen one-pass diagnostic, not an untouched holdout.",
        "- Historical charts were not independently audited against the originating operators.",
        "",
        "## What was tested",
        "",
        f"- {data['patterns']['configurations']} rule configurations across {data['patterns']['ruleFamilies']} input families, with {data['patterns']['distinctTriggerMasks']} distinct masks after tied thresholds.",
        f"- {data['methods']['configurations']} classifier configurations across {data['methods']['uniqueEstimatorFamilies']} estimator families. They are 100 tuned configurations, not 100 unique algorithms.",
        f"- {data['theories']['hypothesisConfigurations']} conditional hypothesis configurations across {data['theories']['conceptualTheoryFamilies']} broad theory families, not 100 independent scientific theories.",
        f"- {len(data['scenarios'])} predefined, overlapping descriptive cohort slices.",
        "",
        "## Base rate",
        "",
        "| Split | Outcomes | DP | DP rate |",
        "|---|---:|---:|---:|",
    ]
    for split, result in data["splits"].items():
        lines.append(f"| {split} | {result['events']:,} | {result['dpEvents']:,} | {result['dpRate']:.1%} |")
    method = data["methods"]["validationChampion"]
    primary_method = data["methods"].get("primary12ValidationChampion")
    lines.extend(["", "## Validation-selected classifiers", ""])
    if method and primary_method:
        lines.extend([
            "Each classifier was fit on the training data from all 22 markets. I selected the all-market winner and the app-market winner separately using validation results for that scope. This keeps the two policies and their support counts distinct.",
            "",
            "| Selected scope | Classifier | Threshold | Validation calls | Correct | Precision | Exact one-sided 95% lower bound | Active days | Perfect days |",
            "|---|---|---:|---:|---:|---:|---:|---:|---:|",
            f"| 22 markets | {method['family']} {method['variant']} | {method['thresholdAll22']} | {method['validationAll22']['calls']:,} | {method['validationAll22']['hits']:,} | {method['validationAll22']['precision']:.1%} | {method['validationAll22']['clopperPearsonLowerOneSided95']:.1%} | {method['validationAll22']['daily']['activeDays']:,} | {method['validationAll22']['daily']['perfectDays']:,} |",
            f"| 12 app markets | {primary_method['family']} {primary_method['variant']} | {primary_method['thresholdPrimary12']} | {primary_method['validationPrimary12']['calls']:,} | {primary_method['validationPrimary12']['hits']:,} | {primary_method['validationPrimary12']['precision']:.1%} | {primary_method['validationPrimary12']['clopperPearsonLowerOneSided95']:.1%} | {primary_method['validationPrimary12']['daily']['activeDays']:,} | {primary_method['validationPrimary12']['daily']['perfectDays']:,} |",
            "",
            "The lower-bound column uses a one-sided 95% exact binomial interval.",
            "",
            "| Selected scope | Holdout calls | Correct | Precision | Exact one-sided 95% lower bound | Active days | Perfect days |",
            "|---|---:|---:|---:|---:|---:|---:|",
            f"| 22 markets | {method['holdoutAll22']['calls']:,} | {method['holdoutAll22']['hits']:,} | {(method['holdoutAll22']['precision'] or 0):.1%} | {(method['holdoutAll22']['clopperPearsonLowerOneSided95'] or 0):.1%} | {method['holdoutAll22']['daily']['activeDays']:,} | {method['holdoutAll22']['daily']['perfectDays']:,} |",
            f"| 12 app markets | {primary_method['holdoutPrimary12AtPrimaryThreshold']['calls']:,} | {primary_method['holdoutPrimary12AtPrimaryThreshold']['hits']:,} | {(primary_method['holdoutPrimary12AtPrimaryThreshold']['precision'] or 0):.1%} | {(primary_method['holdoutPrimary12AtPrimaryThreshold']['clopperPearsonLowerOneSided95'] or 0):.1%} | {primary_method['holdoutPrimary12AtPrimaryThreshold']['daily']['activeDays']:,} | {primary_method['holdoutPrimary12AtPrimaryThreshold']['daily']['perfectDays']:,} |",
            "",
            "A perfect day can come from one call, so the tables below show the support behind each daily rate. Daily scores do not replace aggregate precision.",
        ])
        append_daily_table(lines, "22-market validation calls per day", method["validationAll22"])
        append_daily_table(lines, "22-market holdout calls per day", method["holdoutAll22"])
        append_daily_table(lines, "12-market validation calls per day", primary_method["validationPrimary12"])
        append_daily_table(lines, "12-market holdout calls per day", primary_method["holdoutPrimary12AtPrimaryThreshold"])
    else:
        lines.append("No classifier configuration met the validation support floor.")
    pattern = data["patterns"].get("validationChampion")
    primary_pattern = data["patterns"].get("primary12ValidationChampion")
    lines.extend(["", "## Validation-selected pattern rules", ""])
    if pattern and primary_pattern:
        lines.extend([
            "| Selected scope | Rule | Validation calls | Correct | Precision | Holdout calls | Correct | Precision | Exact one-sided 95% lower bound |",
            "|---|---|---:|---:|---:|---:|---:|---:|---:|",
            f"| 22 markets | {pattern['id']} | {pattern['validation']['calls']:,} | {pattern['validation']['hits']:,} | {pattern['validation']['precision']:.1%} | {pattern['holdout']['calls']:,} | {pattern['holdout']['hits']:,} | {pattern['holdout']['precision']:.1%} | {pattern['holdout']['clopperPearsonLowerOneSided95']:.1%} |",
            f"| 12 app markets | {primary_pattern['id']} | {primary_pattern['validationPrimary12']['calls']:,} | {primary_pattern['validationPrimary12']['hits']:,} | {(primary_pattern['validationPrimary12']['precision'] or 0):.1%} | {primary_pattern['holdoutPrimary12']['calls']:,} | {primary_pattern['holdoutPrimary12']['hits']:,} | {(primary_pattern['holdoutPrimary12']['precision'] or 0):.1%} | {(primary_pattern['holdoutPrimary12']['clopperPearsonLowerOneSided95'] or 0):.1%} |",
        ])
        append_daily_table(lines, "22-market validation pattern calls per day", pattern["validation"])
        append_daily_table(lines, "22-market holdout pattern calls per day", pattern["holdout"])
        append_daily_table(lines, "12-market validation pattern calls per day", primary_pattern["validationPrimary12"])
        append_daily_table(lines, "12-market holdout pattern calls per day", primary_pattern["holdoutPrimary12"])
    else:
        lines.append("No rule met the validation support floor.")
    day_check = data["primaryDailyCheck"]
    lines.extend([
        "",
        "## Same-day schedule analysis",
        "",
        "For app markets only, each event can use same-day chart results only when the current app schedule places that source strictly before the target. This schedule may not match older historical draw timing.",
        "",
        f"In 2026, {day_check['daysWithAtLeast20Of24PrimaryOutcomes']} days had at least 20 of 24 primary Open/Close outcomes. Mean observed DP count was {day_check['meanDpCount']} per day, range {day_check['minDpCount']} to {day_check['maxDpCount']}.",
        "",
        "A separate table in SAME_DAY_REGIME.md conditions the target result on both the number of earlier scheduled outcomes and their DP share. The highest 2026 cell was 77/221 (34.8%), with a 95% Wilson interval of 28.9%-41.3%. No cell approached 90%.",
        "",
        "## Limits",
        "",
        "- Candidate search can overfit validation, and the 2026 period has already been discussed in earlier work.",
        "- A perfect small set of calls has a broad uncertainty interval. The outputs report exact one-sided 95% confidence bounds, not just hit rates.",
        "- Theory-inspired tests measure associations. They do not prove why a DP occurred.",
        "- A frozen live forward record is needed before the app can claim a stable 90% precision rate.",
        "",
        "## Reproduction",
        "",
        "Run python research/dp_only_v1/extended_matrix.py from the repository root. It reads chart_rows.csv and writes extended_results.json and this report.",
    ])
    return "\n".join(lines) + "\n"


def main() -> None:
    rows = read_rows()
    events, names = build_events(rows)
    if not events:
        raise ValueError("No events after history warmup")
    y = np.array([event["y"] for event in events], dtype=int)
    X = np.array([[event["x"].get(name, float("nan")) for name in names] for event in events], dtype=float)
    masks = split_masks(events)
    if not all(mask.any() for mask in masks.values()):
        raise ValueError("At least one chronological split is empty")
    patterns = run_patterns(events, X, names, y, masks)
    theories = run_theories(events, X, names, y, masks)
    methods = run_methods(events, X, y, masks)
    scenarios_out = scenarios(events, y, masks)
    report = {
        "design": {
            "trainThrough": TRAIN_END.isoformat(), "validationThrough": VALID_END.isoformat(),
            "holdoutStarts": (VALID_END + timedelta(days=1)).isoformat(),
            "holdoutPristine": False,
            "holdoutReason": "Aggregate 2026 results were disclosed in the earlier research report.",
            "minimumHistory": MIN_HISTORY, "minimumValidationCalls": MIN_CALLS,
            "minimumValidationActiveDays": MIN_ACTIVE_DAYS,
            "sameDaySchedule": "Current src/lib/market-schedule.ts timings; strictly earlier events only; historical schedule may differ.",
            "featureNames": names,
        },
        "data": {
            "marketCount": len({row["market"] for row in rows}),
            "drawRows": len(rows), "first": rows[0]["date"], "last": rows[-1]["date"],
            "panelEvents": len(rows) * 2, "eligibleEvents": len(events),
            "primaryMarkets": sorted(PRIMARY),
        },
        "splits": split_summary(events, y, masks),
        "primaryDailyCheck": daily_base_check(rows),
        "patterns": patterns, "theories": theories, "methods": methods,
        "scenarios": scenarios_out,
        "decision": "No DP calls. No selected candidate established at least 90% precision on holdout with adequate support.",
    }
    OUT_JSON.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    OUT_MD.write_text(create_report(report), encoding="utf-8")
    print(json.dumps({
        "data": report["data"], "splits": report["splits"],
        "primaryDailyCheck": report["primaryDailyCheck"],
        "patternChampion": patterns["validationChampion"],
        "theoryChampion": theories["validationChampion"],
        "methodChampion": methods["validationChampion"],
        "familyChampions": methods["bestPerEstimatorFamilyByValidation"],
        "decision": report["decision"],
    }, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
