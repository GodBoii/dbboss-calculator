"""Chronological challenger study for the strict two-present-digit prediction.

Run from the repository root: python research/present_digits_v2/run_study.py
Only the 2021-2023 development period selects the challenger. Later periods
are descriptive confirmation checks on previously researched public charts.
"""

from __future__ import annotations

import calendar
import csv
import hashlib
import json
import math
from bisect import bisect_left
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SOURCES = (
    "research/panel_top10_v1/chart_rows.csv",
    "research/combined_prediction_v2/october_rows.csv",
    "research/combined_prediction_v3/fresh_rows.csv",
)
PAIRS = [(a, b) for a in range(10) for b in range(a + 1, 10)]
BASELINE = "joint_180"
CANDIDATES = (
    BASELINE, "joint_30", "joint_90", "joint_365", "joint_730",
    "blend_30", "blend_90", "blend_365", "blend_730",
    "marginal_25", "marginal_50", "marginal_75",
    "weekday_25", "weekday_50", "transition_25", "transition_50",
)


def load_rows() -> tuple[dict[str, list[dict[str, str]]], list[dict]]:
    """Validate frozen sources; reject duplicate identities with conflicting panels."""
    markets: dict[str, dict[str, dict[str, str]]] = defaultdict(dict)
    manifest = []
    for relative in SOURCES:
        path = ROOT / relative
        count = 0
        with path.open(encoding="utf-8", newline="") as handle:
            for row in csv.DictReader(handle):
                iso = row["date"]
                if date.fromisoformat(iso).isoformat() != iso or not row["market"]:
                    raise ValueError(f"Invalid identity in {relative}: {row}")
                if any(len(row[side]) != 3 or any(c not in "0123456789" for c in row[side])
                       for side in ("open", "close")):
                    raise ValueError(f"Invalid panel in {relative}: {row}")
                previous = markets[row["market"]].get(iso)
                if previous is not None and previous != row:
                    raise ValueError(f"Conflicting market/date in {relative}: {row}")
                markets[row["market"]][iso] = row
                count += 1
        manifest.append({"path": relative, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                         "rows": count})
    return {market: [rows[key] for key in sorted(rows)]
            for market, rows in sorted(markets.items())}, manifest


def cutoff(iso: str) -> str:
    value = date.fromisoformat(iso)
    year, month = divmod(value.year * 12 + value.month - 1 - 28, 12)
    month += 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1])).isoformat()


def predict_series(rows: list[dict[str, str]], side: str) -> dict[str, np.ndarray]:
    """Choose before each outcome, with the app's 28-calendar-month history cap."""
    dates = [row["date"] for row in rows]
    digits = np.array([[int(str(d) in row[side]) for d in range(10)] for row in rows])
    pairs = np.column_stack([digits[:, a] * digits[:, b] for a, b in PAIRS])
    prefix = np.vstack([np.zeros((1, 45)), pairs.cumsum(axis=0)])
    digit_prefix = np.vstack([np.zeros((1, 10)), digits.cumsum(axis=0)])
    weekdays = np.array([date.fromisoformat(iso).weekday() for iso in dates])
    masks = digits @ (1 << np.arange(10))
    predictions = {name: np.full(len(rows), -1, dtype=np.int16) for name in CANDIDATES}
    for index, iso in enumerate(dates):
        start = bisect_left(dates, cutoff(iso))
        if index - start < 180:
            continue
        rates = {}
        for window in (30, 90, 180, 365, 730):
            left = max(start, index - window)
            rates[window] = (prefix[index] - prefix[left]) / (index - left)
        base = rates[180]
        scores = {f"joint_{window}": vector for window, vector in rates.items()}
        for window in (30, 90, 365, 730):
            scores[f"blend_{window}"] = 0.5 * base + 0.5 * rates[window]
        left = max(start, index - 180)
        marginal = (digit_prefix[index] - digit_prefix[left] + 5.4) / (index - left + 20)
        independent = np.array([marginal[a] * marginal[b] for a, b in PAIRS])
        same_weekday = np.flatnonzero(weekdays[start:index] == weekdays[index]) + start
        weekday_rate = (pairs[same_weekday].sum(axis=0) + 50 * base) / (len(same_weekday) + 50)
        # Prior draw's digit-set state, with only already observed successor panels.
        matches = np.flatnonzero(masks[start:index - 1] == masks[index - 1]) + start + 1
        transition_rate = (pairs[matches].sum(axis=0) + 50 * base) / (len(matches) + 50)
        for weight in (25, 50, 75):
            scores[f"marginal_{weight}"] = (1 - weight / 100) * base + weight / 100 * independent
        for weight in (25, 50):
            for family, vector in (("weekday", weekday_rate), ("transition", transition_rate)):
                scores[f"{family}_{weight}"] = (1 - weight / 100) * base + weight / 100 * vector
        for name in CANDIDATES:
            predictions[name][index] = int(np.argmax(scores[name]))
    return predictions


def metric(events: list[dict], name: str) -> dict:
    hits = sum(event["hits"][name] for event in events)
    baseline_hits = sum(event["hits"][BASELINE] for event in events)
    won = sum(event["hits"][name] and not event["hits"][BASELINE] for event in events)
    lost = sum(event["hits"][BASELINE] and not event["hits"][name] for event in events)
    n = won + lost
    # Log-space binomial tail avoids overflow on long replays.
    tail = sum(math.exp(math.lgamma(n + 1) - math.lgamma(k + 1)
                        - math.lgamma(n - k + 1) - n * math.log(2))
               for k in range(min(won, lost) + 1)) if n else 0.5
    return {"events": len(events), "hits": hits, "baselineHits": baseline_hits,
            "accuracy": hits / len(events) if events else None,
            "netHits": hits - baseline_hits, "candidateOnly": won, "baselineOnly": lost,
            "pairedP": min(1.0, 2 * tail)}


def study(rows_by_market: dict[str, list[dict[str, str]]]) -> dict:
    events = []
    for market, rows in rows_by_market.items():
        for side in ("open", "close"):
            predictions = predict_series(rows, side)
            for index, row in enumerate(rows):
                if row["date"] < "2021-01-01" or predictions[BASELINE][index] < 0:
                    continue
                actual = set(row[side])
                events.append({"date": row["date"], "market": market, "side": side,
                               "hits": {name: all(str(d) in actual for d in PAIRS[values[index]])
                                        for name, values in predictions.items()},
                               "randomPairRate": math.comb(len(actual), 2) / 45})
    latest = max(event["date"] for event in events)
    periods = {"development": ("2021-01-01", "2023-12-31"),
               "validation2024": ("2024-01-01", "2024-12-31"),
               "confirmation2025": ("2025-01-01", "2025-12-31"),
               "recent2026": ("2026-01-01", latest)}
    for days in (7, 30, 90, 180):
        periods[f"last{days}"] = ((date.fromisoformat(latest) - timedelta(days=days - 1)).isoformat(), latest)
    blocks = {name: [e for e in events if start <= e["date"] <= end]
              for name, (start, end) in periods.items()}
    comparisons = {block: {name: metric(values, name) for name in CANDIDATES}
                   for block, values in blocks.items()}
    selected = max((name for name in CANDIDATES if name != BASELINE),
                   key=lambda name: comparisons["development"][name]["hits"])
    gates = {
        "developmentImproves": comparisons["development"][selected]["netHits"] > 0,
        "validationImproves": comparisons["validation2024"][selected]["netHits"] > 0,
        "confirmationImproves": comparisons["confirmation2025"][selected]["netHits"] > 0,
        "confirmationPairedP": comparisons["confirmation2025"][selected]["pairedP"] < 0.05,
        "recentNonDegrading": comparisons["recent2026"][selected]["netHits"] >= 0,
        "last90NonDegrading": comparisons["last90"][selected]["netHits"] >= 0,
        "last30NonDegrading": comparisons["last30"][selected]["netHits"] >= 0,
    }
    route_results = {f"{market}|{side}": metric([e for e in blocks["recent2026"]
                                               if e["market"] == market and e["side"] == side], selected)
                     for market in rows_by_market for side in ("open", "close")}
    return {"latestActualDate": latest, "strictTarget": "both selected digits occur in the same panel",
            "candidateModels": CANDIDATES, "selectedChallenger": selected,
            "selectionPeriod": "development only, 2021-2023; deterministic candidate-order ties",
            "comparisons": comparisons, "periods": periods, "promotionGates": gates,
            "eligibleForProspectiveTrial": all(gates.values()), "productionChanged": False,
            "recentMarketSides": route_results,
            "randomPairReference": {name: sum(e["randomPairRate"] for e in block) / len(block)
                                    if block else None for name, block in blocks.items()}}


def write_report(result: dict) -> None:
    selected = result["selectedChallenger"]
    lines = ["# Two present digits improvement study", "",
             f"Frozen local chart results through {result['latestActualDate']}. Both digits must appear in the same panel.", "",
             f"Compared {len(CANDIDATES) - 1} challengers with the live 180-result joint-frequency model. "
             f"Selected `{selected}` on 2021-2023 only. No market-specific tuning.", "",
             "| Period | Events | Current hits | Challenger hits | Net hits | Paired p |",
             "| --- | ---: | ---: | ---: | ---: | ---: |"]
    for period, values in result["comparisons"].items():
        base, candidate = values[BASELINE], values[selected]
        lines.append(f"| {period} | {base['events']} | {base['hits']} ({base['accuracy']:.2%}) | "
                     f"{candidate['hits']} ({candidate['accuracy']:.2%}) | {candidate['netHits']:+d} | {candidate['pairedP']:.4f} |")
    lines += ["", "## Decision", "",
              "Eligible for a prospective trial: " + str(result["eligibleForProspectiveTrial"]).lower() + ".",
              "Production model changed: false. Historical gains alone do not establish future accuracy.", "",
              "Failed gates: " + (", ".join(k for k, v in result["promotionGates"].items() if not v) or "none") + ".", "",
              "## Method and limits", "",
              "All inputs are tracked snapshots. Their SHA-256 hashes are in results.json. Conflicting duplicate market/date rows fail the run.", "",
              "Every prediction uses strictly earlier dates from its own market and side, capped at 28 calendar months. "
              "At least 180 prior results are required. Neither the target panel nor same-day Open is used for Close.", "",
              "Candidates include 30/90/365/730-result joint frequencies, equal blends with the baseline, "
              "25/50/75% digit-marginal blends, and 25/50% weekday and previous-digit-set transition blends. "
              "Conditional estimates shrink toward the baseline with 50 pseudo-results. Ties choose the lowest digit pair.", "",
              "Later periods never select a candidate. The recent windows overlap. These public histories were "
              "previously examined in other repository studies, so confirmation is retrospective, not an untouched holdout. "
              "Paired p-values treat panel events as independent; market and date dependence can make them optimistic.", "",
              "The random-pair reference averages C(distinct panel digits, 2)/45 per outcome. "
              "It is a coverage reference, not a profit estimate. Full candidate comparisons and recent market-side scores are in results.json.", "",
              "Reproduce with `python research/present_digits_v2/run_study.py`. "
              "Verify with `python -m unittest discover -s research/present_digits_v2 -p 'test_*.py'`."]
    (HERE / "REPORT.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows, manifest = load_rows()
    result = study(rows)
    result["sources"] = manifest
    (HERE / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    write_report(result)
    print(json.dumps({"selected": result["selectedChallenger"],
                      "eligibleForProspectiveTrial": result["eligibleForProspectiveTrial"],
                      "latest": result["latestActualDate"]}))


if __name__ == "__main__":
    main()
