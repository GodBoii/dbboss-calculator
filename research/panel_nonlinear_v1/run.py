"""Refit fixed panel rankers on the frozen two-year source, without later fitting."""
from __future__ import annotations

import gzip
import hashlib
import json
import pickle
import re
import sys
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import scipy
import sklearn
from sklearn.ensemble import HistGradientBoostingClassifier
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FEATURE_DIR = ROOT / "research/panel_top10_v1"
sys.path.insert(0, str(FEATURE_DIR))
import research2 as features  # noqa: E402
from research import PANELS, PIDX  # noqa: E402

START, END = "2024-10-09", "2026-10-08"
TRAIN_END, FIT_END = "2025-12-31", "2026-07-02"
SOURCE = ROOT / "research/two_year_walkforward_v1/source-snapshot.json"
COMPARATOR = ROOT / "research/two_year_walkforward_v1/predictions.jsonl.gz"
EXPECTED_SOURCE_HASH = "7592f4b19d1135f717911a770aab6c582a733c0cbf33b2804db26b73f0d9a63c"
MODEL_NAMES = ("linear_refit", "boost_3", "boost_7")
DEPLOY_FEATURES = [name for name in features.FEATURES if not name.startswith("pool")]
DEPLOY_COLUMNS = [features.FEATURES.index(name) for name in DEPLOY_FEATURES]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_source() -> tuple[dict[str, list[tuple[str, int, int]]], list[dict[str, Any]]]:
    if digest(SOURCE) != EXPECTED_SOURCE_HASH:
        raise ValueError("The source differs from the frozen protocol snapshot")
    snapshot = json.loads(SOURCE.read_text(encoding="utf-8"))
    if (snapshot["start"], snapshot["end"]) != (START, END):
        raise ValueError("Unexpected source scope")
    by_market = {}
    expected = set()
    for market, rows in snapshot["records"].items():
        previous = ""
        parsed = []
        for index, row in enumerate(rows):
            iso = row["isoDate"]
            if not START <= iso <= END or iso <= previous:
                raise ValueError(f"Duplicate, unordered or out-of-scope date: {market}/{iso}")
            if date.fromisoformat(iso).strftime("%A") != row["day"]:
                raise ValueError(f"Calendar weekday mismatch: {market}/{iso}")
            parsed.append((iso, PIDX[row["openPanel"]], PIDX[row["closePanel"]]))
            if index >= 180:
                expected.add((market, iso))
            previous = iso
        by_market[market] = parsed
    with gzip.open(COMPARATOR, "rt", encoding="utf-8") as handle:
        ledger = [json.loads(line) for line in handle]
    actual = {(row["market"], row["date"]) for row in ledger}
    if len(actual) != len(ledger) or actual != expected:
        raise ValueError("Comparator does not cover each eligible target exactly once")
    source_lookup = {(market, iso): (o, c) for market, rows in by_market.items() for iso, o, c in rows}
    for row in ledger:
        panels = source_lookup[(row["market"], row["date"])]
        if panels != (PIDX[row["actual"]["openPanel"]], PIDX[row["actual"]["closePanel"]]):
            raise ValueError("Comparator outcomes do not match source")
    return by_market, ledger


def build_features(by_market: dict[str, list[tuple[str, int, int]]], side: str):
    # JavaScript uses double precision. Float32 can change a tied Top-10
    # boundary, so parity and candidate features use the same precision.
    x, y, meta = features.build(by_market, side, dtype=np.float64, end_date=END)
    return x[:, :, DEPLOY_COLUMNS], y, meta


def top10(scores: np.ndarray) -> np.ndarray:
    return np.argsort(-scores, axis=1, kind="stable")[:, :10]


def hits(order: np.ndarray, outcomes: np.ndarray) -> np.ndarray:
    return np.any(order == outcomes[:, None], axis=1).astype(np.int8)


def rounded_production_spec(side: str) -> dict[str, np.ndarray]:
    source = (ROOT / "src/lib/predictor/panel-top10-model.ts").read_text(encoding="utf-8")
    model = "OPEN_MODEL" if side == "open" else "CLOSE_LIVE_MODEL"
    block = re.search(rf"const {model}: LinearModel = \{{(.*?)\n\}};", source, re.S)
    if block is None:
        raise ValueError(f"Cannot read production {model}")
    arrays = {}
    for field in ("weights", "mean", "std"):
        match = re.search(rf"{field}:\s*(\[[^\]]*\])", block.group(1), re.S)
        if match is None:
            raise ValueError(f"Cannot read production {model}.{field}")
        values = np.array(json.loads(re.sub(r",\s*\]", "]", match.group(1))), dtype=float)
        if len(values) != len(DEPLOY_FEATURES) or not np.all(np.isfinite(values)):
            raise ValueError("Invalid production coefficient array")
        arrays[field] = values
    return arrays


def train_model(name: str, x: np.ndarray, y: np.ndarray):
    if name == "linear_refit":
        return features.fit(x, y, 0.001)
    if name not in MODEL_NAMES:
        raise ValueError(f"Unknown candidate {name}")
    classifier = HistGradientBoostingClassifier(
        max_leaf_nodes=int(name.rsplit("_", 1)[1]), max_iter=60,
        learning_rate=0.05, min_samples_leaf=500, l2_regularization=20,
        max_bins=64, early_stopping=False, random_state=1729,
    )
    labels = np.zeros(x.shape[:2], dtype=np.int8)
    labels[np.arange(len(y)), y] = 1
    classifier.fit(x.reshape(-1, x.shape[-1]), labels.ravel())
    return classifier


def predict(name: str, model, x: np.ndarray) -> np.ndarray:
    if name == "linear_refit":
        weights, mean, std = model
        scores = ((x - mean) / std) @ weights
    else:
        scores = model.decision_function(x.reshape(-1, x.shape[-1])).reshape(x.shape[:2])
    if not np.all(np.isfinite(scores)):
        raise ValueError("Non-finite candidate scores")
    return top10(scores)


def paired(rows: list[dict[str, Any]], side: str, iterations: int = 6000) -> dict[str, Any]:
    grouped: dict[str, list[int]] = {}
    gained = lost = production_hits = candidate_hits = 0
    for row in rows:
        value = row[side]
        p, c = value["productionHit"], value["candidateHit"]
        production_hits += p
        candidate_hits += c
        gained += int(c > p)
        lost += int(c < p)
        day = grouped.setdefault(row["date"], [0, 0])
        day[0] += 1
        day[1] += c - p
    if not rows:
        raise ValueError("Empty evaluation block")
    days = np.array(list(grouped.values()), dtype=float)
    rng = np.random.default_rng(1729)
    indices = rng.integers(len(days), size=(iterations, len(days)))
    samples = days[indices].sum(axis=1)
    samples = samples[:, 1] / samples[:, 0]
    return {
        "n": len(rows), "dates": len(days), "productionHits": production_hits,
        "candidateHits": candidate_hits, "productionRate": production_hits / len(rows),
        "candidateRate": candidate_hits / len(rows), "gained": gained, "lost": lost,
        "lift": (gained - lost) / len(rows),
        "interval95": np.quantile(samples, [0.025, 0.975]).tolist(),
        "interval975": np.quantile(samples, [0.0125, 0.9875]).tolist(),
    }


def report(results: dict[str, Any]) -> str:
    pct = lambda value: f"{100 * value:.2f}%"
    pp = lambda value: f"{100 * value:.2f} pp"
    lines = ["# Two-year nonlinear panel experiment", "",
        "Three fixed candidates were trained on the frozen two-year source. Selection used January 1 through July 2, 2026. Selected candidates were refit through July 2 and compared with the same production targets from July 3 through October 8. All dates have appeared in earlier research; this is retrospective chronological evaluation, not blind forward evidence.", "",
        "The Python deployable features reproduce the TypeScript Top-10 orders on every scored comparator target. Live Close sees only today's own Open; Open sees neither target panel. Every call contains exactly ten panels.", "",
        "| Side | Frozen model | Later production | Later candidate | Gained / lost | 97.5% paired interval | Decision |",
        "| --- | --- | ---: | ---: | ---: | --- | --- |"]
    for side, result in results["sides"].items():
        value = result["later"]
        lines.append(f"| {side} | {result['selected']} | {pct(value['productionRate'])} ({value['productionHits']}/{value['n']}) | {pct(value['candidateRate'])} ({value['candidateHits']}/{value['n']}) | {value['gained']} / {value['lost']} | {' to '.join(map(pp, value['interval975']))} | {result['decision']} |")
    lines.extend(["", "| Side | Candidate | Selection hits | Selection rate |", "| --- | --- | ---: | ---: |"])
    for side, result in results["sides"].items():
        for name, value in result["selection"].items():
            lines.append(f"| {side} | {name} | {value['hits']}/{value['n']} | {pct(value['rate'])} |")
    lines.extend(["", "| Side | Block | Production | Candidate | Difference |", "| --- | --- | ---: | ---: | ---: |"])
    for side, result in results["sides"].items():
        for name in ("septemberOctober", "recent30"):
            value = result[name]
            lines.append(f"| {side} | {name} | {pct(value['productionRate'])} | {pct(value['candidateRate'])} | {pp(value['lift'])} |")
    lines.extend(["", "| Market | Side | N | Production hits | Candidate hits |", "| --- | --- | ---: | ---: | ---: |"])
    for side, result in results["sides"].items():
        for market, value in result["perMarket"].items():
            lines.append(f"| {market} | {side} | {value['n']} | {value['productionHits']} | {value['candidateHits']} |")
    lines.extend(["", "Promotion requires a positive two-task-adjusted later interval, positive later/recent slices, and gains in at least six markets. Larger lists, market routes selected on evaluation results, and DP gate relaxation are disallowed. Binary classifier scores are used for within-event ranking only.", "",
        "Source and comparator hashes, fitted model files, the code dependencies, software versions, and the selected prediction ledger are saved with the results. No source refresh occurred. The decision concerns exact-panel accuracy, not betting return or profit.", "",
        "Reproduce with `python research/panel_nonlinear_v1/run.py`. Verify with `python research/panel_nonlinear_v1/verify.py`.", ""])
    return "\n".join(lines)


def main() -> None:
    by_market, comparator = load_source()
    lookup = {(row["market"], row["date"]): row for row in comparator}
    prediction_rows = {key: {"market": key[0], "date": key[1], "actual": row["actual"]} for key, row in lookup.items() if key[1] > FIT_END}
    results: dict[str, Any] = {"scope": {"historyStart": START, "end": END, "trainEnd": TRAIN_END, "fitEnd": FIT_END, "retrospective": True}, "sides": {}}
    HERE.mkdir(parents=True, exist_ok=True)
    for side, comparator_side in (("open", "open"), ("close", "closeLive")):
        print(f"Building {side} features", flush=True)
        x, y, meta = build_features(by_market, side)
        keep = np.array([key in lookup for key in meta])
        x, y = x[keep], y[keep]
        meta = [key for key, retained in zip(meta, keep) if retained]
        if set(meta) != set(lookup):
            raise ValueError("Feature builder did not cover every comparator event")
        spec = rounded_production_spec(side)
        production_order = top10(((x - spec["mean"]) / spec["std"]) @ spec["weights"])
        for index, key in enumerate(meta):
            expected = lookup[key]["predictions"]["production"][comparator_side]["panels"]
            if [PANELS[p] for p in production_order[index]] != expected:
                raise ValueError(f"Production feature parity failed: {side}/{key}")
        dates = np.array([key[1] for key in meta])
        training, selection, fit, later = dates <= TRAIN_END, (dates > TRAIN_END) & (dates <= FIT_END), dates <= FIT_END, dates > FIT_END
        selection_results = {}
        winner = None
        for name in MODEL_NAMES:
            print(f"Fitting {side} {name}: {int(training.sum())} initial training events", flush=True)
            model = train_model(name, x[training], y[training])
            count = int(hits(predict(name, model, x[selection]), y[selection]).sum())
            selection_results[name] = {"hits": count, "n": int(selection.sum()), "rate": count / int(selection.sum())}
            print(f"Selection {side} {name}: {count}/{int(selection.sum())}", flush=True)
            if winner is None or count > selection_results[winner]["hits"]:
                winner = name
            del model
        if winner is None:
            raise ValueError("No selected model")
        print(f"Refitting {side} winner {winner}: {int(fit.sum())} events", flush=True)
        model = train_model(winner, x[fit], y[fit])
        order = predict(winner, model, x[later])
        candidate_hits = hits(order, y[later])
        production_hits = hits(production_order[later], y[later])
        later_meta = [key for key, retained in zip(meta, later) if retained]
        for index, key in enumerate(later_meta):
            prediction_rows[key][side] = {"candidate": winner, "panels": [PANELS[p] for p in order[index]], "productionPanels": [PANELS[p] for p in production_order[later][index]], "candidateHit": int(candidate_hits[index]), "productionHit": int(production_hits[index])}
        with (HERE / f"{side}-model.pkl").open("wb") as handle:
            pickle.dump(model, handle, protocol=5)
        if winner == "linear_refit":
            weights, mean, std = model
            (HERE / f"{side}-weights.json").write_text(json.dumps({"features": DEPLOY_FEATURES, "weights": weights.tolist(), "mean": mean.tolist(), "std": std.tolist()}, indent=2) + "\n", encoding="utf-8")
        side_rows = [prediction_rows[key] for key in later_meta]
        value = {"selected": winner, "selection": selection_results, "featureParityEvents": len(meta), "later": paired(side_rows, side), "septemberOctober": paired([row for row in side_rows if row["date"] >= "2026-09-01"], side), "recent30": paired([row for row in side_rows if row["date"] >= "2026-09-09"], side), "perMarket": {market: paired([row for row in side_rows if row["market"] == market], side) for market in sorted(by_market)}}
        improving_markets = sum(row["lift"] > 0 for row in value["perMarket"].values())
        value["improvingMarkets"] = improving_markets
        value["decision"] = "QUALIFIES_FOR_RUNTIME_VALIDATION" if value["later"]["interval975"][0] > 0 and value["septemberOctober"]["lift"] > 0 and value["recent30"]["lift"] > 0 and improving_markets >= 6 else "REJECT"
        results["sides"][side] = value
        print(f"Later {side}: {json.dumps(value['later'])}; {value['decision']}", flush=True)
        del x, y, model
    ledger_path = HERE / "predictions.jsonl.gz"
    with gzip.GzipFile(filename=str(ledger_path), mode="wb", mtime=0) as handle:
        handle.write(("\n".join(json.dumps(prediction_rows[key], separators=(",", ":")) for key in sorted(prediction_rows, key=lambda key: (key[1], key[0]))) + "\n").encode())
    dependencies = [Path(__file__), HERE / "PROTOCOL.md", FEATURE_DIR / "research.py", FEATURE_DIR / "research2.py", ROOT / "src/lib/predictor/panel-top10-model.ts"]
    results["audit"] = {"sourceSHA256": digest(SOURCE), "comparatorSHA256": digest(COMPARATOR), "ledgerSHA256": digest(ledger_path), "features": DEPLOY_FEATURES, "code": {str(path.relative_to(ROOT)).replace("\\", "/"): digest(path) for path in dependencies}, "models": {side: digest(HERE / f"{side}-model.pkl") for side in results["sides"]}, "versions": {"python": sys.version, "numpy": np.__version__, "scipy": scipy.__version__, "sklearn": sklearn.__version__}}
    (HERE / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    (HERE / "REPORT.md").write_text(report(results), encoding="utf-8")


if __name__ == "__main__":
    with threadpool_limits(limits=2):
        main()
