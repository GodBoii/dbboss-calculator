"""Hierarchical sutta-to-panel Top-60 allocation audit.

The baseline takes the 60 highest panel scores globally. Challengers first rank
the ten suttas, allocate exactly 60 panel slots among them, and then rank panels
inside each sutta. Strategy selection uses only the historical selection block.
"""

from __future__ import annotations

import importlib.util
import json
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
WATCHLIST = HERE / "FROZEN_WATCHLIST.json"

os.environ["PANEL_TOP_K"] = "60"
os.environ["PANEL_RESEARCH_OUTPUT_DIR"] = "research/panel_top60_hierarchical_v1"

spec = importlib.util.spec_from_file_location("panel_top60_hierarchical_base", BASE_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to import {BASE_SCRIPT}")
research = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = research
spec.loader.exec_module(research)


ALLOCATIONS = {
    "22-22-16": [22, 22, 16],
    "20-20-10-10": [20, 20, 10, 10],
    "15x4": [15, 15, 15, 15],
    "12x5": [12, 12, 12, 12, 12],
    "10x6": [10, 10, 10, 10, 10, 10],
    "8x7+4": [8, 8, 8, 8, 8, 8, 8, 4],
    "6x10": [6] * 10,
}
TEMPERATURES = (0.5, 1.0, 2.0)
PANELS_BY_SUTTA = [
    np.flatnonzero(research.PANEL_SUTTA == sutta)
    for sutta in range(10)
]


def rank_points(scores: np.ndarray) -> np.ndarray:
    order = np.argsort(-scores, axis=1)
    points = np.empty_like(scores, dtype=np.float32)
    descending = np.linspace(1.0, 0.0, scores.shape[1], dtype=np.float32)
    points[np.arange(len(scores))[:, None], order] = descending
    return points


def panel_probabilities(scores: np.ndarray) -> np.ndarray:
    return research.softmax(scores)


def sutta_mass(panel_probability: np.ndarray) -> np.ndarray:
    return np.column_stack([
        panel_probability[:, panels].sum(axis=1)
        for panels in PANELS_BY_SUTTA
    ])


def normalized_rank_blend(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    blend = 0.5 * rank_points(left) + 0.5 * rank_points(right)
    return blend / np.maximum(blend.sum(axis=1, keepdims=True), 1e-9)


def exact_allocation(probability: np.ndarray, temperature: float) -> list[int]:
    adjusted = np.power(np.maximum(probability, 1e-12), 1.0 / temperature)
    adjusted /= adjusted.sum()
    raw = adjusted * research.TOP_K
    allocation = np.minimum(np.floor(raw).astype(int), 22)
    while int(allocation.sum()) < research.TOP_K:
        available = allocation < 22
        priority = np.where(available, raw - allocation, -np.inf)
        allocation[int(np.argmax(priority))] += 1
    while int(allocation.sum()) > research.TOP_K:
        removable = allocation > 0
        priority = np.where(removable, allocation - raw, -np.inf)
        allocation[int(np.argmax(priority))] -= 1
    return allocation.tolist()


def hierarchical_sets(
    panel_scores: np.ndarray,
    sutta_scores: np.ndarray,
    fixed_allocation: list[int] | None = None,
    temperature: float | None = None,
) -> np.ndarray:
    output = np.empty((len(panel_scores), research.TOP_K), dtype=np.int64)
    global_order = np.argsort(-panel_scores, axis=1)
    sutta_order = np.argsort(-sutta_scores, axis=1)
    for row_index in range(len(panel_scores)):
        if fixed_allocation is not None:
            allocation = [0] * 10
            for rank, count in enumerate(fixed_allocation):
                allocation[int(sutta_order[row_index, rank])] = count
        elif temperature is not None:
            probability = sutta_scores[row_index]
            probability = probability / np.maximum(probability.sum(), 1e-12)
            allocation = exact_allocation(probability, temperature)
        else:
            raise ValueError("An allocation method is required")

        selected: list[int] = []
        for sutta, count in enumerate(allocation):
            if count <= 0:
                continue
            candidates = PANELS_BY_SUTTA[sutta]
            order = candidates[np.argsort(-panel_scores[row_index, candidates])]
            selected.extend(order[:count].tolist())
        if len(selected) < research.TOP_K:
            selected_set = set(selected)
            selected.extend(
                panel for panel in global_order[row_index]
                if panel not in selected_set
            )
        output[row_index] = np.asarray(selected[:research.TOP_K], dtype=np.int64)
    return output


def flat_sets(scores: np.ndarray) -> np.ndarray:
    return np.argsort(-scores, axis=1)[:, :research.TOP_K]


def hits(sets: np.ndarray, labels: np.ndarray) -> np.ndarray:
    return (sets == labels[:, None]).any(axis=1)


def metric(
    sets: np.ndarray,
    labels: np.ndarray,
    market_ids: np.ndarray,
    market_names: list[str],
) -> dict[str, Any]:
    hit = hits(sets, labels)
    low, high = research.wilson(int(hit.sum()), len(hit))
    per_market = {}
    for market_id, market in enumerate(market_names):
        mask = market_ids == market_id
        market_hit = hit[mask]
        market_low, market_high = research.wilson(int(market_hit.sum()), len(market_hit))
        per_market[market] = {
            "n": int(mask.sum()),
            "hits": int(market_hit.sum()),
            "rate": float(market_hit.mean()),
            "wilson95": [market_low, market_high],
        }
    return {
        "n": len(hit),
        "hits": int(hit.sum()),
        "rate": float(hit.mean()),
        "wilson95": [low, high],
        "perMarket": per_market,
    }


def build_candidates(
    learned: np.ndarray,
    profile: np.ndarray,
) -> dict[str, np.ndarray]:
    panel_sources = {
        "learned": learned,
        "panel_blend": 0.5 * rank_points(learned) + 0.5 * rank_points(profile),
    }
    learned_mass = sutta_mass(panel_probabilities(learned))
    profile_mass = sutta_mass(panel_probabilities(profile))
    sutta_sources = {
        "learned_mass": learned_mass,
        "profile_mass": profile_mass,
        "mass_blend": normalized_rank_blend(learned_mass, profile_mass),
    }
    candidates = {
        "flat:learned": flat_sets(learned),
        "flat:profile": flat_sets(profile),
        "flat:panel_blend": flat_sets(panel_sources["panel_blend"]),
    }
    for panel_name, panel_scores in panel_sources.items():
        for sutta_name, sutta_scores in sutta_sources.items():
            for allocation_name, allocation in ALLOCATIONS.items():
                name = f"fixed:{panel_name}:{sutta_name}:{allocation_name}"
                candidates[name] = hierarchical_sets(
                    panel_scores,
                    sutta_scores,
                    fixed_allocation=allocation,
                )
            for temperature in TEMPERATURES:
                name = f"proportional:{panel_name}:{sutta_name}:t{temperature:.1f}"
                candidates[name] = hierarchical_sets(
                    panel_scores,
                    sutta_scores,
                    temperature=temperature,
                )
    for name, sets in candidates.items():
        if sets.shape != (len(learned), research.TOP_K):
            raise RuntimeError(f"{name} emitted invalid shape {sets.shape}")
        if np.any((sets < 0) | (sets >= len(research.PANELS))):
            raise RuntimeError(f"{name} emitted an invalid panel id")
        if any(len(set(row.tolist())) != research.TOP_K for row in sets):
            raise RuntimeError(f"{name} emitted duplicate panels")
    return candidates


def fit_model(
    dataset: Any,
    config: Any,
    train_idx: np.ndarray,
    score_dataset: Any,
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
    return research.logits_for(model, score_dataset, score_idx)


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
    config = next(
        item for item in research.CONFIGS
        if item.name == task_payload["selectedConfig"]["name"]
    )
    epochs = int(task_payload["fixedEpochs"])
    print(f"  {task}: selection scores", flush=True)
    selection_scores = fit_model(
        dataset,
        config,
        train_idx,
        dataset,
        selection_idx,
        epochs,
        early_idx,
    )
    print(f"  {task}: terminal scores", flush=True)
    terminal_scores = fit_model(
        dataset,
        config,
        pre_terminal_idx,
        dataset,
        terminal_idx,
        epochs,
    )
    print(f"  {task}: forward scores", flush=True)
    forward_scores = fit_model(
        dataset,
        config,
        np.arange(len(dataset.labels), dtype=np.int64),
        forward_dataset,
        forward_idx,
        epochs,
    )

    selection_candidates = build_candidates(
        selection_scores,
        dataset.profile_scores[selection_idx],
    )
    selection_rows = []
    for name, sets in selection_candidates.items():
        row_hits = hits(sets, dataset.labels[selection_idx])
        selection_rows.append({
            "strategy": name,
            "hits": int(row_hits.sum()),
            "rate": float(row_hits.mean()),
        })
    selection_rows.sort(
        key=lambda row: (row["rate"], row["strategy"] == "flat:learned"),
        reverse=True,
    )
    selected_name = selection_rows[0]["strategy"]

    terminal_candidates = build_candidates(
        terminal_scores,
        dataset.profile_scores[terminal_idx],
    )
    forward_candidates = build_candidates(
        forward_scores,
        forward_dataset.profile_scores[forward_idx],
    )
    terminal_selected = terminal_candidates[selected_name]
    forward_selected = forward_candidates[selected_name]
    terminal_baseline = terminal_candidates["flat:learned"]
    forward_baseline = forward_candidates["flat:learned"]
    terminal_selected_hits = hits(terminal_selected, dataset.labels[terminal_idx])
    terminal_baseline_hits = hits(terminal_baseline, dataset.labels[terminal_idx])
    forward_selected_hits = hits(
        forward_selected,
        forward_dataset.labels[forward_idx],
    )
    forward_baseline_hits = hits(
        forward_baseline,
        forward_dataset.labels[forward_idx],
    )
    return {
        "model": {"config": asdict(config), "epochs": epochs},
        "selection": {
            "selectedStrategy": selected_name,
            "selected": selection_rows[0],
            "baseline": next(
                row for row in selection_rows
                if row["strategy"] == "flat:learned"
            ),
            "topStrategies": selection_rows[:20],
            "candidateCount": len(selection_rows),
        },
        "terminal": {
            "selected": metric(
                terminal_selected,
                dataset.labels[terminal_idx],
                dataset.markets[terminal_idx],
                market_names,
            ),
            "baseline": metric(
                terminal_baseline,
                dataset.labels[terminal_idx],
                dataset.markets[terminal_idx],
                market_names,
            ),
            "selectedVsBaseline": research.paired_significance(
                terminal_selected_hits,
                terminal_baseline_hits,
            ),
        },
        "prospectiveForward": {
            "selected": metric(
                forward_selected,
                forward_dataset.labels[forward_idx],
                forward_dataset.markets[forward_idx],
                market_names,
            ),
            "baseline": metric(
                forward_baseline,
                forward_dataset.labels[forward_idx],
                forward_dataset.markets[forward_idx],
                market_names,
            ),
            "selectedVsBaseline": research.paired_significance(
                forward_selected_hits,
                forward_baseline_hits,
            ),
        },
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
        print(f"hierarchical task {task}", flush=True)
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
            "fixedAllocations": ALLOCATIONS,
            "proportionalTemperatures": list(TEMPERATURES),
            "selectionRule": "highest selection-block Top-60 rate; baseline wins ties",
        },
        "dataAudit": data_audit,
        "forwardAudit": forward_audit,
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    WATCHLIST.write_text(json.dumps({
        "frozenAt": payload["generatedAt"],
        "topK": research.TOP_K,
        "frozenCacheCutoffs": {
            market: cutoff.isoformat()
            for market, cutoff in cutoffs.items()
        },
        "strategies": {
            task: tasks[task]["selection"]["selectedStrategy"]
            for task in ("open", "close_preopen")
        },
        "promotionStatus": {
            "open": "watchlist-only: terminal block did not confirm",
            "close_preopen": "baseline retained",
        },
        "rule": "Do not modify the strategy before scoring genuinely later rows.",
    }, indent=2), encoding="utf-8")

    lines = [
        "# Hierarchical sutta-to-panel Top-60 audit",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "Every candidate emits exactly 60 unique legal panels. The allocation strategy "
        "is selected only on the historical model-selection block.",
        "",
        "| Task | Selected strategy | Selection baseline | Selection selected | "
        "Terminal baseline | Terminal selected | Forward baseline | Forward selected | Forward p |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for task in ("open", "close_preopen"):
        row = tasks[task]
        lines.append(
            f"| {task} | `{row['selection']['selectedStrategy']}` | "
            f"{pct(row['selection']['baseline']['rate'])} | "
            f"{pct(row['selection']['selected']['rate'])} | "
            f"{pct(row['terminal']['baseline']['rate'])} | "
            f"{pct(row['terminal']['selected']['rate'])} | "
            f"{pct(row['prospectiveForward']['baseline']['rate'])} | "
            f"{pct(row['prospectiveForward']['selected']['rate'])} | "
            f"{row['prospectiveForward']['selectedVsBaseline']['exactMcNemarP']:.4f} |"
        )
    for task in ("open", "close_preopen"):
        lines.extend([
            "",
            f"## {task} selection leaders",
            "",
            "| Strategy | Hits | Rate |",
            "|---|---:|---:|",
        ])
        for row in tasks[task]["selection"]["topStrategies"]:
            lines.append(
                f"| `{row['strategy']}` | {row['hits']} | {pct(row['rate'])} |"
            )
    lines.extend([
        "",
        "## Promotion gate",
        "",
        "A strategy is eligible only if the selection improvement repeats on both the "
        "terminal and post-cache blocks and the paired comparison is credible. A later "
        "gain that was not selected in advance is not promoted.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
