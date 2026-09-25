"""Nested walk-forward search for selective DP calls in the 12 app markets.

All policy search ends on 2025-12-31. The 2026 rows are scored once at the end
and are described as a retrospective audit because earlier work disclosed
aggregate results from that period.
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from scipy.stats import beta, binom

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "research" / "dp_only_v1"
OUT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SOURCE_DIR))
from extended_matrix import PRIMARY, SCHEDULE, build_events, read_rows  # noqa: E402

TRAIN_YEARS = (2021, 2022, 2023, 2024)
MIN_SIGNAL_CALLS = 30
MIN_RULE_CALLS = 60
MIN_RULE_DAYS = 25
SIGNALS_PER_FAMILY = 35
PAIR_POOL_FOR_TRIPLES = 100
TOP_CANDIDATES = 4_000
BLOCK_REPLICATES = 5_000
BLOCK_WEEKS = 4
RNG_SEED = 20260925


@dataclass(frozen=True)
class Signal:
    name: str
    family: str
    roots: frozenset[str]
    mask: int


@dataclass(frozen=True)
class Candidate:
    name: str
    mask: int
    calls: int
    hits: int
    rank: float


def pack_mask(mask: np.ndarray) -> int:
    return int.from_bytes(np.packbits(mask, bitorder="little").tobytes(), "little")


def unpack_mask(mask: int, size: int) -> np.ndarray:
    n_bytes = (size + 7) // 8
    raw = mask.to_bytes(n_bytes, "little")
    return np.unpackbits(np.frombuffer(raw, dtype=np.uint8), bitorder="little")[:size].astype(bool)


def wilson_lower(hits: int, calls: int, z: float = 1.6448536269514722) -> float:
    if not calls:
        return 0.0
    p = hits / calls
    den = 1 + z * z / calls
    return (p + z * z / (2 * calls) - z * math.sqrt(p * (1 - p) / calls + z * z / (4 * calls * calls))) / den


def cp_lower(hits: int, calls: int, alpha: float = 0.05) -> float:
    if not calls or not hits:
        return 0.0
    return float(beta.ppf(alpha, hits, calls - hits + 1))


def panel_features(panel: str) -> dict[str, Any]:
    digits = [int(char) for char in panel]
    counts = Counter(digits)
    repeated = next((digit for digit, count in counts.items() if count == 2), None)
    singleton = next((digit for digit, count in counts.items() if count == 1), None)
    return {
        "prior_panel_sutta": sum(digits) % 10,
        "prior_panel_shape": {3: "SP", 2: "DP", 1: "TP"}[len(counts)],
        "prior_panel_repeated_digit": repeated,
        "prior_panel_single_digit": singleton,
        "prior_panel_has_zero": int(0 in digits),
        "prior_panel_even_digit_count": sum(digit % 2 == 0 for digit in digits),
        "prior_panel_palindrome": int(digits[0] == digits[2]),
        "prior_panel_low_digit_count": sum(digit <= 4 for digit in digits),
        "prior_panel_high_digit_count": sum(digit >= 5 for digit in digits),
        **{f"prior_panel_has_{digit}": int(digit in digits) for digit in range(10)},
    }


def add_observable_features(rows: list[dict[str, str]], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add raw digit and strict-schedule signals to the existing causal features."""
    by_market: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_date_market: dict[date, dict[str, dict[str, str]]] = defaultdict(dict)
    for row in rows:
        if row["market"] not in PRIMARY:
            continue
        day = date.fromisoformat(row["date"])
        by_market[row["market"]].append(row)
        by_date_market[day][row["market"]] = row

    previous_panel: dict[tuple[date, str], dict[str, str]] = {}
    for market, series in by_market.items():
        last: dict[str, str] | None = None
        for row in series:
            day = date.fromisoformat(row["date"])
            if last is not None:
                previous_panel[(day, market)] = last
            last = row

    day_state: dict[date, dict[str, int]] = {}
    for day, market_rows in by_date_market.items():
        labels: list[tuple[int, str, str, int]] = []
        for market, row in market_rows.items():
            timing = SCHEDULE.get(market)
            if timing is None:
                continue
            for side, minute in (("open", timing[0]), ("close", timing[1])):
                panel = row[side]
                y = int(len(set(panel)) == 2)
                labels.append((minute, market, side, y))
        day_state[day] = {
            "count": len(labels),
            "dp": sum(item[3] for item in labels),
            "day_count": sum(item[0] < 18 * 60 for item in labels),
            "day_dp": sum(item[3] for item in labels if item[0] < 18 * 60),
            "night_count": sum(item[0] >= 18 * 60 for item in labels),
            "night_dp": sum(item[3] for item in labels if item[0] >= 18 * 60),
        }

    for event in events:
        day = event["day"]
        market = event["market"]
        side = event["side"]
        x = event["x"]
        timing = SCHEDULE[market]
        target_minute = timing[0 if side == "open" else 1]
        prior: list[tuple[int, str, str, int]] = []
        for source_market, row in by_date_market.get(day, {}).items():
            source_timing = SCHEDULE.get(source_market)
            if source_timing is None:
                continue
            for source_side, minute in (("open", source_timing[0]), ("close", source_timing[1])):
                if minute < target_minute:
                    panel = row[source_side]
                    prior.append((minute, source_market, source_side, int(len(set(panel)) == 2)))
        prior.sort()
        prior_labels = [item[3] for item in prior]
        count = len(prior_labels)
        dp_count = sum(prior_labels)
        x["same_day_prior_dp_run"] = 0
        x["same_day_prior_non_dp_run"] = 0
        for label in reversed(prior_labels):
            if label != 1:
                break
            x["same_day_prior_dp_run"] += 1
        for label in reversed(prior_labels):
            if label != 0:
                break
            x["same_day_prior_non_dp_run"] += 1
        x["same_day_prior_dp_rate_last3"] = float(np.mean(prior_labels[-3:])) if count >= 3 else None
        x["same_day_prior_dp_rate_last5"] = float(np.mean(prior_labels[-5:])) if count >= 5 else None
        x["same_day_prior_dp_rate_last8"] = float(np.mean(prior_labels[-8:])) if count >= 8 else None
        x["same_day_prior_dp_rate_open"] = float(np.mean([item[3] for item in prior if item[2] == "open"])) if any(item[2] == "open" for item in prior) else None
        x["same_day_prior_dp_rate_close"] = float(np.mean([item[3] for item in prior if item[2] == "close"])) if any(item[2] == "close" for item in prior) else None
        x["same_day_prior_last_label"] = prior[-1][3] if prior else None
        x["same_day_prior_last_market"] = prior[-1][1] if prior else None
        x["same_day_prior_last_market_side"] = f"{prior[-1][1]}|{prior[-1][2]}" if prior else None
        x["same_day_prior_last_two_pattern"] = "".join(str(value) for value in prior_labels[-2:]) if count >= 2 else None
        x["same_day_prior_last_three_pattern"] = "".join(str(value) for value in prior_labels[-3:]) if count >= 3 else None
        expected = float(x.get("market_prior_dp_rate", 0.0)) * count
        x["same_day_prior_dp_surprise"] = dp_count - expected
        x["same_day_prior_rate_minus_market_rate"] = dp_count / count - float(x.get("market_prior_dp_rate", 0.0)) if count else None

        prev = previous_panel.get((day, market))
        if prev:
            x.update(panel_features(prev[side]))
        yesterday = day_state.get(day - timedelta(days=1), {})
        for key in ("count", "dp", "day_count", "day_dp", "night_count", "night_dp"):
            x[f"prior_day_{key}"] = yesterday.get(key, 0)
        x["prior_day_dp_rate"] = yesterday.get("dp", 0) / yesterday["count"] if yesterday.get("count", 0) else None
        x["prior_day_day_dp_rate"] = yesterday.get("day_dp", 0) / yesterday["day_count"] if yesterday.get("day_count", 0) else None
        x["prior_day_night_dp_rate"] = yesterday.get("night_dp", 0) / yesterday["night_count"] if yesterday.get("night_count", 0) else None
        for short, long in ((5, 40), (10, 80), (20, 160)):
            a, b = x.get(f"rate_{short}"), x.get(f"rate_{long}")
            x[f"rate_{short}_minus_{long}"] = float(a - b) if a is not None and b is not None else None
        x["rate_10_minus_market_prior"] = float(x["rate_10"] - x["market_prior_dp_rate"])
        x["rate_40_minus_market_prior"] = float(x["rate_40"] - x["market_prior_dp_rate"])
        event["x"] = x
    return events


def event_arrays(events: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(events)
    days = np.array([event["day"].isoformat() for event in events], dtype="U10")
    years = np.array([event["day"].year for event in events], dtype=int)
    labels = np.array([event["y"] for event in events], dtype=np.uint8)
    market = np.array([event["market"] for event in events], dtype=object)
    side = np.array([event["side"] for event in events], dtype=object)
    weekday = np.array([event["day"].weekday() for event in events], dtype=int)
    month = np.array([event["day"].month for event in events], dtype=int)
    dom = np.array([event["day"].day for event in events], dtype=int)
    quarter = np.array([(event["day"].month - 1) // 3 + 1 for event in events], dtype=int)
    day_band = np.array([min((event["day"].day - 1) // 5, 5) + 1 for event in events], dtype=int)
    attrs: dict[str, np.ndarray] = {
        "market": market,
        "side": side,
        "market_side": np.array([f"{m}|{s}" for m, s in zip(market, side)], dtype=object),
        "weekday": weekday,
        "month": month,
        "quarter": quarter,
        "day_band": day_band,
        "weekday_side": np.array([f"{w}|{s}" for w, s in zip(weekday, side)], dtype=object),
        "market_weekday": np.array([f"{m}|{w}" for m, w in zip(market, weekday)], dtype=object),
        "market_month": np.array([f"{m}|{mo}" for m, mo in zip(market, month)], dtype=object),
        "market_side_weekday": np.array([f"{m}|{s}|{w}" for m, s, w in zip(market, side, weekday)], dtype=object),
        "month_side": np.array([f"{mo}|{s}" for mo, s in zip(month, side)], dtype=object),
        "month_start": np.array([int(d <= 5) for d in dom], dtype=int),
        "month_end": np.array([int(d >= 26) for d in dom], dtype=int),
        "year": years,
    }
    x_names = sorted(set().union(*(event["x"].keys() for event in events)))
    x_arrays: dict[str, np.ndarray] = {}
    for name in x_names:
        values = [event["x"].get(name) for event in events]
        if all(value is None or isinstance(value, str) for value in values):
            x_arrays[name] = np.array(values, dtype=object)
        else:
            x_arrays[name] = np.array([np.nan if value is None else float(value) for value in values], dtype=float)
    return {"n": n, "days": days, "years": years, "labels": labels, "market": market,
            "side": side, "attrs": attrs, "x": x_arrays}


def feature_root(name: str) -> frozenset[str]:
    if name == "market": return frozenset({"market"})
    if name == "side": return frozenset({"side"})
    if name in {"market_side", "market_weekday", "market_month", "market_side_weekday",
                "weekday_side", "month_side"}:
        parts = {"market" if "market" in name else "month" if name.startswith("month") else "weekday" if "weekday" in name else "side"}
        if "side" in name: parts.add("side")
        if "weekday" in name: parts.add("weekday")
        if "month" in name: parts.add("month")
        if "market" in name: parts.add("market")
        return frozenset(parts)
    return frozenset({name})


def feature_family(name: str) -> str:
    lower = name.lower()
    if name in {"market", "side", "market_side", "market_weekday", "market_month", "market_side_weekday", "weekday_side", "month_side"}:
        return "target_context"
    if any(token in lower for token in ("weekday", "month", "quarter", "day_band", "year", "doy")):
        return "calendar"
    if lower.startswith("same_day"):
        return "same_day_regime"
    if lower.startswith("prior_day") or lower.startswith("prev_day"):
        return "previous_day_regime"
    if "panel" in lower or "sutta" in lower or "digit" in lower:
        return "previous_panel_shape"
    if lower.startswith("rate_") or "_rate" in lower or "frequency" in lower:
        return "rolling_frequency"
    if "lag" in lower or "gap" in lower or "run" in lower or "streak" in lower:
        return "sequence_state"
    return "other_history"


def make_signals(arrays: dict[str, Any], train_bool: np.ndarray, train_bits: int) -> list[Signal]:
    n = arrays["n"]
    raw_specs: list[tuple[str, np.ndarray, frozenset[str]]] = []
    for name, values in arrays["attrs"].items():
        roots = feature_root(name)
        raw_specs.append((name, values, roots))
    categorical_x = {
        "prior_panel_shape", "prior_panel_repeated_digit", "prior_panel_single_digit",
        "same_day_prior_last_market", "same_day_prior_last_market_side",
        "same_day_prior_last_two_pattern", "same_day_prior_last_three_pattern",
    }
    numeric_names = {
        "lag1_dp", "lag2_dp", "lag3_dp", "lag4_dp", "lag5_dp",
        "rate_5", "rate_10", "rate_20", "rate_40", "rate_80", "rate_160", "rate_320",
        "gap_dp_events", "gap_dp_days", "dp_run", "non_dp_run", "opposite_lag1_dp",
        "opposite_rate_10", "opposite_rate_40", "same_market_expanding_rate", "market_prior_dp_rate",
        "weekday_prior_dp_rate", "month_prior_dp_rate", "prior_panel_sum", "prior_panel_spread",
        "prior_panel_entropy", "prior_panel_sum_rate_20", "prior_panel_spread_rate_20",
        "prev_day_other_dp_count", "prev_day_other_event_count", "prev_day_other_dp_rate",
        "same_day_prior_event_count", "same_day_prior_dp_count", "same_day_prior_dp_rate",
        "same_day_prior_open_dp_count", "same_day_prior_close_dp_count", "same_day_prior_market_dp_count",
        "same_day_prior_dp_run", "same_day_prior_non_dp_run", "same_day_prior_dp_rate_last3",
        "same_day_prior_dp_rate_last5", "same_day_prior_dp_rate_last8", "same_day_prior_dp_rate_open",
        "same_day_prior_dp_rate_close", "same_day_prior_last_label", "same_day_prior_dp_surprise",
        "same_day_prior_rate_minus_market_rate", "prior_day_count", "prior_day_dp", "prior_day_day_count",
        "prior_day_day_dp", "prior_day_night_count", "prior_day_night_dp", "prior_day_dp_rate",
        "prior_day_day_dp_rate", "prior_day_night_dp_rate", "rate_5_minus_40", "rate_10_minus_80",
        "rate_20_minus_160", "rate_10_minus_market_prior", "rate_40_minus_market_prior", "year",
    }
    raw_specs.extend((name, values, frozenset({name})) for name, values in arrays["x"].items()
                     if name in categorical_x and values.dtype == object)
    signals: list[Signal] = []
    seen: set[tuple[int, frozenset[str]]] = set()

    def add(name: str, family: str, roots: frozenset[str], mask: np.ndarray) -> None:
        if int((mask & train_bool).sum()) < MIN_SIGNAL_CALLS:
            return
        packed = pack_mask(mask)
        key = (packed, roots)
        if key in seen:
            return
        seen.add(key)
        signals.append(Signal(name, family, roots, packed))

    for name, values, roots in raw_specs:
        observed = values[train_bool]
        levels, counts = np.unique(observed[~pd_is_missing(observed)], return_counts=True)
        for level, count in zip(levels, counts):
            if count < MIN_SIGNAL_CALLS:
                continue
            valid = ~pd_is_missing(values)
            add(f"{name} == {level}", feature_family(name), roots, valid & (values == level))

    for name in numeric_names:
        values = arrays["x"].get(name)
        if values is None and name == "year":
            values = arrays["years"].astype(float)
        if values is None or values.dtype == object:
            continue
        train_values = values[train_bool & np.isfinite(values)]
        if len(train_values) < MIN_SIGNAL_CALLS or np.nanmin(train_values) == np.nanmax(train_values):
            continue
        unique = np.unique(train_values)
        if len(unique) <= 12:
            for level in unique:
                valid = np.isfinite(values)
                add(f"{name} == {level:g}", feature_family(name), frozenset({name}), valid & (values == level))
        quantiles = np.unique(np.quantile(train_values, [.15, .30, .45, .55, .70, .85]))
        for threshold in quantiles:
            valid = np.isfinite(values)
            add(f"{name} <= {threshold:.6g}", feature_family(name), frozenset({name}), valid & (values <= threshold))
            add(f"{name} >= {threshold:.6g}", feature_family(name), frozenset({name}), valid & (values >= threshold))

    # Keep a fixed, train-ranked quota from every source family. Calendar or market
    # signals cannot crowd all state and same-day signals out of the interaction pool.
    by_family: dict[str, list[tuple[float, int, Signal]]] = defaultdict(list)
    for signal in signals:
        selected = signal.mask & train_bits
        calls = selected.bit_count()
        hits = (selected & arrays["y_bits"]).bit_count()
        rank = wilson_lower(hits, calls)
        by_family[signal.family].append((rank, calls, signal))
    pool: list[Signal] = []
    for family, group in by_family.items():
        group.sort(key=lambda item: (item[0], item[1]), reverse=True)
        pool.extend(item[2] for item in group[:SIGNALS_PER_FAMILY])
    # Deduplicate identical masks again after family quotas; preserve the first rule.
    unique_pool: dict[int, Signal] = {}
    for signal in pool:
        unique_pool.setdefault(signal.mask, signal)
    return list(unique_pool.values())


def pd_is_missing(values: np.ndarray) -> np.ndarray:
    if values.dtype == object:
        return np.array([value is None or (isinstance(value, float) and np.isnan(value)) for value in values], dtype=bool)
    return ~np.isfinite(values)


def active_days(mask: int, size: int, day_arrays: np.ndarray) -> int:
    indices = np.flatnonzero(unpack_mask(mask, size))
    return len(np.unique(day_arrays[indices])) if len(indices) else 0


def add_ranked(heap: list[tuple[float, int, Candidate]], sequence: int,
               name: str, mask: int, train_bits: int, y_bits: int) -> int:
    selected = mask & train_bits
    calls = selected.bit_count()
    if calls < MIN_RULE_CALLS:
        return sequence
    hits = (selected & y_bits).bit_count()
    candidate = Candidate(name, mask, calls, hits, wilson_lower(hits, calls))
    item = (candidate.rank, sequence, candidate)
    if len(heap) < TOP_CANDIDATES:
        import heapq
        heapq.heappush(heap, item)
    elif item[0] > heap[0][0]:
        import heapq
        heapq.heapreplace(heap, item)
    return sequence + 1


def select_rule(arrays: dict[str, Any], train_bool: np.ndarray, train_bits: int, y_bits: int) -> tuple[Candidate, dict[str, Any]]:
    signals = make_signals(arrays, train_bool, train_bits)
    heap: list[tuple[float, int, Candidate]] = []
    seq = 0
    candidate_count = 0
    best_unique_single_masks: set[int] = set()
    for signal in signals:
        selected = signal.mask & train_bits
        if selected.bit_count() >= MIN_RULE_CALLS and signal.mask not in best_unique_single_masks:
            best_unique_single_masks.add(signal.mask)
            candidate_count += 1
            seq = add_ranked(heap, seq, signal.name, signal.mask, train_bits, y_bits)

    pairs: list[tuple[float, int, Signal, Signal, int, int, int]] = []
    seen_pairs: set[int] = set()
    for left_index, left in enumerate(signals):
        for right in signals[left_index + 1:]:
            if left.roots & right.roots:
                continue
            combined = left.mask & right.mask
            if combined in seen_pairs:
                continue
            calls = (combined & train_bits).bit_count()
            if calls < MIN_RULE_CALLS:
                continue
            seen_pairs.add(combined)
            hits = (combined & train_bits & y_bits).bit_count()
            rank = wilson_lower(hits, calls)
            pairs.append((rank, calls, left, right, combined, hits, candidate_count))
            candidate_count += 1
            seq = add_ranked(heap, seq, f"({left.name}) AND ({right.name})", combined, train_bits, y_bits)

    pairs.sort(key=lambda item: (item[0], item[1]), reverse=True)
    top_pairs = pairs[:PAIR_POOL_FOR_TRIPLES]
    seen_triples: set[int] = set()
    for _, _, left, right, pair_mask, _, _ in top_pairs:
        pair_roots = left.roots | right.roots
        for third in signals:
            if pair_roots & third.roots:
                continue
            combined = pair_mask & third.mask
            if combined in seen_triples:
                continue
            calls = (combined & train_bits).bit_count()
            if calls < MIN_RULE_CALLS:
                continue
            seen_triples.add(combined)
            candidate_count += 1
            seq = add_ranked(heap, seq, f"({left.name}) AND ({right.name}) AND ({third.name})",
                             combined, train_bits, y_bits)

    finalists = [item[2] for item in sorted(heap, key=lambda item: (item[0], item[2].calls), reverse=True)]
    train_days = arrays["days"]
    chosen: Candidate | None = None
    chosen_days = 0
    for candidate in finalists:
        days = active_days(candidate.mask & train_bits, arrays["n"], train_days)
        if days < MIN_RULE_DAYS:
            continue
        chosen, chosen_days = candidate, days
        break
    if chosen is None:
        raise RuntimeError(f"No rule met training support. signals={len(signals)}, candidates={candidate_count}")
    base_rate = float(arrays["labels"][train_bool].mean())
    nominal_p = float(binom.sf(chosen.hits - 1, chosen.calls, base_rate))
    return chosen, {
        "signalPool": len(signals), "singleMasks": len(best_unique_single_masks),
        "eligiblePairMasks": len(pairs), "pairPoolForTriples": len(top_pairs),
        "eligibleTripleMasks": len(seen_triples), "totalDistinctCandidateMasksTested": candidate_count,
        "selectedTrainingCalls": chosen.calls, "selectedTrainingHits": chosen.hits,
        "selectedTrainingPrecision": chosen.hits / chosen.calls,
        "selectedTrainingActiveDays": chosen_days,
        "selectedTrainingWilsonLowerOneSided95": chosen.rank,
        "trainingBaseRate": base_rate,
        "trainingNominalOneSidedBinomialP": nominal_p,
        "trainingBonferroniP": min(1.0, nominal_p * max(1, candidate_count)),
        "trainingPValueCaveat": "Bonferroni adjusts the recorded candidate count, but the binomial null assumes independent calls and does not preserve date-level clustering. Walk-forward scores are the main check.",
    }


def mask_metrics(mask: int, scope_bits: int, arrays: dict[str, Any]) -> dict[str, Any]:
    selected_bits = mask & scope_bits
    chosen = unpack_mask(selected_bits, arrays["n"])
    indices = np.flatnonzero(chosen)
    calls = len(indices)
    hits = int(arrays["labels"][indices].sum()) if calls else 0
    by_day: dict[str, list[int]] = defaultdict(list)
    for index in indices:
        by_day[str(arrays["days"][index])].append(int(arrays["labels"][index]))
    day_rows = [{"date": key, "calls": len(values), "hits": sum(values),
                 "precision": sum(values) / len(values)} for key, values in sorted(by_day.items())]
    return {
        "calls": calls, "hits": hits, "falseCalls": calls - hits,
        "precision": hits / calls if calls else None,
        "oneSidedExact95Lower": cp_lower(hits, calls),
        "activeDates": len(day_rows),
        "daysAtLeast70Percent": sum(row["precision"] >= .70 for row in day_rows),
        "daysAtLeast90Percent": sum(row["precision"] >= .90 for row in day_rows),
        "perfectDays": sum(row["precision"] == 1 for row in day_rows),
        "dailyCallBuckets": daily_buckets(day_rows),
        "dailyRows": day_rows,
    }


def daily_buckets(day_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    bounds = (("1", 1, 1), ("2", 2, 2), ("3-4", 3, 4), ("5-10", 5, 10), ("11+", 11, 1000))
    result: dict[str, dict[str, Any]] = {}
    for label, low, high in bounds:
        rows = [row for row in day_rows if low <= row["calls"] <= high]
        calls = sum(row["calls"] for row in rows)
        hits = sum(row["hits"] for row in rows)
        result[label] = {"days": len(rows), "calls": calls, "hits": hits,
                         "precision": hits / calls if calls else None,
                         "daysAtLeast70Percent": sum(row["precision"] >= .70 for row in rows),
                         "perfectDays": sum(row["precision"] == 1 for row in rows)}
    return result


def block_bootstrap(yearly_days: dict[int, dict[str, tuple[int, int]]]) -> list[float] | None:
    """Resample four consecutive weeks within each scored year, retaining each date's events."""
    rng = np.random.default_rng(RNG_SEED)
    estimates: list[float] = []
    series_by_year: dict[int, tuple[list[tuple[int, int]], int]] = {}
    for year, daily in yearly_days.items():
        if not daily:
            continue
        dates = sorted(daily)
        first = date.fromisoformat(dates[0])
        last = date.fromisoformat(dates[-1])
        first_week = first - timedelta(days=first.weekday())
        last_week = last - timedelta(days=last.weekday())
        weeks: list[tuple[int, int]] = []
        cursor = first_week
        while cursor <= last_week:
            totals = [value for day_text, value in daily.items()
                      if (date.fromisoformat(day_text) - timedelta(days=date.fromisoformat(day_text).weekday())) == cursor]
            weeks.append((sum(value[0] for value in totals), sum(value[1] for value in totals)))
            cursor += timedelta(days=7)
        series_by_year[year] = (weeks, len(weeks))
    if sum(sum(calls > 0 for calls, _ in weeks) for weeks, _ in series_by_year.values()) < 8:
        return None
    for _ in range(BLOCK_REPLICATES):
        total_calls = total_hits = 0
        for weeks, target_size in series_by_year.values():
            n_weeks = len(weeks)
            if not n_weeks:
                continue
            selected: list[int] = []
            while len(selected) < target_size:
                start = int(rng.integers(0, n_weeks))
                selected.extend((start + offset) % n_weeks for offset in range(BLOCK_WEEKS))
            for index in selected[:target_size]:
                calls, hits = weeks[index]
                total_calls += calls
                total_hits += hits
        if total_calls:
            estimates.append(total_hits / total_calls)
    return [float(np.quantile(estimates, .025)), float(np.quantile(estimates, .975))] if estimates else None


def audit_source(rows: list[dict[str, str]]) -> dict[str, Any]:
    return {
        "archivedDrawRows": len(rows),
        "appMarketRows": sum(row["market"] in PRIMARY for row in rows),
        "marketCountInArchive": len({row["market"] for row in rows}),
        "appMarkets": sorted(PRIMARY),
        "firstDate": min(row["date"] for row in rows),
        "lastDate": max(row["date"] for row in rows),
        "scheduleSource": "src/lib/market-schedule.ts, copied into research/dp_only_v1/extended_matrix.py",
        "strictScheduleAssumption": "Same-day source panel is eligible only when its configured event minute is strictly earlier than the target. Chart publication timestamps and historical schedule changes are unavailable.",
    }


def main() -> None:
    rows = read_rows()
    events, _ = build_events(rows)
    events = [event for event in events if event["market"] in PRIMARY]
    events = add_observable_features(rows, events)
    arrays = event_arrays(events)
    arrays["y_bits"] = pack_mask(arrays["labels"].astype(bool))
    fold_results: list[dict[str, Any]] = []
    oos_mask = np.zeros(arrays["n"], dtype=bool)
    yearly_daily: dict[int, dict[str, tuple[int, int]]] = {}
    for validation_year in TRAIN_YEARS:
        train_bool = arrays["years"] <= validation_year - 1
        validation_bool = arrays["years"] == validation_year
        train_bits = pack_mask(train_bool)
        validation_bits = pack_mask(validation_bool)
        selected, search = select_rule(arrays, train_bool, train_bits, arrays["y_bits"])
        metrics = mask_metrics(selected.mask, validation_bits, arrays)
        fold_mask = unpack_mask(selected.mask & validation_bits, arrays["n"])
        oos_mask |= fold_mask
        yearly_daily[validation_year] = {row["date"]: (row["calls"], row["hits"]) for row in metrics["dailyRows"]}
        fold_results.append({
            "validationYear": validation_year,
            "trainingThrough": f"{validation_year - 1}-12-31",
            "selectedRule": selected.name,
            "search": search,
            "validation": metrics,
        })

    # The final policy is selected through 2025 and scored once on the previously
    # inspected 2026 period. No 2026 result is used in signal or rule selection.
    final_train_bool = arrays["years"] <= 2025
    final_train_bits = pack_mask(final_train_bool)
    final_rule, final_search = select_rule(arrays, final_train_bool, final_train_bits, arrays["y_bits"])
    audit_bool = arrays["years"] == 2026
    audit_metrics = mask_metrics(final_rule.mask, pack_mask(audit_bool), arrays)
    yearly_daily[2026] = {row["date"]: (row["calls"], row["hits"]) for row in audit_metrics["dailyRows"]}

    oos_metrics = mask_metrics(pack_mask(oos_mask), pack_mask(np.isin(arrays["years"], TRAIN_YEARS)), arrays)
    result = {
        "method": "Train-ranked signal quotas and 2/3-way intersections selected only from prior years; each selected rule is scored on the next full year.",
        "label": "DP iff exactly two distinct digits in the three-digit panel. SP and TP are negatives.",
        "source": audit_source(rows),
        "protocol": {
            "outerWalkForwardYears": list(TRAIN_YEARS),
            "finalHistoricalTrainingEnd": "2025-12-31",
            "priorAuditOverlap": "Earlier project reports already examined overlapping chart history, including 2024-2025 validation. The yearly rules use only prior-year data, but this retrospective run is not a blind or preregistered holdout.",
            "2026Role": "Retrospective audit only. Earlier reports already disclosed 2026 aggregate results, so this is not pristine holdout evidence.",
            "minimumTrainingCallsPerSelectedRule": MIN_RULE_CALLS,
            "minimumTrainingActiveDates": MIN_RULE_DAYS,
            "minimumAtomicSignalTrainingSupport": MIN_SIGNAL_CALLS,
            "families": ["market/side", "calendar", "lag state", "rolling DP rates", "prior panel digit shape", "strictly earlier same-day sequence", "prior-day cross-market regime"],
            "interactions": "One-, two-, and three-signal rules. Interaction pairs are selected from training-ranked atomic signals, and triples extend training-ranked pairs.",
            "familyQuota": SIGNALS_PER_FAMILY,
            "multipleTesting": "Every retained rule mask is included in a training-only Bonferroni diagnostic. Main performance is measured on untouched next-year folds, followed by a four-week moving-block bootstrap that clusters same-day outcomes and nearby weeks.",
            "limits": ["Configured schedule times are not archived publication timestamps.", "The chart export comes from one provider and has no independent source verification.", "No betting ledger, payout liability, operator rule, or operator statement is observed, so results cannot identify operator psychology or causation."],
        },
        "nestedWalkForward": {"selectedRuleByYear": fold_results, "pooledOutOfSample": oos_metrics,
                              "fourWeekMovingBlockBootstrap95": block_bootstrap(yearly_daily)},
        "finalRuleTrainedThrough2025": {
            "selectedRule": final_rule.name,
            "trainingSearch": final_search,
            "retrospective2026Audit": audit_metrics,
        },
        "interpretation": "A high in-sample precision rule is not accepted as an accurate model unless the same past-only selection procedure repeats out of time with adequate daily support.",
    }
    (OUT_DIR / "conditional_results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    write_report(result)
    print(json.dumps({
        "pooledWalkForward": {key: value for key, value in oos_metrics.items() if key not in {"dailyRows"}},
        "blockBootstrap95": result["nestedWalkForward"]["fourWeekMovingBlockBootstrap95"],
        "folds": [{"year": fold["validationYear"], "rule": fold["selectedRule"],
                   "calls": fold["validation"]["calls"], "hits": fold["validation"]["hits"],
                   "precision": fold["validation"]["precision"], "days": fold["validation"]["activeDates"]}
                  for fold in fold_results],
        "finalRule": final_rule.name,
        "audit2026": {key: value for key, value in audit_metrics.items() if key not in {"dailyRows"}},
        "output": str(OUT_DIR / "conditional_results.json"),
    }, indent=2, allow_nan=False))


def write_report(data: dict[str, Any]) -> None:
    wf = data["nestedWalkForward"]
    pooled = wf["pooledOutOfSample"]
    audit = data["finalRuleTrainedThrough2025"]["retrospective2026Audit"]
    lines = [
        "# Conditional DP pattern search",
        "",
        "## Result",
        "",
        f"The past-only selection procedure did not establish a selective DP rule. The pooled {TRAIN_YEARS[0]}-{TRAIN_YEARS[-1]} walk-forward table below is the main result. Earlier project reports examined overlapping chart history, including 2024-2025 validation, so this is a retrospective diagnostic rather than a blind holdout.",
        "",
        "## Walk-forward protocol",
        "",
        f"For each year from {TRAIN_YEARS[0]} through {TRAIN_YEARS[-1]}, the search ranks signals using data ending the prior December, then evaluates the selected one-, two-, or three-signal rule on the full next year. A rule must have at least {MIN_RULE_CALLS} training calls across at least {MIN_RULE_DAYS} dates. Signal thresholds come from that fold's training data only.",
        "",
        "Signals cover target market and side, weekday and month, rolling DP rates, lag and gap state, the preceding panel's digit shape, the previous day's market regime, and outcomes scheduled strictly earlier on the same date. Same-day features follow the current app schedule. The archive does not contain result publication timestamps, so actual availability at each configured time is unverified.",
        "",
        "The search keeps a training-ranked quota from each signal family, intersects pairs, and extends the strongest training pairs into triples. It reports a training-only Bonferroni p-value as a multiple-testing diagnostic. That p-value uses the pooled training DP rate and does not account for different base rates by market. The rule's next-year score and the four-week moving-block interval are the primary checks. Exact call-level bounds assume independent calls; same-day events are clustered in the block bootstrap.",
        "",
        "## Selected rules by year",
        "",
        "| Test year | Selected rule from prior years | Training support | Test calls | Hits | Precision | One-sided exact 95% lower bound | Active dates | Days at 5-10 calls |",
        "|---:|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for fold in wf["selectedRuleByYear"]:
        m = fold["validation"]
        training = fold["search"]
        lines.append(
            f"| {fold['validationYear']} | {fold['selectedRule']} | {training['selectedTrainingHits']}/{training['selectedTrainingCalls']} "
            f"({training['selectedTrainingActiveDays']} dates) | {m['calls']} | {m['hits']} | "
            f"{m['precision']:.1%} | {m['oneSidedExact95Lower']:.1%} | {m['activeDates']} | "
            f"{m['dailyCallBuckets']['5-10']['days']} |"
        )
    boot = wf["fourWeekMovingBlockBootstrap95"]
    boot_text = "not estimable" if boot is None else f"{boot[0]:.1%}-{boot[1]:.1%}"
    lines.extend([
        "",
        f"Pooled next-year calls: **{pooled['hits']} correct out of {pooled['calls']} calls ({pooled['precision']:.1%})**, across {pooled['activeDates']} active dates. The call-level one-sided exact 95% lower bound is {pooled['oneSidedExact95Lower']:.1%}. The four-week moving-block bootstrap 95% interval is {boot_text}.",
        "",
        "### Daily calls and hits in the pooled walk-forward period",
        "",
        "| Calls on date | Dates | Calls | Hits | Precision | Dates at 70%+ | Perfect dates |",
        "|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for bucket, value in pooled["dailyCallBuckets"].items():
        lines.append(f"| {bucket} | {value['days']} | {value['calls']} | {value['hits']} | "
                     f"{(value['precision'] or 0):.1%} | {value['daysAtLeast70Percent']} | {value['perfectDays']} |")
    lines.extend([
        "",
        "The 70% day count is descriptive. A date with one successful call is not evidence that the rule's call-level precision is stable.",
        "",
        "## Final rule and 2026 retrospective audit",
        "",
        f"The rule selected using data through 2025 was `{data['finalRuleTrainedThrough2025']['selectedRule']}`. It had training support {data['finalRuleTrainedThrough2025']['trainingSearch']['selectedTrainingHits']}/{data['finalRuleTrainedThrough2025']['trainingSearch']['selectedTrainingCalls']} across {data['finalRuleTrainedThrough2025']['trainingSearch']['selectedTrainingActiveDays']} dates. Its training Bonferroni-adjusted nominal p-value was {data['finalRuleTrainedThrough2025']['trainingSearch']['trainingBonferroniP']:.3g}; the underlying independent-call assumption is not satisfied by the date clusters.",
        "",
        f"On the previously inspected 2026 history, the rule was correct on **{audit['hits']} of its {audit['calls']} calls ({audit['precision']:.1%})**, with a one-sided exact 95% lower bound of {audit['oneSidedExact95Lower']:.1%}, across {audit['activeDates']} dates. All were one-call dates; {audit['perfectDays']} of those dates had a correct call. No date had 5-10 calls.",
        "",
        "## Why operator psychology remains unmeasured",
        "",
        "The project notes suggest that operators choose results from betting liability, but this archive contains only published panels. It has no wagers by number, payout exposure, operator records, or result-selection timestamps. Public panel sequences can test predictive association, but they cannot tell us what an operator thought or whether a pattern reflects intent. The historical schedule is also an assumption, and the chart export has not been independently checked against a second provider.",
        "",
        "## Reproduction",
        "",
        "Run `python research/dp_conditional_v1/conditional_search.py` from the repository root. Outputs are `conditional_results.json` and this report. The script reads the saved `research/dp_only_v1/chart_rows.csv` and does not edit app code.",
        "",
    ])
    (OUT_DIR / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
