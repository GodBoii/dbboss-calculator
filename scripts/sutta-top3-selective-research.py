"""Research-only selective Top-3 prediction and abstention audit.

Expert agreement is converted into causal confidence scores. The confidence
metric and numeric threshold are selected on development only, then frozen for
validation, chronological holdout, and the sealed forward block. Accuracy is
always reported with coverage so abstention cannot manufacture a hidden claim.
"""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
HISTORICAL = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-selective-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-selective-research.md"
TOP_K = 3
TARGET_ACCURACY = 0.90
MIN_CALLS = {"development": 50, "validation": 30, "holdout": 30, "forward": 10}
COVERAGE_LEVELS = (0.02, 0.05, 0.10, 0.20, 0.30, 0.50, 0.75, 1.00)


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_selective_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()


def read_rows(path: Path, forward: bool) -> list[dict[str, Any]]:
    return [{**row, "forward": forward} for row in json.loads(path.read_text(encoding="utf-8"))["ledger"]]


def build_splits(rows: list[dict[str, Any]]) -> dict[str, list[int]]:
    result = {name: [] for name in ("development", "validation", "holdout", "forward")}
    for market in F.MARKETS:
        historical = [index for index, row in enumerate(rows) if row["market"] == market and not row["forward"]]
        future = [index for index, row in enumerate(rows) if row["market"] == market and row["forward"]]
        n = len(historical)
        result["development"].extend(historical[int(n * 0.50):int(n * 0.70)])
        result["validation"].extend(historical[int(n * 0.70):int(n * 0.85)])
        result["holdout"].extend(historical[int(n * 0.85):])
        result["forward"].extend(future)
    return {name: sorted(indices) for name, indices in result.items()}


def ranked(scores: list[float]) -> list[int]:
    return sorted(range(len(scores)), key=lambda value: (-scores[value], value))


def consensus(rankings: list[list[int]], classes: int) -> tuple[list[int], dict[str, float]]:
    votes = [0] * classes
    sets = Counter()
    for ranking in rankings:
        picks = ranking[:TOP_K]
        sets[tuple(sorted(picks))] += 1
        for value in picks:
            votes[value] += 1
    order = sorted(range(classes), key=lambda value: (-votes[value], value))
    model_count = max(1, len(rankings))
    vote_total = TOP_K * model_count
    probabilities = [vote / vote_total for vote in votes if vote]
    entropy = -sum(value * math.log(value) for value in probabilities)
    entropy_max = math.log(classes)
    mass = sum(votes[value] for value in order[:TOP_K]) / vote_total
    margin = (votes[order[TOP_K - 1]] - votes[order[TOP_K]]) / model_count
    top = votes[order[0]] / model_count
    concentration = 1 - entropy / entropy_max if entropy_max else 0.0
    set_agreement = max(sets.values(), default=0) / model_count
    composite = (mass + margin + concentration + set_agreement) / 4
    return order[:TOP_K], {
        "mass": mass,
        "margin": margin,
        "topVote": top,
        "concentration": concentration,
        "setAgreement": set_agreement,
        "composite": composite,
    }


def build_predictions(rows: list[dict[str, Any]]) -> dict[str, dict[str, list[Any]]]:
    cache = F.load_rows()
    positions = {market: {row.iso: index for index, row in enumerate(market_rows)} for market, market_rows in cache.items()}
    result = {
        target: {"hit": [], "confidence": defaultdict(list), "prediction": []}
        for target in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")
    }

    for ledger in rows:
        market = ledger["market"]
        target_index = positions[market][ledger["isoDate"]]
        target = cache[market][target_index]
        prior = cache[market][:target_index]
        open_scores = F.feature_scores(prior, "open", target)
        close_scores = F.feature_scores(prior, "close", target)
        exact_scores = F.jodi_feature_scores(prior, target)

        open_rankings = [F.rank(scores) for scores in open_scores.values()]
        open_rankings.append([int(value) for value in ledger["openRanking"]])
        close_rankings = [F.rank(scores) for name, scores in close_scores.items() if not name.startswith("known_open")]
        close_rankings.append([int(value) for value in ledger["closeRanking"]])
        adjusted_rankings = [F.rank(scores) for scores in close_scores.values()]
        adjusted_rankings.append([int(value) for value in ledger["closeRanking"]])
        exact_rankings = [ranked(scores) for scores in exact_scores.values()]

        open_picks, open_conf = consensus(open_rankings, 10)
        close_picks, close_conf = consensus(close_rankings, 10)
        adjusted_picks, adjusted_conf = consensus(adjusted_rankings, 10)
        exact_picks, exact_conf = consensus(exact_rankings, 100)
        grid_picks = [open * 10 + close for open in open_picks for close in close_picks]
        grid_conf = {
            key: min(open_conf[key], close_conf[key])
            for key in open_conf
        }

        actual_jodi = target.open * 10 + target.close
        values = {
            "open": (target.open in open_picks, open_conf, open_picks),
            "close": (target.close in close_picks, close_conf, close_picks),
            "adjustedClose": (target.close in adjusted_picks, adjusted_conf, adjusted_picks),
            "exactJodi": (actual_jodi in exact_picks, exact_conf, exact_picks),
            "jodiGrid": (actual_jodi in grid_picks, grid_conf, grid_picks),
        }
        for name, (hit, confidence, prediction) in values.items():
            result[name]["hit"].append(hit)
            result[name]["prediction"].append(prediction)
            for metric_name, metric_value in confidence.items():
                result[name]["confidence"][metric_name].append(metric_value)
    return result


def wilson(hits: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if not n:
        return 0.0, 0.0
    p = hits / n
    denominator = 1 + z * z / n
    centre = p + z * z / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)
    return (centre - spread) / denominator, (centre + spread) / denominator


def score_mask(hits: list[bool], scores: list[float], indices: list[int], threshold: float) -> dict[str, Any]:
    called = [index for index in indices if scores[index] >= threshold]
    correct = sum(hits[index] for index in called)
    low, high = wilson(correct, len(called))
    return {
        "rows": len(indices),
        "calls": len(called),
        "hits": correct,
        "coverage": round(100 * len(called) / len(indices), 3) if indices else 0.0,
        "accuracy": round(100 * correct / len(called), 3) if called else 0.0,
        "ci95": [round(100 * low, 3), round(100 * high, 3)],
    }


def select_policy(target: str, prediction: dict[str, Any], splits: dict[str, list[int]]) -> dict[str, Any]:
    development = splits["development"]
    candidates = []
    for metric_name, scores in prediction["confidence"].items():
        ordered = sorted((scores[index] for index in development), reverse=True)
        for coverage in COVERAGE_LEVELS:
            position = min(len(ordered) - 1, max(0, math.ceil(coverage * len(ordered)) - 1))
            threshold = ordered[position]
            performance = score_mask(prediction["hit"], scores, development, threshold)
            if performance["calls"] < MIN_CALLS["development"]:
                continue
            candidates.append({
                "metric": metric_name,
                "requestedDevelopmentCoverage": coverage * 100,
                "threshold": threshold,
                "development": performance,
            })
    qualifying = [row for row in candidates if row["development"]["accuracy"] >= TARGET_ACCURACY * 100]
    if qualifying:
        selected = max(qualifying, key=lambda row: (row["development"]["calls"], row["development"]["ci95"][0]))
        selection_outcome = "development_90_found"
    else:
        selected = max(
            candidates,
            key=lambda row: (row["development"]["ci95"][0], row["development"]["accuracy"], row["development"]["calls"]),
        )
        selection_outcome = "no_development_90_policy"

    scores = prediction["confidence"][selected["metric"]]
    metrics = {
        block: score_mask(prediction["hit"], scores, indices, selected["threshold"])
        for block, indices in splits.items()
    }
    passes = all(
        metrics[block]["calls"] >= MIN_CALLS[block]
        and metrics[block]["accuracy"] >= TARGET_ACCURACY * 100
        for block in ("validation", "holdout", "forward")
    )
    return {
        "target": target,
        "selectionOutcome": selection_outcome,
        "metric": selected["metric"],
        "threshold": selected["threshold"],
        "requestedDevelopmentCoverage": selected["requestedDevelopmentCoverage"],
        "minimumCalls": MIN_CALLS,
        "metrics": metrics,
        "passes90Gate": passes,
        "candidatePolicies": len(candidates),
        "bestDevelopmentAccuracy": max(row["development"]["accuracy"] for row in candidates),
    }


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["hits"]}/{value["calls"]} ({value["accuracy"]:.1f}%), '
        f'coverage {value["coverage"]:.1f}%, CI {value["ci95"][0]:.1f}-{value["ci95"][1]:.1f}%'
    )


def write_report(payload: dict[str, Any]) -> None:
    labels = {
        "open": "Open digit",
        "close": "Close digit",
        "adjustedClose": "Adjusted Close digit",
        "exactJodi": "Exact Jodi (3 pairs)",
        "jodiGrid": "Jodi grid (9 pairs)",
    }
    lines = [
        "# Selective Top-3 / Abstention Research",
        "",
        "Expert-agreement confidence and thresholds are selected on development only. Every accuracy is accompanied by coverage, number of calls, and a Wilson interval. The 90% gate also requires at least 30 calls in validation and holdout and 10 calls in the frozen forward block.",
        "",
        "| Target | Frozen policy | Development | Validation | Holdout | Frozen forward | 90% gate |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target, result in payload["results"].items():
        metrics = result["metrics"]
        lines.append(
            f'| {labels[target]} | `{result["metric"]} >= {result["threshold"]:.6f}` | '
            f'{format_metric(metrics["development"])} | {format_metric(metrics["validation"])} | '
            f'{format_metric(metrics["holdout"])} | {format_metric(metrics["forward"])} | '
            f'{"pass" if result["passes90Gate"] else "reject"} |'
        )
    lines.extend([
        "",
        "## Decision",
        "",
    ])
    passed = [target for target, result in payload["results"].items() if result["passes90Gate"]]
    if passed:
        lines.append("The following selective contracts passed every predeclared 90% gate: " + ", ".join(labels[target] for target in passed) + ".")
    else:
        lines.append("No selective Top-3 contract reached 90% with the predeclared minimum sample sizes on validation, holdout, and frozen forward data.")
    lines.extend([
        "",
        "A zero-call or tiny-call policy is not accepted as a model. Coverage cannot be hidden when evaluating abstention.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    rows = read_rows(HISTORICAL, False) + read_rows(FORWARD, True)
    rows.sort(key=lambda row: (row["isoDate"], F.MARKETS.index(row["market"])))
    splits = build_splits(rows)
    predictions = build_predictions(rows)
    results = {target: select_policy(target, prediction, splits) for target, prediction in predictions.items()}
    payload = {
        "schemaVersion": 1,
        "topK": TOP_K,
        "targetAccuracy": TARGET_ACCURACY * 100,
        "rows": len(rows),
        "splits": {name: len(indices) for name, indices in splits.items()},
        "results": results,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    for target, result in results.items():
        print(target, result["selectionOutcome"], result["metric"], f'{result["threshold"]:.6f}', "pass" if result["passes90Gate"] else "reject")
        for block, value in result["metrics"].items():
            print(" ", block, format_metric(value))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
