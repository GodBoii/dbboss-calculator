"""Market-specific Top-60 routing selected before the prospective forward block.

This script reuses the causal feature/model definitions from panel_top30_v2/run_research.py.
It does not import or modify production application code.
"""

from __future__ import annotations

import csv
import importlib.util
import json
import os
import sys
from collections import defaultdict
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_SCRIPT = ROOT / "research" / "panel_top30_v2" / "run_research.py"
BASE_RESULTS = HERE / "results.json"
OUTPUT = HERE / "routing_results.json"
REPORT = HERE / "ROUTING_REPORT.md"
LEDGER = HERE / "routing_forward_ledger.csv"

os.environ["PANEL_TOP_K"] = "60"
os.environ["PANEL_RESEARCH_OUTPUT_DIR"] = "research/panel_top60_v1"

spec = importlib.util.spec_from_file_location("panel_topk_research", BASE_SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to import {BASE_SCRIPT}")
research = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = research
spec.loader.exec_module(research)


def rank_points(scores: np.ndarray) -> np.ndarray:
    order = np.argsort(-scores, axis=1)
    points = np.empty_like(scores, dtype=np.float32)
    values = np.linspace(1.0, 0.0, scores.shape[1], dtype=np.float32)
    points[np.arange(len(scores))[:, None], order] = values
    return points


def top_hits(scores: np.ndarray, labels: np.ndarray) -> np.ndarray:
    return research.topk_hits(scores, labels, research.TOP_K)


def candidate_market_stats(
    scores: np.ndarray,
    dataset: Any,
    indices: np.ndarray,
    market_id: int,
) -> dict[str, Any]:
    mask = dataset.markets[indices] == market_id
    local_indices = indices[mask]
    hits = top_hits(scores[mask], dataset.labels[local_indices])
    by_month: dict[str, dict[str, int]] = {}
    months = np.asarray([str(dataset.dates[index])[:7] for index in local_indices])
    for month in sorted(set(months.tolist())):
        month_mask = months == month
        by_month[month] = {
            "n": int(month_mask.sum()),
            "hits": int(hits[month_mask].sum()),
        }
    return {
        "n": int(len(local_indices)),
        "hits": int(hits.sum()),
        "rate": float(hits.mean()) if len(hits) else 0.0,
        "byMonth": by_month,
    }


def choose_market_candidate(
    baseline: str,
    candidate_stats: dict[str, dict[str, Any]],
) -> tuple[str, dict[str, Any]]:
    baseline_stats = candidate_stats[baseline]
    decisions = []
    for name, stats in candidate_stats.items():
        months = sorted(set(baseline_stats["byMonth"]) | set(stats["byMonth"]))
        monthly_wins = sum(
            stats["byMonth"].get(month, {}).get("hits", 0)
            > baseline_stats["byMonth"].get(month, {}).get("hits", 0)
            for month in months
        )
        monthly_losses = sum(
            stats["byMonth"].get(month, {}).get("hits", 0)
            < baseline_stats["byMonth"].get(month, {}).get("hits", 0)
            for month in months
        )
        delta = stats["hits"] - baseline_stats["hits"]
        eligible = name != baseline and delta >= 2 and monthly_wins >= 2 and monthly_wins >= monthly_losses
        decisions.append({
            "candidate": name,
            "hits": stats["hits"],
            "deltaHits": delta,
            "monthlyWins": monthly_wins,
            "monthlyLosses": monthly_losses,
            "eligible": eligible,
        })
    eligible = [row for row in decisions if row["eligible"]]
    if not eligible:
        return baseline, {"reason": "fallback", "candidates": decisions}
    winner = max(
        eligible,
        key=lambda row: (
            row["deltaHits"],
            row["monthlyWins"] - row["monthlyLosses"],
            row["hits"],
            row["candidate"],
        ),
    )
    return winner["candidate"], {"reason": "terminal-multimonth-gate", "winner": winner, "candidates": decisions}


def route_scores(
    scores_by_name: dict[str, np.ndarray],
    dataset: Any,
    indices: np.ndarray,
    routes: dict[str, str],
    market_names: list[str],
) -> np.ndarray:
    output = np.empty_like(next(iter(scores_by_name.values())))
    for market_id, market in enumerate(market_names):
        mask = dataset.markets[indices] == market_id
        output[mask] = scores_by_name[routes[market]][mask]
    return output


def pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def main() -> None:
    research.seed_all()
    base_payload = json.loads(BASE_RESULTS.read_text(encoding="utf-8"))
    rows_by_market, data_audit = research.load_rows()
    merged_rows, forward_audit, cutoffs = research.load_forward_rows(rows_by_market)
    market_names = list(rows_by_market)
    tasks: dict[str, Any] = {}
    forward_ledger: list[dict[str, Any]] = []

    for task in ("open", "close_preopen"):
        print(f"routing {task}", flush=True)
        dataset = research.build_dataset(task, rows_by_market)
        forward_dataset = research.build_dataset(task, merged_rows)
        pre_holdout = research.indices_for(dataset, None, research.SELECT_END)
        terminal_idx = research.indices_for(dataset, research.SELECT_END.replace(day=research.SELECT_END.day) + research.timedelta(days=1), None)
        forward_idx = research.forward_indices_for(forward_dataset, market_names, cutoffs)

        base_task = base_payload["tasks"][task]
        fixed_epochs = {
            trial["config"]["name"]: int(trial["bestEpoch"])
            for trial in base_task["selection"]
        }
        terminal_scores: dict[str, np.ndarray] = {
            "profile": dataset.profile_scores[terminal_idx],
            "hot": dataset.hot_scores[terminal_idx],
        }
        forward_scores: dict[str, np.ndarray] = {
            "profile": forward_dataset.profile_scores[forward_idx],
            "hot": forward_dataset.hot_scores[forward_idx],
        }

        for config in research.CONFIGS:
            epochs = fixed_epochs[config.name]
            print(f"  {task}: fitting {config.name} ({epochs} epochs)", flush=True)
            terminal_model, _, _ = research.train_model(
                dataset,
                config,
                pre_holdout,
                None,
                fixed_epochs=epochs,
            )
            terminal_scores[config.name] = research.logits_for(terminal_model, dataset, terminal_idx)
            forward_model, _, _ = research.train_model(
                dataset,
                config,
                np.arange(len(dataset.labels), dtype=np.int64),
                None,
                fixed_epochs=epochs,
            )
            forward_scores[config.name] = research.logits_for(
                forward_model,
                forward_dataset,
                forward_idx,
            )

        baseline = base_task["selectedConfig"]["name"]
        ensemble_members = {
            "ensemble:global+profile": (baseline, "profile"),
            "ensemble:global+hot": (baseline, "hot"),
            "ensemble:global+profile+hot": (baseline, "profile", "hot"),
            "ensemble:profile+hot": ("profile", "hot"),
        }
        for name, members in ensemble_members.items():
            terminal_scores[name] = np.mean(
                [rank_points(terminal_scores[member]) for member in members],
                axis=0,
            )
            forward_scores[name] = np.mean(
                [rank_points(forward_scores[member]) for member in members],
                axis=0,
            )

        routes: dict[str, str] = {}
        route_evidence: dict[str, Any] = {}
        terminal_candidate_stats: dict[str, Any] = {}
        for market_id, market in enumerate(market_names):
            stats = {
                name: candidate_market_stats(scores, dataset, terminal_idx, market_id)
                for name, scores in terminal_scores.items()
            }
            selected, evidence = choose_market_candidate(baseline, stats)
            routes[market] = selected
            route_evidence[market] = evidence
            terminal_candidate_stats[market] = stats

        routed_terminal = route_scores(
            terminal_scores,
            dataset,
            terminal_idx,
            routes,
            market_names,
        )
        routed_forward = route_scores(
            forward_scores,
            forward_dataset,
            forward_idx,
            routes,
            market_names,
        )
        terminal_metrics = research.metrics(
            routed_terminal,
            dataset,
            terminal_idx,
            market_names,
        )
        forward_metrics = research.metrics(
            routed_forward,
            forward_dataset,
            forward_idx,
            market_names,
        )
        baseline_terminal_metrics = research.metrics(
            terminal_scores[baseline],
            dataset,
            terminal_idx,
            market_names,
        )
        baseline_forward_metrics = research.metrics(
            forward_scores[baseline],
            forward_dataset,
            forward_idx,
            market_names,
        )
        profile_forward_metrics = research.metrics(
            forward_scores["profile"],
            forward_dataset,
            forward_idx,
            market_names,
        )

        routed_forward_hits = top_hits(routed_forward, forward_dataset.labels[forward_idx])
        baseline_forward_hits = top_hits(
            forward_scores[baseline],
            forward_dataset.labels[forward_idx],
        )
        top = np.argsort(-routed_forward, axis=1)[:, :research.TOP_K]
        for local, global_index in enumerate(forward_idx):
            market = market_names[int(forward_dataset.markets[global_index])]
            forward_ledger.append({
                "task": task,
                "date": str(forward_dataset.dates[global_index]),
                "market": market,
                "route": routes[market],
                "actual": research.PANELS[int(forward_dataset.labels[global_index])],
                "routedHit": bool(routed_forward_hits[local]),
                "baselineHit": bool(baseline_forward_hits[local]),
                "topPanels": " ".join(research.PANELS[index] for index in top[local]),
            })

        tasks[task] = {
            "baseline": baseline,
            "routes": routes,
            "routeEvidence": route_evidence,
            "terminalCandidateStats": terminal_candidate_stats,
            "terminal": {
                "routed": terminal_metrics,
                "baseline": baseline_terminal_metrics,
            },
            "prospectiveForward": {
                "routed": forward_metrics,
                "baseline": baseline_forward_metrics,
                "profile": profile_forward_metrics,
                "routedVsBaseline": research.paired_significance(
                    routed_forward_hits,
                    baseline_forward_hits,
                ),
            },
            "candidates": list(terminal_scores),
            "configs": [asdict(config) for config in research.CONFIGS],
        }

    payload = {
        "generatedAt": research.datetime.now().astimezone().isoformat(),
        "design": {
            "topK": research.TOP_K,
            "routeSelection": "2026-04-01 through frozen-cache cutoff",
            "finalEvaluation": "post-cache prospective forward rows only",
            "minimumImprovementHits": 2,
            "minimumWinningMonths": 2,
            "fallback": "globally selected dynamic model",
        },
        "dataAudit": data_audit,
        "forwardAudit": forward_audit,
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    with LEDGER.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "task", "date", "market", "route", "actual",
                "routedHit", "baselineHit", "topPanels",
            ],
        )
        writer.writeheader()
        writer.writerows(forward_ledger)

    lines = [
        "# Top-60 market-specific routing audit",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "Routes were selected on the terminal cache block and evaluated once on the newer "
        "post-cache forward rows. The forward block did not choose a route.",
        "",
        "| Task | Forward N | Global baseline | Routed | Profile | Routed vs baseline p |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for task in ("open", "close_preopen"):
        row = tasks[task]["prospectiveForward"]
        lines.append(
            f"| {task} | {row['routed']['n']} | "
            f"{pct(row['baseline'][research.TOP_METRIC]['rate'])} | "
            f"{pct(row['routed'][research.TOP_METRIC]['rate'])} | "
            f"{pct(row['profile'][research.TOP_METRIC]['rate'])} | "
            f"{row['routedVsBaseline']['exactMcNemarP']:.4f} |"
        )
    for task in ("open", "close_preopen"):
        lines.extend([
            "",
            f"## {task} routes",
            "",
            "| Market | Selected route | Terminal baseline | Terminal routed | Forward baseline | Forward routed |",
            "|---|---|---:|---:|---:|---:|",
        ])
        row = tasks[task]
        for market in market_names:
            terminal_base = row["terminal"]["baseline"]["perMarketTopK"][market]["rate"]
            terminal_route = row["terminal"]["routed"]["perMarketTopK"][market]["rate"]
            forward_base = row["prospectiveForward"]["baseline"]["perMarketTopK"][market]["rate"]
            forward_route = row["prospectiveForward"]["routed"]["perMarketTopK"][market]["rate"]
            lines.append(
                f"| {market} | {row['routes'][market]} | {pct(terminal_base)} | "
                f"{pct(terminal_route)} | {pct(forward_base)} | {pct(forward_route)} |"
            )
    lines.extend([
        "",
        "## Decision rule",
        "",
        "A market leaves the global model only when another candidate adds at least two terminal "
        "hits, wins at least two calendar months, and has at least as many winning as losing months. "
        "All other markets fall back to the global model. Forward results decide whether routing is "
        "credible; terminal improvements are selection results, not evidence of deployment accuracy.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)}, {REPORT.relative_to(ROOT)}, {LEDGER.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
