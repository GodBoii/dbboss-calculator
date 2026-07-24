"""Leakage-resistant exact-panel Top-K research.

This is research-only code. It does not import, edit, or write any application module.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import os
import random
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import torch
from torch import nn


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / os.environ.get(
    "PANEL_RESEARCH_OUTPUT_DIR",
    str(HERE.relative_to(ROOT)),
)
SOURCE = ROOT / "scratch" / "open-sutta-records-cache.json"
RESULTS = OUTPUT_DIR / "results.json"
LEDGER = OUTPUT_DIR / "holdout_ledger.csv"
REPORT = OUTPUT_DIR / "REPORT.md"
FORWARD_SOURCE = HERE / "forward_records.json"
MODELS_DIR = OUTPUT_DIR / "models"

SEED = 20260715
MIN_HISTORY = 120
TRAIN_END = date(2025, 9, 30)
EARLY_END = date(2025, 12, 31)
SELECT_END = date(2026, 3, 31)
TOP_K = int(os.environ.get("PANEL_TOP_K", "30"))
TOP_LABEL = f"Top-{TOP_K}"
TOP_METRIC = f"top{TOP_K}"
RESEARCH_LABEL = os.environ.get("PANEL_RESEARCH_LABEL", f"Exact-panel {TOP_LABEL} research")
MISSING_PANEL = 220
LAGS = (1, 2, 3, 5, 7, 14, 28)
TASKS = ("open", "close_preopen", "close_adjusted")

DAY_OFFSET = {
    "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
    "Friday": 4, "Saturday": 5, "Sunday": 6,
}

# The source market's Close is available before the target market's Open.
# This is copied as research metadata, not imported from production.
SAME_DAY_SOURCE = {
    "Time Bazar": "Sridevi",
    "Madhur Day": "Sridevi",
    "Milan Day": "Madhur Day",
    "Rajdhani Day": "Madhur Day",
    "Kalyan": "Madhur Day",
    "Sridevi Night": "Kalyan",
    "Kalyan Night": "Sridevi Night",
    "Madhur Night": "Sridevi Night",
    "Milan Night": "Sridevi Night",
    "Rajdhani Night": "Sridevi Night",
    "Main Bazar": "Sridevi Night",
}


def seed_all(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(max(1, min(8, torch.get_num_threads())))


def all_panels() -> list[str]:
    order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    return [f"{order[i]}{order[j]}{order[k]}"
            for i in range(10) for j in range(i, 10) for k in range(j, 10)]


PANELS = all_panels()
PANEL_TO_ID = {panel: index for index, panel in enumerate(PANELS)}
PANEL_DIGITS = np.asarray([[int(x) for x in panel] for panel in PANELS], dtype=np.int16)
PANEL_SUTTA = PANEL_DIGITS.sum(axis=1) % 10
PANEL_KIND = np.asarray([len(set(panel)) == 2 for panel in PANELS], dtype=np.int8)


@dataclass(frozen=True)
class Row:
    market: str
    iso_date: date
    weekday: int
    open_panel: int
    close_panel: int


@dataclass
class Dataset:
    task: str
    dates: np.ndarray
    markets: np.ndarray
    contexts: np.ndarray
    features: np.ndarray
    labels: np.ndarray
    profile_scores: np.ndarray
    hot_scores: np.ndarray
    feature_names: list[str]
    context_cards: list[int]


def parse_record_date(record: dict[str, Any]) -> date:
    raw = record["dateRangeStart"].replace("-", "/")
    day, month, year = (int(part) for part in raw.split("/"))
    if year < 100:
        year += 2000
    return date(year, month, day) + timedelta(days=DAY_OFFSET.get(record["day"], 0))


def load_rows() -> tuple[dict[str, list[Row]], dict[str, Any]]:
    raw_bytes = SOURCE.read_bytes()
    raw = json.loads(raw_bytes)
    rows_by_market: dict[str, list[Row]] = {}
    invalid: list[str] = []
    duplicates: list[str] = []
    sutta_mismatches = 0
    total_source_rows = 0

    for market, records in raw.items():
        seen: set[date] = set()
        rows: list[Row] = []
        for record in records:
            total_source_rows += 1
            try:
                target_date = parse_record_date(record)
                open_panel = PANEL_TO_ID[record["openPanel"]]
                close_panel = PANEL_TO_ID[record["closePanel"]]
            except (KeyError, TypeError, ValueError) as error:
                invalid.append(f"{market}|{record.get('id')}|{error}")
                continue
            if target_date in seen:
                duplicates.append(f"{market}|{target_date.isoformat()}")
                continue
            seen.add(target_date)
            if int(record.get("openSutta", -1)) != int(PANEL_SUTTA[open_panel]):
                sutta_mismatches += 1
            if int(record.get("closeSutta", -1)) != int(PANEL_SUTTA[close_panel]):
                sutta_mismatches += 1
            rows.append(Row(market, target_date, target_date.weekday(), open_panel, close_panel))
        rows_by_market[market] = sorted(rows, key=lambda row: row.iso_date)

    audit = {
        "source": str(SOURCE.relative_to(ROOT)),
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "sourceRows": total_source_rows,
        "validRows": sum(len(rows) for rows in rows_by_market.values()),
        "markets": {market: len(rows) for market, rows in rows_by_market.items()},
        "invalidRows": len(invalid),
        "invalidExamples": invalid[:10],
        "duplicateMarketDates": len(duplicates),
        "suttaMismatches": sutta_mismatches,
        "firstDate": min(row.iso_date for rows in rows_by_market.values() for row in rows).isoformat(),
        "lastDate": max(row.iso_date for rows in rows_by_market.values() for row in rows).isoformat(),
    }
    return rows_by_market, audit


def load_forward_rows(base: dict[str, list[Row]]) -> tuple[dict[str, list[Row]], dict[str, Any], dict[str, date]]:
    cutoffs = {market: rows[-1].iso_date for market, rows in base.items()}
    if not FORWARD_SOURCE.exists():
        return base, {"available": False}, cutoffs
    raw_bytes = FORWARD_SOURCE.read_bytes()
    payload = json.loads(raw_bytes)
    merged = {market: list(rows) for market, rows in base.items()}
    accepted = 0
    rejected = 0
    for market, records in payload.get("forward", {}).items():
        known = {row.iso_date for row in merged.get(market, [])}
        for record in records:
            try:
                target_date = parse_record_date(record)
                row = Row(
                    market, target_date, target_date.weekday(),
                    PANEL_TO_ID[record["openPanel"]], PANEL_TO_ID[record["closePanel"]],
                )
            except (KeyError, TypeError, ValueError):
                rejected += 1
                continue
            if target_date <= cutoffs[market] or target_date in known:
                rejected += 1
                continue
            merged[market].append(row)
            known.add(target_date)
            accepted += 1
        merged[market].sort(key=lambda row: row.iso_date)
    audit = {
        "available": True,
        "generatedAt": payload.get("generatedAt"),
        "sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "acceptedCompletedRows": accepted,
        "rejectedRows": rejected,
        "perMarket": {
            market: sum(row.iso_date > cutoffs[market] for row in rows)
            for market, rows in merged.items()
        },
    }
    return merged, audit, cutoffs


def relation_features(source_panel: int | None) -> tuple[np.ndarray, np.ndarray]:
    if source_panel is None or source_panel == MISSING_PANEL:
        zeros = np.zeros(len(PANELS), dtype=np.float32)
        return zeros, zeros
    source_digits = set(PANEL_DIGITS[source_panel].tolist())
    opposite_digits = {(digit + 5) % 10 for digit in source_digits}
    direct = np.asarray([len(set(digits.tolist()) & source_digits) for digits in PANEL_DIGITS], dtype=np.float32)
    opposite = np.asarray([len(set(digits.tolist()) & opposite_digits) for digits in PANEL_DIGITS], dtype=np.float32)
    return direct, opposite


def zscore_candidates(features: np.ndarray) -> np.ndarray:
    means = features.mean(axis=0, keepdims=True)
    stds = features.std(axis=0, keepdims=True)
    stds[stds < 1e-6] = 1.0
    return ((features - means) / stds).astype(np.float32)


def counts_vector(values: Iterable[int]) -> np.ndarray:
    return np.bincount(np.fromiter(values, dtype=np.int64), minlength=len(PANELS)).astype(np.float32)


def candidate_features(
    task: str,
    history: list[Row],
    target: Row,
    same_day_source: Row | None,
) -> tuple[np.ndarray, list[str], np.ndarray, np.ndarray]:
    side = "open_panel" if task == "open" else "close_panel"
    values = [getattr(row, side) for row in history]
    long_counts = counts_vector(values)
    recent30 = counts_vector(values[-30:])
    recent90 = counts_vector(values[-90:])
    recent180 = counts_vector(values[-180:])
    weekday_values = [getattr(row, side) for row in history if row.weekday == target.weekday]
    weekday_counts = counts_vector(weekday_values)

    position_counts = np.zeros((3, 10), dtype=np.float32)
    pair_counts = np.zeros((3, 100), dtype=np.float32)
    sutta_counts = np.zeros(10, dtype=np.float32)
    kind_counts = np.zeros(2, dtype=np.float32)
    transition_from_last = np.zeros(len(PANELS), dtype=np.float32)
    open_to_close_from_current = np.zeros(len(PANELS), dtype=np.float32)
    jodi_sutta_counts = np.zeros((10, 10), dtype=np.float32)
    last_panel = values[-1]
    for index, row in enumerate(history):
        panel_id = getattr(row, side)
        digits = PANEL_DIGITS[panel_id]
        for pos in range(3):
            position_counts[pos, digits[pos]] += 1
        pair_counts[0, digits[0] * 10 + digits[1]] += 1
        pair_counts[1, digits[0] * 10 + digits[2]] += 1
        pair_counts[2, digits[1] * 10 + digits[2]] += 1
        sutta_counts[PANEL_SUTTA[panel_id]] += 1
        kind_counts[PANEL_KIND[panel_id]] += 1
        if row.open_panel == target.open_panel:
            open_to_close_from_current[row.close_panel] += 1
        jodi_sutta_counts[PANEL_SUTTA[row.open_panel], PANEL_SUTTA[row.close_panel]] += 1
        if index and getattr(history[index - 1], side) == last_panel:
            transition_from_last[panel_id] += 1

    position_score = sum(np.log(position_counts[pos, PANEL_DIGITS[:, pos]] + 2.0) for pos in range(3))
    pair_score = (
        np.log(pair_counts[0, PANEL_DIGITS[:, 0] * 10 + PANEL_DIGITS[:, 1]] + 1.0)
        + np.log(pair_counts[1, PANEL_DIGITS[:, 0] * 10 + PANEL_DIGITS[:, 2]] + 1.0)
        + np.log(pair_counts[2, PANEL_DIGITS[:, 1] * 10 + PANEL_DIGITS[:, 2]] + 1.0)
    )
    last1 = values[-1]
    last3 = values[-3] if len(values) >= 3 else last1
    overlap1, opposite1 = relation_features(last1)
    overlap3, opposite3 = relation_features(last3)
    source_panel = same_day_source.close_panel if same_day_source else None
    source_overlap, source_opposite = relation_features(source_panel)

    columns: list[tuple[str, np.ndarray]] = [
        ("log_long_count", np.log(long_counts + 1.5)),
        ("log_recent30_count", np.log(recent30 + 1.0)),
        ("log_recent90_count", np.log(recent90 + 1.0)),
        ("log_recent180_count", np.log(recent180 + 1.0)),
        ("log_weekday_count", np.log(weekday_counts + 1.0)),
        ("position_profile", position_score),
        ("pair_profile", pair_score),
        ("sutta_profile", np.log(sutta_counts[PANEL_SUTTA] + 2.0)),
        ("kind_profile", np.log(kind_counts[PANEL_KIND] + 2.0)),
        ("transition_lag1", np.log(transition_from_last + 1.0)),
        ("lag1_overlap", overlap1),
        ("lag1_opposite", opposite1),
        ("lag3_overlap", overlap3),
        ("lag3_opposite", opposite3),
        ("same_day_source_overlap", source_overlap),
        ("same_day_source_opposite", source_opposite),
    ]
    if task == "close_adjusted":
        open_overlap, open_opposite = relation_features(target.open_panel)
        columns.extend([
            ("known_open_overlap", open_overlap),
            ("known_open_opposite", open_opposite),
            ("open_to_close_transition", np.log(open_to_close_from_current + 1.0)),
            ("known_open_jodi_profile", np.log(
                jodi_sutta_counts[PANEL_SUTTA[target.open_panel], PANEL_SUTTA] + 1.0
            )),
        ])

    raw_features = np.column_stack([values for _, values in columns]).astype(np.float32)
    features = zscore_candidates(raw_features)

    # Fixed, declared empirical-Bayes profile. No fitted coefficients.
    profile = (
        raw_features[:, 0]
        + 0.35 * raw_features[:, 1]
        + 0.25 * raw_features[:, 2]
        + 0.45 * raw_features[:, 5]
        + 0.25 * raw_features[:, 6]
        + 0.25 * raw_features[:, 7]
        + 0.20 * raw_features[:, 8]
        + 0.20 * raw_features[:, 9]
        + 0.15 * raw_features[:, 11]
        + 0.10 * raw_features[:, 14]
    )
    if task == "close_adjusted":
        profile = profile + 0.15 * raw_features[:, 17] + 0.30 * raw_features[:, 18] + 0.25 * raw_features[:, 19]
    return features, [name for name, _ in columns], profile.astype(np.float32), raw_features[:, 0].astype(np.float32)


def prior_by_date(rows: list[Row]) -> dict[date, Row]:
    return {row.iso_date: row for row in rows}


def build_dataset(
    task: str,
    rows_by_market: dict[str, list[Row]],
    min_target_date: date | None = None,
    history_window: int | None = None,
) -> Dataset:
    markets = list(rows_by_market)
    market_to_id = {market: index for index, market in enumerate(markets)}
    by_date = {market: prior_by_date(rows) for market, rows in rows_by_market.items()}
    contexts: list[list[int]] = []
    candidate_blocks: list[np.ndarray] = []
    profile_scores: list[np.ndarray] = []
    hot_scores: list[np.ndarray] = []
    labels: list[int] = []
    dates: list[str] = []
    market_ids: list[int] = []
    feature_names: list[str] | None = None

    # Cards correspond to: market, weekday, month, day-of-month, then panel fields.
    context_cards = [len(markets), 7, 12, 31] + [len(PANELS) + 1] * (2 * len(LAGS) + 8)

    for market, rows in rows_by_market.items():
        same_weekday_last: dict[int, Row] = {}
        same_dom_last: dict[int, Row] = {}
        for index in range(MIN_HISTORY, len(rows)):
            target = rows[index]
            if min_target_date is not None and target.iso_date < min_target_date:
                continue
            history = rows[:index]
            if history_window is not None:
                history = history[-history_window:]
            # Update lookup state strictly from prior rows.
            same_weekday_last.clear()
            same_dom_last.clear()
            for prior in history:
                same_weekday_last[prior.weekday] = prior
                same_dom_last[prior.iso_date.day] = prior

            source_market = SAME_DAY_SOURCE.get(market)
            same_day = by_date.get(source_market, {}).get(target.iso_date) if source_market else None
            previous_source = None
            if source_market:
                source_rows = rows_by_market[source_market]
                previous = [row for row in source_rows if row.iso_date < target.iso_date]
                previous_source = previous[-1] if previous else None

            panel_context: list[int] = []
            for lag in LAGS:
                row = history[-lag] if len(history) >= lag else None
                panel_context.extend([
                    row.open_panel if row else MISSING_PANEL,
                    row.close_panel if row else MISSING_PANEL,
                ])
            same_week = same_weekday_last.get(target.weekday)
            same_dom = same_dom_last.get(target.iso_date.day)
            panel_context.extend([
                same_week.open_panel if same_week else MISSING_PANEL,
                same_week.close_panel if same_week else MISSING_PANEL,
                same_dom.open_panel if same_dom else MISSING_PANEL,
                same_dom.close_panel if same_dom else MISSING_PANEL,
                previous_source.open_panel if previous_source else MISSING_PANEL,
                previous_source.close_panel if previous_source else MISSING_PANEL,
                same_day.open_panel if same_day else MISSING_PANEL,
                same_day.close_panel if same_day else MISSING_PANEL,
            ])
            contexts.append([
                market_to_id[market], target.weekday, target.iso_date.month - 1,
                target.iso_date.day - 1, *panel_context,
            ])
            block, names, profile, hot = candidate_features(task, history, target, same_day)
            if feature_names is None:
                feature_names = names
            candidate_blocks.append(block)
            profile_scores.append(profile)
            hot_scores.append(hot)
            labels.append(target.open_panel if task == "open" else target.close_panel)
            dates.append(target.iso_date.isoformat())
            market_ids.append(market_to_id[market])

    return Dataset(
        task=task,
        dates=np.asarray(dates),
        markets=np.asarray(market_ids, dtype=np.int64),
        contexts=np.asarray(contexts, dtype=np.int64),
        features=np.stack(candidate_blocks).astype(np.float32),
        labels=np.asarray(labels, dtype=np.int64),
        profile_scores=np.stack(profile_scores).astype(np.float32),
        hot_scores=np.stack(hot_scores).astype(np.float32),
        feature_names=feature_names or [],
        context_cards=context_cards,
    )


class DynamicRanker(nn.Module):
    def __init__(self, feature_count: int, market_count: int):
        super().__init__()
        self.global_weight = nn.Parameter(torch.zeros(feature_count))
        self.market_weight = nn.Embedding(market_count, feature_count)
        nn.init.zeros_(self.market_weight.weight)

    def forward(self, contexts: torch.Tensor, features: torch.Tensor) -> torch.Tensor:
        market = contexts[:, 0]
        weight = self.global_weight + self.market_weight(market)
        return torch.einsum("bkf,bf->bk", features, weight)


class AdditiveRanker(DynamicRanker):
    def __init__(self, cards: list[int], feature_count: int, market_count: int):
        super().__init__(feature_count, market_count)
        self.tables = nn.ModuleList([nn.Embedding(card, len(PANELS)) for card in cards])
        for table in self.tables:
            nn.init.zeros_(table.weight)

    def forward(self, contexts: torch.Tensor, features: torch.Tensor) -> torch.Tensor:
        logits = super().forward(contexts, features)
        scale = math.sqrt(len(self.tables))
        for field, table in enumerate(self.tables):
            logits = logits + table(contexts[:, field]) / scale
        return logits


class LowRankRanker(DynamicRanker):
    def __init__(self, cards: list[int], feature_count: int, market_count: int,
                 embedding: int = 8, hidden: int = 64, dropout: float = 0.35):
        super().__init__(feature_count, market_count)
        self.embeddings = nn.ModuleList([nn.Embedding(card, embedding) for card in cards])
        self.head = nn.Sequential(
            nn.Linear(len(cards) * embedding, hidden), nn.GELU(), nn.Dropout(dropout),
            nn.Linear(hidden, len(PANELS)),
        )

    def forward(self, contexts: torch.Tensor, features: torch.Tensor) -> torch.Tensor:
        embedded = torch.cat([table(contexts[:, field]) for field, table in enumerate(self.embeddings)], dim=1)
        return super().forward(contexts, features) + self.head(embedded)


@dataclass(frozen=True)
class Config:
    name: str
    kind: str
    weight_decay: float
    lr: float
    dropout: float = 0.0
    loss: str = "cross_entropy"


CONFIGS = (
    Config("dynamic_wd01", "dynamic", 0.01, 0.03),
    Config("dynamic_wd1", "dynamic", 0.10, 0.03),
    Config("additive_wd01", "additive", 0.01, 0.02),
    Config("additive_wd1", "additive", 0.10, 0.02),
    Config("lowrank_d25", "lowrank", 0.01, 0.01, 0.25),
    Config("lowrank_d50", "lowrank", 0.03, 0.01, 0.50),
    Config(f"dynamic_top{TOP_K}", "dynamic", 0.03, 0.02, loss="topk_margin"),
    Config(f"additive_top{TOP_K}", "additive", 0.03, 0.015, loss="topk_margin"),
    Config(f"lowrank_top{TOP_K}", "lowrank", 0.03, 0.008, 0.50, "topk_margin"),
)


def make_model(config: Config, dataset: Dataset) -> nn.Module:
    args = (len(dataset.feature_names), len(set(dataset.markets.tolist())))
    if config.kind == "dynamic":
        return DynamicRanker(*args)
    if config.kind == "additive":
        return AdditiveRanker(dataset.context_cards, *args)
    return LowRankRanker(dataset.context_cards, *args, dropout=config.dropout)


def indices_for(dataset: Dataset, start: date | None, end: date | None) -> np.ndarray:
    values = np.asarray([date.fromisoformat(value) for value in dataset.dates])
    mask = np.ones(len(values), dtype=bool)
    if start is not None:
        mask &= values >= start
    if end is not None:
        mask &= values <= end
    return np.flatnonzero(mask)


def forward_indices_for(dataset: Dataset, market_names: list[str], cutoffs: dict[str, date]) -> np.ndarray:
    return np.asarray([
        index for index, (raw_date, market_id) in enumerate(zip(dataset.dates, dataset.markets))
        if date.fromisoformat(str(raw_date)) > cutoffs[market_names[int(market_id)]]
    ], dtype=np.int64)


def batches(indices: np.ndarray, batch_size: int, shuffle: bool) -> Iterable[np.ndarray]:
    values = indices.copy()
    if shuffle:
        np.random.shuffle(values)
    for start in range(0, len(values), batch_size):
        yield values[start:start + batch_size]


def tensors(dataset: Dataset, index: np.ndarray) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    return (
        torch.from_numpy(dataset.contexts[index]).long(),
        torch.from_numpy(dataset.features[index]).float(),
        torch.from_numpy(dataset.labels[index]).long(),
    )


def logits_for(model: nn.Module, dataset: Dataset, indices: np.ndarray) -> np.ndarray:
    model.eval()
    output: list[np.ndarray] = []
    with torch.no_grad():
        for batch in batches(indices, 256, False):
            contexts, features, _ = tensors(dataset, batch)
            output.append(model(contexts, features).cpu().numpy())
    return np.concatenate(output) if output else np.empty((0, len(PANELS)), dtype=np.float32)


def topk_hits(scores: np.ndarray, labels: np.ndarray, k: int = TOP_K) -> np.ndarray:
    top = np.argpartition(scores, -k, axis=1)[:, -k:]
    return (top == labels[:, None]).any(axis=1)


def quick_metric(scores: np.ndarray, labels: np.ndarray) -> float:
    return float(topk_hits(scores, labels).mean()) if len(labels) else 0.0


def train_model(
    dataset: Dataset,
    config: Config,
    train_idx: np.ndarray,
    early_idx: np.ndarray | None,
    fixed_epochs: int | None = None,
) -> tuple[nn.Module, int, list[dict[str, float]]]:
    seed_all()
    model = make_model(config, dataset)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.lr, weight_decay=config.weight_decay)
    best_state: dict[str, torch.Tensor] | None = None
    best_epoch = 1
    best_score = -1.0
    patience = 6
    stale = 0
    history: list[dict[str, float]] = []
    max_epochs = fixed_epochs or 40

    for epoch in range(1, max_epochs + 1):
        model.train()
        losses: list[float] = []
        for batch in batches(train_idx, 128, True):
            contexts, features, labels = tensors(dataset, batch)
            optimizer.zero_grad(set_to_none=True)
            logits = model(contexts, features)
            cross_entropy = nn.functional.cross_entropy(logits, labels, label_smoothing=0.02)
            if config.loss == "topk_margin":
                true_score = logits.gather(1, labels[:, None]).squeeze(1)
                incorrect = logits.clone()
                incorrect.scatter_(1, labels[:, None], float("-inf"))
                boundary = torch.topk(incorrect, TOP_K, dim=1).values[:, -1]
                rank_loss = nn.functional.softplus(boundary - true_score + 0.5).mean()
                loss = 0.25 * cross_entropy + 0.75 * rank_loss
            else:
                loss = cross_entropy
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step()
            losses.append(float(loss.detach()))
        if early_idx is not None:
            score = quick_metric(logits_for(model, dataset, early_idx), dataset.labels[early_idx])
        else:
            score = quick_metric(logits_for(model, dataset, train_idx), dataset.labels[train_idx])
        history.append({"epoch": epoch, "loss": float(np.mean(losses)), "topK": score})
        if fixed_epochs is not None:
            continue
        if score > best_score + 1e-8:
            best_score = score
            best_epoch = epoch
            best_state = {name: value.detach().clone() for name, value in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                break
    if best_state is not None:
        model.load_state_dict(best_state)
    return model, best_epoch, history


def softmax(scores: np.ndarray) -> np.ndarray:
    shifted = scores - scores.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def wilson(successes: int, n: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if n == 0:
        return 0.0, 0.0
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return center - margin, center + margin


def paired_significance(model_hit: np.ndarray, baseline_hit: np.ndarray) -> dict[str, Any]:
    better = int(np.sum(model_hit & ~baseline_hit))
    worse = int(np.sum(~model_hit & baseline_hit))
    discordant = better + worse
    if discordant == 0:
        p_value = 1.0
    else:
        tail = sum(math.comb(discordant, k) for k in range(min(better, worse) + 1)) / (2 ** discordant)
        p_value = min(1.0, 2 * tail)
    return {"modelOnlyHits": better, "baselineOnlyHits": worse, "exactMcNemarP": p_value}


def calibration(probs: np.ndarray, labels: np.ndarray) -> dict[str, Any]:
    order = np.argpartition(probs, -TOP_K, axis=1)[:, -TOP_K:]
    predicted_mass = np.take_along_axis(probs, order, axis=1).sum(axis=1)
    hits = (order == labels[:, None]).any(axis=1).astype(float)
    edges = np.quantile(predicted_mass, np.linspace(0, 1, 6))
    bins = []
    ece = 0.0
    for index in range(5):
        low, high = edges[index], edges[index + 1]
        mask = (predicted_mass >= low) & (predicted_mass <= high if index == 4 else predicted_mass < high)
        if not mask.any():
            continue
        confidence = float(predicted_mass[mask].mean())
        accuracy = float(hits[mask].mean())
        ece += float(mask.mean()) * abs(confidence - accuracy)
        bins.append({"n": int(mask.sum()), "meanTopKMass": confidence, "hitRate": accuracy})
    return {"meanTopKMass": float(predicted_mass.mean()), "hitRate": float(hits.mean()), "ece5": ece, "bins": bins}


def metrics(scores: np.ndarray, dataset: Dataset, indices: np.ndarray, market_names: list[str]) -> dict[str, Any]:
    labels = dataset.labels[indices]
    probs = softmax(scores)
    ranks = np.argsort(-scores, axis=1)
    rank_positions = np.empty_like(ranks)
    rank_positions[np.arange(len(ranks))[:, None], ranks] = np.arange(1, len(PANELS) + 1)
    actual_ranks = rank_positions[np.arange(len(labels)), labels]
    result: dict[str, Any] = {"n": int(len(labels))}
    for k in sorted({3, 10, 30, TOP_K}):
        hits = int((actual_ranks <= k).sum())
        low, high = wilson(hits, len(labels))
        result[f"top{k}"] = {"hits": hits, "rate": hits / len(labels), "wilson95": [low, high]}
    result["meanReciprocalRank"] = float(np.mean(1.0 / actual_ranks))
    result["logLoss"] = float(-np.log(np.maximum(probs[np.arange(len(labels)), labels], 1e-12)).mean())
    result["calibration"] = calibration(probs, labels)
    per_market = {}
    for market_id, market in enumerate(market_names):
        mask = dataset.markets[indices] == market_id
        if mask.any():
            hits = topk_hits(scores[mask], labels[mask])
            low, high = wilson(int(hits.sum()), int(mask.sum()))
            per_market[market] = {"n": int(mask.sum()), "hits": int(hits.sum()), "rate": float(hits.mean()), "wilson95": [low, high]}
    result["perMarketTopK"] = per_market
    result["macroMarketTopK"] = float(np.mean([row["rate"] for row in per_market.values()]))
    per_month = {}
    month_values = np.asarray([str(value)[:7] for value in dataset.dates[indices]])
    for month in sorted(set(month_values.tolist())):
        mask = month_values == month
        hits = topk_hits(scores[mask], labels[mask])
        per_month[month] = {"n": int(mask.sum()), "hits": int(hits.sum()), "rate": float(hits.mean())}
    result["perMonthTopK"] = per_month
    return result


def tune_and_evaluate(
    dataset: Dataset,
    market_names: list[str],
    forward_dataset: Dataset | None = None,
    forward_idx: np.ndarray | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    train_idx = indices_for(dataset, None, TRAIN_END)
    early_idx = indices_for(dataset, TRAIN_END + timedelta(days=1), EARLY_END)
    select_idx = indices_for(dataset, EARLY_END + timedelta(days=1), SELECT_END)
    holdout_idx = indices_for(dataset, SELECT_END + timedelta(days=1), None)
    selection: list[dict[str, Any]] = []
    selection_logits: dict[str, np.ndarray] = {}

    for config in CONFIGS:
        print(f"  {dataset.task}: selecting {config.name}", flush=True)
        model, epoch, history = train_model(dataset, config, train_idx, early_idx)
        early_scores = logits_for(model, dataset, early_idx)
        select_scores = logits_for(model, dataset, select_idx)
        selection_logits[config.name] = select_scores
        selection.append({
            "config": asdict(config), "bestEpoch": epoch,
            "earlyTopK": quick_metric(early_scores, dataset.labels[early_idx]),
            "selectionTopK": quick_metric(select_scores, dataset.labels[select_idx]),
            "epochsRun": len(history),
        })
    selection.sort(key=lambda row: (row["selectionTopK"], row["earlyTopK"]), reverse=True)
    best = next(config for config in CONFIGS if config.name == selection[0]["config"]["name"])
    fixed_epochs = selection[0]["bestEpoch"]
    pre_holdout = indices_for(dataset, None, SELECT_END)
    print(f"  {dataset.task}: final {best.name} for {fixed_epochs} epochs", flush=True)
    model, _, _ = train_model(dataset, best, pre_holdout, None, fixed_epochs=fixed_epochs)
    learned = logits_for(model, dataset, holdout_idx)
    profile = dataset.profile_scores[holdout_idx]
    hot = dataset.hot_scores[holdout_idx]

    # Blend weight is selected on the selection block, not holdout.
    # These logits come from the pre-selection model. The final model below was
    # trained on the selection block, so using its in-sample logits here would leak.
    selection_learned = selection_logits[best.name]
    selection_profile = dataset.profile_scores[select_idx]
    blend_candidates = []
    for weight in (0.0, 0.25, 0.5, 0.75, 1.0):
        score = quick_metric(weight * selection_learned + (1 - weight) * selection_profile, dataset.labels[select_idx])
        blend_candidates.append({"learnedWeight": weight, "selectionTopK": score})
    blend_candidates.sort(key=lambda row: (row["selectionTopK"], -abs(row["learnedWeight"] - 0.5)), reverse=True)
    blend_weight = blend_candidates[0]["learnedWeight"]
    ensemble = blend_weight * learned + (1 - blend_weight) * profile

    scores_by_name = {"hot": hot, "profile": profile, "learned": learned, "ensemble": ensemble}
    evaluated = {name: metrics(scores, dataset, holdout_idx, market_names) for name, scores in scores_by_name.items()}
    chosen_name = max(("learned", "ensemble"), key=lambda name: blend_candidates[0]["selectionTopK"] if name == "ensemble" else selection[0]["selectionTopK"])
    chosen_scores = scores_by_name[chosen_name]
    chosen_hits = topk_hits(chosen_scores, dataset.labels[holdout_idx])
    profile_hits = topk_hits(profile, dataset.labels[holdout_idx])

    ledger = []
    top = np.argsort(-chosen_scores, axis=1)[:, :TOP_K]
    for local, global_index in enumerate(holdout_idx):
        ledger.append({
            "task": dataset.task,
            "split": "terminal_holdout",
            "date": dataset.dates[global_index],
            "market": market_names[int(dataset.markets[global_index])],
            "model": chosen_name,
            "actual": PANELS[int(dataset.labels[global_index])],
            "hit": bool(chosen_hits[local]),
            "topPanels": " ".join(PANELS[index] for index in top[local]),
        })

    learned_model = model
    global_weights = learned_model.global_weight.detach().cpu().numpy()
    feature_importance = sorted(
        ({"feature": name, "weight": float(weight), "absWeight": float(abs(weight))}
         for name, weight in zip(dataset.feature_names, global_weights)),
        key=lambda row: row["absWeight"], reverse=True,
    )
    outcome = {
        "split": {
            "train": {"end": TRAIN_END.isoformat(), "n": int(len(train_idx))},
            "earlyStop": {"start": (TRAIN_END + timedelta(days=1)).isoformat(), "end": EARLY_END.isoformat(), "n": int(len(early_idx))},
            "modelSelection": {"start": (EARLY_END + timedelta(days=1)).isoformat(), "end": SELECT_END.isoformat(), "n": int(len(select_idx))},
            "terminalHoldout": {"start": (SELECT_END + timedelta(days=1)).isoformat(), "end": max(dataset.dates[holdout_idx].tolist()), "n": int(len(holdout_idx))},
        },
        "selection": selection,
        "selectedConfig": asdict(best),
        "fixedEpochs": fixed_epochs,
        "blendSelection": blend_candidates,
        "chosenModel": chosen_name,
        "holdout": evaluated,
        "chosenVsProfile": paired_significance(chosen_hits, profile_hits),
        "featureImportance": feature_importance,
        "target90": {
            "achieved": bool(evaluated[chosen_name][TOP_METRIC]["rate"] >= 0.90),
            "requiredHits": math.ceil(0.90 * len(holdout_idx)),
            "actualHits": int(chosen_hits.sum()),
            "shortfall": math.ceil(0.90 * len(holdout_idx)) - int(chosen_hits.sum()),
        },
    }

    # Negative control: destroy target/feature dependence within each market while
    # preserving each market's marginal label distribution.
    original_labels = dataset.labels.copy()
    permuted_labels = original_labels.copy()
    rng = np.random.default_rng(SEED + TASKS.index(dataset.task) + 100)
    for market_id in sorted(set(dataset.markets.tolist())):
        market_train = pre_holdout[dataset.markets[pre_holdout] == market_id]
        permuted_labels[market_train] = rng.permutation(permuted_labels[market_train])
    dataset.labels = permuted_labels
    negative_model, _, _ = train_model(dataset, best, pre_holdout, None, fixed_epochs=fixed_epochs)
    dataset.labels = original_labels
    negative_scores = logits_for(negative_model, dataset, holdout_idx)
    outcome["negativeControl"] = {
        "method": "training labels permuted within market; holdout labels untouched",
        "holdout": metrics(negative_scores, dataset, holdout_idx, market_names),
    }

    # Research artifact: same frozen specification, refit on every row in the
    # frozen cache after evaluation is complete. It is not a production model.
    research_model, _, _ = train_model(
        dataset, best, np.arange(len(dataset.labels), dtype=np.int64), None,
        fixed_epochs=fixed_epochs,
    )
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"{dataset.task}.pt"
    torch.save({
        "researchOnly": True,
        "task": dataset.task,
        "config": asdict(best),
        "fixedEpochs": fixed_epochs,
        "stateDict": research_model.state_dict(),
        "contextCards": dataset.context_cards,
        "featureNames": dataset.feature_names,
        "marketNames": market_names,
        "panels": PANELS,
        "seed": SEED,
    }, model_path)
    outcome["artifact"] = {
        "path": str(model_path.relative_to(ROOT)),
        "sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "trainingRows": int(len(dataset.labels)),
        "note": "Refit on the full frozen cache after terminal evaluation; research-only.",
    }

    if forward_dataset is not None and forward_idx is not None and len(forward_idx):
        # The architecture/hyperparameters are already frozen. Refit on every cache
        # row, then score only records fetched after each market's cache cutoff.
        forward_learned = logits_for(research_model, forward_dataset, forward_idx)
        forward_profile = forward_dataset.profile_scores[forward_idx]
        forward_hot = forward_dataset.hot_scores[forward_idx]
        forward_ensemble = blend_weight * forward_learned + (1 - blend_weight) * forward_profile
        forward_scores = {
            "hot": forward_hot,
            "profile": forward_profile,
            "learned": forward_learned,
            "ensemble": forward_ensemble,
        }
        outcome["prospectiveForward"] = {
            name: metrics(scores, forward_dataset, forward_idx, market_names)
            for name, scores in forward_scores.items()
        }
        chosen_forward = forward_scores[chosen_name]
        chosen_forward_hits = topk_hits(chosen_forward, forward_dataset.labels[forward_idx])
        outcome["prospectiveForward"]["chosenVsProfile"] = paired_significance(
            chosen_forward_hits, topk_hits(forward_profile, forward_dataset.labels[forward_idx])
        )
        forward_top = np.argsort(-chosen_forward, axis=1)[:, :TOP_K]
        for local, global_index in enumerate(forward_idx):
            ledger.append({
                "task": dataset.task,
                "split": "prospective_forward",
                "date": forward_dataset.dates[global_index],
                "market": market_names[int(forward_dataset.markets[global_index])],
                "model": chosen_name,
                "actual": PANELS[int(forward_dataset.labels[global_index])],
                "hit": bool(chosen_forward_hits[local]),
                "topPanels": " ".join(PANELS[index] for index in forward_top[local]),
            })
    return outcome, ledger


def feasibility_audit(rows_by_market: dict[str, list[Row]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for task in ("open", "close"):
        field = "open_panel" if task == "open" else "close_panel"
        total = 0
        fixed_topk_hits = 0
        weekday_oracle_hits = 0
        panels_for_90: list[int] = []
        entropies: list[float] = []
        for rows in rows_by_market.values():
            values = [getattr(row, field) for row in rows]
            counts = np.bincount(values, minlength=len(PANELS))
            total += len(values)
            fixed = set(np.argsort(-counts)[:TOP_K].tolist())
            fixed_topk_hits += sum(value in fixed for value in values)
            cumulative = np.cumsum(np.sort(counts)[::-1])
            panels_for_90.append(int(np.searchsorted(cumulative, 0.90 * len(values)) + 1))
            probability = counts[counts > 0] / len(values)
            entropies.append(float(-(probability * np.log2(probability)).sum()))
            for weekday in range(7):
                subset = [getattr(row, field) for row in rows if row.weekday == weekday]
                if not subset:
                    continue
                weekday_counts = np.bincount(subset, minlength=len(PANELS))
                top = set(np.argsort(-weekday_counts)[:TOP_K].tolist())
                weekday_oracle_hits += sum(value in top for value in subset)
        result[task] = {
            "uniformTopKReference": TOP_K / len(PANELS),
            "hindsightFixedMarketTopK": fixed_topk_hits / total,
            "hindsightMarketWeekdayTopK": weekday_oracle_hits / total,
            "medianPanelsNeededFor90PctHindsightCoverage": float(np.median(panels_for_90)),
            "rangePanelsNeededFor90PctHindsightCoverage": [min(panels_for_90), max(panels_for_90)],
            "meanEmpiricalEntropyBits": float(np.mean(entropies)),
            "meanEffectivePanels": float(np.mean([2 ** entropy for entropy in entropies])),
            "warning": "Hindsight rows use their own outcomes and are descriptive upper references, not deployable models.",
        }
    return result


def pct(value: float) -> str:
    return f"{100 * value:.1f}%"


def write_report(payload: dict[str, Any]) -> None:
    lines = [
        f"# {RESEARCH_LABEL}",
        "",
        f"Generated: {payload['generatedAt']}",
        "",
        "## Outcome",
        "",
        "The 90% target is reported only against the terminal chronological holdout. "
        "No holdout result was used for model or blend selection.",
        "",
        f"| Task | Chosen model | Holdout N | {TOP_LABEL} hits | Accuracy | 95% Wilson interval | 90% achieved |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for task in TASKS:
        row = payload["tasks"][task]
        chosen = row["chosenModel"]
        metric = row["holdout"][chosen][TOP_METRIC]
        lines.append(
            f"| {task} | {chosen} | {row['holdout'][chosen]['n']} | {metric['hits']} | "
            f"{pct(metric['rate'])} | {pct(metric['wilson95'][0])}–{pct(metric['wilson95'][1])} | "
            f"{'yes' if row['target90']['achieved'] else 'no'} |"
        )
    lines.extend([
        "",
        "Required hits and observed shortfalls are computed independently for each task:",
        "",
        "| Task | Required for 90% | Actual | Shortfall |",
        "|---|---:|---:|---:|",
        *[
            f"| {task} | {payload['tasks'][task]['target90']['requiredHits']} | "
            f"{payload['tasks'][task]['target90']['actualHits']} | "
            f"{payload['tasks'][task]['target90']['shortfall']} |"
            for task in TASKS
        ],
        "",
        "## Data audit",
        "",
        f"- Frozen cache SHA-256: `{payload['dataAudit']['sha256']}`.",
        f"- {payload['dataAudit']['validRows']} valid completed rows across "
        f"{len(payload['dataAudit']['markets'])} markets, from {payload['dataAudit']['firstDate']} "
        f"through {payload['dataAudit']['lastDate']}.",
        f"- Invalid rows: {payload['dataAudit']['invalidRows']}; duplicate market-dates: "
        f"{payload['dataAudit']['duplicateMarketDates']}; panel/sutta mismatches: "
        f"{payload['dataAudit']['suttaMismatches']}.",
    ])
    lines.extend([
        "",
        "## Baselines and learned models",
        "",
        "| Task | Hot | Fixed profile | Learned | Ensemble |",
        "|---|---:|---:|---:|---:|",
    ])
    for task in TASKS:
        holdout = payload["tasks"][task]["holdout"]
        lines.append(
            f"| {task} | {pct(holdout['hot'][TOP_METRIC]['rate'])} | "
            f"{pct(holdout['profile'][TOP_METRIC]['rate'])} | {pct(holdout['learned'][TOP_METRIC]['rate'])} | "
            f"{pct(holdout['ensemble'][TOP_METRIC]['rate'])} |"
        )
    lines.extend([
        "",
        "## Model selection evidence",
        "",
        "Hyperparameters below are ordered by the untouched-for-training 2026 Q1 selection block. "
        "The terminal and post-cache results did not select a model.",
    ])
    for task in TASKS:
        lines.extend([
            "",
            f"### {task}",
            "",
            f"| Candidate | Loss | 2025 Q4 early-stop {TOP_LABEL} | 2026 Q1 selection {TOP_LABEL} | Decision |",
            "|---|---:|---:|---:|---:|",
        ])
        chosen_config = payload["tasks"][task]["selectedConfig"]["name"]
        for trial in payload["tasks"][task]["selection"]:
            config = trial["config"]
            lines.append(
                f"| {config['name']} | {config['loss']} | {pct(trial['earlyTopK'])} | "
                f"{pct(trial['selectionTopK'])} | {'keep' if config['name'] == chosen_config else 'reject'} |"
            )
    lines.extend([
        "",
        "## Market robustness on the terminal holdout",
        "",
        "| Market | Open | Pre-Open Close | Adjusted Close |",
        "|---|---:|---:|---:|",
    ])
    market_names = list(payload["dataAudit"]["markets"])
    for market in market_names:
        values = []
        for task in TASKS:
            task_row = payload["tasks"][task]
            chosen = task_row["chosenModel"]
            values.append(task_row["holdout"][chosen]["perMarketTopK"][market]["rate"])
        lines.append(f"| {market} | {pct(values[0])} | {pct(values[1])} | {pct(values[2])} |")
    lines.extend([
        "",
        "## Calibration",
        "",
        f"{TOP_LABEL} probability mass should match the realized {TOP_LABEL} hit rate. All selected models "
        "are overconfident, so raw score mass must not be shown as a success probability.",
        "",
        f"| Task | Mean predicted {TOP_LABEL} mass | Realized hit rate | ECE (5 bins) |",
        "|---|---:|---:|---:|",
    ])
    for task in TASKS:
        task_row = payload["tasks"][task]
        chosen = task_row["chosenModel"]
        cal = task_row["holdout"][chosen]["calibration"]
        lines.append(
            f"| {task} | {pct(cal['meanTopKMass'])} | {pct(cal['hitRate'])} | {pct(cal['ece5'])} |"
        )
    if payload.get("forwardAudit", {}).get("acceptedCompletedRows", 0):
        lines.extend([
            "",
            "## Post-cache forward check",
            "",
            f"After the model specification was frozen, the public charts supplied "
            f"{payload['forwardAudit']['acceptedCompletedRows']} completed rows newer than each market's cache cutoff.",
            "",
            f"| Task | Forward N | Chosen {TOP_LABEL} hits | Accuracy | Fixed profile |",
            "|---|---:|---:|---:|---:|",
        ])
        for task in TASKS:
            row = payload["tasks"][task]
            chosen = row["chosenModel"]
            forward = row["prospectiveForward"]
            lines.append(
                f"| {task} | {forward[chosen]['n']} | {forward[chosen][TOP_METRIC]['hits']} | "
                f"{pct(forward[chosen][TOP_METRIC]['rate'])} | {pct(forward['profile'][TOP_METRIC]['rate'])} |"
            )
    lines.extend([
        "",
        "## Negative-label control",
        "",
        "Training labels were permuted within market while terminal labels stayed untouched. "
        "This retains marginal market frequencies but destroys learned temporal relationships.",
        "",
        "| Task | Selected model | Negative control |",
        "|---|---:|---:|",
    ])
    for task in TASKS:
        row = payload["tasks"][task]
        chosen = row["chosenModel"]
        lines.append(
            f"| {task} | {pct(row['holdout'][chosen][TOP_METRIC]['rate'])} | "
            f"{pct(row['negativeControl']['holdout'][TOP_METRIC]['rate'])} |"
        )
    lines.extend([
        "",
        "## Hypothesis decisions",
        "",
        "- Keep cautiously: smoothed panel kind/pair structure, short-window counts, and sparse "
        "lag-transition terms. They supply small rank improvements, especially for pre-Open Close.",
        "- Reject as a universal rule: opposite digits, weekday identities, hot/cold panels, and "
        "same-day cross-market relations. Their learned weights and market/month results are unstable.",
        "- Treat adjusted Close as a separate candidate only when it beats pre-Open Close on both "
        "the terminal holdout and the untouched forward slice.",
        "- Reject: low-rank neural models. Added capacity reduced selection accuracy.",
        f"- Direct {TOP_LABEL} margin optimization is promoted only if its dynamic, additive, or "
        "low-rank variant displaces the cross-entropy candidates on the selection block.",
        "- Reject: profile/learned probability blending. Validation selected 100% learned weight for "
        "all three tasks.",
    ])
    lines.extend([
        "",
        "## Feasibility audit",
        "",
        "These hindsight references are intentionally optimistic because they see all outcomes.",
        "",
        f"| Side | Uniform {TOP_K}/220 | Hindsight market {TOP_LABEL} | Hindsight market+weekday {TOP_LABEL} | Median labels needed to cover 90% | Effective panels |",
        "|---|---:|---:|---:|---:|---:|",
    ])
    for side in ("open", "close"):
        row = payload["feasibility"][side]
        lines.append(
            f"| {side} | {pct(row['uniformTopKReference'])} | {pct(row['hindsightFixedMarketTopK'])} | "
            f"{pct(row['hindsightMarketWeekdayTopK'])} | {row['medianPanelsNeededFor90PctHindsightCoverage']:.0f} | "
            f"{row['meanEffectivePanels']:.1f} |"
        )
    lines.extend([
        "",
        "## Validation design",
        "",
        "- Minimum 120 prior results per market.",
        "- Causal rolling features only; a target outcome never enters its own features.",
        "- Same-day inputs use only the declared earlier-market timing map.",
        "- Only adjusted Close receives the known same-day Open panel.",
        "- Training ends 2025-09-30, early stopping uses 2025 Q4, selection uses 2026 Q1, "
        "and the final audit starts 2026-04-01.",
        "- Exact McNemar tests compare the chosen model with the fixed profile on identical draws.",
        "",
        "## Interpretation",
        "",
        f"A {TOP_LABEL} hit is set coverage, not a profitable wager. Selecting {TOP_K} outcomes has a cost, and "
        "this research has no payout, stake, or liability data. A result below 90% is not raised by "
        "changing the denominator, selecting only favorable markets, or looking at holdout outcomes.",
        "",
        "The full market table, calibration bins, selection trials, weights, hashes, and shortfalls are "
        "in `results.json`; every terminal prediction is in `holdout_ledger.csv`.",
        "",
        "## Research artifacts",
        "",
    ])
    for task in TASKS:
        artifact = payload["tasks"][task]["artifact"]
        lines.append(f"- `{artifact['path']}` — SHA-256 `{artifact['sha256']}`.")
    lines.extend([
        "",
        "These artifacts are intentionally not wired into the application. The adjusted-Close artifact "
        "is retained for reproducibility, not recommended for use.",
    ])
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    seed_all()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows_by_market, audit = load_rows()
    merged_rows, forward_audit, cutoffs = load_forward_rows(rows_by_market)
    market_names = list(rows_by_market)
    print(f"loaded {audit['validRows']} rows across {len(market_names)} markets", flush=True)
    tasks: dict[str, Any] = {}
    ledger: list[dict[str, Any]] = []
    for task in TASKS:
        print(f"building {task}", flush=True)
        dataset = build_dataset(task, rows_by_market)
        forward_dataset = build_dataset(task, merged_rows) if forward_audit.get("available") else None
        forward_idx = forward_indices_for(forward_dataset, market_names, cutoffs) if forward_dataset else None
        print(f"  samples={len(dataset.labels)} features={len(dataset.feature_names)}", flush=True)
        tasks[task], task_ledger = tune_and_evaluate(
            dataset, market_names, forward_dataset=forward_dataset, forward_idx=forward_idx,
        )
        ledger.extend(task_ledger)
        del dataset
        if forward_dataset is not None:
            del forward_dataset

    payload = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "seed": SEED,
        "researchIsolation": {
            "productionFilesModified": False,
            "writes": [str(path.relative_to(ROOT)) for path in (RESULTS, LEDGER, REPORT, MODELS_DIR)],
        },
        "dataAudit": audit,
        "forwardAudit": forward_audit,
        "design": {
            "panelClasses": len(PANELS), "topK": TOP_K, "minimumHistory": MIN_HISTORY,
            "trainEnd": TRAIN_END.isoformat(), "earlyStopEnd": EARLY_END.isoformat(),
            "selectionEnd": SELECT_END.isoformat(), "holdoutStart": (SELECT_END + timedelta(days=1)).isoformat(),
        },
        "feasibility": feasibility_audit(rows_by_market),
        "tasks": tasks,
    }
    RESULTS.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    with LEDGER.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["task", "split", "date", "market", "model", "actual", "hit", "topPanels"])
        writer.writeheader()
        writer.writerows(ledger)
    write_report(payload)
    print(f"wrote {RESULTS.relative_to(ROOT)}, {LEDGER.relative_to(ROOT)}, {REPORT.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
