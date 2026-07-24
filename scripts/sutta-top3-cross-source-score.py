"""Score the Top-3 research registry against independently sourced actuals."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "scratch" / "sutta-top3-forward-registry-20260715.json"
ACTUALS = ROOT / "scratch" / "sutta-top3-cross-source-20260713.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-cross-source-score-20260713.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-cross-source-score.md"


def empty_metric() -> dict[str, Any]:
    return {"calls": 0, "hits": 0, "accuracy": None}


def main() -> None:
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    actuals = json.loads(ACTUALS.read_text(encoding="utf-8"))
    registrations = {row["market"]: row for row in registry["registrations"]}
    totals = {
        name: empty_metric()
        for name in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")
    }
    scored: list[dict[str, Any]] = []

    for actual in actuals["rows"]:
        registration = registrations.get(actual["market"])
        if registration is None:
            raise KeyError(f'No registry entry for {actual["market"]}')
        if registration["targetDate"] != actuals["targetDate"]:
            raise ValueError(
                f'Target date mismatch for {actual["market"]}: '
                f'{registration["targetDate"]} != {actuals["targetDate"]}'
            )

        jodi = f'{actual["open"]}{actual["close"]}'
        if jodi != actual["jodi"]:
            raise ValueError(f'Jodi mismatch for {actual["market"]}: {jodi} != {actual["jodi"]}')
        adjusted_picks = registration["adjustedCloseByKnownOpen"]["picks"][str(actual["open"])]
        hits = {
            "open": actual["open"] in registration["open"]["picks"],
            "close": actual["close"] in registration["close"]["picks"],
            "adjustedClose": actual["close"] in adjusted_picks,
            "exactJodi": jodi in registration["exactJodi"]["picks"],
            "jodiGrid": jodi in registration["jodiGrid"]["picks"],
        }
        for name, hit in hits.items():
            totals[name]["calls"] += 1
            totals[name]["hits"] += int(hit)
        scored.append(
            {
                "market": actual["market"],
                "targetDate": actuals["targetDate"],
                "actual": {"open": actual["open"], "close": actual["close"], "jodi": jodi},
                "picks": {
                    "open": registration["open"]["picks"],
                    "close": registration["close"]["picks"],
                    "adjustedClose": adjusted_picks,
                    "exactJodi": registration["exactJodi"]["picks"],
                    "jodiGrid": registration["jodiGrid"]["picks"],
                },
                "hits": hits,
                "sourceUrl": actual["sourceUrl"],
            }
        )

    for metric in totals.values():
        metric["accuracy"] = round(100 * metric["hits"] / metric["calls"], 3)

    payload = {
        "schemaVersion": 1,
        "evidenceType": actuals["evidenceType"],
        "warning": actuals["warning"],
        "registry": str(REGISTRY.relative_to(ROOT)).replace("\\", "/"),
        "actuals": str(ACTUALS.relative_to(ROOT)).replace("\\", "/"),
        "totals": totals,
        "scored": scored,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Top-3 Cross-Source Score (2026-07-13)",
        "",
        f'**Evidence type:** {actuals["evidenceType"]}.',
        "",
        f'> {actuals["warning"]}',
        "",
        "| Target | Hits | Calls | Accuracy |",
        "| --- | ---: | ---: | ---: |",
    ]
    for name, metric in totals.items():
        lines.append(
            f'| {name} | {metric["hits"]} | {metric["calls"]} | {metric["accuracy"]:.1f}% |'
        )
    lines.extend(
        [
            "",
            "| Market | Actual | Open | Close | Adjusted close | Exact Jodi | 3x3 grid | Source |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
        ]
    )
    for row in scored:
        hit = lambda name: "hit" if row["hits"][name] else "miss"
        lines.append(
            f'| {row["market"]} | {row["actual"]["jodi"]} | {hit("open")} | '
            f'{hit("close")} | {hit("adjustedClose")} | {hit("exactJodi")} | '
            f'{hit("jodiGrid")} | [chart]({row["sourceUrl"]}) |'
        )
    lines.extend(
        [
            "",
            "This small independent-source check reinforces the rejection decision; it does not qualify as a sealed forward test because the registry file was created after the target date.",
            "",
        ]
    )
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"totals": totals, "scored": len(scored)}, indent=2))
    print(f"Saved {OUTPUT}")
    print(f"Saved {REPORT}")


if __name__ == "__main__":
    main()
