"""Leakage-free rolling adaptive challengers for production Top-6 Sutta rankings.

The production Top-4 prefix is frozen. A fixed library of causal feature experts
competes for ranks 5-6. Online weights at row t use outcomes strictly before t.
Policy parameters are selected on historical development only, then reported on
validation, chronological holdout, and the separately frozen forward ledger.
"""

from __future__ import annotations

import bisect
import importlib.util
import json
import math
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
FEATURE_MODULE_PATH = ROOT / "scripts" / "sutta-model-research.py"
HISTORICAL_LEDGER = ROOT / "scratch" / "sutta-goal95-v1010-730-ledger.json"
FORWARD_LEDGER = ROOT / "scratch" / "sutta-baseline-7d-goal95-v1010.json"
OUTPUT = ROOT / "scratch" / "sutta-rolling-adaptive-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-13" / "sutta-rolling-adaptive-research.md"
MIN_ONLINE_HISTORY = 20
WINDOWS = (20, 40, 80, 160, 10_000)
PRIORS = (10.0, 30.0)
BETAS = (5.0, 10.0, 20.0)


def load_feature_module():
    spec = importlib.util.spec_from_file_location("sutta_model_research", FEATURE_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {FEATURE_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FEATURES = load_feature_module()
MARKETS = FEATURES.MARKETS


@dataclass(frozen=True)
class Variant:
    kind: str
    window: int
    prior: float
    beta: float = 0.0

    @property
    def name(self) -> str:
        window = "all" if self.window >= 10_000 else str(self.window)
        if self.kind == "winner":
            return f"winner:w{window}:p{self.prior:g}"
        return f"vote:w{window}:p{self.prior:g}:b{self.beta:g}"


SIDE_VARIANTS = tuple(
    [Variant("winner", window, prior) for window in WINDOWS for prior in PRIORS]
    + [Variant("vote", window, prior, beta) for window in WINDOWS for prior in PRIORS for beta in BETAS]
)


def read_ledger(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))["ledger"]


def hybrid_set(base: list[int], expert_order: list[int]) -> list[int]:
    output = list(base[:4])
    output.extend(digit for digit in expert_order if digit not in output)
    output.extend(digit for digit in base if digit not in output)
    output.extend(digit for digit in range(10) if digit not in output)
    return output[:6]


def build_case_matrices(market: str, historical: list[dict], forward: list[dict]) -> dict[str, Any]:
    cache_rows = FEATURES.load_rows()[market]
    cache_dates = [row.iso for row in cache_rows]
    combined_by_date = {row["isoDate"]: (row, False) for row in historical}
    combined_by_date.update({row["isoDate"]: (row, True) for row in forward})
    combined = [(iso, *combined_by_date[iso]) for iso in sorted(combined_by_date)]

    prepared = []
    expert_names: list[str] | None = None
    for iso, ledger_row, is_forward in combined:
        cache_index = bisect.bisect_left(cache_dates, iso)
        if cache_index < 50 or cache_index >= len(cache_rows) or cache_rows[cache_index].iso != iso:
            continue
        target = cache_rows[cache_index]
        prior = cache_rows[:cache_index]
        open_scores = FEATURES.feature_scores(prior, "open", target)
        close_scores = FEATURES.feature_scores(prior, "close", target)
        common = sorted(set(open_scores) & set(close_scores))
        if expert_names is None:
            expert_names = common
        elif common != expert_names:
            raise RuntimeError(f"Expert library changed within {market} at {iso}")
        prepared.append((iso, ledger_row, is_forward, open_scores, close_scores))

    if not prepared or expert_names is None:
        raise RuntimeError(f"No prepared cases for {market}")

    names = ["production"] + expert_names
    total = len(prepared)
    experts = len(names)
    open_sets = np.zeros((total, experts, 6), dtype=np.int8)
    close_sets = np.zeros((total, experts, 6), dtype=np.int8)
    actual_open = np.zeros(total, dtype=np.int8)
    actual_close = np.zeros(total, dtype=np.int8)
    dates = []
    forward_mask = np.zeros(total, dtype=bool)

    for index, (iso, ledger_row, is_forward, open_scores, close_scores) in enumerate(prepared):
        dates.append(iso)
        forward_mask[index] = is_forward
        actual_open[index] = int(ledger_row["actualOpen"])
        actual_close[index] = int(ledger_row["actualClose"])
        base_open = [int(value) for value in ledger_row["openRanking"]]
        base_close = [int(value) for value in ledger_row["closeRanking"]]
        open_sets[index, 0] = base_open
        close_sets[index, 0] = base_close
        for expert_index, name in enumerate(expert_names, start=1):
            open_order = FEATURES.rank(open_scores[name])
            close_order = FEATURES.rank(close_scores[name])
            open_sets[index, expert_index] = hybrid_set(base_open, open_order)
            close_sets[index, expert_index] = hybrid_set(base_close, close_order)

    open_hits = np.any(open_sets == actual_open[:, None, None], axis=2)
    close_hits = np.any(close_sets == actual_close[:, None, None], axis=2)
    historical_indices = np.flatnonzero(~forward_mask)
    historical_n = len(historical_indices)
    if not np.array_equal(historical_indices, np.arange(historical_n)):
        raise RuntimeError(f"Forward rows are not a final block for {market}")
    dev_end = math.floor(historical_n * 0.6)
    val_end = math.floor(historical_n * 0.8)
    blocks = {
        "development": np.arange(0, dev_end),
        "validation": np.arange(dev_end, val_end),
        "holdout": np.arange(val_end, historical_n),
        "historical": np.arange(0, historical_n),
        "forward": np.arange(historical_n, total),
    }
    return {
        "market": market,
        "dates": dates,
        "expertNames": names,
        "openSets": open_sets,
        "closeSets": close_sets,
        "openHits": open_hits,
        "closeHits": close_hits,
        "actualOpen": actual_open,
        "actualClose": actual_close,
        "blocks": blocks,
    }


def membership_mask(sets: np.ndarray) -> np.ndarray:
    total, experts, _ = sets.shape
    output = np.zeros((total, experts, 10), dtype=np.float64)
    row_index = np.arange(total)[:, None, None]
    expert_index = np.arange(experts)[None, :, None]
    output[row_index, expert_index, sets] = 1.0
    return output


def simulate_side(sets: np.ndarray, hits: np.ndarray, actual: np.ndarray, variant: Variant) -> dict[str, Any]:
    total, experts, _ = sets.shape
    prefix = np.vstack([np.zeros((1, experts), dtype=np.int32), np.cumsum(hits, axis=0, dtype=np.int32)])
    masks = membership_mask(sets) if variant.kind == "vote" else None
    predictions = np.zeros((total, 6), dtype=np.int8)
    selected_experts = np.zeros(total, dtype=np.int16)

    for index in range(total):
        if index < MIN_ONLINE_HISTORY:
            predictions[index] = sets[index, 0]
            continue
        start = max(0, index - variant.window)
        count = index - start
        recent_hits = prefix[index] - prefix[start]
        rates = (recent_hits + variant.prior * 0.6) / (count + variant.prior)
        if variant.kind == "winner":
            selected = int(np.argmax(rates))
            selected_experts[index] = selected
            predictions[index] = sets[index, selected]
            continue
        centered = variant.beta * (rates - np.max(rates))
        weights = np.exp(centered)
        votes = weights @ masks[index]
        prefix_digits = [int(value) for value in sets[index, 0, :4]]
        ordering = sorted(range(10), key=lambda digit: (-votes[digit], digit))
        predictions[index] = hybrid_set(prefix_digits, ordering)

    prediction_hits = np.any(predictions == actual[:, None], axis=1)
    return {
        "predictions": predictions,
        "hits": prediction_hits,
        "selectedExperts": selected_experts,
    }


def metric(hits: np.ndarray, baseline_hits: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    n = int(len(indices))
    candidate = int(np.sum(hits[indices])) if n else 0
    baseline = int(np.sum(baseline_hits[indices])) if n else 0
    return {
        "n": n,
        "baseline": baseline,
        "candidate": candidate,
        "delta": candidate - baseline,
        "baselineAccuracy": round(100 * baseline / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate / n, 3) if n else 0.0,
    }


def side_variant_result(case: dict[str, Any], side: str, variant: Variant) -> dict[str, Any]:
    sets = case[f"{side}Sets"]
    hits = case[f"{side}Hits"]
    actual = case[f"actual{side.title()}"]
    simulation = simulate_side(sets, hits, actual, variant)
    metrics = {
        name: metric(simulation["hits"], hits[:, 0], indices)
        for name, indices in case["blocks"].items()
    }
    return {"variant": variant.name, "metrics": metrics, "simulation": simulation}


def choose_side_variant(case: dict[str, Any], side: str) -> dict[str, Any]:
    evaluated = [side_variant_result(case, side, variant) for variant in SIDE_VARIANTS]
    selected = max(
        evaluated,
        key=lambda row: (
            row["metrics"]["development"]["delta"],
            row["metrics"]["development"]["candidate"],
            -SIDE_VARIANTS.index(next(variant for variant in SIDE_VARIANTS if variant.name == row["variant"])),
        ),
    )
    if selected["metrics"]["development"]["delta"] <= 0:
        hits = case[f"{side}Hits"][:, 0]
        selected = {
            "variant": "production",
            "metrics": {
                name: metric(hits, hits, indices)
                for name, indices in case["blocks"].items()
            },
            "simulation": {
                "predictions": case[f"{side}Sets"][:, 0],
                "hits": hits,
                "selectedExperts": np.zeros(len(hits), dtype=np.int16),
            },
        }
    return {
        "variant": selected["variant"],
        "metrics": selected["metrics"],
        "simulation": selected["simulation"],
        "promotable": (
            selected["metrics"]["development"]["delta"] > 0
            and selected["metrics"]["validation"]["delta"] >= 0
            and selected["metrics"]["holdout"]["delta"] >= 0
            and selected["metrics"]["historical"]["delta"] > 0
            and selected["metrics"]["forward"]["delta"] >= 0
        ),
    }


def simulate_joint_pair(case: dict[str, Any], window: int) -> dict[str, Any]:
    open_hits = case["openHits"]
    close_hits = case["closeHits"]
    pair_hits = open_hits[:, :, None] & close_hits[:, None, :]
    total, open_experts, close_experts = pair_hits.shape
    flattened = pair_hits.reshape(total, open_experts * close_experts)
    prefix = np.vstack([
        np.zeros((1, flattened.shape[1]), dtype=np.int32),
        np.cumsum(flattened, axis=0, dtype=np.int32),
    ])
    open_predictions = np.zeros((total, 6), dtype=np.int8)
    close_predictions = np.zeros((total, 6), dtype=np.int8)
    for index in range(total):
        selected = 0
        if index >= MIN_ONLINE_HISTORY:
            start = max(0, index - window)
            selected = int(np.argmax(prefix[index] - prefix[start]))
        open_index, close_index = divmod(selected, close_experts)
        open_predictions[index] = case["openSets"][index, open_index]
        close_predictions[index] = case["closeSets"][index, close_index]
    open_selected_hits = np.any(open_predictions == case["actualOpen"][:, None], axis=1)
    close_selected_hits = np.any(close_predictions == case["actualClose"][:, None], axis=1)
    return {
        "openPredictions": open_predictions,
        "closePredictions": close_predictions,
        "openHits": open_selected_hits,
        "closeHits": close_selected_hits,
        "jodiHits": open_selected_hits & close_selected_hits,
    }


def choose_joint_variant(case: dict[str, Any]) -> dict[str, Any]:
    baseline_jodi = case["openHits"][:, 0] & case["closeHits"][:, 0]
    evaluated = []
    for window in WINDOWS:
        simulation = simulate_joint_pair(case, window)
        metrics = {
            name: metric(simulation["jodiHits"], baseline_jodi, indices)
            for name, indices in case["blocks"].items()
        }
        evaluated.append({
            "variant": f"joint-winner:w{'all' if window >= 10_000 else window}",
            "window": window,
            "metrics": metrics,
            "simulation": simulation,
        })
    selected = max(evaluated, key=lambda row: (row["metrics"]["development"]["delta"], -WINDOWS.index(row["window"])))
    if selected["metrics"]["development"]["delta"] <= 0:
        selected = {
            "variant": "production",
            "metrics": {
                name: metric(baseline_jodi, baseline_jodi, indices)
                for name, indices in case["blocks"].items()
            },
            "simulation": {
                "openPredictions": case["openSets"][:, 0],
                "closePredictions": case["closeSets"][:, 0],
                "openHits": case["openHits"][:, 0],
                "closeHits": case["closeHits"][:, 0],
                "jodiHits": baseline_jodi,
            },
        }
    return {
        "variant": selected["variant"],
        "metrics": selected["metrics"],
        "simulation": selected["simulation"],
        "promotable": (
            selected["metrics"]["development"]["delta"] > 0
            and selected["metrics"]["validation"]["delta"] >= 0
            and selected["metrics"]["holdout"]["delta"] >= 0
            and selected["metrics"]["historical"]["delta"] > 0
            and selected["metrics"]["forward"]["delta"] >= 0
        ),
    }


def compact_result(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "variant": result["variant"],
        "metrics": result["metrics"],
        "promotable": result["promotable"],
    }


def aggregate_metric(rows: list[tuple[np.ndarray, np.ndarray, np.ndarray]]) -> dict[str, Any]:
    baseline = sum(int(np.sum(base[indices])) for base, candidate, indices in rows)
    candidate = sum(int(np.sum(candidate[indices])) for base, candidate, indices in rows)
    n = sum(len(indices) for base, candidate, indices in rows)
    return {
        "n": n,
        "baseline": baseline,
        "candidate": candidate,
        "delta": candidate - baseline,
        "baselineAccuracy": round(100 * baseline / n, 3) if n else 0.0,
        "candidateAccuracy": round(100 * candidate / n, 3) if n else 0.0,
    }


def pct(metric_row: dict[str, Any], key: str) -> str:
    return f'{metric_row[key]}/{metric_row["n"]} ({metric_row[key + "Accuracy"]:.1f}%)'


def markdown_table(rows: list[list[Any]], headers: list[str]) -> str:
    lines = [f'| {" | ".join(headers)} |', f'| {" | ".join("---" for _ in headers)} |']
    lines.extend(f'| {" | ".join(str(value) for value in row)} |' for row in rows)
    return "\n".join(lines)


def main() -> None:
    historical_rows = read_ledger(HISTORICAL_LEDGER)
    forward_rows = read_ledger(FORWARD_LEDGER)
    historical_by_market = {market: [row for row in historical_rows if row["market"] == market] for market in MARKETS}
    forward_by_market = {market: [row for row in forward_rows if row["market"] == market] for market in MARKETS}

    per_market = {}
    aggregate_rows = {block: {target: [] for target in ("open", "close", "independentJodi", "jointJodi")} for block in ("development", "validation", "holdout", "historical", "forward")}
    for market in MARKETS:
        case = build_case_matrices(market, historical_by_market[market], forward_by_market[market])
        open_result = choose_side_variant(case, "open")
        close_result = choose_side_variant(case, "close")
        joint_result = choose_joint_variant(case)
        independent_jodi_hits = open_result["simulation"]["hits"] & close_result["simulation"]["hits"]
        baseline_jodi_hits = case["openHits"][:, 0] & case["closeHits"][:, 0]
        independent_jodi_metrics = {
            block: metric(independent_jodi_hits, baseline_jodi_hits, indices)
            for block, indices in case["blocks"].items()
        }
        per_market[market] = {
            "open": compact_result(open_result),
            "close": compact_result(close_result),
            "independentJodi": {"variant": "selected-open+selected-close", "metrics": independent_jodi_metrics},
            "jointJodi": compact_result(joint_result),
        }
        for block, indices in case["blocks"].items():
            aggregate_rows[block]["open"].append((case["openHits"][:, 0], open_result["simulation"]["hits"], indices))
            aggregate_rows[block]["close"].append((case["closeHits"][:, 0], close_result["simulation"]["hits"], indices))
            aggregate_rows[block]["independentJodi"].append((baseline_jodi_hits, independent_jodi_hits, indices))
            aggregate_rows[block]["jointJodi"].append((baseline_jodi_hits, joint_result["simulation"]["jodiHits"], indices))

    aggregate = {
        block: {target: aggregate_metric(rows) for target, rows in targets.items()}
        for block, targets in aggregate_rows.items()
    }
    output = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "design": {
            "historicalLedger": str(HISTORICAL_LEDGER),
            "forwardLedger": str(FORWARD_LEDGER),
            "minimumOnlineHistory": MIN_ONLINE_HISTORY,
            "windows": WINDOWS,
            "priors": PRIORS,
            "betas": BETAS,
            "selection": "development only; validation/holdout/forward are verification gates",
        },
        "aggregate": aggregate,
        "perMarket": per_market,
    }
    OUTPUT.write_text(json.dumps(output, indent=2), encoding="utf-8")

    aggregate_rows_md = []
    for block in ("development", "validation", "holdout", "historical", "forward"):
        row = [block]
        for target in ("open", "close", "independentJodi", "jointJodi"):
            value = aggregate[block][target]
            row.append(f'{pct(value, "baseline")} -> {pct(value, "candidate")} ({value["delta"]:+d})')
        aggregate_rows_md.append(row)
    market_rows_md = []
    for market in MARKETS:
        row = [market]
        for target in ("open", "close", "independentJodi", "jointJodi"):
            value = per_market[market][target]["metrics"]["forward"]
            row.append(f'{pct(value, "baseline")} -> {pct(value, "candidate")} ({value["delta"]:+d})')
        market_rows_md.append(row)
    report = "\n".join([
        "# Rolling Adaptive Sutta Research",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        "All expert weights use outcomes strictly before the target row. Policy parameters are selected on development only. Validation, chronological holdout, and the frozen forward week never choose a policy.",
        "",
        "## Aggregate comparison",
        "",
        markdown_table(aggregate_rows_md, ["Block", "Open", "Close", "Independent Jodi", "Joint Jodi"]),
        "",
        "## Frozen forward week by market",
        "",
        markdown_table(market_rows_md, ["Market", "Open", "Close", "Independent Jodi", "Joint Jodi"]),
        "",
        "A production promotion requires positive development and full-history delta, with no regression in validation, chronological holdout, or forward verification. Results below that gate remain research-only.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(report, encoding="utf-8")
    print(markdown_table(aggregate_rows_md, ["Block", "Open", "Close", "Independent Jodi", "Joint Jodi"]))
    print(f"\nSaved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
