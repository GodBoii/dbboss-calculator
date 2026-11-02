"""Static, market-specific mixtures of the frozen V7 component specialists.

This is retrospective research: all archive dates have already been examined.
V7's expert choices use development/validation ending September 7, 2026, but
were actually made later. Consequently no earlier-date evaluation or fresh
confirmation claim is justified. Only support counts are causally updated.

Load the explicit I/O boundary with ``load_bundles`` once per channel, then
pass its bank to ``candidates`` for outcome-free probability fusion.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any, Iterator

import numpy as np

COMPONENTS = ("top5", "avoid2", "panel10", "sp30", "dp20")
CHANNELS = ("open", "close_pre", "close_known")
FLOOR = 1e-15
V7 = Path(__file__).resolve().parent.parent / "combined_prediction_v7"
# All profiles retain all five specialists; endpoint priorities are hypotheses,
# not separately chosen output heads. Every variant returns one distribution.
PROFILES = {
    "equal": (1, 1, 1, 1, 1),
    "top5_priority": (4, 1, 1, 1, 1),
    "avoid2_priority": (1, 4, 1, 1, 1),
    "panel10_priority": (1, 1, 4, 1, 1),
    "sp30_priority": (1, 1, 1, 4, 1),
    "dp20_priority": (1, 1, 1, 1, 4),
    "panel_kind_mix": (1, 1, 3, 2, 2),
    "sutta_pair_mix": (3, 3, 1, 1, 1),
    "sp_dp_mix": (1, 1, 1, 3, 3),
}


@dataclass(frozen=True)
class SourceBank:
    channel: str
    dates: np.ndarray
    markets: np.ndarray
    local: dict[str, np.ndarray]
    pooled: dict[str, np.ndarray]
    native: dict[str, np.ndarray]
    local_prior_samples: np.ndarray
    lineage: dict[str, object]


def _normalize(values: np.ndarray) -> np.ndarray:
    values = np.maximum(values, FLOOR)
    return values / values.sum(axis=1, keepdims=True)


def _validated(values: np.ndarray, rows: int, label: str) -> np.ndarray:
    values = np.asarray(values, dtype=np.float64)
    if values.shape != (rows, 220) or not np.isfinite(values).all():
        raise ValueError(f"Invalid {label} shape or nonfinite probabilities")
    if (values < 0).any() or (values.sum(axis=1) <= 0).any():
        raise ValueError(f"Invalid {label}: negative probabilities or zero-mass row")
    return _normalize(values)


def _prior_market_samples(dates: np.ndarray, markets: np.ndarray) -> np.ndarray:
    """Count observations only after the entire forecast date has passed."""
    sizes = np.zeros((len(dates), 1), dtype=np.float64)
    seen: dict[str, int] = {}
    for day in np.unique(dates):
        today = np.flatnonzero(dates == day)
        for row in today:
            sizes[row, 0] = seen.get(str(markets[row]), 0)
        for row in today:
            market = str(markets[row])
            seen[market] = seen.get(market, 0) + 1
    return sizes


def _load_experts() -> Any:
    # No import-time catalogue generation or file access.
    name = "_v8_static_v7_experts"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, V7 / "experts.py")
    if spec is None or spec.loader is None:
        raise ImportError("Cannot load the frozen V7 expert catalogue")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def load_bundles(replay: Any, channel: str, archive_path: Path | None = None,
                 selections_path: Path | None = None,
                 alignment_path: Path | None = None) -> SourceBank:
    """Read validated V7 locals and reconstruct only selected ALL experts.

    ``alignment_path`` is the V7 hits archive containing dates and markets;
    specialist archives alone do not carry enough information to align rows.
    The returned arrays are private copies, never views into the V7 archive.
    """
    if channel not in CHANNELS:
        raise ValueError(f"Unknown channel: {channel!r}")
    dates, markets = np.asarray(replay.dates), np.asarray(replay.markets)
    rows = len(dates)
    if rows == 0 or markets.shape != dates.shape or len(replay.panels) != 220:
        raise ValueError("Expected a nonempty aligned 220-panel replay")
    if list(dates) != sorted(dates) or len(set(zip(dates, markets))) != rows:
        raise ValueError("Expected date-sorted unique date/market observations")
    archive_path = V7 / "specialist_probabilities.npz" if archive_path is None else Path(archive_path)
    selections_path = V7 / "component_selection.json" if selections_path is None else Path(selections_path)
    alignment_path = V7 / "hits.npz" if alignment_path is None else Path(alignment_path)
    with np.load(alignment_path, allow_pickle=False) as aligned:
        if not np.array_equal(dates, aligned["dates"]) or not np.array_equal(markets, aligned["markets"]):
            raise ValueError("Replay order differs from the frozen V7 probability archive")
    with np.load(archive_path, allow_pickle=False) as archive:
        local = {m: _validated(archive[f"{channel}__{m}"], rows, f"local {m}") for m in COMPONENTS}
    selection_bytes = selections_path.read_bytes()
    selection = json.loads(selection_bytes)
    chosen = [item for item in selection if item["channel"] == channel]
    expected = {(m, market) for m in COMPONENTS for market in {"ALL", *map(str, markets)}}
    keys = [(item["metric"], item["market"]) for item in chosen]
    if len(keys) != len(set(keys)) or set(keys) != expected:
        raise ValueError("Incomplete or duplicated V7 component-selection lineage")
    pooled = {
        m: _validated(replay.endpoint_probs(channel, {"panel10": "all10", "dp20": "dp20"}.get(m, "sp30")), rows, f"pooled baseline {m}")
        for m in COMPONENTS
    }
    needed: dict[str, list[str]] = {}
    for item in chosen:
        if item["market"] == "ALL":
            if (item["index"] == 0) != (item["candidate"] == "production"):
                raise ValueError("Inconsistent V7 production component selection")
            if item["index"]:
                needed.setdefault(item["candidate"], []).append(item["metric"])
    if needed:
        experts = _load_experts()
        expert_bank = experts.build_bank(replay, channel)
        remaining = set(needed)
        for metadata, p in experts.candidates(replay, channel, expert_bank):
            cid = str(metadata["id"])
            if cid in remaining:
                for metric in needed[cid]:
                    pooled[metric] = _validated(p, rows, f"pooled {metric}")
                remaining.remove(cid)
            if not remaining:
                break
        if remaining:
            raise ValueError(f"Missing selected V7 experts: {sorted(remaining)}")
    native = {
        source: _validated(replay.endpoint_probs(channel, source), rows, f"native {source}")
        for source in ("sp30", "all10", "dp20")
    }
    # The raw source is a probability feature, not a newly selected expert.
    raw_logits = np.asarray(replay.channels[channel]["logits"])
    native["raw"] = _validated(np.exp(raw_logits - raw_logits.max(axis=1, keepdims=True)), rows, "native raw")
    lineage: dict[str, object] = {
        "archive": str(archive_path),
        "archive_sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        "selection": str(selections_path),
        "selection_sha256": hashlib.sha256(selection_bytes).hexdigest(),
        "component_choices": chosen,
        "component_selection_data_end": "2026-09-07",
        "component_selection_actual_date": "2026-11-02",
        "evaluation_start": "2026-09-08",
        "all_dates_previously_examined": True,
        "fresh_confirmation": False,
    }
    return SourceBank(channel, dates.copy(), markets.copy(), local, pooled, native,
                      _prior_market_samples(dates, markets), lineage)


def build_bank(replay: Any, channel: str, **paths: Any) -> SourceBank:
    """Explicit archive-loading convenience for callers following bank APIs."""
    return load_bundles(replay, channel, **paths)


def candidates(replay: Any, channel: str, bank: SourceBank | None = None
               ) -> Iterator[tuple[dict[str, object], np.ndarray]]:
    """Yield 158 static variants: 144 pools plus 14 source controls.

    Fixed local fractions are 0/.25/.5/.75/1. Support shrinkage uses n/(n+k)
    for k=10/30/100 with n excluding every observation on the target date.
    Profiles and shrinkage strengths are hypotheses for subsequent selection,
    never fitted here. IDs and parameter grids are identical across channels.
    """
    bank = load_bundles(replay, channel) if bank is None else bank
    if bank.channel != channel or not np.array_equal(bank.dates, replay.dates) or not np.array_equal(bank.markets, replay.markets):
        raise ValueError("Source bank does not match replay/channel")

    def meta(family: str, suffix: str, **parameters: object) -> dict[str, object]:
        return {"id": f"static/{family}/{suffix}", "family": f"static_{family}",
                "parameters": parameters, "same_day_labels_excluded": True,
                "retrospective_reused_dates": True,
                "lineage": bank.lineage}

    for name, p in bank.native.items():
        yield meta("native", name, source=name), p
    for scope, bundle in (("pooled", bank.pooled), ("local", bank.local)):
        for component in COMPONENTS:
            yield meta("component_control", f"{scope}/{component}", scope=scope, component=component), bundle[component]
    fractions = [(f"fixed={fraction:g}", fraction, {"local_fraction": fraction})
                 for fraction in (0., .25, .5, .75, 1.)]
    fractions += [(f"prior={prior}", bank.local_prior_samples / (bank.local_prior_samples + prior),
                   {"local_fraction": "n_prior_market/(n_prior_market+prior)", "prior": prior})
                  for prior in (10, 30, 100)]
    for fraction_id, alpha, source_parameters in fractions:
        blended = {m: _normalize((1 - alpha) * bank.pooled[m] + alpha * bank.local[m]) for m in COMPONENTS}
        logs = {m: np.log(p) for m, p in blended.items()}
        for profile, weights in PROFILES.items():
            total = sum(weights)
            parameters = {**source_parameters, "profile": profile,
                          "component_weights": {m: w / total for m, w in zip(COMPONENTS, weights, strict=True)}}
            arithmetic = sum(w * blended[m] for m, w in zip(COMPONENTS, weights, strict=True)) / total
            yield meta("arithmetic", f"{fraction_id}/{profile}", **parameters), _normalize(arithmetic)
            scores = sum(w * logs[m] for m, w in zip(COMPONENTS, weights, strict=True)) / total
            geometric = _normalize(np.exp(scores - scores.max(axis=1, keepdims=True)))
            yield meta("geometric", f"{fraction_id}/{profile}", **parameters), geometric
