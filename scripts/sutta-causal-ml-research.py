"""Causal shared classifiers for Top-6 Open/Close Sutta research.

Features contain only calendar data, frozen production rankings, completed own
lags, previous cross-market draws, and earlier same-day markets. Architectures
are selected on development, checked on validation/holdout, then retrained on
all pre-forward history for one frozen forward-week score.
"""

from __future__ import annotations

import bisect
import copy
import importlib.util
import json
import random
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
FEATURE_MODULE_PATH = ROOT / "scripts" / "sutta-model-research.py"
HISTORICAL_LEDGER = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD_LEDGER = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-causal-ml-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-13" / "sutta-causal-ml-research.md"
SEED = 950613
LAGS = (1, 2, 3, 5, 7)


def load_feature_module():
    spec = importlib.util.spec_from_file_location("sutta_model_research_ml", FEATURE_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {FEATURE_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FEATURES = load_feature_module()
MARKETS = FEATURES.MARKETS
MARKET_INDEX = {market: index for index, market in enumerate(MARKETS)}
DAY_INDEX = FEATURES.DAY_OFFSET
OPEN_MINUTE = {
    "Sridevi": 695, "Time Bazar": 790, "Madhur Day": 810, "Rajdhani Day": 905,
    "Milan Day": 910, "Kalyan": 945, "Sridevi Night": 1155, "Madhur Night": 1230,
    "Milan Night": 1265, "Rajdhani Night": 1295, "Kalyan Night": 1305, "Main Bazar": 1320,
}
CLOSE_MINUTE = {
    "Sridevi": 755, "Time Bazar": 850, "Madhur Day": 870, "Rajdhani Day": 1025,
    "Milan Day": 1030, "Kalyan": 1065, "Sridevi Night": 1215, "Madhur Night": 1350,
    "Milan Night": 1385, "Rajdhani Night": 1415, "Kalyan Night": 1425, "Main Bazar": 1450,
}


@dataclass(frozen=True)
class Config:
    kind: str
    embedding: int
    hidden: int
    dropout: float
    weight_decay: float
    learning_rate: float
    max_epochs: int

    @property
    def name(self) -> str:
        if self.kind == "additive":
            return f"additive:wd{self.weight_decay:g}"
        return f"mlp:e{self.embedding}:h{self.hidden}:d{self.dropout:g}:wd{self.weight_decay:g}"


CONFIGS = (
    Config("additive", 10, 0, 0.0, 1e-3, 0.03, 60),
    Config("additive", 10, 0, 0.0, 1e-2, 0.03, 60),
    Config("mlp", 4, 48, 0.15, 1e-3, 0.01, 45),
    Config("mlp", 4, 64, 0.30, 3e-3, 0.01, 45),
)


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


def read_ledger(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["ledger"]


def panel_values(panel: str | None) -> list[int]:
    text = str(panel or "")
    if len(text) != 3 or not text.isdigit():
        return [10, 10, 10]
    return [int(value) for value in text]


def raw_record_values(record: dict[str, Any] | None) -> list[int]:
    if record is None:
        return [10] * 8
    return [
        int(record["openSutta"]), int(record["closeSutta"]),
        *panel_values(record.get("openPanel")),
        *panel_values(record.get("closePanel")),
    ]


def build_dataset() -> dict[str, Any]:
    raw_cache = json.loads((ROOT / "scratch" / "sutta-research-records.json").read_text(encoding="utf-8"))
    cache_rows = FEATURES.load_rows()
    cache_dates = {market: [row.iso for row in rows] for market, rows in cache_rows.items()}
    raw_maps = {}
    for market in MARKETS:
        raw_maps[market] = {}
        for record in raw_cache[market]:
            iso = FEATURES.iso_date(record)
            raw_maps[market][iso] = record

    historical = read_ledger(HISTORICAL_LEDGER)
    forward = read_ledger(FORWARD_LEDGER)
    combined = [(row, False) for row in historical] + [(row, True) for row in forward]
    combined.sort(key=lambda item: (item[0]["isoDate"], MARKET_INDEX[item[0]["market"]]))

    cardinalities = [len(MARKETS), 7, 31] + [10] * 12
    cardinalities += [11] * (len(LAGS) * 8)
    cardinalities += [11] * (len(MARKETS) * 8)
    cardinalities += [11] * (len(MARKETS) * 8)

    features = []
    labels_open = []
    labels_close = []
    base_open = []
    base_close = []
    markets = []
    dates = []
    is_forward = []

    for ledger_row, forward_row in combined:
        market = ledger_row["market"]
        iso = ledger_row["isoDate"]
        own_dates = cache_dates[market]
        own_index = bisect.bisect_left(own_dates, iso)
        if own_index < 50 or own_index >= len(own_dates) or own_dates[own_index] != iso:
            continue
        target = cache_rows[market][own_index]
        values = [MARKET_INDEX[market], DAY_INDEX[target.day], date.fromisoformat(iso).day - 1]
        values.extend(int(value) for value in ledger_row["openRanking"])
        values.extend(int(value) for value in ledger_row["closeRanking"])

        for lag in LAGS:
            lag_row = cache_rows[market][own_index - lag] if own_index >= lag else None
            values.extend(raw_record_values(raw_maps[market].get(lag_row.iso) if lag_row else None))

        for source_market in MARKETS:
            source_dates = cache_dates[source_market]
            source_index = bisect.bisect_left(source_dates, iso) - 1
            previous = cache_rows[source_market][source_index] if source_index >= 0 else None
            values.extend(raw_record_values(raw_maps[source_market].get(previous.iso) if previous else None))

        for source_market in MARKETS:
            same_day = raw_maps[source_market].get(iso) if CLOSE_MINUTE[source_market] < OPEN_MINUTE[market] else None
            values.extend(raw_record_values(same_day))

        if len(values) != len(cardinalities):
            raise RuntimeError(f"Feature width mismatch: {len(values)} != {len(cardinalities)}")
        features.append(values)
        labels_open.append(int(ledger_row["actualOpen"]))
        labels_close.append(int(ledger_row["actualClose"]))
        base_open.append([int(value) for value in ledger_row["openRanking"]])
        base_close.append([int(value) for value in ledger_row["closeRanking"]])
        markets.append(market)
        dates.append(iso)
        is_forward.append(forward_row)

    x = np.asarray(features, dtype=np.int64)
    offsets = np.cumsum([0] + cardinalities[:-1], dtype=np.int64)
    x_offset = x + offsets[None, :]
    return {
        "x": x_offset,
        "totalCategories": int(sum(cardinalities)),
        "open": np.asarray(labels_open, dtype=np.int64),
        "close": np.asarray(labels_close, dtype=np.int64),
        "baseOpen": np.asarray(base_open, dtype=np.int64),
        "baseClose": np.asarray(base_close, dtype=np.int64),
        "markets": np.asarray(markets),
        "dates": np.asarray(dates),
        "forward": np.asarray(is_forward, dtype=bool),
    }


def build_splits(dataset: dict[str, Any]) -> dict[str, np.ndarray]:
    blocks = {name: [] for name in ("train", "development", "validation", "holdout", "historical", "forward")}
    for market in MARKETS:
        historical_indices = np.flatnonzero((dataset["markets"] == market) & ~dataset["forward"])
        forward_indices = np.flatnonzero((dataset["markets"] == market) & dataset["forward"])
        n = len(historical_indices)
        train_end = int(n * 0.50)
        dev_end = int(n * 0.70)
        val_end = int(n * 0.85)
        blocks["train"].extend(historical_indices[:train_end])
        blocks["development"].extend(historical_indices[train_end:dev_end])
        blocks["validation"].extend(historical_indices[dev_end:val_end])
        blocks["holdout"].extend(historical_indices[val_end:])
        blocks["historical"].extend(historical_indices)
        blocks["forward"].extend(forward_indices)
    return {name: np.asarray(sorted(indices), dtype=np.int64) for name, indices in blocks.items()}


class CategoricalModel(nn.Module):
    def __init__(self, categories: int, fields: int, config: Config) -> None:
        super().__init__()
        self.kind = config.kind
        if config.kind == "additive":
            self.embedding = nn.Embedding(categories, 10)
            self.bias = nn.Parameter(torch.zeros(10))
            nn.init.zeros_(self.embedding.weight)
        else:
            self.embedding = nn.Embedding(categories, config.embedding)
            nn.init.normal_(self.embedding.weight, mean=0.0, std=0.02)
            self.network = nn.Sequential(
                nn.Linear(fields * config.embedding, config.hidden),
                nn.ReLU(),
                nn.Dropout(config.dropout),
                nn.Linear(config.hidden, 10),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        embedded = self.embedding(x)
        if self.kind == "additive":
            return embedded.sum(dim=1) + self.bias
        return self.network(embedded.flatten(start_dim=1))


def hybrid_predictions(logits: np.ndarray, base: np.ndarray) -> np.ndarray:
    ordering = np.argsort(-logits, axis=1, kind="stable")
    output = np.zeros((len(base), 6), dtype=np.int64)
    for index in range(len(base)):
        picks = list(base[index, :4])
        picks.extend(int(digit) for digit in ordering[index] if digit not in picks)
        output[index] = picks[:6]
    return output


def prediction_hits(logits: np.ndarray, base: np.ndarray, labels: np.ndarray) -> np.ndarray:
    predictions = hybrid_predictions(logits, base)
    return np.any(predictions == labels[:, None], axis=1)


def train_model(
    dataset: dict[str, Any], side: str, config: Config, train_indices: np.ndarray,
    development_indices: np.ndarray | None, fixed_epochs: int | None = None,
) -> tuple[CategoricalModel, int]:
    seed_everything()
    model = CategoricalModel(dataset["totalCategories"], dataset["x"].shape[1], config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    loss_fn = nn.CrossEntropyLoss()
    x = torch.from_numpy(dataset["x"])
    labels_np = dataset[side]
    labels = torch.from_numpy(labels_np)
    base = dataset[f"base{side.title()}"]
    epochs = fixed_epochs or config.max_epochs
    best_score = -1
    best_epoch = epochs
    best_state = None
    patience = 10
    stale = 0

    for epoch in range(1, epochs + 1):
        model.train()
        order = torch.from_numpy(np.random.permutation(train_indices))
        for start in range(0, len(order), 512):
            batch = order[start:start + 512]
            optimizer.zero_grad()
            loss = loss_fn(model(x[batch]), labels[batch])
            loss.backward()
            optimizer.step()
        if development_indices is None:
            continue
        model.eval()
        with torch.no_grad():
            logits = model(x[development_indices]).cpu().numpy()
        hits = prediction_hits(logits, base[development_indices], labels_np[development_indices])
        score = int(np.sum(hits))
        if score > best_score:
            best_score = score
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch


def model_logits(model: CategoricalModel, x: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        return model(torch.from_numpy(x)).cpu().numpy()


def metric(hits: np.ndarray, baseline: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    n = len(indices)
    candidate_hits = int(np.sum(hits[indices]))
    baseline_hits = int(np.sum(baseline[indices]))
    return {
        "n": int(n),
        "baseline": baseline_hits,
        "candidate": candidate_hits,
        "delta": candidate_hits - baseline_hits,
        "baselineAccuracy": round(100 * baseline_hits / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate_hits / n, 3) if n else 0.0,
    }


def evaluate_side(dataset: dict[str, Any], splits: dict[str, np.ndarray], side: str) -> dict[str, Any]:
    baseline = np.any(dataset[f"base{side.title()}"] == dataset[side][:, None], axis=1)
    candidates = []
    for config in CONFIGS:
        model, best_epoch = train_model(dataset, side, config, splits["train"], splits["development"])
        logits = model_logits(model, dataset["x"])
        hits = prediction_hits(logits, dataset[f"base{side.title()}"], dataset[side])
        candidates.append({
            "config": config,
            "bestEpoch": best_epoch,
            "development": metric(hits, baseline, splits["development"]),
            "validation": metric(hits, baseline, splits["validation"]),
            "holdout": metric(hits, baseline, splits["holdout"]),
            "hits": hits,
        })
    selected = max(candidates, key=lambda row: (row["development"]["delta"], row["development"]["candidate"], -CONFIGS.index(row["config"])))
    full_historical = np.concatenate([splits[name] for name in ("train", "development", "validation", "holdout")])
    forward_model, _ = train_model(
        dataset, side, selected["config"], full_historical, None, fixed_epochs=selected["bestEpoch"],
    )
    forward_logits = model_logits(forward_model, dataset["x"])
    forward_hits = prediction_hits(forward_logits, dataset[f"base{side.title()}"], dataset[side])
    selected_metrics = {
        "development": selected["development"],
        "validation": selected["validation"],
        "holdout": selected["holdout"],
        "forward": metric(forward_hits, baseline, splits["forward"]),
    }
    return {
        "config": selected["config"].name,
        "bestEpoch": selected["bestEpoch"],
        "metrics": selected_metrics,
        "historicalHits": selected["hits"],
        "forwardHits": forward_hits,
        "baselineHits": baseline,
        "promotable": (
            selected_metrics["development"]["delta"] > 0
            and selected_metrics["validation"]["delta"] >= 0
            and selected_metrics["holdout"]["delta"] >= 0
            and selected_metrics["forward"]["delta"] >= 0
        ),
        "candidates": [{
            "config": row["config"].name,
            "bestEpoch": row["bestEpoch"],
            "development": row["development"],
            "validation": row["validation"],
            "holdout": row["holdout"],
        } for row in candidates],
    }


def per_market_metrics(
    dataset: dict[str, Any], splits: dict[str, np.ndarray], open_result: dict[str, Any], close_result: dict[str, Any],
) -> dict[str, Any]:
    output = {}
    for market in MARKETS:
        output[market] = {}
        market_mask = dataset["markets"] == market
        for block in ("validation", "holdout", "forward"):
            indices = splits[block][market_mask[splits[block]]]
            open_hits = open_result["forwardHits"] if block == "forward" else open_result["historicalHits"]
            close_hits = close_result["forwardHits"] if block == "forward" else close_result["historicalHits"]
            baseline_open = open_result["baselineHits"]
            baseline_close = close_result["baselineHits"]
            output[market][block] = {
                "open": metric(open_hits, baseline_open, indices),
                "close": metric(close_hits, baseline_close, indices),
                "jodi": metric(open_hits & close_hits, baseline_open & baseline_close, indices),
            }
    return output


def compact(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key not in ("historicalHits", "forwardHits", "baselineHits")}


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
    seed_everything()
    dataset = build_dataset()
    splits = build_splits(dataset)
    open_result = evaluate_side(dataset, splits, "open")
    close_result = evaluate_side(dataset, splits, "close")
    per_market = per_market_metrics(dataset, splits, open_result, close_result)
    aggregate = {}
    for block in ("development", "validation", "holdout", "forward"):
        open_hits = open_result["forwardHits"] if block == "forward" else open_result["historicalHits"]
        close_hits = close_result["forwardHits"] if block == "forward" else close_result["historicalHits"]
        indices = splits[block]
        aggregate[block] = {
            "open": metric(open_hits, open_result["baselineHits"], indices),
            "close": metric(close_hits, close_result["baselineHits"], indices),
            "jodi": metric(
                open_hits & close_hits,
                open_result["baselineHits"] & close_result["baselineHits"],
                indices,
            ),
        }
    output = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "device": "cpu",
        "design": {
            "historicalLedger": str(HISTORICAL_LEDGER),
            "forwardLedger": str(FORWARD_LEDGER),
            "selection": "architecture and epoch selected on development only",
            "features": "calendar, production ranks, own lags, previous cross-market, earlier same-day markets",
            "split": "per market 50% train / 20% development / 15% validation / 15% holdout / frozen forward",
        },
        "open": compact(open_result),
        "close": compact(close_result),
        "aggregate": aggregate,
        "perMarket": per_market,
    }
    OUTPUT.write_text(json.dumps(output, indent=2), encoding="utf-8")
    aggregate_rows = [[block, *(format_metric(aggregate[block][target]) for target in ("open", "close", "jodi"))] for block in aggregate]
    market_rows = [[market, *(format_metric(per_market[market]["forward"][target]) for target in ("open", "close", "jodi"))] for market in MARKETS]
    report = "\n".join([
        "# Causal ML Sutta Research",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        f"Device: CPU (CUDA unavailable). Open model: `{open_result['config']}` at epoch {open_result['bestEpoch']}. Close model: `{close_result['config']}` at epoch {close_result['bestEpoch']}.",
        "",
        "All features are known before the target draw. Architecture and epoch are selected only on development. Validation, chronological holdout, and the frozen forward week do not select the model.",
        "",
        "## Aggregate",
        "",
        table(aggregate_rows, ["Block", "Open", "Close", "Jodi"]),
        "",
        "## Frozen forward by market",
        "",
        table(market_rows, ["Market", "Open", "Close", "Jodi"]),
        "",
        f"Promotion gate: Open `{open_result['promotable']}`, Close `{close_result['promotable']}`. Both sides and derived Jodi must remain non-regressive before production integration.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(report, encoding="utf-8")
    print(table(aggregate_rows, ["Block", "Open", "Close", "Jodi"]))
    print(f"\nSaved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
