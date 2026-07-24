"""Panel-aware, leakage-safe Top-3 sutta research.

This experiment keeps the production application untouched. It augments the
existing causal matrix with whole-panel tokens and panel structure derived only
from completed prior draws (or earlier same-day markets). Adjusted Close has a
separate contract that may use the current, already-published Open panel.
"""

from __future__ import annotations

import bisect
import copy
import hashlib
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
CACHE = ROOT / "scratch" / "sutta-research-records.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-panel-aware-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-panel-aware-research.md"
SEED = 3150716
TOP_K = 3


def load_base():
    spec = importlib.util.spec_from_file_location("sutta_panel_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


@dataclass(frozen=True)
class Config:
    mode: str
    kind: str
    factors: int
    weight_decay: float
    learning_rate: float
    max_epochs: int = 35

    @property
    def name(self) -> str:
        return f"{self.mode}:{self.kind}:f{self.factors}:wd{self.weight_decay:g}"


CONFIGS = (
    Config("token", "additive", 0, 1e-2, 0.03),
    Config("structure", "additive", 0, 1e-2, 0.03),
    Config("token", "fm", 4, 1e-2, 0.015),
    Config("structure", "fm", 4, 1e-2, 0.015),
)


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


def valid_panel(panel: Any) -> str | None:
    text = str(panel or "")
    return text if len(text) == 3 and text.isdigit() else None


def panel_token(panel: Any, sorted_token: bool = False) -> int:
    text = valid_panel(panel)
    if text is None:
        return 1000
    return int("".join(sorted(text)) if sorted_token else text)


def panel_structure(panel: Any) -> list[int]:
    text = valid_panel(panel)
    if text is None:
        return [28, 3, 10]
    digits = [int(value) for value in text]
    return [sum(digits), len(set(digits)) - 1, max(digits) - min(digits)]


def record_features(record: dict[str, Any] | None, mode: str) -> tuple[list[int], list[int]]:
    open_panel = record.get("openPanel") if record else None
    close_panel = record.get("closePanel") if record else None
    values = [
        panel_token(open_panel),
        panel_token(close_panel),
        panel_token(open_panel, True),
        panel_token(close_panel, True),
    ]
    cardinalities = [1001, 1001, 1001, 1001]
    if mode == "structure":
        values.extend(panel_structure(open_panel))
        values.extend(panel_structure(close_panel))
        cardinalities.extend([29, 4, 11, 29, 4, 11])
    return values, cardinalities


def current_open_features(record: dict[str, Any] | None, mode: str) -> tuple[list[int], list[int]]:
    open_panel = record.get("openPanel") if record else None
    values = [panel_token(open_panel), panel_token(open_panel, True)]
    cardinalities = [1001, 1001]
    if mode == "structure":
        values.extend(panel_structure(open_panel))
        cardinalities.extend([29, 4, 11])
    return values, cardinalities


def augment_dataset(dataset: dict[str, Any], mode: str) -> tuple[np.ndarray, int, np.ndarray, int]:
    raw = json.loads(CACHE.read_text(encoding="utf-8"))
    cache_rows = BASE.FEATURES.load_rows()
    cache_dates = {market: [row.iso for row in rows] for market, rows in cache_rows.items()}
    raw_maps: dict[str, dict[str, dict[str, Any]]] = {}
    for market in BASE.MARKETS:
        raw_maps[market] = {BASE.FEATURES.iso_date(row): row for row in raw[market]}

    augmented: list[list[int]] = []
    current_open: list[list[int]] = []
    aug_cards: list[int] | None = None
    current_cards: list[int] | None = None

    for market, iso in zip(dataset["markets"], dataset["dates"]):
        market = str(market)
        iso = str(iso)
        own_dates = cache_dates[market]
        own_index = bisect.bisect_left(own_dates, iso)
        if own_index >= len(own_dates) or own_dates[own_index] != iso:
            raise RuntimeError(f"Missing target cache row: {market} {iso}")

        values: list[int] = []
        cards: list[int] = []
        for lag in BASE.LAGS:
            lag_row = cache_rows[market][own_index - lag] if own_index >= lag else None
            feature, cardinality = record_features(raw_maps[market].get(lag_row.iso) if lag_row else None, mode)
            values.extend(feature)
            cards.extend(cardinality)

        for source_market in BASE.MARKETS:
            source_dates = cache_dates[source_market]
            source_index = bisect.bisect_left(source_dates, iso) - 1
            previous = cache_rows[source_market][source_index] if source_index >= 0 else None
            feature, cardinality = record_features(
                raw_maps[source_market].get(previous.iso) if previous else None,
                mode,
            )
            values.extend(feature)
            cards.extend(cardinality)

        for source_market in BASE.MARKETS:
            same_day = (
                raw_maps[source_market].get(iso)
                if BASE.CLOSE_MINUTE[source_market] < BASE.OPEN_MINUTE[market]
                else None
            )
            feature, cardinality = record_features(same_day, mode)
            values.extend(feature)
            cards.extend(cardinality)

        target_record = raw_maps[market].get(iso)
        current_values, current_cardinality = current_open_features(target_record, mode)
        if aug_cards is None:
            aug_cards = cards
            current_cards = current_cardinality
        elif aug_cards != cards or current_cards != current_cardinality:
            raise RuntimeError("Panel feature schema changed between rows")
        augmented.append(values)
        current_open.append(current_values)

    if aug_cards is None or current_cards is None:
        raise RuntimeError("No panel rows were built")
    aug_array = np.asarray(augmented, dtype=np.int64)
    aug_offsets = np.cumsum([0] + aug_cards[:-1], dtype=np.int64)
    aug_offset = aug_array + aug_offsets[None, :] + dataset["totalCategories"]
    total = dataset["totalCategories"] + sum(aug_cards)
    x = np.concatenate([dataset["x"], aug_offset], axis=1)

    current_array = np.asarray(current_open, dtype=np.int64)
    current_offsets = np.cumsum([0] + current_cards[:-1], dtype=np.int64)
    current_offset = current_array + current_offsets[None, :] + total
    adjusted_x = np.concatenate(
        [x, (dataset["open"] + total + sum(current_cards))[:, None], current_offset],
        axis=1,
    )
    adjusted_total = total + sum(current_cards) + 10
    return x, total, adjusted_x, adjusted_total


class PanelClassifier(nn.Module):
    def __init__(self, categories: int, classes: int, config: Config) -> None:
        super().__init__()
        self.kind = config.kind
        self.linear = nn.Embedding(categories, classes)
        self.bias = nn.Parameter(torch.zeros(classes))
        nn.init.zeros_(self.linear.weight)
        if self.kind == "fm":
            self.factors = nn.Embedding(categories, config.factors)
            self.interaction = nn.Linear(config.factors, classes, bias=False)
            nn.init.normal_(self.factors.weight, mean=0.0, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        output = self.linear(x).sum(dim=1) + self.bias
        if self.kind == "fm":
            embedded = self.factors(x)
            summed = embedded.sum(dim=1)
            pairwise = 0.5 * (summed.square() - embedded.square().sum(dim=1))
            output = output + self.interaction(pairwise)
        return output


def topk(logits: np.ndarray) -> np.ndarray:
    return np.argsort(-logits, axis=1, kind="stable")[:, :TOP_K]


def hits(logits: np.ndarray, labels: np.ndarray) -> np.ndarray:
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
) -> tuple[PanelClassifier, int]:
    seed_everything()
    model = PanelClassifier(categories, classes, config)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
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
        for start in range(0, len(order), 384):
            batch = order[start:start + 384]
            optimizer.zero_grad()
            loss = loss_fn(model(x_tensor[batch]), y_tensor[batch])
            loss.backward()
            optimizer.step()
        if development_indices is None:
            continue
        model.eval()
        with torch.no_grad():
            score = int(np.sum(hits(model(x_tensor[development_indices]).cpu().numpy(), labels[development_indices])))
        if score > best_score:
            best_score = score
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= 6:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch


def infer(model: PanelClassifier, x: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        return model(torch.from_numpy(x)).cpu().numpy()


def metric(candidate: np.ndarray, baseline: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    n = len(indices)
    candidate_hits = int(candidate[indices].sum())
    baseline_hits = int(baseline[indices].sum())
    return {
        "n": int(n),
        "baseline": baseline_hits,
        "candidate": candidate_hits,
        "delta": candidate_hits - baseline_hits,
        "baselineAccuracy": round(100 * baseline_hits / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate_hits / n, 3) if n else 0.0,
    }


def direct_jodi_baseline(dataset: dict[str, Any]) -> np.ndarray:
    predictions = np.zeros((len(dataset["open"]), TOP_K), dtype=np.int64)
    for index, (opens, closes) in enumerate(zip(dataset["baseOpen"], dataset["baseClose"])):
        candidates = []
        for open_rank, open_digit in enumerate(opens):
            for close_rank, close_digit in enumerate(closes):
                candidates.append(
                    (
                        open_rank + close_rank,
                        max(open_rank, close_rank),
                        open_rank,
                        int(open_digit) * 10 + int(close_digit),
                    )
                )
        candidates.sort()
        predictions[index] = [item[-1] for item in candidates[:TOP_K]]
    labels = dataset["open"] * 10 + dataset["close"]
    return np.any(predictions == labels[:, None], axis=1)


def evaluate(
    name: str,
    features: dict[str, tuple[np.ndarray, int]],
    labels: np.ndarray,
    classes: int,
    baseline: np.ndarray,
    splits: dict[str, np.ndarray],
) -> dict[str, Any]:
    candidates = []
    for config in CONFIGS:
        x, categories = features[config.mode]
        model, epoch = train(x, categories, labels, classes, config, splits["train"], splits["development"])
        candidate_hits = hits(infer(model, x), labels)
        candidates.append(
            {
                "config": config,
                "epoch": epoch,
                "development": metric(candidate_hits, baseline, splits["development"]),
                "validation": metric(candidate_hits, baseline, splits["validation"]),
                "holdout": metric(candidate_hits, baseline, splits["holdout"]),
            }
        )
    selected = max(
        candidates,
        key=lambda item: (
            item["development"]["delta"],
            item["development"]["candidate"],
            -CONFIGS.index(item["config"]),
        ),
    )
    config = selected["config"]
    x, categories = features[config.mode]
    historical = splits["historical"]
    forward_model, _ = train(
        x,
        categories,
        labels,
        classes,
        config,
        historical,
        None,
        selected["epoch"],
    )
    forward_hits = hits(infer(forward_model, x), labels)
    metrics = {
        "development": selected["development"],
        "validation": selected["validation"],
        "holdout": selected["holdout"],
        "forward": metric(forward_hits, baseline, splits["forward"]),
    }
    promotable = (
        metrics["development"]["delta"] > 0
        and metrics["validation"]["delta"] >= 0
        and metrics["holdout"]["delta"] >= 0
        and metrics["forward"]["delta"] >= 0
    )
    meets_90 = all(value["candidateAccuracy"] >= 90.0 for value in metrics.values())
    return {
        "target": name,
        "selectedConfig": config.name,
        "selectedEpoch": selected["epoch"],
        "metrics": metrics,
        "promotable": promotable,
        "meets90PercentGate": meets_90,
        "candidateSearch": [
            {
                "config": item["config"].name,
                "epoch": item["epoch"],
                "development": item["development"],
                "validation": item["validation"],
                "holdout": item["holdout"],
            }
            for item in candidates
        ],
    }


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baseline"]}/{value["n"]} ({value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidate"]}/{value["n"]} ({value["candidateAccuracy"]:.1f}%) '
        f'({value["delta"]:+d})'
    )


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        "# Top-3 Panel-Aware Research",
        "",
        "Scope: research only. Production application and model files are not modified.",
        "",
        "This cycle represents completed prior panels as exact three-digit tokens, sorted tokens, and structural states (sum, unique-digit count, and span). It tests additive categorical models and factorization-machine interactions. Ordinary Open, Close, and exact Jodi use only information available before the target Open; adjusted Close may also use the current published Open panel.",
        "",
        f'Input cache SHA-256: `{payload["inputCacheSha256"]}`.',
        "",
        "| Target | Development-selected model | Development | Validation | Holdout | Frozen forward | Promote | 90% gate |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target in payload["targets"]:
        metrics = target["metrics"]
        lines.append(
            f'| {target["target"]} | `{target["selectedConfig"]}` e{target["selectedEpoch"]} | '
            f'{format_metric(metrics["development"])} | {format_metric(metrics["validation"])} | '
            f'{format_metric(metrics["holdout"])} | {format_metric(metrics["forward"])} | '
            f'{"yes" if target["promotable"] else "no"} | '
            f'{"pass" if target["meets90PercentGate"] else "fail"} |'
        )
    lines.extend(
        [
            "",
            "Model and representation are selected on development only. Validation, holdout, and the frozen forward week never select the winner. A candidate is promotable only with a development gain and no regression in every later block; the requested gate additionally requires at least 90% in every block.",
            "",
        ]
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    seed_everything()
    dataset = BASE.build_dataset()
    splits = BASE.build_splits(dataset)
    modes = {mode for mode in (config.mode for config in CONFIGS)}
    ordinary: dict[str, tuple[np.ndarray, int]] = {}
    adjusted: dict[str, tuple[np.ndarray, int]] = {}
    for mode in sorted(modes):
        x, categories, adjusted_x, adjusted_categories = augment_dataset(dataset, mode)
        ordinary[mode] = (x, categories)
        adjusted[mode] = (adjusted_x, adjusted_categories)

    base_open = np.any(dataset["baseOpen"][:, :TOP_K] == dataset["open"][:, None], axis=1)
    base_close = np.any(dataset["baseClose"][:, :TOP_K] == dataset["close"][:, None], axis=1)
    jodi_labels = dataset["open"] * 10 + dataset["close"]
    targets = [
        evaluate("Open", ordinary, dataset["open"], 10, base_open, splits),
        evaluate("Close", ordinary, dataset["close"], 10, base_close, splits),
        evaluate("Adjusted Close + Open panel", adjusted, dataset["close"], 10, base_close, splits),
        evaluate("Exact Jodi", ordinary, jodi_labels, 100, direct_jodi_baseline(dataset), splits),
    ]
    payload = {
        "schemaVersion": 1,
        "researchOnly": True,
        "seed": SEED,
        "topK": TOP_K,
        "selection": "development only",
        "inputCache": str(CACHE.relative_to(ROOT)).replace("\\", "/"),
        "inputCacheSha256": hashlib.sha256(CACHE.read_bytes()).hexdigest(),
        "rows": int(len(dataset["open"])),
        "splitRows": {name: int(len(indices)) for name, indices in splits.items()},
        "targets": targets,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    for target in targets:
        print(target["target"], target["selectedConfig"], f'e{target["selectedEpoch"]}')
        for block, value in target["metrics"].items():
            print(" ", block, format_metric(value))
        print("  promotable", target["promotable"], "90%", target["meets90PercentGate"])
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
