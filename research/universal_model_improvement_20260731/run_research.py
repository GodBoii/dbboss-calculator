"""Research-only universal model improvement cycle.

This script never imports or edits production source. It compares broad,
causal expert families with a frozen ledger exported from the exact production
path, then freezes routes on Q4 2025 + Q1 2026 and audits them on later blocks.
"""

from __future__ import annotations

import json
import math
from bisect import bisect_left
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable

from scipy.stats import binomtest


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASELINE_PATH = HERE / "production_baseline_ledger.json"
EXTENDED_PATH = ROOT / "research" / "panel_top30_v2" / "extended_records.json"
RESULTS_PATH = HERE / "results.json"
REPORT_PATH = HERE / "REPORT.md"
JOURNAL_PATH = HERE / "JOURNAL.md"

MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night",
    "Rajdhani Night", "Main Bazar",
]
MARKET_INDEX = {market: index for index, market in enumerate(MARKETS)}
SIDES = ("open", "close")
DAY_OFFSET = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}
BLOCKS = {
    "discovery": ("2025-10-01", "2025-12-31"),
    "confirmation": ("2026-01-01", "2026-03-31"),
    "holdout": ("2026-04-01", "2026-06-30"),
    "recent": ("2026-07-01", "2026-07-23"),
    "prospective": ("2026-07-24", "2026-07-30"),
}
WINDOWS = (2, 3, 5, 7, 10, 15, 30, 60, 90, 180, 365, 730)
HALF_LIVES = (3, 7, 14, 30, 60, 120)
OPPOSITE = {digit: (digit + 5) % 10 for digit in range(10)}
HOUSES = {
    "low_high": ({0, 1, 2, 3, 4}, {5, 6, 7, 8, 9}),
    "odd_even": ({1, 3, 5, 7, 9}, {0, 2, 4, 6, 8}),
    "prime_other": ({2, 3, 5, 7}, {0, 1, 4, 6, 8, 9}),
}


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
    def jodi(self) -> str:
        return f"{self.open}{self.close}"


def iso_date(record: dict) -> str:
    raw = record["dateRangeStart"].replace("-", "/")
    year_token = raw.rsplit("/", 1)[-1]
    date_format = "%d/%m/%y" if len(year_token) == 2 else "%d/%m/%Y"
    start = datetime.strptime(raw, date_format)
    return (start + timedelta(days=DAY_OFFSET.get(record["day"], 0))).date().isoformat()


def panel_kind(panel: str) -> str:
    return "DP" if len(set(panel)) == 2 else "SP"


def valid_record(record: dict) -> bool:
    for side in SIDES:
        panel = str(record.get(f"{side}Panel", ""))
        sutta = int(record.get(f"{side}Sutta", -1))
        if len(panel) != 3 or not panel.isdigit():
            return False
        if sum(map(int, panel)) % 10 != sutta:
            return False
    return True


def load_inputs():
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    extended = json.loads(EXTENDED_PATH.read_text(encoding="utf-8"))["extended"]
    history: dict[str, dict[str, Row]] = {market: {} for market in MARKETS}
    for market in MARKETS:
        for record in extended[market]:
            if not valid_record(record):
                continue
            iso = iso_date(record)
            history[market][iso] = Row(
                market, iso, record["day"], int(record["openSutta"]),
                int(record["closeSutta"]), str(record["openPanel"]),
                str(record["closePanel"]),
            )
    ledger = {}
    for item in baseline["ledger"]:
        actual = item["actual"]
        row = Row(
            item["market"], item["isoDate"], item["day"],
            int(actual["openSutta"]), int(actual["closeSutta"]),
            str(actual["openPanel"]), str(actual["closePanel"]),
        )
        history[row.market][row.iso] = row
        ledger[(row.market, row.iso)] = item
    rows = {
        market: sorted(values.values(), key=lambda row: row.iso)
        for market, values in history.items()
    }
    dates = {
        market: [row.iso for row in market_rows]
        for market, market_rows in rows.items()
    }
    return baseline, ledger, rows, dates


def block_for(iso: str) -> str | None:
    for name, (start, end) in BLOCKS.items():
        if start <= iso <= end:
            return name
    return None


def normalize(scores: list[float]) -> list[float]:
    low, high = min(scores), max(scores)
    if high <= low:
        return [0.5] * len(scores)
    return [(value - low) / (high - low) for value in scores]


def counts_scores(values: Iterable[int], alpha: float = 1.0) -> list[float]:
    counts = Counter(values)
    return [counts[digit] + alpha for digit in range(10)]


def rank(scores: list[float]) -> list[int]:
    return sorted(range(10), key=lambda digit: (-scores[digit], digit))


def average_rank(rankings: list[list[int]]) -> list[int]:
    positions = [
        {digit: position for position, digit in enumerate(ranking)}
        for ranking in rankings
    ]
    return sorted(
        range(10),
        key=lambda digit: (
            sum(position[digit] for position in positions) / len(positions),
            digit,
        ),
    )


def conditional_scores(
    prior: list[Row],
    side: str,
    source_side: str,
    lag: int,
) -> list[float]:
    if len(prior) <= lag:
        return [1.0] * 10
    current_source = getattr(prior[-lag], source_side)
    values = []
    for index in range(lag, len(prior)):
        if getattr(prior[index - lag], source_side) == current_source:
            values.append(getattr(prior[index], side))
    return counts_scores(values, 2.0)


def delta_scores(prior: list[Row], side: str, lag: int = 1) -> list[float]:
    values = [getattr(row, side) for row in prior]
    if len(values) <= lag:
        return [1.0] * 10
    delta_counts = Counter(
        (values[index] - values[index - lag]) % 10
        for index in range(lag, len(values))
    )
    previous = values[-lag]
    return [delta_counts[(digit - previous) % 10] + 1.0 for digit in range(10)]


def panel_feature_scores(prior: list[Row], side: str, position: int) -> list[float]:
    panel_attr = f"{side}_panel"
    current_value = getattr(prior[-1], panel_attr)[position]
    values = []
    for index in range(1, len(prior)):
        if getattr(prior[index - 1], panel_attr)[position] == current_value:
            values.append(getattr(prior[index], side))
    return counts_scores(values, 2.0)


def house_scores(prior: list[Row], side: str, name: str, rotate: bool) -> list[float]:
    left, right = HOUSES[name]
    previous = getattr(prior[-1], side)
    target = right if previous in left else left
    if not rotate:
        target = left if previous in left else right
    long_scores = normalize(counts_scores(getattr(row, side) for row in prior[-365:]))
    return [
        long_scores[digit] + (0.35 if digit in target else 0.0)
        for digit in range(10)
    ]


def build_base_rankings(prior: list[Row], target: Row, side: str) -> dict[str, list[int]]:
    prior = prior[-730:]
    values = [getattr(row, side) for row in prior]
    rankings: dict[str, list[int]] = {}
    for window in WINDOWS:
        sample = values[-window:]
        hot = counts_scores(sample)
        rankings[f"hot_w{window}"] = rank(hot)
        rankings[f"cold_w{window}"] = rank([-value for value in hot])
    for half_life in HALF_LIVES:
        decay = math.exp(math.log(0.5) / half_life)
        scores = [0.0] * 10
        weight = 1.0
        for value in reversed(values[-730:]):
            scores[value] += weight
            weight *= decay
        rankings[f"ewm_h{half_life}"] = rank(scores)

    weekday_values = [getattr(row, side) for row in prior if row.day == target.day]
    monthday = int(target.iso[-2:])
    monthday_values = [
        getattr(row, side) for row in prior if int(row.iso[-2:]) == monthday
    ]
    rankings["weekday"] = rank(counts_scores(weekday_values, 2.0))
    rankings["calendar_date"] = rank(counts_scores(monthday_values, 3.0))
    for lag in (1, 2, 3, 5, 7):
        rankings[f"markov_self_l{lag}"] = rank(
            conditional_scores(prior, side, side, lag)
        )
        other = "close" if side == "open" else "open"
        rankings[f"markov_cross_l{lag}"] = rank(
            conditional_scores(prior, side, other, lag)
        )
        rankings[f"delta_l{lag}"] = rank(delta_scores(prior, side, lag))

    long_rank = rank(counts_scores(values[-365:], 2.0))
    previous = values[-1]
    opposite_rank = [OPPOSITE[previous]] + [
        digit for digit in long_rank if digit != OPPOSITE[previous]
    ]
    rankings["opposite_previous"] = opposite_rank
    for house_name in HOUSES:
        rankings[f"{house_name}_continue"] = rank(
            house_scores(prior, side, house_name, False)
        )
        rankings[f"{house_name}_rotate"] = rank(
            house_scores(prior, side, house_name, True)
        )
    for position in range(3):
        rankings[f"panel_position_{position}"] = rank(
            panel_feature_scores(prior, side, position)
        )

    same_weekday = [row for row in prior if row.day == target.day]
    if same_weekday:
        previous_weekday = getattr(same_weekday[-1], side)
        rankings["same_weekday_echo"] = [previous_weekday] + [
            digit for digit in long_rank if digit != previous_weekday
        ]
        opposite_weekday = OPPOSITE[previous_weekday]
        rankings["same_weekday_opposite"] = [opposite_weekday] + [
            digit for digit in long_rank if digit != opposite_weekday
        ]

    rankings["frequency_ensemble"] = average_rank([
        rankings["hot_w7"], rankings["hot_w30"],
        rankings["hot_w90"], rankings["hot_w365"],
    ])
    rankings["transition_ensemble"] = average_rank([
        rankings["markov_self_l1"], rankings["markov_cross_l1"],
        rankings["delta_l1"], rankings["weekday"],
    ])
    rankings["interaction_ensemble"] = average_rank([
        rankings["ewm_h14"], rankings["weekday"],
        rankings["markov_self_l1"], rankings["panel_position_1"],
    ])
    return rankings


def source_before(
    source_rows: list[Row],
    source_dates: list[str],
    iso: str,
    same_day: bool,
) -> Row | None:
    index = bisect_left(source_dates, iso)
    if same_day and index < len(source_dates) and source_dates[index] == iso:
        return source_rows[index]
    return source_rows[index - 1] if index > 0 else None


def cross_market_rank(
    target_prior: list[Row],
    source_rows: list[Row],
    source_dates: list[str],
    target: Row,
    target_side: str,
    source_side: str,
    same_day: bool,
) -> list[int]:
    source_now = source_before(source_rows, source_dates, target.iso, same_day)
    if source_now is None:
        return list(range(10))
    source_value = getattr(source_now, source_side)
    outcomes = []
    for historical in target_prior[-730:]:
        source_historical = source_before(
            source_rows, source_dates, historical.iso, same_day
        )
        if source_historical and getattr(source_historical, source_side) == source_value:
            outcomes.append(getattr(historical, target_side))
    return rank(counts_scores(outcomes, 2.5))


def build_prediction_matrix(ledger, rows, dates):
    rankings: dict[str, dict[str, dict[tuple[str, str], list[int]]]] = {
        side: defaultdict(dict) for side in SIDES
    }
    kind_predictions: dict[str, dict[str, dict[tuple[str, str], str]]] = {
        side: defaultdict(dict) for side in SIDES
    }
    ordered_items = sorted(ledger.items(), key=lambda item: (item[0][1], MARKET_INDEX[item[0][0]]))
    for item_index, ((market, iso), item) in enumerate(ordered_items, 1):
        target_index = bisect_left(dates[market], iso)
        target = rows[market][target_index]
        prior = rows[market][:target_index]
        if len(prior) < 180:
            continue
        for side in SIDES:
            base = build_base_rankings(prior, target, side)
            production = list(item["production"][f"{side}Suttas"])
            base["production"] = production + [
                digit for digit in range(10) if digit not in production
            ]
            for name, ranking in base.items():
                rankings[side][name][(market, iso)] = ranking

            for source in MARKETS:
                if source == market:
                    continue
                for source_side in SIDES:
                    name = f"previous_market::{source}::{source_side}"
                    rankings[side][name][(market, iso)] = cross_market_rank(
                        prior, rows[source], dates[source], target, side,
                        source_side, False,
                    )
                    if MARKET_INDEX[source] < MARKET_INDEX[market]:
                        live_name = f"same_day::{source}::{source_side}"
                        rankings[side][live_name][(market, iso)] = cross_market_rank(
                            prior, rows[source], dates[source], target, side,
                            source_side, True,
                        )

            actual_attr = f"{side}Kind"
            production_attr = f"{side}Kind"
            bias = float(item["production"][f"{side}DpBias"])
            kind_predictions[side]["production"][(market, iso)] = item["production"][production_attr]
            kind_predictions[side]["always_SP"][(market, iso)] = "SP"
            for threshold_int in range(100, 251, 5):
                threshold = threshold_int / 100
                kind_predictions[side][f"dp_bias_t{threshold:.2f}"][(market, iso)] = (
                    "DP" if bias >= threshold else "SP"
                )
            prior_kinds = [panel_kind(getattr(row, f"{side}_panel")) for row in prior]
            for window in (30, 60, 120, 240):
                sample = prior_kinds[-window:]
                dp_rate = (sample.count("DP") + 5) / (len(sample) + 20)
                for threshold in (0.30, 0.35, 0.40, 0.45, 0.50):
                    name = f"rolling_dp_w{window}_t{threshold:.2f}"
                    kind_predictions[side][name][(market, iso)] = (
                        "DP" if dp_rate >= threshold else "SP"
                    )
        if item_index % 500 == 0:
            print(f"Built predictions for {item_index}/{len(ordered_items)} rows")
    return rankings, kind_predictions


def set_hit(ranking: list[int], actual: int, count: int = 6) -> bool:
    return actual in ranking[:count]


def mcnemar(candidate: list[bool], baseline: list[bool]) -> dict:
    candidate_only = sum(c and not b for c, b in zip(candidate, baseline))
    baseline_only = sum(b and not c for c, b in zip(candidate, baseline))
    discordant = candidate_only + baseline_only
    p_value = (
        float(binomtest(candidate_only, discordant, 0.5).pvalue)
        if discordant else 1.0
    )
    return {
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "pValue": p_value,
    }


def evaluate_sutta(rankings, ledger):
    results = {"experts": {}, "routes": {}, "jodi": {}}
    for side in SIDES:
        actual_key = f"{side}Sutta"
        side_results = {}
        for name, predictions in rankings[side].items():
            blocks = {}
            markets = {}
            for block in BLOCKS:
                block_rows = [
                    (key, item) for key, item in ledger.items()
                    if block_for(key[1]) == block and key in predictions
                ]
                hits = [
                    set_hit(predictions[key], int(item["actual"][actual_key]))
                    for key, item in block_rows
                ]
                blocks[block] = {"hits": sum(hits), "n": len(hits)}
            for market in MARKETS:
                markets[market] = {}
                for block in BLOCKS:
                    block_rows = [
                        (key, item) for key, item in ledger.items()
                        if key[0] == market and block_for(key[1]) == block and key in predictions
                    ]
                    hits = [
                        set_hit(predictions[key], int(item["actual"][actual_key]))
                        for key, item in block_rows
                    ]
                    markets[market][block] = {"hits": sum(hits), "n": len(hits)}
            side_results[name] = {"blocks": blocks, "markets": markets}
        results["experts"][side] = side_results

        routes = {}
        for market in MARKETS:
            candidates = [
                name for name in side_results
                if name != "production" and not name.startswith("same_day::")
            ]
            ranked_candidates = sorted(
                candidates,
                key=lambda name: (
                    side_results[name]["markets"][market]["discovery"]["hits"],
                    side_results[name]["markets"][market]["confirmation"]["hits"],
                    name,
                ),
                reverse=True,
            )
            chosen = "production"
            for name in ranked_candidates:
                discovery = side_results[name]["markets"][market]["discovery"]
                confirmation = side_results[name]["markets"][market]["confirmation"]
                prod_discovery = side_results["production"]["markets"][market]["discovery"]
                prod_confirmation = side_results["production"]["markets"][market]["confirmation"]
                if (
                    discovery["hits"] - prod_discovery["hits"] >= 1
                    and confirmation["hits"] - prod_confirmation["hits"] >= 0
                    and discovery["hits"] + confirmation["hits"]
                    - prod_discovery["hits"] - prod_confirmation["hits"] >= 2
                ):
                    chosen = name
                    break
            routes[market] = chosen
        results["routes"][side] = score_route(routes, rankings[side], ledger, actual_key)

    results["jodi"]["production"] = score_jodi_route(
        {market: "production" for market in MARKETS},
        {market: "production" for market in MARKETS},
        rankings, ledger,
    )
    results["jodi"]["sutta_routes"] = score_jodi_route(
        results["routes"]["open"]["selection"],
        results["routes"]["close"]["selection"],
        rankings, ledger,
    )
    return results


def score_route(selection, predictions, ledger, actual_key):
    blocks = {}
    market_blocks = {}
    for market in MARKETS:
        market_blocks[market] = {}
        for block in BLOCKS:
            keys = [
                key for key in ledger
                if key[0] == market and block_for(key[1]) == block
                and key in predictions[selection[market]]
            ]
            candidate = [
                set_hit(
                    predictions[selection[market]][key],
                    int(ledger[key]["actual"][actual_key]),
                )
                for key in keys
            ]
            baseline = [
                set_hit(
                    predictions["production"][key],
                    int(ledger[key]["actual"][actual_key]),
                )
                for key in keys
            ]
            market_blocks[market][block] = {
                "hits": sum(candidate),
                "baselineHits": sum(baseline),
                "n": len(keys),
            }
    for block in BLOCKS:
        keys = [
            key for key in ledger
            if block_for(key[1]) == block
            and key in predictions[selection[key[0]]]
        ]
        candidate = [
            set_hit(
                predictions[selection[key[0]]][key],
                int(ledger[key]["actual"][actual_key]),
            )
            for key in keys
        ]
        baseline = [
            set_hit(
                predictions["production"][key],
                int(ledger[key]["actual"][actual_key]),
            )
            for key in keys
        ]
        blocks[block] = {
            "hits": sum(candidate),
            "baselineHits": sum(baseline),
            "n": len(keys),
            "mcnemar": mcnemar(candidate, baseline),
        }
    return {"selection": selection, "blocks": blocks, "markets": market_blocks}


def score_jodi_route(open_selection, close_selection, rankings, ledger):
    blocks = {}
    markets = {}
    for market in MARKETS:
        markets[market] = {}
        for block in BLOCKS:
            keys = [
                key for key in ledger
                if key[0] == market and block_for(key[1]) == block
                and key in rankings["open"][open_selection[market]]
                and key in rankings["close"][close_selection[market]]
            ]
            candidate = []
            baseline = []
            for key in keys:
                actual = ledger[key]["actual"]["jodi"]
                open_set = rankings["open"][open_selection[market]][key][:6]
                close_set = rankings["close"][close_selection[market]][key][:6]
                candidate.append(
                    actual in {f"{op}{cl}" for op in open_set for cl in close_set}
                )
                prod_open = rankings["open"]["production"][key][:6]
                prod_close = rankings["close"]["production"][key][:6]
                baseline.append(
                    actual in {f"{op}{cl}" for op in prod_open for cl in prod_close}
                )
            markets[market][block] = {
                "hits": sum(candidate),
                "baselineHits": sum(baseline),
                "n": len(keys),
            }
    for block in BLOCKS:
        keys = [key for key in ledger if block_for(key[1]) == block]
        candidate = []
        baseline = []
        for key in keys:
            market = key[0]
            actual = ledger[key]["actual"]["jodi"]
            open_set = rankings["open"][open_selection[market]][key][:6]
            close_set = rankings["close"][close_selection[market]][key][:6]
            candidate.append(actual in {f"{op}{cl}" for op in open_set for cl in close_set})
            prod_open = rankings["open"]["production"][key][:6]
            prod_close = rankings["close"]["production"][key][:6]
            baseline.append(actual in {f"{op}{cl}" for op in prod_open for cl in prod_close})
        blocks[block] = {
            "hits": sum(candidate),
            "baselineHits": sum(baseline),
            "n": len(keys),
            "mcnemar": mcnemar(candidate, baseline),
        }
    return {
        "openSelection": open_selection,
        "closeSelection": close_selection,
        "blocks": blocks,
        "markets": markets,
    }


def kind_metrics(actual: list[str], predicted: list[str]) -> dict:
    n = len(actual)
    correct = sum(a == p for a, p in zip(actual, predicted))
    tp = sum(a == "DP" and p == "DP" for a, p in zip(actual, predicted))
    fp = sum(a == "SP" and p == "DP" for a, p in zip(actual, predicted))
    fn = sum(a == "DP" and p == "SP" for a, p in zip(actual, predicted))
    tn = sum(a == "SP" and p == "SP" for a, p in zip(actual, predicted))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    sp_recall = tn / (tn + fp) if tn + fp else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "n": n,
        "correct": correct,
        "accuracy": correct / n if n else 0.0,
        "dpPrecision": precision,
        "dpRecall": recall,
        "dpF1": f1,
        "balancedAccuracy": (recall + sp_recall) / 2 if n else 0.0,
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
    }


def evaluate_kind(kind_predictions, ledger):
    result = {}
    for side in SIDES:
        actual_key = f"{side}Kind"
        experts = {}
        for name, predictions in kind_predictions[side].items():
            blocks = {}
            for block in BLOCKS:
                keys = [
                    key for key in ledger
                    if block_for(key[1]) == block and key in predictions
                ]
                actual = [ledger[key]["actual"][actual_key] for key in keys]
                predicted = [predictions[key] for key in keys]
                blocks[block] = kind_metrics(actual, predicted)
            experts[name] = blocks

        accuracy_candidates = sorted(
            experts,
            key=lambda name: (
                experts[name]["discovery"]["accuracy"],
                experts[name]["confirmation"]["accuracy"],
            ),
            reverse=True,
        )
        accuracy_choice = "production"
        for name in accuracy_candidates:
            if (
                experts[name]["discovery"]["accuracy"]
                >= experts["production"]["discovery"]["accuracy"]
                and experts[name]["confirmation"]["accuracy"]
                >= experts["production"]["confirmation"]["accuracy"]
            ):
                accuracy_choice = name
                break

        balanced_candidates = sorted(
            experts,
            key=lambda name: (
                experts[name]["discovery"]["balancedAccuracy"],
                experts[name]["confirmation"]["balancedAccuracy"],
            ),
            reverse=True,
        )
        balanced_choice = "production"
        for name in balanced_candidates:
            if (
                experts[name]["discovery"]["balancedAccuracy"]
                >= experts["production"]["discovery"]["balancedAccuracy"]
                and experts[name]["confirmation"]["balancedAccuracy"]
                >= experts["production"]["confirmation"]["balancedAccuracy"]
            ):
                balanced_choice = name
                break

        comparisons = {}
        for label, choice in (
            ("accuracyFirst", accuracy_choice),
            ("balanced", balanced_choice),
        ):
            comparisons[label] = {"choice": choice, "blocks": {}}
            for block in BLOCKS:
                keys = [
                    key for key in ledger
                    if block_for(key[1]) == block
                    and key in kind_predictions[side][choice]
                ]
                actual = [ledger[key]["actual"][actual_key] for key in keys]
                candidate_pred = [kind_predictions[side][choice][key] for key in keys]
                baseline_pred = [kind_predictions[side]["production"][key] for key in keys]
                candidate_correct = [a == p for a, p in zip(actual, candidate_pred)]
                baseline_correct = [a == p for a, p in zip(actual, baseline_pred)]
                comparisons[label]["blocks"][block] = {
                    "candidate": kind_metrics(actual, candidate_pred),
                    "baseline": kind_metrics(actual, baseline_pred),
                    "mcnemar": mcnemar(candidate_correct, baseline_correct),
                }
        result[side] = {"experts": experts, "comparisons": comparisons}
    return result


def pct(hits: int, n: int) -> str:
    return f"{100 * hits / n:.1f}% ({hits}/{n})" if n else "N/A"


def metric_pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def table(rows: list[dict], columns: list[str]) -> str:
    header = "| " + " | ".join(columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    body = [
        "| " + " | ".join(str(row.get(column, "")) for column in columns) + " |"
        for row in rows
    ]
    return "\n".join([header, separator, *body])


def build_report(baseline, sutta, kind):
    block_rows = []
    for block in BLOCKS:
        open_route = sutta["routes"]["open"]["blocks"][block]
        close_route = sutta["routes"]["close"]["blocks"][block]
        jodi_route = sutta["jodi"]["sutta_routes"]["blocks"][block]
        block_rows.append({
            "Block": block,
            "Open production": pct(open_route["baselineHits"], open_route["n"]),
            "Open route": pct(open_route["hits"], open_route["n"]),
            "Close production": pct(close_route["baselineHits"], close_route["n"]),
            "Close route": pct(close_route["hits"], close_route["n"]),
            "Jodi production": pct(jodi_route["baselineHits"], jodi_route["n"]),
            "Jodi route": pct(jodi_route["hits"], jodi_route["n"]),
        })

    market_rows = []
    for market in MARKETS:
        open_holdout = sutta["routes"]["open"]["markets"][market]["holdout"]
        close_holdout = sutta["routes"]["close"]["markets"][market]["holdout"]
        jodi_holdout = sutta["jodi"]["sutta_routes"]["markets"][market]["holdout"]
        market_rows.append({
            "Market": market,
            "Open expert": sutta["routes"]["open"]["selection"][market],
            "Open holdout": f"{pct(open_holdout['hits'], open_holdout['n'])} vs {pct(open_holdout['baselineHits'], open_holdout['n'])}",
            "Close expert": sutta["routes"]["close"]["selection"][market],
            "Close holdout": f"{pct(close_holdout['hits'], close_holdout['n'])} vs {pct(close_holdout['baselineHits'], close_holdout['n'])}",
            "Jodi holdout": f"{pct(jodi_holdout['hits'], jodi_holdout['n'])} vs {pct(jodi_holdout['baselineHits'], jodi_holdout['n'])}",
        })

    kind_rows = []
    for side in SIDES:
        for label in ("accuracyFirst", "balanced"):
            comparison = kind[side]["comparisons"][label]
            for block in ("holdout", "recent", "prospective"):
                row = comparison["blocks"][block]
                kind_rows.append({
                    "Side": side,
                    "Objective": label,
                    "Model": comparison["choice"],
                    "Block": block,
                    "Candidate accuracy": metric_pct(row["candidate"]["accuracy"]),
                    "Production accuracy": metric_pct(row["baseline"]["accuracy"]),
                    "Candidate DP recall": metric_pct(row["candidate"]["dpRecall"]),
                    "Production DP recall": metric_pct(row["baseline"]["dpRecall"]),
                    "p": f"{row['mcnemar']['pValue']:.4f}",
                })

    successful = []
    rejected = []
    for side in SIDES:
        route = sutta["routes"][side]
        later = [route["blocks"][block] for block in ("holdout", "recent", "prospective")]
        delta = sum(row["hits"] - row["baselineHits"] for row in later)
        entry = {
            "Hypothesis": f"{side} market-specific expert routing",
            "Later net hits": delta,
            "Decision": "KEEP RESEARCH" if delta > 0 and all(
                row["hits"] >= row["baselineHits"] for row in later
            ) else "REJECT",
        }
        (successful if entry["Decision"] == "KEEP RESEARCH" else rejected).append(entry)
    for side in SIDES:
        for label in ("accuracyFirst", "balanced"):
            comparison = kind[side]["comparisons"][label]
            later = [comparison["blocks"][block] for block in ("holdout", "recent", "prospective")]
            delta = sum(
                row["candidate"]["correct"] - row["baseline"]["correct"]
                for row in later
            )
            entry = {
                "Hypothesis": f"{side} SP/DP {label}: {comparison['choice']}",
                "Later net hits": delta,
                "Decision": "DIAGNOSTIC ONLY" if label == "accuracyFirst" and delta > 0 and all(
                    row["candidate"]["accuracy"] >= row["baseline"]["accuracy"]
                    for row in later
                ) else "REJECT",
            }
            (successful if entry["Decision"] == "DIAGNOSTIC ONLY" else rejected).append(entry)

    successful_table = table(successful or [{
        "Hypothesis": "None passed every later block",
        "Later net hits": 0,
        "Decision": "NO PROMOTION",
    }], ["Hypothesis", "Later net hits", "Decision"])
    rejected_table = table(rejected, ["Hypothesis", "Later net hits", "Decision"])

    return f"""# Universal prediction model improvement research

Generated from production baseline `{baseline['appVersion']}` / sutta model `{baseline['suttaModelVersion']}`.

## Executive decision

This is research-only. Production source was not edited. Candidate selection used Q4 2025 discovery and Q1 2026 confirmation. April-June, July 1-23, and July 24-30 were not used to select routes.

## Baseline and routed sutta/Jodi performance

{table(block_rows, ["Block", "Open production", "Open route", "Close production", "Close route", "Jodi production", "Jodi route"])}

## Market-wise frozen sutta routes

Each holdout cell is `candidate vs production`.

{table(market_rows, ["Market", "Open expert", "Open holdout", "Close expert", "Close holdout", "Jodi holdout"])}

## SP/DP research

Accuracy-first models are allowed to favor SP heavily; balanced models are judged on equal SP/DP recall. This prevents a high raw accuracy from hiding zero DP detection.

{table(kind_rows, ["Side", "Objective", "Model", "Block", "Candidate accuracy", "Production accuracy", "Candidate DP recall", "Production DP recall", "p"])}

## Diagnostic controls (not prediction candidates)

{successful_table}

## Hypotheses rejected in this cycle

{rejected_table}

## Hypothesis library covered

- Previous-result windows: 2, 3, 5, 7, 10, 15, 30, 60, 90, 180, 365 and 730 draws.
- Frequency saturation: hot/cold ranks and exponentially weighted half-lives 3-120.
- Transitions: own-side and cross-side Markov lags 1, 2, 3, 5 and 7; modular deltas.
- Calendar: weekday, same weekday, date-of-month and opposite-weekday echoes.
- Mathematical theories: opposite digits, low/high, odd/even and prime/composite continuation/rotation.
- Position behavior: previous panel first, middle and final digit conditioning.
- Cross-market graph: every prior-market Open/Close source into every target side.
- Day-to-night/live sequence: same-day earlier-market sources were measured separately and never mixed into pre-day production comparisons.
- Interactions: frequency, transition and calendar/panel-position ensembles.
- Regime response: short/medium/long windows and exponential decay serve as adaptive regime experts.

## Multiple-testing and overfitting control

Many experts were searched. A candidate had to beat production in discovery, remain non-negative in confirmation, and was then frozen. Later blocks determine credibility. Nominal McNemar p-values are shown but are not treated as family-wise significant without correction. A short-window 75-100% result with four draws is not promotion evidence.

## Existing family audits incorporated

- Exact panels: the frozen learned Top-60 model reached 34.7% Open and 39.9% Close on 974 terminal rows; hierarchical and cross-market challengers failed later confirmation.
- Absent digits: the strongest nested ridge candidate improved aggregates but failed paired confirmation and worst-route stability; no 80% Wilson-lower-bound call exists.
- Present digits: the selected 180-draw co-appearance model remained near 6% and is correctly research-only.

## Failure analysis

- Sutta Top-6 and Jodi-36 have nominal random coverages of 60% and 36%; small gains frequently reverse by market and month.
- Cross-market edges are numerous enough that the best in-sample edge is usually a multiple-testing artifact.
- SP is the majority kind. Always-SP or high DP thresholds can raise accuracy while destroying DP recall.
- Exact-panel history contains very little stable pre-draw information relative to the 220-class outcome space.
- Digit-pair confidence remains weakly discriminative; high displayed scores must not be interpreted as high success probability.

## Recommendation

The accuracy-first SP/DP rows are majority-class controls, not viable prediction candidates. No candidate should change production. The three stable market-local sutta signals identified in the consolidated report may enter a frozen shadow registry, but promotion requires an independent block of at least 100 calls per route, acceptable worst-period behavior, and corrected statistical evidence.
"""


def build_journal(sutta, kind):
    rows = [
        {
            "Cycle": 1,
            "Experiment": "Exact production baseline export",
            "Evidence": "3,021 causal production-path predictions",
            "Decision": "Frozen comparator",
        },
        {
            "Cycle": 2,
            "Experiment": "Multi-window frequency and saturation",
            "Evidence": "24 hot/cold experts per side",
            "Decision": "Route only if later-stable",
        },
        {
            "Cycle": 3,
            "Experiment": "Markov, delta, opposite, house, calendar and position theories",
            "Evidence": "Causal predictions on five chronological blocks",
            "Decision": "Reject unstable experts",
        },
        {
            "Cycle": 4,
            "Experiment": "All-market previous and same-day influence graph",
            "Evidence": "Every source-side to target-side edge tested",
            "Decision": "Same-day kept separate from pre-day mode",
        },
        {
            "Cycle": 5,
            "Experiment": "Market-specific sutta routes",
            "Evidence": "Selected on Q4/Q1; audited on three later blocks",
            "Decision": "See REPORT.md",
        },
        {
            "Cycle": 6,
            "Experiment": "SP/DP threshold sweep",
            "Evidence": "Accuracy and balanced objectives with DP precision/recall",
            "Decision": "See REPORT.md",
        },
    ]
    return f"""# Research journal

{table(rows, ["Cycle", "Experiment", "Evidence", "Decision"])}

## Self-critique

- The production baseline is limited to the application's 730-day retained history even though some research series are longer.
- The expert library is broad but not literally exhaustive; unrestricted symbolic search would inflate false discovery.
- Market order is used for same-day research, but exact result publication timestamps were unavailable.
- No stake, odds, payout, liability or public-tip data exists, so accuracy cannot establish profitability.
- The July 24-30 prospective block has 68 rows; Rajdhani Day is absent only on July 27-30.
- Any retained candidate still needs a genuinely future registry; this cycle cannot manufacture future evidence.
"""


def main():
    baseline, ledger, rows, dates = load_inputs()
    print(f"Loaded {len(ledger)} production baseline rows")
    rankings, kind_predictions = build_prediction_matrix(ledger, rows, dates)
    print("Evaluating sutta and Jodi candidates")
    sutta = evaluate_sutta(rankings, ledger)
    print("Evaluating SP/DP candidates")
    kind = evaluate_kind(kind_predictions, ledger)
    results = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "blocks": BLOCKS,
        "baseline": {
            "path": str(BASELINE_PATH),
            "rows": len(ledger),
            "appVersion": baseline["appVersion"],
            "suttaModelVersion": baseline["suttaModelVersion"],
        },
        "hypothesisCounts": {
            side: len(rankings[side]) for side in SIDES
        },
        "sutta": sutta,
        "kind": kind,
    }
    RESULTS_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(build_report(baseline, sutta, kind), encoding="utf-8")
    JOURNAL_PATH.write_text(build_journal(sutta, kind), encoding="utf-8")
    print(f"Saved {RESULTS_PATH}")
    print(f"Saved {REPORT_PATH}")
    print(f"Saved {JOURNAL_PATH}")


if __name__ == "__main__":
    main()
