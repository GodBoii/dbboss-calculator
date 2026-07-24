"""Conditional-information and nearest-context ceiling audit for Top-30 panels."""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "run_research.py"
EXTENDED_RUNNER = HERE / "run_extended_research.py"
EVENT_RUNNER = HERE / "run_panel_event_sequence.py"
OUTPUT = HERE / "information_ceiling_results.json"
REPORT = HERE / "INFORMATION_CEILING_REPORT.md"
ALPHAS = (5.0, 20.0, 50.0)
K_VALUES = (25, 50, 100, 200)


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


B = load_module("info_base", BASE_PATH)
E = load_module("info_extended", EXTENDED_RUNNER)
T = load_module("info_event", EVENT_RUNNER)


def panel_kind(panel_id: int) -> int:
    return int(B.PANEL_KIND[panel_id]) if panel_id != B.MISSING_PANEL else 2


def build_contexts(dataset: Any, market_names: list[str]) -> tuple[dict[str, list[tuple[int, ...]]], np.ndarray]:
    contexts: dict[str, list[tuple[int, ...]]] = defaultdict(list)
    vectors = []
    market_count = len(market_names)
    pad_event = [market_count, 10, 10, 2, 2, 31]

    for sequence, target in zip(dataset.sequence, dataset.target):
        market, weekday, dom, month = (int(value) for value in target)
        valid = [event for event in sequence if int(event[0]) < market_count]
        own = [event for event in valid if int(event[0]) == market]
        previous = list(reversed(own))

        def own_event(index: int) -> np.ndarray | None:
            return previous[index] if len(previous) > index else None

        prev1 = own_event(0)
        prev2 = own_event(1)
        prev3 = own_event(2)
        prev7 = own_event(6)
        last = valid[-1] if valid else None

        def sutta_pair(event: np.ndarray | None) -> tuple[int, int]:
            return (int(event[5]), int(event[6])) if event is not None else (10, 10)

        def kind_pair(event: np.ndarray | None) -> tuple[int, int]:
            return (
                panel_kind(int(event[1])), panel_kind(int(event[2]))
            ) if event is not None else (2, 2)

        contexts["market"].append((market,))
        contexts["market_weekday"].append((market, weekday))
        contexts["market_month"].append((market, month))
        contexts["market_dom"].append((market, dom))
        contexts["market_prev1_sutta"].append((market, *sutta_pair(prev1)))
        contexts["market_prev12_sutta"].append((market, *sutta_pair(prev1), *sutta_pair(prev2)))
        contexts["market_prev123_sutta"].append(
            (market, *sutta_pair(prev1), *sutta_pair(prev2), *sutta_pair(prev3))
        )
        contexts["market_prev17_sutta"].append((market, *sutta_pair(prev1), *sutta_pair(prev7)))
        contexts["market_prev1_kind"].append((market, *kind_pair(prev1)))
        contexts["market_weekday_prev1"].append((market, weekday, *sutta_pair(prev1)))
        contexts["market_month_prev1"].append((market, month, *sutta_pair(prev1)))
        contexts["market_last_event"].append(
            (market, int(last[0]) if last is not None else market_count, *sutta_pair(last))
        )
        contexts["market_last_event_kind"].append(
            (market, int(last[0]) if last is not None else market_count, *kind_pair(last))
        )
        contexts["market_calendar_coarse"].append((market, weekday, month, dom // 7))
        contexts["market_regime_coarse"].append(
            (market, *sutta_pair(prev1), *kind_pair(prev1), weekday)
        )

        global_tail = valid[-8:]
        global_tokens = [pad_event] * (8 - len(global_tail))
        for event in global_tail:
            global_tokens.append([
                int(event[0]), int(event[5]), int(event[6]),
                panel_kind(int(event[1])), panel_kind(int(event[2])), int(event[4]),
            ])
        own_tail = own[-7:]
        own_tokens = [[10, 10, 2, 2]] * (7 - len(own_tail))
        for event in own_tail:
            own_tokens.append([
                int(event[5]), int(event[6]), panel_kind(int(event[1])), panel_kind(int(event[2])),
            ])
        global_vector = np.asarray(global_tokens, dtype=np.int16).reshape(-1)
        own_vector = np.asarray(own_tokens, dtype=np.int16).reshape(-1)
        vectors.append(np.concatenate([global_vector, own_vector]))

    return dict(contexts), np.stack(vectors)


def labels_for(dataset: Any, side: str) -> np.ndarray:
    return dataset.labels_open if side == "open" else dataset.labels_close


def table_predict(
    contexts: list[tuple[int, ...]], labels: np.ndarray,
    markets: np.ndarray, train_idx: np.ndarray, test_idx: np.ndarray, alpha: float,
) -> tuple[np.ndarray, np.ndarray]:
    market_counts = defaultdict(lambda: np.zeros(len(B.PANELS), dtype=np.float64))
    context_counts = defaultdict(lambda: np.zeros(len(B.PANELS), dtype=np.float64))
    for index in train_idx:
        market_counts[int(markets[index])][int(labels[index])] += 1
        context_counts[contexts[index]][int(labels[index])] += 1
    scores = np.zeros((len(test_idx), len(B.PANELS)), dtype=np.float32)
    probabilities = np.zeros_like(scores)
    for local, index in enumerate(test_idx):
        base_count = market_counts[int(markets[index])]
        base_probability = (base_count + 0.5) / (base_count.sum() + 0.5 * len(B.PANELS))
        conditional = context_counts.get(contexts[index])
        if conditional is None:
            probability = base_probability
        else:
            probability = (conditional + alpha * base_probability) / (conditional.sum() + alpha)
        probabilities[local] = probability
        scores[local] = probability
    return scores, probabilities


def knn_predict(
    vectors: np.ndarray, labels: np.ndarray, markets: np.ndarray,
    train_idx: np.ndarray, test_idx: np.ndarray, k: int,
) -> tuple[np.ndarray, np.ndarray]:
    scores = np.zeros((len(test_idx), len(B.PANELS)), dtype=np.float32)
    probabilities = np.zeros_like(scores)
    for market in sorted(set(markets[test_idx].tolist())):
        train_market = train_idx[markets[train_idx] == market]
        test_positions = np.flatnonzero(markets[test_idx] == market)
        test_market = test_idx[test_positions]
        base_count = np.bincount(labels[train_market], minlength=len(B.PANELS)).astype(np.float64)
        base_probability = (base_count + 0.5) / (base_count.sum() + 0.5 * len(B.PANELS))
        for local_position, global_index in zip(test_positions, test_market):
            distance = np.mean(vectors[train_market] != vectors[global_index], axis=1)
            nearest = train_market[np.argpartition(distance, min(k, len(distance)) - 1)[:min(k, len(distance))]]
            neighbor_count = np.bincount(labels[nearest], minlength=len(B.PANELS)).astype(np.float64)
            probability = (neighbor_count + 20.0 * base_probability) / (len(nearest) + 20.0)
            probabilities[local_position] = probability
            scores[local_position] = probability
    return scores, probabilities


def evaluation(scores: np.ndarray, probabilities: np.ndarray, labels: np.ndarray, indices: np.ndarray) -> dict[str, Any]:
    hits = B.topk_hits(scores, labels[indices])
    actual_probability = np.maximum(probabilities[np.arange(len(indices)), labels[indices]], 1e-12)
    return {
        "n": int(len(indices)), "hits": int(hits.sum()), "rate": float(hits.mean()),
        "logLossBits": float(-np.log2(actual_probability).mean()),
    }


def fit_evaluate(
    kind: str, name: str, parameter: float | int, contexts: dict[str, list[tuple[int, ...]]],
    vectors: np.ndarray, labels: np.ndarray, markets: np.ndarray,
    train_idx: np.ndarray, test_idx: np.ndarray,
) -> dict[str, Any]:
    if kind == "table":
        scores, probabilities = table_predict(contexts[name], labels, markets, train_idx, test_idx, float(parameter))
    else:
        scores, probabilities = knn_predict(vectors, labels, markets, train_idx, test_idx, int(parameter))
    return evaluation(scores, probabilities, labels, test_idx)


def main() -> None:
    base_rows, base_audit = B.load_rows()
    cutoffs = {market: values[-1].iso_date for market, values in base_rows.items()}
    market_names = list(base_rows)
    rows, source_audit = E.load_extended_rows()
    dataset = T.build_dataset(rows, market_names)
    splits = T.split_indices(dataset, market_names, cutoffs)
    contexts, vectors = build_contexts(dataset, market_names)
    previous = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    tasks = {}

    block_train = {
        "early": splits["train"],
        "select": np.concatenate([splits["train"], splits["early"]]),
        "terminal": np.concatenate([splits["train"], splits["early"], splits["select"]]),
        "forward": splits["cacheAll"],
    }
    block_test = {key: splits[key] for key in block_train}

    for side in ("open", "close"):
        print(f"evaluating {side} conditional models", flush=True)
        labels = labels_for(dataset, side)
        trials = []
        for context_name in contexts:
            for alpha in ALPHAS:
                early = fit_evaluate(
                    "table", context_name, alpha, contexts, vectors, labels, dataset.markets,
                    block_train["early"], block_test["early"],
                )
                selection = fit_evaluate(
                    "table", context_name, alpha, contexts, vectors, labels, dataset.markets,
                    block_train["select"], block_test["select"],
                )
                trials.append({"kind": "table", "name": context_name, "parameter": alpha,
                               "early": early, "selection": selection})
        for k in K_VALUES:
            early = fit_evaluate(
                "knn", "event_context", k, contexts, vectors, labels, dataset.markets,
                block_train["early"], block_test["early"],
            )
            selection = fit_evaluate(
                "knn", "event_context", k, contexts, vectors, labels, dataset.markets,
                block_train["select"], block_test["select"],
            )
            trials.append({"kind": "knn", "name": "event_context", "parameter": k,
                           "early": early, "selection": selection})

        marginal_early = next(
            trial for trial in trials
            if trial["kind"] == "table" and trial["name"] == "market" and trial["parameter"] == 20.0
        )
        eligible = [trial for trial in trials if trial["early"]["rate"] >= marginal_early["early"]["rate"] - 0.005]
        eligible.sort(key=lambda row: (row["selection"]["rate"], -row["selection"]["logLossBits"]), reverse=True)
        selected = eligible[0]
        information_eligible = [
            trial for trial in trials
            if trial["early"]["logLossBits"] <= marginal_early["early"]["logLossBits"] + 0.05
        ]
        information_eligible.sort(key=lambda row: row["selection"]["logLossBits"])
        information_selected = information_eligible[0]
        terminal = fit_evaluate(
            selected["kind"], selected["name"], selected["parameter"], contexts, vectors,
            labels, dataset.markets, block_train["terminal"], block_test["terminal"],
        )
        forward = fit_evaluate(
            selected["kind"], selected["name"], selected["parameter"], contexts, vectors,
            labels, dataset.markets, block_train["forward"], block_test["forward"],
        )
        marginal_terminal = fit_evaluate(
            "table", "market", 20.0, contexts, vectors, labels, dataset.markets,
            block_train["terminal"], block_test["terminal"],
        )
        marginal_forward = fit_evaluate(
            "table", "market", 20.0, contexts, vectors, labels, dataset.markets,
            block_train["forward"], block_test["forward"],
        )
        information_terminal = fit_evaluate(
            information_selected["kind"], information_selected["name"],
            information_selected["parameter"], contexts, vectors, labels, dataset.markets,
            block_train["terminal"], block_test["terminal"],
        )
        information_forward = fit_evaluate(
            information_selected["kind"], information_selected["name"],
            information_selected["parameter"], contexts, vectors, labels, dataset.markets,
            block_train["forward"], block_test["forward"],
        )
        previous_key = "open" if side == "open" else "close_preopen"
        previous_task = previous["tasks"][previous_key]
        previous_name = previous_task["chosenModel"]
        tasks[side] = {
            "selected": selected,
            "informationSelected": information_selected,
            "trials": sorted(trials, key=lambda row: row["selection"]["rate"], reverse=True),
            "terminal": terminal, "forward": forward,
            "marketMarginal": {"terminal": marginal_terminal, "forward": marginal_forward},
            "estimatedInformationGainBits": {
                "terminal": marginal_terminal["logLossBits"] - information_terminal["logLossBits"],
                "forward": marginal_forward["logLossBits"] - information_forward["logLossBits"],
            },
            "informationEvaluation": {
                "terminal": information_terminal, "forward": information_forward,
            },
            "previous": {
                "terminal": previous_task["holdout"][previous_name]["top30"],
                "forward": previous_task["prospectiveForward"][previous_name]["top30"],
            },
            "target90": terminal["rate"] >= 0.90 and forward["rate"] >= 0.90,
        }

    panel_count = len(B.PANELS)
    list_size = B.TOP_K
    success_probability = 0.90
    error_probability = 1.0 - success_probability
    binary_entropy = -sum(
        value * math.log2(value) for value in (success_probability, error_probability) if value > 0
    )
    list_fano_uniform_required = (
        math.log2(panel_count)
        - binary_entropy
        - error_probability * math.log2(panel_count - list_size)
        - success_probability * math.log2(list_size)
    )
    list_fano_conservative = success_probability * math.log2(panel_count / list_size) - 1.0
    empirical_entropy = {
        side: float(np.mean([
            -(probability[probability > 0] * np.log2(probability[probability > 0])).sum()
            for market in range(len(market_names))
            for probability in [
                np.bincount(labels_for(dataset, side)[dataset.markets == market], minlength=panel_count)
                / max(1, np.sum(dataset.markets == market))
            ]
            if np.any(probability)
        ]))
        for side in ("open", "close")
    }
    payload = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "productionFilesModified": False,
        "sourceAudit": source_audit,
        "trustedCacheSha256": base_audit["sha256"],
        "datasetRows": int(len(dataset.dates)),
        "candidateCountPerSide": len(contexts) * len(ALPHAS) + len(K_VALUES),
        "observableFeatureFamilies": list(contexts) + ["event_context_knn"],
        "informationRequirement": {
            "panelClasses": panel_count, "listSize": list_size,
            "uniformGeneralizedFanoLowerBoundBitsFor90Pct": list_fano_uniform_required,
            "conservativeSimplifiedLowerBoundBitsFor90Pct": list_fano_conservative,
            "note": "Necessary mutual-information scales under a uniform-label list-decoding bound; not a dataset-specific impossibility proof.",
            "empiricalMarketEntropyBits": empirical_entropy,
        },
        "tasks": tasks,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def pct(value: float) -> str:
        return f"{100 * value:.2f}%"

    lines = [
        "# Conditional-information audit", "",
        f"Causal targets: {len(dataset.dates):,}; candidate conditional models per side: "
        f"{payload['candidateCountPerSide']}.", "",
        f"The direct uniform generalized-Fano calculation places the necessary information scale "
        f"for 90% Top-30 coverage at approximately **{list_fano_uniform_required:.2f} bits/draw**; "
        f"a looser conservative form gives **{list_fano_conservative:.2f} bits/draw**.", "",
        "These are necessary scales under a uniform-label assumption, not a proof that no untested "
        "causal feature can work. The gains below are out-of-sample estimates for the audited "
        "historical feature families.", "",
        "| Side | Top-30-selected context | Terminal | Forward | Information-selected context | Terminal gain | Forward gain | 90% |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for side, row in tasks.items():
        lines.append(
            f"| {side} | {row['selected']['kind']}:{row['selected']['name']}:{row['selected']['parameter']} | "
            f"{row['terminal']['hits']}/{row['terminal']['n']} ({pct(row['terminal']['rate'])}) | "
            f"{row['forward']['hits']}/{row['forward']['n']} ({pct(row['forward']['rate'])}) | "
            f"{row['informationSelected']['kind']}:{row['informationSelected']['name']}:"
            f"{row['informationSelected']['parameter']} | "
            f"{row['estimatedInformationGainBits']['terminal']:.3f} bits | "
            f"{row['estimatedInformationGainBits']['forward']:.3f} bits | "
            f"{'yes' if row['target90'] else 'no'} |"
        )
    for side, row in tasks.items():
        lines.extend(["", f"## {side} selection leaders", "",
                      "| Model | Parameter | Early Top-30 | Selection Top-30 | Selection log-loss |",
                      "|---|---:|---:|---:|---:|"])
        for trial in row["trials"][:15]:
            lines.append(
                f"| {trial['kind']}:{trial['name']} | {trial['parameter']} | "
                f"{pct(trial['early']['rate'])} | {pct(trial['selection']['rate'])} | "
                f"{trial['selection']['logLossBits']:.3f} bits |"
            )
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(ROOT)} and {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
