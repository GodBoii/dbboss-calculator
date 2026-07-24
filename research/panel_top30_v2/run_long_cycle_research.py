"""Causal long-calendar-cycle and same-day event hypothesis search."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "run_research.py"
EXTENDED_RUNNER = HERE / "run_extended_research.py"
EVENT_RUNNER = HERE / "run_panel_event_sequence.py"
OUTPUT = HERE / "long_cycle_results.json"
REPORT = HERE / "LONG_CYCLE_REPORT.md"
LEDGER = HERE / "long_cycle_ledger.json"
CALENDAR_LAGS = (7, 14, 21, 28, 35, 56, 91, 182, 364)
ROW_LAGS = (5, 10, 20, 40, 80, 160, 260)
WEIGHTS = (0.25, 0.5, 1.0)
TASKS = ("open", "close")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


B = load_module("long_cycle_base", BASE_PATH)
E = load_module("long_cycle_extended", EXTENDED_RUNNER)
T = load_module("long_cycle_timing", EVENT_RUNNER)


def increment_profile(state: dict[str, Any], panel_id: int) -> None:
    digits = B.PANEL_DIGITS[panel_id]
    state["panel"][panel_id] += 1
    for position in range(3):
        state["position"][position, digits[position]] += 1
    state["pair"][0, digits[0] * 10 + digits[1]] += 1
    state["pair"][1, digits[0] * 10 + digits[2]] += 1
    state["pair"][2, digits[1] * 10 + digits[2]] += 1
    state["sutta"][B.PANEL_SUTTA[panel_id]] += 1
    state["kind"][B.PANEL_KIND[panel_id]] += 1


def empty_profile() -> dict[str, Any]:
    return {
        "panel": np.zeros(len(B.PANELS), dtype=np.float32),
        "position": np.zeros((3, 10), dtype=np.float32),
        "pair": np.zeros((3, 100), dtype=np.float32),
        "sutta": np.zeros(10, dtype=np.float32),
        "kind": np.zeros(2, dtype=np.float32),
    }


def profile_score(state: dict[str, Any]) -> np.ndarray:
    digits = B.PANEL_DIGITS
    position = sum(np.log(state["position"][pos, digits[:, pos]] + 2.0) for pos in range(3))
    pair = (
        np.log(state["pair"][0, digits[:, 0] * 10 + digits[:, 1]] + 1.0)
        + np.log(state["pair"][1, digits[:, 0] * 10 + digits[:, 2]] + 1.0)
        + np.log(state["pair"][2, digits[:, 1] * 10 + digits[:, 2]] + 1.0)
    )
    return (
        np.log(state["panel"] + 1.5) + 0.45 * position + 0.25 * pair
        + 0.25 * np.log(state["sutta"][B.PANEL_SUTTA] + 2.0)
        + 0.20 * np.log(state["kind"][B.PANEL_KIND] + 2.0)
    ).astype(np.float32)


def direct_features(panel_id: int) -> dict[str, np.ndarray]:
    overlap, opposite = B.relation_features(panel_id)
    exact = np.zeros(len(B.PANELS), dtype=np.float32)
    exact[panel_id] = 1.0
    same_sutta = (B.PANEL_SUTTA == B.PANEL_SUTTA[panel_id]).astype(np.float32)
    opposite_sutta = (B.PANEL_SUTTA == (B.PANEL_SUTTA[panel_id] + 5) % 10).astype(np.float32)
    return {"exact": exact, "overlap": overlap, "opposite": opposite,
            "sameSutta": same_sutta, "oppositeSutta": opposite_sutta}


def phase_for(target_date: date, market: str, cutoffs: dict[str, date]) -> str | None:
    if target_date <= B.TRAIN_END:
        return "train"
    if target_date <= B.EARLY_END:
        return "early"
    if target_date <= B.SELECT_END:
        return "select"
    if target_date <= cutoffs[market]:
        return "terminal"
    return "forward"


def candidate_names() -> list[str]:
    names = ["profile"]
    for lag_type, lags in (("calendar", CALENDAR_LAGS), ("row", ROW_LAGS)):
        for lag in lags:
            for relation in ("exact", "overlap", "opposite", "sameSutta", "oppositeSutta"):
                for weight in WEIGHTS:
                    names.append(f"{lag_type}{lag}:{relation}:w{weight:g}")
    for relation in ("exact", "overlap", "opposite", "sameSutta", "oppositeSutta"):
        for weight in WEIGHTS:
            names.append(f"sameDayAll:{relation}:w{weight:g}")
    names.extend(["calendarConsensus", "rowConsensus", "sameDayConsensus", "allConsensus"])
    return names


NAMES = candidate_names()


def score_candidates(
    base: np.ndarray, row_history: list[Any], by_date: dict[date, Any], target: Any,
    same_day_sources: list[Any],
) -> dict[str, np.ndarray]:
    scores = {"profile": base}
    calendar_parts = []
    row_parts = []
    same_day_parts = []
    for lag in CALENDAR_LAGS:
        source = by_date.get(target.iso_date - timedelta(days=lag))
        if source is None:
            continue
        panel_id = source[0]
        features = direct_features(panel_id)
        calendar_parts.append(features["overlap"] + 0.5 * features["sameSutta"])
        for relation, feature in features.items():
            for weight in WEIGHTS:
                scores[f"calendar{lag}:{relation}:w{weight:g}"] = base + weight * feature
    for lag in ROW_LAGS:
        if len(row_history) < lag:
            continue
        panel_id = row_history[-lag][0]
        features = direct_features(panel_id)
        row_parts.append(features["overlap"] + 0.5 * features["sameSutta"])
        for relation, feature in features.items():
            for weight in WEIGHTS:
                scores[f"row{lag}:{relation}:w{weight:g}"] = base + weight * feature
    aggregate = {key: np.zeros(len(B.PANELS), dtype=np.float32) for key in
                 ("exact", "overlap", "opposite", "sameSutta", "oppositeSutta")}
    for source in same_day_sources:
        for panel_id in (source.open_panel, source.close_panel):
            features = direct_features(panel_id)
            for relation, feature in features.items():
                aggregate[relation] += feature
            same_day_parts.append(features["overlap"] + 0.5 * features["sameSutta"])
    if same_day_sources:
        scale = max(1, 2 * len(same_day_sources))
        for relation, feature in aggregate.items():
            for weight in WEIGHTS:
                scores[f"sameDayAll:{relation}:w{weight:g}"] = base + weight * feature / scale
    if calendar_parts:
        scores["calendarConsensus"] = base + 0.25 * np.mean(calendar_parts, axis=0)
    if row_parts:
        scores["rowConsensus"] = base + 0.25 * np.mean(row_parts, axis=0)
    if same_day_parts:
        scores["sameDayConsensus"] = base + 0.25 * np.mean(same_day_parts, axis=0)
    all_parts = calendar_parts + row_parts + same_day_parts
    if all_parts:
        scores["allConsensus"] = base + 0.25 * np.mean(all_parts, axis=0)
    return scores


def evaluate() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    base_rows, base_audit = B.load_rows()
    cutoffs = {market: values[-1].iso_date for market, values in base_rows.items()}
    market_names = list(base_rows)
    market_index = {market: index for index, market in enumerate(market_names)}
    rows_by_market, source_audit = E.load_extended_rows()
    date_maps = {market: {row.iso_date: row for row in rows} for market, rows in rows_by_market.items()}
    metrics = {task: {phase: {name: [0, 0] for name in NAMES}
                      for phase in ("early", "select", "terminal", "forward")}
               for task in TASKS}
    prediction_store: dict[tuple[str, str, str, str], list[str]] = {}

    for market in market_names:
        rows = rows_by_market[market]
        for task in TASKS:
            side = "open_panel" if task == "open" else "close_panel"
            state = empty_profile()
            history: list[tuple[int, Any]] = []
            by_date: dict[date, tuple[int, Any]] = {}
            for target in rows:
                panel_id = getattr(target, side)
                phase = phase_for(target.iso_date, market, cutoffs)
                if target.iso_date >= date(2024, 7, 1) and phase in metrics[task] and history:
                    base_score = profile_score(state)
                    same_day_sources = []
                    cutoff_minute = T.OPEN_MINUTE[market]
                    for source_market in market_names:
                        if source_market == market or T.CLOSE_MINUTE[source_market] >= cutoff_minute:
                            continue
                        source = date_maps[source_market].get(target.iso_date)
                        if source is not None:
                            same_day_sources.append(source)
                    scores = score_candidates(base_score, history, by_date, target, same_day_sources)
                    for name in NAMES:
                        ranking_scores = scores.get(name, base_score)
                        top = np.argpartition(ranking_scores, -B.TOP_K)[-B.TOP_K:]
                        metrics[task][phase][name][1] += 1
                        if panel_id in top:
                            metrics[task][phase][name][0] += 1
                        if phase in ("terminal", "forward"):
                            ordered = top[np.argsort(-ranking_scores[top])]
                            prediction_store[(task, phase, market, target.iso_date.isoformat(), name)] = [
                                B.PANELS[int(value)] for value in ordered
                            ]
                increment_profile(state, panel_id)
                history.append((panel_id, target))
                by_date[target.iso_date] = (panel_id, target)

    tasks = {}
    ledger = []
    previous = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    for task in TASKS:
        base_early = metrics[task]["early"]["profile"]
        base_early_rate = base_early[0] / base_early[1]
        candidates = []
        for name in NAMES:
            early_hits, early_n = metrics[task]["early"][name]
            select_hits, select_n = metrics[task]["select"][name]
            early_rate = early_hits / early_n
            select_rate = select_hits / select_n
            candidates.append({
                "name": name, "early": {"hits": early_hits, "n": early_n, "rate": early_rate},
                "selection": {"hits": select_hits, "n": select_n, "rate": select_rate},
                "eligible": early_rate >= base_early_rate - 0.005,
            })
        eligible = [row for row in candidates if row["eligible"]]
        eligible.sort(key=lambda row: (row["selection"]["rate"], row["early"]["rate"]), reverse=True)
        selected = eligible[0]
        name = selected["name"]
        phase_results = {}
        for phase in ("terminal", "forward"):
            hits, n = metrics[task][phase][name]
            low, high = B.wilson(hits, n)
            phase_results[phase] = {"hits": hits, "n": n, "rate": hits / n, "wilson95": [low, high]}
        previous_key = "open" if task == "open" else "close_preopen"
        previous_task = previous["tasks"][previous_key]
        previous_name = previous_task["chosenModel"]
        tasks[task] = {
            "selected": selected,
            "candidates": sorted(candidates, key=lambda row: row["selection"]["rate"], reverse=True),
            **phase_results,
            "previous": {
                "terminal": previous_task["holdout"][previous_name]["top30"],
                "forward": previous_task["prospectiveForward"][previous_name]["top30"],
            },
            "target90": phase_results["terminal"]["rate"] >= 0.90 and phase_results["forward"]["rate"] >= 0.90,
        }
        for phase in ("terminal", "forward"):
            for key, panels in prediction_store.items():
                key_task, key_phase, market, raw_date, key_name = key
                if key_task != task or key_phase != phase or key_name != name:
                    continue
                actual_row = date_maps[market][date.fromisoformat(raw_date)]
                actual = B.PANELS[getattr(actual_row, "open_panel" if task == "open" else "close_panel")]
                ledger.append({"task": task, "phase": phase, "market": market, "date": raw_date,
                               "model": name, "actual": actual, "top30": panels, "hit": actual in panels})
    payload = {
        "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(),
        "productionFilesModified": False,
        "sourceAudit": source_audit,
        "trustedCacheSha256": base_audit["sha256"],
        "design": {
            "calendarLagsDays": CALENDAR_LAGS, "rowLags": ROW_LAGS,
            "weights": WEIGHTS, "candidateCount": len(NAMES),
            "sameDayInvariant": "source Close minute < target Open minute",
        },
        "tasks": tasks,
    }
    return payload, ledger


def main() -> None:
    payload, ledger = evaluate()
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")

    def pct(value: float) -> str:
        return f"{100 * value:.2f}%"

    lines = [
        "# Long-cycle and same-day panel research", "",
        f"Candidates per side: {payload['design']['candidateCount']}; all same-day inputs satisfy "
        "`source Close < target Open`.", "",
        "| Side | Selected | Terminal | Previous | Forward | Previous forward | 90% |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for task, row in payload["tasks"].items():
        lines.append(
            f"| {task} | {row['selected']['name']} | {row['terminal']['hits']}/{row['terminal']['n']} "
            f"({pct(row['terminal']['rate'])}) | {pct(row['previous']['terminal']['rate'])} | "
            f"{row['forward']['hits']}/{row['forward']['n']} ({pct(row['forward']['rate'])}) | "
            f"{pct(row['previous']['forward']['rate'])} | {'yes' if row['target90'] else 'no'} |"
        )
    for task, row in payload["tasks"].items():
        lines.extend(["", f"## {task} selection leaders", "", "| Candidate | Early | Selection | Eligible |",
                      "|---|---:|---:|---:|"])
        for candidate in row["candidates"][:20]:
            lines.append(
                f"| {candidate['name']} | {pct(candidate['early']['rate'])} | "
                f"{pct(candidate['selection']['rate'])} | {'yes' if candidate['eligible'] else 'no'} |"
            )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} and {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
