"""Score the write-once pre-event registry as independent rows arrive."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "scratch" / "sutta-top3-pre-event-registry-20260715.json"
ACTUALS = ROOT / "scratch" / "sutta-independent-source-records.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-pre-event-score-20260715.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-pre-event-registry-status.md"


def canonical_sha(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def empty_metric() -> dict[str, Any]:
    return {"calls": 0, "hits": 0, "accuracy": None}


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    claimed_hash = registry["contentSha256"]
    core = {key: value for key, value in registry.items() if key != "contentSha256"}
    actual_hash = canonical_sha(core)
    if claimed_hash != actual_hash:
        raise ValueError(f"Registry integrity failure: {claimed_hash} != {actual_hash}")

    source_bytes = ACTUALS.read_bytes()
    actuals = json.loads(source_bytes)
    row_maps = {
        market: {row["isoDate"]: row for row in rows}
        for market, rows in actuals["markets"].items()
    }
    totals = {
        name: empty_metric()
        for name in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")
    }
    scored = []
    pending = []

    for registration in registry["registrations"]:
        market = registration["market"]
        target_date = registration["targetDate"]
        actual = row_maps.get(market, {}).get(target_date)
        if actual is None:
            pending.append({"market": market, "targetDate": target_date})
            continue
        jodi = f'{actual["openSutta"]}{actual["closeSutta"]}'
        if actual["jodi"] != jodi:
            raise ValueError(f"Actual Jodi mismatch for {market} {target_date}")
        adjusted_picks = registration["adjustedCloseByKnownOpen"]["picks"][str(actual["openSutta"])]
        hits = {
            "open": actual["openSutta"] in registration["open"]["picks"],
            "close": actual["closeSutta"] in registration["close"]["picks"],
            "adjustedClose": actual["closeSutta"] in adjusted_picks,
            "exactJodi": jodi in registration["exactJodi"]["picks"],
            "jodiGrid": jodi in registration["jodiGrid"]["picks"],
        }
        for name, hit in hits.items():
            totals[name]["calls"] += 1
            totals[name]["hits"] += int(hit)
        scored.append(
            {
                "market": market,
                "targetDate": target_date,
                "actual": {
                    "open": actual["openSutta"],
                    "close": actual["closeSutta"],
                    "jodi": jodi,
                    "openPanel": actual["openPanel"],
                    "closePanel": actual["closePanel"],
                },
                "adjustedClosePicks": adjusted_picks,
                "hits": hits,
                "sourceUrl": actual["sourceUrl"],
            }
        )

    for metric in totals.values():
        if metric["calls"]:
            metric["accuracy"] = round(100 * metric["hits"] / metric["calls"], 3)
    payload = {
        "schemaVersion": 1,
        "researchOnly": True,
        "evidenceType": registry["evidenceType"],
        "registry": str(REGISTRY.relative_to(ROOT)).replace("\\", "/"),
        "registryContentSha256": claimed_hash,
        "registryIntegrityVerified": True,
        "actuals": str(ACTUALS.relative_to(ROOT)).replace("\\", "/"),
        "actualsSha256": hashlib.sha256(source_bytes).hexdigest(),
        "totals": totals,
        "scored": scored,
        "pending": pending,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Top-3 Pre-Event Registry Status",
        "",
        f'Preregistered at `{registry["createdAtIst"]}`. Registry integrity: verified.',
        "",
        f'Scored: {len(scored)}. Pending: {len(pending)}.',
        "",
        "| Target | Hits | Calls | Accuracy |",
        "| --- | ---: | ---: | ---: |",
    ]
    for name, metric in totals.items():
        accuracy = "pending" if metric["accuracy"] is None else f'{metric["accuracy"]:.1f}%'
        lines.append(f'| {name} | {metric["hits"]} | {metric["calls"]} | {accuracy} |')
    lines.extend(["", "## Pending", ""])
    for row in pending:
        lines.append(f'- {row["market"]}: {row["targetDate"]}')
    lines.append("")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"totals": totals, "scored": len(scored), "pending": len(pending)}, indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
