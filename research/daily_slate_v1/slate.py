"""Shared data for the daily-slate research.

A "slate" is one calendar day: up to 24 draws (12 app markets x Open/Close),
ordered by the declared result time in src/lib/market-schedule.ts.
"""

from __future__ import annotations

import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "dp_panel_v3"))
import research as R  # noqa: E402  (reuses the merged chart loader)

TIMES = {  # minutes after midnight, from market-schedule.ts
    ("Sridevi", "open"): 695, ("Sridevi", "close"): 755,
    ("Time Bazar", "open"): 790, ("Time Bazar", "close"): 850,
    ("Madhur Day", "open"): 810, ("Madhur Day", "close"): 870,
    ("Rajdhani Day", "open"): 905, ("Rajdhani Day", "close"): 1025,
    ("Milan Day", "open"): 910, ("Milan Day", "close"): 1030,
    ("Kalyan", "open"): 945, ("Kalyan", "close"): 1065,
    ("Sridevi Night", "open"): 1155, ("Sridevi Night", "close"): 1215,
    ("Madhur Night", "open"): 1230, ("Madhur Night", "close"): 1350,
    ("Milan Night", "open"): 1265, ("Milan Night", "close"): 1385,
    ("Rajdhani Night", "open"): 1295, ("Rajdhani Night", "close"): 1425,
    ("Kalyan Night", "open"): 1305, ("Kalyan Night", "close"): 1425,
    ("Main Bazar", "open"): 1320, ("Main Bazar", "close"): 1450,
}
SLOTS = sorted(TIMES, key=lambda k: (TIMES[k], k[0], k[1]))
SLOT_INDEX = {s: i for i, s in enumerate(SLOTS)}


def sutta(p: str) -> int:
    return sum(map(int, p)) % 10


def is_dp(p: str) -> bool:
    return len(set(p)) == 2


def load_slates(start: str = "2016-01-01") -> dict[str, list[dict]]:
    """date -> list of draws in schedule order. Each draw: slot, market, side, panel."""
    slates: dict[str, list[dict]] = defaultdict(list)
    for r in R.load_rows():
        # Weekdays only: the user does not play Saturday or Sunday.
        if r["date"] < start or weekday(r["date"]) >= 5:
            continue
        for side in ("open", "close"):
            p = r[side]
            if p and len(p) == 3 and p.isdigit():
                slot = (r["market"], side)
                slates[r["date"]].append({
                    "slot": SLOT_INDEX[slot], "market": r["market"], "side": side,
                    "panel": p, "sutta": sutta(p), "dp": is_dp(p),
                    "time": TIMES[slot],
                })
    for d in slates:
        slates[d].sort(key=lambda x: x["slot"])
    return dict(sorted(slates.items()))


def weekday(d: str) -> int:
    return date.fromisoformat(d).weekday()


def earlier(draws: list[dict], t: dict) -> list[dict]:
    """Draws declared strictly before draw t on the same day (by schedule)."""
    return [x for x in draws if x["time"] < t["time"]]
