import json
import math
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parent
DIGITS = list(range(10))
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
DAY_OFFSETS = {
    "Monday": 0,
    "Tuesday": 1,
    "Wednesday": 2,
    "Thursday": 3,
    "Friday": 4,
    "Saturday": 5,
    "Sunday": 6,
}
OPPOSITE = {0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4}
PAIRS = [(a, b) for a in range(10) for b in range(a + 1, 10)]


def parse_date(value):
    parts = [int(x) for x in str(value or "").replace("-", "/").split("/") if x]
    if len(parts) != 3:
        return None
    day, month, year = parts
    if year < 100:
        year += 2000
    import datetime as dt

    return dt.date(year, month, day)


def dated(records):
    import datetime as dt

    rows = []
    for record in records:
        start = parse_date(record.get("dateRangeStart"))
        if not start:
            continue
        iso = start + dt.timedelta(days=DAY_OFFSETS.get(record.get("day"), 0))
        rows.append({"record": record, "date": iso, "isoDate": iso.isoformat()})
    return sorted(rows, key=lambda row: row["isoDate"])


def panel_for(row, side):
    return row["record"].get("openPanel" if side == "open" else "closePanel") or ""


def sutta_for(row, side):
    return row["record"].get("openSutta" if side == "open" else "closeSutta")


def mask_for(panel):
    mask = 0
    for char in str(panel):
        if char.isdigit():
            mask |= 1 << int(char)
    return mask


def is_absent_pair(pair, mask):
    return (mask & (1 << pair[0])) == 0 and (mask & (1 << pair[1])) == 0


def absent_digit_count(pair, mask):
    return int((mask & (1 << pair[0])) == 0) + int((mask & (1 << pair[1])) == 0)


def panel_kind(mask):
    count = sum(1 for digit in DIGITS if mask & (1 << digit))
    if count == 1:
        return 0
    if count == 2:
        return 1
    return 2


def rolling_stats(rows, side, index, lookback):
    start = max(0, index - lookback)
    n = max(1, index - start)
    hits = np.zeros(10)
    pair_ok = np.zeros(len(PAIRS))
    sums = []
    for i in range(start, index):
        mask = mask_for(panel_for(rows[i], side))
        sums.append(sum(int(c) for c in str(panel_for(rows[i], side)) if c.isdigit()))
        for digit in DIGITS:
            if mask & (1 << digit):
                hits[digit] += 1
        for pair_index, pair in enumerate(PAIRS):
            if is_absent_pair(pair, mask):
                pair_ok[pair_index] += 1
    return hits / n, pair_ok / n, (sum(sums) / len(sums) if sums else 13.5)


def gap_since(rows, side, index, digit, present):
    for gap in range(1, min(180, index) + 1):
        mask = mask_for(panel_for(rows[index - gap], side))
        if bool(mask & (1 << digit)) == present:
            return gap / 180
    return 1.0


def context_pair_rate(rows, side, index, lookback, predicate, min_support):
    start = max(0, index - lookback)
    n = 0
    ok = np.zeros(len(PAIRS))
    for i in range(start, index):
        if not predicate(i):
            continue
        n += 1
        mask = mask_for(panel_for(rows[i], side))
        for pair_index, pair in enumerate(PAIRS):
            if is_absent_pair(pair, mask):
                ok[pair_index] += 1
    if n < min_support:
        return np.full(len(PAIRS), 0.5)
    return ok / n


def feature_matrix_for_index(rows, side, index):
    prev = rows[index - 1] if index else None
    opp_side = "close" if side == "open" else "open"
    prev_mask = mask_for(panel_for(prev, side)) if prev else 0
    prev_opp_mask = mask_for(panel_for(prev, opp_side)) if prev else 0
    prev_sutta = sutta_for(prev, side) if prev else None
    prev_kind = panel_kind(prev_mask) if prev else -1
    today_day = rows[index]["record"].get("day")
    today_dom = rows[index]["date"].day

    digit_features = {}
    pair_features = {}
    for lookback in [5, 10, 30, 90, 180]:
        digit_rate, pair_rate, avg_sum = rolling_stats(rows, side, index, lookback)
        digit_features[f"cold_{lookback}"] = 1 - digit_rate
        digit_features[f"hot_{lookback}"] = digit_rate
        pair_features[f"pair_abs_{lookback}"] = pair_rate
        pair_features[f"sum_delta_{lookback}"] = np.full(len(PAIRS), abs(avg_sum - 13.5) / 20)

    pair_features["weekday"] = context_pair_rate(
        rows, side, index, 365, lambda i: rows[i]["record"].get("day") == today_day, 5
    )
    pair_features["dom_mod3"] = context_pair_rate(
        rows, side, index, 365, lambda i: rows[i]["date"].day % 3 == today_dom % 3, 10
    )
    pair_features["prev_sutta"] = context_pair_rate(
        rows,
        side,
        index,
        365,
        lambda i: i > 0 and sutta_for(rows[i - 1], side) == prev_sutta,
        5,
    )
    pair_features["prev_kind"] = context_pair_rate(
        rows,
        side,
        index,
        365,
        lambda i: i > 0 and panel_kind(mask_for(panel_for(rows[i - 1], side))) == prev_kind,
        8,
    )

    gap_present = np.array([gap_since(rows, side, index, d, True) for d in DIGITS])
    gap_absent = np.array([gap_since(rows, side, index, d, False) for d in DIGITS])
    in_prev = np.array([1.0 if prev_mask & (1 << d) else 0.0 for d in DIGITS])
    in_prev_opp = np.array([1.0 if prev_opp_mask & (1 << d) else 0.0 for d in DIGITS])
    opp_in_prev = np.array([1.0 if prev_mask & (1 << OPPOSITE[d]) else 0.0 for d in DIGITS])

    rows_x = []
    for pair_index, pair in enumerate(PAIRS):
        a, b = pair
        feats = [
            1.0,
            pair_index / len(PAIRS),
            abs(a - b) / 9,
            1.0 if a <= 4 and b <= 4 else 0.0,
            1.0 if a >= 5 and b >= 5 else 0.0,
            1.0 if a % 2 == b % 2 else 0.0,
            (gap_present[a] + gap_present[b]) / 2,
            (gap_absent[a] + gap_absent[b]) / 2,
            (in_prev[a] + in_prev[b]) / 2,
            (in_prev_opp[a] + in_prev_opp[b]) / 2,
            (opp_in_prev[a] + opp_in_prev[b]) / 2,
        ]
        for lookback in [5, 10, 30, 90, 180]:
            feats.extend(
                [
                    (digit_features[f"cold_{lookback}"][a] + digit_features[f"cold_{lookback}"][b]) / 2,
                    (digit_features[f"hot_{lookback}"][a] + digit_features[f"hot_{lookback}"][b]) / 2,
                    pair_features[f"pair_abs_{lookback}"][pair_index],
                    pair_features[f"sum_delta_{lookback}"][pair_index],
                ]
            )
        for name in ["weekday", "dom_mod3", "prev_sutta", "prev_kind"]:
            feats.append(pair_features[name][pair_index])
        rows_x.append(feats)
    return np.array(rows_x, dtype=float)


def standardize(train_x, test_x):
    mean = train_x.mean(axis=0)
    std = train_x.std(axis=0)
    std[std < 1e-6] = 1.0
    return (train_x - mean) / std, (test_x - mean) / std


def train_logistic(train_x, train_y, l2=0.01, epochs=220, lr=0.08):
    weights = np.zeros(train_x.shape[1], dtype=float)
    y = train_y.astype(float)
    pos = max(1.0, y.sum())
    neg = max(1.0, len(y) - y.sum())
    sample_weight = np.where(y > 0, neg / pos, 1.0)
    for _ in range(epochs):
        logits = np.clip(train_x @ weights, -30, 30)
        pred = 1 / (1 + np.exp(-logits))
        grad = train_x.T @ ((pred - y) * sample_weight) / len(y) + l2 * weights
        weights -= lr * grad
    return weights


def train_ridge(train_x, train_y, l2=1.0):
    xtx = train_x.T @ train_x
    ridge = np.eye(train_x.shape[1]) * l2
    return np.linalg.solve(xtx + ridge, train_x.T @ train_y.astype(float))


def build_dataset(rows, side, start, end):
    xs = []
    ys = []
    groups = []
    masks = []
    dates = []
    for index in range(start, end):
        x = feature_matrix_for_index(rows, side, index)
        mask = mask_for(panel_for(rows[index], side))
        y = np.array([1.0 if is_absent_pair(pair, mask) else 0.0 for pair in PAIRS])
        xs.append(x)
        ys.append(y)
        groups.append(index)
        masks.append(mask)
        dates.append(rows[index]["isoDate"])
    return np.vstack(xs), np.concatenate(ys), groups, masks, dates


def evaluate_model(weights, x, masks, dates, kind):
    correct = 0
    digit_correct = 0
    predictions = []
    total = len(masks)
    scores = x @ weights
    for row_i, mask in enumerate(masks):
        group_scores = scores[row_i * len(PAIRS) : (row_i + 1) * len(PAIRS)]
        pair_index = int(np.argmax(group_scores))
        pair = PAIRS[pair_index]
        hit = is_absent_pair(pair, mask)
        absent_digits = absent_digit_count(pair, mask)
        correct += int(hit)
        digit_correct += absent_digits
        predictions.append(
            {
                "date": dates[row_i],
                "pair": f"{pair[0]}{pair[1]}",
                "hit": bool(hit),
                "absentDigits": int(absent_digits),
                "score": float(group_scores[pair_index]),
                "kind": kind,
            }
        )
    return {
        "correct": correct,
        "digitCorrect": digit_correct,
        "total": total,
        "accuracy": correct / total if total else 0,
        "avgCorrectDigits": digit_correct / total if total else 0,
        "predictions": predictions,
    }


def pct(value):
    return f"{value * 100:.1f}%"


def compact_eval(result):
    return {
        "correct": result["correct"],
        "digitCorrect": result["digitCorrect"],
        "total": result["total"],
        "accuracy": result["accuracy"],
        "avgCorrectDigits": result["avgCorrectDigits"],
    }


def main():
    raw = json.loads((ROOT / "open-sutta-records-cache.json").read_text())
    rows_by_market = {market: dated(raw.get(market, [])) for market in MARKETS}
    methods = [
        ("ridge_l2_100", "ridge", 1.00),
        ("ridge_l2_500", "ridge", 5.00),
    ]

    rows = []
    rolling_rows = []
    for market in MARKETS:
        for side in ["open", "close"]:
            market_rows = rows_by_market[market]
            test_end = len(market_rows)
            test_start = test_end - 30
            val_end = test_start
            val_start = max(180, val_end - 60)
            train_start = max(0, val_start - 180)
            if train_start >= val_start or val_start >= val_end:
                continue
            train_x, train_y, _, _, _ = build_dataset(market_rows, side, train_start, val_start)
            val_x, _, _, val_masks, val_dates = build_dataset(market_rows, side, val_start, val_end)
            test_x, _, _, test_masks, test_dates = build_dataset(market_rows, side, test_start, test_end)
            train_xs, val_xs = standardize(train_x, val_x)
            _, test_xs = standardize(train_x, test_x)

            best = None
            for name, kind, strength in methods:
                if kind == "logistic":
                    weights = train_logistic(train_xs, train_y, l2=strength, epochs=90)
                else:
                    weights = train_ridge(train_xs, train_y, l2=strength)
                val = evaluate_model(weights, val_xs, val_masks, val_dates, name)
                score = val["accuracy"] * 1000 + val["avgCorrectDigits"] * 25
                if best is None or score > best["score"]:
                    best = {"name": name, "weights": weights, "val": val, "score": score}
            test = evaluate_model(best["weights"], test_xs, test_masks, test_dates, best["name"])
            rows.append(
                {
                    "market": market,
                    "side": side,
                    "model": best["name"],
                    "val": compact_eval(best["val"]),
                    "test": compact_eval(test),
                    "predictions": test["predictions"],
                }
            )


    def aggregate(items):
        correct = sum(item["test"]["correct"] for item in items)
        digit_correct = sum(item["test"]["digitCorrect"] for item in items)
        total = sum(item["test"]["total"] for item in items)
        return {
            "correct": correct,
            "digitCorrect": digit_correct,
            "total": total,
            "accuracy": correct / total if total else 0,
            "avgCorrectDigits": digit_correct / total if total else 0,
            "at70": sum(1 for item in items if item["test"]["accuracy"] >= 0.70),
            "at80": sum(1 for item in items if item["test"]["accuracy"] >= 0.80),
            "folds": len(items),
        }

    output = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "methodsTested": len(methods),
        "aggregate": aggregate(rows),
        "rollingAggregate": aggregate(rolling_rows),
        "rows": rows,
        "rollingRows": rolling_rows,
    }
    (ROOT / "two_digit_supervised_ranker_output.json").write_text(json.dumps(output, indent=2))

    lines = []
    lines.append("# Two-Digit Supervised Pair Ranker")
    lines.append("")
    lines.append(f"Generated: {output['generatedAt']}")
    lines.append(f"Methods tested: {output['methodsTested']}")
    lines.append("")
    lines.append("## Latest 30 Full Coverage")
    lines.append("")
    lines.append(
        f"- Strict accuracy: {pct(output['aggregate']['accuracy'])} ({output['aggregate']['correct']}/{output['aggregate']['total']})"
    )
    lines.append(f"- Average correctly eliminated digits: {output['aggregate']['avgCorrectDigits']:.2f} / 2")
    lines.append(f"- Market-sides >=70%: {output['aggregate']['at70']}/{len(rows)}")
    lines.append(f"- Market-sides >=80%: {output['aggregate']['at80']}/{len(rows)}")
    lines.append("")
    lines.append("## Rolling Forward Check")
    lines.append("")
    lines.append("- Skipped in this compact run because the uncached supervised feature builder is too slow for repeated folds.")
    lines.append("")
    lines.append("| Market | Side | Model | Val | Test | Avg Digits |")
    lines.append("|---|---|---|---:|---:|---:|")
    for item in rows:
        lines.append(
            f"| {item['market']} | {item['side']} | {item['model']} | "
            f"{pct(item['val']['accuracy'])} ({item['val']['correct']}/{item['val']['total']}) | "
            f"{pct(item['test']['accuracy'])} ({item['test']['correct']}/{item['test']['total']}) | "
            f"{item['test']['avgCorrectDigits']:.2f} |"
        )
    lines.append("")
    lines.append("## Interpretation")
    lines.append("")
    lines.append("- This is a deployable-style supervised ranker: it trains only on records before validation/test windows.")
    lines.append("- Each possible two-digit pair becomes a candidate row with frequency, context, gap, transition, house, parity, and previous-result features.")
    lines.append("- The model chooses the pair with the highest learned score for both digits being absent.")
    lines.append("- If it cannot repeatedly clear 80% strict in rolling folds, it should not be used as a live avoid-call engine.")
    (ROOT / "two_digit_supervised_ranker.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
