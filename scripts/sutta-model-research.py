"""Leakage-safe Top-6 sutta research over the refreshed two-year cache."""

from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scratch" / "sutta-research-records.json"
OUTPUT = ROOT / "scratch" / "sutta-candidate-research.json"
MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]
DAY_OFFSET = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}
WINDOWS = {"7d": 7, "30d": 30, "6m": 183, "1y": 365, "2y": 730}
TARGETS = ("open", "close", "adjustedClose", "jodi")
PHASES = {"development": (213, 10_000), "validation": (30, 213), "holdout30": (0, 30)}
JODI_OPEN_CANDIDATES = (
    "recent7_hot", "recent14_hot", "calendar_date", "frequency_ensemble", "delta", "same_house",
)
JODI_CLOSE_CANDIDATES = (
    "recent30_cold", "calendar_date", "delta", "opposite_calendar", "transition", "recent7_hot",
)


@dataclass(frozen=True)
class Row:
    iso: str
    day: str
    day_of_month: int
    open: int
    close: int
    jodi: str


def iso_date(record: dict) -> str:
    start = datetime.strptime(record["dateRangeStart"].replace("-", "/"), "%d/%m/%Y").date()
    return (start + timedelta(days=DAY_OFFSET.get(record["day"], 0))).isoformat()


def load_rows() -> dict[str, list[Row]]:
    raw = json.loads(CACHE.read_text(encoding="utf-8"))
    result: dict[str, list[Row]] = {}
    for market in MARKETS:
        rows = []
        for record in raw[market]:
            iso = iso_date(record)
            rows.append(Row(
                iso=iso,
                day=record["day"],
                day_of_month=date.fromisoformat(iso).day,
                open=int(record["openSutta"]),
                close=int(record["closeSutta"]),
                jodi=str(record["jodi"]),
            ))
        result[market] = sorted(rows, key=lambda row: row.iso)
    return result


def rate(count: int, total: int, alpha: float = 2.0) -> float:
    return (count + alpha) / (total + alpha * 10)


def normalized_counts(values: list[int], alpha: float = 2.0) -> list[float]:
    counts = Counter(values)
    return [rate(counts[digit], len(values), alpha) for digit in range(10)]


def rank(scores: list[float]) -> list[int]:
    return sorted(range(10), key=lambda digit: (-scores[digit], digit))


def opposite(digit: int) -> int:
    return (digit + 5) % 10


def house(digit: int) -> str:
    return "low" if 1 <= digit <= 5 else "high"


def series(prior: list[Row], side: str) -> list[int]:
    return [getattr(row, side) for row in prior]


def context_counts(
    prior: list[Row],
    target_side: str,
    source: Callable[[Row], int],
    source_value: int,
) -> tuple[list[float], int]:
    matches = [getattr(prior[index], target_side) for index in range(1, len(prior)) if source(prior[index - 1]) == source_value]
    return normalized_counts(matches, 1.5), len(matches)


def current_open_counts(prior: list[Row], current_open: int) -> tuple[list[float], int]:
    matches = [row.close for row in prior if row.open == current_open]
    return normalized_counts(matches, 1.5), len(matches)


def feature_scores(prior: list[Row], side: str, target: Row) -> dict[str, list[float]]:
    values = series(prior, side)
    long = normalized_counts(values)
    recent = {window: normalized_counts(values[-window:]) for window in (7, 14, 30, 60, 90)}
    weekday_values = [getattr(row, side) for row in prior if row.day == target.day]
    calendar_values = [getattr(row, side) for row in prior if row.day_of_month == target.day_of_month]
    weekday = normalized_counts(weekday_values, 2.5)
    calendar = normalized_counts(calendar_values, 3.0)
    previous_same = values[-1]
    transition, transition_n = context_counts(prior, side, lambda row: getattr(row, side), previous_same)
    other_side = "close" if side == "open" else "open"
    previous_other = getattr(prior[-1], other_side)
    cross_transition, cross_n = context_counts(prior, side, lambda row: getattr(row, other_side), previous_other)

    delta_counts = Counter()
    for index in range(1, len(values)):
        delta_counts[(values[index] - values[index - 1]) % 10] += 1
    delta_total = max(0, len(values) - 1)
    delta = [rate(delta_counts[(digit - previous_same) % 10], delta_total, 2.0) for digit in range(10)]

    scores: dict[str, list[float]] = {
        "long_hot": long,
        "recent7_hot": recent[7],
        "recent14_hot": recent[14],
        "recent30_hot": recent[30],
        "recent60_hot": recent[60],
        "recent90_hot": recent[90],
        "recent30_cold": [-value for value in recent[30]],
        "weekday": weekday,
        "calendar_date": calendar,
        "transition": transition,
        "cross_transition": cross_transition,
        "delta": delta,
    }

    scores["opposite_calendar"] = [calendar[opposite(digit)] for digit in range(10)]
    scores["opposite_previous"] = [long[digit] + (0.12 if digit == opposite(previous_same) else 0.0) for digit in range(10)]
    scores["same_house"] = [long[digit] + (0.08 if house(digit) == house(previous_same) else 0.0) for digit in range(10)]
    scores["opposite_house"] = [long[digit] + (0.08 if house(digit) != house(previous_same) else 0.0) for digit in range(10)]
    scores["frequency_ensemble"] = [
        0.12 * long[digit] + 0.22 * recent[30][digit] + 0.20 * recent[60][digit]
        + 0.16 * recent[90][digit] + 0.18 * weekday[digit] + 0.12 * calendar[digit]
        for digit in range(10)
    ]
    transition_weight = min(0.22, transition_n / 100)
    cross_weight = min(0.16, cross_n / 120)
    scores["markov_shrunk"] = [
        (0.28 - transition_weight) * long[digit] + 0.24 * recent[60][digit]
        + 0.18 * weekday[digit] + transition_weight * transition[digit]
        + cross_weight * cross_transition[digit] + 0.14 * delta[digit]
        for digit in range(10)
    ]
    scores["bayesian_backoff"] = [
        0.18 * math.log(max(long[digit], 1e-9))
        + 0.24 * math.log(max(recent[60][digit], 1e-9))
        + 0.18 * math.log(max(weekday[digit], 1e-9))
        + min(0.18, transition_n / 120) * math.log(max(transition[digit], 1e-9))
        + min(0.14, cross_n / 140) * math.log(max(cross_transition[digit], 1e-9))
        + 0.12 * math.log(max(delta[digit], 1e-9))
        for digit in range(10)
    ]

    # The second research cycle deliberately expands beyond global frequency,
    # weekday, and one-step Markov ideas. Every anchor below is known before
    # the target draw. A shrunk long-run distribution prevents a single echo
    # or arithmetic identity from taking over the complete ranking.
    def anchor_score(anchor: int, bonus: float = 0.045) -> list[float]:
        return [long[digit] + (bonus if digit == anchor else 0.0) for digit in range(10)]

    for lag in (1, 2, 3, 5, 7):
        if len(values) >= lag:
            anchor = values[-lag]
            scores[f"lag{lag}_repeat"] = anchor_score(anchor)
            scores[f"lag{lag}_opposite"] = anchor_score(opposite(anchor))

    previous_same_weekday = next(
        (getattr(row, side) for row in reversed(prior) if row.day == target.day),
        previous_same,
    )
    previous_same_date = next(
        (getattr(row, side) for row in reversed(prior) if row.day_of_month == target.day_of_month),
        previous_same,
    )
    scores["same_weekday_echo"] = anchor_score(previous_same_weekday, 0.05)
    scores["same_date_echo"] = anchor_score(previous_same_date, 0.05)
    scores["same_weekday_opposite"] = anchor_score(opposite(previous_same_weekday), 0.05)
    scores["same_date_opposite"] = anchor_score(opposite(previous_same_date), 0.05)

    arithmetic_anchors = {
        "previous_sum": (previous_same + previous_other) % 10,
        "previous_difference": (previous_same - previous_other) % 10,
        "previous_reverse_difference": (previous_other - previous_same) % 10,
        "previous_absolute_difference": abs(previous_same - previous_other) % 10,
        "previous_product": (previous_same * previous_other) % 10,
        "previous_sum_opposite": opposite((previous_same + previous_other) % 10),
    }
    for name, anchor in arithmetic_anchors.items():
        scores[name] = anchor_score(anchor)

    gaps = []
    for digit in range(10):
        gap = next(
            (index for index, value in enumerate(reversed(values)) if value == digit),
            len(values),
        )
        gaps.append(min(gap, 30) / 30)
    scores["gap_due"] = [0.7 * long[digit] + 0.03 * gaps[digit] for digit in range(10)]
    scores["gap_suppression"] = [0.7 * long[digit] - 0.03 * gaps[digit] for digit in range(10)]
    scores["frequency_acceleration"] = [
        0.45 * long[digit] + 0.40 * recent[14][digit] - 0.15 * recent[60][digit]
        for digit in range(10)
    ]
    scores["frequency_mean_reversion"] = [
        0.45 * long[digit] + 0.40 * recent[60][digit] - 0.15 * recent[14][digit]
        for digit in range(10)
    ]

    recent_entropy = -sum(value * math.log(max(value, 1e-9)) for value in recent[30])
    entropy_ratio = min(1.0, recent_entropy / math.log(10))
    scores["entropy_regime"] = [
        entropy_ratio * recent[30][digit] + (1.0 - entropy_ratio) * long[digit]
        for digit in range(10)
    ]

    if side == "close":
        conditional, conditional_n = current_open_counts(prior, target.open)
        conditional_weight = min(0.55, conditional_n / 90)
        scores["known_open"] = conditional
        scores["known_open_bayes"] = [
            (0.34 - conditional_weight * 0.25) * long[digit]
            + 0.20 * recent[60][digit] + 0.14 * weekday[digit]
            + conditional_weight * conditional[digit]
            + 0.12 * delta[digit]
            for digit in range(10)
        ]
        scores["known_open_opposite_house"] = [
            scores["known_open_bayes"][digit]
            + (0.035 if house(digit) != house(target.open) else 0.0)
            for digit in range(10)
        ]
        if "lag7_opposite" in scores:
            current_order = rank(scores["known_open_bayes"])
            lag_order = rank(scores["lag7_opposite"])
            hybrid_order = current_order[:4]
            hybrid_order.extend(digit for digit in lag_order if digit not in hybrid_order)
            scores["known_open4_lag7_opposite"] = [
                float(10 - hybrid_order.index(digit)) for digit in range(10)
            ]
    return scores


def jodi_feature_scores(prior: list[Row], target: Row) -> dict[str, list[float]]:
    values = [int(row.jodi.zfill(2)) for row in prior]

    def rates(sample: list[int], alpha: float = 0.75) -> list[float]:
        counts = Counter(sample)
        return [(counts[value] + alpha) / (len(sample) + alpha * 100) for value in range(100)]

    long = rates(values)
    recent30 = rates(values[-30:])
    recent60 = rates(values[-60:])
    recent90 = rates(values[-90:])
    weekday = rates([int(row.jodi.zfill(2)) for row in prior if row.day == target.day], 1.25)
    calendar = rates([int(row.jodi.zfill(2)) for row in prior if row.day_of_month == target.day_of_month], 1.5)
    previous = values[-1]

    previous_open_matches = [
        int(prior[index].jodi.zfill(2))
        for index in range(1, len(prior))
        if prior[index - 1].open == prior[-1].open
    ]
    previous_close_matches = [
        int(prior[index].jodi.zfill(2))
        for index in range(1, len(prior))
        if prior[index - 1].close == prior[-1].close
    ]
    previous_open = rates(previous_open_matches, 1.25)
    previous_close = rates(previous_close_matches, 1.25)

    open_recent7 = normalized_counts([row.open for row in prior[-7:]])
    open_calendar = normalized_counts([row.open for row in prior if row.day_of_month == target.day_of_month], 3.0)
    close_cold30 = normalized_counts([row.close for row in prior[-30:]])
    close_cold30 = [1.0 - value for value in close_cold30]

    return {
        "direct_jodi:long_hot": long,
        "direct_jodi:recent30_hot": recent30,
        "direct_jodi:recent30_cold": [-value for value in recent30],
        "direct_jodi:recent60_hot": recent60,
        "direct_jodi:recent60_cold": [-value for value in recent60],
        "direct_jodi:recent90_hot": recent90,
        "direct_jodi:weekday": weekday,
        "direct_jodi:calendar": calendar,
        "direct_jodi:previous_open": previous_open,
        "direct_jodi:previous_close": previous_close,
        "direct_jodi:reverse_previous": [
            long[value] + (0.025 if value == (previous % 10) * 10 + previous // 10 else 0.0)
            for value in range(100)
        ],
        "direct_jodi:calendar_cold_pair": [
            open_calendar[value // 10] * close_cold30[value % 10]
            for value in range(100)
        ],
        "direct_jodi:recent7_cold_pair": [
            open_recent7[value // 10] * close_cold30[value % 10]
            for value in range(100)
        ],
    }


def empty_metric() -> dict[str, int]:
    return {"n": 0, "hit": 0}


def add(metric: dict[str, int], hit: bool) -> None:
    metric["n"] += 1
    metric["hit"] += int(hit)


def accuracy(metric: dict[str, int]) -> float:
    return 100.0 * metric["hit"] / metric["n"] if metric["n"] else 0.0


def evaluate(rows_by_market: dict[str, list[Row]]) -> dict:
    metrics = defaultdict(lambda: defaultdict(lambda: defaultdict(empty_metric)))
    per_market = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(empty_metric))))
    candidate_names: set[str] = set()

    for market, rows in rows_by_market.items():
        newest = date.fromisoformat(rows[-1].iso)
        for index in range(50, len(rows)):
            target = rows[index]
            target_date = date.fromisoformat(target.iso)
            age_days = (newest - target_date).days
            active_windows = [name for name, days in WINDOWS.items() if age_days < days]
            active_phases = [
                name for name, (minimum_age, maximum_age) in PHASES.items()
                if minimum_age <= age_days < maximum_age
            ]
            if not active_windows:
                continue
            prior = rows[:index]
            open_scores = feature_scores(prior, "open", target)
            close_scores = feature_scores(prior, "close", target)
            direct_jodi_scores = jodi_feature_scores(prior, target)
            common = sorted(set(open_scores) & set(close_scores))
            candidate_names.update(common)
            candidate_names.update(("known_open", "known_open_bayes", "known_open_opposite_house"))

            open_picks = {name: rank(scores)[:6] for name, scores in open_scores.items()}
            close_picks = {name: rank(scores)[:6] for name, scores in close_scores.items()}
            direct_jodi_picks = {
                name: sorted(range(100), key=lambda value: (-scores[value], value))[:36]
                for name, scores in direct_jodi_scores.items()
            }

            for window in active_windows + active_phases:
                for name in common:
                    open_hit = target.open in open_picks[name]
                    close_hit = target.close in close_picks[name]
                    jodi_hit = open_hit and close_hit
                    add(metrics[window][name]["open"], open_hit)
                    add(metrics[window][name]["close"], close_hit)
                    # Any pre-open Close ranking is also a valid candidate after
                    # Open is known. Score it in the adjusted-close competition
                    # instead of limiting that target to conditional models.
                    add(metrics[window][name]["adjustedClose"], close_hit)
                    add(metrics[window][name]["jodi"], jodi_hit)
                    add(per_market[market][window][name]["open"], open_hit)
                    add(per_market[market][window][name]["close"], close_hit)
                    add(per_market[market][window][name]["adjustedClose"], close_hit)
                    add(per_market[market][window][name]["jodi"], jodi_hit)
                for open_name in JODI_OPEN_CANDIDATES:
                    for close_name in JODI_CLOSE_CANDIDATES:
                        pair_name = f"jodi:{open_name}|{close_name}"
                        hit = target.open in open_picks[open_name] and target.close in close_picks[close_name]
                        add(metrics[window][pair_name]["jodi"], hit)
                        add(per_market[market][window][pair_name]["jodi"], hit)
                for name, picks in direct_jodi_picks.items():
                    hit = int(target.jodi.zfill(2)) in picks
                    add(metrics[window][name]["jodi"], hit)
                    add(per_market[market][window][name]["jodi"], hit)
                for name in sorted(set(close_scores) - set(common)):
                    hit = target.close in close_picks[name]
                    add(metrics[window][name]["adjustedClose"], hit)
                    add(per_market[market][window][name]["adjustedClose"], hit)

    def materialize_metric(metric: dict[str, int]) -> dict:
        return {**metric, "accuracy": round(accuracy(metric), 3)}

    report = {"windows": {}, "perMarket": {}, "candidateNames": sorted(candidate_names)}
    for window, by_candidate in metrics.items():
        report["windows"][window] = {
            candidate: {target: materialize_metric(metric) for target, metric in targets.items()}
            for candidate, targets in by_candidate.items()
        }
    for market, by_window in per_market.items():
        report["perMarket"][market] = {
            window: {
                candidate: {target: materialize_metric(metric) for target, metric in targets.items()}
                for candidate, targets in by_candidate.items()
            }
            for window, by_candidate in by_window.items()
        }
    return report


def print_rankings(report: dict) -> None:
    for window in ("development", "validation", "holdout30", "2y", "1y", "6m", "30d", "7d"):
        print(f"\n=== {window} candidate leaders ===")
        for target in TARGETS:
            rows = []
            for candidate, targets in report["windows"][window].items():
                if target not in targets:
                    continue
                rows.append((targets[target]["accuracy"], targets[target]["hit"], candidate))
            rows.sort(reverse=True)
            leaders = ", ".join(f"{name} {acc:.1f}% ({hits})" for acc, hits, name in rows[:7])
            print(f"{target:14} {leaders}")


CURRENT_MODELS = {
    "open": {
        "Time Bazar": "calendar_date", "Madhur Day": "calendar_date",
        "Rajdhani Day": "calendar_date", "Sridevi Night": "calendar_date",
        "Kalyan Night": "calendar_date", "Milan Night": "calendar_date",
        "Rajdhani Night": "calendar_date", "Main Bazar": "calendar_date",
    },
    "close": {
        "Madhur Day": "recent30_cold", "Rajdhani Day": "delta",
        "Kalyan": "calendar_date", "Sridevi Night": "recent30_cold",
        "Kalyan Night": "recent30_cold", "Madhur Night": "recent30_cold",
        "Milan Night": "recent30_cold", "Rajdhani Night": "recent30_cold",
    },
    "adjustedClose": {
        "Madhur Day": "recent30_cold", "Rajdhani Day": "known_open_bayes",
        "Kalyan Night": "known_open", "Madhur Night": "recent30_cold",
        "Milan Night": "recent30_cold", "Rajdhani Night": "recent30_cold",
    },
}


def promotion_candidates(report: dict) -> list[dict]:
    """Find strict replacements without using holdout improvement as a selector.

    A candidate must add at least one hit in both the older development and the
    later validation block, improve the combined two-year result, and merely
    avoid losing in the final 30-day audit. The last condition verifies rather
    than selects the model.
    """
    rows = []
    for target, markets in CURRENT_MODELS.items():
        for market, current in markets.items():
            market_report = report["perMarket"][market]
            candidate_names = set(market_report["2y"])
            for candidate in candidate_names:
                if target not in market_report["2y"].get(candidate, {}):
                    continue
                comparisons = {}
                valid = True
                for phase in ("development", "validation", "holdout30", "2y"):
                    current_metric = market_report[phase].get(current, {}).get(target)
                    candidate_metric = market_report[phase].get(candidate, {}).get(target)
                    if not current_metric or not candidate_metric:
                        valid = False
                        break
                    comparisons[phase] = candidate_metric["hit"] - current_metric["hit"]
                if not valid or candidate == current:
                    continue
                if (
                    comparisons["development"] >= 1
                    and comparisons["validation"] >= 1
                    and comparisons["holdout30"] >= 0
                    and comparisons["2y"] >= 3
                ):
                    rows.append({
                        "market": market,
                        "target": target,
                        "current": current,
                        "candidate": candidate,
                        "hitDelta": comparisons,
                        "current2y": market_report["2y"][current][target],
                        "candidate2y": market_report["2y"][candidate][target],
                        "currentHoldout": market_report["holdout30"][current][target],
                        "candidateHoldout": market_report["holdout30"][candidate][target],
                    })
    return sorted(
        rows,
        key=lambda row: (row["hitDelta"]["validation"], row["hitDelta"]["2y"]),
        reverse=True,
    )


def exact_sign_test(candidate_only: int, current_only: int) -> float:
    discordant = candidate_only + current_only
    if discordant == 0:
        return 1.0
    tail = sum(math.comb(discordant, index) for index in range(0, min(candidate_only, current_only) + 1))
    return min(1.0, 2.0 * tail / (2 ** discordant))


def stability_audit(rows_by_market: dict[str, list[Row]], promotions: list[dict]) -> list[dict]:
    audited = []
    seen: set[tuple[str, str, str, str]] = set()
    for promotion in promotions:
        key = (
            promotion["market"], promotion["target"],
            promotion["current"], promotion["candidate"],
        )
        if key in seen:
            continue
        seen.add(key)
        market, target, current, candidate = key
        outcomes = []
        rows = rows_by_market[market]
        for index in range(50, len(rows)):
            prior, target_row = rows[:index], rows[index]
            scores = feature_scores(prior, "close" if target == "adjustedClose" else target, target_row)
            if current not in scores or candidate not in scores:
                continue
            actual = target_row.close if target == "adjustedClose" else getattr(target_row, target)
            outcomes.append((
                actual in rank(scores[current])[:6],
                actual in rank(scores[candidate])[:6],
            ))
        candidate_only = sum(candidate_hit and not current_hit for current_hit, candidate_hit in outcomes)
        current_only = sum(current_hit and not candidate_hit for current_hit, candidate_hit in outcomes)
        blocks = []
        for start in range(0, len(outcomes), 90):
            block = outcomes[start:start + 90]
            if len(block) < 30:
                continue
            current_hits = sum(current_hit for current_hit, _ in block)
            candidate_hits = sum(candidate_hit for _, candidate_hit in block)
            blocks.append({
                "n": len(block), "currentHits": current_hits,
                "candidateHits": candidate_hits, "delta": candidate_hits - current_hits,
            })
        raw_p = exact_sign_test(candidate_only, current_only)
        audited.append({
            **promotion,
            "discordant": {"candidateOnly": candidate_only, "currentOnly": current_only},
            "rawMcNemarExactP": round(raw_p, 6),
            # Fifty is a conservative family size for the close/adjusted-close
            # candidates inspected in this cycle.
            "bonferroniP": round(min(1.0, raw_p * 50), 6),
            "testedCandidateCorrection": 50,
            "rolling90Blocks": blocks,
            "nonNegativeBlocks": sum(block["delta"] >= 0 for block in blocks),
            "positiveBlocks": sum(block["delta"] > 0 for block in blocks),
        })
    return audited


def main() -> None:
    rows = load_rows()
    report = evaluate(rows)
    report["promotionCandidates"] = promotion_candidates(report)
    report["stabilityAudit"] = stability_audit(rows, report["promotionCandidates"])
    report["generatedAt"] = datetime.now().astimezone().isoformat()
    report["source"] = str(CACHE)
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print_rankings(report)
    print("\n=== strict market-specific promotion candidates ===")
    for candidate in report["promotionCandidates"][:30]:
        print(candidate)
    print("\n=== rolling stability audit ===")
    for candidate in report["stabilityAudit"][:10]:
        print(candidate)
    print(f"\nSaved {OUTPUT}")


if __name__ == "__main__":
    main()
