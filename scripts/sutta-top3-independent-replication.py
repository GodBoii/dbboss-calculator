"""Replay preregistered Top-3 formulas on an independently parsed history."""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
INDEPENDENT = ROOT / "scratch" / "sutta-independent-source-records.json"
ORIGINAL = ROOT / "scratch" / "sutta-research-records.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-independent-replication-output.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-independent-replication.md"
MIN_PRIOR = 90
NOMINAL = {"open": 0.30, "close": 0.30, "adjustedClose": 0.30, "exactJodi": 0.03, "jodiGrid": 0.09}


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_independent_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()


def to_row(raw: dict[str, Any]):
    iso = raw["isoDate"]
    return F.Row(
        iso=iso,
        day=raw["day"],
        day_of_month=date.fromisoformat(iso).day,
        open=int(raw["openSutta"]),
        close=int(raw["closeSutta"]),
        jodi=str(raw["jodi"]),
    )


def rank100(scores: list[float]) -> list[int]:
    return sorted(range(100), key=lambda value: (-scores[value], value))


def binomial_tail(hits: int, n: int, probability: float) -> float:
    logs = [
        math.lgamma(n + 1)
        - math.lgamma(value + 1)
        - math.lgamma(n - value + 1)
        + value * math.log(probability)
        + (n - value) * math.log1p(-probability)
        for value in range(hits, n + 1)
    ]
    maximum = max(logs)
    return min(1.0, math.exp(maximum) * sum(math.exp(value - maximum) for value in logs))


def wilson(hits: int, n: int, z: float = 1.959963984540054) -> list[float]:
    if not n:
        return [0.0, 0.0]
    p = hits / n
    denominator = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    margin = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator
    return [round(100 * max(0.0, center - margin), 3), round(100 * min(1.0, center + margin), 3)]


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    result = {}
    for target, nominal in NOMINAL.items():
        n = len(rows)
        hits = sum(int(row["hits"][target]) for row in rows)
        accuracy = 100 * hits / n if n else 0.0
        result[target] = {
            "n": n,
            "hits": hits,
            "accuracy": round(accuracy, 3),
            "nominalAccuracy": 100 * nominal,
            "deltaVsNominalPoints": round(accuracy - 100 * nominal, 3),
            "wilson95": wilson(hits, n),
            "oneSidedBinomialP": binomial_tail(hits, n, nominal) if n else 1.0,
            "meets90PercentGate": accuracy >= 90.0,
        }
    return result


def source_consistency(independent: dict[str, Any]) -> dict[str, Any]:
    original = json.loads(ORIGINAL.read_text(encoding="utf-8"))
    totals = defaultdict(int)
    examples = []
    for market, independent_rows in independent["markets"].items():
        original_map = {F.iso_date(row): row for row in original[market]}
        for row in independent_rows:
            prior = original_map.get(row["isoDate"])
            if prior is None:
                totals["independentOnly"] += 1
                continue
            totals["overlap"] += 1
            jodi_match = str(prior["jodi"]).zfill(2) == row["jodi"]
            panel_match = (
                str(prior.get("openPanel")) == row["openPanel"]
                and str(prior.get("closePanel")) == row["closePanel"]
            )
            totals["jodiMatch"] += int(jodi_match)
            totals["panelMatch"] += int(panel_match)
            totals["exactMatch"] += int(jodi_match and panel_match)
            if not (jodi_match and panel_match) and len(examples) < 20:
                examples.append(
                    {
                        "market": market,
                        "isoDate": row["isoDate"],
                        "original": {
                            "openPanel": prior.get("openPanel"),
                            "jodi": prior.get("jodi"),
                            "closePanel": prior.get("closePanel"),
                        },
                        "independent": {
                            "openPanel": row["openPanel"],
                            "jodi": row["jodi"],
                            "closePanel": row["closePanel"],
                        },
                    }
                )
    overlap = totals["overlap"]
    return {
        **dict(totals),
        "jodiAgreementPercent": round(100 * totals["jodiMatch"] / overlap, 3) if overlap else None,
        "panelAgreementPercent": round(100 * totals["panelMatch"] / overlap, 3) if overlap else None,
        "exactAgreementPercent": round(100 * totals["exactMatch"] / overlap, 3) if overlap else None,
        "conflictExamples": examples,
    }


def main() -> None:
    independent = json.loads(INDEPENDENT.read_text(encoding="utf-8"))
    replay = []
    by_market: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for market, raw_rows in independent["markets"].items():
        rows = [to_row(raw) for raw in raw_rows]
        for index in range(MIN_PRIOR, len(rows)):
            target = rows[index]
            prior = rows[:index]
            open_scores = F.feature_scores(prior, "open", target)
            close_scores = F.feature_scores(prior, "close", target)
            exact_scores = F.jodi_feature_scores(prior, target)
            open_picks = F.rank(open_scores["recent7_hot"])[:3]
            close_picks = F.rank(close_scores["lag7_opposite"])[:3]
            adjusted_picks = F.rank(close_scores["known_open"])[:3]
            exact_picks = [f"{value:02d}" for value in rank100(exact_scores["direct_jodi:calendar_cold_pair"])[:3]]
            grid_open = F.rank(open_scores["delta"])[:3]
            grid_close = F.rank(close_scores["calendar_date"])[:3]
            grid_picks = [f"{open_digit}{close_digit}" for open_digit in grid_open for close_digit in grid_close]
            result = {
                "market": market,
                "isoDate": target.iso,
                "actual": {"open": target.open, "close": target.close, "jodi": target.jodi},
                "hits": {
                    "open": target.open in open_picks,
                    "close": target.close in close_picks,
                    "adjustedClose": target.close in adjusted_picks,
                    "exactJodi": target.jodi in exact_picks,
                    "jodiGrid": target.jodi in grid_picks,
                },
            }
            replay.append(result)
            by_market[market].append(result)

    latest_date = max(date.fromisoformat(row["isoDate"]) for row in replay)
    recent_cutoff = latest_date - timedelta(days=89)
    recent = [row for row in replay if date.fromisoformat(row["isoDate"]) >= recent_cutoff]
    chronological_holdout = []
    for market_rows in by_market.values():
        start = int(len(market_rows) * 0.8)
        chronological_holdout.extend(market_rows[start:])

    payload = {
        "schemaVersion": 1,
        "researchOnly": True,
        "selection": "none; formulas fixed before independent-source replay",
        "minimumPriorRows": MIN_PRIOR,
        "latestDate": latest_date.isoformat(),
        "sourceConsistency": source_consistency(independent),
        "metrics": {
            "all": summarize(replay),
            "last90CalendarDays": summarize(recent),
            "perMarketLast20Percent": summarize(chronological_holdout),
        },
        "marketMetrics": {market: summarize(rows) for market, rows in by_market.items()},
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Top-3 Independent-Source Replication",
        "",
        "The formulas were fixed before this replay. No independent-source row selects a formula or threshold.",
        "",
        "## Source consistency",
        "",
        f'Overlapping rows: {payload["sourceConsistency"].get("overlap", 0)}. '
        f'Jodi agreement: {payload["sourceConsistency"]["jodiAgreementPercent"]:.1f}%. '
        f'Full-panel agreement: {payload["sourceConsistency"]["panelAgreementPercent"]:.1f}%.' ,
        "",
        "## Fixed-formula replay",
        "",
        "| Block | Target | Hits | N | Accuracy | Nominal | 95% Wilson interval | p (one-sided vs nominal) | 90% gate |",
        "| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |",
    ]
    for block, metrics in payload["metrics"].items():
        for target, value in metrics.items():
            lines.append(
                f'| {block} | {target} | {value["hits"]} | {value["n"]} | '
                f'{value["accuracy"]:.1f}% | {value["nominalAccuracy"]:.1f}% | '
                f'{value["wilson95"][0]:.1f}%–{value["wilson95"][1]:.1f}% | '
                f'{value["oneSidedBinomialP"]:.3g} | '
                f'{"pass" if value["meets90PercentGate"] else "fail"} |'
            )
    lines.extend(
        [
            "",
            "Exact Jodi means exactly three pairs. The grid is separately reported as nine pairs.",
            "",
        ]
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"sourceConsistency": payload["sourceConsistency"], "metrics": payload["metrics"]}, indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
