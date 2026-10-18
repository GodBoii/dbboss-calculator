"""Pooled counts and quarterly residual learning for strict present-digit pairs."""

from __future__ import annotations

import csv
import hashlib
import json
import sys
from bisect import bisect_left
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from research.present_digits_v2 import run_study as previous

HERE = Path(__file__).resolve().parent
PAIRS = previous.PAIRS
BASELINE = previous.BASELINE
POOLED = tuple(f"pool_{scope}_{weight}" for scope in ("side", "all") for weight in (25, 50, 75))
CONDITIONAL = ("sutta_25", "sutta_50")
RIDGE = tuple(f"ridge_{features}_{strength}_{weight}"
              for features in ("context", "sequence")
              for strength in (100, 1000, 10000) for weight in (25, 50, 100))
NAMES = (BASELINE,) + POOLED + CONDITIONAL + RIDGE


def text_sha256(path: Path) -> str:
    """Hash study artifacts identically across Git's LF/CRLF checkouts."""
    return hashlib.sha256(path.read_text(encoding="utf-8").encode("utf-8")).hexdigest()


@dataclass
class History:
    dates: list[str]
    prefix: np.ndarray

    def counts(self, iso: str) -> tuple[np.ndarray, int]:
        start, end = bisect_left(self.dates, previous.cutoff(iso)), bisect_left(self.dates, iso)
        return self.prefix[end] - self.prefix[start], end - start


@dataclass
class Dataset:
    dates: np.ndarray
    routes: np.ndarray
    targets: np.ndarray
    baseline: np.ndarray
    pooled: np.ndarray
    conditional: np.ndarray
    context: np.ndarray
    sequence: np.ndarray


def panel_pairs(panel: str) -> np.ndarray:
    return np.array([int(str(a) in panel and str(b) in panel) for a, b in PAIRS], dtype=np.uint8)


def histories(markets: dict[str, list[dict[str, str]]]) -> dict[str, History]:
    groups: dict[str, list[tuple[str, np.ndarray]]] = {"all": []}
    for side in ("open", "close"):
        groups[side] = []
        for state in range(10):
            groups[f"{side}|{state}"] = []
    for rows in markets.values():
        for side in ("open", "close"):
            for index, row in enumerate(rows):
                item = (row["date"], panel_pairs(row[side]))
                groups["all"].append(item)
                groups[side].append(item)
                if index:
                    state = sum(map(int, rows[index - 1][side])) % 10
                    groups[f"{side}|{state}"].append(item)
    result = {}
    for key, items in groups.items():
        items.sort(key=lambda item: item[0])
        values = np.array([item[1] for item in items], dtype=float).reshape(-1, 45)
        result[key] = History([item[0] for item in items], np.vstack([np.zeros((1, 45)), values.cumsum(axis=0)]))
    return result


def build_dataset(markets: dict[str, list[dict[str, str]]]) -> Dataset:
    pool = histories(markets)
    samples = []
    market_names = sorted(markets)
    for market in market_names:
        rows = markets[market]
        dates = [row["date"] for row in rows]
        if dates != sorted(set(dates)):
            raise ValueError(f"Unsorted or duplicate history for {market}")
        digits = {side: np.array([[int(str(d) in row[side]) for d in range(10)] for row in rows])
                  for side in ("open", "close")}
        digit_prefix = {side: np.vstack([np.zeros((1, 10)), values.cumsum(axis=0)]) for side, values in digits.items()}
        pair_values = {side: np.column_stack([values[:, a] * values[:, b] for a, b in PAIRS])
                       for side, values in digits.items()}
        prefix = {side: np.vstack([np.zeros((1, 45)), values.cumsum(axis=0)]) for side, values in pair_values.items()}
        for index, row in enumerate(rows):
            iso = row["date"]
            start = bisect_left(dates, previous.cutoff(iso))
            if index - start < 180 or iso < "2018-01-01":
                continue
            # Shared known context includes only prior rows, even for Close.
            identity = np.eye(len(market_names))[market_names.index(market)]
            weekday = np.eye(7)[date.fromisoformat(iso).weekday()]
            suttas = np.concatenate([np.eye(10)[sum(map(int, rows[index - 1][side])) % 10]
                                     for side in ("open", "close")])
            kinds = np.concatenate([np.eye(3)[int(digits[side][index - 1].sum()) - 1]
                                    for side in ("open", "close")])
            frequencies = np.concatenate([(digit_prefix[side][index] - digit_prefix[side][max(start, index - window)])
                                          / (index - max(start, index - window))
                                          for side in ("open", "close") for window in (30, 180)])
            lags = np.concatenate([digits[side][index - lag] for side in ("open", "close") for lag in (1, 2, 3)])
            for side_index, side in enumerate(("open", "close")):
                base = (prefix[side][index] - prefix[side][index - 180] + 1) / 200
                pooled = []
                for scope in (side, "all"):
                    counts, n = pool[scope].counts(iso)
                    pooled.append((counts + 1) / (n + 20))
                state = sum(map(int, rows[index - 1][side])) % 10
                counts, n = pool[f"{side}|{state}"].counts(iso)
                conditional = (counts + 100 * pooled[0]) / (n + 100)
                context = np.concatenate([identity, np.eye(2)[side_index], weekday, suttas, kinds, frequencies, base])
                samples.append((iso, f"{market}|{side}", pair_values[side][index], base,
                                pooled, conditional, context, np.concatenate([context, lags])))
    samples.sort(key=lambda item: (item[0], item[1]))
    if not samples:
        raise ValueError("No events meet the minimum history requirement")
    columns = list(zip(*samples))
    return Dataset(np.array(columns[0]), np.array(columns[1]), np.array(columns[2], dtype=np.uint8),
                   *(np.array(column, dtype=float) for column in columns[3:]))


def quarter(iso: str) -> str:
    return f"{iso[:4]}-{(int(iso[5:7]) - 1) // 3 * 3 + 1:02d}-01"


def ridge_corrections(train_x: np.ndarray, residuals: np.ndarray, test_x: np.ndarray,
                      strengths: tuple[int, ...] = (100, 1000, 10000)) -> dict[int, np.ndarray]:
    mean = train_x.mean(axis=0)
    scale = np.maximum(train_x.std(axis=0), 0.01)
    x = np.column_stack([np.ones(len(train_x)), (train_x - mean) / scale])
    test = np.column_stack([np.ones(len(test_x)), (test_x - mean) / scale])
    gram, rhs = x.T @ x, x.T @ residuals
    result = {}
    for strength in strengths:
        penalty = np.eye(x.shape[1]) * strength
        penalty[0, 0] = 0
        result[strength] = test @ np.linalg.solve(gram + penalty, rhs)
    return result


def predict(data: Dataset) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[dict]]:
    n = len(data.dates)
    predictions = np.zeros((n, len(NAMES)), dtype=np.int16)
    assigned = np.full((n, len(NAMES)), np.nan)
    brier = np.zeros((n, len(NAMES)))

    def record(name: str, indices: np.ndarray, scores: np.ndarray) -> None:
        column = NAMES.index(name)
        scores = np.clip(scores, 0, 1)
        best = scores.argmax(axis=1)
        predictions[indices, column] = best
        assigned[indices, column] = scores[np.arange(len(indices)), best]
        brier[indices, column] = ((scores - data.targets[indices]) ** 2).mean(axis=1)

    indices = np.arange(n)
    record(BASELINE, indices, data.baseline)
    for scope_index, scope in enumerate(("side", "all")):
        for weight in (25, 50, 75):
            record(f"pool_{scope}_{weight}", indices,
                   (1 - weight / 100) * data.baseline + weight / 100 * data.pooled[:, scope_index])
    for weight in (25, 50):
        record(f"sutta_{weight}", indices,
               (1 - weight / 100) * data.baseline + weight / 100 * data.conditional)
    audits = []
    quarters = sorted({quarter(iso) for iso in data.dates if iso >= "2021-01-01"})
    for boundary in quarters:
        train_indices = np.flatnonzero((data.dates >= previous.cutoff(boundary)) & (data.dates < boundary))
        test_indices = np.flatnonzero(np.array([quarter(iso) == boundary for iso in data.dates]))
        if len(train_indices) < 180:
            raise ValueError(f"Insufficient pooled training data before {boundary}")
        audits.append({"quarter": boundary, "trainingRows": len(train_indices),
                       "earliestTrain": str(data.dates[train_indices[0]]),
                       "latestTrain": str(data.dates[train_indices[-1]]), "predictions": len(test_indices)})
        for family, features in (("context", data.context), ("sequence", data.sequence)):
            corrections = ridge_corrections(features[train_indices],
                                             data.targets[train_indices] - data.baseline[train_indices],
                                             features[test_indices])
            for strength, correction in corrections.items():
                for weight in (25, 50, 100):
                    record(f"ridge_{family}_{strength}_{weight}", test_indices,
                           data.baseline[test_indices] + weight / 100 * correction)
    eligible = data.dates >= "2021-01-01"
    if np.isnan(assigned[eligible]).any():
        raise ValueError("An eligible prediction has no score")
    return predictions, assigned, brier, audits


def summarize(hits: np.ndarray, losses: np.ndarray, mask: np.ndarray, column: int) -> dict:
    baseline, candidate = hits[mask, 0], hits[mask, column]
    n = len(baseline)
    return {"events": n, "hits": int(candidate.sum()), "baselineHits": int(baseline.sum()),
            "accuracy": float(candidate.mean()) if n else None,
            "netHits": int(candidate.sum()) - int(baseline.sum()),
            "candidateOnly": int((candidate & ~baseline).sum()),
            "baselineOnly": int((baseline & ~candidate).sum()),
            "pairBrier": float(losses[mask, column].mean()) if n else None}


def weekly_bootstrap(dates: np.ndarray, differences: np.ndarray) -> dict:
    weeks: dict[str, list[int]] = {}
    for iso, difference in zip(dates, differences):
        value = date.fromisoformat(iso)
        week = (value - timedelta(days=value.weekday())).isoformat()
        if week not in weeks:
            weeks[week] = [0, 0]
        weeks[week][0] += int(difference)
        weeks[week][1] += 1
    if not weeks:
        return {"weeks": 0, "meanLift": None, "interval95": [None, None]}
    totals = np.array(list(weeks.values()))
    rng = np.random.default_rng(20261018)
    draws = rng.integers(0, len(totals), size=(4000, len(totals)))
    sums = totals[draws].sum(axis=1)
    rates = sums[:, 0] / sums[:, 1]
    return {"weeks": len(totals), "meanLift": float(differences.mean()),
            "interval95": np.quantile(rates, [0.025, 0.975]).tolist()}


def evaluate(data: Dataset, predictions: np.ndarray, losses: np.ndarray) -> dict:
    hits = data.targets[np.arange(len(data.dates))[:, None], predictions].astype(bool)
    latest = str(data.dates[-1])
    periods = {"development": ("2021-01-01", "2023-12-31"),
               "validation": ("2024-01-01", "2024-12-31"),
               "confirmation": ("2025-01-01", "2025-12-31"), "recent": ("2026-01-01", latest)}
    for days in (7, 30, 90, 180):
        periods[f"last{days}"] = ((date.fromisoformat(latest) - timedelta(days=days - 1)).isoformat(), latest)
    masks = {key: (data.dates >= start) & (data.dates <= end) for key, (start, end) in periods.items()}
    comparisons = {key: {name: summarize(hits, losses, mask, column) for column, name in enumerate(NAMES)}
                   for key, mask in masks.items()}
    selected = max(NAMES[1:], key=lambda name: comparisons["development"][name]["hits"])
    column = NAMES.index(selected)
    confirmation = data.dates >= "2025-01-01"
    bootstrap = weekly_bootstrap(data.dates[confirmation],
                                 hits[confirmation, column].astype(int) - hits[confirmation, 0].astype(int))
    gates = {key + "Improves": comparisons[key][selected]["netHits"] > 0
             for key in ("development", "validation", "confirmation", "recent")}
    gates.update({key + "NonDegrading": comparisons[key][selected]["netHits"] >= 0 for key in ("last30", "last90")})
    gates["weeklyBootstrapPositive"] = bootstrap["interval95"][0] > 0
    by_route = {route: summarize(hits, losses, masks["recent"] & (data.routes == route), column)
                for route in sorted(set(data.routes))}
    return {"latestActualDate": latest, "strictTarget": "both selected digits occur in the same panel",
            "candidateCount": len(NAMES) - 1, "selectedChallenger": selected, "periods": periods,
            "comparisons": comparisons, "weeklyBootstrap2025Onward": bootstrap,
            "promotionGates": gates, "eligibleForProspectiveTrial": all(gates.values()),
            "productionChanged": False, "recentMarketSides": by_route}


def write_report(result: dict) -> None:
    selected = result["selectedChallenger"]
    lines = ["# Pooled and supervised two-present-digit study", "",
             f"Results through {result['latestActualDate']}. Both selected digits must appear in the same panel.", "",
             f"Tested {result['candidateCount']} new challengers. Selected `{selected}` on 2021-2023 only.", "",
             "| Period | Events | Current model | Selected challenger | Net hits |",
             "| --- | ---: | ---: | ---: | ---: |"]
    for period, values in result["comparisons"].items():
        base, candidate = values[BASELINE], values[selected]
        lines.append(f"| {period} | {base['events']} | {base['hits']} ({base['accuracy']:.2%}) | "
                     f"{candidate['hits']} ({candidate['accuracy']:.2%}) | {candidate['netHits']:+d} |")
    interval = result["weeklyBootstrap2025Onward"]["interval95"]
    lines += ["", "## Decision", "",
              f"Eligible for a prospective trial: {str(result['eligibleForProspectiveTrial']).lower()}. Production changed: false.", "",
              "Failed checks: " + (", ".join(key for key, passed in result["promotionGates"].items() if not passed) or "none") + ".", "",
              f"Weekly bootstrap 95% interval for 2025-onward accuracy lift: {interval[0]:+.2%} to {interval[1]:+.2%}. "
              "Whole calendar weeks are resampled together across markets and sides.", "",
              "## Models and timing", "",
              "Six pooled-frequency models blend the local model with same-side or all-side counts from other markets and the local market. "
              "Two conditional models pool successors to the same previous sutta. Conditional estimates use 100 pseudo-results from the same-side pooled prior.", "",
              "Eighteen ridge models learn 45 pair-appearance residuals relative to the live model. "
              "Context features are market, side, target weekday, previous Open and Close suttas and panel kinds, "
              "30/180-result digit frequencies from each side, and the local pair probabilities. Sequence variants add three prior Open and Close digit masks. "
              "Features are standardized from training rows only. The intercept is unpenalized. Predictions are clipped to [0,1]. "
              "Scores are estimates, not verified confidence percentages.", "",
              "Models refit at each quarter boundary on prior outcomes within 28 calendar months. "
              "Features and pooled counts use strictly earlier dates, also capped at 28 calendar months. "
              "Same-day Open is excluded from Close. At least 180 own-market rows are required. "
              "All candidates score the same events. Lowest digit-pair order breaks ties. The fit audit is in results.json.", "",
              "## Limits and reproduction", "",
              "The protocol was committed before this experiment ran. These public histories have been examined in earlier studies, "
              "so this remains retrospective evidence. Later periods never select a new winner. Recent windows overlap. "
              "Bootstrap intervals describe the frozen candidate and do not correct for the repository's cumulative model search.", "",
              "The 6.67% figure for an SP panel is a random-pair coverage reference, not a ceiling on predictive accuracy. "
              "A predictive signal could exceed it; this experiment must demonstrate such a signal on later data.", "",
              "## Frozen next-result calls", "",
              "forward_registry.json freezes 24 offline research calls from pool_all_75 using only results through October 17. "
              "Each market is scored on its first subsequently observed complete row. Both its Open and Close pairs are fixed now, "
              "alongside the baseline pairs. These observations do not change the failed promotion decision or the live app.", "",
              "Score a complete updated chart CSV with `python research/present_digits_v3/forward.py score --input rows.csv`. "
              "The schema is `date,market,open,close`. The scorer never refits or overwrites the registry, and records the input hashes. "
              "The default sources currently leave all 24 calls pending. One batch of 24 calls cannot establish a small accuracy edge.", "",
              "Source and protocol hashes, all candidate comparisons, recent market-side scores, and quarterly training dates are in results.json. "
              "audit.csv contains the selected and baseline pair calls on every 2021-onward event. "
              "Study artifact hashes normalize line endings to LF; external source hashes describe the original input bytes.", "",
              "Run `python research/present_digits_v3/run_study.py`, then "
              "`python -m unittest discover -s research/present_digits_v3 -p 'test_*.py'`. Only NumPy and the Python standard library are required."]
    (HERE / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    markets, manifest = previous.load_rows()
    data = build_dataset(markets)
    print(json.dumps({"stage": "features", "rows": len(data.dates), "context": data.context.shape[1], "sequence": data.sequence.shape[1]}), flush=True)
    predictions, assigned, losses, fits = predict(data)
    result = evaluate(data, predictions, losses)
    result.update({"sources": manifest, "protocolSHA256": text_sha256(HERE / "protocol.json"),
                   "quarterlyFits": fits})
    selected = NAMES.index(result["selectedChallenger"])
    with (HERE / "audit.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "route", "baseline_pair", "candidate_pair", "baseline_hit", "candidate_hit", "candidate_score"])
        for index in np.flatnonzero(data.dates >= "2021-01-01"):
            base, candidate = int(predictions[index, 0]), int(predictions[index, selected])
            writer.writerow([data.dates[index], data.routes[index], "".join(map(str, PAIRS[base])),
                             "".join(map(str, PAIRS[candidate])), data.targets[index, base],
                             data.targets[index, candidate], f"{assigned[index, selected]:.8f}"])
    result["auditSHA256"] = text_sha256(HERE / "audit.csv")
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    write_report(result)
    print(json.dumps({"selected": result["selectedChallenger"], "gates": result["promotionGates"]}), flush=True)


if __name__ == "__main__":
    main()
