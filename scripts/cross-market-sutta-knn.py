"""Walk-forward market-specific analogue (kNN) research for Open/Close suttas."""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "scratch" / "cross-market-sutta-knn-output.json"
NIGHT_MARKETS = {
    "Sridevi Night", "Kalyan Night", "Madhur Night",
    "Milan Night", "Rajdhani Night", "Main Bazar",
}
SPEC = importlib.util.spec_from_file_location(
    "cross_market_bayes", ROOT / "scripts" / "cross-market-sutta-bayes.py"
)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load cross-market feature builder")
BAYES = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BAYES
SPEC.loader.exec_module(BAYES)


def feature_allowed(name: str, family: str) -> bool:
    is_panel = "Panel" in name
    if family == "temporal":
        return name.startswith(("calendar:", "own:", "echo:"))
    if family == "previous_sutta":
        return not is_panel and name.startswith(("calendar:", "own:", "echo:", "previous:"))
    if family == "same_day_sutta":
        return not is_panel and name.startswith(("calendar:", "own:", "echo:", "sameDay:"))
    if family == "all_sutta":
        return not is_panel
    return True


def feature_weight(name: str) -> float:
    if name.startswith("own:"):
        return 2.0
    if name.startswith("echo:"):
        return 1.4
    if name.startswith("sameDay:"):
        return 1.2 if "Panel" not in name else 0.7
    if name.startswith("previous:"):
        return 0.8 if "Panel" not in name else 0.45
    return 0.45


def similarity(left: dict[str, int], right: dict[str, int]) -> float:
    names = left.keys() & right.keys()
    if not names:
        return 0.0
    total = sum(feature_weight(name) for name in names)
    matched = sum(feature_weight(name) for name in names if left[name] == right[name])
    return matched / total if total else 0.0


def hybrid(baseline: list[int], ordering: list[int]) -> list[int]:
    result = list(baseline[:4])
    result.extend(digit for digit in ordering if digit not in result)
    return result[:6]


def predictions_for_family(cases, family: str) -> dict[tuple[int, float], list[dict]]:
    neighbor_options = (10, 30, 60)
    shrink_options = (0.45, 0.75)
    variants = {(neighbors, shrink): [] for neighbors in neighbor_options for shrink in shrink_options}
    feature_maps = [
        {name: value for name, value in case.features.items() if feature_allowed(name, family)}
        for case in cases
    ]
    long_counts = Counter()
    for index, case in enumerate(cases):
        if index < 50:
            long_counts[case.target] += 1
            continue
        analogues = []
        for prior_index, prior in enumerate(cases[:index]):
            score = similarity(feature_maps[index], feature_maps[prior_index])
            # Mild recency tie-break; similarity remains dominant.
            score += 0.015 * math.exp(-(index - prior_index) / 120)
            analogues.append((score, prior_index, prior.target))
        analogues.sort(reverse=True)
        long_total = sum(long_counts.values())
        long_rates = [(long_counts[digit] + 2) / (long_total + 20) for digit in range(10)]
        for neighbors in neighbor_options:
            selected = analogues[:neighbors]
            neighbor_counts = Counter()
            weight_total = 0.0
            for score, _, target in selected:
                weight = max(0.01, score) ** 2
                neighbor_counts[target] += weight
                weight_total += weight
            neighbor_rates = [(neighbor_counts[digit] + 1.5) / (weight_total + 15) for digit in range(10)]
            for shrink in shrink_options:
                scores = [
                    (1 - shrink) * long_rates[digit] + shrink * neighbor_rates[digit]
                    for digit in range(10)
                ]
                ordering = sorted(range(10), key=lambda digit: (-scores[digit], digit))
                predicted = hybrid(case.baseline, ordering)
                top_similarity = sum(score for score, _, _ in selected[: min(10, len(selected))]) / min(10, len(selected))
                variants[(neighbors, shrink)].append({
                    "caseIndex": index, "block": case.block,
                    "baseline": case.target in case.baseline,
                    "candidate": case.target in predicted,
                    "similarity": top_similarity,
                })
        long_counts[case.target] += 1
    return variants


def summarize(rows: list[dict], block: str) -> dict:
    selected = [row for row in rows if row["block"] == block]
    baseline = sum(row["baseline"] for row in selected)
    candidate = sum(row["candidate"] for row in selected)
    return {"n": len(selected), "baseline": baseline, "candidate": candidate, "delta": candidate - baseline}


def evaluate() -> dict:
    case_map = BAYES.build_cases()
    results = []
    selective90 = []
    for (market, side), cases in case_map.items():
        if market not in NIGHT_MARKETS:
            continue
        family_results = []
        for family in ("temporal", "previous_sutta", "all_sutta", "all"):
            variants = predictions_for_family(cases, family)
            for (neighbors, shrink), rows in variants.items():
                development = summarize(rows, "development")
                family_results.append({
                    "family": family, "neighbors": neighbors, "shrink": shrink,
                    "rows": rows, "development": development,
                })
        selected = max(
            family_results,
            key=lambda row: (
                row["development"]["delta"], row["development"]["candidate"],
                row["family"], -row["neighbors"], -row["shrink"],
            ),
        )
        validation = summarize(selected["rows"], "validation")
        holdout = summarize(selected["rows"], "holdout30")
        rolling = []
        ordered = selected["rows"]
        for start in range(0, len(ordered), 90):
            block = ordered[start:start + 90]
            if len(block) >= 30:
                rolling.append(sum(row["candidate"] for row in block) - sum(row["baseline"] for row in block))
        decision = (
            "promote"
            if selected["development"]["delta"] > 0
            and validation["delta"] > 0
            and holdout["delta"] >= 0
            and sum(value < 0 for value in rolling) <= 1
            else "revert_to_baseline"
        )
        results.append({
            "market": market, "side": side, "family": selected["family"],
            "neighbors": selected["neighbors"], "shrink": selected["shrink"],
            "decision": decision, "development": selected["development"],
            "validation": validation, "holdout30": holdout, "rolling90Deltas": rolling,
        })
        # Similarity threshold chosen using validation, then checked on holdout.
        for threshold in (0.25, 0.35, 0.45, 0.55, 0.65):
            validation_rows = [
                row for row in selected["rows"]
                if row["block"] == "validation" and row["similarity"] >= threshold
            ]
            holdout_rows = [
                row for row in selected["rows"]
                if row["block"] == "holdout30" and row["similarity"] >= threshold
            ]
            if len(validation_rows) < 30 or not holdout_rows:
                continue
            validation_accuracy = sum(row["candidate"] for row in validation_rows) / len(validation_rows)
            if validation_accuracy >= 0.9:
                selective90.append({
                    "market": market, "side": side, "threshold": threshold,
                    "validationN": len(validation_rows), "validationAccuracy": validation_accuracy,
                    "holdoutN": len(holdout_rows),
                    "holdoutAccuracy": sum(row["candidate"] for row in holdout_rows) / len(holdout_rows),
                })
    return {"generatedAt": datetime.now().astimezone().isoformat(), "results": results, "selective90": selective90}


def main() -> None:
    report = evaluate()
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for row in report["results"]:
        print(row)
    print(f"\nValidated >=90% selective analogue regions: {len(report['selective90'])}")
    for row in report["selective90"]:
        print(row)
    print(f"\nSaved {OUTPUT}")


if __name__ == "__main__":
    main()
