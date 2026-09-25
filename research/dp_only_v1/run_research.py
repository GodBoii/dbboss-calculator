"""Audit selective DP calls against chart history with a sealed time holdout."""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin

import numpy as np
import requests
from bs4 import BeautifulSoup
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PRIMARY = {
    "Sridevi": "sridevi", "Time Bazar": "time-bazar", "Madhur Day": "madhur-day",
    "Milan Day": "milan-day", "Rajdhani Day": "rajdhani-day", "Kalyan": "kalyan",
    "Sridevi Night": "sridevi-night", "Kalyan Night": "kalyan-night",
    "Madhur Night": "madhur-night", "Milan Night": "milan-night",
    "Rajdhani Night": "rajdhani-night", "Main Bazar": "main-bazar",
}
EXTRA = {
    "Kalyan Morning": "kalyan-morning", "Milan Morning": "milan-morning",
    "Madhuri": "madhuri", "Madhuri Night": "madhuri-night",
    "Madhur Morning": "madhur-morning", "Mumbai Day": "mumbai-day",
    "Mumbai Night": "mumbai-night", "Tara Mumbai Day": "tara-mumbai-day",
    "Supreme Day": "supreme-day", "Supreme Night": "supreme-night",
}
MARKETS = PRIMARY | EXTRA
# The trusted links currently redirect to this canonical host; fetching it
# directly avoids intermittent timeouts on the redirecting hostname.
BASE = "https://dpboss.tax/panel-chart-record/"
PANEL = re.compile(r"^[0-9]{3}$")
DATE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")
TRAIN_END = "2024-12-31"
VALID_END = "2025-12-31"


def parse_panel(value: str) -> str | None:
    numbers = re.findall(r"\d+", value)
    match = next((part for part in numbers if len(part) == 3), None)
    if match is None and len([part for part in numbers if len(part) == 1]) >= 3:
        match = "".join(part for part in numbers if len(part) == 1)[:3]
    return match if match and PANEL.fullmatch(match) else None


def fetch_market(item: tuple[str, str]) -> tuple[str, list[dict], dict]:
    market, slug = item
    url = urljoin(BASE, f"{slug}.php")
    response = requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0 DP-only research"})
    response.raise_for_status()
    if not response.url.endswith(f"/{slug}.php"):
        raise ValueError(f"{market}: unexpected redirect {response.url}")
    soup = BeautifulSoup(response.text, "html.parser")
    records: dict[tuple[str, str], dict] = {}
    disputed: set[tuple[str, str]] = set()
    conflicts = 0
    malformed_dates = 0
    jodi_mismatches = 0
    for row in soup.select("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("td")]
        if len(cells) < 4:
            continue
        start = DATE.search(cells[0])
        if not start:
            continue
        try:
            day, month, year = map(int, start.groups())
            if year < 100:
                year += 2000
            first_date = date(year, month, day)
        except ValueError:
            malformed_dates += 1
            continue
        for offset in range(min(7, (len(cells) - 1) // 3)):
            draw_date = first_date + timedelta(days=offset)
            if draw_date > date.today():
                continue
            open_panel = parse_panel(cells[1 + offset * 3])
            jodi_match = re.search(r"\b\d{2}\b", cells[2 + offset * 3])
            close_panel = parse_panel(cells[3 + offset * 3])
            if not open_panel and not close_panel:
                continue
            key = (draw_date.isoformat(), market)
            if jodi_match and open_panel and close_panel:
                expected = f"{sum(map(int, open_panel)) % 10}{sum(map(int, close_panel)) % 10}"
                if jodi_match.group() != expected:
                    jodi_mismatches += 1
                    disputed.add(key)
                    records.pop(key, None)
                    continue
            if key in disputed:
                continue
            new = {"date": key[0], "market": market, "open": open_panel, "close": close_panel}
            old = records.get(key)
            if old and old != new:
                conflicts += 1
                disputed.add(key)
                records.pop(key, None)
                continue
            records[key] = new
    return market, sorted(records.values(), key=lambda row: row["date"]), {
        "url": url, "resolvedUrl": response.url, "rows": len(records),
        "conflicts": conflicts, "jodiMismatches": jodi_mismatches,
        "malformedDates": malformed_dates,
    }


def kind(panel: str | None) -> int | None:
    return int(len(set(panel)) == 2) if panel else None


def make_cases(rows: list[dict]) -> tuple[list[dict], list[str]]:
    by_market: dict[str, list[dict]] = defaultdict(list)
    by_date: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in rows:
        by_market[row["market"]].append(row)
        by_date[row["date"]][row["market"]] = row
    cases: list[dict] = []
    names = [
        "weekday", "month", "day_of_month", "market_id", "side_id", "lag_open",
        "lag_close", "lag_same", "lag2_same", "gap_same", "rate_5", "rate_10",
        "rate_20", "rate_40", "rate_80", "same_day_open", "prev_day_other_dp",
        "prev_day_other_count", "same_day_other_dp", "same_day_other_count",
        "lag_panel_sum", "lag_panel_spread", "lag_panel_entropy", "lag_sutta",
    ]
    market_ids = {name: i for i, name in enumerate(MARKETS)}
    for market, series in by_market.items():
        previous: list[dict] = []
        for row in series:
            earlier_date = (date.fromisoformat(row["date"]) - timedelta(days=1)).isoformat()
            yesterday = by_date.get(earlier_date, {})
            other_yesterday = [kind(x[side]) for other, x in yesterday.items() if other != market for side in ("open", "close")]
            other_yesterday = [value for value in other_yesterday if value is not None]
            same_day = by_date[row["date"]]
            other_today = [kind(x["open"]) for other, x in same_day.items() if other != market]
            other_today = [value for value in other_today if value is not None]
            # Same-date other markets have unknown posting order. They are intentionally
            # excluded from model features to prevent a hidden future-result leak.
            for side in ("open", "close"):
                label = kind(row[side])
                if label is None or len(previous) < 80:
                    continue
                history = [kind(p[side]) for p in previous]
                history = [x for x in history if x is not None]
                if len(history) < 60:
                    continue
                lag = previous[-1]
                last_panel = lag[side]
                gap = next((i for i, x in enumerate(reversed(history)) if x == 1), len(history))
                digits = [int(x) for x in last_panel] if last_panel else []
                counts = [digits.count(x) / 3 for x in set(digits)] if digits else []
                entropy = -sum(p * np.log2(p) for p in counts)
                values = [
                    date.fromisoformat(row["date"]).weekday(), int(row["date"][5:7]),
                    int(row["date"][8:10]), market_ids[market], int(side == "close"),
                    kind(lag["open"]), kind(lag["close"]), history[-1], history[-2],
                    gap, *[np.mean(history[-n:]) for n in (5, 10, 20, 40, 80)],
                    kind(row["open"]) if side == "close" else None,
                    np.mean(other_yesterday) if other_yesterday else None,
                    len(other_yesterday), None, None,
                    sum(digits) if digits else None,
                    max(digits) - min(digits) if digits else None,
                    entropy if digits else None,
                    sum(digits) % 10 if digits else None,
                ]
                assert len(values) == len(names)
                cases.append({"date": row["date"], "market": market, "side": side,
                              "y": label, "x": values})
            previous.append(row)
    return cases, names


def metrics(y: np.ndarray, selected: np.ndarray) -> dict:
    count = int(selected.sum())
    hits = int(y[selected].sum()) if count else 0
    return {"calls": count, "hits": hits, "falseCalls": count - hits,
            "precision": round(hits / count, 4) if count else None,
            "coverage": round(count / len(y), 5) if len(y) else 0}


def wilson_lower(hits: int, count: int, z: float = 1.645) -> float:
    if not count:
        return 0.0
    p = hits / count
    denom = 1 + z * z / count
    return (p + z * z / (2 * count) - z * np.sqrt(p * (1 - p) / count + z * z / (4 * count * count))) / denom


def evaluate_rules(cases: list[dict], names: list[str]) -> dict:
    train = [row for row in cases if row["date"] <= TRAIN_END]
    valid = [row for row in cases if TRAIN_END < row["date"] <= VALID_END]
    holdout = [row for row in cases if row["date"] > VALID_END]
    X = np.array([[np.nan if value is None else value for value in row["x"]] for row in cases], dtype=float)
    y = np.array([row["y"] for row in cases], dtype=int)
    splits = [np.array([row["date"] <= TRAIN_END for row in cases]),
              np.array([TRAIN_END < row["date"] <= VALID_END for row in cases]),
              np.array([row["date"] > VALID_END for row in cases])]
    primary_holdout = splits[2] & np.array([row["market"] in PRIMARY for row in cases])
    candidates: list[dict] = []
    # 24 genuinely prior-observable features, multiple thresholds and directions.
    # Count configurations explicitly; no holdout label is read during selection.
    for col, name in enumerate(names):
        if name in {"same_day_other_dp", "same_day_other_count"}:
            continue
        values = X[splits[0], col]
        values = values[np.isfinite(values)]
        if len(values) < 100:
            continue
        thresholds = np.unique(np.quantile(values, np.linspace(0.05, 0.95, 25)))
        for threshold in thresholds:
            for direction in ("<=", ">="):
                chosen = np.isfinite(X[:, col]) & ((X[:, col] <= threshold) if direction == "<=" else (X[:, col] >= threshold))
                tr = metrics(y[splits[0]], chosen[splits[0]])
                va = metrics(y[splits[1]], chosen[splits[1]])
                candidates.append({"rule": f"{name} {direction} {threshold:.4g}", "train": tr, "validation": va,
                                   "mask": chosen})
    # Pairwise gates test interactions without peeking at held-out outcomes.
    singles = sorted(candidates, key=lambda c: (c["validation"]["precision"] or 0, c["validation"]["calls"]), reverse=True)
    pool = [c for c in singles if c["train"]["calls"] >= 100 and c["validation"]["calls"] >= 30][:50]
    for i, left in enumerate(pool):
        for right in pool[i + 1:]:
            if left["rule"].split()[0] == right["rule"].split()[0]:
                continue
            chosen = left["mask"] & right["mask"]
            tr = metrics(y[splits[0]], chosen[splits[0]])
            va = metrics(y[splits[1]], chosen[splits[1]])
            candidates.append({"rule": f"{left['rule']} AND {right['rule']}", "train": tr,
                               "validation": va, "mask": chosen})
            if len(candidates) >= 1200:
                break
        if len(candidates) >= 1200:
            break
    eligible = [c for c in candidates if c["train"]["calls"] >= 100 and c["validation"]["calls"] >= 30]
    best = max(eligible, key=lambda c: (wilson_lower(c["validation"]["hits"], c["validation"]["calls"]),
                                        c["validation"]["calls"]))
    rule_holdout = metrics(y[splits[2]], best["mask"][splits[2]])
    rule_primary_holdout = metrics(y[primary_holdout], best["mask"][primary_holdout])
    # A second family uses probability models; threshold selection is confined to validation.
    usable_cols = [i for i, name in enumerate(names) if name not in {"same_day_other_dp", "same_day_other_count"}]
    X = X[:, usable_cols]
    medians = np.nanmedian(X[splits[0]], axis=0)
    medians = np.nan_to_num(medians)
    X = np.where(np.isfinite(X), X, medians)
    model_specs = [
        ("logistic", LogisticRegression(max_iter=1000, class_weight="balanced")),
        ("random_forest", RandomForestClassifier(n_estimators=150, min_samples_leaf=100, max_depth=7, n_jobs=-1, random_state=13)),
        ("hist_gradient_boost", HistGradientBoostingClassifier(max_iter=100, max_leaf_nodes=12, min_samples_leaf=100, l2_regularization=10, random_state=13)),
    ]
    model_results = []
    for model_name, model in model_specs:
        model.fit(X[splits[0]], y[splits[0]])
        probabilities = model.predict_proba(X)[:, 1]
        thresholds = np.linspace(0.30, 0.95, 66)
        choices = []
        for threshold in thresholds:
            va = metrics(y[splits[1]], probabilities[splits[1]] >= threshold)
            if va["calls"] >= 30:
                choices.append((wilson_lower(va["hits"], va["calls"]), threshold, va))
        if not choices:
            model_results.append({"model": model_name, "validation": None, "holdout": None})
            continue
        _, threshold, va = max(choices)
        ho = metrics(y[splits[2]], probabilities[splits[2]] >= threshold)
        primary_ho = metrics(y[primary_holdout], probabilities[primary_holdout] >= threshold)
        model_results.append({"model": model_name, "threshold": round(float(threshold), 3),
                              "validation": va, "holdout": ho, "primaryHoldout": primary_ho,
                              "validationAuc": round(roc_auc_score(y[splits[1]], probabilities[splits[1]]), 4),
                              "holdoutAuc": round(roc_auc_score(y[splits[2]], probabilities[splits[2]]), 4)})
    return {
        "design": {"trainThrough": TRAIN_END, "validationThrough": VALID_END,
                   "holdoutStarts": "2026-01-01", "features": [names[i] for i in usable_cols],
                   "ruleConfigurations": len(candidates), "probabilityConfigurations": len(model_specs) * 66},
        "splits": {name: {"events": len(rows), "dpEvents": sum(r["y"] for r in rows),
                          "dpRate": round(np.mean([r["y"] for r in rows]), 4),
                          "first": min(r["date"] for r in rows), "last": max(r["date"] for r in rows)}
                   for name, rows in (("train", train), ("validation", valid), ("holdout", holdout))},
        "bestRule": {"rule": best["rule"], "train": best["train"],
                     "validation": best["validation"], "holdout": rule_holdout,
                     "primaryHoldout": rule_primary_holdout},
        "primaryHoldout": {"events": int(primary_holdout.sum()),
                           "dpEvents": int(y[primary_holdout].sum())},
        "models": model_results,
        "decision": "No DP calls until a frozen rule clears 90% precision with sufficient holdout support.",
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    sources: dict[str, dict] = {}
    if "--offline" in sys.argv:
        with (OUT / "chart_rows.csv").open(newline="", encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        sources = json.loads((OUT / "results.json").read_text(encoding="utf-8"))["sources"]
    else:
        with ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(fetch_market, item): item[0] for item in MARKETS.items()}
            for future in as_completed(futures):
                market, fetched, source = future.result()
                rows.extend(fetched)
                sources[market] = source
                print(f"{market}: {len(fetched)} rows", flush=True)
    rows.sort(key=lambda row: (row["date"], row["market"]))
    with (OUT / "chart_rows.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=("date", "market", "open", "close"))
        writer.writeheader()
        writer.writerows(rows)
    cases, names = make_cases(rows)
    report = evaluate_rules(cases, names)
    report["sources"] = sources
    report["data"] = {"marketCount": len(sources), "drawRows": len(rows),
                      "first": rows[0]["date"], "last": rows[-1]["date"],
                      "panelEvents": sum(bool(r["open"]) + bool(r["close"]) for r in rows),
                      "extraMarkets": list(EXTRA)}
    (OUT / "results.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"data": report["data"], "splits": report["splits"],
                      "bestRule": report["bestRule"], "models": report["models"]}, indent=2))


if __name__ == "__main__":
    main()
