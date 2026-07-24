"""Statistical audit of Top-6 Sutta predictability.

This does not search or tune a prediction rule. It measures whether frozen
rankings align with outcomes beyond nominal set coverage and a market-wise
permutation null. The separately frozen forward week is the primary evidence;
historical results are labelled selection-contaminated because rules were
researched on those records.
"""

from __future__ import annotations

import json
import math
import random
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
HISTORICAL_LEDGER = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD_LEDGER = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-predictability-audit-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-13" / "sutta-predictability-audit.md"
SEED = 950613
TRIALS = 10_000
TARGETS = ("open", "close", "jodi")
NOMINAL = {"open": 0.60, "close": 0.60, "jodi": 0.36}


def read_ledger(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["ledger"]


def row_hits(row: dict[str, Any], actual_open: int | None = None, actual_close: int | None = None) -> tuple[bool, bool, bool]:
    open_digit = int(row["actualOpen"] if actual_open is None else actual_open)
    close_digit = int(row["actualClose"] if actual_close is None else actual_close)
    open_hit = open_digit in row["openRanking"]
    close_hit = close_digit in row["closeRanking"]
    return open_hit, close_hit, open_hit and close_hit


def wilson(hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if not n:
        return 0.0, 0.0
    p = hits / n
    denominator = 1 + z * z / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return (centre - spread) / denominator, (centre + spread) / denominator


def binomial_tail(n: int, threshold: int, probability: float) -> float:
    if threshold <= 0:
        return 1.0
    if threshold > n:
        return 0.0
    log_probability = (
        math.lgamma(n + 1) - math.lgamma(threshold + 1) - math.lgamma(n - threshold + 1)
        + threshold * math.log(probability) + (n - threshold) * math.log1p(-probability)
    )
    term = math.exp(log_probability)
    total = term
    for hits in range(threshold, n):
        term *= ((n - hits) / (hits + 1)) * (probability / (1 - probability))
        total += term
    return min(1.0, total)


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    hits = {target: 0 for target in TARGETS}
    by_market: dict[str, dict[str, Any]] = {}
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["market"]].append(row)
        values = row_hits(row)
        for index, target in enumerate(TARGETS):
            hits[target] += int(values[index])
    for market, market_rows in grouped.items():
        market_hits = {target: 0 for target in TARGETS}
        for row in market_rows:
            values = row_hits(row)
            for index, target in enumerate(TARGETS):
                market_hits[target] += int(values[index])
        by_market[market] = {
            "n": len(market_rows),
            **{
                target: {
                    "hits": market_hits[target],
                    "accuracy": 100 * market_hits[target] / len(market_rows),
                    "ci95": [100 * value for value in wilson(market_hits[target], len(market_rows))],
                }
                for target in TARGETS
            },
        }
    n = len(rows)
    return {
        "n": n,
        **{
            target: {
                "hits": hits[target],
                "accuracy": 100 * hits[target] / n if n else 0.0,
                "ci95": [100 * value for value in wilson(hits[target], n)],
                "nominalAccuracy": 100 * NOMINAL[target],
                "nominalUpperTail": binomial_tail(n, hits[target], NOMINAL[target]) if n else 1.0,
            }
            for target in TARGETS
        },
        "byMarket": by_market,
    }


def permutation_audit(rows: list[dict[str, Any]], trials: int = TRIALS) -> dict[str, Any]:
    rng = random.Random(SEED + len(rows))
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        groups[row["market"]].append(row)
    observed = {target: 0 for target in TARGETS}
    for row in rows:
        values = row_hits(row)
        for index, target in enumerate(TARGETS):
            observed[target] += int(values[index])
    trial_hits = {target: [] for target in TARGETS}
    for _ in range(trials):
        totals = [0, 0, 0]
        for market_rows in groups.values():
            actuals = [(int(row["actualOpen"]), int(row["actualClose"])) for row in market_rows]
            rng.shuffle(actuals)
            for row, (actual_open, actual_close) in zip(market_rows, actuals):
                values = row_hits(row, actual_open, actual_close)
                for index in range(3):
                    totals[index] += int(values[index])
        for index, target in enumerate(TARGETS):
            trial_hits[target].append(totals[index])
    return {
        "trials": trials,
        "null": {
            target: {
                "observedHits": observed[target],
                "meanHits": sum(trial_hits[target]) / trials,
                "meanAccuracy": 100 * sum(trial_hits[target]) / (trials * len(rows)),
                "pGreaterOrEqual": (1 + sum(value >= observed[target] for value in trial_hits[target])) / (trials + 1),
                "pAtMostObserved": (1 + sum(value <= observed[target] for value in trial_hits[target])) / (trials + 1),
            }
            for target in TARGETS
        },
    }


def target95(n: int) -> dict[str, Any]:
    required = math.ceil(0.95 * n)
    return {
        "n": n,
        "requiredHits": required,
        **{
            target: {
                "nominalProbability": NOMINAL[target],
                "probabilityAtLeast95": binomial_tail(n, required, NOMINAL[target]),
            }
            for target in TARGETS
        },
    }


def percent(value: float) -> str:
    return f"{value:.1f}%"


def probability(value: float) -> str:
    if value == 0:
        return "0"
    if value < 0.0001:
        return f"{value:.2e}"
    return f"{value:.6f}"


def write_report(payload: dict[str, Any]) -> None:
    forward = payload["forward"]
    permutation = payload["forwardPermutation"]["null"]
    lines = [
        "# Sutta Predictability Audit",
        "",
        "The primary evidence is the separately frozen 72-row forward week. Historical results are reported but are selection-contaminated because production rules were researched using that history.",
        "",
        "A Top-6 set contains 6 of 10 possible digits, so nominal coverage is 60% for Open and Close. The Cartesian Jodi set contains 36 of 100 pairs, so nominal coverage is 36% when outcomes are not predictably aligned with the rankings.",
        "",
        "## Frozen forward evidence",
        "",
        "| Target | Hits | Accuracy | 95% interval | Nominal | Market-wise permutation mean | Evidence rankings beat permutation |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for target in TARGETS:
        value = forward[target]
        null = permutation[target]
        lines.append(
            f'| {target.title()} | {value["hits"]}/{forward["n"]} | {percent(value["accuracy"])} | '
            f'{percent(value["ci95"][0])}-{percent(value["ci95"][1])} | {percent(value["nominalAccuracy"])} | '
            f'{percent(null["meanAccuracy"])} | p={null["pGreaterOrEqual"]:.3f} |'
        )
    lines.extend([
        "",
        "The forward results do not show evidence that the frozen rankings outperform nominal coverage or the market-frequency-preserving permutation null.",
        "",
        "## Per-market frozen forward result",
        "",
        "| Market | N | Open | Close | Jodi |",
        "| --- | ---: | ---: | ---: | ---: |",
    ])
    for market, metrics in forward["byMarket"].items():
        lines.append(
            f'| {market} | {metrics["n"]} | {metrics["open"]["hits"]}/{metrics["n"]} ({percent(metrics["open"]["accuracy"])}) | '
            f'{metrics["close"]["hits"]}/{metrics["n"]} ({percent(metrics["close"]["accuracy"])}) | '
            f'{metrics["jodi"]["hits"]}/{metrics["n"]} ({percent(metrics["jodi"]["accuracy"])}) |'
        )
    target = payload["target95Forward"]
    lines.extend([
        "",
        "## What a 95% claim requires",
        "",
        f'On {target["n"]} rows, at least {target["requiredHits"]} hits are required for 95% accuracy. Under nominal Top-6 coverage, the chance of reaching that mark is:',
        "",
        f'- Open: {probability(target["open"]["probabilityAtLeast95"])}',
        f'- Close: {probability(target["close"]["probabilityAtLeast95"])}',
        f'- Jodi: {probability(target["jodi"]["probabilityAtLeast95"])}',
        "",
        "Therefore 95% cannot be obtained honestly by adding more formulas to essentially random coverage. It requires a large, stable conditional signal that repeats in untouched data. None of the causal rule, adaptive, ML, analogue, or joint-rectangle families tested so far supplies that signal.",
        "",
        "## Decision",
        "",
        "Do not promote a challenger from this audit. Continue accumulating sealed forward outcomes and require per-market development, validation, chronological holdout, and forward non-regression before any model version changes.",
        "",
    ])
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    historical_rows = read_ledger(HISTORICAL_LEDGER)
    forward_rows = read_ledger(FORWARD_LEDGER)
    payload = {
        "schemaVersion": 1,
        "seed": SEED,
        "trials": TRIALS,
        "historicalWarning": "selection-contaminated; not out-of-sample",
        "historical": summarize(historical_rows),
        "historicalPermutation": permutation_audit(historical_rows),
        "forward": summarize(forward_rows),
        "forwardPermutation": permutation_audit(forward_rows),
        "target95Forward": target95(len(forward_rows)),
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    print(json.dumps({
        "forward": payload["forward"],
        "forwardPermutation": payload["forwardPermutation"],
        "target95Forward": payload["target95Forward"],
    }, indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
