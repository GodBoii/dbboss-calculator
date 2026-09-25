"""Read public forum posts without retaining authors, IDs, or raw text."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import requests
from bs4 import BeautifulSoup


URL = "https://dpboss.direct/matka-guessing-forum"
ORDER = {digit: position for position, digit in enumerate("1234567890")}
PANEL_TOKEN = re.compile(r"(?<!\d)\d{3}(?!\d)")


def is_canonical(panel: str) -> bool:
    return all(ORDER[panel[i]] <= ORDER[panel[i + 1]] for i in range(2))


def walk(value: object):
    if isinstance(value, dict):
        post = value.get("post")
        if isinstance(post, dict) and "createdAt" in post:
            yield post
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def extract_page(page: int) -> tuple[list[dict], str]:
    response = requests.get(URL, params={"page": page, "limit": 25}, timeout=20,
                            headers={"User-Agent": "Mozilla/5.0 DP research"})
    response.raise_for_status()
    page_hash = hashlib.sha256(response.content).hexdigest()
    soup = BeautifulSoup(response.text, "html.parser")
    seen: set[str] = set()
    extracted = []
    for script in soup.select("script"):
        script_text = script.get_text()
        if "self.__next_f.push([1," not in script_text or "createdAt" not in script_text:
            continue
        prefix = "self.__next_f.push("
        if not script_text.startswith(prefix) or not script_text.endswith(")"):
            continue
        flight = json.loads(script_text[len(prefix):-1])[1]
        for line in flight.splitlines():
            _, separator, payload = line.partition(":")
            if not separator:
                continue
            try:
                tree = json.loads(payload)
            except json.JSONDecodeError:
                continue
            for post in walk(tree):
                post_id = str(post.get("_id", ""))
                if not post_id or post_id in seen:
                    continue
                seen.add(post_id)
                content = post.get("content", "")
                candidates = sorted({token for token in PANEL_TOKEN.findall(content)
                                     if is_canonical(token)}) if isinstance(content, str) else []
                if len(candidates) > 20:
                    candidates = []
                extracted.append({
                    "market": post.get("market"), "type": post.get("type"),
                    "createdAt": post.get("createdAt"), "updatedAt": post.get("updatedAt"),
                    "deleted": bool(post.get("isDeleted") or post.get("deletedAt")),
                    "panelCount": len(candidates),
                    "dpPanelCount": sum(len(set(panel)) == 2 for panel in candidates),
                    "spPanelCount": sum(len(set(panel)) == 3 for panel in candidates),
                })
    return extracted, page_hash


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    posts, page_hash = extract_page(args.page)
    summary = {
        "page": args.page,
        "pageSha256": page_hash,
        "postCount": len(posts),
        "types": dict(Counter(str(post["type"]) for post in posts)),
        "markets": dict(Counter(str(post["market"]) for post in posts)),
        "firstCreatedAt": min((post["createdAt"] for post in posts if post["createdAt"]), default=None),
        "lastCreatedAt": max((post["createdAt"] for post in posts if post["createdAt"]), default=None),
        "postsWithPanels": sum(post["panelCount"] > 0 for post in posts),
        "unmodified": sum(post["createdAt"] == post["updatedAt"] for post in posts),
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps({"summary": summary, "posts": posts}, indent=2) + "\n",
                               encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
