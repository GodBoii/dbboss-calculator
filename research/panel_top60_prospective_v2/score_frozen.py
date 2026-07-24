"""Score frozen Top-60 strategies on independently sourced later rows.

No strategy, threshold, allocation, epoch count, or market route is selected
from these outcomes. Baseline weights are loaded from the previously frozen
model artifact. Contextual weights are deterministically refit on the original
frozen cache using the already-selected specification.
"""

from __future__ import annotations

import csv
import importlib.util
import json
import math
import os
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_SCRIPT = ROOT / "research" / "panel_top30_v2" / "run_research.py"
HIERARCHICAL_SCRIPT = ROOT / "research" / "panel_top60_hierarchical_v1" / "run_hierarchical.py"
CONTEXT_SCRIPT = ROOT / "research" / "panel_top60_cross_market_v1" / "run_cross_market.py"
SELECTIVE_SCRIPT = ROOT / "research" / "panel_top60_selective_v1" / "run_selective.py"
BASE_RESULTS = ROOT / "research" / "panel_top60_v1" / "results.json"
HIERARCHICAL_RESULTS = ROOT / "research" / "panel_top60_hierarchical_v1" / "results.json"
HIERARCHICAL_WATCHLIST = ROOT / "research" / "panel_top60_hierarchical_v1" / "FROZEN_WATCHLIST.json"
CONTEXT_RESULTS = ROOT / "research" / "panel_top60_cross_market_v1" / "results.json"
SELECTIVE_GATE = ROOT / "research" / "panel_top60_selective_v1" / "FROZEN_GATE.json"
INDEPENDENT = HERE / "independent_forward_records.json"
OUTPUT = HERE / "results.json"
LEDGER = HERE / "ledger.csv"
REPORT = HERE / "REPORT.md"

os.environ["PANEL_TOP_K"] = "60"
os.environ["PANEL_RESEARCH_OUTPUT_DIR"] = "research/panel_top60_prospective_v2"


def import_file(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


research = import_file("panel_top60_prospective_base", BASE_SCRIPT)
hierarchical = import_file("panel_top60_prospective_hierarchical", HIERARCHICAL_SCRIPT)
contextual = import_file("panel_top60_prospective_contextual", CONTEXT_SCRIPT)
selective = import_file("panel_top60_prospective_selective", SELECTIVE_SCRIPT)


def load_independent(
    primary_rows: dict[str, list[Any]],
) -> tuple[dict[str, list[Any]], set[tuple[str, date]], dict[str, Any]]:
    payload = json.loads(INDEPENDENT.read_text(encoding="utf-8"))
    merged = {market: list(rows) for market, rows in primary_rows.items()}
    admitted: set[tuple[str, date]] = set()
    for market, records in payload["forward"].items():
        known = {row.iso_date for row in merged[market]}
        for record in records:
            target_date = date.fromisoformat(record["isoDate"])
            if target_date in known:
                continue
            row = research.Row(
                market=market,
                iso_date=target_date,
                weekday=target_date.weekday(),
                open_panel=research.PANEL_TO_ID[record["openPanel"]],
                close_panel=research.PANEL_TO_ID[record["closePanel"]],
            )
            merged[market].append(row)
            known.add(target_date)
            admitted.add((market, target_date))
        merged[market].sort(key=lambda row: row.iso_date)
    return merged, admitted, payload


def indices_for_pairs(
    dataset: Any,
    market_names: list[str],
    pairs: set[tuple[str, date]],
) -> np.ndarray:
    return np.asarray([
        index
        for index, (raw_date, market_id) in enumerate(zip(dataset.dates, dataset.markets))
        if (
            market_names[int(market_id)],
            date.fromisoformat(str(raw_date)),
        ) in pairs
    ], dtype=np.int64)


def top_sets(scores: np.ndarray) -> np.ndarray:
    return np.argsort(-scores, axis=1)[:, :research.TOP_K]


def set_hits(sets: np.ndarray, labels: np.ndarray) -> np.ndarray:
    return (sets == labels[:, None]).any(axis=1)


def metric(
    hit: np.ndarray,
    market_ids: np.ndarray,
    market_names: list[str],
) -> dict[str, Any]:
    successes = int(hit.sum())
    low, high = research.wilson(successes, len(hit))
    per_market = {}
    for market_id, market in enumerate(market_names):
        mask = market_ids == market_id
        if not mask.any():
            continue
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
        "hits": successes,
        "rate": float(hit.mean()) if len(hit) else 0.0,
        "wilson95": [low, high],
        "perMarket": per_market,
    }


def paired_from_counts(model_only: int, baseline_only: int) -> dict[str, Any]:
    discordant = model_only + baseline_only
    if discordant == 0:
        p_value = 1.0
    else:
        tail = sum(
            math.comb(discordant, k)
            for k in range(min(model_only, baseline_only) + 1)
        ) / (2 ** discordant)
        p_value = min(1.0, 2 * tail)
    return {
        "modelOnlyHits": model_only,
        "baselineOnlyHits": baseline_only,
        "exactMcNemarP": p_value,
    }


def load_frozen_model(task: str, dataset: Any, base_results: dict[str, Any]) -> Any:
    task_payload = base_results["tasks"][task]
    config_name = task_payload["selectedConfig"]["name"]
    config = next(item for item in research.CONFIGS if item.name == config_name)
    artifact_path = ROOT / task_payload["artifact"]["path"]
    artifact = torch.load(artifact_path, map_location="cpu", weights_only=False)
    if artifact["fixedEpochs"] != task_payload["fixedEpochs"]:
        raise RuntimeError(f"{task} artifact epoch mismatch")
    if artifact["featureNames"] != dataset.feature_names:
        raise RuntimeError(f"{task} artifact feature mismatch")
    if artifact["contextCards"] != dataset.context_cards:
        raise RuntimeError(f"{task} artifact context mismatch")
    model = research.make_model(config, dataset)
    model.load_state_dict(artifact["stateDict"])
    return model


def contextual_scores(
    task: str,
    frozen_rows: dict[str, list[Any]],
    extended_rows: dict[str, list[Any]],
    admitted: set[tuple[str, date]],
    market_names: list[str],
    context_results: dict[str, Any],
) -> tuple[np.ndarray, np.ndarray]:
    task_result = context_results["tasks"][task]
    candidate_name = task_result["selection"]["bestContext"]
    selection_row = next(
        row for row in task_result["selection"]["rows"]
        if row["candidate"] == candidate_name
    )
    family = selection_row["family"]
    config_name = selection_row["config"]["name"]
    config = next(item for item in contextual.research.CONFIGS if item.name == config_name)
    epochs = int(selection_row["bestEpoch"])
    frozen_base = contextual.research.build_dataset(task, frozen_rows)
    extended_base = contextual.research.build_dataset(task, extended_rows)
    frozen_dataset = contextual.augment_dataset(
        frozen_base,
        frozen_rows,
        market_names,
        family,
    )
    extended_dataset = contextual.augment_dataset(
        extended_base,
        extended_rows,
        market_names,
        family,
    )
    score_idx = indices_for_pairs(extended_dataset, market_names, admitted)
    model, _, _ = contextual.research.train_model(
        frozen_dataset,
        config,
        np.arange(len(frozen_dataset.labels), dtype=np.int64),
        None,
        fixed_epochs=epochs,
    )
    return (
        contextual.research.logits_for(model, extended_dataset, score_idx),
        extended_dataset.labels[score_idx],
    )


def pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def main() -> None:
    research.seed_all()
    base_results = json.loads(BASE_RESULTS.read_text(encoding="utf-8"))
    hierarchy_results = json.loads(HIERARCHICAL_RESULTS.read_text(encoding="utf-8"))
    hierarchy_watchlist = json.loads(HIERARCHICAL_WATCHLIST.read_text(encoding="utf-8"))
    context_results = json.loads(CONTEXT_RESULTS.read_text(encoding="utf-8"))
    gate_payload = json.loads(SELECTIVE_GATE.read_text(encoding="utf-8"))

    frozen_rows, data_audit = research.load_rows()
    primary_rows, primary_audit, _ = research.load_forward_rows(frozen_rows)
    extended_rows, admitted, independent_payload = load_independent(primary_rows)
    market_names = list(frozen_rows)
    if len(admitted) != sum(
        len(rows) for rows in independent_payload["forward"].values()
    ):
        raise RuntimeError("An independent row overlapped an existing primary row")

    tasks = {}
    ledger_rows = []
    for task in ("open", "close_preopen"):
        print(f"scoring frozen {task}", flush=True)
        frozen_dataset = research.build_dataset(task, frozen_rows)
        extended_dataset = research.build_dataset(task, extended_rows)
        score_idx = indices_for_pairs(extended_dataset, market_names, admitted)
        if len(score_idx) != len(admitted):
            raise RuntimeError(f"{task}: expected {len(admitted)} rows, found {len(score_idx)}")
        model = load_frozen_model(task, frozen_dataset, base_results)
        learned = research.logits_for(model, extended_dataset, score_idx)
        labels = extended_dataset.labels[score_idx]
        baseline_sets = top_sets(learned)
        baseline_hits = set_hits(baseline_sets, labels)

        hierarchy_strategy = hierarchy_watchlist["strategies"][task]
        hierarchy_candidates = hierarchical.build_candidates(
            learned,
            extended_dataset.profile_scores[score_idx],
        )
        hierarchy_sets = hierarchy_candidates[hierarchy_strategy]
        hierarchy_hits = set_hits(hierarchy_sets, labels)

        context_scores, context_labels = contextual_scores(
            task,
            frozen_rows,
            extended_rows,
            admitted,
            market_names,
            context_results,
        )
        if not np.array_equal(context_labels, labels):
            raise RuntimeError(f"{task}: contextual labels are misaligned")
        context_sets = top_sets(context_scores)
        context_hits = set_hits(context_sets, labels)

        gate = gate_payload["gates"][task]
        split_signals = selective.signals(
            learned,
            extended_dataset.profile_scores[score_idx],
            extended_dataset.hot_scores[score_idx],
        )
        gate_mask = selective.apply_rule(
            gate,
            split_signals,
            extended_dataset.markets[score_idx],
            market_names,
        )

        hierarchy_pair = research.paired_significance(hierarchy_hits, baseline_hits)
        context_pair = research.paired_significance(context_hits, baseline_hits)
        prior_pair = hierarchy_results["tasks"][task]["prospectiveForward"]["selectedVsBaseline"]
        cumulative_pair = paired_from_counts(
            int(prior_pair["modelOnlyHits"]) + int(hierarchy_pair["modelOnlyHits"]),
            int(prior_pair["baselineOnlyHits"]) + int(hierarchy_pair["baselineOnlyHits"]),
        )
        gate_metric = metric(
            baseline_hits[gate_mask],
            extended_dataset.markets[score_idx][gate_mask],
            market_names,
        )

        tasks[task] = {
            "n": len(score_idx),
            "baseline": metric(
                baseline_hits,
                extended_dataset.markets[score_idx],
                market_names,
            ),
            "hierarchical": {
                "strategy": hierarchy_strategy,
                "metrics": metric(
                    hierarchy_hits,
                    extended_dataset.markets[score_idx],
                    market_names,
                ),
                "vsBaseline": hierarchy_pair,
                "cumulativeWithPriorForward": cumulative_pair,
            },
            "contextual": {
                "strategy": context_results["tasks"][task]["selection"]["bestContext"],
                "metrics": metric(
                    context_hits,
                    extended_dataset.markets[score_idx],
                    market_names,
                ),
                "vsBaseline": context_pair,
            },
            "selective": {
                "gate": gate["name"],
                "coverage": float(gate_mask.mean()),
                "metrics": gate_metric,
            },
            "promotion": {
                "eligible": False,
                "reasons": [
                    "Only 44 independently sourced rows are available; minimum prospective support is 100.",
                    "The hierarchical Open challenger previously failed its terminal confirmation block.",
                    "No challenger has a paired p-value below 0.05 across confirmation blocks.",
                ],
            },
        }

        for local, global_index in enumerate(score_idx):
            market = market_names[int(extended_dataset.markets[global_index])]
            ledger_rows.append({
                "task": task,
                "date": str(extended_dataset.dates[global_index]),
                "market": market,
                "actual": research.PANELS[int(labels[local])],
                "baselineHit": bool(baseline_hits[local]),
                "hierarchicalHit": bool(hierarchy_hits[local]),
                "contextualHit": bool(context_hits[local]),
                "gateSelected": bool(gate_mask[local]),
                "baselinePanels": " ".join(
                    research.PANELS[index] for index in baseline_sets[local]
                ),
                "hierarchicalPanels": " ".join(
                    research.PANELS[index] for index in hierarchy_sets[local]
                ),
            })

    payload = {
        "generatedAt": research.datetime.now().astimezone().isoformat(),
        "design": {
            "topK": research.TOP_K,
            "strategySelection": "frozen before these outcomes",
            "baselineWeights": "loaded from frozen research model artifacts",
            "contextualWeights": "deterministic refit on original frozen cache only",
            "newRows": len(admitted),
            "unresolvedMarket": "Rajdhani Day excluded because no matching independent series was found",
            "promotionMinimumProspectiveRows": 100,
        },
        "dataAudit": data_audit,
        "primaryForwardAudit": primary_audit,
        "independentSource": independent_payload["source"],
        "independentAudit": independent_payload["audit"],
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    with LEDGER.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[
            "task", "date", "market", "actual", "baselineHit",
            "hierarchicalHit", "contextualHit", "gateSelected",
            "baselinePanels", "hierarchicalPanels",
        ])
        writer.writeheader()
        writer.writerows(ledger_rows)

    lines = [
        "# Frozen-strategy independent prospective score",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        f"The independent source added **{len(admitted)}** completed rows from "
        "2026-07-20 through 2026-07-23 across 11 markets. Every admitted source mapping "
        "matched 100% of at least 42-61 overlapping historical rows. Rajdhani Day was "
        "excluded after its same-named public series matched 0/42 rows.",
        "",
        "| Task | N | Baseline | Hierarchical | Hierarchy p | Contextual | Context p | "
        "Gate coverage | Gated rate |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for task in ("open", "close_preopen"):
        row = tasks[task]
        lines.append(
            f"| {task} | {row['n']} | {pct(row['baseline']['rate'])} | "
            f"{pct(row['hierarchical']['metrics']['rate'])} | "
            f"{row['hierarchical']['vsBaseline']['exactMcNemarP']:.4f} | "
            f"{pct(row['contextual']['metrics']['rate'])} | "
            f"{row['contextual']['vsBaseline']['exactMcNemarP']:.4f} | "
            f"{pct(row['selective']['coverage'])} | "
            f"{pct(row['selective']['metrics']['rate'])} |"
        )
    lines.extend([
        "",
        "## Promotion decision",
        "",
        "No model is promoted. Forty-four rows are useful prospective evidence but "
        "remain below the predeclared 100-row minimum, and the Open hierarchy had already "
        "failed terminal confirmation. These outcomes extend the frozen ledger; they do "
        "not retune any model, threshold, allocation, or market route.",
        "",
        "## Source-integrity note",
        "",
        "The independent API was discovered from the public site's shipped client bundle. "
        "Rows were accepted only after exact historical identity validation, legal-panel "
        "checks, sutta/Jodi consistency checks, and target-market weekday filtering.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
