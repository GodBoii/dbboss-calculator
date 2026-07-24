"""Research-only Goal100 challenger.

Builds a fixed-size, market-specific digit-ranking ensemble using only features
available before each target market's Open deadline. Hyperparameters are chosen
inside the development period; validation, holdout, and recent-frozen blocks are
never used for tuning. Nothing in this file imports or writes production code.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
from scipy.stats import binomtest


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ARTIFACTS = HERE / "artifacts"
MANIFEST = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
DATA_PATH = ROOT / MANIFEST["baselineData"]["path"]
BASELINE_PATH = ARTIFACTS / "causal-audit-all-blocks.json"

MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day",
    "Kalyan", "Sridevi Night", "Kalyan Night", "Madhur Night",
    "Milan Night", "Rajdhani Night", "Main Bazar",
]
OPEN_MINUTE = dict(zip(MARKETS, [695, 790, 810, 910, 905, 945, 1155, 1305, 1230, 1265, 1295, 1320]))
CLOSE_MINUTE = dict(zip(MARKETS, [755, 850, 870, 1030, 1025, 1065, 1215, 1425, 1350, 1385, 1415, 1450]))
EMBARGO_MINUTES = 10
FREEZE_LEAD_MINUTES = 1
MIN_HISTORY = 50
ALPHAS = [0.1, 1.0, 10.0, 100.0, 1000.0]
BLOCKS = {
    "development": (date(2024, 9, 23), date(2025, 7, 13)),
    "validation": (date(2025, 7, 14), date(2025, 11, 12)),
    "holdout": (date(2025, 11, 13), date(2026, 3, 14)),
    "recentFrozen": (date(2026, 3, 15), date(2026, 7, 12)),
}
DAY_OFFSETS = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def record_date(row: dict[str, Any]) -> date:
    cached = row.get("_goal100Date")
    if isinstance(cached, date):
        return cached
    start = datetime.strptime(row["dateRangeStart"].replace("-", "/"), "%d/%m/%Y").date()
    result = start + timedelta(days=DAY_OFFSETS.get(row["day"], 0))
    row["_goal100Date"] = result
    return result


def block_for(day: date) -> str | None:
    for name, (start, end) in BLOCKS.items():
        if start <= day <= end:
            return name
    return None


def opposite(digit: int) -> int:
    return (digit + 5) % 10


def normalized_counts(values: list[int]) -> np.ndarray:
    counts = np.bincount(np.asarray(values, dtype=int), minlength=10).astype(float)
    total = counts.sum()
    return counts / total if total else np.full(10, 0.1)


def drought_scores(values: list[int]) -> np.ndarray:
    result = np.zeros(10, dtype=float)
    for digit in range(10):
        gap = 0
        for value in reversed(values):
            if value == digit:
                break
            gap += 1
        result[digit] = min(gap, 90) / 90.0
    return result


def transformed_vote(values: list[int], transform: str) -> np.ndarray:
    votes = np.zeros(10, dtype=float)
    for value in values:
        mapped = value
        if transform == "opposite":
            mapped = opposite(value)
        elif transform == "mirror":
            mapped = 9 - value
        votes[mapped] += 1.0
    if values:
        votes /= len(values)
    return votes


@dataclass
class Event:
    market: str
    day: date
    block: str
    actual_open: int
    actual_close: int
    open_features: np.ndarray
    close_features: np.ndarray
    adjusted_features: np.ndarray


def digit_features(
    market: str,
    target_day: date,
    side: str,
    own_prior: list[dict[str, Any]],
    same_day: dict[str, dict[str, Any]],
    known_open: int | None,
) -> np.ndarray:
    key = "openSutta" if side == "open" else "closeSutta"
    values = [int(row[key]) for row in own_prior if 0 <= int(row.get(key, -1)) <= 9]
    matrix: list[np.ndarray] = [np.ones(10)]

    # Stable per-digit intercepts.
    matrix.extend(np.eye(10)[:, digit] for digit in range(10))

    for window in (3, 5, 7, 10, 15, 30, 60, 90):
        matrix.append(normalized_counts(values[-window:]))

    # Exponentially decayed frequencies.
    for half_life in (3.0, 7.0, 14.0, 30.0):
        tail = values[-180:]
        if not tail:
            matrix.append(np.full(10, 0.1))
            continue
        ages = np.arange(len(tail) - 1, -1, -1, dtype=float)
        weights = np.exp2(-ages / half_life)
        scores = np.zeros(10)
        for value, weight in zip(tail, weights):
            scores[value] += weight
        matrix.append(scores / scores.sum())

    matrix.append(drought_scores(values))

    weekday_values = [int(row[key]) for row in own_prior if record_date(row).weekday() == target_day.weekday()]
    month_values = [int(row[key]) for row in own_prior if record_date(row).month == target_day.month]
    dom_values = [int(row[key]) for row in own_prior if record_date(row).day == target_day.day]
    matrix.extend([normalized_counts(weekday_values), normalized_counts(month_values), normalized_counts(dom_values)])

    # First-order transition distribution, with smoothing supplied by ridge.
    transition_values: list[int] = []
    if values:
        last = values[-1]
        for previous, current in zip(values[:-1], values[1:]):
            if previous == last:
                transition_values.append(current)
    matrix.append(normalized_counts(transition_values))

    for lag in (1, 2, 3, 5, 7):
        lag_values = [values[-lag]] if len(values) >= lag else []
        matrix.extend([
            transformed_vote(lag_values, "direct"),
            transformed_vote(lag_values, "opposite"),
            transformed_vote(lag_values, "mirror"),
        ])

    freeze = OPEN_MINUTE[market] - FREEZE_LEAD_MINUTES
    available_open: list[int] = []
    available_close: list[int] = []
    for source in MARKETS:
        row = same_day.get(source)
        if row is None or source == market:
            continue
        if OPEN_MINUTE[source] + EMBARGO_MINUTES <= freeze:
            available_open.append(int(row["openSutta"]))
        if CLOSE_MINUTE[source] + EMBARGO_MINUTES <= freeze:
            available_close.append(int(row["closeSutta"]))
    for source_values in (available_open, available_close):
        matrix.extend([
            transformed_vote(source_values, "direct"),
            transformed_vote(source_values, "opposite"),
            transformed_vote(source_values, "mirror"),
        ])

    if known_open is None:
        matrix.extend([np.zeros(10), np.zeros(10), np.zeros(10), np.full(10, 0.1)])
    else:
        matrix.extend([
            transformed_vote([known_open], "direct"),
            transformed_vote([known_open], "opposite"),
            transformed_vote([known_open], "mirror"),
        ])
        conditional = [
            int(row["closeSutta"]) for row in own_prior
            if int(row["openSutta"]) == known_open
        ]
        matrix.append(normalized_counts(conditional[-90:]))

    return np.column_stack(matrix)


def build_events(raw: dict[str, list[dict[str, Any]]]) -> dict[str, list[Event]]:
    dated: dict[str, list[dict[str, Any]]] = {}
    by_date: dict[str, dict[date, dict[str, Any]]] = {}
    for market in MARKETS:
        rows = sorted(raw[market], key=record_date)
        dated[market] = rows
        by_date[market] = {record_date(row): row for row in rows}

    events: dict[str, list[Event]] = {market: [] for market in MARKETS}
    for market in MARKETS:
        rows = dated[market]
        for index, row in enumerate(rows):
            target_day = record_date(row)
            block = block_for(target_day)
            if block is None or index < MIN_HISTORY:
                continue
            prior = rows[:index]
            same_day = {
                source: by_date[source][target_day]
                for source in MARKETS if target_day in by_date[source]
            }
            actual_open = int(row["openSutta"])
            actual_close = int(row["closeSutta"])
            events[market].append(Event(
                market=market,
                day=target_day,
                block=block,
                actual_open=actual_open,
                actual_close=actual_close,
                open_features=digit_features(market, target_day, "open", prior, same_day, None),
                close_features=digit_features(market, target_day, "close", prior, same_day, None),
                adjusted_features=digit_features(market, target_day, "close", prior, same_day, actual_open),
            ))
    return events


@dataclass
class RidgeRanker:
    mean: np.ndarray
    scale: np.ndarray
    weights: np.ndarray
    alpha: float

    def predict(self, features: np.ndarray) -> list[int]:
        scores = ((features - self.mean) / self.scale) @ self.weights
        return [int(value) for value in np.argsort(-scores, kind="stable")[:6]]


def fit_ranker(events: list[Event], feature_name: str, target_name: str, alpha: float) -> RidgeRanker:
    features = np.vstack([getattr(event, feature_name) for event in events])
    actuals = [getattr(event, target_name) for event in events]
    targets = np.concatenate([np.eye(10)[actual] for actual in actuals])
    mean = features.mean(axis=0)
    scale = features.std(axis=0)
    scale[scale < 1e-9] = 1.0
    x = (features - mean) / scale
    penalty = np.eye(x.shape[1]) * alpha
    weights = np.linalg.solve(x.T @ x + penalty, x.T @ targets)
    return RidgeRanker(mean=mean, scale=scale, weights=weights, alpha=alpha)


def accuracy(model: RidgeRanker, events: list[Event], feature_name: str, target_name: str) -> float:
    if not events:
        return float("nan")
    hits = sum(getattr(event, target_name) in model.predict(getattr(event, feature_name)) for event in events)
    return hits / len(events)


def select_model(events: list[Event], feature_name: str, target_name: str) -> tuple[RidgeRanker, dict[str, Any]]:
    development = [event for event in events if event.block == "development"]
    split = max(1, int(len(development) * 0.7))
    inner_train, inner_validation = development[:split], development[split:]
    trials = []
    for alpha in ALPHAS:
        model = fit_ranker(inner_train, feature_name, target_name, alpha)
        score = accuracy(model, inner_validation, feature_name, target_name)
        trials.append({"alpha": alpha, "innerAccuracy": score})
    winner = max(trials, key=lambda item: (item["innerAccuracy"], item["alpha"]))
    return fit_ranker(development, feature_name, target_name, winner["alpha"]), {
        "developmentRows": len(development),
        "innerTrainRows": len(inner_train),
        "innerValidationRows": len(inner_validation),
        "trials": trials,
        "selectedAlpha": winner["alpha"],
    }


def wilson(hits: int, n: int) -> list[float] | None:
    if n == 0:
        return None
    z = 1.96
    p = hits / n
    denominator = 1 + z * z / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return [(centre - spread) / denominator, (centre + spread) / denominator]


def metric(hits: int, n: int) -> dict[str, Any]:
    return {"hits": hits, "n": n, "accuracy": hits / n if n else None, "wilson95": wilson(hits, n)}


def main() -> None:
    data_bytes = DATA_PATH.read_bytes()
    if sha256_bytes(data_bytes) != MANIFEST["baselineData"]["sha256"]:
        raise RuntimeError("Frozen data hash changed; aborting")
    if not BASELINE_PATH.exists():
        raise RuntimeError(f"Missing causal baseline artifact: {BASELINE_PATH}")
    raw = json.loads(data_bytes)
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    baseline_rows = {(row["market"], row["isoDate"]): row for row in baseline["ledger"]}
    events = build_events(raw)

    report: dict[str, Any] = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "evaluationType": "retrospective-nested-development-selected-not-sealed-forward",
        "modelId": "goal100-nested-causal-ridge-v1",
        "dataSha256": sha256_bytes(data_bytes),
        "productionFingerprint": MANIFEST["productionBoundary"]["digest"],
        "contract": {"openDigits": 6, "closeDigits": 6, "jodis": 36, "adjustedCloseDigits": 6},
        "selection": {"alphas": ALPHAS, "innerDevelopmentSplit": 0.7, "minimumHistory": MIN_HISTORY},
        "markets": {},
        "aggregate": {},
        "ledger": [],
    }
    aggregate_counts: dict[str, dict[str, dict[str, int]]] = {
        block: {target: {"candidate": 0, "baseline": 0, "candidateOnly": 0, "baselineOnly": 0, "n": 0}
                for target in ("open", "close", "jodi", "adjustedClose")}
        for block in BLOCKS
    }

    for market in MARKETS:
        market_events = events[market]
        models: dict[str, RidgeRanker] = {}
        selection: dict[str, Any] = {}
        specifications = {
            "open": ("open_features", "actual_open"),
            "close": ("close_features", "actual_close"),
            "adjustedClose": ("adjusted_features", "actual_close"),
        }
        for target, (feature_name, actual_name) in specifications.items():
            models[target], selection[target] = select_model(market_events, feature_name, actual_name)

        market_report: dict[str, Any] = {"selection": selection, "blocks": {}}
        for block in BLOCKS:
            block_events = [event for event in market_events if event.block == block]
            counts = {target: {"candidate": 0, "baseline": 0, "candidateOnly": 0, "baselineOnly": 0, "n": 0}
                      for target in ("open", "close", "jodi", "adjustedClose")}
            for event in block_events:
                open_picks = models["open"].predict(event.open_features)
                close_picks = models["close"].predict(event.close_features)
                adjusted_picks = models["adjustedClose"].predict(event.adjusted_features)
                candidate_hits = {
                    "open": event.actual_open in open_picks,
                    "close": event.actual_close in close_picks,
                    "jodi": event.actual_open in open_picks and event.actual_close in close_picks,
                    "adjustedClose": event.actual_close in adjusted_picks,
                }
                baseline_row = baseline_rows.get((market, event.day.isoformat()))
                baseline_hits = {
                    "open": bool(baseline_row and baseline_row["causal"]["hits"]["open"]),
                    "close": bool(baseline_row and baseline_row["causal"]["hits"]["close"]),
                    "jodi": bool(baseline_row and baseline_row["causal"]["hits"]["jodi"]),
                    # Causal replay did not compute known-Open Adjusted Close.
                    "adjustedClose": False,
                }
                for target in counts:
                    if target != "adjustedClose" and baseline_row is None:
                        continue
                    item = counts[target]
                    item["n"] += 1
                    item["candidate"] += int(candidate_hits[target])
                    if target != "adjustedClose":
                        item["baseline"] += int(baseline_hits[target])
                        item["candidateOnly"] += int(candidate_hits[target] and not baseline_hits[target])
                        item["baselineOnly"] += int(baseline_hits[target] and not candidate_hits[target])
                report["ledger"].append({
                    "market": market, "date": event.day.isoformat(), "block": block,
                    "actual": {"open": event.actual_open, "close": event.actual_close},
                    "candidate": {"open": open_picks, "close": close_picks, "adjustedClose": adjusted_picks,
                                  "hits": candidate_hits},
                    "baselineHits": baseline_hits if baseline_row else None,
                })
            block_report = {}
            for target, item in counts.items():
                candidate_metric = metric(item["candidate"], item["n"])
                baseline_metric = None if target == "adjustedClose" else metric(item["baseline"], item["n"])
                discordant = item["candidateOnly"] + item["baselineOnly"]
                paired_p = None if target == "adjustedClose" or discordant == 0 else float(
                    binomtest(item["candidateOnly"], discordant, 0.5, alternative="two-sided").pvalue
                )
                block_report[target] = {
                    "candidate": candidate_metric, "baseline": baseline_metric,
                    "candidateMinusBaselineHits": None if target == "adjustedClose" else item["candidate"] - item["baseline"],
                    "candidateOnly": item["candidateOnly"], "baselineOnly": item["baselineOnly"], "pairedSignP": paired_p,
                }
                aggregate = aggregate_counts[block][target]
                for key in aggregate:
                    aggregate[key] += item[key]
            market_report["blocks"][block] = block_report
        report["markets"][market] = market_report

    for block, targets in aggregate_counts.items():
        report["aggregate"][block] = {}
        for target, item in targets.items():
            discordant = item["candidateOnly"] + item["baselineOnly"]
            report["aggregate"][block][target] = {
                "candidate": metric(item["candidate"], item["n"]),
                "baseline": None if target == "adjustedClose" else metric(item["baseline"], item["n"]),
                "candidateMinusBaselineHits": None if target == "adjustedClose" else item["candidate"] - item["baseline"],
                "candidateOnly": item["candidateOnly"], "baselineOnly": item["baselineOnly"],
                "pairedSignP": None if target == "adjustedClose" or discordant == 0 else float(
                    binomtest(item["candidateOnly"], discordant, 0.5, alternative="two-sided").pvalue
                ),
            }

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    output = ARTIFACTS / "nested-causal-ridge-v1.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {output}")
    for block, targets in report["aggregate"].items():
        print(f"\n{block}")
        for target, result in targets.items():
            candidate = result["candidate"]
            baseline_metric = result["baseline"]
            baseline_text = "n/a" if baseline_metric is None else f"{baseline_metric['hits']}/{baseline_metric['n']}"
            print(f"  {target:13s} candidate={candidate['hits']}/{candidate['n']} baseline={baseline_text} "
                  f"delta={result['candidateMinusBaselineHits']}")


if __name__ == "__main__":
    main()
