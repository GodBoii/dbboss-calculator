import json
import math
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np


MARKETS = [
    "Sridevi",
    "Time Bazar",
    "Madhur Day",
    "Milan Day",
    "Rajdhani Day",
    "Kalyan",
    "Sridevi Night",
    "Kalyan Night",
    "Madhur Night",
    "Milan Night",
    "Rajdhani Night",
    "Main Bazar",
]

SOURCE_MARKET = {
    "Time Bazar": "Sridevi",
    "Madhur Day": "Time Bazar",
    "Milan Day": "Madhur Day",
    "Rajdhani Day": "Milan Day",
    "Kalyan": "Rajdhani Day",
    "Kalyan Night": "Sridevi Night",
    "Madhur Night": "Kalyan Night",
    "Milan Night": "Madhur Night",
    "Rajdhani Night": "Milan Night",
    "Main Bazar": "Rajdhani Night",
}

DAY_OFFSETS = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}

PAIRS = [(a, b, f"{a}{b}", (1 << a) | (1 << b)) for a in range(10) for b in range(a + 1, 10)]
FEATURE_DIM = 4096


def parse_date(value):
    parts = str(value or "").replace("-", "/").split("/")
    if len(parts) != 3:
        return None
    try:
        day, month, raw_year = [int(part) for part in parts]
    except ValueError:
        return None
    year = raw_year + 2000 if raw_year < 100 else raw_year
    return datetime(year, month, day, tzinfo=timezone.utc)


def iso_date(record):
    start = parse_date(record.get("dateRangeStart"))
    if not start:
        return None
    return (start + timedelta(days=DAY_OFFSETS.get(record.get("day"), 0))).date().isoformat()


def dated(records):
    rows = []
    for record in records:
        iso = iso_date(record)
        if iso:
            rows.append({"record": record, "isoDate": iso, "date": datetime.fromisoformat(iso)})
    return sorted(rows, key=lambda row: row["isoDate"])


def panel_for(row, side):
    return row["record"]["openPanel"] if side == "open" else row["record"]["closePanel"]


def sutta_for(row, side):
    return row["record"]["openSutta"] if side == "open" else row["record"]["closeSutta"]


def mask_for(panel):
    mask = 0
    for ch in str(panel or ""):
        if ch.isdigit():
            mask |= 1 << int(ch)
    return mask


def kind(mask):
    count = int(mask.bit_count())
    if count == 1:
        return "TP"
    if count == 2:
        return "DP"
    return "SP"


def absent(pair_idx, mask):
    return 1 if (mask & PAIRS[pair_idx][3]) == 0 else 0


def find_index_before(rows, iso):
    index = len(rows)
    while index > 0 and rows[index - 1]["isoDate"] >= iso:
        index -= 1
    return index


def stable_hash(text):
    value = 2166136261
    for byte in text.encode("utf-8"):
        value ^= byte
        value = (value * 16777619) & 0xFFFFFFFF
    return value % FEATURE_DIM


def add_cat(features, name):
    features.append((stable_hash(name), 1.0))


def add_num(features, name, value):
    features.append((stable_hash(name), float(value)))


def rolling_masks(rows, side):
    return [mask_for(panel_for(row, side)) for row in rows]


def rolling_rate(masks, pair_idx, index, lookback):
    start = max(0, index - lookback)
    if index <= start:
        return 0.0
    ok = sum(absent(pair_idx, masks[i]) for i in range(start, index))
    return ok / (index - start)


def digit_absent_rate(masks, digit, index, lookback):
    start = max(0, index - lookback)
    if index <= start:
        return 0.0
    bit = 1 << digit
    ok = sum(1 for i in range(start, index) if (masks[i] & bit) == 0)
    return ok / (index - start)


def gap_since_fail(masks, pair_idx, index, max_gap=120):
    pair_mask = PAIRS[pair_idx][3]
    for gap in range(1, min(index, max_gap) + 1):
        if masks[index - gap] & pair_mask:
            return gap
    return max_gap


def make_features(ctx, pair_idx, index):
    rows = ctx["rows"]
    row = rows[index]
    side = ctx["side"]
    masks = ctx["masks"]
    opp_masks = ctx["opp_masks"]
    pair_a, pair_b, pair_key, pair_mask = PAIRS[pair_idx]
    prev_mask = masks[index - 1] if index > 0 else 0
    prev_opp_mask = opp_masks[index - 1] if index > 0 else 0
    features = []

    add_cat(features, "bias")
    add_cat(features, f"market={ctx['market']}")
    add_cat(features, f"side={side}")
    add_cat(features, f"day={row['record'].get('day')}")
    add_cat(features, f"pair={pair_key}")
    add_cat(features, f"pair_sum={(pair_a + pair_b) % 10}")
    add_cat(features, f"pair_house={'low' if pair_b <= 4 else 'high' if pair_a >= 5 else 'mixed'}")
    add_cat(features, f"pair_parity={'same' if pair_a % 2 == pair_b % 2 else 'mixed'}")
    add_cat(features, f"prev_kind={kind(prev_mask)}")
    add_cat(features, f"prev_opp_kind={kind(prev_opp_mask)}")
    add_cat(features, f"prev_overlap={(prev_mask & pair_mask).bit_count()}")
    add_cat(features, f"prev_opp_overlap={(prev_opp_mask & pair_mask).bit_count()}")
    add_cat(features, f"prev_sutta={sutta_for(rows[index - 1], side) if index > 0 else 'none'}")
    add_cat(features, f"dom_bucket={'early' if row['date'].day <= 10 else 'mid' if row['date'].day <= 20 else 'late'}")

    source = ctx.get("source")
    if source:
        source_rows, source_masks = source
        source_index = find_index_before(source_rows, row["isoDate"])
        if source_index > 0:
            source_prev_mask = source_masks[source_index - 1]
            add_cat(features, f"source_prev_kind={kind(source_prev_mask)}")
            add_cat(features, f"source_prev_overlap={(source_prev_mask & pair_mask).bit_count()}")
            add_cat(features, f"source_prev_sutta={sutta_for(source_rows[source_index - 1], side)}")

    for lookback in (7, 14, 30, 60, 90, 120, 180):
        pr = rolling_rate(masks, pair_idx, index, lookback)
        ar_a = digit_absent_rate(masks, pair_a, index, lookback)
        ar_b = digit_absent_rate(masks, pair_b, index, lookback)
        add_num(features, f"pair_abs_l{lookback}", pr)
        add_num(features, f"digit_abs_min_l{lookback}", min(ar_a, ar_b))
        add_num(features, f"digit_abs_sum_l{lookback}", ar_a + ar_b)
        add_cat(features, f"pair_abs_l{lookback}_bucket={int(pr * 5)}")

    add_num(features, "gap_since_fail", gap_since_fail(masks, pair_idx, index) / 120)
    return features


def dot(weights, features):
    return sum(weights[idx] * val for idx, val in features)


def sigmoid(value):
    if value >= 0:
        z = math.exp(-value)
        return 1 / (1 + z)
    z = math.exp(value)
    return z / (1 + z)


def train_model(ctx, start, end, epochs=2, lr=0.04, l2=0.0003):
    weights = np.zeros(FEATURE_DIM, dtype=np.float64)
    examples = []
    for index in range(start, end):
        for pair_idx in range(len(PAIRS)):
            examples.append((make_features(ctx, pair_idx, index), absent(pair_idx, ctx["masks"][index])))

    for epoch in range(epochs):
        for features, label in examples:
            pred = sigmoid(dot(weights, features))
            error = label - pred
            for feature_idx, value in features:
                weights[feature_idx] = weights[feature_idx] * (1 - lr * l2) + lr * error * value
    return weights


def score_draw(ctx, weights, index):
    scores = []
    for pair_idx in range(len(PAIRS)):
        probability = sigmoid(dot(weights, make_features(ctx, pair_idx, index)))
        scores.append((probability, pair_idx))
    scores.sort(reverse=True)
    return scores[0]


def precompute_best_scores(ctx, weights, start, end):
    rows = []
    for index in range(start, end):
        probability, pair_idx = score_draw(ctx, weights, index)
        rows.append({
            "index": index,
            "probability": probability,
            "pair_idx": pair_idx,
            "ok": absent(pair_idx, ctx["masks"][index]),
        })
    return rows


def evaluate_scored(ctx, scored_rows, threshold):
    n = 0
    ok = 0
    picks = []
    for row in scored_rows:
        index = row["index"]
        probability = row["probability"]
        pair_idx = row["pair_idx"]
        if probability < threshold:
            continue
        hit = row["ok"]
        n += 1
        ok += hit
        picks.append({"date": ctx["rows"][index]["isoDate"], "pair": PAIRS[pair_idx][2], "prob": probability, "ok": bool(hit)})
    return {"n": n, "ok": ok, "accuracy": ok / n if n else 0, "picks": picks}


def choose_threshold(ctx, scored_rows):
    candidates = []
    for threshold in [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]:
        result = evaluate_scored(ctx, scored_rows, threshold)
        candidates.append((threshold, result))
    acceptable = [(threshold, result) for threshold, result in candidates if result["n"] >= 6 and result["accuracy"] >= 0.75]
    if acceptable:
        return sorted(acceptable, key=lambda item: (item[1]["accuracy"], item[1]["n"]), reverse=True)[0]
    return sorted(candidates, key=lambda item: (item[1]["accuracy"], item[1]["n"]), reverse=True)[0]


def build_folds(rows):
    folds = []
    train_size = 120
    validation_size = 45
    test_size = 30
    test_end = len(rows)
    while test_end - test_size - validation_size >= 120 and len(folds) < 2:
        test_start = test_end - test_size
        validation_end = test_start
        validation_start = validation_end - validation_size
        train_end = validation_start
        train_start = max(0, train_end - train_size)
        folds.append((train_start, train_end, validation_start, validation_end, test_start, test_end))
        test_end -= 30
    return list(reversed(folds))


def pct(value):
    return f"{value * 100:.1f}%"


def main():
    root = Path.cwd()
    data = json.loads((root / "scratch" / "open-sutta-records-cache.json").read_text())
    rows_by_market = {market: dated(data.get(market, [])) for market in MARKETS}
    masks_by_key = {}
    for market in MARKETS:
        for side in ("open", "close"):
            masks_by_key[(market, side)] = rolling_masks(rows_by_market[market], side)

    fold_rows = []
    for market in MARKETS:
        rows = rows_by_market[market]
        if len(rows) < 240:
            continue
        for side in ("open", "close"):
            ctx = {
                "market": market,
                "side": side,
                "rows": rows,
                "masks": masks_by_key[(market, side)],
                "opp_masks": masks_by_key[(market, "close" if side == "open" else "open")],
            }
            source = SOURCE_MARKET.get(market)
            if source:
                ctx["source"] = (rows_by_market[source], masks_by_key[(source, side)])

            for train_start, train_end, val_start, val_end, test_start, test_end in build_folds(rows):
                weights = train_model(ctx, train_start, train_end)
                validation_scores = precompute_best_scores(ctx, weights, val_start, val_end)
                test_scores = precompute_best_scores(ctx, weights, test_start, test_end)
                threshold, validation = choose_threshold(ctx, validation_scores)
                test = evaluate_scored(ctx, test_scores, threshold) if validation["n"] >= 6 and validation["accuracy"] >= 0.75 else {"n": 0, "ok": 0, "accuracy": 0, "picks": []}
                fold_rows.append({
                    "market": market,
                    "side": side,
                    "fold": f"{rows[test_start]['isoDate']}..{rows[test_end - 1]['isoDate']}",
                    "threshold": threshold,
                    "validation": {k: v for k, v in validation.items() if k != "picks"},
                    "test": {k: v for k, v in test.items() if k != "picks"},
                    "samplePicks": test["picks"][:5],
                })

    selected = [row for row in fold_rows if row["test"]["n"] > 0]
    total_n = sum(row["test"]["n"] for row in selected)
    total_ok = sum(row["test"]["ok"] for row in selected)
    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "folds": len(fold_rows),
        "selectedFolds": len(selected),
        "aggregate": {
            "n": total_n,
            "ok": total_ok,
            "accuracy": total_ok / total_n if total_n else 0,
            "folds80": sum(1 for row in selected if row["test"]["accuracy"] >= 0.8 and row["test"]["n"] >= 6),
        },
        "foldRows": fold_rows,
    }
    (root / "scratch" / "two_digit_pair_logistic_output.json").write_text(json.dumps(output, indent=2))

    lines = [
        "# Two-Digit Pair Logistic Classifier",
        "",
        f"Generated: {output['generatedAt']}",
        f"Folds tested: {output['folds']}",
        f"Selected folds: {output['selectedFolds']}",
        f"Aggregate strict accuracy: {pct(output['aggregate']['accuracy'])} ({total_ok}/{total_n})",
        f"Selected folds >=80%: {output['aggregate']['folds80']}",
        "",
        "| Market | Side | Fold | Threshold | Validation | Test |",
        "|---|---|---|---:|---:|---:|",
    ]
    for row in sorted(selected, key=lambda item: item["test"]["accuracy"], reverse=True):
        lines.append(
            f"| {row['market']} | {row['side']} | {row['fold']} | {row['threshold']:.2f} | "
            f"{pct(row['validation']['accuracy'])} n={row['validation']['n']} | "
            f"{pct(row['test']['accuracy'])} n={row['test']['n']} |"
        )
    (root / "scratch" / "two_digit_pair_logistic.md").write_text("\n".join(lines) + "\n")
    print(f"Folds tested: {output['folds']}")
    print(f"Selected folds: {output['selectedFolds']}")
    print(f"Aggregate strict accuracy: {pct(output['aggregate']['accuracy'])} ({total_ok}/{total_n})")
    print(f"Selected folds >=80%: {output['aggregate']['folds80']}")
    print("Report: scratch/two_digit_pair_logistic.md")


if __name__ == "__main__":
    main()
