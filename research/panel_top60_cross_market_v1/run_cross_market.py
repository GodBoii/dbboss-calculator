"""Leakage-safe cross-market exact-panel Top-60 challenger.

Model families are selected only on the frozen development/selection blocks.
The terminal cache block and post-cache forward rows are evaluation-only.
Same-day values are admitted only when the source market closes before the
target market opens.
"""

from __future__ import annotations

import bisect
import importlib.util
import json
import os
import sys
from dataclasses import asdict, replace
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

os.environ["PANEL_TOP_K"] = "60"
os.environ["PANEL_RESEARCH_OUTPUT_DIR"] = "research/panel_top60_cross_market_v1"

spec = importlib.util.spec_from_file_location("panel_top60_cross_market_base", BASE_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to import {BASE_SCRIPT}")
research = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = research
spec.loader.exec_module(research)


OPEN_MINUTE = {
    "Sridevi": 11 * 60 + 35,
    "Time Bazar": 13 * 60 + 10,
    "Madhur Day": 13 * 60 + 30,
    "Rajdhani Day": 15 * 60 + 5,
    "Milan Day": 15 * 60 + 10,
    "Kalyan": 15 * 60 + 45,
    "Sridevi Night": 19 * 60 + 15,
    "Madhur Night": 20 * 60 + 30,
    "Milan Night": 21 * 60 + 5,
    "Rajdhani Night": 21 * 60 + 35,
    "Kalyan Night": 21 * 60 + 45,
    "Main Bazar": 22 * 60,
}

CLOSE_MINUTE = {
    "Sridevi": 12 * 60 + 35,
    "Time Bazar": 14 * 60 + 10,
    "Madhur Day": 14 * 60 + 30,
    "Rajdhani Day": 17 * 60 + 5,
    "Milan Day": 17 * 60 + 10,
    "Kalyan": 17 * 60 + 45,
    "Sridevi Night": 20 * 60 + 15,
    "Madhur Night": 22 * 60 + 30,
    "Milan Night": 23 * 60 + 5,
    "Rajdhani Night": 23 * 60 + 35,
    "Kalyan Night": 23 * 60 + 45,
    "Main Bazar": 24 * 60 + 10,
}

MISSING_DIGIT = 10
MISSING_KIND = 2
FAMILIES = ("same_day_coarse", "previous_coarse", "combined_coarse", "same_day_exact")
CONFIG_NAMES = ("additive_wd1", "lowrank_d50")


def panel_coarse(panel_id: int | None) -> list[int]:
    if panel_id is None or panel_id == research.MISSING_PANEL:
        return [MISSING_DIGIT, MISSING_KIND, MISSING_DIGIT, MISSING_DIGIT, MISSING_DIGIT]
    digits = research.PANEL_DIGITS[panel_id]
    return [
        int(research.PANEL_SUTTA[panel_id]),
        int(research.PANEL_KIND[panel_id]),
        int(digits[0]),
        int(digits[1]),
        int(digits[2]),
    ]


def coarse_row(row: Any | None) -> list[int]:
    if row is None:
        return panel_coarse(None) + panel_coarse(None)
    return panel_coarse(row.open_panel) + panel_coarse(row.close_panel)


def exact_row(row: Any | None) -> list[int]:
    if row is None:
        return [research.MISSING_PANEL, research.MISSING_PANEL]
    return [int(row.open_panel), int(row.close_panel)]


def augment_dataset(
    dataset: Any,
    rows_by_market: dict[str, list[Any]],
    market_names: list[str],
    family: str,
) -> Any:
    by_date = {
        market: {row.iso_date: row for row in rows}
        for market, rows in rows_by_market.items()
    }
    dates = {
        market: [row.iso_date for row in rows]
        for market, rows in rows_by_market.items()
    }
    additions: list[list[int]] = []
    cards: list[int] | None = None

    for raw_date, market_id in zip(dataset.dates, dataset.markets):
        target_date = date.fromisoformat(str(raw_date))
        target_market = market_names[int(market_id)]
        values: list[int] = []

        for source_market in market_names:
            source_dates = dates[source_market]
            prior_index = bisect.bisect_left(source_dates, target_date) - 1
            previous = rows_by_market[source_market][prior_index] if prior_index >= 0 else None
            same_day = (
                by_date[source_market].get(target_date)
                if CLOSE_MINUTE[source_market] < OPEN_MINUTE[target_market]
                else None
            )

            if family == "same_day_coarse":
                values.extend(coarse_row(same_day))
            elif family == "previous_coarse":
                values.extend(coarse_row(previous))
            elif family == "combined_coarse":
                values.extend(coarse_row(previous))
                values.extend(coarse_row(same_day))
            elif family == "same_day_exact":
                values.extend(exact_row(same_day))
            else:
                raise ValueError(f"Unknown feature family: {family}")

        if cards is None:
            if family in {"same_day_coarse", "previous_coarse"}:
                unit = [11, 3, 11, 11, 11] * 2
            elif family == "combined_coarse":
                unit = [11, 3, 11, 11, 11] * 4
            else:
                unit = [len(research.PANELS) + 1] * 2
            cards = unit * len(market_names)
        additions.append(values)

    added = np.asarray(additions, dtype=np.int64)
    if added.shape[1] != len(cards or []):
        raise RuntimeError(f"{family} width mismatch: {added.shape[1]} vs {len(cards or [])}")
    return replace(
        dataset,
        contexts=np.column_stack([dataset.contexts, added]),
        context_cards=[*dataset.context_cards, *(cards or [])],
    )


def rank_points(scores: np.ndarray) -> np.ndarray:
    order = np.argsort(-scores, axis=1)
    points = np.empty_like(scores, dtype=np.float32)
    descending = np.linspace(1.0, 0.0, scores.shape[1], dtype=np.float32)
    points[np.arange(len(scores))[:, None], order] = descending
    return points


def blend(left: np.ndarray, right: np.ndarray, left_weight: float) -> np.ndarray:
    return left_weight * rank_points(left) + (1.0 - left_weight) * rank_points(right)


def config_by_name(name: str) -> Any:
    return next(config for config in research.CONFIGS if config.name == name)


def pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def evaluate_task(
    task: str,
    frozen_rows: dict[str, list[Any]],
    merged_rows: dict[str, list[Any]],
    cutoffs: dict[str, date],
    market_names: list[str],
    base_payload: dict[str, Any],
) -> dict[str, Any]:
    base = research.build_dataset(task, frozen_rows)
    forward_base = research.build_dataset(task, merged_rows)
    frozen = {"base": base}
    forward = {"base": forward_base}
    for family in FAMILIES:
        frozen[family] = augment_dataset(base, frozen_rows, market_names, family)
        forward[family] = augment_dataset(forward_base, merged_rows, market_names, family)

    train_idx = research.indices_for(base, None, research.TRAIN_END)
    early_idx = research.indices_for(
        base,
        research.TRAIN_END + research.timedelta(days=1),
        research.EARLY_END,
    )
    selection_idx = research.indices_for(
        base,
        research.EARLY_END + research.timedelta(days=1),
        research.SELECT_END,
    )
    pre_terminal_idx = research.indices_for(base, None, research.SELECT_END)
    terminal_idx = research.indices_for(
        base,
        research.SELECT_END + research.timedelta(days=1),
        None,
    )
    forward_idx = research.forward_indices_for(forward_base, market_names, cutoffs)

    baseline_config = config_by_name(base_payload["tasks"][task]["selectedConfig"]["name"])
    candidates: list[tuple[str, str, Any]] = [("base", "base", baseline_config)]
    for family in FAMILIES:
        for config_name in CONFIG_NAMES:
            if family == "same_day_exact" and config_name == "lowrank_d50":
                continue
            candidates.append((f"{family}:{config_name}", family, config_by_name(config_name)))

    selection_rows: list[dict[str, Any]] = []
    selection_scores: dict[str, np.ndarray] = {}
    epochs: dict[str, int] = {}
    for name, family, config in candidates:
        print(f"  {task}: selection {name}", flush=True)
        model, best_epoch, history = research.train_model(
            frozen[family],
            config,
            train_idx,
            early_idx,
        )
        scores = research.logits_for(model, frozen[family], selection_idx)
        metric = research.quick_metric(scores, frozen[family].labels[selection_idx])
        selection_scores[name] = scores
        epochs[name] = best_epoch
        selection_rows.append({
            "candidate": name,
            "family": family,
            "config": asdict(config),
            "bestEpoch": best_epoch,
            "epochsRun": len(history),
            "selectionTop60": metric,
        })

    contextual_names = [name for name, _, _ in candidates if name != "base"]
    best_context = max(contextual_names, key=lambda name: selection_scores_metric(
        selection_scores[name],
        base.labels[selection_idx],
    ))

    strategy_scores = {
        "base": selection_scores["base"],
        best_context: selection_scores[best_context],
    }
    blend_rows = []
    for weight in (0.25, 0.50, 0.75):
        name = f"blend:base={weight:.2f}"
        scores = blend(selection_scores["base"], selection_scores[best_context], weight)
        strategy_scores[name] = scores
        blend_rows.append({
            "strategy": name,
            "baseWeight": weight,
            "selectionTop60": research.quick_metric(scores, base.labels[selection_idx]),
        })
    selected_strategy = max(
        strategy_scores,
        key=lambda name: (
            research.quick_metric(strategy_scores[name], base.labels[selection_idx]),
            name == "base",
        ),
    )

    chosen_candidate_names = {"base", best_context}
    terminal_candidate_scores: dict[str, np.ndarray] = {}
    forward_candidate_scores: dict[str, np.ndarray] = {}
    for name, family, config in candidates:
        if name not in chosen_candidate_names:
            continue
        print(f"  {task}: terminal {name}", flush=True)
        terminal_model, _, _ = research.train_model(
            frozen[family],
            config,
            pre_terminal_idx,
            None,
            fixed_epochs=epochs[name],
        )
        terminal_candidate_scores[name] = research.logits_for(
            terminal_model,
            frozen[family],
            terminal_idx,
        )

        print(f"  {task}: forward {name}", flush=True)
        forward_model, _, _ = research.train_model(
            frozen[family],
            config,
            np.arange(len(frozen[family].labels), dtype=np.int64),
            None,
            fixed_epochs=epochs[name],
        )
        forward_candidate_scores[name] = research.logits_for(
            forward_model,
            forward[family],
            forward_idx,
        )

    if selected_strategy.startswith("blend:"):
        base_weight = float(selected_strategy.split("=")[1])
        terminal_selected = blend(
            terminal_candidate_scores["base"],
            terminal_candidate_scores[best_context],
            base_weight,
        )
        forward_selected = blend(
            forward_candidate_scores["base"],
            forward_candidate_scores[best_context],
            base_weight,
        )
    else:
        terminal_selected = terminal_candidate_scores[selected_strategy]
        forward_selected = forward_candidate_scores[selected_strategy]

    terminal_base = terminal_candidate_scores["base"]
    forward_base_scores = forward_candidate_scores["base"]
    terminal_hits = research.topk_hits(terminal_selected, base.labels[terminal_idx])
    terminal_base_hits = research.topk_hits(terminal_base, base.labels[terminal_idx])
    forward_hits = research.topk_hits(forward_selected, forward_base.labels[forward_idx])
    forward_base_hits = research.topk_hits(forward_base_scores, forward_base.labels[forward_idx])

    return {
        "selection": {
            "rows": sorted(selection_rows, key=lambda row: row["selectionTop60"], reverse=True),
            "bestContext": best_context,
            "blends": blend_rows,
            "selectedStrategy": selected_strategy,
            "selectedTop60": research.quick_metric(
                strategy_scores[selected_strategy],
                base.labels[selection_idx],
            ),
            "baselineTop60": research.quick_metric(
                selection_scores["base"],
                base.labels[selection_idx],
            ),
        },
        "terminal": {
            "selected": research.metrics(terminal_selected, base, terminal_idx, market_names),
            "baseline": research.metrics(terminal_base, base, terminal_idx, market_names),
            "contextual": research.metrics(
                terminal_candidate_scores[best_context],
                base,
                terminal_idx,
                market_names,
            ),
            "selectedVsBaseline": research.paired_significance(terminal_hits, terminal_base_hits),
        },
        "prospectiveForward": {
            "selected": research.metrics(
                forward_selected,
                forward_base,
                forward_idx,
                market_names,
            ),
            "baseline": research.metrics(
                forward_base_scores,
                forward_base,
                forward_idx,
                market_names,
            ),
            "contextual": research.metrics(
                forward_candidate_scores[best_context],
                forward_base,
                forward_idx,
                market_names,
            ),
            "selectedVsBaseline": research.paired_significance(forward_hits, forward_base_hits),
        },
    }


def selection_scores_metric(scores: np.ndarray, labels: np.ndarray) -> float:
    return research.quick_metric(scores, labels)


def main() -> None:
    research.seed_all()
    base_payload = json.loads(BASE_RESULTS.read_text(encoding="utf-8"))
    frozen_rows, data_audit = research.load_rows()
    merged_rows, forward_audit, cutoffs = research.load_forward_rows(frozen_rows)
    market_names = list(frozen_rows)

    tasks = {}
    for task in ("open", "close_preopen"):
        print(f"cross-market task {task}", flush=True)
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
            "topK": 60,
            "families": list(FAMILIES),
            "sameDayAvailability": "source close strictly earlier than target open",
            "selectionEnd": research.SELECT_END.isoformat(),
            "terminalStart": (research.SELECT_END + research.timedelta(days=1)).isoformat(),
            "forwardRule": "row date after each market's frozen-cache cutoff",
        },
        "dataAudit": data_audit,
        "forwardAudit": forward_audit,
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Top-60 cross-market context audit",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "All model-family and blend choices use only the model-selection block. "
        "The terminal and post-cache forward blocks do not choose a strategy.",
        "",
        "| Task | Selected strategy | Selection baseline | Selection selected | "
        "Terminal baseline | Terminal selected | Forward baseline | Forward selected | Forward p |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for task in ("open", "close_preopen"):
        row = tasks[task]
        lines.append(
            f"| {task} | {row['selection']['selectedStrategy']} | "
            f"{pct(row['selection']['baselineTop60'])} | "
            f"{pct(row['selection']['selectedTop60'])} | "
            f"{pct(row['terminal']['baseline']['top60']['rate'])} | "
            f"{pct(row['terminal']['selected']['top60']['rate'])} | "
            f"{pct(row['prospectiveForward']['baseline']['top60']['rate'])} | "
            f"{pct(row['prospectiveForward']['selected']['top60']['rate'])} | "
            f"{row['prospectiveForward']['selectedVsBaseline']['exactMcNemarP']:.4f} |"
        )

    for task in ("open", "close_preopen"):
        row = tasks[task]
        lines.extend([
            "",
            f"## {task}",
            "",
            f"Best contextual candidate: `{row['selection']['bestContext']}`.",
            "",
            "| Candidate | Selection Top-60 | Epoch |",
            "|---|---:|---:|",
        ])
        for candidate in row["selection"]["rows"]:
            lines.append(
                f"| {candidate['candidate']} | "
                f"{pct(candidate['selectionTop60'])} | {candidate['bestEpoch']} |"
            )
        lines.extend([
            "",
            "### Forward per market",
            "",
            "| Market | N | Baseline | Selected |",
            "|---|---:|---:|---:|",
        ])
        baseline_markets = row["prospectiveForward"]["baseline"]["perMarketTopK"]
        selected_markets = row["prospectiveForward"]["selected"]["perMarketTopK"]
        for market in market_names:
            base_market = baseline_markets[market]
            selected_market = selected_markets[market]
            lines.append(
                f"| {market} | {base_market['n']} | "
                f"{pct(base_market['rate'])} | {pct(selected_market['rate'])} |"
            )

    lines.extend([
        "",
        "## Decision rule",
        "",
        "A cross-market strategy is eligible for production only if it improves the "
        "untouched terminal block, improves the post-cache forward block, and has a "
        "credible paired advantage. Otherwise the production ranker remains unchanged.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
