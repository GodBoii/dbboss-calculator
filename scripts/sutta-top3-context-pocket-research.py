"""Research-only audit of apparently high-accuracy context pockets.

Contexts are mined on development only. The exact context family and accepted
keys are frozen before validation, holdout, and forward scoring. This exposes
small-sample 90% rules that disappear when carried into unseen periods.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SELECTIVE_PATH = ROOT / "scripts" / "sutta-top3-selective-research.py"
OUTPUT = ROOT / "scratch" / "sutta-top3-context-pocket-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-context-pocket-research.md"
SUPPORT_LEVELS = (3, 5, 10, 20)
TARGET_ACCURACY = 0.90
MIN_TEST_CALLS = {"validation": 30, "holdout": 30, "forward": 10}


def load_selective():
    spec = importlib.util.spec_from_file_location("sutta_context_selective", SELECTIVE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {SELECTIVE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


S = load_selective()
F = S.F


def build_contexts(rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    cache = F.load_rows()
    positions = {market: {row.iso: index for index, row in enumerate(market_rows)} for market, market_rows in cache.items()}
    contexts = defaultdict(list)
    for ledger in rows:
        market = ledger["market"]
        index = positions[market][ledger["isoDate"]]
        target = cache[market][index]
        previous = cache[market][index - 1]
        lag7 = cache[market][index - 7]
        dom_bucket = (target.day_of_month - 1) // 10
        values = {
            "market_weekday": (market, target.day),
            "market_dom_bucket": (market, dom_bucket),
            "market_prev_open": (market, previous.open),
            "market_prev_close": (market, previous.close),
            "market_prev_jodi": (market, previous.jodi),
            "market_lag7_open": (market, lag7.open),
            "market_lag7_close": (market, lag7.close),
            "weekday_prev_open": (target.day, previous.open),
            "weekday_prev_close": (target.day, previous.close),
            "market_current_open": (market, target.open),
            "current_open_prev_close": (target.open, previous.close),
            "market_current_open_weekday": (market, target.open, target.day),
        }
        for name, value in values.items():
            contexts[name].append("|".join(str(part) for part in value))
    return dict(contexts)


def performance(hits: list[bool], keys: list[str], selected: set[str], indices: list[int]) -> dict[str, Any]:
    called = [index for index in indices if keys[index] in selected]
    correct = sum(hits[index] for index in called)
    low, high = S.wilson(correct, len(called))
    return {
        "rows": len(indices),
        "calls": len(called),
        "hits": correct,
        "coverage": round(100 * len(called) / len(indices), 3) if indices else 0.0,
        "accuracy": round(100 * correct / len(called), 3) if called else 0.0,
        "ci95": [round(100 * low, 3), round(100 * high, 3)],
    }


def mine_policy(
    target: str,
    hits: list[bool],
    contexts: dict[str, list[str]],
    splits: dict[str, list[int]],
) -> dict[str, Any]:
    development = splits["development"]
    allowed_families = list(contexts)
    if target in ("open", "close", "exactJodi", "jodiGrid"):
        allowed_families = [name for name in allowed_families if "current_open" not in name]
    candidates = []
    for family in allowed_families:
        keys = contexts[family]
        grouped = defaultdict(lambda: [0, 0])
        for index in development:
            grouped[keys[index]][0] += 1
            grouped[keys[index]][1] += int(hits[index])
        for support in SUPPORT_LEVELS:
            selected = {
                key for key, (n, correct) in grouped.items()
                if n >= support and correct / n >= TARGET_ACCURACY
            }
            metrics = {
                block: performance(hits, keys, selected, indices)
                for block, indices in splits.items()
            }
            candidates.append({
                "family": family,
                "minimumPocketSupport": support,
                "selectedPocketCount": len(selected),
                "selectedKeys": sorted(selected),
                "metrics": metrics,
            })
    selected = max(
        candidates,
        key=lambda row: (
            row["metrics"]["development"]["calls"],
            row["minimumPocketSupport"],
            row["family"],
        ),
    )
    selected["passes90Gate"] = all(
        selected["metrics"][block]["calls"] >= MIN_TEST_CALLS[block]
        and selected["metrics"][block]["accuracy"] >= TARGET_ACCURACY * 100
        for block in ("validation", "holdout", "forward")
    )
    summary = []
    for support in SUPPORT_LEVELS:
        eligible = [row for row in candidates if row["minimumPocketSupport"] == support]
        best = max(eligible, key=lambda row: row["metrics"]["development"]["calls"])
        summary.append({
            "minimumPocketSupport": support,
            "bestFamily": best["family"],
            "selectedPocketCount": best["selectedPocketCount"],
            "metrics": best["metrics"],
        })
    return {
        "target": target,
        "candidatePolicies": len(candidates),
        "selectedOnDevelopment": selected,
        "supportAudit": summary,
    }


def format_metric(value: dict[str, Any]) -> str:
    return f'{value["hits"]}/{value["calls"]} ({value["accuracy"]:.1f}%), coverage {value["coverage"]:.1f}%'


def write_report(payload: dict[str, Any]) -> None:
    labels = {
        "open": "Open digit",
        "close": "Close digit",
        "adjustedClose": "Adjusted Close digit",
        "exactJodi": "Exact Jodi (3 pairs)",
        "jodiGrid": "Jodi grid (9 pairs)",
    }
    lines = [
        "# Top-3 Context-Pocket False-Discovery Audit",
        "",
        "A context key is accepted only when its development accuracy is at least 90%. The context family and exact accepted keys are then frozen. Tiny pockets are shown to quantify false discoveries; the final gate still requires at least 30 validation calls, 30 holdout calls, and 10 forward calls at 90% accuracy.",
        "",
        "| Target | Development-selected pocket policy | Development | Validation | Holdout | Frozen forward | Gate |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for target, result in payload["results"].items():
        selected = result["selectedOnDevelopment"]
        metrics = selected["metrics"]
        lines.append(
            f'| {labels[target]} | `{selected["family"]}`, support {selected["minimumPocketSupport"]}, '
            f'{selected["selectedPocketCount"]} pockets | {format_metric(metrics["development"])} | '
            f'{format_metric(metrics["validation"])} | {format_metric(metrics["holdout"])} | '
            f'{format_metric(metrics["forward"])} | {"pass" if selected["passes90Gate"] else "reject"} |'
        )
    lines.extend([
        "",
        "## Support sensitivity",
        "",
        "| Target | Minimum support | Best development family | Pockets | Development | Validation | Holdout | Forward |",
        "| --- | ---: | --- | ---: | --- | --- | --- | --- |",
    ])
    for target, result in payload["results"].items():
        for row in result["supportAudit"]:
            metrics = row["metrics"]
            lines.append(
                f'| {labels[target]} | {row["minimumPocketSupport"]} | `{row["bestFamily"]}` | '
                f'{row["selectedPocketCount"]} | {format_metric(metrics["development"])} | '
                f'{format_metric(metrics["validation"])} | {format_metric(metrics["holdout"])} | '
                f'{format_metric(metrics["forward"])} |'
            )
    lines.extend([
        "",
        "## Decision",
        "",
        "No context-pocket policy is accepted unless it survives all later blocks with the stated minimum calls. Apparent 90%-100% development pockets with small support are treated as multiple-testing artifacts when their later accuracy collapses.",
        "",
    ])
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    rows = S.read_rows(S.HISTORICAL, False) + S.read_rows(S.FORWARD, True)
    rows.sort(key=lambda row: (row["isoDate"], F.MARKETS.index(row["market"])))
    splits = S.build_splits(rows)
    predictions = S.build_predictions(rows)
    contexts = build_contexts(rows)
    results = {
        target: mine_policy(target, prediction["hit"], contexts, splits)
        for target, prediction in predictions.items()
    }
    payload = {
        "schemaVersion": 1,
        "targetAccuracy": TARGET_ACCURACY * 100,
        "supportLevels": SUPPORT_LEVELS,
        "minimumTestCalls": MIN_TEST_CALLS,
        "rows": len(rows),
        "results": results,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_report(payload)
    for target, result in results.items():
        selected = result["selectedOnDevelopment"]
        print(target, selected["family"], selected["minimumPocketSupport"], selected["selectedPocketCount"], "pass" if selected["passes90Gate"] else "reject")
        for block, value in selected["metrics"].items():
            print(" ", block, format_metric(value))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
