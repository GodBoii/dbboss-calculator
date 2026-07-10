import datetime as dt
import json
import math
from pathlib import Path

import numpy as np

from two_digit_nonlinear_cross_market import (
    MARKETS,
    build_matrix,
    dated,
    score_predictions,
)


ROOT = Path(__file__).resolve().parent


def spectral_scale(matrix, target):
    values = np.linalg.eigvals(matrix)
    radius = float(np.max(np.abs(values)))
    return matrix * (target / radius) if radius > 1e-9 else matrix


def reservoir_states(x, width, spectral_radius, leak, seed):
    rng = np.random.default_rng(seed)
    compressed_width = 32
    projection = rng.normal(0, 1 / math.sqrt(x.shape[1]), size=(x.shape[1], compressed_width))
    compressed = np.tanh(x @ projection)
    input_weights = rng.normal(0, 0.7 / math.sqrt(compressed_width), size=(compressed_width, width))
    recurrent = rng.normal(0, 1 / math.sqrt(width), size=(width, width))
    recurrent = spectral_scale(recurrent, spectral_radius)
    states = np.zeros((len(x), width), dtype=np.float64)
    state = np.zeros(width, dtype=np.float64)
    for index in range(len(x)):
        proposal = np.tanh(compressed[index] @ input_weights + state @ recurrent)
        state = (1 - leak) * state + leak * proposal
        states[index] = state
    return np.hstack([compressed, states])


def ridge_fit(train_h, train_y, l2):
    h = np.hstack([np.ones((len(train_h), 1)), train_h])
    regularizer = np.eye(h.shape[1]) * l2
    regularizer[0, 0] = 0.01
    return np.linalg.solve(h.T @ h + regularizer, h.T @ train_y)


def ridge_predict(h, weights):
    return np.hstack([np.ones((len(h), 1)), h]) @ weights


def compact(score):
    return {key: score[key] for key in ("correct", "digitCorrect", "total", "accuracy", "avgCorrectDigits")}


def summarize(folds):
    correct = sum(fold["test"]["correct"] for fold in folds)
    digit_correct = sum(fold["test"]["digitCorrect"] for fold in folds)
    total = sum(fold["test"]["total"] for fold in folds)
    return dict(
        correct=correct,
        digitCorrect=digit_correct,
        total=total,
        accuracy=correct / total if total else 0.0,
        avgCorrectDigits=digit_correct / total if total else 0.0,
        folds=len(folds),
    )


def main():
    raw = json.loads((ROOT / "open-sutta-records-cache.json").read_text())
    rows_by_market = {market: dated(raw.get(market, [])) for market in MARKETS}
    date_maps = {market: {row["isoDate"]: row for row in rows} for market, rows in rows_by_market.items()}
    reservoir_configs = [
        dict(width=width, spectralRadius=radius, leak=leak, seed=seed)
        for seed in (17, 43)
        for width in (32, 64)
        for radius in (0.4, 0.9, 1.2)
        for leak in (0.25, 0.65)
    ]
    l2_values = (1.0, 10.0, 100.0)
    output_modes = ("digit_risk", "pair_probability")
    confidence_quantiles = (0.0, 0.25, 0.5, 0.75)
    fold_data = []

    for market in MARKETS:
        for side in ("open", "close"):
            rows = rows_by_market[market]
            full_x, full_y, full_masks, _ = build_matrix(rows, side, rows_by_market, date_maps, market, 0, len(rows))
            states_by_config = []
            for config in reservoir_configs:
                states_by_config.append(reservoir_states(full_x, config["width"], config["spectralRadius"], config["leak"], config["seed"]))
            for test_start in (len(rows) - 30, len(rows) - 60):
                if test_start < 360:
                    continue
                val_start = test_start - 90
                train_start = max(0, val_start - 365)
                candidates = []
                for config, all_states in zip(reservoir_configs, states_by_config):
                    train_h = all_states[train_start:val_start]
                    val_h = all_states[val_start:test_start]
                    test_h = all_states[test_start:test_start + 30]
                    train_y = full_y[train_start:val_start]
                    val_masks = full_masks[val_start:test_start]
                    test_masks = full_masks[test_start:test_start + 30]
                    for l2 in l2_values:
                        weights = ridge_fit(train_h, train_y, l2)
                        val_pred = ridge_predict(val_h, weights)
                        test_pred = ridge_predict(test_h, weights)
                        for output_mode in output_modes:
                            raw_val = score_predictions(val_pred, val_masks, output_mode)
                            for quantile in confidence_quantiles:
                                threshold = float(np.quantile(raw_val["confidences"], quantile)) if raw_val["confidences"] else math.inf
                                validation = score_predictions(val_pred, val_masks, output_mode, threshold)
                                test = score_predictions(test_pred, test_masks, output_mode, threshold)
                                candidates.append(dict(
                                    config={**config, "l2": l2, "outputMode": output_mode, "confidenceQuantile": quantile},
                                    threshold=threshold,
                                    validation=compact(validation),
                                    test=compact(test),
                                ))
                fold_data.append(dict(
                    market=market,
                    side=side,
                    testWindow=f"{rows[test_start]['isoDate']}..{rows[test_start + 29]['isoDate']}",
                    candidates=candidates,
                ))

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
        reservoirConfigs=len(reservoir_configs),
        modelVariants=len(reservoir_configs) * len(l2_values) * len(output_modes) * len(confidence_quantiles),
        forwardFolds=len(fold_data),
        viable80Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.8),
        viable85Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.85),
        bestMin30=best30,
        bestMin120=best120,
        bestMin720=best720,
        results=results,
    )
    (ROOT / "two_digit_temporal_reservoir_output.json").write_text(json.dumps(output, indent=2))
    lines = [
        "# Two-Digit Temporal Reservoir", "", f"Generated: {output['generatedAt']}",
        f"Reservoir dynamics: {output['reservoirConfigs']}", f"Model/target/confidence variants: {output['modelVariants']}",
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
    lines.extend(["", "## Interpretation", "", "- Echo-state reservoirs carry nonlinear sequence memory through each market-side chronology.", "- Inputs contain only previous target history and same-day market events published before the target event.", "- Reservoir dynamics, readout regularization, target type, and confidence cutoff are selected on validation before frozen later scoring."])
    (ROOT / "two_digit_temporal_reservoir.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
