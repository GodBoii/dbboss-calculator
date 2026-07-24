"""Causal 220-class Open/Close event-sequence research.

Each target sees only market events whose Close timestamp is strictly before the
target market's Open timestamp. The target event is never encoded.
"""

from __future__ import annotations

import bisect
import copy
import hashlib
import importlib.util
import json
import math
import random
import sys
from dataclasses import asdict, dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "run_research.py"
EXTENDED_RUNNER = HERE / "run_extended_research.py"
OUTPUT = HERE / "event_sequence_results.json"
REPORT = HERE / "EVENT_SEQUENCE_REPORT.md"
LEDGER = HERE / "event_sequence_ledger.json"
MODEL_PATH = HERE / "models_extended" / "open_close_event_gru.pt"
SEQUENCE_LENGTH = 64
MIN_TARGET_DATE = date(2022, 1, 1)
SEED = 20260716

OPEN_MINUTE = {
    "Sridevi": 11 * 60 + 35, "Time Bazar": 13 * 60 + 10,
    "Madhur Day": 13 * 60 + 30, "Rajdhani Day": 15 * 60 + 5,
    "Milan Day": 15 * 60 + 10, "Kalyan": 15 * 60 + 45,
    "Sridevi Night": 19 * 60 + 15, "Madhur Night": 20 * 60 + 30,
    "Milan Night": 21 * 60 + 5, "Rajdhani Night": 21 * 60 + 35,
    "Kalyan Night": 21 * 60 + 45, "Main Bazar": 22 * 60,
}
CLOSE_MINUTE = {
    "Sridevi": 12 * 60 + 35, "Time Bazar": 14 * 60 + 10,
    "Madhur Day": 14 * 60 + 30, "Rajdhani Day": 17 * 60 + 5,
    "Milan Day": 17 * 60 + 10, "Kalyan": 17 * 60 + 45,
    "Sridevi Night": 20 * 60 + 15, "Madhur Night": 22 * 60 + 30,
    "Milan Night": 23 * 60 + 5, "Rajdhani Night": 23 * 60 + 35,
    "Kalyan Night": 23 * 60 + 45, "Main Bazar": 24 * 60 + 10,
}


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


B = load_module("panel_event_base", BASE_PATH)
E = load_module("panel_event_extended", EXTENDED_RUNNER)


def seed_all() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


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
        return f"gru_e{self.embedding}_h{self.hidden}_d{self.dropout:g}_wd{self.weight_decay:g}"


CONFIGS = (
    Config(20, 64, 0.20, 0.01, 0.006),
    Config(28, 96, 0.40, 0.03, 0.004),
)


@dataclass
class SequenceDataset:
    sequence: np.ndarray
    target: np.ndarray
    labels_open: np.ndarray
    labels_close: np.ndarray
    markets: np.ndarray
    dates: np.ndarray
    cutoff_times: np.ndarray
    latest_event_times: np.ndarray
    prior_counts: np.ndarray


def event_datetime(raw_date: date, minute: int) -> datetime:
    return datetime.combine(raw_date, time.min) + timedelta(minutes=minute)


def build_dataset(rows_by_market: dict[str, list[Any]], market_names: list[str]) -> SequenceDataset:
    market_index = {market: index for index, market in enumerate(market_names)}
    events = []
    targets = []
    for market, rows in rows_by_market.items():
        for row in rows:
            completed = event_datetime(row.iso_date, CLOSE_MINUTE[market])
            events.append((completed, market_index[market], row))
            if row.iso_date >= MIN_TARGET_DATE:
                targets.append((row.iso_date, market_index[market], row))
    events.sort(key=lambda item: (item[0], item[1]))
    targets.sort(key=lambda item: (item[0], OPEN_MINUTE[market_names[item[1]]], item[1]))
    event_times = [item[0] for item in events]

    sequences = []
    contexts = []
    labels_open = []
    labels_close = []
    markets = []
    dates = []
    cutoff_times = []
    latest_times = []
    prior_counts = []
    pad = [len(market_names), B.MISSING_PANEL, B.MISSING_PANEL, 7, 31, 10, 10]

    for target_date, market_id, row in targets:
        market = market_names[market_id]
        cutoff = event_datetime(target_date, OPEN_MINUTE[market])
        end = bisect.bisect_left(event_times, cutoff)
        selected = events[max(0, end - SEQUENCE_LENGTH):end]
        sequence = [pad] * (SEQUENCE_LENGTH - len(selected))
        for completed, source_market_id, source in selected:
            if completed >= cutoff:
                raise RuntimeError(f"Causal cutoff violation: {market} {target_date}")
            age_days = min(30, max(0, (target_date - completed.date()).days))
            sequence.append([
                source_market_id, source.open_panel, source.close_panel,
                source.weekday, age_days,
                int(B.PANEL_SUTTA[source.open_panel]), int(B.PANEL_SUTTA[source.close_panel]),
            ])
        if len(sequence) != SEQUENCE_LENGTH:
            raise RuntimeError("Sequence length error")
        sequences.append(sequence)
        contexts.append([market_id, target_date.weekday(), target_date.day - 1, target_date.month - 1])
        labels_open.append(row.open_panel)
        labels_close.append(row.close_panel)
        markets.append(market_id)
        dates.append(target_date.isoformat())
        cutoff_times.append(cutoff.isoformat())
        latest_times.append(selected[-1][0].isoformat() if selected else "")
        prior_counts.append(len(selected))

    dataset = SequenceDataset(
        sequence=np.asarray(sequences, dtype=np.int16),
        target=np.asarray(contexts, dtype=np.int16),
        labels_open=np.asarray(labels_open, dtype=np.int64),
        labels_close=np.asarray(labels_close, dtype=np.int64),
        markets=np.asarray(markets, dtype=np.int64), dates=np.asarray(dates),
        cutoff_times=np.asarray(cutoff_times), latest_event_times=np.asarray(latest_times),
        prior_counts=np.asarray(prior_counts, dtype=np.int16),
    )
    violations = [
        index for index, (latest, cutoff) in enumerate(zip(dataset.latest_event_times, dataset.cutoff_times))
        if latest and latest >= cutoff
    ]
    if violations:
        raise RuntimeError(f"Found {len(violations)} event-cutoff violations")
    return dataset


def split_indices(dataset: SequenceDataset, market_names: list[str], cutoffs: dict[str, date]) -> dict[str, np.ndarray]:
    parsed = np.asarray([date.fromisoformat(str(value)) for value in dataset.dates])
    return {
        "train": np.flatnonzero(parsed <= B.TRAIN_END),
        "early": np.flatnonzero((parsed > B.TRAIN_END) & (parsed <= B.EARLY_END)),
        "select": np.flatnonzero((parsed > B.EARLY_END) & (parsed <= B.SELECT_END)),
        "terminal": np.asarray([
            i for i, (value, market_id) in enumerate(zip(parsed, dataset.markets))
            if value > B.SELECT_END and value <= cutoffs[market_names[int(market_id)]]
        ], dtype=np.int64),
        "forward": np.asarray([
            i for i, (value, market_id) in enumerate(zip(parsed, dataset.markets))
            if value > cutoffs[market_names[int(market_id)]]
        ], dtype=np.int64),
        "cacheAll": np.asarray([
            i for i, (value, market_id) in enumerate(zip(parsed, dataset.markets))
            if value <= cutoffs[market_names[int(market_id)]]
        ], dtype=np.int64),
    }


class EventGRU(nn.Module):
    def __init__(self, config: Config, market_count: int):
        super().__init__()
        width = config.embedding
        self.market = nn.Embedding(market_count + 1, width)
        self.open_panel = nn.Embedding(len(B.PANELS) + 1, width)
        self.close_panel = nn.Embedding(len(B.PANELS) + 1, width)
        self.weekday = nn.Embedding(8, width)
        self.age = nn.Embedding(32, width)
        self.open_sutta = nn.Embedding(11, width)
        self.close_sutta = nn.Embedding(11, width)
        self.gru = nn.GRU(width, config.hidden, batch_first=True)
        self.target_market = nn.Embedding(market_count, 16)
        self.target_weekday = nn.Embedding(7, 8)
        self.target_dom = nn.Embedding(31, 8)
        self.target_month = nn.Embedding(12, 8)
        context_width = config.hidden + 40
        self.shared = nn.Sequential(
            nn.Linear(context_width, config.hidden), nn.GELU(), nn.Dropout(config.dropout),
        )
        self.open_head = nn.Linear(config.hidden, len(B.PANELS))
        self.close_head = nn.Linear(config.hidden, len(B.PANELS))

    def forward(self, sequence: torch.Tensor, target: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        encoded = (
            self.market(sequence[:, :, 0]) + self.open_panel(sequence[:, :, 1])
            + self.close_panel(sequence[:, :, 2]) + self.weekday(sequence[:, :, 3])
            + self.age(sequence[:, :, 4]) + self.open_sutta(sequence[:, :, 5])
            + self.close_sutta(sequence[:, :, 6])
        )
        _, state = self.gru(encoded)
        context = torch.cat([
            state[-1], self.target_market(target[:, 0]), self.target_weekday(target[:, 1]),
            self.target_dom(target[:, 2]), self.target_month(target[:, 3]),
        ], dim=1)
        shared = self.shared(context)
        return self.open_head(shared), self.close_head(shared)


def batch_indices(indices: np.ndarray, shuffle: bool, batch_size: int = 192):
    values = indices.copy()
    if shuffle:
        np.random.shuffle(values)
    for start in range(0, len(values), batch_size):
        yield values[start:start + batch_size]


def tensors(dataset: SequenceDataset, indices: np.ndarray):
    return (
        torch.from_numpy(dataset.sequence[indices].astype(np.int64)),
        torch.from_numpy(dataset.target[indices].astype(np.int64)),
        torch.from_numpy(dataset.labels_open[indices]),
        torch.from_numpy(dataset.labels_close[indices]),
    )


def logits_for(model: EventGRU, dataset: SequenceDataset, indices: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    opens, closes = [], []
    with torch.no_grad():
        for batch in batch_indices(indices, False, 256):
            sequence, target, _, _ = tensors(dataset, batch)
            open_logits, close_logits = model(sequence, target)
            opens.append(open_logits.cpu().numpy())
            closes.append(close_logits.cpu().numpy())
    return np.concatenate(opens), np.concatenate(closes)


def score_pair(logits: tuple[np.ndarray, np.ndarray], dataset: SequenceDataset, indices: np.ndarray) -> dict[str, float]:
    return {
        "open": B.quick_metric(logits[0], dataset.labels_open[indices]),
        "close": B.quick_metric(logits[1], dataset.labels_close[indices]),
        "mean": 0.5 * (
            B.quick_metric(logits[0], dataset.labels_open[indices])
            + B.quick_metric(logits[1], dataset.labels_close[indices])
        ),
    }


def train_model(
    dataset: SequenceDataset, config: Config, train_idx: np.ndarray,
    early_idx: np.ndarray | None, fixed_epochs: int | None = None,
) -> tuple[EventGRU, int, list[dict[str, Any]]]:
    seed_all()
    market_count = int(dataset.markets.max()) + 1
    model = EventGRU(config, market_count)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    best_state = None
    best_score = -1.0
    best_epoch = 1
    stale = 0
    history = []
    for epoch in range(1, (fixed_epochs or config.max_epochs) + 1):
        model.train()
        losses = []
        for batch in batch_indices(train_idx, True):
            sequence, target, open_labels, close_labels = tensors(dataset, batch)
            optimizer.zero_grad(set_to_none=True)
            open_logits, close_logits = model(sequence, target)
            loss = 0.5 * (
                nn.functional.cross_entropy(open_logits, open_labels, label_smoothing=0.02)
                + nn.functional.cross_entropy(close_logits, close_labels, label_smoothing=0.02)
            )
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            losses.append(float(loss.detach()))
        evaluation_idx = early_idx if early_idx is not None else train_idx
        scores = score_pair(logits_for(model, dataset, evaluation_idx), dataset, evaluation_idx)
        history.append({"epoch": epoch, "loss": float(np.mean(losses)), **scores})
        if fixed_epochs is not None:
            continue
        if scores["mean"] > best_score + 1e-8:
            best_score = scores["mean"]
            best_epoch = epoch
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= 5:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch, history


def side_metrics(scores: np.ndarray, labels: np.ndarray, dataset: SequenceDataset,
                 indices: np.ndarray, market_names: list[str]) -> dict[str, Any]:
    hits = B.topk_hits(scores, labels[indices])
    low, high = B.wilson(int(hits.sum()), len(hits))
    per_market = {}
    for market_id, market in enumerate(market_names):
        mask = dataset.markets[indices] == market_id
        if mask.any():
            market_hits = hits[mask]
            per_market[market] = {"n": int(mask.sum()), "hits": int(market_hits.sum()), "rate": float(market_hits.mean())}
    return {
        "n": int(len(hits)), "hits": int(hits.sum()), "rate": float(hits.mean()),
        "wilson95": [low, high], "perMarket": per_market,
    }


def main() -> None:
    seed_all()
    base_rows, base_audit = B.load_rows()
    cutoffs = {market: values[-1].iso_date for market, values in base_rows.items()}
    market_names = list(base_rows)
    rows, source_audit = E.load_extended_rows()
    dataset = build_dataset(rows, market_names)
    splits = split_indices(dataset, market_names, cutoffs)
    trials = []
    for config in CONFIGS:
        print(f"selecting {config.name}", flush=True)
        model, epoch, history = train_model(dataset, config, splits["train"], splits["early"])
        early = score_pair(logits_for(model, dataset, splits["early"]), dataset, splits["early"])
        selection = score_pair(logits_for(model, dataset, splits["select"]), dataset, splits["select"])
        trials.append({
            "config": asdict(config), "name": config.name, "bestEpoch": epoch,
            "epochsRun": len(history), "early": early, "selection": selection,
        })
    trials.sort(key=lambda row: (row["selection"]["mean"], row["early"]["mean"]), reverse=True)
    selected = trials[0]
    config = Config(**selected["config"])
    preterminal = np.concatenate([splits["train"], splits["early"], splits["select"]])
    terminal_model, _, _ = train_model(dataset, config, preterminal, None, fixed_epochs=selected["bestEpoch"])
    terminal_logits = logits_for(terminal_model, dataset, splits["terminal"])
    research_model, _, _ = train_model(dataset, config, splits["cacheAll"], None, fixed_epochs=selected["bestEpoch"])
    forward_logits = logits_for(research_model, dataset, splits["forward"])

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        "researchOnly": True, "task": "open_close_preopen", "config": selected["config"],
        "fixedEpochs": selected["bestEpoch"], "stateDict": research_model.state_dict(),
        "marketNames": market_names, "panelNames": B.PANELS, "sequenceLength": SEQUENCE_LENGTH,
        "openMinute": OPEN_MINUTE, "closeMinute": CLOSE_MINUTE,
        "sourceSha256": source_audit["sha256"], "seed": SEED,
    }, MODEL_PATH)
    previous = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    terminal = {
        "open": side_metrics(terminal_logits[0], dataset.labels_open, dataset, splits["terminal"], market_names),
        "close": side_metrics(terminal_logits[1], dataset.labels_close, dataset, splits["terminal"], market_names),
    }
    forward = {
        "open": side_metrics(forward_logits[0], dataset.labels_open, dataset, splits["forward"], market_names),
        "close": side_metrics(forward_logits[1], dataset.labels_close, dataset, splits["forward"], market_names),
    }
    payload = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "productionFilesModified": False,
        "sourceAudit": source_audit,
        "trustedCacheSha256": base_audit["sha256"],
        "cutoffInvariant": {
            "violations": 0, "minimumPriorEvents": int(dataset.prior_counts.min()),
            "medianPriorEvents": float(np.median(dataset.prior_counts)),
            "maximumPriorEvents": int(dataset.prior_counts.max()),
        },
        "datasetRows": int(len(dataset.dates)),
        "splits": {key: int(len(value)) for key, value in splits.items()},
        "trials": trials, "selected": selected,
        "terminal": terminal, "forward": forward,
        "previousTwoYear": {
            "openTerminal": previous["tasks"]["open"]["holdout"][previous["tasks"]["open"]["chosenModel"]]["top30"],
            "closeTerminal": previous["tasks"]["close_preopen"]["holdout"][previous["tasks"]["close_preopen"]["chosenModel"]]["top30"],
            "openForward": previous["tasks"]["open"]["prospectiveForward"][previous["tasks"]["open"]["chosenModel"]]["top30"],
            "closeForward": previous["tasks"]["close_preopen"]["prospectiveForward"][previous["tasks"]["close_preopen"]["chosenModel"]]["top30"],
        },
        "artifact": {"path": str(MODEL_PATH.relative_to(ROOT)), "sha256": hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()},
        "target90": {
            side: {"terminal": terminal[side]["rate"] >= 0.90, "forward": forward[side]["rate"] >= 0.90}
            for side in ("open", "close")
        },
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    ledger = []
    for split, indices, logits_pair in (
        ("terminal", splits["terminal"], terminal_logits), ("forward", splits["forward"], forward_logits),
    ):
        for side, scores, labels in (
            ("open", logits_pair[0], dataset.labels_open), ("close", logits_pair[1], dataset.labels_close),
        ):
            top = np.argsort(-scores, axis=1)[:, :B.TOP_K]
            for local, global_index in enumerate(indices):
                ledger.append({
                    "split": split, "side": side, "date": str(dataset.dates[global_index]),
                    "market": market_names[int(dataset.markets[global_index])],
                    "actual": B.PANELS[int(labels[global_index])],
                    "top30": [B.PANELS[int(value)] for value in top[local]],
                })
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")

    def pct(value: float) -> str:
        return f"{100 * value:.2f}%"

    lines = [
        "# Exact-panel event-sequence research", "",
        f"Rows: {len(dataset.dates):,}; event cutoff violations: 0; sequence length: {SEQUENCE_LENGTH}.", "",
        "| Side | Event GRU terminal | Previous terminal | Event GRU forward | Previous forward | 90% |",
        "|---|---:|---:|---:|---:|---:|",
        f"| Open | {terminal['open']['hits']}/{terminal['open']['n']} ({pct(terminal['open']['rate'])}) | "
        f"{pct(payload['previousTwoYear']['openTerminal']['rate'])} | {forward['open']['hits']}/{forward['open']['n']} "
        f"({pct(forward['open']['rate'])}) | {pct(payload['previousTwoYear']['openForward']['rate'])} | "
        f"{'yes' if payload['target90']['open']['terminal'] and payload['target90']['open']['forward'] else 'no'} |",
        f"| Close | {terminal['close']['hits']}/{terminal['close']['n']} ({pct(terminal['close']['rate'])}) | "
        f"{pct(payload['previousTwoYear']['closeTerminal']['rate'])} | {forward['close']['hits']}/{forward['close']['n']} "
        f"({pct(forward['close']['rate'])}) | {pct(payload['previousTwoYear']['closeForward']['rate'])} | "
        f"{'yes' if payload['target90']['close']['terminal'] and payload['target90']['close']['forward'] else 'no'} |",
        "", "## Model selection", "",
        "| Candidate | Early Open | Early Close | Selection Open | Selection Close | Selection mean |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for trial in trials:
        lines.append(
            f"| {trial['name']} | {pct(trial['early']['open'])} | {pct(trial['early']['close'])} | "
            f"{pct(trial['selection']['open'])} | {pct(trial['selection']['close'])} | "
            f"{pct(trial['selection']['mean'])} |"
        )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} and {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
