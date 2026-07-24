"""Selective Top-60 confidence-gate audit.

The panel ranker always emits 60 panels. This research asks a narrower question:
can a rule chosen before evaluation identify a useful subset of draws where the
Top-60 set is substantially more reliable? Rules are selected on the historical
model-selection block and then frozen for terminal and post-cache evaluation.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_SCRIPT = ROOT / "research" / "panel_top30_v2" / "run_research.py"
BASE_RESULTS = ROOT / "research" / "panel_top60_v1" / "results.json"
OUTPUT = HERE / "results.json"
REPORT = HERE / "REPORT.md"
FROZEN_GATE = HERE / "FROZEN_GATE.json"

os.environ["PANEL_TOP_K"] = "60"
os.environ["PANEL_RESEARCH_OUTPUT_DIR"] = "research/panel_top60_selective_v1"

spec = importlib.util.spec_from_file_location("panel_top60_selective_base", BASE_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to import {BASE_SCRIPT}")
research = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = research
spec.loader.exec_module(research)


MIN_SELECTION_COVERAGE = 0.25
COVERAGE_LEVELS = (0.25, 0.35, 0.50, 0.65, 0.80)


def rank_order(scores: np.ndarray) -> np.ndarray:
    return np.argsort(-scores, axis=1)


def boundary_margin(scores: np.ndarray) -> np.ndarray:
    sorted_scores = np.sort(scores, axis=1)
    return sorted_scores[:, -research.TOP_K] - sorted_scores[:, -(research.TOP_K + 1)]


def top_set(scores: np.ndarray, k: int = research.TOP_K) -> np.ndarray:
    return np.argpartition(scores, -k, axis=1)[:, -k:]


def row_overlap(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    return np.asarray([
        len(set(left_row.tolist()) & set(right_row.tolist())) / left.shape[1]
        for left_row, right_row in zip(left, right)
    ], dtype=np.float32)


def entropy_confidence(scores: np.ndarray) -> np.ndarray:
    probability = research.softmax(scores)
    entropy = -(probability * np.log(np.maximum(probability, 1e-12))).sum(axis=1)
    return 1.0 - entropy / math.log(scores.shape[1])


def top60_sutta_concentration(scores: np.ndarray) -> np.ndarray:
    panels = top_set(scores)
    output = []
    for row in panels:
        counts = np.bincount(research.PANEL_SUTTA[row], minlength=10)
        output.append(float(counts.max() / research.TOP_K))
    return np.asarray(output, dtype=np.float32)


def signals(
    learned: np.ndarray,
    profile: np.ndarray,
    hot: np.ndarray,
) -> dict[str, np.ndarray]:
    learned_top = top_set(learned)
    profile_top = top_set(profile)
    hot_top = top_set(hot)
    probability = research.softmax(learned)
    learned_mass = np.take_along_axis(probability, learned_top, axis=1).sum(axis=1)
    return {
        "learned_top60_mass": learned_mass,
        "learned_boundary_margin": boundary_margin(learned),
        "learned_entropy_confidence": entropy_confidence(learned),
        "learned_profile_agreement": row_overlap(learned_top, profile_top),
        "learned_hot_agreement": row_overlap(learned_top, hot_top),
        "profile_hot_agreement": row_overlap(profile_top, hot_top),
        "three_way_min_agreement": np.minimum(
            row_overlap(learned_top, profile_top),
            row_overlap(learned_top, hot_top),
        ),
        "learned_sutta_concentration": top60_sutta_concentration(learned),
    }


def wilson_lower(hits: int, n: int) -> float:
    return research.wilson(hits, n)[0] if n else 0.0


def summarize(mask: np.ndarray, hits: np.ndarray) -> dict[str, Any]:
    n = int(mask.sum())
    successes = int(hits[mask].sum()) if n else 0
    low, high = research.wilson(successes, n) if n else (0.0, 0.0)
    return {
        "n": n,
        "coverage": n / len(mask) if len(mask) else 0.0,
        "hits": successes,
        "rate": successes / n if n else 0.0,
        "wilson95": [low, high],
    }


def build_rules(
    selection_signals: dict[str, np.ndarray],
    selection_hits: np.ndarray,
    selection_markets: np.ndarray,
    market_names: list[str],
) -> list[dict[str, Any]]:
    rules: list[dict[str, Any]] = []
    for signal_name, values in selection_signals.items():
        for coverage in COVERAGE_LEVELS:
            for direction in ("high", "low"):
                threshold = float(np.quantile(
                    values,
                    1.0 - coverage if direction == "high" else coverage,
                ))
                mask = values >= threshold if direction == "high" else values <= threshold
                metric = summarize(mask, selection_hits)
                if metric["coverage"] + 1e-12 < MIN_SELECTION_COVERAGE:
                    continue
                rules.append({
                    "kind": "signal",
                    "name": f"{signal_name}:{direction}:{coverage:.2f}",
                    "signal": signal_name,
                    "direction": direction,
                    "threshold": threshold,
                    "selection": metric,
                })

    market_rows = []
    for market_id, market in enumerate(market_names):
        mask = selection_markets == market_id
        metric = summarize(mask, selection_hits)
        market_rows.append((metric["rate"], metric["n"], market_id, market))
    market_rows.sort(reverse=True)
    for count in range(3, 11):
        allowed_ids = [row[2] for row in market_rows[:count]]
        allowed_names = [row[3] for row in market_rows[:count]]
        mask = np.isin(selection_markets, allowed_ids)
        metric = summarize(mask, selection_hits)
        if metric["coverage"] + 1e-12 < MIN_SELECTION_COVERAGE:
            continue
        rules.append({
            "kind": "markets",
            "name": f"top_selection_markets:{count}",
            "markets": allowed_names,
            "selection": metric,
        })
    return rules


def apply_rule(
    rule: dict[str, Any],
    split_signals: dict[str, np.ndarray],
    split_markets: np.ndarray,
    market_names: list[str],
) -> np.ndarray:
    if rule["kind"] == "markets":
        ids = [market_names.index(market) for market in rule["markets"]]
        return np.isin(split_markets, ids)
    values = split_signals[rule["signal"]]
    if rule["direction"] == "high":
        return values >= rule["threshold"]
    return values <= rule["threshold"]


def choose_rule(rules: list[dict[str, Any]]) -> dict[str, Any]:
    return max(
        rules,
        key=lambda row: (
            row["selection"]["wilson95"][0],
            row["selection"]["rate"],
            row["selection"]["coverage"],
            row["name"],
        ),
    )


def fit_scores(
    dataset: Any,
    config: Any,
    train_idx: np.ndarray,
    score_idx: np.ndarray,
    epochs: int,
    early_idx: np.ndarray | None = None,
) -> np.ndarray:
    if early_idx is None:
        model, _, _ = research.train_model(
            dataset,
            config,
            train_idx,
            None,
            fixed_epochs=epochs,
        )
    else:
        model, _, _ = research.train_model(dataset, config, train_idx, early_idx)
    return research.logits_for(model, dataset, score_idx)


def evaluate_task(
    task: str,
    frozen_rows: dict[str, list[Any]],
    merged_rows: dict[str, list[Any]],
    cutoffs: dict[str, date],
    market_names: list[str],
    base_payload: dict[str, Any],
) -> dict[str, Any]:
    dataset = research.build_dataset(task, frozen_rows)
    forward_dataset = research.build_dataset(task, merged_rows)
    train_idx = research.indices_for(dataset, None, research.TRAIN_END)
    early_idx = research.indices_for(
        dataset,
        research.TRAIN_END + research.timedelta(days=1),
        research.EARLY_END,
    )
    selection_idx = research.indices_for(
        dataset,
        research.EARLY_END + research.timedelta(days=1),
        research.SELECT_END,
    )
    pre_terminal_idx = research.indices_for(dataset, None, research.SELECT_END)
    terminal_idx = research.indices_for(
        dataset,
        research.SELECT_END + research.timedelta(days=1),
        None,
    )
    forward_idx = research.forward_indices_for(forward_dataset, market_names, cutoffs)

    task_payload = base_payload["tasks"][task]
    selected_name = task_payload["selectedConfig"]["name"]
    config = next(item for item in research.CONFIGS if item.name == selected_name)
    epochs = int(task_payload["fixedEpochs"])

    print(f"  {task}: selection scores", flush=True)
    selection_learned = fit_scores(
        dataset,
        config,
        train_idx,
        selection_idx,
        epochs,
        early_idx=early_idx,
    )
    print(f"  {task}: terminal scores", flush=True)
    terminal_learned = fit_scores(
        dataset,
        config,
        pre_terminal_idx,
        terminal_idx,
        epochs,
    )
    print(f"  {task}: forward scores", flush=True)
    forward_model, _, _ = research.train_model(
        dataset,
        config,
        np.arange(len(dataset.labels), dtype=np.int64),
        None,
        fixed_epochs=epochs,
    )
    forward_learned = research.logits_for(
        forward_model,
        forward_dataset,
        forward_idx,
    )

    selection_signal = signals(
        selection_learned,
        dataset.profile_scores[selection_idx],
        dataset.hot_scores[selection_idx],
    )
    terminal_signal = signals(
        terminal_learned,
        dataset.profile_scores[terminal_idx],
        dataset.hot_scores[terminal_idx],
    )
    forward_signal = signals(
        forward_learned,
        forward_dataset.profile_scores[forward_idx],
        forward_dataset.hot_scores[forward_idx],
    )
    selection_hits = research.topk_hits(
        selection_learned,
        dataset.labels[selection_idx],
    )
    terminal_hits = research.topk_hits(
        terminal_learned,
        dataset.labels[terminal_idx],
    )
    forward_hits = research.topk_hits(
        forward_learned,
        forward_dataset.labels[forward_idx],
    )

    rules = build_rules(
        selection_signal,
        selection_hits,
        dataset.markets[selection_idx],
        market_names,
    )
    chosen = choose_rule(rules)
    terminal_mask = apply_rule(
        chosen,
        terminal_signal,
        dataset.markets[terminal_idx],
        market_names,
    )
    forward_mask = apply_rule(
        chosen,
        forward_signal,
        forward_dataset.markets[forward_idx],
        market_names,
    )
    chosen = {
        **chosen,
        "terminal": summarize(terminal_mask, terminal_hits),
        "prospectiveForward": summarize(forward_mask, forward_hits),
    }

    selection_ranked = sorted(
        rules,
        key=lambda row: (
            row["selection"]["wilson95"][0],
            row["selection"]["rate"],
            row["selection"]["coverage"],
        ),
        reverse=True,
    )
    any_eighty = [
        {
            "name": row["name"],
            "selection": row["selection"],
        }
        for row in rules
        if row["selection"]["rate"] >= 0.80
    ]

    return {
        "model": {
            "config": asdict(config),
            "epochs": epochs,
        },
        "ungated": {
            "selection": summarize(np.ones(len(selection_hits), dtype=bool), selection_hits),
            "terminal": summarize(np.ones(len(terminal_hits), dtype=bool), terminal_hits),
            "prospectiveForward": summarize(np.ones(len(forward_hits), dtype=bool), forward_hits),
        },
        "chosenGate": chosen,
        "topSelectionRules": selection_ranked[:15],
        "selectionRulesAtOrAbove80": any_eighty,
        "candidateRuleCount": len(rules),
    }


def pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def main() -> None:
    research.seed_all()
    base_payload = json.loads(BASE_RESULTS.read_text(encoding="utf-8"))
    frozen_rows, data_audit = research.load_rows()
    merged_rows, forward_audit, cutoffs = research.load_forward_rows(frozen_rows)
    market_names = list(frozen_rows)
    tasks = {}
    for task in ("open", "close_preopen"):
        print(f"selective task {task}", flush=True)
        tasks[task] = evaluate_task(
            task,
            frozen_rows,
            merged_rows,
            cutoffs,
            market_names,
            base_payload,
        )

    payload = {
        "generatedAt": research.datetime.now().astimezone().isoformat(),
        "design": {
            "topK": research.TOP_K,
            "minimumSelectionCoverage": MIN_SELECTION_COVERAGE,
            "coverageLevels": list(COVERAGE_LEVELS),
            "ruleSelection": "maximum selection-block Wilson lower bound",
            "terminalNote": "historical terminal block; previously inspected by other experiments",
            "forwardNote": "post-cache block; also reused across the research program",
        },
        "dataAudit": data_audit,
        "forwardAudit": forward_audit,
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    gate_payload = {
        "frozenAt": payload["generatedAt"],
        "topK": research.TOP_K,
        "selectionEnd": research.SELECT_END.isoformat(),
        "gates": {
            task: tasks[task]["chosenGate"]
            for task in ("open", "close_preopen")
        },
        "status": "research-only; requires genuinely future rows before production use",
    }
    FROZEN_GATE.write_text(json.dumps(gate_payload, indent=2), encoding="utf-8")

    lines = [
        "# Selective Top-60 confidence-gate audit",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "The gate may abstain, but the selected rows still contain the same 60-panel "
        "prediction set. Gate thresholds and market lists were selected only from the "
        "historical model-selection block.",
        "",
        "| Task | Gate | Selection coverage | Selection hit rate | Selection Wilson low | "
        "Terminal coverage | Terminal hit rate | Forward coverage | Forward hit rate |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for task in ("open", "close_preopen"):
        gate = tasks[task]["chosenGate"]
        lines.append(
            f"| {task} | `{gate['name']}` | "
            f"{pct(gate['selection']['coverage'])} | "
            f"{pct(gate['selection']['rate'])} | "
            f"{pct(gate['selection']['wilson95'][0])} | "
            f"{pct(gate['terminal']['coverage'])} | "
            f"{pct(gate['terminal']['rate'])} | "
            f"{pct(gate['prospectiveForward']['coverage'])} | "
            f"{pct(gate['prospectiveForward']['rate'])} |"
        )
    lines.extend([
        "",
        "## Ungated reference",
        "",
        "| Task | Selection | Terminal | Forward |",
        "|---|---:|---:|---:|",
    ])
    for task in ("open", "close_preopen"):
        row = tasks[task]["ungated"]
        lines.append(
            f"| {task} | {pct(row['selection']['rate'])} | "
            f"{pct(row['terminal']['rate'])} | "
            f"{pct(row['prospectiveForward']['rate'])} |"
        )
    lines.extend([
        "",
        "## Interpretation",
        "",
        "A gate is not production-eligible merely because it wins on the block that "
        "selected it. It must retain the improvement on terminal and genuinely future "
        "rows, with enough coverage and a confidence interval that excludes the ungated "
        "rate. The frozen gate artifact exists so later rows can be evaluated without "
        "changing the rule after seeing their outcomes.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
