"""Extended-history exact-panel Top-30 experiment.

Uses 2013-2026 history where available, drops three non-canonical source rows,
and preserves the v2 chronological model-selection and holdout boundaries.
"""

from __future__ import annotations

import gc
import hashlib
import importlib.util
import json
import math
import sys
from dataclasses import asdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "run_research.py"
EXTENDED = HERE / "extended_records.json"
AUDIT = HERE / "extended_audit.json"
OUTPUT = HERE / "extended_results.json"
REPORT = HERE / "EXTENDED_REPORT.md"
LEDGER = HERE / "extended_ledger.json"
MODELS = HERE / "models_extended"
MIN_TARGET_DATE = date(2022, 1, 1)
WINDOWS: tuple[int | None, ...] = (180, 365, 730, None)
TASKS = ("open", "close_preopen")
CONFIG_NAMES = {
    "dynamic_wd01", "additive_wd01", "dynamic_top30", "additive_top30",
}


def load_base():
    spec = importlib.util.spec_from_file_location("panel_top30_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


B = load_base()
CONFIGS = tuple(config for config in B.CONFIGS if config.name in CONFIG_NAMES)


def load_extended_rows() -> tuple[dict[str, list[Any]], dict[str, Any]]:
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    if not audit.get("safeAfterDroppingInvalidRows"):
        raise RuntimeError("Extended reconciliation has not passed its filtered safety gate")
    raw_bytes = EXTENDED.read_bytes()
    payload = json.loads(raw_bytes)
    rows: dict[str, list[Any]] = {}
    dropped = []
    for market, records in payload["extended"].items():
        values = []
        seen = set()
        for record in records:
            try:
                target_date = B.parse_record_date(record)
                open_panel = B.PANEL_TO_ID[record["openPanel"]]
                close_panel = B.PANEL_TO_ID[record["closePanel"]]
            except (KeyError, TypeError, ValueError):
                dropped.append({
                    "market": market, "dateRangeStart": record.get("dateRangeStart"),
                    "day": record.get("day"), "openPanel": record.get("openPanel"),
                    "closePanel": record.get("closePanel"),
                })
                continue
            if target_date in seen:
                continue
            seen.add(target_date)
            values.append(B.Row(market, target_date, target_date.weekday(), open_panel, close_panel))
        rows[market] = sorted(values, key=lambda row: row.iso_date)
    return rows, {
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "rowsAfterFiltering": sum(len(values) for values in rows.values()),
        "droppedNonCanonical": dropped,
        "marketRows": {market: len(values) for market, values in rows.items()},
    }


def split_indices(dataset, market_names: list[str], cutoffs: dict[str, date]) -> dict[str, np.ndarray]:
    parsed = np.asarray([date.fromisoformat(str(value)) for value in dataset.dates])
    train = np.flatnonzero(parsed <= B.TRAIN_END)
    early = np.flatnonzero((parsed > B.TRAIN_END) & (parsed <= B.EARLY_END))
    select = np.flatnonzero((parsed > B.EARLY_END) & (parsed <= B.SELECT_END))
    terminal = np.asarray([
        index for index, (raw_date, market_id) in enumerate(zip(parsed, dataset.markets))
        if raw_date > B.SELECT_END and raw_date <= cutoffs[market_names[int(market_id)]]
    ], dtype=np.int64)
    forward = np.asarray([
        index for index, (raw_date, market_id) in enumerate(zip(parsed, dataset.markets))
        if raw_date > cutoffs[market_names[int(market_id)]]
    ], dtype=np.int64)
    cache_all = np.asarray([
        index for index, (raw_date, market_id) in enumerate(zip(parsed, dataset.markets))
        if raw_date <= cutoffs[market_names[int(market_id)]]
    ], dtype=np.int64)
    return {"train": train, "early": early, "select": select, "terminal": terminal, "forward": forward, "cacheAll": cache_all}


def pct(value: float) -> str:
    return f"{100 * value:.2f}%"


def main() -> None:
    B.seed_all()
    base_rows, base_audit = B.load_rows()
    cutoffs = {market: rows[-1].iso_date for market, rows in base_rows.items()}
    market_names = list(base_rows)
    rows, source_audit = load_extended_rows()
    previous = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    tasks: dict[str, Any] = {}
    all_ledgers = []

    for task in TASKS:
        trials = []
        print(f"\n{task}: history-window search", flush=True)
        for window in WINDOWS:
            window_name = "lifetime" if window is None else str(window)
            print(f"  building window={window_name}", flush=True)
            dataset = B.build_dataset(task, rows, min_target_date=MIN_TARGET_DATE, history_window=window)
            indices = split_indices(dataset, market_names, cutoffs)
            profile_early = B.quick_metric(dataset.profile_scores[indices["early"]], dataset.labels[indices["early"]])
            profile_select = B.quick_metric(dataset.profile_scores[indices["select"]], dataset.labels[indices["select"]])
            hot_early = B.quick_metric(dataset.hot_scores[indices["early"]], dataset.labels[indices["early"]])
            hot_select = B.quick_metric(dataset.hot_scores[indices["select"]], dataset.labels[indices["select"]])
            trials.extend([
                {"window": window_name, "model": "profile", "config": None, "bestEpoch": 0,
                 "earlyTop30": profile_early, "selectionTop30": profile_select},
                {"window": window_name, "model": "hot", "config": None, "bestEpoch": 0,
                 "earlyTop30": hot_early, "selectionTop30": hot_select},
            ])
            for config in CONFIGS:
                print(f"    {config.name}", flush=True)
                model, epoch, history = B.train_model(dataset, config, indices["train"], indices["early"])
                early_scores = B.logits_for(model, dataset, indices["early"])
                select_scores = B.logits_for(model, dataset, indices["select"])
                trials.append({
                    "window": window_name, "model": config.name, "config": asdict(config),
                    "bestEpoch": epoch, "epochsRun": len(history),
                    "earlyTop30": B.quick_metric(early_scores, dataset.labels[indices["early"]]),
                    "selectionTop30": B.quick_metric(select_scores, dataset.labels[indices["select"]]),
                })
                del model, early_scores, select_scores
            del dataset
            gc.collect()

        best_early_profile = max(row["earlyTop30"] for row in trials if row["model"] == "profile")
        eligible = [row for row in trials if row["earlyTop30"] >= best_early_profile - 0.005]
        eligible.sort(key=lambda row: (row["selectionTop30"], row["earlyTop30"]), reverse=True)
        selected = eligible[0]
        selected_window = None if selected["window"] == "lifetime" else int(selected["window"])
        print(f"  selected {selected['model']} window={selected['window']}", flush=True)

        dataset = B.build_dataset(task, rows, min_target_date=MIN_TARGET_DATE, history_window=selected_window)
        indices = split_indices(dataset, market_names, cutoffs)
        if selected["config"] is None:
            terminal_scores = (
                dataset.profile_scores[indices["terminal"]]
                if selected["model"] == "profile" else dataset.hot_scores[indices["terminal"]]
            )
            forward_scores = (
                dataset.profile_scores[indices["forward"]]
                if selected["model"] == "profile" else dataset.hot_scores[indices["forward"]]
            )
            artifact = None
        else:
            config = B.Config(**selected["config"])
            preterminal = np.concatenate([indices["train"], indices["early"], indices["select"]])
            terminal_model, _, _ = B.train_model(
                dataset, config, preterminal, None, fixed_epochs=selected["bestEpoch"]
            )
            terminal_scores = B.logits_for(terminal_model, dataset, indices["terminal"])
            research_model, _, _ = B.train_model(
                dataset, config, indices["cacheAll"], None, fixed_epochs=selected["bestEpoch"]
            )
            forward_scores = B.logits_for(research_model, dataset, indices["forward"])
            MODELS.mkdir(parents=True, exist_ok=True)
            model_path = MODELS / f"{task}.pt"
            torch.save({
                "researchOnly": True, "extendedHistory": True, "task": task,
                "historyWindow": selected["window"], "minimumTargetDate": MIN_TARGET_DATE.isoformat(),
                "config": selected["config"], "fixedEpochs": selected["bestEpoch"],
                "stateDict": research_model.state_dict(), "contextCards": dataset.context_cards,
                "featureNames": dataset.feature_names, "marketNames": market_names,
                "panels": B.PANELS, "sourceSha256": source_audit["sha256"], "seed": B.SEED,
            }, model_path)
            artifact = {
                "path": str(model_path.relative_to(ROOT)),
                "sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
            }

        terminal_metrics = B.metrics(terminal_scores, dataset, indices["terminal"], market_names)
        forward_metrics = B.metrics(forward_scores, dataset, indices["forward"], market_names)
        terminal_top = np.argsort(-terminal_scores, axis=1)[:, :B.TOP_K]
        forward_top = np.argsort(-forward_scores, axis=1)[:, :B.TOP_K]
        for split, target_indices, top in (
            ("terminal", indices["terminal"], terminal_top),
            ("forward", indices["forward"], forward_top),
        ):
            for local, global_index in enumerate(target_indices):
                all_ledgers.append({
                    "task": task, "split": split, "date": str(dataset.dates[global_index]),
                    "market": market_names[int(dataset.markets[global_index])],
                    "actual": B.PANELS[int(dataset.labels[global_index])],
                    "top30": [B.PANELS[int(panel)] for panel in top[local]],
                })
        previous_task = previous["tasks"][task]
        previous_chosen = previous_task["chosenModel"]
        tasks[task] = {
            "trials": sorted(trials, key=lambda row: row["selectionTop30"], reverse=True),
            "selectionGate": {"bestEarlyProfile": best_early_profile, "tolerance": 0.005},
            "selected": selected,
            "splitSizes": {key: int(len(value)) for key, value in indices.items()},
            "terminal": terminal_metrics,
            "forward": forward_metrics,
            "previousTwoYear": {
                "terminalTop30": previous_task["holdout"][previous_chosen]["top30"],
                "forwardTop30": previous_task["prospectiveForward"][previous_chosen]["top30"],
            },
            "artifact": artifact,
            "target90": {
                "terminalAchieved": terminal_metrics["top30"]["rate"] >= 0.90,
                "forwardAchieved": forward_metrics["top30"]["rate"] >= 0.90,
                "terminalRequiredHits": math.ceil(0.90 * terminal_metrics["n"]),
                "forwardRequiredHits": math.ceil(0.90 * forward_metrics["n"]),
            },
        }
        del dataset
        gc.collect()

    payload = {
        "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(),
        "objective": "90% exact-panel Top-30 Open and Close accuracy",
        "productionFilesModified": False,
        "sourceAudit": source_audit,
        "trustedCacheSha256": base_audit["sha256"],
        "design": {
            "minTargetDate": MIN_TARGET_DATE.isoformat(),
            "historyWindows": ["lifetime" if value is None else value for value in WINDOWS],
            "trainEnd": B.TRAIN_END.isoformat(), "earlyEnd": B.EARLY_END.isoformat(),
            "selectionEnd": B.SELECT_END.isoformat(),
        },
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    LEDGER.write_text(json.dumps(all_ledgers, indent=2), encoding="utf-8")

    lines = [
        "# Extended-history Top-30 research",
        "",
        f"Source rows after filtering: {source_audit['rowsAfterFiltering']:,}; source SHA-256: `{source_audit['sha256']}`.",
        "",
        "| Task | Selected model | Window | Terminal Top-30 | Prior two-year | Forward Top-30 | Prior forward | 90% |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for task, row in tasks.items():
        lines.append(
            f"| {task} | {row['selected']['model']} | {row['selected']['window']} | "
            f"{row['terminal']['top30']['hits']}/{row['terminal']['n']} ({pct(row['terminal']['top30']['rate'])}) | "
            f"{pct(row['previousTwoYear']['terminalTop30']['rate'])} | "
            f"{row['forward']['top30']['hits']}/{row['forward']['n']} ({pct(row['forward']['top30']['rate'])}) | "
            f"{pct(row['previousTwoYear']['forwardTop30']['rate'])} | "
            f"{'yes' if row['target90']['terminalAchieved'] and row['target90']['forwardAchieved'] else 'no'} |"
        )
    lines.extend([
        "", "## Selection leaders", "",
        "Only candidates within 0.5 percentage points of the strongest early-block profile were eligible.",
    ])
    for task, row in tasks.items():
        lines.extend(["", f"### {task}", "", "| Model | Window | Early | Selection |", "|---|---:|---:|---:|"])
        for trial in row["trials"][:12]:
            lines.append(
                f"| {trial['model']} | {trial['window']} | {pct(trial['earlyTop30'])} | {pct(trial['selectionTop30'])} |"
            )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} and {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
