"""Run one day's pre-result forum snapshots, skipping any missed cutoff."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time as clock
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from capture import EVENT_MINUTES, IST, OUT


HERE = Path(__file__).resolve().parent
RUN_LOG = HERE / "capture_runs.jsonl"
LEAD_MINUTES = 10
START_EARLY_SECONDS = 90


def schedule_for(target_date: date):
    events = []
    for market, (open_minute, close_minute) in EVENT_MINUTES.items():
        for side, minute in (("open", open_minute), ("close", close_minute)):
            scheduled = datetime.combine(target_date, time(0), IST) + timedelta(minutes=minute)
            cutoff = scheduled - timedelta(minutes=LEAD_MINUTES)
            events.append((cutoff, market, side))
    return sorted(events)


def append_run(item: dict) -> None:
    with RUN_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(item, sort_keys=True) + "\n")


def already_captured(target_date: date, market: str, side: str) -> bool:
    if not OUT.exists():
        return False
    for line in OUT.read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        item = json.loads(line)
        if (item.get("targetDateIST"), item.get("market"), item.get("side")) == (
            target_date.isoformat(), market, side
        ):
            return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Market date in YYYY-MM-DD; defaults to today in IST")
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        target_date = date.fromisoformat(args.date) if args.date else datetime.now(IST).date()
    except ValueError:
        parser.error("date must be YYYY-MM-DD")
    if not 1 <= args.pages <= 10:
        parser.error("pages must be between 1 and 10")

    for cutoff, market, side in schedule_for(target_date):
        run_at = cutoff - timedelta(seconds=START_EARLY_SECONDS)
        if args.dry_run:
            print(f"{market} {side}: start {run_at.isoformat()}, cutoff {cutoff.isoformat()}")
            continue
        if already_captured(target_date, market, side):
            continue
        now = datetime.now(IST)
        if now >= cutoff:
            continue
        while now < run_at:
            clock.sleep(min(60, max(0.1, (run_at - now).total_seconds())))
            now = datetime.now(IST)
        if now >= cutoff:
            continue
        command = [sys.executable, str(HERE / "capture.py"), market, side,
                   "--pages", str(args.pages), "--lead-minutes", str(LEAD_MINUTES),
                   "--target-date", target_date.isoformat()]
        try:
            result = subprocess.run(command, capture_output=True, text=True,
                                    timeout=60, check=False)
            outcome = "captured" if result.returncode == 0 else "skipped_or_failed"
            detail = "" if result.returncode == 0 else result.stderr[-300:]
        except subprocess.TimeoutExpired:
            outcome, detail = "timeout", "capture exceeded 60 seconds"
        append_run({"atUtc": datetime.now(timezone.utc).isoformat(),
                    "targetDateIST": target_date.isoformat(), "market": market,
                    "side": side, "outcome": outcome, "detail": detail})
        print(f"{market} {side}: {outcome}", flush=True)


if __name__ == "__main__":
    main()
