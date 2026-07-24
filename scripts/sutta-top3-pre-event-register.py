"""Create a write-once, local pre-event Top-3 research registry."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
SOURCE_CACHE = ROOT / "scratch" / "sutta-independent-source-records.json"
SOURCE_META = ROOT / "scratch" / "sutta-independent-source-meta.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-pre-event-registry-20260715.json"
MARKETS = [
    "Sridevi",
    "Time Bazar",
    "Milan Day",
    "Kalyan",
    "Kalyan Night",
    "Milan Night",
    "Rajdhani Night",
    "Main Bazar",
]
OPEN_MINUTE = {
    "Sridevi": 695,
    "Time Bazar": 790,
    "Milan Day": 910,
    "Kalyan": 945,
    "Milan Night": 1265,
    "Rajdhani Night": 1295,
    "Kalyan Night": 1305,
    "Main Bazar": 1320,
}
IST = ZoneInfo("Asia/Kolkata")


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_pre_event_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()


def rows_for_market(raw: dict, market: str):
    return [
        F.Row(
            iso=row["isoDate"],
            day=row["day"],
            day_of_month=date.fromisoformat(row["isoDate"]).day,
            open=int(row["openSutta"]),
            close=int(row["closeSutta"]),
            jodi=str(row["jodi"]),
        )
        for row in raw["markets"][market]
    ]


def next_market_date(rows: list) -> date:
    last = date.fromisoformat(rows[-1].iso)
    active_days = {row.day for row in rows[-120:]}
    candidate = last + timedelta(days=1)
    for _ in range(14):
        if candidate.strftime("%A") in active_days:
            return candidate
        candidate += timedelta(days=1)
    raise RuntimeError("Unable to identify next active market date")


def make_target(value: date, open_digit: int = 0):
    return F.Row(
        iso=value.isoformat(),
        day=value.strftime("%A"),
        day_of_month=value.day,
        open=open_digit,
        close=0,
        jodi=f"{open_digit}0",
    )


def rank100(scores: list[float]) -> list[int]:
    return sorted(range(100), key=lambda value: (-scores[value], value))


def canonical_sha(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def main() -> None:
    if OUTPUT.exists():
        raise FileExistsError(f"Write-once registry already exists: {OUTPUT}")

    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)
    raw_bytes = SOURCE_CACHE.read_bytes()
    raw = json.loads(raw_bytes)
    meta = json.loads(SOURCE_META.read_text(encoding="utf-8"))
    registrations = []

    for market in MARKETS:
        prior = rows_for_market(raw, market)
        target_date = next_market_date(prior)
        open_at = datetime.combine(target_date, time.min, IST) + timedelta(minutes=OPEN_MINUTE[market])
        if now_ist >= open_at:
            raise RuntimeError(f"Cannot seal {market}: current time {now_ist.isoformat()} is not before {open_at.isoformat()}")

        target = make_target(target_date)
        open_scores = F.feature_scores(prior, "open", target)
        close_scores = F.feature_scores(prior, "close", target)
        exact_scores = F.jodi_feature_scores(prior, target)
        open_picks = F.rank(open_scores["recent7_hot"])[:3]
        close_picks = F.rank(close_scores["lag7_opposite"])[:3]
        grid_open = F.rank(open_scores["delta"])[:3]
        grid_close = F.rank(close_scores["calendar_date"])[:3]
        adjusted = {}
        for open_digit in range(10):
            adjusted_target = make_target(target_date, open_digit)
            adjusted_scores = F.feature_scores(prior, "close", adjusted_target)
            adjusted[str(open_digit)] = F.rank(adjusted_scores["known_open"])[:3]

        registrations.append(
            {
                "market": market,
                "targetDate": target_date.isoformat(),
                "lastInputDate": prior[-1].iso,
                "scheduledOpenAtIst": open_at.isoformat(),
                "open": {"formula": "recent7_hot", "status": "monitor", "picks": open_picks},
                "close": {
                    "formula": "lag7_opposite",
                    "status": "rejected_challenger_control",
                    "picks": close_picks,
                },
                "adjustedCloseByKnownOpen": {
                    "formula": "known_open",
                    "status": "exploratory_monitor",
                    "picks": adjusted,
                },
                "exactJodi": {
                    "formula": "direct_jodi:calendar_cold_pair",
                    "status": "exploratory_monitor",
                    "picks": [
                        f"{value:02d}"
                        for value in rank100(exact_scores["direct_jodi:calendar_cold_pair"])[:3]
                    ],
                },
                "jodiGrid": {
                    "formula": "grid:delta|calendar_date",
                    "status": "rejected_challenger_control",
                    "openPicks": grid_open,
                    "closePicks": grid_close,
                    "picks": [
                        f"{open_digit}{close_digit}"
                        for open_digit in grid_open
                        for close_digit in grid_close
                    ],
                },
            }
        )

    core = {
        "schemaVersion": 1,
        "researchOnly": True,
        "evidenceType": "local pre-event preregistration",
        "createdAtUtc": now_utc.isoformat(),
        "createdAtIst": now_ist.isoformat(),
        "warning": "The timestamp is local evidence, not an independent trusted timestamp authority.",
        "inputCache": str(SOURCE_CACHE.relative_to(ROOT)).replace("\\", "/"),
        "inputCacheSha256": hashlib.sha256(raw_bytes).hexdigest(),
        "inputFetchTimestampUtc": meta["fetchedAtUtc"],
        "featureScriptSha256": hashlib.sha256(FEATURE_PATH.read_bytes()).hexdigest(),
        "registerScriptSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "contracts": {
            "open": "exactly 3 digits",
            "close": "exactly 3 digits before Open",
            "adjustedClose": "exactly 3 digits after known Open; all 10 Open states preregistered",
            "exactJodi": "exactly 3 pairs",
            "jodiGrid": "3x3, separately labelled as 9 pairs",
        },
        "registrations": registrations,
    }
    payload = {**core, "contentSha256": canonical_sha(core)}
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f'Sealed {len(registrations)} registrations at {now_ist.isoformat()}')
    print(f'Content SHA-256: {payload["contentSha256"]}')
    for row in registrations:
        print(
            row["market"],
            row["targetDate"],
            "open", row["open"]["picks"],
            "close", row["close"]["picks"],
            "exact", row["exactJodi"]["picks"],
        )
    print(f"Saved {OUTPUT}")


if __name__ == "__main__":
    main()
