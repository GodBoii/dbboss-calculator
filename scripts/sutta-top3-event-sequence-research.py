"""Causal cross-market event-sequence research for fixed Top-3 contracts.

The model consumes the last completed market events in their actual temporal
order. It never sees the target event in the shared Open/Close/Jodi encoder.
Only the separately labelled adjusted-Close head receives the target Open panel.
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
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "scripts" / "sutta-causal-ml-research.py"
CACHE = ROOT / "scratch" / "sutta-research-records.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-event-sequence-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-event-sequence-research.md"
SEED = 3150717
TOP_K = 3
SEQUENCE_LENGTH = 64


def load_base():
    spec = importlib.util.spec_from_file_location("sutta_event_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {BASE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


@dataclass(frozen=True)
class Config:
    embedding: int
    hidden: int
    dropout: float
    weight_decay: float
    learning_rate: float
    max_epochs: int = 25

    @property
    def name(self) -> str:
        return f"gru:e{self.embedding}:h{self.hidden}:d{self.dropout:g}:wd{self.weight_decay:g}"


CONFIGS = (
    Config(24, 48, 0.15, 3e-3, 0.006),
    Config(32, 64, 0.30, 1e-2, 0.004),
)


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


def panel_token(value: Any, sorted_token: bool = False) -> int:
    text = str(value or "")
    if len(text) != 3 or not text.isdigit():
        return 1000
    return int("".join(sorted(text)) if sorted_token else text)


def event_datetime(iso: str, minute: int) -> datetime:
    return datetime.combine(date.fromisoformat(iso), time.min) + timedelta(minutes=minute)


def build_sequence_dataset(dataset: dict[str, Any]) -> dict[str, np.ndarray]:
    """Build strictly causal event sequences and target-side adjusted context."""
    raw = json.loads(CACHE.read_text(encoding="utf-8"))
    raw_maps: dict[str, dict[str, dict[str, Any]]] = {}
    events: list[tuple[datetime, str, str, dict[str, Any]]] = []
    for market in BASE.MARKETS:
        raw_maps[market] = {}
        for record in raw[market]:
            iso = BASE.FEATURES.iso_date(record)
            raw_maps[market][iso] = record
            events.append((event_datetime(iso, BASE.CLOSE_MINUTE[market]), market, iso, record))
    events.sort(key=lambda item: (item[0], BASE.MARKET_INDEX[item[1]]))
    event_times = [item[0] for item in events]

    sequences: list[list[list[int]]] = []
    target_context: list[list[int]] = []
    current_open: list[list[int]] = []
    prior_counts: list[int] = []
    cutoff_times: list[str] = []
    latest_event_times: list[str | None] = []
    for market_value, iso_value in zip(dataset["markets"], dataset["dates"]):
        market = str(market_value)
        iso = str(iso_value)
        cutoff = event_datetime(iso, BASE.OPEN_MINUTE[market])
        end = bisect.bisect_left(event_times, cutoff)
        selected = events[max(0, end - SEQUENCE_LENGTH):end]
        sequence = [[12, 10, 10, 1001, 1001, 7, 31] for _ in range(SEQUENCE_LENGTH - len(selected))]
        for completed_at, source_market, source_iso, record in selected:
            if completed_at >= cutoff:
                raise RuntimeError("Causal cutoff violation")
            age_days = min(30, max(0, (cutoff.date() - completed_at.date()).days))
            sequence.append(
                [
                    BASE.MARKET_INDEX[source_market],
                    int(record["openSutta"]),
                    int(record["closeSutta"]),
                    panel_token(record.get("openPanel")),
                    panel_token(record.get("closePanel")),
                    date.fromisoformat(source_iso).weekday(),
                    age_days,
                ]
            )
        if len(sequence) != SEQUENCE_LENGTH:
            raise RuntimeError("Sequence length mismatch")
        target_date = date.fromisoformat(iso)
        record = raw_maps[market].get(iso)
        if record is None:
            raise RuntimeError(f"Missing target cache record: {market} {iso}")
        sequences.append(sequence)
        target_context.append([BASE.MARKET_INDEX[market], target_date.weekday(), target_date.day - 1])
        current_open.append(
            [
                int(record["openSutta"]),
                panel_token(record.get("openPanel")),
                panel_token(record.get("openPanel"), True),
            ]
        )
        prior_counts.append(len(selected))
        cutoff_times.append(cutoff.isoformat())
        latest_event_times.append(selected[-1][0].isoformat() if selected else None)
    return {
        "sequence": np.asarray(sequences, dtype=np.int64),
        "target": np.asarray(target_context, dtype=np.int64),
        "currentOpen": np.asarray(current_open, dtype=np.int64),
        "priorCounts": np.asarray(prior_counts, dtype=np.int64),
        "cutoffTimes": np.asarray(cutoff_times),
        "latestEventTimes": np.asarray(latest_event_times),
    }


class EventSequenceModel(nn.Module):
    def __init__(self, config: Config) -> None:
        super().__init__()
        width = config.embedding
        self.market = nn.Embedding(13, width)
        self.open_digit = nn.Embedding(11, width)
        self.close_digit = nn.Embedding(11, width)
        self.open_panel = nn.Embedding(1002, width)
        self.close_panel = nn.Embedding(1002, width)
        self.weekday = nn.Embedding(8, width)
        self.age = nn.Embedding(32, width)
        self.position = nn.Embedding(SEQUENCE_LENGTH, width)
        self.event_norm = nn.LayerNorm(width)
        self.gru = nn.GRU(width, config.hidden, batch_first=True)
        self.target_market = nn.Embedding(12, 8)
        self.target_weekday = nn.Embedding(7, 4)
        self.target_day = nn.Embedding(31, 8)
        shared_width = config.hidden + 20
        self.shared = nn.Sequential(
            nn.Linear(shared_width, config.hidden),
            nn.ReLU(),
            nn.Dropout(config.dropout),
        )
        self.open_head = nn.Linear(config.hidden, 10)
        self.close_head = nn.Linear(config.hidden, 10)
        self.jodi_head = nn.Linear(config.hidden, 100)
        self.current_open_digit = nn.Embedding(10, 8)
        self.current_open_panel = nn.Embedding(1001, 12)
        self.current_open_sorted = nn.Embedding(1001, 12)
        self.adjusted_head = nn.Sequential(
            nn.Linear(config.hidden + 32, config.hidden),
            nn.ReLU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.hidden, 10),
        )

    def forward(
        self,
        sequence: torch.Tensor,
        target: torch.Tensor,
        current_open: torch.Tensor,
    ) -> dict[str, torch.Tensor]:
        position = torch.arange(SEQUENCE_LENGTH, device=sequence.device)[None, :]
        encoded = (
            self.market(sequence[:, :, 0])
            + self.open_digit(sequence[:, :, 1])
            + self.close_digit(sequence[:, :, 2])
            + self.open_panel(sequence[:, :, 3])
            + self.close_panel(sequence[:, :, 4])
            + self.weekday(sequence[:, :, 5])
            + self.age(sequence[:, :, 6])
            + self.position(position)
        )
        encoded = self.event_norm(encoded)
        _, hidden = self.gru(encoded)
        context = torch.cat(
            [
                hidden[-1],
                self.target_market(target[:, 0]),
                self.target_weekday(target[:, 1]),
                self.target_day(target[:, 2]),
            ],
            dim=1,
        )
        shared = self.shared(context)
        adjusted_context = torch.cat(
            [
                shared,
                self.current_open_digit(current_open[:, 0]),
                self.current_open_panel(current_open[:, 1]),
                self.current_open_sorted(current_open[:, 2]),
            ],
            dim=1,
        )
        return {
            "open": self.open_head(shared),
            "close": self.close_head(shared),
            "adjustedClose": self.adjusted_head(adjusted_context),
            "exactJodi": self.jodi_head(shared),
        }


def tensor_data(sequence_data: dict[str, np.ndarray], dataset: dict[str, Any]) -> dict[str, torch.Tensor]:
    return {
        "sequence": torch.from_numpy(sequence_data["sequence"]),
        "target": torch.from_numpy(sequence_data["target"]),
        "currentOpen": torch.from_numpy(sequence_data["currentOpen"]),
        "open": torch.from_numpy(dataset["open"]),
        "close": torch.from_numpy(dataset["close"]),
        "adjustedClose": torch.from_numpy(dataset["close"]),
        "exactJodi": torch.from_numpy(dataset["open"] * 10 + dataset["close"]),
    }


def top3_hits(logits: np.ndarray, labels: np.ndarray) -> np.ndarray:
    picks = np.argsort(-logits, axis=1, kind="stable")[:, :TOP_K]
    return np.any(picks == labels[:, None], axis=1)


def infer(model: EventSequenceModel, data: dict[str, torch.Tensor]) -> dict[str, np.ndarray]:
    outputs = {name: [] for name in ("open", "close", "adjustedClose", "exactJodi")}
    model.eval()
    with torch.no_grad():
        for start in range(0, len(data["open"]), 192):
            end = min(len(data["open"]), start + 192)
            logits = model(data["sequence"][start:end], data["target"][start:end], data["currentOpen"][start:end])
            for name, value in logits.items():
                outputs[name].append(value.cpu().numpy())
    return {name: np.concatenate(values) for name, values in outputs.items()}


def hit_arrays(logits: dict[str, np.ndarray], data: dict[str, torch.Tensor]) -> dict[str, np.ndarray]:
    return {
        name: top3_hits(values, data[name].numpy())
        for name, values in logits.items()
    }


def mean_accuracy(hits: dict[str, np.ndarray], indices: np.ndarray) -> float:
    return float(np.mean([np.mean(values[indices]) for values in hits.values()]))


def train(
    data: dict[str, torch.Tensor],
    config: Config,
    train_indices: np.ndarray,
    development_indices: np.ndarray | None,
    fixed_epochs: int | None = None,
) -> tuple[EventSequenceModel, int]:
    seed_everything()
    model = EventSequenceModel(config)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    loss_fn = nn.CrossEntropyLoss()
    epochs = fixed_epochs or config.max_epochs
    best_score = -1.0
    best_epoch = epochs
    best_state = None
    stale = 0

    for epoch in range(1, epochs + 1):
        model.train()
        order = np.random.permutation(train_indices)
        for start in range(0, len(order), 128):
            batch = torch.from_numpy(order[start:start + 128])
            optimizer.zero_grad()
            logits = model(data["sequence"][batch], data["target"][batch], data["currentOpen"][batch])
            loss = (
                loss_fn(logits["open"], data["open"][batch])
                + loss_fn(logits["close"], data["close"][batch])
                + loss_fn(logits["adjustedClose"], data["adjustedClose"][batch])
                + 0.5 * loss_fn(logits["exactJodi"], data["exactJodi"][batch])
            )
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
        if development_indices is None:
            continue
        logits = infer(model, data)
        score = mean_accuracy(hit_arrays(logits, data), development_indices)
        if score > best_score:
            best_score = score
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= 5:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch


def metric(candidate: np.ndarray, baseline: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    n = len(indices)
    candidate_hits = int(candidate[indices].sum())
    baseline_hits = int(baseline[indices].sum())
    return {
        "n": int(n),
        "baseline": baseline_hits,
        "candidate": candidate_hits,
        "delta": candidate_hits - baseline_hits,
        "baselineAccuracy": round(100 * baseline_hits / n, 3),
        "candidateAccuracy": round(100 * candidate_hits / n, 3),
    }


def direct_jodi_baseline(dataset: dict[str, Any]) -> np.ndarray:
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


def format_metric(value: dict[str, Any]) -> str:
    return (
        f'{value["baseline"]}/{value["n"]} ({value["baselineAccuracy"]:.1f}%) -> '
        f'{value["candidate"]}/{value["n"]} ({value["candidateAccuracy"]:.1f}%) '
        f'({value["delta"]:+d})'
    )


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        "# Top-3 Cross-Market Event-Sequence Research",
        "",
        "Scope: research only. Production application and model files are not modified.",
        "",
        "A multitask GRU consumes the last 64 completed market events ordered by their actual Close times. Shared Open, Close, and exact-Jodi heads never receive the target event. Only adjusted Close receives the current Open digit and Open panel. Architecture and stopping epoch are selected by mean development Top-3 accuracy across all four contracts.",
        "",
        f'Input cache SHA-256: `{payload["inputCacheSha256"]}`.',
        "",
        f'Selected model: `{payload["selectedConfig"]}` at epoch {payload["selectedEpoch"]}.',
        "",
        "| Target | Development | Validation | Holdout | Frozen forward | Promote | 90% gate |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target in payload["targets"]:
        metrics = target["metrics"]
        lines.append(
            f'| {target["target"]} | {format_metric(metrics["development"])} | '
            f'{format_metric(metrics["validation"])} | {format_metric(metrics["holdout"])} | '
            f'{format_metric(metrics["forward"])} | {"yes" if target["promotable"] else "no"} | '
            f'{"pass" if target["meets90PercentGate"] else "fail"} |'
        )
    lines.extend(
        [
            "",
            "The event cutoff invariant was checked for every row: the latest encoded event is strictly earlier than the target market's Open time.",
            "",
        ]
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    seed_everything()
    dataset = BASE.build_dataset()
    splits = BASE.build_splits(dataset)
    sequence_data = build_sequence_dataset(dataset)
    for latest, cutoff in zip(sequence_data["latestEventTimes"], sequence_data["cutoffTimes"]):
        if latest is not None and latest >= cutoff:
            raise RuntimeError(f"Causal audit failed: {latest} >= {cutoff}")
    data = tensor_data(sequence_data, dataset)

    baselines = {
        "open": np.any(dataset["baseOpen"][:, :TOP_K] == dataset["open"][:, None], axis=1),
        "close": np.any(dataset["baseClose"][:, :TOP_K] == dataset["close"][:, None], axis=1),
        "adjustedClose": np.any(dataset["baseClose"][:, :TOP_K] == dataset["close"][:, None], axis=1),
        "exactJodi": direct_jodi_baseline(dataset),
    }
    candidates = []
    for config in CONFIGS:
        model, epoch = train(data, config, splits["train"], splits["development"])
        candidate_hits = hit_arrays(infer(model, data), data)
        candidates.append(
            {
                "config": config,
                "epoch": epoch,
                "developmentMeanAccuracy": round(100 * mean_accuracy(candidate_hits, splits["development"]), 3),
                "hits": candidate_hits,
            }
        )
    selected = max(
        candidates,
        key=lambda item: (item["developmentMeanAccuracy"], -CONFIGS.index(item["config"])),
    )
    forward_model, _ = train(
        data,
        selected["config"],
        splits["historical"],
        None,
        selected["epoch"],
    )
    forward_hits = hit_arrays(infer(forward_model, data), data)

    display_names = {
        "open": "Open",
        "close": "Close",
        "adjustedClose": "Adjusted Close + Open panel",
        "exactJodi": "Exact Jodi",
    }
    targets = []
    for name in ("open", "close", "adjustedClose", "exactJodi"):
        metrics = {
            "development": metric(selected["hits"][name], baselines[name], splits["development"]),
            "validation": metric(selected["hits"][name], baselines[name], splits["validation"]),
            "holdout": metric(selected["hits"][name], baselines[name], splits["holdout"]),
            "forward": metric(forward_hits[name], baselines[name], splits["forward"]),
        }
        promotable = (
            metrics["development"]["delta"] > 0
            and metrics["validation"]["delta"] >= 0
            and metrics["holdout"]["delta"] >= 0
            and metrics["forward"]["delta"] >= 0
        )
        targets.append(
            {
                "target": display_names[name],
                "metrics": metrics,
                "promotable": promotable,
                "meets90PercentGate": all(value["candidateAccuracy"] >= 90.0 for value in metrics.values()),
            }
        )

    payload = {
        "schemaVersion": 1,
        "researchOnly": True,
        "seed": SEED,
        "topK": TOP_K,
        "sequenceLength": SEQUENCE_LENGTH,
        "selection": "maximum mean development Top-3 accuracy across four tasks",
        "inputCache": str(CACHE.relative_to(ROOT)).replace("\\", "/"),
        "inputCacheSha256": hashlib.sha256(CACHE.read_bytes()).hexdigest(),
        "rows": int(len(dataset["open"])),
        "minimumPriorEvents": int(sequence_data["priorCounts"].min()),
        "causalCutoffAuditPassed": True,
        "selectedConfig": selected["config"].name,
        "selectedEpoch": selected["epoch"],
        "candidateSearch": [
            {
                "config": item["config"].name,
                "epoch": item["epoch"],
                "developmentMeanAccuracy": item["developmentMeanAccuracy"],
            }
            for item in candidates
        ],
        "targets": targets,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_report(payload)
    print("Selected", payload["selectedConfig"], "epoch", payload["selectedEpoch"])
    print("Causal cutoff audit", payload["causalCutoffAuditPassed"], "minimum prior events", payload["minimumPriorEvents"])
    for target in targets:
        print(target["target"])
        for block, value in target["metrics"].items():
            print(" ", block, format_metric(value))
        print("  promotable", target["promotable"], "90%", target["meets90PercentGate"])
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
