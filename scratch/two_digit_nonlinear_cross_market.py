import datetime as dt
import json
import math
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parent
MARKETS = [
    "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
    "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]
DAY_OFFSETS = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
EVENT_TIME = {
    "Sridevi|open": 685, "Sridevi|close": 745, "Time Bazar|open": 775, "Time Bazar|close": 835,
    "Madhur Day|open": 805, "Madhur Day|close": 865, "Milan Day|open": 895, "Rajdhani Day|open": 895,
    "Kalyan|open": 945, "Milan Day|close": 1015, "Rajdhani Day|close": 1015, "Kalyan|close": 1065,
    "Sridevi Night|open": 1140, "Sridevi Night|close": 1200, "Madhur Night|open": 1225,
    "Milan Night|open": 1250, "Kalyan Night|open": 1280, "Rajdhani Night|open": 1280,
    "Main Bazar|open": 1295, "Madhur Night|close": 1345, "Milan Night|close": 1370,
    "Kalyan Night|close": 1400, "Rajdhani Night|close": 1405, "Main Bazar|close": 1430,
}
EVENTS = sorted(
    [dict(key=key, market=key.split("|")[0], side=key.split("|")[1], time=time) for key, time in EVENT_TIME.items()],
    key=lambda event: (event["time"], event["key"]),
)
PAIRS = [(a, b) for a in range(10) for b in range(a + 1, 10)]


def parse_date(value):
    parts = [int(part) for part in str(value or "").replace("-", "/").split("/")]
    if len(parts) != 3:
        return None
    day, month, year = parts
    return dt.date(year + 2000 if year < 100 else year, month, day)


def dated(records):
    rows = []
    for record in records:
        start = parse_date(record.get("dateRangeStart"))
        if not start:
            continue
        date = start + dt.timedelta(days=DAY_OFFSETS.get(record.get("day"), 0))
        rows.append(dict(record=record, date=date, isoDate=date.isoformat()))
    return sorted(rows, key=lambda row: row["isoDate"])


def panel_for(row, side):
    return str(row["record"].get("openPanel" if side == "open" else "closePanel") or "")


def mask_for(panel):
    mask = 0
    for char in str(panel):
        if char.isdigit():
            mask |= 1 << int(char)
    return mask


def absent(pair, mask):
    return (mask & ((1 << pair[0]) | (1 << pair[1]))) == 0


def event_block(row, side):
    block = np.zeros(16, dtype=np.float64)
    if row is None:
        return block
    panel = panel_for(row, side)
    if len(panel) != 3 or not panel.isdigit():
        return block
    digits = [int(char) for char in panel]
    mask = mask_for(panel)
    block[0] = 1.0
    for digit in range(10):
        block[1 + digit] = 1.0 if mask & (1 << digit) else 0.0
    total = sum(digits)
    block[11] = total / 27.0
    block[12 + min(2, max(0, mask.bit_count() - 1))] = 1.0
    block[15] = (total % 10) / 9.0
    return block


def build_features(rows, side, rows_by_market, date_maps, target_market, index):
    row = rows[index]
    target_time = EVENT_TIME[f"{target_market}|{side}"]
    values = []
    for event in EVENTS:
        available = 1.0 if event["time"] < target_time else 0.0
        values.append(available)
        source_row = date_maps[event["market"]].get(row["isoDate"]) if available else None
        values.extend(event_block(source_row, event["side"]).tolist())

    for lookback in (5, 15, 30, 90):
        start = max(0, index - lookback)
        count = max(1, index - start)
        rates = np.zeros(10)
        for prior_index in range(start, index):
            mask = mask_for(panel_for(rows[prior_index], side))
            for digit in range(10):
                rates[digit] += 1.0 if mask & (1 << digit) else 0.0
        values.extend((rates / count).tolist())

    previous_mask = mask_for(panel_for(rows[index - 1], side)) if index else 0
    values.extend([1.0 if previous_mask & (1 << digit) else 0.0 for digit in range(10)])
    weekday = [0.0] * 7
    weekday[row["date"].weekday()] = 1.0
    values.extend(weekday)
    return np.asarray(values, dtype=np.float64)


def build_matrix(rows, side, rows_by_market, date_maps, market, start, end):
    x_rows, digit_y, pair_y, masks, dates = [], [], [], [], []
    for index in range(start, end):
        mask = mask_for(panel_for(rows[index], side))
        x_rows.append(build_features(rows, side, rows_by_market, date_maps, market, index))
        digit_y.append([1.0 if mask & (1 << digit) else 0.0 for digit in range(10)])
        pair_y.append([1.0 if absent(pair, mask) else 0.0 for pair in PAIRS])
        masks.append(mask)
        dates.append(rows[index]["isoDate"])
    return np.vstack(x_rows), np.hstack([np.asarray(digit_y), np.asarray(pair_y)]), masks, dates


def standardize(train_x, other_x):
    mean = train_x.mean(axis=0)
    std = train_x.std(axis=0)
    std[std < 1e-8] = 1.0
    return (train_x - mean) / std, (other_x - mean) / std


def hidden_matrix(x, kind, width, seed):
    rng = np.random.default_rng(seed)
    projection = rng.normal(0, 1 / math.sqrt(max(1, x.shape[1])), size=(x.shape[1], width))
    bias = rng.uniform(-1, 1, size=width)
    z = x @ projection + bias
    if kind == "relu":
        return np.maximum(0, z)
    if kind == "tanh":
        return np.tanh(z)
    return math.sqrt(2 / width) * np.cos(z * math.pi)


def ridge_fit(train_h, train_y, l2):
    h = np.hstack([np.ones((len(train_h), 1)), train_h])
    regularizer = np.eye(h.shape[1]) * l2
    regularizer[0, 0] = 0.01
    return np.linalg.solve(h.T @ h + regularizer, h.T @ train_y)


def ridge_predict(h, weights):
    return np.hstack([np.ones((len(h), 1)), h]) @ weights


def pair_from_scores(row, output_mode):
    if output_mode == "digit_risk":
        digits = np.argsort(row[:10])[:2]
        a, b = sorted(int(value) for value in digits)
        pair_index = PAIRS.index((a, b))
        ordered = np.sort(row[:10])
        confidence = float(ordered[2] - ordered[1])
        return pair_index, confidence
    pair_scores = row[10:]
    order = np.argsort(pair_scores)[::-1]
    confidence = float(pair_scores[order[0]] - pair_scores[order[1]])
    return int(order[0]), confidence


def score_predictions(predictions, masks, output_mode, threshold=-math.inf):
    correct = digit_correct = total = 0
    confidences = []
    for row, mask in zip(predictions, masks):
        pair_index, confidence = pair_from_scores(row, output_mode)
        confidences.append(confidence)
        if confidence < threshold:
            continue
        pair = PAIRS[pair_index]
        hit_a = (mask & (1 << pair[0])) == 0
        hit_b = (mask & (1 << pair[1])) == 0
        correct += int(hit_a and hit_b)
        digit_correct += int(hit_a) + int(hit_b)
        total += 1
    return dict(
        correct=correct,
        digitCorrect=digit_correct,
        total=total,
        accuracy=correct / total if total else 0.0,
        avgCorrectDigits=digit_correct / total if total else 0.0,
        confidences=confidences,
    )


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
    base_configs = [("linear", 0, 0)]
    for kind in ("relu", "tanh", "fourier"):
        for width in (32, 64, 128):
            for seed in (11, 29):
                base_configs.append((kind, width, seed))
    l2_values = (1.0, 10.0, 100.0)
    output_modes = ("digit_risk", "pair_probability")
    confidence_quantiles = (0.0, 0.25, 0.5, 0.75)
    fold_data = []

    for market in MARKETS:
        for side in ("open", "close"):
            rows = rows_by_market[market]
            fold_count = 0
            test_start = len(rows) - 30
            while test_start >= 360 and fold_count < 2:
                val_start = test_start - 90
                train_start = max(0, val_start - 365)
                train_x, train_y, _, _ = build_matrix(rows, side, rows_by_market, date_maps, market, train_start, val_start)
                val_x, _, val_masks, _ = build_matrix(rows, side, rows_by_market, date_maps, market, val_start, test_start)
                test_x, _, test_masks, _ = build_matrix(rows, side, rows_by_market, date_maps, market, test_start, test_start + 30)
                train_xs, val_xs = standardize(train_x, val_x)
                _, test_xs = standardize(train_x, test_x)
                candidates = []
                for kind, width, seed in base_configs:
                    train_h = train_xs if kind == "linear" else hidden_matrix(train_xs, kind, width, seed)
                    val_h = val_xs if kind == "linear" else hidden_matrix(val_xs, kind, width, seed)
                    test_h = test_xs if kind == "linear" else hidden_matrix(test_xs, kind, width, seed)
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
                                    config=dict(kind=kind, width=width, seed=seed, l2=l2, outputMode=output_mode, confidenceQuantile=quantile),
                                    threshold=threshold,
                                    validation=compact(validation),
                                    test=compact(test),
                                ))
                fold_data.append(dict(market=market, side=side, testWindow=f"{rows[test_start]['isoDate']}..{rows[test_start + 29]['isoDate']}", candidates=candidates))
                test_start -= 30
                fold_count += 1

    gates = [dict(minValCalls=calls, minValAccuracy=accuracy) for calls in (20, 60) for accuracy in (0.6, 0.7, 0.8)]
    results = []
    for gate in gates:
        selected = []
        for fold in fold_data:
            eligible = [candidate for candidate in fold["candidates"] if candidate["validation"]["total"] >= gate["minValCalls"] and candidate["validation"]["accuracy"] >= gate["minValAccuracy"]]
            eligible.sort(key=lambda item: (item["validation"]["accuracy"], item["validation"]["total"], item["validation"]["avgCorrectDigits"]), reverse=True)
            if not eligible or eligible[0]["test"]["total"] == 0:
                continue
            best = eligible[0]
            selected.append(dict(market=fold["market"], side=fold["side"], testWindow=fold["testWindow"], config=best["config"], validation=best["validation"], test=best["test"]))
        results.append(dict(gate=gate, summary=summarize(selected), folds=selected))

    def best_for(minimum):
        eligible = [item for item in results if item["summary"]["total"] >= minimum]
        return max(eligible, key=lambda item: (item["summary"]["accuracy"], item["summary"]["total"]), default=None)

    best30, best120, best720 = best_for(30), best_for(120), best_for(720)
    output = dict(
        generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
        baseRepresentations=len(base_configs),
        modelVariants=len(base_configs) * len(l2_values) * len(output_modes) * len(confidence_quantiles),
        forwardFolds=len(fold_data),
        viable80Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.8),
        viable85Count=sum(1 for item in results if item["summary"]["total"] >= 30 and item["summary"]["accuracy"] >= 0.85),
        bestMin30=best30,
        bestMin120=best120,
        bestMin720=best720,
        results=results,
    )
    (ROOT / "two_digit_nonlinear_cross_market_output.json").write_text(json.dumps(output, indent=2))

    lines = [
        "# Two-Digit Nonlinear Cross-Market Classifier", "",
        f"Generated: {output['generatedAt']}",
        f"Base representations: {output['baseRepresentations']}",
        f"Model/target/confidence variants: {output['modelVariants']}",
        f"Forward folds: {output['forwardFolds']}",
        f"Viable >=80% gates with >=30 calls: {output['viable80Count']}",
        f"Viable >=85% gates with >=30 calls: {output['viable85Count']}", "",
        "## Best Gates", "", "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |", "|---|---:|---:|---:|---:|",
    ]
    for name, item in (("Best min 30 calls", best30), ("Best min 120 calls", best120), ("Best min 720 calls", best720)):
        if item is None:
            lines.append(f"| {name} | n/a | n/a | n/a | n/a |")
        else:
            summary, gate = item["summary"], item["gate"]
            lines.append(f"| {name}: validation calls>={gate['minValCalls']}, validation>={gate['minValAccuracy'] * 100:.1f}% | {summary['total']} | {summary['accuracy'] * 100:.1f}% ({summary['correct']}/{summary['total']}) | {summary['avgCorrectDigits']:.2f} | {summary['folds']} |")
    lines.extend(["", "## Interpretation", "", "- Linear ridge, ReLU, tanh, and Fourier random-feature networks are trained only on dates before validation.", "- Models jointly estimate ten digit-appearance risks and all 45 strict pair-absence targets.", "- Architecture, regularization, target type, and confidence cutoff are selected on validation; the frozen model is then scored on later test rows."])
    (ROOT / "two_digit_nonlinear_cross_market.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
