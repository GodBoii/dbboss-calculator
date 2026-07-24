"""Leakage-safe Top-3 research for Open, Close, adjusted Close, and exact Jodi.

This reuses the causal feature matrix and chronological market splits from the
existing audit. Hyperparameters and epoch counts are selected on development
only. Validation, holdout, and the frozen forward block never select a model.
"""

from __future__ import annotations

import copy
import importlib.util
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts" / "sutta-causal-ml-research.py"
OUTPUT = ROOT / "scratch" / "sutta-top3-ml-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-ml-research.md"
SEED = 3150715
TOP_K = 3


def load_base():
    spec = importlib.util.spec_from_file_location("sutta_top3_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


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
    Config("additive", 12, 0, 0.0, 1e-3, 0.03, 50),
    Config("additive", 12, 0, 0.0, 1e-2, 0.03, 50),
    Config("mlp", 4, 48, 0.15, 1e-3, 0.01, 40),
    Config("mlp", 4, 64, 0.30, 3e-3, 0.01, 40),
)


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


class Classifier(nn.Module):
    def __init__(self, categories: int, fields: int, classes: int, config: Config) -> None:
        super().__init__()
        self.kind = config.kind
        if config.kind == "additive":
            self.embedding = nn.Embedding(categories, classes)
            self.bias = nn.Parameter(torch.zeros(classes))
            nn.init.zeros_(self.embedding.weight)
        else:
            self.embedding = nn.Embedding(categories, config.embedding)
            nn.init.normal_(self.embedding.weight, mean=0.0, std=0.02)
            self.network = nn.Sequential(
                nn.Linear(fields * config.embedding, config.hidden),
                nn.ReLU(),
                nn.Dropout(config.dropout),
                nn.Linear(config.hidden, classes),
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        embedded = self.embedding(x)
        if self.kind == "additive":
            return embedded.sum(dim=1) + self.bias
        return self.network(embedded.flatten(start_dim=1))


def topk(logits: np.ndarray, k: int = TOP_K) -> np.ndarray:
    return np.argsort(-logits, axis=1, kind="stable")[:, :k]


def hits_from_logits(logits: np.ndarray, labels: np.ndarray) -> np.ndarray:
    return np.any(topk(logits) == labels[:, None], axis=1)


def train(
    x: np.ndarray,
    categories: int,
    labels: np.ndarray,
    classes: int,
    config: Config,
    train_indices: np.ndarray,
    development_indices: np.ndarray | None,
    fixed_epochs: int | None = None,
) -> tuple[Classifier, int]:
    seed_everything()
    model = Classifier(categories, x.shape[1], classes, config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    loss_fn = nn.CrossEntropyLoss()
    x_tensor = torch.from_numpy(x)
    y_tensor = torch.from_numpy(labels)
    epochs = fixed_epochs or config.max_epochs
    best_score = -1
    best_epoch = epochs
    best_state = None
    stale = 0

    for epoch in range(1, epochs + 1):
        model.train()
        order = torch.from_numpy(np.random.permutation(train_indices))
        for start in range(0, len(order), 512):
            batch = order[start:start + 512]
            optimizer.zero_grad()
            loss = loss_fn(model(x_tensor[batch]), y_tensor[batch])
            loss.backward()
            optimizer.step()
        if development_indices is None:
            continue
        model.eval()
        with torch.no_grad():
            logits = model(x_tensor[development_indices]).cpu().numpy()
        score = int(np.sum(hits_from_logits(logits, labels[development_indices])))
        if score > best_score:
            best_score = score
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= 8:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch


def logits(model: Classifier, x: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        return model(torch.from_numpy(x)).cpu().numpy()


def metric(candidate: np.ndarray, baseline: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    n = len(indices)
    candidate_hits = int(np.sum(candidate[indices]))
    baseline_hits = int(np.sum(baseline[indices]))
    return {
        "n": int(n),
        "baseline": baseline_hits,
        "candidate": candidate_hits,
        "delta": candidate_hits - baseline_hits,
        "baselineAccuracy": round(100 * baseline_hits / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate_hits / n, 3) if n else 0.0,
    }


def direct_jodi_baseline(dataset: dict[str, Any]) -> np.ndarray:
    """Three exact pairs from the frozen marginal ranking, not a 3x3 grid."""
    predictions = np.zeros((len(dataset["open"]), TOP_K), dtype=np.int64)
    for index, (opens, closes) in enumerate(zip(dataset["baseOpen"], dataset["baseClose"])):
        candidates = []
        for open_rank, open_digit in enumerate(opens):
            for close_rank, close_digit in enumerate(closes):
                candidates.append((open_rank + close_rank, max(open_rank, close_rank), open_rank, int(open_digit) * 10 + int(close_digit)))
        candidates.sort()
        predictions[index] = [item[-1] for item in candidates[:TOP_K]]
    labels = dataset["open"] * 10 + dataset["close"]
    return np.any(predictions == labels[:, None], axis=1)


def evaluate(
    name: str,
    x: np.ndarray,
    categories: int,
    labels: np.ndarray,
    classes: int,
    baseline: np.ndarray,
    splits: dict[str, np.ndarray],
) -> dict[str, Any]:
    candidates = []
    for config in CONFIGS:
        model, epoch = train(x, categories, labels, classes, config, splits["train"], splits["development"])
        candidate_hits = hits_from_logits(logits(model, x), labels)
        candidates.append({
            "config": config,
            "epoch": epoch,
            "hits": candidate_hits,
            "development": metric(candidate_hits, baseline, splits["development"]),
            "validation": metric(candidate_hits, baseline, splits["validation"]),
            "holdout": metric(candidate_hits, baseline, splits["holdout"]),
        })
    selected = max(candidates, key=lambda item: (item["development"]["delta"], item["development"]["candidate"], -CONFIGS.index(item["config"])))
    historical = np.concatenate([splits[key] for key in ("train", "development", "validation", "holdout")])
    forward_model, _ = train(x, categories, labels, classes, selected["config"], historical, None, selected["epoch"])
    forward_hits = hits_from_logits(logits(forward_model, x), labels)
    metrics = {
        "development": selected["development"],
        "validation": selected["validation"],
        "holdout": selected["holdout"],
        "forward": metric(forward_hits, baseline, splits["forward"]),
    }
    return {
        "target": name,
        "selectedConfig": selected["config"].name,
        "selectedEpoch": selected["epoch"],
        "metrics": metrics,
        "promotable": (
            metrics["development"]["delta"] > 0
            and metrics["validation"]["delta"] >= 0
            and metrics["holdout"]["delta"] >= 0
            and metrics["forward"]["delta"] >= 0
        ),
        "candidateSearch": [{
            "config": item["config"].name,
            "epoch": item["epoch"],
            "development": item["development"],
            "validation": item["validation"],
            "holdout": item["holdout"],
        } for item in candidates],
    }


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baseline"]}/{value["n"]} ({value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidate"]}/{value["n"]} ({value["candidateAccuracy"]:.1f}%) ({value["delta"]:+d})'
    )


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        "# Top-3 Causal ML Research",
        "",
        "Every prediction contains exactly three candidates. Open and Close are three digits; Jodi is three exact pairs (not a 3x3 rectangle). Adjusted Close may use the already-known current Open digit. Hyperparameters and stopping epochs are selected on development only.",
        "",
        "| Target | Model | Development | Validation | Holdout | Frozen forward | Promote |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target in payload["targets"]:
        metrics = target["metrics"]
        lines.append(
            f'| {target["target"]} | `{target["selectedConfig"]}` e{target["selectedEpoch"]} | '
            f'{format_metric(metrics["development"])} | {format_metric(metrics["validation"])} | '
            f'{format_metric(metrics["holdout"])} | {format_metric(metrics["forward"])} | '
            f'{"yes" if target["promotable"] else "no"} |'
        )
    lines.extend([
        "",
        "The baseline for Open and Close is the first three positions of the frozen production ranking. The exact-Jodi baseline chooses the three best rank-product pairs. Adjusted Close is compared with the pre-open Close top three, so a gain measures the value of revealing Open.",
        "",
        "A model is promotable only with a development gain and no regression on validation, chronological holdout, or frozen forward evidence.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    seed_everything()
    dataset = BASE.build_dataset()
    splits = BASE.build_splits(dataset)
    base_open = np.any(dataset["baseOpen"][:, :TOP_K] == dataset["open"][:, None], axis=1)
    base_close = np.any(dataset["baseClose"][:, :TOP_K] == dataset["close"][:, None], axis=1)

    adjusted_x = np.concatenate([
        dataset["x"],
        (dataset["open"] + dataset["totalCategories"])[:, None],
    ], axis=1)
    adjusted_categories = dataset["totalCategories"] + 10
    jodi_labels = dataset["open"] * 10 + dataset["close"]

    targets = [
        evaluate("Open", dataset["x"], dataset["totalCategories"], dataset["open"], 10, base_open, splits),
        evaluate("Close", dataset["x"], dataset["totalCategories"], dataset["close"], 10, base_close, splits),
        evaluate("Adjusted Close", adjusted_x, adjusted_categories, dataset["close"], 10, base_close, splits),
        evaluate("Exact Jodi", dataset["x"], dataset["totalCategories"], jodi_labels, 100, direct_jodi_baseline(dataset), splits),
    ]
    payload = {
        "schemaVersion": 1,
        "seed": SEED,
        "topK": TOP_K,
        "selection": "development only",
        "targets": targets,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    for target in targets:
        print(target["target"], target["selectedConfig"], target["selectedEpoch"])
        for block, value in target["metrics"].items():
            print(" ", block, format_metric(value))
        print("  promotable", target["promotable"])
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
