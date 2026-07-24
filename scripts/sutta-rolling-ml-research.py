"""Block-wise rolling causal ML with development-only hyperparameter selection."""

from __future__ import annotations

import importlib.util
import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
BASE_MODULE_PATH = ROOT / "scripts" / "sutta-causal-ml-research.py"
OUTPUT = ROOT / "scratch" / "sutta-rolling-ml-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-13" / "sutta-rolling-ml-research.md"
WINDOWS = (90, 180, 360, 10_000)
EPOCHS = (5, 10, 20)


def load_base_module():
    spec = importlib.util.spec_from_file_location("sutta_causal_ml", BASE_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {BASE_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base_module()


@dataclass(frozen=True)
class Variant:
    config_index: int
    window: int
    epochs: int

    @property
    def config(self):
        return BASE.CONFIGS[self.config_index]

    @property
    def name(self) -> str:
        window = "all" if self.window >= 10_000 else str(self.window)
        return f"{self.config.name}:w{window}:e{self.epochs}"


VARIANTS = tuple(
    Variant(config_index, window, epochs)
    for config_index in range(len(BASE.CONFIGS))
    for window in WINDOWS
    for epochs in EPOCHS
)


def recent_indices(dataset: dict[str, Any], eligible: np.ndarray, window: int) -> np.ndarray:
    selected = []
    for market in BASE.MARKETS:
        market_indices = eligible[dataset["markets"][eligible] == market]
        selected.extend(market_indices[-window:])
    return np.asarray(sorted(selected), dtype=np.int64)


def fit_and_score(
    dataset: dict[str, Any], side: str, variant: Variant,
    eligible_train: np.ndarray, score_indices: np.ndarray,
) -> tuple[np.ndarray, dict[str, Any]]:
    train_indices = recent_indices(dataset, eligible_train, variant.window)
    model, _ = BASE.train_model(
        dataset, side, variant.config, train_indices, None, fixed_epochs=variant.epochs,
    )
    logits = BASE.model_logits(model, dataset["x"][score_indices])
    base = dataset[f"base{side.title()}"]
    labels = dataset[side]
    candidate = BASE.prediction_hits(logits, base[score_indices], labels[score_indices])
    baseline = np.any(base == labels[:, None], axis=1)
    full_hits = baseline.copy()
    full_hits[score_indices] = candidate
    return full_hits, BASE.metric(full_hits, baseline, score_indices)


def evaluate_side(dataset: dict[str, Any], splits: dict[str, np.ndarray], side: str) -> dict[str, Any]:
    baseline = np.any(dataset[f"base{side.title()}"] == dataset[side][:, None], axis=1)
    development_candidates = []
    for variant in VARIANTS:
        hits, metrics = fit_and_score(dataset, side, variant, splits["train"], splits["development"])
        development_candidates.append({"variant": variant, "metrics": metrics})
    selected = max(
        development_candidates,
        key=lambda row: (
            row["metrics"]["delta"], row["metrics"]["candidate"],
            -VARIANTS.index(row["variant"]),
        ),
    )
    variant = selected["variant"]
    stage_definitions = {
        "development": (splits["train"], splits["development"]),
        "validation": (np.concatenate([splits["train"], splits["development"]]), splits["validation"]),
        "holdout": (np.concatenate([splits["train"], splits["development"], splits["validation"]]), splits["holdout"]),
        "forward": (splits["historical"], splits["forward"]),
    }
    combined_hits = baseline.copy()
    metrics = {}
    for name, (training, scoring) in stage_definitions.items():
        stage_hits, stage_metric = fit_and_score(dataset, side, variant, training, scoring)
        combined_hits[scoring] = stage_hits[scoring]
        metrics[name] = stage_metric
    return {
        "variant": variant.name,
        "metrics": metrics,
        "hits": combined_hits,
        "baselineHits": baseline,
        "promotable": (
            metrics["development"]["delta"] > 0
            and metrics["validation"]["delta"] >= 0
            and metrics["holdout"]["delta"] >= 0
            and metrics["forward"]["delta"] >= 0
        ),
        "developmentCandidates": [
            {"variant": row["variant"].name, "metrics": row["metrics"]}
            for row in sorted(development_candidates, key=lambda row: row["metrics"]["delta"], reverse=True)
        ],
    }


def compact(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key not in ("hits", "baselineHits")}


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baseline"]}/{value["n"]} ({value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidate"]}/{value["n"]} ({value["candidateAccuracy"]:.1f}%) ({value["delta"]:+d})'
    )


def table(rows: list[list[Any]], headers: list[str]) -> str:
    return "\n".join([
        f'| {" | ".join(headers)} |',
        f'| {" | ".join("---" for _ in headers)} |',
        *(f'| {" | ".join(str(value) for value in row)} |' for row in rows),
    ])


def main() -> None:
    BASE.seed_everything()
    dataset = BASE.build_dataset()
    splits = BASE.build_splits(dataset)
    open_result = evaluate_side(dataset, splits, "open")
    close_result = evaluate_side(dataset, splits, "close")
    aggregate = {}
    per_market = {}
    for block in ("development", "validation", "holdout", "forward"):
        indices = splits[block]
        aggregate[block] = {
            "open": BASE.metric(open_result["hits"], open_result["baselineHits"], indices),
            "close": BASE.metric(close_result["hits"], close_result["baselineHits"], indices),
            "jodi": BASE.metric(
                open_result["hits"] & close_result["hits"],
                open_result["baselineHits"] & close_result["baselineHits"],
                indices,
            ),
        }
    for market in BASE.MARKETS:
        per_market[market] = {}
        market_mask = dataset["markets"] == market
        for block in ("validation", "holdout", "forward"):
            indices = splits[block][market_mask[splits[block]]]
            per_market[market][block] = {
                "open": BASE.metric(open_result["hits"], open_result["baselineHits"], indices),
                "close": BASE.metric(close_result["hits"], close_result["baselineHits"], indices),
                "jodi": BASE.metric(
                    open_result["hits"] & close_result["hits"],
                    open_result["baselineHits"] & close_result["baselineHits"],
                    indices,
                ),
            }
    output = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "device": "cpu",
        "design": {
            "selection": "architecture/window/epoch selected on development only",
            "retraining": "expanding block-by-block; optional recent per-market window",
            "windows": WINDOWS,
            "epochs": EPOCHS,
            "validation": "validation, holdout, and forward do not choose hyperparameters",
        },
        "open": compact(open_result),
        "close": compact(close_result),
        "aggregate": aggregate,
        "perMarket": per_market,
    }
    OUTPUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    aggregate_rows = [[block, *(format_metric(aggregate[block][target]) for target in ("open", "close", "jodi"))] for block in aggregate]
    market_rows = [[market, *(format_metric(per_market[market]["forward"][target]) for target in ("open", "close", "jodi"))] for market in BASE.MARKETS]
    report = "\n".join([
        "# Rolling Causal ML Sutta Research",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        f"Device: CPU. Open: `{open_result['variant']}`. Close: `{close_result['variant']}`.",
        "",
        "Architecture, recent training window, and epoch count are selected on development only. The selected model is retrained using all data available before each later block. Validation, holdout, and the frozen forward week never select hyperparameters.",
        "",
        "## Aggregate",
        "",
        table(aggregate_rows, ["Block", "Open", "Close", "Jodi"]),
        "",
        "## Frozen forward by market",
        "",
        table(market_rows, ["Market", "Open", "Close", "Jodi"]),
        "",
        f"Promotion gate: Open `{open_result['promotable']}`, Close `{close_result['promotable']}`.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(report, encoding="utf-8")
    print(table(aggregate_rows, ["Block", "Open", "Close", "Jodi"]))
    print(f"\nSaved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
