"""Freeze research-only Top-3 predictions for the next unseen market row.

The registry is content-addressed and includes predictions from formulas frozen
in the 2026-07-15 research cycle. Adjusted Close is registered for every
possible known Open digit so no post-result choice is possible.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
CACHE = ROOT / "scratch" / "sutta-top3-forward-cache-20260715.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-forward-registry-20260715.json"


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_forward_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()
F.CACHE = CACHE


def rank100(scores: list[float]) -> list[int]:
    return sorted(range(100), key=lambda value: (-scores[value], value))


def next_market_date(rows: list) -> date:
    last = date.fromisoformat(rows[-1].iso)
    active_days = {row.day for row in rows[-120:]}
    candidate = last + timedelta(days=1)
    for _ in range(14):
        if candidate.strftime("%A") in active_days:
            return candidate
        candidate += timedelta(days=1)
    raise RuntimeError("Unable to identify next active market date")


def make_target(iso: str, open_digit: int = 0):
    value = date.fromisoformat(iso)
    return F.Row(
        iso=iso,
        day=value.strftime("%A"),
        day_of_month=value.day,
        open=open_digit,
        close=0,
        jodi=f"{open_digit}0",
    )


def main() -> None:
    raw = CACHE.read_bytes()
    rows_by_market = F.load_rows()
    registrations = []

    for market in F.MARKETS:
        prior = rows_by_market[market]
        target_date = next_market_date(prior)
        iso = target_date.isoformat()
        target = make_target(iso)
        open_scores = F.feature_scores(prior, "open", target)
        close_scores = F.feature_scores(prior, "close", target)
        exact_scores = F.jodi_feature_scores(prior, target)

        open_picks = F.rank(open_scores["recent7_hot"])[:3]
        close_picks = F.rank(close_scores["lag7_opposite"])[:3]
        exact_jodis = [f"{value:02d}" for value in rank100(exact_scores["direct_jodi:calendar_cold_pair"])[:3]]
        grid_open = F.rank(open_scores["delta"])[:3]
        grid_close = F.rank(close_scores["calendar_date"])[:3]
        adjusted = {}
        for open_digit in range(10):
            adjusted_target = make_target(iso, open_digit)
            adjusted_scores = F.feature_scores(prior, "close", adjusted_target)
            adjusted[str(open_digit)] = F.rank(adjusted_scores["known_open"])[:3]

        registrations.append({
            "market": market,
            "targetDate": iso,
            "lastInputDate": prior[-1].iso,
            "open": {"formula": "recent7_hot", "status": "monitor", "picks": open_picks},
            "close": {"formula": "lag7_opposite", "status": "rejected_challenger_control", "picks": close_picks},
            "adjustedCloseByKnownOpen": {
                "formula": "known_open",
                "status": "exploratory_monitor",
                "picks": adjusted,
            },
            "exactJodi": {
                "formula": "direct_jodi:calendar_cold_pair",
                "status": "exploratory_monitor",
                "picks": exact_jodis,
            },
            "jodiGrid": {
                "formula": "grid:delta|calendar_date",
                "status": "rejected_challenger_control",
                "openPicks": grid_open,
                "closePicks": grid_close,
                "picks": [f"{open_digit}{close_digit}" for open_digit in grid_open for close_digit in grid_close],
            },
        })

    payload = {
        "schemaVersion": 1,
        "createdAt": "2026-07-15",
        "researchOnly": True,
        "inputCache": str(CACHE.relative_to(ROOT)).replace("\\", "/"),
        "inputCacheSha256": hashlib.sha256(raw).hexdigest(),
        "featureScriptSha256": hashlib.sha256(FEATURE_PATH.read_bytes()).hexdigest(),
        "contracts": {
            "open": "3 digits",
            "close": "3 digits before Open",
            "adjustedClose": "3 digits after known Open; all 10 Open states frozen",
            "exactJodi": "3 exact pairs",
            "jodiGrid": "3x3 = 9 pairs",
        },
        "registrations": registrations,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Registered {len(registrations)} markets")
    for row in registrations:
        print(row["market"], row["targetDate"], "open", row["open"]["picks"], "close", row["close"]["picks"], "exact", row["exactJodi"]["picks"])
    print(f"Saved {OUTPUT}")


if __name__ == "__main__":
    main()
