from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from run_research import (
    HERE,
    PAIRS,
    exact_sign_pvalue,
    load_rows,
    mask_for,
    pair_hit,
    run_series,
    wilson,
)


ROOT = HERE.parents[1]
LEDGER = ROOT / "research" / "panel_top30_v2" / "holdout_ledger.csv"
OUTPUT_JSON = HERE / "panel_residual_results.json"
OUTPUT_REPORT = HERE / "PANEL_RESIDUAL_REPORT.md"
WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
DIGITS = list(range(10))


def panel_exposure(top30: list[str]) -> list[float]:
    exposure = [0.0] * 10
    for rank, panel in enumerate(top30):
        weight = 1 / math.log2(rank + 2)
        for digit in {int(value) for value in panel}:
            exposure[digit] += weight
    maximum = max(exposure) or 1.0
    return [1 - value / maximum for value in exposure]


def normalize(values: list[float]) -> list[float]:
    minimum = min(values)
    maximum = max(values)
    if maximum <= minimum:
        return [0.5] * len(values)
    return [(value - minimum) / (maximum - minimum) for value in values]


def choose_pair(scores: list[float]) -> tuple[int, int]:
    ranked = sorted(DIGITS, key=lambda digit: (-scores[digit], digit))
    return tuple(sorted(ranked[:2]))  # type: ignore[return-value]


def pair_index(pair: tuple[int, int]) -> int:
    return PAIRS.index(pair)


def absent_count(pair: tuple[int, int], mask: int) -> int:
    return sum(not (mask & (1 << digit)) for digit in pair)


def load_ledger() -> list[dict[str, Any]]:
    rows = []
    with LEDGER.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["task"] not in {"open", "close_preopen"}:
                continue
            rows.append(
                {
                    "market": row["market"],
                    "side": "open" if row["task"] == "open" else "close",
                    "split": row["split"],
                    "date": row["date"],
                    "actual": row["actual"],
                    "top30": row["top30"].split(),
                }
            )
    return rows


def evaluate(rows: list[dict[str, Any]], weight: float) -> dict[str, Any]:
    hits = [bool(row["hits"][str(weight)]) for row in rows]
    market_side: dict[str, list[bool]] = defaultdict(list)
    for row, hit in zip(rows, hits):
        market_side[f"{row['market']}|{row['side']}"].append(hit)
    rates = {
        name: sum(values) / len(values)
        for name, values in market_side.items()
    }
    return {
        "rows": len(rows),
        "hits": sum(hits),
        "accuracy": sum(hits) / len(hits) if hits else 0.0,
        "avgAbsentDigits": (
            sum(row["absentDigits"][str(weight)] for row in rows) / len(rows)
            if rows
            else 0.0
        ),
        "macroAccuracy": sum(rates.values()) / len(rates) if rates else 0.0,
        "worstMarketSide": min(rates.values()) if rates else 0.0,
    }


def paired(
    rows: list[dict[str, Any]], selected: float, comparator: float
) -> dict[str, Any]:
    selected_only = 0
    comparator_only = 0
    for row in rows:
        selected_hit = bool(row["hits"][str(selected)])
        comparator_hit = bool(row["hits"][str(comparator)])
        selected_only += int(selected_hit and not comparator_hit)
        comparator_only += int(comparator_hit and not selected_hit)
    return {
        "selectedOnly": selected_only,
        "comparatorOnly": comparator_only,
        "exactSignP": exact_sign_pvalue(selected_only, comparator_only),
    }


def consensus(rows: list[dict[str, Any]]) -> dict[str, Any]:
    agreed = [row for row in rows if row["enginePair"] == row["panelPair"]]
    hits = [bool(row["engineHit"]) for row in agreed]
    lower, upper = wilson(sum(hits), len(hits))
    return {
        "calls": len(agreed),
        "coverage": len(agreed) / len(rows) if rows else 0.0,
        "hits": sum(hits),
        "accuracy": sum(hits) / len(hits) if hits else 0.0,
        "wilson95": [lower, upper],
    }


def pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def main() -> None:
    rows_by_market, source_meta = load_rows()
    prediction_lookup: dict[str, dict[str, Any]] = {}
    for market, market_rows in rows_by_market.items():
        for side in ("open", "close"):
            for prediction in run_series(market, side, market_rows):
                prediction_lookup[
                    f"{market}|{side}|{prediction['date']}"
                ] = prediction

    aligned = []
    for ledger_row in load_ledger():
        key = (
            f"{ledger_row['market']}|{ledger_row['side']}|"
            f"{ledger_row['date']}"
        )
        prediction = prediction_lookup.get(key)
        if prediction is None:
            continue
        actual_mask = mask_for(ledger_row["actual"])
        if actual_mask != prediction["mask"]:
            raise ValueError(f"Actual-panel mismatch for {key}")
        engine_risk = normalize(
            [1 - value for value in prediction["digitProbability"]]
        )
        panel_risk = panel_exposure(ledger_row["top30"])
        engine_pair_index = prediction["blendPairs"]["0.75"]
        engine_pair = PAIRS[engine_pair_index]
        panel_pair = choose_pair(panel_risk)
        hits = {}
        absent_digits = {}
        pairs = {}
        for weight in WEIGHTS:
            scores = [
                weight * engine_risk[digit]
                + (1 - weight) * panel_risk[digit]
                for digit in DIGITS
            ]
            pair = choose_pair(scores)
            pairs[str(weight)] = "".join(map(str, pair))
            hits[str(weight)] = pair_hit(pair_index(pair), actual_mask)
            absent_digits[str(weight)] = absent_count(pair, actual_mask)
        aligned.append(
            {
                **ledger_row,
                "enginePair": "".join(map(str, engine_pair)),
                "panelPair": "".join(map(str, panel_pair)),
                "engineHit": pair_hit(engine_pair_index, actual_mask),
                "panelHit": pair_hit(pair_index(panel_pair), actual_mask),
                "hits": hits,
                "absentDigits": absent_digits,
                "pairs": pairs,
            }
        )

    terminal = [row for row in aligned if row["split"] == "terminal_holdout"]
    unique_dates = sorted({row["date"] for row in terminal})
    cutoff = unique_dates[len(unique_dates) // 2]
    selection = [row for row in terminal if row["date"] < cutoff]
    confirmation = [row for row in terminal if row["date"] >= cutoff]
    forward = [row for row in aligned if row["split"] == "prospective_forward"]

    grid = {str(weight): evaluate(selection, weight) for weight in WEIGHTS}
    selected = max(
        WEIGHTS,
        key=lambda weight: (
            grid[str(weight)]["accuracy"],
            grid[str(weight)]["avgAbsentDigits"],
            -abs(weight - 0.5),
        ),
    )
    blocks = {
        "selection": evaluate(selection, selected),
        "confirmation": evaluate(confirmation, selected),
        "prospective_forward": evaluate(forward, selected),
    }
    comparisons = {
        block: {
            "panelOnly": paired(values, selected, 0.0),
            "digitEngineOnly": paired(values, selected, 1.0),
        }
        for block, values in {
            "selection": selection,
            "confirmation": confirmation,
            "prospective_forward": forward,
        }.items()
    }
    consensus_results = {
        block: consensus(values)
        for block, values in {
            "selection": selection,
            "confirmation": confirmation,
            "prospective_forward": forward,
        }.items()
    }
    confirmation_panel = evaluate(confirmation, 0.0)
    confirmation_engine = evaluate(confirmation, 1.0)
    forward_panel = evaluate(forward, 0.0)
    forward_engine = evaluate(forward, 1.0)
    promoted = (
        blocks["confirmation"]["accuracy"]
        > max(confirmation_panel["accuracy"], confirmation_engine["accuracy"])
        and blocks["prospective_forward"]["accuracy"]
        > max(forward_panel["accuracy"], forward_engine["accuracy"])
        and comparisons["confirmation"]["panelOnly"]["exactSignP"] < 0.05
        and comparisons["prospective_forward"]["panelOnly"]["exactSignP"] < 0.05
        and blocks["prospective_forward"]["worstMarketSide"] >= 0.30
    )
    output = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": (
            "Test whether the exact-panel Top-30 ranker adds residual signal "
            "to the complementary digit-level engine."
        ),
        "sourceMeta": source_meta,
        "alignedRows": len(aligned),
        "selectionCutoff": cutoff,
        "selectedDigitEngineWeight": selected,
        "selectionGrid": grid,
        "blocks": blocks,
        "pairedComparisons": comparisons,
        "exactPairConsensus": consensus_results,
        "promoted": promoted,
    }
    OUTPUT_JSON.write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8"
    )

    lines = [
        "# Exact-Panel Residual Signal Audit",
        "",
        f"Generated: {output['generatedAt']}",
        "",
        "## Decision",
        "",
        f"**{'Promoted' if promoted else 'Rejected'}.** The earlier terminal "
        f"half selected digit-engine weight "
        f"`{selected:.2f}` and panel-ranker weight `{1-selected:.2f}`. "
        "Promotion requires a persistent confirmation and forward advantage "
        "over both single-family controls.",
        "",
        "## Results",
        "",
        "| Block | N | Selected | Panel only | Digit engine only | Avg absent | Macro | Worst market-side |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    block_rows = {
        "selection": selection,
        "confirmation": confirmation,
        "prospective_forward": forward,
    }
    for block, values in block_rows.items():
        result = blocks[block]
        panel_only = evaluate(values, 0.0)
        engine_only = evaluate(values, 1.0)
        lines.append(
            f"| {block.replace('_', ' ').title()} | {result['rows']} | "
            f"{pct(result['accuracy'])} ({result['hits']}/{result['rows']}) | "
            f"{pct(panel_only['accuracy'])} | "
            f"{pct(engine_only['accuracy'])} | "
            f"{result['avgAbsentDigits']:.3f}/2 | "
            f"{pct(result['macroAccuracy'])} | "
            f"{pct(result['worstMarketSide'])} |"
        )
    lines.extend(
        [
            "",
            "## Paired comparisons",
            "",
            "| Block | Comparator | Selected-only | Comparator-only | Exact sign p |",
            "| --- | --- | ---: | ---: | ---: |",
        ]
    )
    for block in block_rows:
        for label, comparator in (
            ("Panel only", "panelOnly"),
            ("Digit engine only", "digitEngineOnly"),
        ):
            item = comparisons[block][comparator]
            lines.append(
                f"| {block.replace('_', ' ').title()} | {label} | "
                f"{item['selectedOnly']} | {item['comparatorOnly']} | "
                f"{item['exactSignP']:.4f} |"
            )
    lines.extend(
        [
            "",
            "## Exact-pair consensus",
            "",
            "| Block | Coverage | Hits | Strict accuracy | 95% lower |",
            "| --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for block, item in consensus_results.items():
        lines.append(
            f"| {block.replace('_', ' ').title()} | "
            f"{pct(item['coverage'])} | {item['hits']}/{item['calls']} | "
            f"{pct(item['accuracy'])} | {pct(item['wilson95'][0])} |"
        )
    lines.extend(
        [
            "",
            "The panel model and digit engine share historical outcomes, so "
            "agreement is a selective diagnostic rather than independent "
            "confirmation.",
            "",
            "The selected blend failed the prospective ledger and is not "
            "eligible for the runtime engine. The five-call consensus pocket "
            "is descriptive only; its Wilson lower bound is far below 80%.",
        ]
    )
    OUTPUT_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
