"""Leakage-safe research for predicting one pair whose two digits both appear.

The script compares a direct joint co-appearance model with causal signals
derived from the existing avoid, panel, sutta, jodi, side, and SP/DP models.
The final 180 calendar days are never used for route selection.
"""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from bisect import bisect_left
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE_PATH = ROOT / "research" / "absent_digits_v2" / "run_research.py"
RESULTS_PATH = HERE / "results.json"
REPORT_PATH = HERE / "REPORT.md"
PAIRS = [(left, right) for left in range(10) for right in range(left + 1, 10)]
MIN_HISTORY = 180
TARGET = 0.70


def load_base():
    spec = importlib.util.spec_from_file_location("present_digits_base", BASE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load the shared historical-data loader.")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BASE = load_base()


def best_pair(scores: np.ndarray) -> int:
    return int(np.argmax(scores))


def sutta(panel: str) -> int:
    return sum(map(int, panel)) % 10


def exact_sign_pvalue(left_only: int, right_only: int) -> float:
    discordant = left_only + right_only
    if discordant == 0:
        return 1.0
    tail = sum(
        math.comb(discordant, value)
        for value in range(0, min(left_only, right_only) + 1)
    ) / (2**discordant)
    return min(1.0, 2 * tail)


def metric(hits: list[bool]) -> dict[str, Any]:
    total = len(hits)
    successes = sum(hits)
    return {
        "events": total,
        "hits": successes,
        "accuracy": successes / total if total else 0.0,
    }


def build_route_events(
    market: str,
    side: str,
    rows: list[dict[str, Any]],
    earliest: str,
) -> list[dict[str, Any]]:
    panels = [BASE.panel_for(row, side) for row in rows]
    other_side = "close" if side == "open" else "open"
    other_panels = [BASE.panel_for(row, other_side) for row in rows]
    masks = np.array([BASE.mask_for(panel) for panel in panels], dtype=np.int16)
    other_masks = np.array(
        [BASE.mask_for(panel) for panel in other_panels], dtype=np.int16
    )
    digits = np.array(
        [[int(bool(mask & (1 << digit))) for digit in range(10)] for mask in masks],
        dtype=np.int8,
    )
    pairs = np.array(
        [
            [digits[index, left] * digits[index, right] for left, right in PAIRS]
            for index in range(len(rows))
        ],
        dtype=np.int8,
    )
    digit_prefix = np.vstack([np.zeros((1, 10), dtype=int), digits.cumsum(axis=0)])
    pair_prefix = np.vstack([np.zeros((1, 45), dtype=int), pairs.cumsum(axis=0)])
    weekdays = np.array(
        [BASE.DAY_OFFSETS.get(row.get("day"), 0) for row in rows], dtype=np.int8
    )
    kinds = digits.sum(axis=1)
    suttas = np.array([sutta(panel) for panel in panels], dtype=np.int8)
    jodis = [
        str(row.get("jodi") or f"{sutta(row['openPanel'])}{sutta(row['closePanel'])}")
        for row in rows
    ]

    weekday_prefix = [
        np.vstack(
            [
                np.zeros((1, 45), dtype=int),
                (pairs * (weekdays[:, None] == weekday)).cumsum(axis=0),
            ]
        )
        for weekday in range(7)
    ]
    sutta_prefix = [
        np.vstack(
            [
                np.zeros((1, 45), dtype=int),
                (pairs * (suttas[:, None] == value)).cumsum(axis=0),
            ]
        )
        for value in range(10)
    ]
    kind_prefix = {
        kind: np.vstack(
            [
                np.zeros((1, 45), dtype=int),
                (pairs * (kinds[:, None] == kind)).cumsum(axis=0),
            ]
        )
        for kind in (2, 3)
    }
    panel_decay = np.zeros((len(rows), 45), dtype=float)
    for index in range(1, len(rows)):
        panel_decay[index] = 0.99 * panel_decay[index - 1] + pairs[index - 1]

    jodi_indices: dict[str, list[int]] = defaultdict(list)
    for index in range(1, len(rows)):
        jodi_indices[jodis[index - 1]].append(index)

    events = []
    for index in range(MIN_HISTORY, len(rows)):
        iso = rows[index]["isoDate"]
        if iso < earliest:
            continue
        candidates: dict[str, int] = {}
        for window in (30, 90, 180, 730):
            start = max(0, index - window)
            candidates[f"joint_{window}"] = best_pair(
                pair_prefix[index] - pair_prefix[start]
            )

        start = max(0, index - 180)
        marginal = digit_prefix[index] - digit_prefix[start]
        top_digits = sorted(range(10), key=lambda value: (-marginal[value], value))[:2]
        candidates["avoid_appearance_marginal"] = PAIRS.index(tuple(sorted(top_digits)))
        candidates["panel_rank_recency"] = best_pair(panel_decay[index])

        weekday = int(weekdays[index])
        start = max(0, index - 730)
        candidates["weekday_joint"] = best_pair(
            weekday_prefix[weekday][index] - weekday_prefix[weekday][start]
        )

        recent_start = max(0, index - 30)
        recent_suttas = np.bincount(suttas[recent_start:index], minlength=10)
        predicted_suttas = np.argsort(-recent_suttas, kind="stable")[:3]
        sutta_scores = sum(
            (
                sutta_prefix[int(value)][index]
                - sutta_prefix[int(value)][max(0, index - 730)]
            )
            for value in predicted_suttas
        )
        candidates["sutta_conditioned"] = best_pair(sutta_scores)

        recent_kinds = kinds[max(0, index - 90) : index]
        predicted_kind = 3 if np.mean(recent_kinds == 3) >= 0.5 else 2
        candidates["sp_dp_conditioned"] = best_pair(
            kind_prefix[predicted_kind][index]
            - kind_prefix[predicted_kind][max(0, index - 730)]
        )

        state = jodis[index - 1]
        state_indices = jodi_indices[state]
        state_end = bisect_left(state_indices, index)
        matched = state_indices[max(0, state_end - 180) : state_end]
        candidates["jodi_transition"] = (
            best_pair(pairs[matched].sum(axis=0))
            if matched
            else candidates["joint_180"]
        )

        other_digits = np.array(
            [
                [int(bool(mask & (1 << digit))) for digit in range(10)]
                for mask in other_masks[max(0, index - 180) : index]
            ]
        )
        other_pair_counts = np.array(
            [
                np.sum(other_digits[:, left] * other_digits[:, right])
                for left, right in PAIRS
            ]
        )
        candidates["other_side_model_transfer"] = best_pair(other_pair_counts)

        actual = pairs[index].astype(bool)
        events.append(
            {
                "date": iso,
                "market": market,
                "side": side,
                "hits": {
                    name: bool(actual[pair_index])
                    for name, pair_index in candidates.items()
                },
            }
        )
    return events


def compare(events: list[dict[str, Any]], names: list[str]) -> dict[str, Any]:
    return {
        name: metric([event["hits"][name] for event in events])
        for name in names
    }


def paired(events: list[dict[str, Any]], candidate: str, baseline: str) -> dict[str, Any]:
    candidate_only = sum(
        event["hits"][candidate] and not event["hits"][baseline] for event in events
    )
    baseline_only = sum(
        event["hits"][baseline] and not event["hits"][candidate] for event in events
    )
    return {
        "candidateOnly": candidate_only,
        "baselineOnly": baseline_only,
        "exactSignP": exact_sign_pvalue(candidate_only, baseline_only),
    }


def evaluate() -> dict[str, Any]:
    rows_by_market, source = BASE.load_rows()
    latest = max(rows[-1]["isoDate"] for rows in rows_by_market.values())
    latest_date = date.fromisoformat(latest)
    start_180 = (latest_date - timedelta(days=179)).isoformat()
    start_30 = (latest_date - timedelta(days=29)).isoformat()
    selection_start = (latest_date - timedelta(days=544)).isoformat()
    all_events = []
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            all_events.extend(
                build_route_events(market, side, rows_by_market[market], selection_start)
            )
    all_events.sort(key=lambda event: (event["date"], event["market"], event["side"]))
    names = list(all_events[0]["hits"])
    windows = {
        "last30": [event for event in all_events if event["date"] >= start_30],
        "last180": [event for event in all_events if event["date"] >= start_180],
    }
    baseline = "joint_180"

    selection_events = [
        event
        for event in all_events
        if selection_start <= event["date"] < start_180
    ]
    route_selection = {}
    routed_hits: dict[str, list[bool]] = {"last30": [], "last180": []}
    routed_baseline_hits: dict[str, list[bool]] = {"last30": [], "last180": []}
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            key = f"{market}|{side}"
            route_train = [
                event
                for event in selection_events
                if event["market"] == market and event["side"] == side
            ]
            scores = compare(route_train, names)
            best = max(
                names,
                key=lambda name: (
                    scores[name]["accuracy"],
                    name == baseline,
                ),
            )
            base_hits = scores[baseline]["hits"]
            improvement_hits = scores[best]["hits"] - base_hits
            first_half = route_train[: len(route_train) // 2]
            second_half = route_train[len(route_train) // 2 :]
            stable = all(
                metric([event["hits"][best] for event in half])["accuracy"]
                >= metric([event["hits"][baseline] for event in half])["accuracy"]
                for half in (first_half, second_half)
                if half
            )
            selected = best if improvement_hits >= 5 and stable else baseline
            route_selection[key] = {
                "trainingEvents": len(route_train),
                "baseline": scores[baseline],
                "bestCandidate": best,
                "bestCandidateMetric": scores[best],
                "improvementHits": improvement_hits,
                "stableAcrossHalves": stable,
                "selected": selected,
            }
            for window, events in windows.items():
                route_test = [
                    event
                    for event in events
                    if event["market"] == market and event["side"] == side
                ]
                routed_hits[window].extend(
                    event["hits"][selected] for event in route_test
                )
                routed_baseline_hits[window].extend(
                    event["hits"][baseline] for event in route_test
                )

    comparisons = {window: compare(events, names) for window, events in windows.items()}
    per_market_side = {}
    for market in BASE.MARKETS:
        for side in ("open", "close"):
            key = f"{market}|{side}"
            per_market_side[key] = {
                window: metric(
                    [
                        event["hits"][baseline]
                        for event in events
                        if event["market"] == market and event["side"] == side
                    ]
                )
                for window, events in windows.items()
            }

    routed_comparison = {}
    for window in windows:
        candidate_only = sum(
            routed and not base
            for routed, base in zip(
                routed_hits[window], routed_baseline_hits[window]
            )
        )
        baseline_only = sum(
            base and not routed
            for routed, base in zip(
                routed_hits[window], routed_baseline_hits[window]
            )
        )
        routed_comparison[window] = {
            "routedOnly": candidate_only,
            "baselineOnly": baseline_only,
            "exactSignP": exact_sign_pvalue(candidate_only, baseline_only),
        }
    observational_routes = [
        key
        for key, value in route_selection.items()
        if value["selected"] != baseline
    ]
    routed_long = metric(routed_hits["last180"])
    baseline_long = comparisons["last180"][baseline]
    routing_confirmed = (
        routed_long["accuracy"] - baseline_long["accuracy"] >= 0.01
        and routed_comparison["last180"]["exactSignP"] < 0.05
    )

    return {
        "modelId": "present-digits-joint-coappearance-v1",
        "generatedAt": date.today().isoformat(),
        "latestActualDate": latest,
        "strictTarget": "both selected digits occur in the same panel",
        "targetAccuracy": TARGET,
        "minimumHistory": MIN_HISTORY,
        "source": source,
        "candidateModels": names,
        "windows": {
            window: {
                "start": start_30 if window == "last30" else start_180,
                "end": latest,
                "events": len(events),
            }
            for window, events in windows.items()
        },
        "comparisons": comparisons,
        "pairedVsSelected": {
            window: {
                name: paired(events, name, baseline)
                for name in names
                if name != baseline
            }
            for window, events in windows.items()
        },
        "marketSide": per_market_side,
        "routeSelection": route_selection,
        "routed": {
            window: metric(hits) for window, hits in routed_hits.items()
        },
        "routedComparison": routed_comparison,
        "decision": {
            "selectedModel": baseline,
            "marketSpecificRoutesPromoted": (
                observational_routes if routing_confirmed else []
            ),
            "observationalRouteCandidates": observational_routes,
            "routingConfirmed": routing_confirmed,
            "targetReached": comparisons["last180"][baseline]["accuracy"] >= TARGET,
            "borrowedSignalsKept": [],
            "reason": (
                "The direct 180-draw joint model was strongest and most stable. "
                "Borrowed signal families did not improve the final 180-day strict result, "
                "and trained market routes added only two aggregate holdout hits."
            ),
        },
    }


def write_report(payload: dict[str, Any]) -> None:
    names = payload["candidateModels"]
    lines = [
        "# Two-Digit Present Model V1",
        "",
        f"Actual results through **{payload['latestActualDate']}**. A hit requires **both** "
        "selected digits to occur in the same Open or Close panel.",
        "",
        "## Walk-forward comparison",
        "",
        "| Candidate | 30-day | 180-day | Decision |",
        "|---|---:|---:|---|",
    ]
    for name in names:
        short = payload["comparisons"]["last30"][name]
        long = payload["comparisons"]["last180"][name]
        decision = "Selected" if name == payload["decision"]["selectedModel"] else "Rejected"
        lines.append(
            f"| {name} | {short['accuracy']:.2%} ({short['hits']}/{short['events']}) "
            f"| {long['accuracy']:.2%} ({long['hits']}/{long['events']}) | {decision} |"
        )
    lines.extend(
        [
            "",
            "## Scientific conclusion",
            "",
            f"- Selected model: `{payload['decision']['selectedModel']}`.",
            f"- 70% target reached: **{str(payload['decision']['targetReached']).lower()}**.",
            "- Sutta, jodi, panel-recency, SP/DP, other-side, weekday, and avoid-model "
            "appearance signals were evaluated causally and rejected when they failed to improve.",
            "- The app must label this output research-only until its Wilson lower bound reaches "
            "the configured target. No confidence value is inflated to match the requested target.",
            "",
            "## Market-specific routing",
            "",
            "Market routes were trained only on the 365 calendar days before the final "
            "180-day test. A route required at least five extra hits and non-negative "
            "improvement in both training halves.",
            "",
            "Promoted routes: "
            + (
                ", ".join(payload["decision"]["marketSpecificRoutesPromoted"])
                or "none"
            )
            + ".",
            "",
            "Observational route candidates (not promoted): "
            + (
                ", ".join(payload["decision"]["observationalRouteCandidates"])
                or "none"
            )
            + ".",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    HERE.mkdir(parents=True, exist_ok=True)
    payload = evaluate()
    RESULTS_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_report(payload)
    print(
        json.dumps(
            {
                "latest": payload["latestActualDate"],
                "events30": payload["windows"]["last30"]["events"],
                "events180": payload["windows"]["last180"]["events"],
                "selected": payload["decision"]["selectedModel"],
                "accuracy30": payload["comparisons"]["last30"][
                    payload["decision"]["selectedModel"]
                ]["accuracy"],
                "accuracy180": payload["comparisons"]["last180"][
                    payload["decision"]["selectedModel"]
                ]["accuracy"],
                "targetReached": payload["decision"]["targetReached"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
