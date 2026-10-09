"""Frozen same-market Open-to-Close feature audit. No production writes.

First: python research/dp_open_close_v1/evaluate.py --freeze-source
Then: node research/dp_open_close_v1/replay.cjs
Then: python research/dp_open_close_v1/evaluate.py
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import scipy
import sklearn
from scipy.optimize import minimize_scalar
from scipy.special import expit, logit
from sklearn.linear_model import LogisticRegression

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FIT_START, FIT_END = "2023-07-01", "2025-12-31"
END = "2026-10-08"
THRESHOLD = 0.90
MODELS = ("production", "calibrated", "with_feature", "offset_feature")
DECAY = 0.5 ** (1 / 300)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(name: str, value: object) -> None:
    (HERE / name).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def freeze_source() -> None:
    # Use the daily-slate loader, then extend with the already frozen Oct 8 source.
    sys.path.insert(0, str(HERE.parent / "dp_panel_v3"))
    import research as daily_source

    rows = {(r["date"], r["market"]): r for r in daily_source.load_rows()
            if "2016-01-01" <= r["date"] <= END}
    snapshot_path = HERE.parent / "two_year_walkforward_v1/source-snapshot.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    conflicts, supplements = [], 0
    for market, history in snapshot["records"].items():
        for item in history:
            key = (item["isoDate"], market)
            if not "2016-01-01" <= key[0] <= END:
                raise ValueError(f"Out-of-scope snapshot row {key}")
            row = {"date": key[0], "market": market,
                   "open": item["openPanel"], "close": item["closePanel"]}
            previous = rows.get(key)
            if previous and (previous["open"], previous["close"]) != (row["open"], row["close"]):
                conflicts.append({"date": key[0], "market": market,
                                  "old": [previous["open"], previous["close"]],
                                  "new": [row["open"], row["close"]]})
            supplements += previous is None
            rows[key] = row
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(["date", "market", "open", "close"])
    for key in sorted(rows):
        row = rows[key]
        for side in ("open", "close"):
            panel = row[side]
            if panel and (len(panel) != 3 or not panel.isascii() or not panel.isdigit()):
                raise ValueError(f"Invalid {side} panel at {key}")
        writer.writerow([row["date"], row["market"], row["open"] or "", row["close"] or ""])
    (HERE / "source.csv.gz").write_bytes(gzip.compress(stream.getvalue().encode(), mtime=0))
    inputs = [HERE.parent / "dp_only_v1/chart_rows.csv", HERE.parent / "dp_panel_v3/data.json", snapshot_path]
    write_json("source-audit.json", {"end": END, "rows": len(rows), "supplementedRows": supplements,
                                    "conflicts": conflicts, "conflictPolicy": "later frozen snapshot wins",
                                    "sourceHash": digest(HERE / "source.csv.gz"),
                                    "inputHashes": {p.relative_to(ROOT).as_posix(): digest(p) for p in inputs}})
    print(f"Frozen {len(rows)} rows, {supplements} supplements, {len(conflicts)} changed rows")


def load_source() -> list[dict]:
    with gzip.open(HERE / "source.csv.gz", "rt", encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    keys = set()
    for row in rows:
        key = (row["date"], row["market"])
        if key in keys or not "2016-01-01" <= row["date"] <= END:
            raise ValueError(f"Duplicate or out-of-scope source {key}")
        keys.add(key)
        for side in ("open", "close"):
            p = row[side]
            if p and (len(p) != 3 or not p.isascii() or not p.isdigit()):
                raise ValueError(f"Invalid panel at {key}")
    return sorted(rows, key=lambda r: (r["date"], r["market"]))


def is_dp(panel: str) -> bool:
    return len(set(panel)) == 2


def study_features(rows: list[dict]) -> dict[tuple[str, str], dict]:
    """The study's k_cond, computed before consuming the target Close."""
    tables = defaultdict(lambda: np.ones((2, 2), dtype=float))
    base = defaultdict(lambda: [0.0, 0.0])
    features = {}
    for row in rows:
        if date.fromisoformat(row["date"]).weekday() >= 5:
            continue
        market, op, cl = row["market"], row["open"], row["close"]
        dp, n = base[market]
        p_base = (dp + 0.25) / (n + 1)
        conditional, count, delta = None, 0, 0.0
        if op:
            cell = tables[market][int(is_dp(op))]
            conditional = float(cell[1] / cell.sum())
            count = int(cell.sum() - 2)
            delta = float(logit(np.clip(conditional, 1e-4, 1 - 1e-4)) -
                          logit(np.clip(p_base, 1e-4, 1 - 1e-4)))
        features[(row["date"], market)] = {"feature": delta, "conditional": conditional,
                                          "priorSupport": count, "studyBase": p_base}
        # No feature above can access today's Close. Weekends never update this state.
        if cl:
            base[market] = [dp * DECAY + int(is_dp(cl)), n * DECAY + 1]
            if op:
                tables[market][int(is_dp(op)), int(is_dp(cl))] += 1
    return features


def wilson(hits: int, n: int) -> list[float] | None:
    if not n:
        return None
    z = 1.959963984540054
    p = hits / n
    denominator = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
    return [center - half, center + half]


def selective(y: np.ndarray, calls: np.ndarray) -> dict:
    count, hits = int(calls.sum()), int(y[calls].sum())
    return {"calls": count, "hits": hits, "precision": hits / count if count else None,
            "precisionWilson95": wilson(hits, count), "coverage": count / len(y),
            "recall": hits / float(y.sum()) if y.sum() else None, "falseCalls": count - hits}


def losses(y: np.ndarray, p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return (p - y) ** 2, -y * np.log(p) - (1 - y) * np.log(1 - p)


def metrics(rows: list[dict], model: str) -> dict:
    y = np.array([r["actualDp"] for r in rows], dtype=float)
    p = np.array([r[model] for r in rows])
    brier, ll = losses(y, p)
    bins, ece = [], 0.0
    for i in range(10):
        keep = np.minimum((p * 10).astype(int), 9) == i
        n = int(keep.sum())
        forecast = float(p[keep].mean()) if n else None
        observed = float(y[keep].mean()) if n else None
        if n:
            ece += n / len(y) * abs(forecast - observed)
        bins.append({"lower": i / 10, "upper": (i + 1) / 10, "n": n,
                     "meanForecast": forecast, "observed": observed})
    return {"n": len(y), "actualDp": int(y.sum()), "observed": float(y.mean()),
            "meanForecast": float(p.mean()), "calibrationBias": float((p - y).mean()),
            "brier": float(brier.mean()), "logLoss": float(ll.mean()), "ece10": ece,
            "maxProbability": float(p.max()), "calibrationBins": bins,
            "at90": selective(y, p >= THRESHOLD)}


def paired_interval(rows: list[dict], reference: str, candidate: str) -> dict:
    groups = defaultdict(list)
    for row in rows:
        y = float(row["actualDp"])
        a = losses(np.array([y]), np.array([row[reference]]))
        b = losses(np.array([y]), np.array([row[candidate]]))
        groups[row["date"]].append([float(a[0][0] - b[0][0]), float(a[1][0] - b[1][0])])
    sums = np.array([np.sum(group, axis=0) for group in groups.values()])
    ns = np.array([len(group) for group in groups.values()])
    rng = np.random.default_rng(1729)
    indices = rng.integers(0, len(ns), size=(3000, len(ns)))
    boot = sums[indices].sum(axis=1) / ns[indices].sum(axis=1)[:, None]
    return {"reference": reference, "candidate": candidate, "dates": len(ns),
            "brierGain": float(sums[:, 0].sum() / len(rows)),
            "brierGain95": np.quantile(boot[:, 0], [0.025, 0.975]).tolist(),
            "logLossGain": float(sums[:, 1].sum() / len(rows)),
            "logLossGain95": np.quantile(boot[:, 1], [0.025, 0.975]).tolist()}


def block(rows: list[dict]) -> dict:
    if not rows:
        return {"n": 0}
    y = np.array([r["actualDp"] for r in rows], dtype=float)
    return {"n": len(rows), "start": min(r["date"] for r in rows), "end": max(r["date"] for r in rows),
            "dates": len({r["date"] for r in rows}), "models": {m: metrics(rows, m) for m in MODELS},
            "legacyKindCalls": selective(y, np.array([r["legacyKindCall"] for r in rows])),
            "verifiedGate": selective(y, np.zeros(len(rows), dtype=bool)),
            "comparisons": [paired_interval(rows, "production", "with_feature"),
                            paired_interval(rows, "calibrated", "with_feature"),
                            paired_interval(rows, "production", "offset_feature")]}


def evaluate() -> None:
    source = load_source()
    audit = json.loads((HERE / "source-audit.json").read_text(encoding="utf-8"))
    if audit["sourceHash"] != digest(HERE / "source.csv.gz"):
        raise ValueError("Source hash differs from frozen audit")
    features = study_features(source)
    with gzip.open(HERE / "production.jsonl.gz", "rt", encoding="utf-8") as stream:
        rows = [json.loads(line) for line in stream]
    markets = sorted({row["market"] for row in rows})
    source_by_key = {(r["date"], r["market"]): r for r in source}
    for row in rows:
        source_row = source_by_key[(row["date"], row["market"])]
        if (row["open"], row["close"]) != (source_row["open"], source_row["close"]):
            raise ValueError("Production/source mismatch")
        if not FIT_START <= row["date"] <= END or date.fromisoformat(row["date"]).weekday() >= 5:
            raise ValueError("Production row outside protocol")
        if not 0 < row["raw"] < 1 or row["verifiedCall"]:
            raise ValueError("Invalid production probability or changed verified gate")
        row.update(features[(row["date"], row["market"])])
        row["production"] = row["raw"]
    X = np.array([[float(logit(r["raw"]))] + [float(r["market"] == m) for m in markets] for r in rows])
    delta = np.array([r["feature"] for r in rows])
    y = np.array([r["actualDp"] for r in rows], dtype=float)
    fit = np.array([r["date"] <= FIT_END for r in rows])
    baseline = LogisticRegression(C=1, fit_intercept=False, solver="lbfgs", max_iter=2000, tol=1e-10)
    challenger = LogisticRegression(C=1, fit_intercept=False, solver="lbfgs", max_iter=2000, tol=1e-10)
    baseline.fit(X[fit], y[fit])
    Xa = np.column_stack([X, delta])
    challenger.fit(Xa[fit], y[fit])
    raw_logit = X[:, 0]

    def offset_loss(beta: float) -> float:
        p = expit(raw_logit[fit] + beta * delta[fit])
        return float(losses(y[fit], p)[1].mean() + beta * beta / (2 * fit.sum()))

    offset = minimize_scalar(offset_loss, bounds=(-3, 3), method="bounded", options={"xatol": 1e-10})
    if not offset.success or np.any(baseline.n_iter_ >= 2000) or np.any(challenger.n_iter_ >= 2000):
        raise RuntimeError("Fit did not converge")
    predictions = {"calibrated": baseline.predict_proba(X)[:, 1],
                   "with_feature": challenger.predict_proba(Xa)[:, 1],
                   "offset_feature": expit(raw_logit + offset.x * delta)}
    for i, row in enumerate(rows):
        for model, values in predictions.items():
            row[model] = float(values[i])
    test = [r for r in rows if r["date"] > FIT_END]
    live = [r for r in test if r["open"]]
    blocks = {"retrospective2026": [r for r in live if r["date"] <= "2026-10-01"],
              "postStudy": [r for r in live if r["date"] >= "2026-10-02"],
              "all2026": live, "allIncludingMissingOpen": test,
              "missingOpen": [r for r in test if not r["open"]]}
    for days in (30, 90):
        start = (date.fromisoformat(END) - timedelta(days=days - 1)).isoformat()
        blocks[f"last{days}"] = [r for r in live if r["date"] >= start]
    market_results = {m: {model: metrics([r for r in live if r["market"] == m], model)
                          for model in MODELS} for m in markets}
    months = sorted({r["date"][:7] for r in live})
    month_results = {m: {model: metrics([r for r in live if r["date"].startswith(m)], model)
                         for model in MODELS} for m in months}
    conditional = {}
    for market in markets:
        conditional[market] = {}
        for dp_open in (False, True):
            selected = [r for r in live if r["market"] == market and is_dp(r["open"]) == dp_open]
            hits = sum(r["actualDp"] for r in selected)
            conditional[market]["dpOpen" if dp_open else "nonDpOpen"] = {
                "n": len(selected), "hits": hits, "observed": hits / len(selected),
                "wilson95": wilson(hits, len(selected))}
    fit_market = {m: {"n": sum(r["date"] <= FIT_END and r["market"] == m for r in rows),
                      "start": min(r["date"] for r in rows if r["date"] <= FIT_END and r["market"] == m),
                      "end": max(r["date"] for r in rows if r["date"] <= FIT_END and r["market"] == m)}
                  for m in markets}
    result = {"threshold": THRESHOLD, "fit": {"start": FIT_START, "end": FIT_END, "n": int(fit.sum()), "byMarket": fit_market},
              "versions": {"numpy": np.__version__, "scipy": scipy.__version__, "sklearn": sklearn.__version__},
              "hashes": {name: digest(HERE / name) for name in ("source.csv.gz", "production.jsonl.gz", "evaluate.py", "replay.cjs", "PROTOCOL.md")},
              "models": {"columns": ["rawLogit"] + markets, "calibrated": baseline.coef_[0].tolist(),
                         "withFeature": challenger.coef_[0].tolist(), "offsetFeatureCoefficient": float(offset.x),
                         "feature": "daily_slate_v1 k_cond", "C": 1},
              "blocks": {name: block(part) for name, part in blocks.items()},
              "byMarket": market_results, "byMonth": month_results, "openConditionalRates": conditional}
    write_json("results.json", result)
    payload = "".join(json.dumps(r, allow_nan=False) + "\n" for r in rows).encode()
    (HERE / "predictions.jsonl.gz").write_bytes(gzip.compress(payload, mtime=0))
    for name, values in result["blocks"].items():
        if values["n"]:
            print(name, values["n"], {m: {k: values["models"][m][k] for k in ("brier", "logLoss", "meanForecast", "at90")} for m in MODELS})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--freeze-source", action="store_true")
    args = parser.parse_args()
    if args.freeze_source:
        freeze_source()
    else:
        evaluate()
