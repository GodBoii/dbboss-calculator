"""Leakage-free joint Open/Close Top-6 rectangle research.

The production model ranks Open and Close separately, while a Jodi hit requires
both actual digits to land inside the two Top-6 sets. This audit estimates a
causal 10x10 Jodi distribution and chooses the 6x6 rectangle with maximum
probability mass. Hyperparameters are fixed in advance. Per-market selection
uses development only, validation is a gate, and holdout/forward remain tests.
"""

from __future__ import annotations

import importlib.util
import itertools
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FEATURE_MODULE_PATH = ROOT / "scripts" / "sutta-model-research.py"
HISTORICAL_LEDGER = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD_LEDGER = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-joint-rectangle-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-13" / "sutta-joint-rectangle-research.md"


def load_feature_module():
    spec = importlib.util.spec_from_file_location("sutta_model_research_joint", FEATURE_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {FEATURE_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FEATURES = load_feature_module()
MARKETS = FEATURES.MARKETS
SIX_SUBSETS = tuple(itertools.combinations(range(10), 6))
SIX_SUBSET_MASKS = np.asarray([[digit in subset for digit in range(10)] for subset in SIX_SUBSETS], dtype=np.float64)


@dataclass(frozen=True)
class Strategy:
    kind: str
    value: int = 0

    @property
    def name(self) -> str:
        return f"{self.kind}{self.value}" if self.value else self.kind


STRATEGIES = (
    Strategy("recent", 20),
    Strategy("recent", 40),
    Strategy("recent", 80),
    Strategy("recent", 160),
    Strategy("all"),
    Strategy("decay", 30),
    Strategy("decay", 90),
    Strategy("weekday"),
    Strategy("transition_jodi"),
    Strategy("transition_open"),
    Strategy("transition_close"),
    Strategy("recent_weekday"),
)
VARIANTS = tuple(f"{mode}:{strategy.name}" for mode in ("prefix4", "free") for strategy in STRATEGIES)


def read_ledger(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["ledger"]


def normalized_counts(rows: Iterable[Any], prior_strength: float = 1.0, fallback: list[list[float]] | None = None) -> list[list[float]]:
    counts = [[0.0] * 10 for _ in range(10)]
    total = 0.0
    for row in rows:
        counts[int(row.open)][int(row.close)] += 1.0
        total += 1.0
    if fallback is None:
        fallback = [[0.01] * 10 for _ in range(10)]
    denominator = total + prior_strength
    return [
        [(counts[open_digit][close_digit] + prior_strength * fallback[open_digit][close_digit]) / denominator
         for close_digit in range(10)]
        for open_digit in range(10)
    ]


def weighted_distribution(prior: list[Any], half_life: int, fallback: list[list[float]]) -> list[list[float]]:
    counts = [[0.0] * 10 for _ in range(10)]
    total = 0.0
    decay = math.log(2.0) / half_life
    for age, row in enumerate(reversed(prior)):
        weight = math.exp(-decay * age)
        counts[int(row.open)][int(row.close)] += weight
        total += weight
    strength = 10.0
    denominator = total + strength
    return [
        [(counts[o][c] + strength * fallback[o][c]) / denominator for c in range(10)]
        for o in range(10)
    ]


def transition_rows(prior: list[Any], attribute: str) -> list[Any]:
    if len(prior) < 2:
        return []
    previous_value = getattr(prior[-1], attribute)
    return [
        prior[index]
        for index in range(1, len(prior))
        if getattr(prior[index - 1], attribute) == previous_value
    ]


def distribution(prior: list[Any], target: Any, strategy: Strategy) -> list[list[float]]:
    long = normalized_counts(prior, 1.0)
    if strategy.kind == "all":
        return long
    if strategy.kind == "recent":
        return normalized_counts(prior[-strategy.value :], 20.0, long)
    if strategy.kind == "decay":
        return weighted_distribution(prior, strategy.value, long)
    if strategy.kind == "weekday":
        return normalized_counts((row for row in prior if row.day == target.day), 35.0, long)
    if strategy.kind == "transition_jodi":
        return normalized_counts(transition_rows(prior, "jodi"), 45.0, long)
    if strategy.kind == "transition_open":
        return normalized_counts(transition_rows(prior, "open"), 45.0, long)
    if strategy.kind == "transition_close":
        return normalized_counts(transition_rows(prior, "close"), 45.0, long)
    if strategy.kind == "recent_weekday":
        recent = normalized_counts(prior[-60:], 20.0, long)
        weekday = normalized_counts((row for row in prior if row.day == target.day), 35.0, long)
        return [[0.55 * recent[o][c] + 0.45 * weekday[o][c] for c in range(10)] for o in range(10)]
    raise ValueError(strategy.kind)


def mass(matrix: list[list[float]], open_set: Iterable[int], close_set: Iterable[int]) -> float:
    return sum(matrix[o][c] for o in open_set for c in close_set)


def rank_sets(matrix: list[list[float]], open_set: tuple[int, ...], close_set: tuple[int, ...]) -> tuple[list[int], list[int]]:
    open_marginal = [sum(matrix[o]) for o in range(10)]
    close_marginal = [sum(matrix[o][c] for o in range(10)) for c in range(10)]
    open_ranking = sorted(open_set, key=lambda value: (-open_marginal[value], value))
    close_ranking = sorted(close_set, key=lambda value: (-close_marginal[value], value))
    return open_ranking, close_ranking


def best_free_rectangle(matrix: list[list[float]]) -> tuple[list[int], list[int]]:
    values = np.asarray(matrix, dtype=np.float64)
    close_scores = SIX_SUBSET_MASKS @ values
    top_close = np.argsort(-close_scores, axis=1, kind="stable")[:, :6]
    rectangle_scores = np.take_along_axis(close_scores, top_close, axis=1).sum(axis=1)
    best_index = int(np.argmax(rectangle_scores))
    best_open = SIX_SUBSETS[best_index]
    best_close = tuple(int(value) for value in top_close[best_index])
    return rank_sets(matrix, best_open, best_close)


def best_prefix_rectangle(matrix: list[list[float]], base_open: list[int], base_close: list[int]) -> tuple[list[int], list[int]]:
    open_prefix = tuple(base_open[:4])
    close_prefix = tuple(base_close[:4])
    open_remaining = [digit for digit in range(10) if digit not in open_prefix]
    close_remaining = [digit for digit in range(10) if digit not in close_prefix]
    best_open: tuple[int, ...] | None = None
    best_close: tuple[int, ...] | None = None
    best_score = -1.0
    for open_pair in itertools.combinations(open_remaining, 2):
        open_set = open_prefix + open_pair
        close_scores = [sum(matrix[o][c] for o in open_set) for c in range(10)]
        close_pair = tuple(sorted(close_remaining, key=lambda c: (-close_scores[c], c))[:2])
        close_set = close_prefix + close_pair
        score = sum(close_scores[c] for c in close_set)
        if score > best_score:
            best_score = score
            best_open = open_set
            best_close = close_set
    assert best_open is not None and best_close is not None
    return list(best_open), list(best_close)


def hit_triplet(open_set: list[int], close_set: list[int], actual_open: int, actual_close: int) -> tuple[bool, bool, bool]:
    open_hit = actual_open in open_set
    close_hit = actual_close in close_set
    return open_hit, close_hit, open_hit and close_hit


def build_cases() -> dict[str, list[dict[str, Any]]]:
    rows_by_market = FEATURES.load_rows()
    ledgers = [(row, False) for row in read_ledger(HISTORICAL_LEDGER)]
    ledgers.extend((row, True) for row in read_ledger(FORWARD_LEDGER))
    ledger_by_market: dict[str, list[tuple[dict[str, Any], bool]]] = {market: [] for market in MARKETS}
    for row, is_forward in ledgers:
        ledger_by_market[row["market"]].append((row, is_forward))

    output: dict[str, list[dict[str, Any]]] = {}
    for market in MARKETS:
        cache_rows = rows_by_market[market]
        index_by_date = {row.iso: index for index, row in enumerate(cache_rows)}
        cases = []
        for ledger_row, is_forward in sorted(ledger_by_market[market], key=lambda item: item[0]["isoDate"]):
            index = index_by_date.get(ledger_row["isoDate"])
            if index is None or index < 50:
                continue
            target = cache_rows[index]
            prior = cache_rows[:index]
            baseline_open = [int(value) for value in ledger_row["openRanking"]]
            baseline_close = [int(value) for value in ledger_row["closeRanking"]]
            actual_open = int(ledger_row["actualOpen"])
            actual_close = int(ledger_row["actualClose"])
            predictions: dict[str, tuple[list[int], list[int]]] = {}
            for strategy in STRATEGIES:
                matrix = distribution(prior, target, strategy)
                predictions[f"prefix4:{strategy.name}"] = best_prefix_rectangle(matrix, baseline_open, baseline_close)
                predictions[f"free:{strategy.name}"] = best_free_rectangle(matrix)
            cases.append({
                "date": ledger_row["isoDate"],
                "forward": is_forward,
                "actualOpen": actual_open,
                "actualClose": actual_close,
                "baseline": hit_triplet(baseline_open, baseline_close, actual_open, actual_close),
                "predictions": {
                    name: hit_triplet(open_set, close_set, actual_open, actual_close)
                    for name, (open_set, close_set) in predictions.items()
                },
            })
        output[market] = cases
    return output


def split_indices(cases: list[dict[str, Any]]) -> dict[str, list[int]]:
    historical = [index for index, case in enumerate(cases) if not case["forward"]]
    forward = [index for index, case in enumerate(cases) if case["forward"]]
    dev_end = math.floor(len(historical) * 0.6)
    val_end = math.floor(len(historical) * 0.8)
    return {
        "development": historical[:dev_end],
        "validation": historical[dev_end:val_end],
        "holdout": historical[val_end:],
        "historical": historical,
        "forward": forward,
    }


def metric(cases: list[dict[str, Any]], indices: list[int], variant: str) -> dict[str, Any]:
    baseline = [0, 0, 0]
    candidate = [0, 0, 0]
    for index in indices:
        base_hits = cases[index]["baseline"]
        next_hits = base_hits if variant == "production" else cases[index]["predictions"][variant]
        for side in range(3):
            baseline[side] += int(base_hits[side])
            candidate[side] += int(next_hits[side])
    names = ("open", "close", "jodi")
    n = len(indices)
    return {
        "n": n,
        **{
            name: {
                "baseline": baseline[position],
                "candidate": candidate[position],
                "delta": candidate[position] - baseline[position],
                "baselineAccuracy": round(100 * baseline[position] / n, 3) if n else 0.0,
                "candidateAccuracy": round(100 * candidate[position] / n, 3) if n else 0.0,
            }
            for position, name in enumerate(names)
        },
    }


def evaluate_market(market: str, cases: list[dict[str, Any]]) -> dict[str, Any]:
    blocks = split_indices(cases)
    development = {variant: metric(cases, blocks["development"], variant) for variant in VARIANTS}
    eligible = [
        variant for variant in VARIANTS
        if development[variant]["open"]["delta"] >= 0
        and development[variant]["close"]["delta"] >= 0
        and development[variant]["jodi"]["delta"] > 0
    ]
    selected = max(
        eligible,
        key=lambda variant: (
            development[variant]["jodi"]["delta"],
            min(development[variant]["open"]["delta"], development[variant]["close"]["delta"]),
            development[variant]["open"]["delta"] + development[variant]["close"]["delta"],
            -VARIANTS.index(variant),
        ),
        default="production",
    )
    validation = metric(cases, blocks["validation"], selected)
    validation_pass = all(validation[name]["delta"] >= 0 for name in ("open", "close", "jodi"))
    gated = selected if validation_pass else "production"
    metrics = {name: metric(cases, indices, gated) for name, indices in blocks.items()}
    raw_selected_metrics = {name: metric(cases, indices, selected) for name, indices in blocks.items()}
    return {
        "market": market,
        "developmentSelected": selected,
        "validationPassed": validation_pass,
        "gatedVariant": gated,
        "metrics": metrics,
        "rawSelectedMetrics": raw_selected_metrics,
    }


def aggregate(results: list[dict[str, Any]], block: str, raw: bool = False) -> dict[str, Any]:
    source_key = "rawSelectedMetrics" if raw else "metrics"
    totals = {name: {"baseline": 0, "candidate": 0} for name in ("open", "close", "jodi")}
    n = 0
    for result in results:
        block_metric = result[source_key][block]
        n += block_metric["n"]
        for name in totals:
            totals[name]["baseline"] += block_metric[name]["baseline"]
            totals[name]["candidate"] += block_metric[name]["candidate"]
    return {
        "n": n,
        **{
            name: {
                **values,
                "delta": values["candidate"] - values["baseline"],
                "baselineAccuracy": round(100 * values["baseline"] / n, 3) if n else 0.0,
                "candidateAccuracy": round(100 * values["candidate"] / n, 3) if n else 0.0,
            }
            for name, values in totals.items()
        },
    }


def metric_text(value: dict[str, Any]) -> str:
    return f'{value["candidate"]}/{value.get("n", 0)}' if "n" in value else str(value["candidate"])


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        "# Joint Top-6 Rectangle Research",
        "",
        "This experiment models the 100 Open-Close outcomes jointly and chooses the highest-mass 6x6 rectangle. Every row uses only earlier records. Strategy selection uses development only; validation gates the selection; holdout and the frozen forward week are untouched tests.",
        "",
        "## Aggregate gated result",
        "",
        "| Block | N | Open baseline -> candidate | Close baseline -> candidate | Jodi baseline -> candidate |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for block in ("development", "validation", "holdout", "forward"):
        row = payload["aggregate"][block]
        cells = []
        for name in ("open", "close", "jodi"):
            value = row[name]
            cells.append(f'{value["baselineAccuracy"]:.1f}% -> {value["candidateAccuracy"]:.1f}% ({value["delta"]:+d})')
        lines.append(f'| {block.title()} | {row["n"]} | {cells[0]} | {cells[1]} | {cells[2]} |')
    lines.extend([
        "",
        "## Per-market selection and final tests",
        "",
        "| Market | Development selection | Validation gate | Holdout O/C/J delta | Forward O/C/J delta |",
        "| --- | --- | --- | ---: | ---: |",
    ])
    for result in payload["markets"]:
        holdout = result["metrics"]["holdout"]
        forward = result["metrics"]["forward"]
        holdout_delta = "/".join(f'{holdout[name]["delta"]:+d}' for name in ("open", "close", "jodi"))
        forward_delta = "/".join(f'{forward[name]["delta"]:+d}' for name in ("open", "close", "jodi"))
        lines.append(
            f'| {result["market"]} | {result["developmentSelected"]} | '
            f'{"pass" if result["validationPassed"] else "reject"} | {holdout_delta} | {forward_delta} |'
        )
    passing = [
        result for result in payload["markets"]
        if result["gatedVariant"] != "production"
        and all(result["metrics"][block][name]["delta"] >= 0
                for block in ("development", "validation", "holdout", "forward")
                for name in ("open", "close", "jodi"))
        and any(result["metrics"]["forward"][name]["delta"] > 0 for name in ("open", "close", "jodi"))
    ]
    lines.extend([
        "",
        "## Decision",
        "",
        f'Fully reproducible market candidates: {len(passing)}.',
        "",
        "A production promotion requires non-regression for Open, Close, and Jodi in development, validation, chronological holdout, and forward evidence. A candidate that only improves the development search window is rejected.",
        "",
    ])
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    cases = build_cases()
    results = [evaluate_market(market, cases[market]) for market in MARKETS]
    payload = {
        "schemaVersion": 1,
        "method": "causal-joint-6x6-rectangle",
        "selection": "development; validation gate; holdout and forward test",
        "variants": list(VARIANTS),
        "markets": results,
        "aggregate": {
            block: aggregate(results, block)
            for block in ("development", "validation", "holdout", "historical", "forward")
        },
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    print(json.dumps(payload["aggregate"], indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
