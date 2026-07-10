import datetime as dt
import json
import math
from pathlib import Path

import numpy as np

from two_digit_nonlinear_cross_market import (
    MARKETS,
    PAIRS,
    absent,
    build_matrix,
    dated,
    mask_for,
    panel_for,
    score_predictions,
)


ROOT = Path(__file__).resolve().parent


class Node:
    __slots__ = ("prediction", "feature", "threshold", "left", "right")

    def __init__(self, prediction):
        self.prediction = prediction
        self.feature = -1
        self.threshold = 0.0
        self.left = None
        self.right = None


def build_tree(x, y, indices, depth, min_leaf, max_features, rng):
    node = Node(y[indices].mean(axis=0))
    if depth == 0 or len(indices) < min_leaf * 2:
        return node
    variances = np.var(x[indices], axis=0)
    eligible = np.flatnonzero(variances > 1e-10)
    if not len(eligible):
        return node
    features = rng.choice(eligible, size=min(max_features, len(eligible)), replace=False)
    best = None
    for feature in features:
        values = x[indices, feature]
        thresholds = np.unique(np.quantile(values, [0.25, 0.5, 0.75]))
        for threshold in thresholds:
            left_mask = values <= threshold
            left_n = int(left_mask.sum())
            right_n = len(indices) - left_n
            if left_n < min_leaf or right_n < min_leaf:
                continue
            left_indices = indices[left_mask]
            right_indices = indices[~left_mask]
            left_mean = y[left_indices].mean(axis=0)
            right_mean = y[right_indices].mean(axis=0)
            gain = left_n * float(left_mean @ left_mean) + right_n * float(right_mean @ right_mean)
            if best is None or gain > best[0]:
                best = (gain, int(feature), float(threshold), left_indices, right_indices)
    if best is None:
        return node
    _, node.feature, node.threshold, left_indices, right_indices = best
    node.left = build_tree(x, y, left_indices, depth - 1, min_leaf, max_features, rng)
    node.right = build_tree(x, y, right_indices, depth - 1, min_leaf, max_features, rng)
    return node


def predict_tree(node, row):
    while node.feature >= 0:
        node = node.left if row[node.feature] <= node.threshold else node.right
    return node.prediction


def train_forest(x, y, trees, depth, min_leaf, max_features, seed):
    rng = np.random.default_rng(seed)
    forest = []
    for _ in range(trees):
        sample = rng.integers(0, len(x), size=len(x))
        forest.append(build_tree(x, y, sample, depth, min_leaf, max_features, rng))
    return forest


def predict_forest(forest, x):
    predictions = np.zeros((len(x), len(forest[0].prediction)), dtype=np.float64)
    for tree in forest:
        predictions += np.vstack([predict_tree(tree, row) for row in x])
    return predictions / len(forest)


def compact(score):
    return {key: score[key] for key in ("correct", "digitCorrect", "total", "accuracy", "avgCorrectDigits")}


def summarize(folds):
    correct = sum(fold["test"]["correct"] for fold in folds)
    digit_correct = sum(fold["test"]["digitCorrect"] for fold in folds)
    total = sum(fold["test"]["total"] for fold in folds)
    return dict(correct=correct, digitCorrect=digit_correct, total=total, accuracy=correct / total if total else 0.0, avgCorrectDigits=digit_correct / total if total else 0.0, folds=len(folds))


def main():
    raw = json.loads((ROOT / "open-sutta-records-cache.json").read_text())
    rows_by_market = {market: dated(raw.get(market, [])) for market in MARKETS}
    date_maps = {market: {row["isoDate"]: row for row in rows} for market, rows in rows_by_market.items()}
    base_configs = [
        dict(depth=depth, minLeaf=min_leaf, maxFeatures=max_features, trees=15, seed=47)
        for depth in (2, 3, 4)
        for min_leaf in (10, 20)
        for max_features in (12, 24)
    ]
    output_modes = ("digit_risk", "pair_probability")
    confidence_quantiles = (0.0, 0.25, 0.5, 0.75)
    fold_data = []

    for market in MARKETS:
        for side in ("open", "close"):
            rows = rows_by_market[market]
            for fold_count, test_start in enumerate((len(rows) - 30, len(rows) - 60)):
                if test_start < 360:
                    continue
                val_start = test_start - 90
                train_start = max(0, val_start - 365)
                train_x, train_y, _, _ = build_matrix(rows, side, rows_by_market, date_maps, market, train_start, val_start)
                val_x, _, val_masks, _ = build_matrix(rows, side, rows_by_market, date_maps, market, val_start, test_start)
                test_x, _, test_masks, _ = build_matrix(rows, side, rows_by_market, date_maps, market, test_start, test_start + 30)
                candidates = []
                for config in base_configs:
                    forest = train_forest(train_x, train_y, config["trees"], config["depth"], config["minLeaf"], config["maxFeatures"], config["seed"])
                    val_pred = predict_forest(forest, val_x)
                    test_pred = predict_forest(forest, test_x)
                    for output_mode in output_modes:
                        raw_val = score_predictions(val_pred, val_masks, output_mode)
                        for quantile in confidence_quantiles:
                            threshold = float(np.quantile(raw_val["confidences"], quantile)) if raw_val["confidences"] else math.inf
                            validation = score_predictions(val_pred, val_masks, output_mode, threshold)
                            test = score_predictions(test_pred, test_masks, output_mode, threshold)
                            candidates.append(dict(config={**config, "outputMode": output_mode, "confidenceQuantile": quantile}, threshold=threshold, validation=compact(validation), test=compact(test)))
                fold_data.append(dict(market=market, side=side, testWindow=f"{rows[test_start]['isoDate']}..{rows[test_start + 29]['isoDate']}", candidates=candidates))

    gates = [dict(minValCalls=calls, minValAccuracy=accuracy) for calls in (20, 60) for accuracy in (0.6, 0.7, 0.8)]
    results = []
    for gate in gates:
        folds = []
        for fold in fold_data:
            eligible = [candidate for candidate in fold["candidates"] if candidate["validation"]["total"] >= gate["minValCalls"] and candidate["validation"]["accuracy"] >= gate["minValAccuracy"]]
            eligible.sort(key=lambda item: (item["validation"]["accuracy"], item["validation"]["total"], item["validation"]["avgCorrectDigits"]), reverse=True)
            if eligible and eligible[0]["test"]["total"]:
                best = eligible[0]
                folds.append(dict(market=fold["market"], side=fold["side"], testWindow=fold["testWindow"], config=best["config"], validation=best["validation"], test=best["test"]))
        results.append(dict(gate=gate, summary=summarize(folds), folds=folds))

    def best_for(minimum):
        eligible = [item for item in results if item["summary"]["total"] >= minimum]
        return max(eligible, key=lambda item: (item["summary"]["accuracy"], item["summary"]["total"]), default=None)

    best30, best120, best720 = best_for(30), best_for(120), best_for(720)
    output = dict(
        generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
        baseForestConfigs=len(base_configs),
        modelVariants=len(base_configs) * len(output_modes) * len(confidence_quantiles),
        forwardFolds=len(fold_data),
        viable80Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.8),
        viable85Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.85),
        bestMin30=best30,
        bestMin120=best120,
        bestMin720=best720,
        results=results,
    )
    (ROOT / "two_digit_cross_market_forest_output.json").write_text(json.dumps(output, indent=2))
    lines = [
        "# Two-Digit Cross-Market Randomized Forest", "", f"Generated: {output['generatedAt']}",
        f"Base forest configs: {output['baseForestConfigs']}", f"Model/target/confidence variants: {output['modelVariants']}",
        f"Forward folds: {output['forwardFolds']}", f"Viable >=80% gates with >=30 calls: {output['viable80Count']}",
        f"Viable >=85% gates with >=30 calls: {output['viable85Count']}", "", "## Best Gates", "",
        "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |", "|---|---:|---:|---:|---:|",
    ]
    for name, item in (("Best min 30 calls", best30), ("Best min 120 calls", best120), ("Best min 720 calls", best720)):
        if item is None:
            lines.append(f"| {name} | n/a | n/a | n/a | n/a |")
        else:
            summary, gate = item["summary"], item["gate"]
            lines.append(f"| {name}: validation calls>={gate['minValCalls']}, validation>={gate['minValAccuracy'] * 100:.1f}% | {summary['total']} | {summary['accuracy'] * 100:.1f}% ({summary['correct']}/{summary['total']}) | {summary['avgCorrectDigits']:.2f} | {summary['folds']} |")
    lines.extend(["", "## Interpretation", "", "- Bootstrap trees use randomized feature subsets and threshold splits over the time-safe cross-market matrix.", "- Depth, leaf support, feature subsampling, digit-versus-pair target, and confidence cutoff are validation-selected before later test scoring.", "- No external ML dependency is used; seeds and split quantiles are deterministic and reproducible."])
    (ROOT / "two_digit_cross_market_forest.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
