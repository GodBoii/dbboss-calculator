"""Independent, time-ordered audit of selective DP calls.

All candidate definitions are generated from features available before the
target event. The 2026 holdout is scored only after candidate selection on
2025. Historical schedule-aware features use the app's fixed market timings
and strictly earlier same-day events.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import beta
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "research" / "dp_only_v1" / "chart_rows.csv"
OUT = Path(__file__).resolve().parent
TRAIN_END = pd.Timestamp("2024-12-31")
VALID_END = pd.Timestamp("2025-12-31")
PRIMARY = (
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
)
EXTRA = (
    "Kalyan Morning", "Milan Morning", "Madhuri", "Madhuri Night", "Madhur Morning",
    "Mumbai Day", "Mumbai Night", "Tara Mumbai Day", "Supreme Day", "Supreme Night",
)
ALL_MARKETS = PRIMARY + EXTRA

# Minutes after midnight copied from src/lib/market-schedule.ts.
TIMINGS = {
    "Sridevi": (695, 755), "Time Bazar": (790, 850), "Madhur Day": (810, 870),
    "Rajdhani Day": (905, 1025), "Milan Day": (910, 1030), "Kalyan": (945, 1065),
    "Sridevi Night": (1155, 1215), "Madhur Night": (1230, 1350),
    "Milan Night": (1265, 1385), "Rajdhani Night": (1295, 1425),
    "Kalyan Night": (1305, 1425), "Main Bazar": (1320, 1450),
}

CAT_FEATURES = {
    "weekday", "month", "day_of_month", "quarter", "week_of_month", "market",
    "side", "market_weekday", "market_month", "market_side", "side_weekday",
    "market_side_weekday", "lag_pattern_2", "lag_pattern_3", "last_repeat_position",
    "last_digit_pair", "last_sum_mod10", "last_sum_mod3", "last_max_frequency",
}
LEAKAGE_SAFE_CAL_FEATURES = {"year_index", "doy_sin", "doy_cos"}


def dp_kind(panel: str | None) -> int | None:
    if not panel:
        return None
    if len(panel) != 3 or not panel.isdigit():
        raise ValueError(f"Invalid panel value {panel!r}")
    return int(len(set(panel)) == 2)


def read_source() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: dict[tuple[str, str], dict[str, Any]] = {}
    duplicate_identical = duplicate_conflicting = 0
    malformed = 0
    with SOURCE.open(newline="", encoding="utf-8") as handle:
        for raw in csv.DictReader(handle):
            try:
                day = date.fromisoformat(raw["date"])
            except ValueError:
                malformed += 1
                continue
            market = raw["market"]
            if market not in ALL_MARKETS:
                raise ValueError(f"Unexpected market {market!r}")
            record = {"date": day, "date_text": day.isoformat(), "market": market,
                      "open": raw["open"] or None, "close": raw["close"] or None}
            for side in ("open", "close"):
                if record[side] is not None:
                    dp_kind(record[side])
            key = (day.isoformat(), market)
            if key in seen:
                if seen[key] == record:
                    duplicate_identical += 1
                else:
                    duplicate_conflicting += 1
                continue
            seen[key] = record
            rows.append(record)
    rows.sort(key=lambda r: (r["date"], r["market"]))
    if not rows:
        raise ValueError("No chart rows were loaded")
    # Missing sides are valid source data; duplicate keys are not.
    audit = {"source": str(SOURCE.relative_to(ROOT)), "rows": len(rows),
             "duplicateIdenticalRows": duplicate_identical,
             "duplicateConflictingRows": duplicate_conflicting, "malformedDates": malformed,
             "firstDate": rows[0]["date_text"], "lastDate": rows[-1]["date_text"],
             "marketCount": len({r["market"] for r in rows}),
             "primaryMarketRows": sum(r["market"] in PRIMARY for r in rows),
             "extraMarketRows": sum(r["market"] in EXTRA for r in rows),
             "openPanels": sum(bool(r["open"]) for r in rows),
             "closePanels": sum(bool(r["close"]) for r in rows)}
    return rows, audit


def panel_geometry(panel: str | None) -> dict[str, float | int | str | None]:
    if not panel:
        return {f"last_{name}": None for name in (
            "digit_0", "digit_1", "digit_2", "sum", "spread", "entropy", "has_zero",
            "even_count", "palindrome", "repeat_position", "digit_pair", "sum_mod10",
            "sum_mod3", "max_frequency", "min_digit", "max_digit", "first_last_diff",
        )}
    digits = [int(ch) for ch in panel]
    counts = [digits.count(d) for d in set(digits)]
    entropy = -sum((n / 3) * np.log2(n / 3) for n in counts)
    repeated = next(d for d in set(digits) if digits.count(d) == 2) if len(set(digits)) == 2 else None
    repeat_position = {("0", "1"): 0, ("0", "2"): 1, ("1", "2"): 2}.get(
        tuple(str(i) for i, d in enumerate(digits) if digits.count(d) == 2), -1)
    pair = "".join(str(d) for d in sorted(digits)) if repeated is not None else ""
    total = sum(digits)
    return {
        "last_digit_0": digits[0], "last_digit_1": digits[1], "last_digit_2": digits[2],
        "last_sum": total, "last_spread": max(digits) - min(digits), "last_entropy": float(entropy),
        "last_has_zero": int(0 in digits), "last_even_count": sum(d % 2 == 0 for d in digits),
        "last_palindrome": int(panel == panel[::-1]), "last_repeat_position": repeat_position,
        "last_digit_pair": pair, "last_sum_mod10": total % 10, "last_sum_mod3": total % 3,
        "last_max_frequency": max(counts), "last_min_digit": min(digits), "last_max_digit": max(digits),
        "last_first_last_diff": abs(digits[0] - digits[-1]),
    }


def schedule_features(target: dict[str, Any], by_day: dict[date, dict[str, dict[str, Any]]]) -> dict[str, Any]:
    market, side = target["market"], target["side"]
    if market not in TIMINGS:
        return {"same_day_prior_dp_rate": None, "same_day_prior_dp_count": 0,
                "same_day_prior_event_count": 0, "same_day_prior_open_dp_rate": None,
                "same_day_prior_close_dp_rate": None, "same_day_latest_prior_dp": None,
                "same_day_same_market_open_dp": None}
    target_minute = TIMINGS[market][0 if side == "open" else 1]
    available: list[tuple[int, int, int]] = []
    day_rows = by_day.get(target["date"], {})
    for source_market in PRIMARY:
        for source_side_index, source_side in enumerate(("open", "close")):
            source_minute = TIMINGS[source_market][source_side_index]
            if source_minute >= target_minute:
                continue
            source_row = day_rows.get(source_market)
            if not source_row:
                continue
            label = dp_kind(source_row[source_side])
            if label is not None:
                available.append((source_minute, label, source_side_index))
    if available:
        latest = max(available)
        labels = [entry[1] for entry in available]
        opens = [entry[1] for entry in available if entry[2] == 0]
        closes = [entry[1] for entry in available if entry[2] == 1]
        rate = float(np.mean(labels))
        open_rate = float(np.mean(opens)) if opens else None
        close_rate = float(np.mean(closes)) if closes else None
        latest_dp = latest[1]
    else:
        rate = open_rate = close_rate = latest_dp = None
        labels = []
    own_open = dp_kind(day_rows.get(market, {}).get("open")) if side == "close" and day_rows.get(market) else None
    return {"same_day_prior_dp_rate": rate, "same_day_prior_dp_count": int(sum(labels)),
            "same_day_prior_event_count": len(labels), "same_day_prior_open_dp_rate": open_rate,
            "same_day_prior_close_dp_rate": close_rate, "same_day_latest_prior_dp": latest_dp,
            "same_day_same_market_open_dp": own_open}


def build_cases(rows: list[dict[str, Any]]) -> tuple[pd.DataFrame, dict[str, Any]]:
    by_day: dict[date, dict[str, dict[str, Any]]] = defaultdict(dict)
    for row in rows:
        by_day[row["date"]][row["market"]] = row
    histories: dict[tuple[str, str], list[tuple[date, str, int]]] = defaultdict(list)
    daily_cache: dict[date, dict[str, float | int | None]] = {}
    records: list[dict[str, Any]] = []
    categorical_values: dict[str, set[str]] = defaultdict(set)
    calendar_cache: dict[date, dict[str, float | int | None]] = {}

    for row in rows:
        day = row["date"]
        if day not in calendar_cache:
            cal = day.timetuple().tm_yday
            calendar_cache[day] = {
                "weekday": day.weekday(), "month": day.month, "day_of_month": day.day,
                "quarter": (day.month - 1) // 3 + 1, "week_of_month": (day.day - 1) // 7 + 1,
                "year_index": day.year - 2013,
                "doy_sin": float(np.sin(2 * np.pi * cal / 366)),
                "doy_cos": float(np.cos(2 * np.pi * cal / 366)),
            }
        if day not in daily_cache:
            prior_days = [day - timedelta(days=i) for i in range(1, 31)]
            prev: list[int] = []
            for prior_day in prior_days:
                for market_row in by_day.get(prior_day, {}).values():
                    for prior_side in ("open", "close"):
                        label = dp_kind(market_row[prior_side])
                        if label is not None:
                            prev.append(label)
            prior_1 = [dp_kind(market_row[s]) for market_row in by_day.get(day - timedelta(days=1), {}).values()
                       for s in ("open", "close")]
            prior_1 = [v for v in prior_1 if v is not None]
            daily_cache[day] = {"prior_1d_market_rate": float(np.mean(prior_1)) if prior_1 else None,
                                "prior_1d_market_dp_count": int(sum(prior_1)),
                                "prior_1d_market_event_count": len(prior_1),
                                "prior_7d_market_rate": None, "prior_14d_market_rate": None,
                                "prior_30d_market_rate": float(np.mean(prev)) if prev else None,
                                "prior_30d_market_event_count": len(prev)}
            for window in (7, 14):
                labels = [dp_kind(market_row[s]) for prior_day in prior_days[:window]
                          for market_row in by_day.get(prior_day, {}).values() for s in ("open", "close")]
                labels = [v for v in labels if v is not None]
                daily_cache[day][f"prior_{window}d_market_rate"] = float(np.mean(labels)) if labels else None

        for side in ("open", "close"):
            label = dp_kind(row[side])
            if label is None:
                continue
            history = histories[(row["market"], side)]
            if len(history) >= 80:
                labels = np.array([item[2] for item in history], dtype=int)
                current: dict[str, Any] = {"date": pd.Timestamp(day), "date_text": day.isoformat(),
                                           "market": row["market"], "side": side, "y": label}
                current.update(calendar_cache[day])
                current.update(daily_cache[day])
                current.update({"market_weekday": f"{row['market']}|{day.weekday()}",
                                "market_month": f"{row['market']}|{day.month}",
                                "market_side": f"{row['market']}|{side}",
                                "side_weekday": f"{side}|{day.weekday()}",
                                "market_side_weekday": f"{row['market']}|{side}|{day.weekday()}"})
                for lag in range(1, 11):
                    current[f"lag_{lag}"] = int(labels[-lag])
                for window in (3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 250, 500):
                    current[f"rate_{window}"] = float(np.mean(labels[-min(window, len(labels)):]))
                last_dp = next((i for i, value in enumerate(labels[::-1]) if value == 1), len(labels))
                dp_streak = next((i for i, value in enumerate(labels[::-1]) if value != 1), len(labels))
                non_dp_streak = next((i for i, value in enumerate(labels[::-1]) if value != 0), len(labels))
                current["gap_dp_events"] = last_dp
                current["gap_dp_days"] = (day - history[-1 - last_dp][0]).days if last_dp < len(history) else (day - history[0][0]).days
                current["streak_dp"] = dp_streak
                current["streak_non_dp"] = non_dp_streak
                current["lag_pattern_2"] = "".join(str(v) for v in labels[-2:])
                current["lag_pattern_3"] = "".join(str(v) for v in labels[-3:])
                current["runs_10"] = int(np.sum(np.diff(labels[-10:]) != 0))
                current["runs_30"] = int(np.sum(np.diff(labels[-30:]) != 0))
                current["prior_dp_count_10"] = int(np.sum(labels[-10:]))
                current["prior_dp_count_30"] = int(np.sum(labels[-30:]))
                current["days_since_last_event"] = (day - history[-1][0]).days
                geometry = panel_geometry(history[-1][1])
                current.update(geometry)
                if len(history) >= 2:
                    prev_geom = panel_geometry(history[-2][1])
                    current["last_sum_delta"] = float(geometry["last_sum"] - prev_geom["last_sum"])
                    current["last_spread_delta"] = float(geometry["last_spread"] - prev_geom["last_spread"])
                    current["last_panel_same_digits_as_prev"] = int(sorted(history[-1][1]) == sorted(history[-2][1]))
                else:
                    current["last_sum_delta"] = current["last_spread_delta"] = current["last_panel_same_digits_as_prev"] = None
                other_side = "close" if side == "open" else "open"
                other_history = histories[(row["market"], other_side)]
                current["prior_opposite_side_dp"] = other_history[-1][2] if other_history else None
                current["prior_opposite_side_age_days"] = (day - other_history[-1][0]).days if other_history else None
                current.update(schedule_features({**row, "side": side}, by_day))
                current["same_day_prior_weekday_event_count"] = current["same_day_prior_event_count"]
                # Intentionally no current-day outcomes enter the start-of-day feature set.
                categorical_values["market"].add(row["market"])
                categorical_values["side"].add(side)
                records.append(current)
            histories[(row["market"], side)].append((day, row[side], label))

    frame = pd.DataFrame.from_records(records).sort_values(["date", "market", "side"]).reset_index(drop=True)
    if frame.empty:
        raise ValueError("No eligible event rows were built")
    info = {"candidateEvents": int(len(frame)), "primaryEvents": int(frame.market.isin(PRIMARY).sum()),
            "extraEvents": int(frame.market.isin(EXTRA).sum()), "featureColumns": int(frame.shape[1] - 4),
            "firstEligible": frame.date_text.min(), "lastEligible": frame.date_text.max(),
            "startOfDayColumns": [c for c in frame.columns if not c.startswith("same_day_")],
            "scheduleAwareColumns": [c for c in frame.columns if c.startswith("same_day_")],
            "scheduleSource": "src/lib/market-schedule.ts", "scheduleStrictlyEarlier": True}
    return frame, info


def wilson(hits: int, calls: int, z: float = 1.645) -> float:
    if calls == 0:
        return 0.0
    p = hits / calls
    denom = 1 + z*z/calls
    return float((p + z*z/(2*calls) - z*np.sqrt(p*(1-p)/calls + z*z/(4*calls*calls))) / denom)


def daily_counts(dates: np.ndarray, y: np.ndarray, mask: np.ndarray) -> dict[str, Any]:
    selected = pd.DataFrame({"date": dates[mask], "hit": y[mask]})
    if selected.empty:
        return {"activeDays": 0, "daysWith5To10Calls": 0, "dailyCallBuckets": {},
                "perfect5To10CallDays": 0, "atLeast80Percent5To10CallDays": 0,
                "atLeast70Percent5To10CallDays": 0, "bestDay": None}
    grouped = selected.groupby("date").hit.agg(["count", "sum"])
    grouped["precision"] = grouped["sum"] / grouped["count"]
    buckets: dict[str, dict[str, Any]] = {}
    for calls, rows in grouped.groupby("count"):
        buckets[str(int(calls))] = {"days": int(len(rows)), "totalCalls": int(calls * len(rows)),
                                    "hits": int(rows["sum"].sum()),
                                    "dailyPrecisionMean": round(float(rows.precision.mean()), 4),
                                    "perfectDays": int((rows.precision == 1).sum()),
                                    "atLeast80PercentDays": int((rows.precision >= .8).sum()),
                                    "atLeast70PercentDays": int((rows.precision >= .7).sum())}
    target = grouped[(grouped["count"] >= 5) & (grouped["count"] <= 10)]
    best_idx = grouped.precision.idxmax()
    return {"activeDays": int(len(grouped)), "daysWith5To10Calls": int(len(target)),
            "callsPerActiveDayMean": round(float(grouped["count"].mean()), 3),
            "hitsPerActiveDayMean": round(float(grouped["sum"].mean()), 3),
            "dailyCallBuckets": buckets,
            "perfect5To10CallDays": int((target.precision == 1).sum()),
            "atLeast80Percent5To10CallDays": int((target.precision >= .8).sum()),
            "atLeast70Percent5To10CallDays": int((target.precision >= .7).sum()),
            "targetBucketHits": int(target["sum"].sum()), "targetBucketCalls": int(target["count"].sum()),
            "bestDay": {"date": str(best_idx), "calls": int(grouped.loc[best_idx, "count"]),
                        "hits": int(grouped.loc[best_idx, "sum"]),
                        "precision": round(float(grouped.loc[best_idx, "precision"]), 4)}}


def confidence(hits: int, calls: int, dates: np.ndarray, y: np.ndarray, mask: np.ndarray,
               *, seed: int = 47021, boot: int = 3000) -> dict[str, Any]:
    if not calls:
        return {"exact95": None, "wilsonOneSided95Lower": 0.0, "weekBlockBootstrap95": None}
    alpha = .05
    cp_low = 0.0 if hits == 0 else float(beta.ppf(alpha / 2, hits, calls - hits + 1))
    cp_high = 1.0 if hits == calls else float(beta.ppf(1 - alpha / 2, hits + 1, calls - hits))
    subset = pd.DataFrame({"date": pd.to_datetime(dates[mask]), "hit": y[mask]})
    weeks = subset.date.dt.to_period("W-SUN").astype(str)
    per_week = subset.assign(week=weeks).groupby("week").hit.agg(["count", "sum"])
    rng = np.random.default_rng(seed)
    if len(per_week) > 1:
        idx = rng.integers(0, len(per_week), size=(boot, len(per_week)))
        counts = per_week["count"].to_numpy()[idx].sum(axis=1)
        block_hits = per_week["sum"].to_numpy()[idx].sum(axis=1)
        rates = np.divide(block_hits, counts, out=np.zeros_like(block_hits, dtype=float), where=counts > 0)
        block_ci = [float(np.quantile(rates, .025)), float(np.quantile(rates, .975))]
    else:
        block_ci = None
    return {"exact95": [round(cp_low, 4), round(cp_high, 4)],
            "wilsonOneSided95Lower": round(wilson(hits, calls), 4),
            "weekBlockBootstrap95": [round(value, 4) for value in block_ci] if block_ci else None,
            "independentCallsAssumption": "Clopper-Pearson assumes independent calls; weekly block bootstrap groups within-week dependence."}


def score(mask: np.ndarray, y: np.ndarray, dates: np.ndarray, seed: int = 47021,
          with_confidence: bool = True) -> dict[str, Any]:
    calls = int(mask.sum())
    hits = int(y[mask].sum()) if calls else 0
    conf = confidence(hits, calls, dates, y, mask, seed=seed) if with_confidence else {
        "wilsonOneSided95Lower": round(wilson(hits, calls), 4)}
    return {"calls": calls, "hits": hits, "falseCalls": calls - hits,
            "precision": round(hits / calls, 4) if calls else None,
            "coverage": round(calls / len(y), 5) if len(y) else 0,
            "confidence": conf,
            "daily": daily_counts(dates, y, mask)}


@dataclass
class Candidate:
    name: str
    features: tuple[str, ...]
    mask: np.ndarray


def make_single_candidates(frame: pd.DataFrame, train: np.ndarray,
                           allowed_features: list[str]) -> list[Candidate]:
    candidates: list[Candidate] = []
    excluded = {"date", "date_text", "market", "side", "y"}
    binary_or_category = set(CAT_FEATURES) | {c for c in frame if c.startswith("lag_") and c[4:].isdigit()}
    binary_or_category |= {c for c in frame if c.endswith("_dp") or c.endswith("_count") and c.startswith("same_day_")}
    # Exact categorical/finite-state hypotheses, with support thresholds determined on train only.
    for col in allowed_features:
        if col in excluded:
            continue
        values = frame[col]
        train_values = values[train].dropna()
        if train_values.empty:
            continue
        if col in binary_or_category or not pd.api.types.is_numeric_dtype(values):
            levels = train_values.value_counts()
            for value, count in levels.items():
                if count < 100:
                    continue
                mask = values.notna().to_numpy() & (values.to_numpy() == value)
                if int(mask[train].sum()) >= 100:
                    candidates.append(Candidate(f"{col} == {value}", (col,), mask))
            continue
        numeric = pd.to_numeric(values, errors="coerce").to_numpy(dtype=float)
        finite = numeric[train & np.isfinite(numeric)]
        if len(finite) < 100 or np.nanmax(finite) == np.nanmin(finite):
            continue
        # 49 train-only quantiles per side are 98 distinct thresholds per numeric feature.
        thresholds = np.unique(np.quantile(finite, np.linspace(.02, .98, 49)))
        for threshold in thresholds:
            lower = np.isfinite(numeric) & (numeric <= threshold)
            upper = np.isfinite(numeric) & (numeric >= threshold)
            if int(lower[train].sum()) >= 100:
                candidates.append(Candidate(f"{col} <= {threshold:.6g}", (col,), lower))
            if int(upper[train].sum()) >= 100:
                candidates.append(Candidate(f"{col} >= {threshold:.6g}", (col,), upper))
    return candidates


def metric_counts(mask: np.ndarray, y: np.ndarray, select: np.ndarray) -> tuple[int, int]:
    calls = int((mask & select).sum())
    return calls, int(y[mask & select].sum()) if calls else 0


def generate_rule_library(frame: pd.DataFrame, train: np.ndarray, valid: np.ndarray,
                          y: np.ndarray, allowed_features: list[str]) -> tuple[list[Candidate], dict[str, Any]]:
    singles = make_single_candidates(frame, train, allowed_features)
    # Pair gates are selected from validation-ranked singles, then are still chosen solely on validation.
    eligible_single = []
    for candidate in singles:
        tr_calls, tr_hits = metric_counts(candidate.mask, y, train)
        va_calls, va_hits = metric_counts(candidate.mask, y, valid)
        if tr_calls < 100 or va_calls < 25:
            continue
        eligible_single.append((wilson(va_hits, va_calls), va_calls, candidate))
    eligible_single.sort(key=lambda item: (item[0], item[1]), reverse=True)
    pool: list[Candidate] = []
    used: set[tuple[str, str]] = set()
    for _, _, candidate in eligible_single:
        signature = (candidate.features[0], candidate.name)
        if signature in used:
            continue
        pool.append(candidate)
        used.add(signature)
        if len(pool) == 75:
            break
    pairs: list[Candidate] = []
    for i, left in enumerate(pool):
        for right in pool[i + 1:]:
            if set(left.features) & set(right.features):
                continue
            combined = left.mask & right.mask
            if int(combined[train].sum()) < 50 or int(combined[valid].sum()) < 20:
                continue
            pairs.append(Candidate(f"({left.name}) AND ({right.name})", left.features + right.features, combined))
    return singles + pairs, {"singleCandidates": len(singles), "pairCandidates": len(pairs),
                             "totalRuleCandidates": len(singles) + len(pairs),
                             "distinctSingleFeatures": len({c.features[0] for c in singles}),
                             "pairPoolSize": len(pool), "pairValidationMinCalls": 20,
                             "thresholdsPerNumericFeature": 98,
                             "trainSupportMinCallsForSingles": 100,
                             "candidateQuantilesDerivedFrom": "train only"}


def split_masks(frame: pd.DataFrame, primary_only: bool = True) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    is_market = frame.market.isin(PRIMARY).to_numpy() if primary_only else np.ones(len(frame), dtype=bool)
    dates = frame.date.to_numpy()
    train = is_market & (dates <= np.datetime64(TRAIN_END))
    valid = is_market & (dates > np.datetime64(TRAIN_END)) & (dates <= np.datetime64(VALID_END))
    holdout = is_market & (dates > np.datetime64(VALID_END))
    return train, valid, holdout


def select_best(candidates: list[Candidate], y: np.ndarray, train: np.ndarray, valid: np.ndarray,
                dates: np.ndarray) -> tuple[dict[str, Any], Candidate, list[dict[str, Any]]]:
    scored: list[dict[str, Any]] = []
    for candidate in candidates:
        tr = score(candidate.mask & train, y, dates, with_confidence=False)
        va = score(candidate.mask & valid, y, dates, with_confidence=False)
        if tr["calls"] < 100 or va["calls"] < 30 or va["daily"]["activeDays"] < 20:
            continue
        scored.append({"rule": candidate.name, "features": candidate.features,
                       "train": tr, "validation": va, "candidate": candidate})
    if not scored:
        raise ValueError("No rule met train/validation support requirements")
    scored.sort(key=lambda item: (item["validation"]["confidence"]["wilsonOneSided95Lower"],
                                  item["validation"]["calls"]), reverse=True)
    best = scored[0]
    best["train"] = score(best["candidate"].mask & train, y, dates)
    best["validation"] = score(best["candidate"].mask & valid, y, dates)
    for entry in scored[1:]:
        entry["validation"]["confidence"] = {"wilsonOneSided95Lower": round(
            wilson(entry["validation"]["hits"], entry["validation"]["calls"]), 4)}
    return best, best["candidate"], scored


def finite_matrix(frame: pd.DataFrame, feature_columns: list[str], train: np.ndarray) -> tuple[np.ndarray, list[str]]:
    categorical = [c for c in feature_columns if c in CAT_FEATURES]
    numeric_cols = [c for c in feature_columns if c not in categorical]
    numeric_frame = frame[numeric_cols].apply(pd.to_numeric, errors="coerce")
    train_medians = numeric_frame.loc[train].median(axis=0).fillna(0)
    numeric_frame = numeric_frame.fillna(train_medians).fillna(0)
    # Category domains are fixed/calendar or app-market values, so one-hot expansion does not inspect labels.
    fixed_levels = {"weekday": list(range(7)), "month": list(range(1, 13)),
                    "day_of_month": list(range(1, 32)), "quarter": list(range(1, 5)),
                    "week_of_month": list(range(1, 6)), "side": ["open", "close"],
                    "market": list(PRIMARY)}
    cat_frames = []
    for col in categorical:
        source = frame[col].astype("string")
        levels = fixed_levels.get(col)
        train_levels = frame.loc[train, col].dropna().astype(str).unique().tolist()
        categories = [str(x) for x in levels] if levels is not None else sorted(train_levels)
        source = source.where(source.isin(categories), pd.NA)
        series = pd.Categorical(source, categories=categories)
        dummies = pd.get_dummies(series, prefix=col, dummy_na=False, dtype=float)
        cat_frames.append(dummies)
    merged = pd.concat([numeric_frame.reset_index(drop=True)] + [part.reset_index(drop=True) for part in cat_frames], axis=1)
    return merged.to_numpy(dtype=float), list(merged.columns)


def fit_models(frame: pd.DataFrame, feature_columns: list[str], y: np.ndarray,
               train: np.ndarray, valid: np.ndarray, holdout: np.ndarray) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    X, matrix_columns = finite_matrix(frame, feature_columns, train)
    specs = [
        ("logistic", make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LogisticRegression(max_iter=1500, C=.25))),
        ("random_forest", RandomForestClassifier(n_estimators=220, max_depth=7, min_samples_leaf=80,
                                                  max_features=.65, random_state=417, n_jobs=-1)),
        ("extra_trees", ExtraTreesClassifier(n_estimators=220, max_depth=7, min_samples_leaf=80,
                                               max_features=.65, random_state=417, n_jobs=-1)),
        ("hist_gradient_boosting", HistGradientBoostingClassifier(max_iter=180, max_leaf_nodes=15,
                                                                   min_samples_leaf=80, l2_regularization=4,
                                                                   learning_rate=.06, random_state=417)),
        ("naive_bayes", make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), GaussianNB(var_smoothing=1e-8))),
    ]
    dates = frame.date.to_numpy()
    results = []
    thresholds = np.linspace(.20, .99, 80)
    for name, model in specs:
        model.fit(X[train], y[train])
        probs = model.predict_proba(X)[:, 1]
        choices = []
        for threshold in thresholds:
            mask = probs >= threshold
            valid_score = score(mask & valid, y, dates, with_confidence=False)
            if valid_score["calls"] >= 30 and valid_score["daily"]["activeDays"] >= 20:
                choices.append((valid_score["confidence"]["wilsonOneSided95Lower"],
                                valid_score["calls"], float(threshold), valid_score))
        if not choices:
            results.append({"model": name, "selectedThreshold": None,
                            "validation": None, "holdout": None, "primaryHoldout": None})
            continue
        choices.sort(key=lambda c: (c[0], c[1]), reverse=True)
        _, _, threshold, valid_score = choices[0]
        selected = probs >= threshold
        valid_score = score(selected & valid, y, dates)
        results.append({"model": name, "selectedThreshold": round(threshold, 4),
                        "validation": valid_score,
                        "holdout": score(selected & holdout, y, dates),
                        "primaryHoldout": score(selected & holdout & frame.market.isin(PRIMARY).to_numpy(), y, dates),
                        "validationAuc": round(float(roc_auc_score(y[valid], probs[valid])), 4),
                        "holdoutAuc": round(float(roc_auc_score(y[holdout], probs[holdout])), 4) if len(np.unique(y[holdout])) > 1 else None})
    return results, {"modelFamilies": [item[0] for item in specs],
                     "probabilityThresholdsPerFamily": len(thresholds),
                     "probabilityConfigurations": len(specs) * len(thresholds),
                     "matrixFeatures": len(matrix_columns), "matrixImputation": "training median",
                     "matrixCategoryVocabulary": "fixed calendar/app domains or categories observed in training rows only",
                     "thresholdSelection": "2025 validation only", "selectionMinCalls": 30,
                     "selectionMinActiveDays": 20}


def source_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    details = {}
    for market in ALL_MARKETS:
        subset = [r for r in rows if r["market"] == market]
        present = [r for r in subset if r["open"] or r["close"]]
        labels = [dp_kind(r[s]) for r in subset for s in ("open", "close") if r[s]]
        details[market] = {"drawRows": len(subset), "rowsWithAnyPanel": len(present),
                           "panelEvents": len(labels), "dpEvents": int(sum(labels)),
                           "dpRate": round(float(np.mean(labels)), 4) if labels else None,
                           "first": min((r["date_text"] for r in present), default=None),
                           "last": max((r["date_text"] for r in present), default=None)}
    return details


def evaluate_scenario(frame: pd.DataFrame, scenario: str, extra_feature_columns: list[str]) -> dict[str, Any]:
    mask = frame.market.isin(PRIMARY).to_numpy()
    if scenario == "start_of_day":
        eligible = mask
        feature_columns = [c for c in frame.columns if c not in {"date", "date_text", "market", "side", "y"}
                           and not c.startswith("same_day_")]
    elif scenario == "schedule_aware":
        eligible = mask
        feature_columns = [c for c in frame.columns if c not in {"date", "date_text", "market", "side", "y"}]
    else:
        raise ValueError(scenario)
    y = frame.y.to_numpy(dtype=int)
    train, valid, holdout = split_masks(frame, primary_only=True)
    train &= eligible
    valid &= eligible
    holdout &= eligible
    dates = frame.date.to_numpy()
    candidates, library = generate_rule_library(frame, train, valid, y, feature_columns)
    best, best_candidate, ranked = select_best(candidates, y, train, valid, dates)
    holdout_score = score(best_candidate.mask & holdout, y, dates)
    # Among high-validation-score rules, also inspect the one with the most validation days at 5-10 calls.
    daily_pool = [entry for entry in ranked if entry["validation"]["daily"]["daysWith5To10Calls"] >= 10]
    best_daily = max(daily_pool, key=lambda item: (
        item["validation"]["daily"]["atLeast70Percent5To10CallDays"] /
        max(1, item["validation"]["daily"]["daysWith5To10Calls"]),
        item["validation"]["daily"]["daysWith5To10Calls"],
        item["validation"]["confidence"]["wilsonOneSided95Lower"])) if daily_pool else None
    daily_holdout = score(best_daily["candidate"].mask & holdout, y, dates) if best_daily else None
    if best_daily:
        best_daily["train"] = score(best_daily["candidate"].mask & train, y, dates)
        best_daily["validation"] = score(best_daily["candidate"].mask & valid, y, dates)
    model_results, model_audit = fit_models(frame, feature_columns, y, train, valid, holdout)
    validation_csv = OUT / f"{scenario}_rule_validation.csv"
    with validation_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("rank", "rule", "features", "train_calls", "train_hits",
            "train_precision", "validation_calls", "validation_hits", "validation_precision",
            "validation_wilson_lcb95_one_sided", "validation_active_days", "validation_5_to_10_call_days",
            "validation_5_to_10_call_days_ge70pct"))
        writer.writeheader()
        for rank, entry in enumerate(ranked, start=1):
            tr, va = entry["train"], entry["validation"]
            day = va["daily"]
            writer.writerow({"rank": rank, "rule": entry["rule"], "features": ";".join(entry["features"]),
                             "train_calls": tr["calls"], "train_hits": tr["hits"],
                             "train_precision": tr["precision"], "validation_calls": va["calls"],
                             "validation_hits": va["hits"], "validation_precision": va["precision"],
                             "validation_wilson_lcb95_one_sided": va["confidence"]["wilsonOneSided95Lower"],
                             "validation_active_days": day["activeDays"],
                             "validation_5_to_10_call_days": day["daysWith5To10Calls"],
                             "validation_5_to_10_call_days_ge70pct": day["atLeast70Percent5To10CallDays"]})
    # Candidate family taxonomy shows what was examined without treating correlated variants as independent trials.
    feature_families = {
        "calendar_and_time": [c for c in feature_columns if c in {"weekday", "month", "day_of_month", "quarter", "week_of_month", "year_index", "doy_sin", "doy_cos"}],
        "market_and_side": [c for c in feature_columns if c in {"market", "side", "market_weekday", "market_month", "market_side", "side_weekday", "market_side_weekday"}],
        "state_transitions": [c for c in feature_columns if c.startswith("lag_") or c.startswith("lag_pattern") or c in {"gap_dp_events", "gap_dp_days", "streak_dp", "streak_non_dp", "runs_10", "runs_30"}],
        "rolling_frequency": [c for c in feature_columns if c.startswith("rate_") or c.startswith("prior_dp_count")],
        "prior_panel_digit_geometry": [c for c in feature_columns if c.startswith("last_")],
        "same_market_other_side_history": [c for c in feature_columns if c.startswith("prior_opposite")],
        "cross_market_prior_day": [c for c in feature_columns if c.startswith("prior_") and "market" in c],
        "same_day_schedule_earlier": [c for c in feature_columns if c.startswith("same_day_")],
    }
    result = {"scenario": scenario,
              "scope": "12 app markets; both Open and Close targets",
              "featureColumns": len(feature_columns),
              "featureFamilies": {name: values for name, values in feature_families.items() if values},
              "variantCount": {**library, **model_audit,
                               "numericThresholdDirections": ["<=", ">="],
                               "featureScenarioVariantsAtLeast": len(feature_columns),
                               "ruleAndModelConfigurations": library["totalRuleCandidates"] + model_audit["probabilityConfigurations"]},
              "splits": {"train": int(train.sum()), "validation": int(valid.sum()), "holdout": int(holdout.sum()),
                         "trainThrough": "2024-12-31", "validation": "2025-01-01 through 2025-12-31",
                         "sealedHoldout": "2026-01-01 onward"},
              "dpBaseRates": {name: round(float(y[part].mean()), 4) for name, part in
                              (("train", train), ("validation", valid), ("holdout", holdout))},
              "bestValidationRule": {"rule": best["rule"], "features": best["features"],
                                     "train": best["train"], "validation": best["validation"],
                                     "holdout": holdout_score},
              "dailyBalancedValidationRule": ({"rule": best_daily["rule"], "features": best_daily["features"],
                                                "train": best_daily["train"], "validation": best_daily["validation"],
                                                "holdout": daily_holdout}
                                               if best_daily else None),
              "models": model_results,
              "holdoutReadAfterPolicySelection": "The corrected policy is selected on 2025 only. An earlier disposable run was inspected to catch and remove a same-day availability leak, so this is not a blinded preregistered test.",
              "dailyEvaluation": {"callBuckets": "per calendar date; full and grouped by exact number of calls",
                                  "5To10CallDayDescriptors": ["perfect", "at least 80%", "at least 70%"],
                                  "notAnIndependentTrialCount": True},
              "validationRuleTable": str(validation_csv.relative_to(ROOT))}
    return result


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows, audit = read_source()
    frame, build_info = build_cases(rows)
    results = {
        "method": "Independent feature engineering and candidate search over the saved chart_rows.csv; no app files changed.",
        "label": "DP iff a three digit panel has exactly two distinct digits; SP and TP are negatives.",
        "sourceAudit": audit,
        "perMarketCoverageAndBaseRate": source_summary(rows),
        "featureBuild": build_info,
        "selectionProtocol": {
            "train": "through 2024-12-31",
            "validation": "2025-01-01 through 2025-12-31",
            "holdout": "2026-01-01 through latest available date; retrospective, not prospectively preregistered",
            "candidateSelection": "2025 only; thresholds are derived from train values",
            "ruleSupport": "at least 100 train calls, at least 30 validation calls, at least 20 validation active dates",
            "probabilitySupport": "at least 30 validation calls and 20 active dates",
            "confidence": "exact two-sided 95% binomial interval plus weekly block bootstrap interval",
            "caveat": "Searching correlated rules is not independent replication. The 2026 interval is conditional on the policy selected in 2025.",
        },
        "scenarios": [evaluate_scenario(frame, "start_of_day", []),
                      evaluate_scenario(frame, "schedule_aware", [])],
    }
    (OUT / "results.json").write_text(json.dumps(results, indent=2, default=lambda value: list(value) if isinstance(value, tuple) else str(value)) + "\n", encoding="utf-8")
    def summary_metric(item: dict[str, Any] | None) -> dict[str, Any] | None:
        if not item:
            return None
        daily = item["daily"]
        return {"calls": item["calls"], "hits": item["hits"], "precision": item["precision"],
                "exact95": item["confidence"]["exact95"],
                "weekBlockBootstrap95": item["confidence"]["weekBlockBootstrap95"],
                "activeDays": daily["activeDays"], "daysWith5To10Calls": daily["daysWith5To10Calls"],
                "5To10Calls": daily["targetBucketCalls"], "5To10Hits": daily["targetBucketHits"],
                "perfect5To10CallDays": daily["perfect5To10CallDays"],
                "atLeast70Percent5To10CallDays": daily["atLeast70Percent5To10CallDays"]}

    concise = {"sourceAudit": audit, "featureBuild": {k: v for k, v in build_info.items() if not k.endswith("Columns")},
               "scenarios": [{"scenario": s["scenario"],
                              "bestValidationRule": {"rule": s["bestValidationRule"]["rule"],
                                                     "validation": summary_metric(s["bestValidationRule"]["validation"]),
                                                     "holdout": summary_metric(s["bestValidationRule"]["holdout"])},
                              "dailyBalancedValidationRule": ({"rule": s["dailyBalancedValidationRule"]["rule"],
                                                                "validation": summary_metric(s["dailyBalancedValidationRule"]["validation"]),
                                                                "holdout": summary_metric(s["dailyBalancedValidationRule"]["holdout"])}
                                                               if s["dailyBalancedValidationRule"] else None),
                              "models": [{"model": m["model"], "threshold": m["selectedThreshold"],
                                          "validation": summary_metric(m["validation"]),
                                          "holdout": summary_metric(m["holdout"])}
                                         for m in s["models"]], "variantCount": s["variantCount"]}
                             for s in results["scenarios"]]}
    print(json.dumps(concise, indent=2, default=str))


if __name__ == "__main__":
    main()
