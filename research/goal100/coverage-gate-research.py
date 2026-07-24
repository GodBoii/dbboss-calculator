"""Nested chronological research on a fixed Top-6 complement gate.

The gate predicts a baseline miss from information available before the target
draw. When active, the candidate keeps baseline ranks 1-2 and adds all four
digits excluded by the baseline Top-6. Model selection uses development only.
Validation, holdout, and recent-frozen blocks are evaluation-only.
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = Path(__file__).resolve().parent
INPUT = RESEARCH_DIR / "artifacts" / "causal-audit-all-blocks.json"
OUTPUT = RESEARCH_DIR / "artifacts" / "coverage-gate-research.json"
REPORT = RESEARCH_DIR / "COVERAGE_GATE.md"
SEED = 100_615
SIDES = ("open", "close")
EVAL_BLOCKS = ("validation", "holdout", "recentFrozen")
L2_VALUES = (0.001, 0.01, 0.1)
POSITIVE_WEIGHTS = (1.0, 1.5)
THRESHOLDS = (0.50, 0.60, 0.70, 0.80)
EPOCHS = 240


@dataclass(frozen=True)
class ModelConfig:
    l2: float
    positive_weight: float

    @property
    def name(self) -> str:
        return f"logistic:l2={self.l2:g}:positive_weight={self.positive_weight:g}"


@dataclass(frozen=True)
class GateConfig:
    model: ModelConfig | None
    threshold: float | None

    @property
    def name(self) -> str:
        if self.model is None:
            return "baseline-no-gate"
        return f"{self.model.name}:threshold={self.threshold:.2f}"


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def one_hot(value: int | None, size: int) -> list[float]:
    output = [0.0] * size
    if value is not None and 0 <= value < size:
        output[value] = 1.0
    return output


def complement_gate_set(baseline: list[int]) -> list[int]:
    excluded = [digit for digit in range(10) if digit not in baseline]
    candidate = baseline[:2] + excluded
    if len(candidate) != 6 or len(set(candidate)) != 6:
        raise RuntimeError(f"Invalid gate set from {baseline}: {candidate}")
    return candidate


def build_side_dataset(rows: list[dict[str, Any]], side: str, market_order: list[str]) -> dict[str, Any]:
    market_index = {market: index for index, market in enumerate(market_order)}
    ordered = sorted(rows, key=lambda row: (row["isoDate"], market_index[row["market"]]))
    histories: dict[str, list[dict[str, Any]]] = {market: [] for market in market_order}
    features: list[list[float]] = []
    labels: list[int] = []
    actuals: list[int] = []
    baselines: list[list[int]] = []
    gated_sets: list[list[int]] = []
    metadata: list[dict[str, Any]] = []

    for row in ordered:
        market = row["market"]
        history = histories[market]
        baseline = [int(value) for value in row["causal"][side]]
        actual = int(row["actual"][side])
        target_date = date.fromisoformat(row["isoDate"])
        previous_actuals = [int(item["actual"][side]) for item in history]
        previous_hits = [bool(item["causal"]["hits"][side]) for item in history]

        values: list[float] = []
        values.extend(one_hot(market_index[market], len(market_order)))
        values.extend(one_hot(target_date.weekday(), 7))
        values.extend([
            math.sin(2 * math.pi * target_date.day / 31),
            math.cos(2 * math.pi * target_date.day / 31),
            math.sin(2 * math.pi * target_date.month / 12),
            math.cos(2 * math.pi * target_date.month / 12),
        ])
        for rank in range(6):
            values.extend(one_hot(baseline[rank], 10))
        values.extend([1.0 if digit in baseline else 0.0 for digit in range(10)])
        for lag in (1, 2, 7):
            lag_value = previous_actuals[-lag] if len(previous_actuals) >= lag else None
            values.extend(one_hot(lag_value, 10))
        for lag in (1, 2, 3):
            values.append(float(previous_hits[-lag]) if len(previous_hits) >= lag else 0.5)
        for window in (7, 14, 30):
            recent = previous_hits[-window:]
            values.append(sum(recent) / len(recent) if recent else 0.5)
        miss_streak = 0
        for hit in reversed(previous_hits):
            if hit:
                break
            miss_streak += 1
        values.append(min(miss_streak, 10) / 10)
        for window in (7, 30):
            counts = [0] * 10
            recent_actuals = previous_actuals[-window:]
            for digit in recent_actuals:
                counts[digit] += 1
            denominator = max(1, len(recent_actuals))
            values.extend(count / denominator for count in counts)

        baseline_hit = actual in baseline
        features.append(values)
        labels.append(0 if baseline_hit else 1)
        actuals.append(actual)
        baselines.append(baseline)
        gated_sets.append(complement_gate_set(baseline))
        metadata.append({
            "market": market,
            "isoDate": row["isoDate"],
            "block": row["block"],
            "baselineHit": baseline_hit,
            "actual": actual,
        })
        history.append(row)

    return {
        "x": np.asarray(features, dtype=np.float32),
        "miss": np.asarray(labels, dtype=np.float32),
        "actual": np.asarray(actuals, dtype=np.int64),
        "baseline": np.asarray(baselines, dtype=np.int64),
        "gated": np.asarray(gated_sets, dtype=np.int64),
        "metadata": metadata,
    }


class LogisticGate(nn.Module):
    def __init__(self, width: int) -> None:
        super().__init__()
        self.linear = nn.Linear(width, 1)
        nn.init.zeros_(self.linear.weight)
        nn.init.zeros_(self.linear.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.linear(x).squeeze(1)


def fit_gate(
    x: np.ndarray,
    y: np.ndarray,
    train_indices: np.ndarray,
    config: ModelConfig,
) -> tuple[LogisticGate, np.ndarray, np.ndarray]:
    means = x[train_indices].mean(axis=0)
    scales = x[train_indices].std(axis=0)
    scales[scales < 1e-6] = 1.0
    standardized = (x - means) / scales
    model = LogisticGate(x.shape[1])
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.02, weight_decay=config.l2)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor(config.positive_weight))
    train_x = torch.from_numpy(standardized[train_indices])
    train_y = torch.from_numpy(y[train_indices])
    for _ in range(EPOCHS):
        optimizer.zero_grad()
        loss = loss_fn(model(train_x), train_y)
        loss.backward()
        optimizer.step()
    return model, means, scales


def probabilities(model: LogisticGate, means: np.ndarray, scales: np.ndarray, x: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        logits = model(torch.from_numpy((x - means) / scales))
        return torch.sigmoid(logits).numpy()


def predictions_for_config(
    dataset: dict[str, Any],
    config: GateConfig,
    probability_by_model: dict[str, np.ndarray],
) -> dict[str, Any]:
    baseline = dataset["baseline"]
    actual = dataset["actual"]
    if config.model is None:
        gate = np.zeros(len(actual), dtype=bool)
    else:
        gate = probability_by_model[config.model.name] >= float(config.threshold)
    picks = np.where(gate[:, None], dataset["gated"], baseline)
    hits = np.any(picks == actual[:, None], axis=1)
    return {"gate": gate, "picks": picks, "hits": hits}


def indices_for(dataset: dict[str, Any], block: str) -> np.ndarray:
    return np.asarray(
        [index for index, row in enumerate(dataset["metadata"]) if row["block"] == block],
        dtype=np.int64,
    )


def indices_for_dates(dataset: dict[str, Any], dates: set[str]) -> np.ndarray:
    return np.asarray(
        [index for index, row in enumerate(dataset["metadata"]) if row["isoDate"] in dates],
        dtype=np.int64,
    )


def hit_count(hits: np.ndarray, indices: np.ndarray) -> int:
    return int(np.sum(hits[indices]))


def per_market_delta(
    datasets: dict[str, dict[str, Any]],
    predictions: dict[str, dict[str, Any]],
    indices: dict[str, np.ndarray],
    market_order: list[str],
) -> dict[str, dict[str, int]]:
    output: dict[str, dict[str, int]] = {}
    for market in market_order:
        output[market] = {}
        side_masks = {}
        for side in SIDES:
            metadata = datasets[side]["metadata"]
            side_masks[side] = np.asarray([metadata[index]["market"] == market for index in indices[side]])
            market_indices = indices[side][side_masks[side]]
            baseline_hits = np.any(
                datasets[side]["baseline"] == datasets[side]["actual"][:, None], axis=1,
            )
            output[market][side] = hit_count(predictions[side]["hits"], market_indices) - hit_count(
                baseline_hits, market_indices,
            )
        open_indices = indices["open"][side_masks["open"]]
        close_indices = indices["close"][side_masks["close"]]
        if not np.array_equal(open_indices, close_indices):
            raise RuntimeError(f"Open/Close index alignment failed for {market}")
        baseline_open = np.any(
            datasets["open"]["baseline"] == datasets["open"]["actual"][:, None], axis=1,
        )
        baseline_close = np.any(
            datasets["close"]["baseline"] == datasets["close"]["actual"][:, None], axis=1,
        )
        candidate_jodi = predictions["open"]["hits"] & predictions["close"]["hits"]
        baseline_jodi = baseline_open & baseline_close
        output[market]["jodi"] = hit_count(candidate_jodi, open_indices) - hit_count(baseline_jodi, open_indices)
    return output


def selection_score(
    datasets: dict[str, dict[str, Any]],
    open_prediction: dict[str, Any],
    close_prediction: dict[str, Any],
    selection_indices: dict[str, np.ndarray],
    market_order: list[str],
) -> tuple[tuple[int, int, int], dict[str, dict[str, int]]] | None:
    predictions = {"open": open_prediction, "close": close_prediction}
    market_delta = per_market_delta(datasets, predictions, selection_indices, market_order)
    if any(value[target] < 0 for value in market_delta.values() for target in ("open", "close", "jodi")):
        return None
    baseline_open = np.any(datasets["open"]["baseline"] == datasets["open"]["actual"][:, None], axis=1)
    baseline_close = np.any(datasets["close"]["baseline"] == datasets["close"]["actual"][:, None], axis=1)
    open_delta = hit_count(open_prediction["hits"], selection_indices["open"]) - hit_count(
        baseline_open, selection_indices["open"],
    )
    close_delta = hit_count(close_prediction["hits"], selection_indices["close"]) - hit_count(
        baseline_close, selection_indices["close"],
    )
    candidate_jodi = open_prediction["hits"] & close_prediction["hits"]
    baseline_jodi = baseline_open & baseline_close
    jodi_delta = hit_count(candidate_jodi, selection_indices["open"]) - hit_count(
        baseline_jodi, selection_indices["open"],
    )
    gates = int(np.sum(open_prediction["gate"][selection_indices["open"]])) + int(
        np.sum(close_prediction["gate"][selection_indices["close"]]),
    )
    return (jodi_delta, open_delta + close_delta, -gates), market_delta


def metric(candidate: np.ndarray, baseline: np.ndarray, indices: np.ndarray, gates: np.ndarray) -> dict[str, Any]:
    n = len(indices)
    baseline_hits = hit_count(baseline, indices)
    candidate_hits = hit_count(candidate, indices)
    return {
        "n": int(n),
        "baselineHits": baseline_hits,
        "candidateHits": candidate_hits,
        "delta": candidate_hits - baseline_hits,
        "baselineAccuracy": baseline_hits / n if n else None,
        "candidateAccuracy": candidate_hits / n if n else None,
        "gateCount": int(np.sum(gates[indices])),
    }


def evaluate(
    datasets: dict[str, dict[str, Any]],
    predictions: dict[str, dict[str, Any]],
    market_order: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    baseline_open = np.any(datasets["open"]["baseline"] == datasets["open"]["actual"][:, None], axis=1)
    baseline_close = np.any(datasets["close"]["baseline"] == datasets["close"]["actual"][:, None], axis=1)
    baseline_jodi = baseline_open & baseline_close
    candidate_jodi = predictions["open"]["hits"] & predictions["close"]["hits"]
    aggregate: dict[str, Any] = {}
    by_market: dict[str, Any] = {market: {} for market in market_order}
    for block in ("development", *EVAL_BLOCKS):
        block_indices = {side: indices_for(datasets[side], block) for side in SIDES}
        if not np.array_equal(block_indices["open"], block_indices["close"]):
            raise RuntimeError(f"Open/Close block alignment failed for {block}")
        indices = block_indices["open"]
        aggregate[block] = {
            "open": metric(predictions["open"]["hits"], baseline_open, indices, predictions["open"]["gate"]),
            "close": metric(predictions["close"]["hits"], baseline_close, indices, predictions["close"]["gate"]),
            "jodi": metric(
                candidate_jodi,
                baseline_jodi,
                indices,
                predictions["open"]["gate"] | predictions["close"]["gate"],
            ),
        }
        for market in market_order:
            market_indices = indices[np.asarray([
                datasets["open"]["metadata"][index]["market"] == market for index in indices
            ])]
            by_market[market][block] = {
                "open": metric(predictions["open"]["hits"], baseline_open, market_indices, predictions["open"]["gate"]),
                "close": metric(predictions["close"]["hits"], baseline_close, market_indices, predictions["close"]["gate"]),
                "jodi": metric(
                    candidate_jodi,
                    baseline_jodi,
                    market_indices,
                    predictions["open"]["gate"] | predictions["close"]["gate"],
                ),
            }
    return aggregate, by_market


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baselineHits"]}/{value["n"]} '
        f'({100 * value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidateHits"]}/{value["n"]} '
        f'({100 * value["candidateAccuracy"]:.1f}%), '
        f'delta {value["delta"]:+d}, gates {value["gateCount"]}'
    )


def render_report(output: dict[str, Any]) -> str:
    lines = [
        "# Goal100 Coverage-State Gate Research",
        "",
        f'Generated: {output["generatedAt"]}',
        "",
        "## Frozen design",
        "",
        "A gate predicts whether the baseline Top-6 will miss. When active, it emits the four baseline-excluded digits plus baseline ranks 1-2, preserving exactly six distinct digits. Features contain only market/calendar state, the current causal baseline ranking, completed own-market lags, and trailing baseline hit history.",
        "",
        f'Inner development searched {output["selection"]["sideVariantCount"]} variants per side and {output["selection"]["pairCount"]} Open/Close pairs. Selection required non-regression for Open, Close, and Jodi in every market inside the development-selection fold. Validation, holdout, and recent-frozen results did not select or modify the pair.',
        "",
        f'Open selection: `{output["selection"]["open"]}`',
        "",
        f'Close selection: `{output["selection"]["close"]}`',
        "",
        "## Aggregate",
        "",
        "| Block | Open | Close | Jodi |",
        "| --- | --- | --- | --- |",
    ]
    for block, metrics in output["aggregate"].items():
        lines.append(
            f'| {block} | {format_metric(metrics["open"])} | '
            f'{format_metric(metrics["close"])} | {format_metric(metrics["jodi"])} |'
        )
    lines.extend([
        "",
        "## Later-block market deltas",
        "",
        "| Market | Block | Open delta | Close delta | Jodi delta |",
        "| --- | --- | ---: | ---: | ---: |",
    ])
    for market, blocks in output["byMarket"].items():
        for block in EVAL_BLOCKS:
            metrics = blocks[block]
            lines.append(
                f'| {market} | {block} | {metrics["open"]["delta"]:+d} | '
                f'{metrics["close"]["delta"]:+d} | {metrics["jodi"]["delta"]:+d} |'
            )
    lines.extend([
        "",
        "## Decision",
        "",
        output["decision"],
        "",
        "This is retrospective evidence. All historical rows were inspected by earlier research, so even a passing result would require a newly sealed cohort before any accuracy claim.",
        "",
        f'Input audit SHA-256: `{output["inputSha256"]}`',
        "",
        "No production files were modified.",
        "",
    ])
    return "\n".join(lines)


def main() -> None:
    seed_everything()
    audit = json.loads(INPUT.read_text(encoding="utf-8"))
    market_order = list(audit["markets"])
    datasets = {side: build_side_dataset(audit["ledger"], side, market_order) for side in SIDES}
    open_alignment = [
        (row["market"], row["isoDate"], row["block"]) for row in datasets["open"]["metadata"]
    ]
    close_alignment = [
        (row["market"], row["isoDate"], row["block"]) for row in datasets["close"]["metadata"]
    ]
    if open_alignment != close_alignment:
        raise RuntimeError("Open and Close rows are not aligned")

    development_dates = sorted({
        row["isoDate"] for row in datasets["open"]["metadata"] if row["block"] == "development"
    })
    split_at = int(len(development_dates) * 0.60)
    inner_train_dates = set(development_dates[:split_at])
    inner_select_dates = set(development_dates[split_at:])
    inner_train = {side: indices_for_dates(datasets[side], inner_train_dates) for side in SIDES}
    inner_select = {side: indices_for_dates(datasets[side], inner_select_dates) for side in SIDES}

    model_configs = [ModelConfig(l2, weight) for l2 in L2_VALUES for weight in POSITIVE_WEIGHTS]
    gate_configs = [GateConfig(None, None)] + [
        GateConfig(model, threshold) for model in model_configs for threshold in THRESHOLDS
    ]
    inner_probabilities: dict[str, dict[str, np.ndarray]] = {side: {} for side in SIDES}
    for side in SIDES:
        dataset = datasets[side]
        for config in model_configs:
            model, means, scales = fit_gate(dataset["x"], dataset["miss"], inner_train[side], config)
            inner_probabilities[side][config.name] = probabilities(model, means, scales, dataset["x"])

    side_predictions: dict[str, dict[str, dict[str, Any]]] = {side: {} for side in SIDES}
    for side in SIDES:
        for config in gate_configs:
            side_predictions[side][config.name] = predictions_for_config(
                datasets[side], config, inner_probabilities[side],
            )

    best_score: tuple[int, int, int] | None = None
    selected_pair = (gate_configs[0], gate_configs[0])
    selected_market_delta: dict[str, dict[str, int]] = {}
    qualifying_pairs = 0
    for open_config in gate_configs:
        for close_config in gate_configs:
            result = selection_score(
                datasets,
                side_predictions["open"][open_config.name],
                side_predictions["close"][close_config.name],
                inner_select,
                market_order,
            )
            if result is None:
                continue
            qualifying_pairs += 1
            score, market_delta = result
            if best_score is None or score > best_score:
                best_score = score
                selected_pair = (open_config, close_config)
                selected_market_delta = market_delta

    final_probabilities: dict[str, dict[str, np.ndarray]] = {side: {} for side in SIDES}
    development_indices = {side: indices_for(datasets[side], "development") for side in SIDES}
    for side, config in zip(SIDES, selected_pair, strict=True):
        if config.model is None:
            continue
        model, means, scales = fit_gate(
            datasets[side]["x"], datasets[side]["miss"], development_indices[side], config.model,
        )
        final_probabilities[side][config.model.name] = probabilities(
            model, means, scales, datasets[side]["x"],
        )
    final_predictions = {
        side: predictions_for_config(datasets[side], config, final_probabilities[side])
        for side, config in zip(SIDES, selected_pair, strict=True)
    }
    aggregate, by_market = evaluate(datasets, final_predictions, market_order)

    later_non_regression = all(
        by_market[market][block][target]["delta"] >= 0
        for market in market_order
        for block in EVAL_BLOCKS
        for target in ("open", "close", "jodi")
    )
    any_later_gain = any(
        aggregate[block][target]["delta"] > 0
        for block in EVAL_BLOCKS
        for target in ("open", "close", "jodi")
    )
    promotable = later_non_regression and any_later_gain and any(
        config.model is not None for config in selected_pair
    )
    if promotable:
        decision = (
            "PASS RETROSPECTIVE GATE ONLY: the frozen pair is eligible for a new sealed-forward research cohort, "
            "but it is not proven and cannot be promoted to production."
        )
    elif all(config.model is None for config in selected_pair):
        decision = (
            "REJECT: nested development found no all-market non-regressive gated pair better than the baseline; "
            "the deterministic selection therefore froze the no-gate control."
        )
    else:
        decision = (
            "REJECT: the development-selected gate failed at least one later-block or per-market non-regression gate. "
            "No thresholds or weights were retuned after seeing that failure."
        )

    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "researchOnly": True,
        "evaluationType": "nested-development-selection-retrospective-evaluation",
        "input": str(INPUT.relative_to(ROOT)).replace("\\", "/"),
        "inputSha256": sha256(INPUT),
        "seed": SEED,
        "design": {
            "predictionSet": "baseline top2 plus all four excluded digits when gated; otherwise baseline top6",
            "innerSplit": {
                "trainDates": [development_dates[0], development_dates[split_at - 1]],
                "selectionDates": [development_dates[split_at], development_dates[-1]],
                "trainRows": int(len(inner_train["open"])),
                "selectionRows": int(len(inner_select["open"])),
            },
            "features": (
                "market, weekday, cyclical calendar, ordered causal baseline Top6, set mask, own actual lags 1/2/7, "
                "prior hit indicators, rolling hit rates, miss streak, and trailing actual-digit frequencies"
            ),
            "model": "fixed-epoch L2 logistic miss classifier",
            "laterBlocks": list(EVAL_BLOCKS),
            "noLaterTuning": True,
        },
        "selection": {
            "sideVariantCount": len(gate_configs),
            "pairCount": len(gate_configs) ** 2,
            "qualifyingPairs": qualifying_pairs,
            "score": best_score,
            "open": selected_pair[0].name,
            "close": selected_pair[1].name,
            "innerSelectionMarketDeltas": selected_market_delta,
        },
        "aggregate": aggregate,
        "byMarket": by_market,
        "promotableToSealedForwardResearch": promotable,
        "decision": decision,
    }
    OUTPUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    REPORT.write_text(render_report(output), encoding="utf-8")
    print(f"Open: {selected_pair[0].name}")
    print(f"Close: {selected_pair[1].name}")
    for block, metrics in aggregate.items():
        print(
            block,
            "|",
            " | ".join(f"{side}: {format_metric(metrics[side])}" for side in ("open", "close", "jodi")),
        )
    print(decision)
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
