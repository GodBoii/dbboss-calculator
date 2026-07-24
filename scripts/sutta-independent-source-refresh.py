"""Fetch deterministic panel records from an independent research source."""

from __future__ import annotations

import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "scratch" / "sutta-independent-source-records.json"
META = ROOT / "scratch" / "sutta-independent-source-meta.json"
SOURCE = "https://www.kalyanchart.net/"
URLS = {
    "Sridevi": "charts/matka-sridevi-panel-chart.php",
    "Time Bazar": "charts/matka-time-bazar-panel-chart.php",
    "Milan Day": "charts/matka-milan-day-panel-chart.php",
    "Kalyan": "kalyan-panel-chart.php",
    "Kalyan Night": "charts/matka-kalyan-night-panel-chart.php",
    "Milan Night": "charts/matka-milan-night-panel-chart.php",
    "Rajdhani Night": "charts/matka-rajdhani-night-panel-chart.php",
    "Main Bazar": "charts/matka-main-bazar-panel-chart.php",
}
DAY_OFFSET = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
DAY_NAME = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tables: list[list[list[str]]] = []
        self._table_depth = 0
        self._rows: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._rows = []
        elif self._table_depth == 1 and tag == "tr":
            self._row = []
        elif self._table_depth == 1 and tag in ("td", "th"):
            self._cell = []

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._table_depth == 1 and tag in ("td", "th") and self._cell is not None:
            assert self._row is not None
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif self._table_depth == 1 and tag == "tr" and self._row is not None:
            assert self._rows is not None
            if self._row:
                self._rows.append(self._row)
            self._row = None
        elif tag == "table" and self._table_depth:
            if self._table_depth == 1 and self._rows:
                self.tables.append(self._rows)
                self._rows = None
            self._table_depth -= 1


def fetch(market: str, path: str) -> tuple[str, str, dict[str, str]]:
    url = SOURCE + path
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 research-audit/1.0"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", "replace")
        headers = {
            key: value
            for key in ("ETag", "Last-Modified", "Date")
            if (value := response.headers.get(key)) is not None
        }
    return market, html, headers


def select_panel_table(html: str) -> list[list[str]]:
    parser = TableParser()
    parser.feed(html)
    for table in parser.tables:
        if not table or not table[0]:
            continue
        header = table[0]
        if header[0].strip().lower() == "date" and any(value[:3] in DAY_OFFSET for value in header[1:]):
            return table
    raise ValueError("Panel table not found")


def valid_panel(value: str) -> bool:
    return len(value) == 3 and value.isdigit()


def valid_jodi(value: str) -> bool:
    return len(value) == 2 and value.isdigit()


def parse_records(market: str, html: str, source_url: str) -> list[dict[str, Any]]:
    table = select_panel_table(html)
    day_columns = [value[:3] for value in table[0][1:] if value[:3] in DAY_OFFSET]
    records: list[dict[str, Any]] = []
    for cells in table[1:]:
        if not cells:
            continue
        match = re.match(r"^(\d{2}/\d{2}/\d{4})\s+to\s+\d{2}/\d{2}/\d{4}$", cells[0])
        if match is None:
            continue
        week_start = datetime.strptime(match.group(1), "%d/%m/%Y").date()
        values = cells[1:]
        for index, day in enumerate(day_columns):
            start = index * 3
            if start + 2 >= len(values):
                break
            open_panel, jodi, close_panel = values[start:start + 3]
            if not valid_panel(open_panel) or not valid_jodi(jodi) or not valid_panel(close_panel):
                continue
            open_sutta = sum(int(value) for value in open_panel) % 10
            close_sutta = sum(int(value) for value in close_panel) % 10
            if jodi != f"{open_sutta}{close_sutta}":
                raise ValueError(f"Panel/Jodi mismatch: {market} {cells[0]} {day} {open_panel}-{jodi}-{close_panel}")
            iso = (week_start + timedelta(days=DAY_OFFSET[day])).isoformat()
            records.append(
                {
                    "market": market,
                    "isoDate": iso,
                    "day": DAY_NAME[DAY_OFFSET[day]],
                    "openPanel": open_panel,
                    "openSutta": open_sutta,
                    "jodi": jodi,
                    "closePanel": close_panel,
                    "closeSutta": close_sutta,
                    "sourceUrl": source_url,
                }
            )
    unique = {(row["isoDate"], row["jodi"]): row for row in records}
    return sorted(unique.values(), key=lambda row: row["isoDate"])


def main() -> None:
    fetched: dict[str, tuple[str, dict[str, str]]] = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(fetch, market, path) for market, path in URLS.items()]
        for future in futures:
            market, html, headers = future.result()
            fetched[market] = (html, headers)

    markets: dict[str, list[dict[str, Any]]] = {}
    response_headers: dict[str, dict[str, str]] = {}
    for market, path in URLS.items():
        html, headers = fetched[market]
        markets[market] = parse_records(market, html, SOURCE + path)
        response_headers[market] = headers

    payload = {
        "schemaVersion": 1,
        "researchOnly": True,
        "source": SOURCE,
        "markets": markets,
    }
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    OUTPUT.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    meta = {
        "schemaVersion": 1,
        "researchOnly": True,
        "fetchedAtUtc": datetime.now(timezone.utc).isoformat(),
        "output": str(OUTPUT.relative_to(ROOT)).replace("\\", "/"),
        "sha256": digest,
        "responseHeaders": response_headers,
        "counts": {market: len(rows) for market, rows in markets.items()},
        "latest": {market: rows[-1]["isoDate"] if rows else None for market, rows in markets.items()},
    }
    META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sha256": digest, "counts": meta["counts"], "latest": meta["latest"]}, indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {META}")


if __name__ == "__main__":
    main()
