"""Join frozen public-guess aggregates to later charted DP outcomes."""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from capture import EVENT_MINUTES, IST, OUT


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from research.dp_only_v1.run_research import fetch_market  # noqa: E402


SCORES = Path(__file__).resolve().parent / "forward_scores.jsonl"
NAMES = {
    "sridevi": "Sridevi", "time_bazar": "Time Bazar",
    "madhur_day": "Madhur Day", "rajdhani_day": "Rajdhani Day",
    "milan_day": "Milan Day", "kalyan": "Kalyan",
    "sridevi_night": "Sridevi Night", "madhur_night": "Madhur Night",
    "milan_night": "Milan Night", "rajdhani_night": "Rajdhani Night",
    "kalyan_night": "Kalyan Night", "main_bazar": "Main Bazar",
}


def main() -> None:
    if not OUT.exists():
        print("No frozen snapshots yet.")
        return
    snapshots = [json.loads(line) for line in OUT.read_text(encoding="utf-8").splitlines() if line]
    scored = set()
    if SCORES.exists():
        for line in SCORES.read_text(encoding="utf-8").splitlines():
            if line:
                item = json.loads(line)
                scored.add((item["capturedAtUtc"], item["market"], item["side"]))
    now = datetime.now(timezone.utc)
    pending = []
    for snapshot in snapshots:
        key = (snapshot["capturedAtUtc"], snapshot["market"], snapshot["side"])
        if key in scored:
            continue
        target_date = date.fromisoformat(snapshot["targetDateIST"])
        minute = EVENT_MINUTES[snapshot["market"]][0 if snapshot["side"] == "open" else 1]
        scheduled = datetime.combine(target_date, time(0), IST) + timedelta(minutes=minute)
        if now <= scheduled.astimezone(timezone.utc):
            continue
        pending.append(snapshot)
    for snapshot in pending:
        name = NAMES[snapshot["market"]]
        _, records, source = fetch_market((name, snapshot["market"].replace("_", "-")))
        match = next((row for row in records if row["date"] == snapshot["targetDateIST"]), None)
        panel = match[snapshot["side"]] if match else None
        if not panel:
            print(f"Pending chart result: {name} {snapshot['targetDateIST']} {snapshot['side']}")
            continue
        result = {
            "capturedAtUtc": snapshot["capturedAtUtc"],
            "scoredAtUtc": now.isoformat(), "targetDateIST": snapshot["targetDateIST"],
            "market": snapshot["market"], "side": snapshot["side"],
            "actualDp": len(set(panel)) == 2,
            "parserVersion": snapshot.get("parserVersion", 1),
            "source": source["resolvedUrl"],
            "aggregate": snapshot["aggregate"],
        }
        with SCORES.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(result, sort_keys=True) + "\n")
        print(f"Scored {name} {snapshot['side']}: {'DP' if result['actualDp'] else 'other'}")


if __name__ == "__main__":
    main()
