"""Market-specific, leakage-safe Open/Close sutta relationship research.

The exact production Top-6 ledger is the baseline. Candidate models may use:
- the latest completed result from any market before the target date;
- same-day markets whose Close time is earlier than the target Open time;
- learned conditional and modular-delta relationships;
- source panel digits/kind, opposite numbers, and house mappings;
- same-weekday, same-date, and same-week-of-month echoes.

Every challenger is converted to a conservative hybrid: production ranks 1-4
are frozen, and the challenger may only choose the remaining Top-6 digits.
"""

from __future__ import annotations

import bisect
import json
import math
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "scratch" / "sutta-research-records.json"
BASELINE = Path(os.environ.get(
    "SUTTA_BASELINE",
    ROOT / "scratch" / "sutta-baseline-730d-cross-market-baseline.json",
))
OUTPUT = Path(os.environ.get(
    "SUTTA_RESEARCH_OUTPUT",
    ROOT / "scratch" / "cross-market-sutta-research-output.json",
))

MARKET_ORDER = [
    "Sridevi", "Time Bazar", "Madhur Day", "Rajdhani Day", "Milan Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]

# Conservative availability cutoff: same-day source features are admitted only
# after the source market has fully closed and before the target market opens.
OPEN_MINUTE = {
    "Sridevi": 11 * 60 + 35, "Time Bazar": 13 * 60 + 10, "Madhur Day": 13 * 60 + 30,
    "Rajdhani Day": 15 * 60 + 5, "Milan Day": 15 * 60 + 10, "Kalyan": 15 * 60 + 45,
    "Sridevi Night": 19 * 60 + 15, "Kalyan Night": 21 * 60 + 45,
    "Madhur Night": 20 * 60 + 30, "Milan Night": 21 * 60 + 5,
    "Rajdhani Night": 21 * 60 + 35, "Main Bazar": 22 * 60,
}
CLOSE_MINUTE = {
    "Sridevi": 12 * 60 + 35, "Time Bazar": 14 * 60 + 10, "Madhur Day": 14 * 60 + 30,
    "Rajdhani Day": 17 * 60 + 5, "Milan Day": 17 * 60 + 10, "Kalyan": 17 * 60 + 45,
    "Sridevi Night": 20 * 60 + 15, "Kalyan Night": 23 * 60 + 45,
    "Madhur Night": 22 * 60 + 30, "Milan Night": 23 * 60 + 5,
    "Rajdhani Night": 23 * 60 + 35, "Main Bazar": 24 * 60 + 10,
}
DAY_OFFSET = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}
PHASES = {"development": (213, 10_000), "validation": (30, 213), "holdout30": (0, 30)}


@dataclass(frozen=True)
class Row:
    market: str
    iso: str
    day: str
    open: int
    close: int
    open_panel: str
    close_panel: str

    @property
    def day_of_month(self) -> int:
        return date.fromisoformat(self.iso).day

    @property
    def week_of_month(self) -> int:
        return (self.day_of_month - 1) // 7 + 1


def iso_date(record: dict) -> str:
    start = datetime.strptime(record["dateRangeStart"].replace("-", "/"), "%d/%m/%Y").date()
    return (start + timedelta(days=DAY_OFFSET.get(record["day"], 0))).isoformat()


def load() -> tuple[dict[str, list[Row]], dict[tuple[str, str], dict]]:
    raw = json.loads(CACHE.read_text(encoding="utf-8"))
    by_market: dict[str, list[Row]] = {}
    for market in MARKET_ORDER:
        rows = [
            Row(
                market=market, iso=iso_date(record), day=record["day"],
                open=int(record["openSutta"]), close=int(record["closeSutta"]),
                open_panel=str(record.get("openPanel") or ""),
                close_panel=str(record.get("closePanel") or ""),
            )
            for record in raw[market]
            if record.get("openPanel") and record.get("closePanel")
        ]
        by_market[market] = sorted(rows, key=lambda row: row.iso)
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    ledger = {(item["market"], item["isoDate"]): item for item in baseline["ledger"]}
    return by_market, ledger


def opposite(value: int) -> int:
    return (value + 5) % 10


def house(value: int) -> int:
    return 0 if value <= 4 else 1


def panel_kind(panel: str) -> int:
    return len(set(panel)) if len(panel) == 3 else 0


def smooth(count: int, total: int, alpha: float = 2.0) -> float:
    return (count + alpha) / (total + 10 * alpha)


def rank(scores: list[float]) -> list[int]:
    return sorted(range(10), key=lambda digit: (-scores[digit], digit))


def hybrid(baseline: list[int], challenger: list[int]) -> list[int]:
    result = list(baseline[:4])
    result.extend(digit for digit in challenger if digit not in result)
    return result[:6]


def direct_scores(long_counts: Counter, total: int, anchor: int, mode: str) -> list[float]:
    scores = [smooth(long_counts[digit], total) for digit in range(10)]
    if mode == "repeat":
        scores[anchor] += 0.045
    elif mode == "opposite":
        scores[opposite(anchor)] += 0.045
    elif mode == "same_house":
        scores = [score + (0.012 if house(digit) == house(anchor) else 0) for digit, score in enumerate(scores)]
    elif mode == "opposite_house":
        scores = [score + (0.012 if house(digit) != house(anchor) else 0) for digit, score in enumerate(scores)]
    return scores


class Relation:
    def __init__(self) -> None:
        self.conditional = [[0] * 10 for _ in range(10)]
        self.delta = [0] * 10
        self.pair = [[0] * 10 for _ in range(100)]

    def add(self, source: Row, target_value: int, source_side: str) -> None:
        source_value = getattr(source, source_side)
        self.conditional[source_value][target_value] += 1
        self.delta[(target_value - source_value) % 10] += 1
        self.pair[source.open * 10 + source.close][target_value] += 1

    def candidates(self, source: Row, source_side: str, long: list[float]) -> dict[str, list[int]]:
        source_value = getattr(source, source_side)
        row = self.conditional[source_value]
        row_n = sum(row)
        delta_n = sum(self.delta)
        pair_row = self.pair[source.open * 10 + source.close]
        pair_n = sum(pair_row)
        result: dict[str, list[int]] = {}
        if row_n >= 12:
            weight = min(0.55, row_n / 100)
            scores = [
                (1 - weight) * long[digit] + weight * smooth(row[digit], row_n, 1.5)
                for digit in range(10)
            ]
            result["conditional"] = rank(scores)
        if delta_n >= 40:
            scores = [
                0.55 * long[digit]
                + 0.45 * smooth(self.delta[(digit - source_value) % 10], delta_n, 2.0)
                for digit in range(10)
            ]
            result["delta"] = rank(scores)
        if pair_n >= 8:
            weight = min(0.45, pair_n / 70)
            scores = [
                (1 - weight) * long[digit] + weight * smooth(pair_row[digit], pair_n, 1.5)
                for digit in range(10)
            ]
            result["open_close_pair"] = rank(scores)
        return result


def phase_for(age: int) -> str:
    return next(name for name, (minimum, maximum) in PHASES.items() if minimum <= age < maximum)


def empty_metric() -> dict:
    return {"n": 0, "baseline": 0, "candidate": 0, "candidateOnly": 0, "baselineOnly": 0}


def add_metric(metric: dict, baseline_hit: bool, candidate_hit: bool) -> None:
    metric["n"] += 1
    metric["baseline"] += int(baseline_hit)
    metric["candidate"] += int(candidate_hit)
    metric["candidateOnly"] += int(candidate_hit and not baseline_hit)
    metric["baselineOnly"] += int(baseline_hit and not candidate_hit)


def evaluate() -> dict:
    by_market, ledger = load()
    date_maps = {market: {row.iso: row for row in rows} for market, rows in by_market.items()}
    date_lists = {market: [row.iso for row in rows] for market, rows in by_market.items()}

    def previous_source(market: str, iso: str) -> Row | None:
        dates = date_lists[market]
        index = bisect.bisect_left(dates, iso) - 1
        return by_market[market][index] if index >= 0 else None

    metrics = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(empty_metric))))
    outcomes = defaultdict(list)
    cases = {}
    influence = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"n": 0, "mutualInformation": 0.0})))

    for target_market in MARKET_ORDER:
        rows = by_market[target_market]
        newest = date.fromisoformat(rows[-1].iso)
        relations: dict[tuple[str, str, str, str], Relation] = {}
        for mode in ("previous", "same_day"):
            for source_market in MARKET_ORDER:
                if mode == "same_day" and CLOSE_MINUTE[source_market] >= OPEN_MINUTE[target_market]:
                    continue
                for source_side in ("open", "close"):
                    for target_side in ("open", "close"):
                        relations[(mode, source_market, source_side, target_side)] = Relation()

        prior_target: list[Row] = []
        for target in rows:
            base = ledger.get((target_market, target.iso))
            if not base:
                # Still update relationship state so later ledger rows train on
                # every available historical target result.
                pass
            if base and len(prior_target) >= 50:
                age = (newest - date.fromisoformat(target.iso)).days
                if age <= 730:
                    phase = phase_for(age)
                    for target_side in ("open", "close"):
                        actual = getattr(target, target_side)
                        baseline_ranking = list(base[f"{target_side}Ranking"])
                        baseline_hit = actual in baseline_ranking
                        values = [getattr(row, target_side) for row in prior_target]
                        long_counts = Counter(values)
                        long = [smooth(long_counts[digit], len(values)) for digit in range(10)]
                        candidates: dict[str, list[int]] = {}

                        # Same-market calendar and previous-result theories.
                        anchors: dict[str, int] = {
                            "previous_same_side": values[-1],
                            "previous_other_side": getattr(prior_target[-1], "close" if target_side == "open" else "open"),
                        }
                        same_weekday = next((row for row in reversed(prior_target) if row.day == target.day), None)
                        same_date = next((row for row in reversed(prior_target) if row.day_of_month == target.day_of_month), None)
                        same_week = next((row for row in reversed(prior_target) if row.week_of_month == target.week_of_month and row.day == target.day), None)
                        if same_weekday:
                            anchors["same_weekday"] = getattr(same_weekday, target_side)
                        if same_date:
                            anchors["same_date"] = getattr(same_date, target_side)
                        if same_week:
                            anchors["same_week_of_month"] = getattr(same_week, target_side)
                        for anchor_name, anchor in anchors.items():
                            for theory in ("repeat", "opposite", "same_house", "opposite_house"):
                                candidates[f"calendar:{anchor_name}:{theory}"] = rank(
                                    direct_scores(long_counts, len(values), anchor, theory)
                                )

                        # Cross-market previous-result and safe same-day effects.
                        for mode in ("previous", "same_day"):
                            for source_market in MARKET_ORDER:
                                key_exists = (mode, source_market, "open", target_side) in relations
                                if not key_exists:
                                    continue
                                source = previous_source(source_market, target.iso) if mode == "previous" else date_maps[source_market].get(target.iso)
                                if source is None:
                                    continue
                                prefix = f"{mode}:{source_market}"
                                for source_side in ("open", "close"):
                                    relation = relations[(mode, source_market, source_side, target_side)]
                                    for method, ordering in relation.candidates(source, source_side, long).items():
                                        candidates[f"{prefix}:{source_side}:{method}"] = ordering
                                    anchor = getattr(source, source_side)
                                    for theory in ("repeat", "opposite", "same_house", "opposite_house"):
                                        candidates[f"{prefix}:{source_side}:{theory}"] = rank(
                                            direct_scores(long_counts, len(values), anchor, theory)
                                        )

                                # Panel-position theories deliberately include
                                # ideas that may sound weak; validation decides.
                                for panel_side in ("open_panel", "close_panel"):
                                    panel = getattr(source, panel_side)
                                    if len(panel) != 3:
                                        continue
                                    for position, digit_text in zip(("first", "middle", "last"), panel):
                                        anchor = int(digit_text)
                                        for theory in ("repeat", "opposite"):
                                            candidates[f"{prefix}:{panel_side}:{position}:{theory}"] = rank(
                                                direct_scores(long_counts, len(values), anchor, theory)
                                            )
                                    kind_anchor = panel_kind(panel) % 10
                                    candidates[f"{prefix}:{panel_side}:kind"] = rank(
                                        direct_scores(long_counts, len(values), kind_anchor, "repeat")
                                    )

                        for name, challenger in candidates.items():
                            prediction = hybrid(baseline_ranking, challenger)
                            candidate_hit = actual in prediction
                            add_metric(metrics[target_market][target_side][name][phase], baseline_hit, candidate_hit)
                            add_metric(metrics[target_market][target_side][name]["all"], baseline_hit, candidate_hit)
                            outcomes[(target_market, target_side, name)].append({
                                "iso": target.iso, "phase": phase,
                                "baseline": baseline_hit, "candidate": candidate_hit,
                                "agreement": len(set(baseline_ranking) & set(challenger[:6])),
                            })
                            case = cases.setdefault(
                                (target_market, target_side, target.iso),
                                {
                                    "phase": phase, "actual": actual,
                                    "baselineRanking": baseline_ranking,
                                    "baselineHit": baseline_hit, "predictions": {},
                                },
                            )
                            case["predictions"][name] = prediction

            # Add the current target result to every future relationship table.
            for mode in ("previous", "same_day"):
                for source_market in MARKET_ORDER:
                    key_exists = (mode, source_market, "open", "open") in relations
                    if not key_exists:
                        continue
                    source = previous_source(source_market, target.iso) if mode == "previous" else date_maps[source_market].get(target.iso)
                    if source is None:
                        continue
                    for source_side in ("open", "close"):
                        for target_side in ("open", "close"):
                            relations[(mode, source_market, source_side, target_side)].add(
                                source, getattr(target, target_side), source_side
                            )
            prior_target.append(target)

    materialized = {}
    promotions = []
    for market, sides in metrics.items():
        materialized[market] = {}
        for side, candidates in sides.items():
            materialized[market][side] = {}
            for name, phases in candidates.items():
                materialized[market][side][name] = dict(phases)
                required = ("development", "validation", "holdout30", "all")
                if not all(phase in phases for phase in required):
                    continue
                delta = {phase: phases[phase]["candidate"] - phases[phase]["baseline"] for phase in required}
                series = outcomes[(market, side, name)]
                rolling = []
                for start in range(0, len(series), 90):
                    block = series[start:start + 90]
                    if len(block) < 30:
                        continue
                    rolling.append(sum(row["candidate"] for row in block) - sum(row["baseline"] for row in block))
                if (
                    delta["development"] >= 1 and delta["validation"] >= 1
                    and delta["holdout30"] >= 0 and delta["all"] >= 3
                    and sum(value < 0 for value in rolling) <= 1
                ):
                    promotions.append({
                        "market": market, "side": side, "candidate": name,
                        "delta": delta, "metrics": {phase: phases[phase] for phase in required},
                        "rolling90Deltas": rolling,
                    })

    promotions.sort(key=lambda row: (row["delta"]["validation"], row["delta"]["all"]), reverse=True)

    # Development-ranked candidate pools with validation-selected ensemble
    # size. Holdout remains untouched until the size is frozen.
    ensemble_audit = []
    ensemble_selective90 = []
    for market in MARKET_ORDER:
        for side in ("open", "close"):
            ranked_candidates = []
            for name, phases in metrics[market][side].items():
                development = phases.get("development")
                if not development or development["n"] < 200:
                    continue
                delta = development["candidate"] - development["baseline"]
                if delta > 0:
                    ranked_candidates.append((delta, name))
            ranked_candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
            market_cases = [
                value for (case_market, case_side, _), value in cases.items()
                if case_market == market and case_side == side
            ]
            variants = []
            for size in (3, 5, 10, 20):
                names = [name for _, name in ranked_candidates[:size]]
                if len(names) < size:
                    continue
                phase_metrics = defaultdict(empty_metric)
                rows_with_confidence = []
                for case in market_cases:
                    available = [case["predictions"][name] for name in names if name in case["predictions"]]
                    baseline_ranking = case["baselineRanking"]
                    if not available:
                        ensemble = baseline_ranking
                        confidence = 0.0
                    else:
                        votes = Counter(
                            digit
                            for prediction in available
                            for digit in prediction[4:6]
                            if digit not in baseline_ranking[:4]
                        )
                        remainder = [digit for digit in range(10) if digit not in baseline_ranking[:4]]
                        remainder.sort(
                            key=lambda digit: (
                                -votes[digit],
                                0 if digit in baseline_ranking[4:6] else 1,
                                digit,
                            )
                        )
                        ensemble = baseline_ranking[:4] + remainder[:2]
                        confidence = sum(votes[digit] for digit in remainder[:2]) / (2 * len(available))
                    candidate_hit = case["actual"] in ensemble
                    add_metric(phase_metrics[case["phase"]], case["baselineHit"], candidate_hit)
                    add_metric(phase_metrics["all"], case["baselineHit"], candidate_hit)
                    rows_with_confidence.append({
                        "phase": case["phase"], "candidate": candidate_hit,
                        "baseline": case["baselineHit"], "confidence": confidence,
                    })
                development_delta = phase_metrics["development"]["candidate"] - phase_metrics["development"]["baseline"]
                validation_delta = phase_metrics["validation"]["candidate"] - phase_metrics["validation"]["baseline"]
                variants.append({
                    "size": size, "names": names, "metrics": dict(phase_metrics),
                    "developmentDelta": development_delta, "validationDelta": validation_delta,
                    "rows": rows_with_confidence,
                })
            eligible = [variant for variant in variants if variant["developmentDelta"] > 0]
            if not eligible:
                ensemble_audit.append({"market": market, "side": side, "decision": "keep_baseline"})
                continue
            selected_variant = max(eligible, key=lambda row: (row["validationDelta"], row["developmentDelta"], -row["size"]))
            holdout = selected_variant["metrics"]["holdout30"]
            holdout_delta = holdout["candidate"] - holdout["baseline"]
            all_metric = selected_variant["metrics"]["all"]
            all_delta = all_metric["candidate"] - all_metric["baseline"]
            rolling = []
            ordered_rows = selected_variant["rows"]
            for start in range(0, len(ordered_rows), 90):
                block = ordered_rows[start:start + 90]
                if len(block) >= 30:
                    rolling.append(sum(row["candidate"] for row in block) - sum(row["baseline"] for row in block))
            stable = sum(value < 0 for value in rolling) <= 1
            ensemble_audit.append({
                "market": market, "side": side,
                "decision": "promote" if selected_variant["validationDelta"] > 0 and holdout_delta >= 0 and all_delta >= 3 and stable else "revert_to_baseline",
                "size": selected_variant["size"], "candidateNames": selected_variant["names"],
                "developmentDelta": selected_variant["developmentDelta"],
                "validationDelta": selected_variant["validationDelta"],
                "holdoutDelta": holdout_delta, "allDelta": all_delta,
                "rolling90Deltas": rolling,
                "metrics": selected_variant["metrics"],
            })
            # Threshold is selected from validation; holdout is scored once.
            for threshold in (0.55, 0.65, 0.75, 0.85):
                validation_rows = [row for row in selected_variant["rows"] if row["phase"] == "validation" and row["confidence"] >= threshold]
                holdout_rows = [row for row in selected_variant["rows"] if row["phase"] == "holdout30" and row["confidence"] >= threshold]
                if len(validation_rows) < 30 or not holdout_rows:
                    continue
                validation_accuracy = sum(row["candidate"] for row in validation_rows) / len(validation_rows)
                if validation_accuracy >= 0.9:
                    ensemble_selective90.append({
                        "market": market, "side": side, "ensembleSize": selected_variant["size"],
                        "threshold": threshold, "validationN": len(validation_rows),
                        "validationAccuracy": validation_accuracy, "holdoutN": len(holdout_rows),
                        "holdoutAccuracy": sum(row["candidate"] for row in holdout_rows) / len(holdout_rows),
                    })

    # Select one challenger per market/side without consulting holdout. This is
    # the deployable selection audit; holdout is used only for keep/revert.
    selected = []
    for market in MARKET_ORDER:
        for side in ("open", "close"):
            candidates = []
            for name, phases in metrics[market][side].items():
                if not all(phase in phases for phase in ("development", "validation", "holdout30", "all")):
                    continue
                development = phases["development"]
                validation = phases["validation"]
                if development["n"] < 200 or validation["n"] < 100:
                    continue
                development_delta = development["candidate"] - development["baseline"]
                validation_delta = validation["candidate"] - validation["baseline"]
                if development_delta < 1 or validation_delta < 1:
                    continue
                candidates.append((validation_delta, development_delta, name, phases))
            if not candidates:
                selected.append({"market": market, "side": side, "decision": "keep_baseline", "reason": "no development+validation winner"})
                continue
            validation_delta, development_delta, name, phases = max(candidates, key=lambda item: (item[0], item[1], item[2]))
            series = outcomes[(market, side, name)]
            rolling = []
            for start in range(0, len(series), 90):
                block = series[start:start + 90]
                if len(block) >= 30:
                    rolling.append(sum(row["candidate"] for row in block) - sum(row["baseline"] for row in block))
            holdout_delta = phases["holdout30"]["candidate"] - phases["holdout30"]["baseline"]
            all_delta = phases["all"]["candidate"] - phases["all"]["baseline"]
            keep = holdout_delta >= 0 and all_delta >= 3 and sum(value < 0 for value in rolling) <= 1
            selected.append({
                "market": market, "side": side, "candidate": name,
                "decision": "promote" if keep else "revert_to_baseline",
                "developmentDelta": development_delta, "validationDelta": validation_delta,
                "holdoutDelta": holdout_delta, "allDelta": all_delta,
                "rolling90Deltas": rolling,
                "metrics": {phase: phases[phase] for phase in ("development", "validation", "holdout30", "all")},
            })

    # Search for a genuinely predeclared-style 90% selective region. Candidate
    # and gate are selected on validation only, then reported on holdout.
    selective = []
    for promotion in promotions:
        key = (promotion["market"], promotion["side"], promotion["candidate"])
        series = outcomes[key]
        for agreement in (4, 5, 6):
            validation = [row for row in series if row["phase"] == "validation" and row["agreement"] >= agreement]
            holdout = [row for row in series if row["phase"] == "holdout30" and row["agreement"] >= agreement]
            if len(validation) < 30 or not holdout:
                continue
            validation_accuracy = sum(row["candidate"] for row in validation) / len(validation)
            holdout_accuracy = sum(row["candidate"] for row in holdout) / len(holdout)
            if validation_accuracy >= 0.9:
                selective.append({
                    "market": promotion["market"], "side": promotion["side"],
                    "candidate": promotion["candidate"], "minimumAgreement": agreement,
                    "validationN": len(validation), "validationAccuracy": validation_accuracy,
                    "holdoutN": len(holdout), "holdoutAccuracy": holdout_accuracy,
                })

    return {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "baseline": str(BASELINE), "source": str(CACHE),
        "promotionCandidates": promotions,
        "selectedByDevelopmentValidation": selected,
        "ensembleAudit": ensemble_audit,
        "ensembleSelective90Candidates": ensemble_selective90,
        "selective90Candidates": selective,
        "metrics": materialized,
    }


def main() -> None:
    report = evaluate()
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Promotion candidates: {len(report['promotionCandidates'])}")
    for row in report["promotionCandidates"][:40]:
        print(row)
    print("\n=== one candidate per market/side, selected without holdout ===")
    for row in report["selectedByDevelopmentValidation"]:
        print(row)
    print("\n=== development-ranked, validation-sized ensemble audit ===")
    for row in report["ensembleAudit"]:
        print(row)
    print(f"\nEnsemble selective >=90% candidates: {len(report['ensembleSelective90Candidates'])}")
    for row in report["ensembleSelective90Candidates"]:
        print(row)
    print(f"\nValidation-selected >=90% selective candidates: {len(report['selective90Candidates'])}")
    for row in report["selective90Candidates"][:30]:
        print(row)
    print(f"\nSaved {OUTPUT}")


if __name__ == "__main__":
    main()
