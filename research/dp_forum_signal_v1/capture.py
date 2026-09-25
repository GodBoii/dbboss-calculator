"""Freeze anonymous public-guess aggregates before a scheduled market event."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

from forum_extract import extract_page


OUT = Path(__file__).resolve().parent / "forward_snapshots.jsonl"
IST = ZoneInfo("Asia/Kolkata")
EVENT_MINUTES = {
    "sridevi": (695, 755), "time_bazar": (790, 850),
    "madhur_day": (810, 870), "rajdhani_day": (905, 1025),
    "milan_day": (910, 1030), "kalyan": (945, 1065),
    "sridevi_night": (1155, 1215), "madhur_night": (1230, 1350),
    "milan_night": (1265, 1385), "rajdhani_night": (1295, 1425),
    "kalyan_night": (1305, 1425), "main_bazar": (1320, 1450),
}
CHART_DATE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{2,4})")


def published_chart_panel(market: str, side: str, target_date: date) -> tuple[bool, str]:
    url = f"https://dpboss.tax/panel-chart-record/{market.replace('_', '-')}.php"
    response = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0 DP research"})
    response.raise_for_status()
    page_hash = hashlib.sha256(response.content).hexdigest()
    soup = BeautifulSoup(response.text, "html.parser")
    for row in soup.select("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.select("td")]
        if len(cells) < 4:
            continue
        match = CHART_DATE.search(cells[0])
        if not match:
            continue
        day, month, year = map(int, match.groups())
        if year < 100:
            year += 2000
        try:
            offset = (target_date - date(year, month, day)).days
        except ValueError:
            continue
        index = 1 + offset * 3 + (0 if side == "open" else 2)
        if not 0 <= offset < 7 or index >= len(cells):
            continue
        numbers = re.findall(r"\d+", cells[index])
        panel = next((number for number in numbers if len(number) == 3), None)
        if panel is None:
            singles = [number for number in numbers if len(number) == 1]
            panel = "".join(singles[:3]) if len(singles) >= 3 else None
        if panel and len(panel) == 3:
            return True, page_hash
    return False, page_hash


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("market", choices=sorted(EVENT_MINUTES))
    parser.add_argument("side", choices=("open", "close"))
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--lead-minutes", type=int, default=10)
    parser.add_argument("--target-date", help="Market date in YYYY-MM-DD; useful after midnight")
    args = parser.parse_args()
    if not 1 <= args.pages <= 10:
        parser.error("pages must be between 1 and 10")
    if not 0 <= args.lead_minutes <= 60:
        parser.error("lead-minutes must be between 0 and 60")

    captured_at = datetime.now(timezone.utc)
    local = captured_at.astimezone(IST)
    event_minute = EVENT_MINUTES[args.market][0 if args.side == "open" else 1]
    try:
        target_date = date.fromisoformat(args.target_date) if args.target_date else local.date()
    except ValueError:
        parser.error("target-date must be YYYY-MM-DD")
    if not args.target_date and event_minute >= 1440 and local.hour < 2:
        target_date -= timedelta(days=1)
    scheduled = datetime.combine(target_date, time(0), IST) + timedelta(minutes=event_minute)
    cutoff = scheduled - timedelta(minutes=args.lead_minutes)
    if local >= cutoff:
        parser.error("capture must finish before the scheduled pre-result cutoff")
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines():
            if not line:
                continue
            prior = json.loads(line)
            if (prior.get("targetDateIST"), prior.get("market"), prior.get("side")) == (
                target_date.isoformat(), args.market, args.side
            ):
                parser.error("this target already has a frozen snapshot")

    published_before, chart_hash_before = published_chart_panel(args.market, args.side, target_date)
    if published_before:
        parser.error("target panel is already published on the chart")

    all_posts = []
    page_hashes = []
    for page in range(1, args.pages + 1):
        posts, page_hash = extract_page(page)
        all_posts.extend(posts)
        page_hashes.append(page_hash)
    unique_posts = {}
    for post in all_posts:
        key = (post["market"], post["createdAt"], post["updatedAt"],
               post["panelCount"], post["dpPanelCount"], post["spPanelCount"])
        unique_posts[key] = post
    finished_at = datetime.now(timezone.utc)
    if finished_at.astimezone(IST) >= cutoff:
        parser.error("fetch finished after the scheduled pre-result cutoff; snapshot discarded")
    published_after, chart_hash_after = published_chart_panel(args.market, args.side, target_date)
    if published_after:
        parser.error("target panel appeared before snapshot finished; snapshot discarded")

    target_tag = f"{args.market}_{args.side}"
    target_posts = []
    for post in unique_posts.values():
        if post["market"] != target_tag or post["type"] != "guessing" or post["deleted"]:
            continue
        created = post["createdAt"]
        updated = post["updatedAt"]
        if not isinstance(created, str) or not isinstance(updated, str):
            continue
        created_at = datetime.fromisoformat(created.replace("Z", "+00:00"))
        updated_at = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        if not target_date <= created_at.astimezone(IST).date() <= scheduled.date():
            continue
        if created_at > captured_at or updated_at > captured_at:
            continue
        target_posts.append(post)

    counts = Counter()
    for post in target_posts:
        counts["posts"] += 1
        counts["postsWithCanonicalPanels"] += int(post["panelCount"] > 0)
        counts["dpPanelTokens"] += post["dpPanelCount"]
        counts["spPanelTokens"] += post["spPanelCount"]
        counts["postsMentioningDP"] += int(post["dpPanelCount"] > 0)
        counts["postsMentioningSP"] += int(post["spPanelCount"] > 0)

    record = {
        "capturedAtUtc": captured_at.isoformat(), "finishedAtUtc": finished_at.isoformat(),
        "targetDateIST": target_date.isoformat(), "market": args.market, "side": args.side,
        "scheduledMinuteIST": event_minute, "leadMinutes": args.lead_minutes,
        "pagesFetched": args.pages, "aggregate": dict(counts),
        "sourcePageSha256": page_hashes,
        "chartSha256Before": chart_hash_before, "chartSha256After": chart_hash_after,
        "chartResultPresentAtCapture": False, "parserVersion": 3,
        "method": "Anonymous public forum aggregate; not a bet ledger or DP prediction",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    main()
