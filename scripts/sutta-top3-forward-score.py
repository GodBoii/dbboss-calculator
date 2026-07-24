"""Score the frozen research registry when new isolated-cache rows appear."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FEATURE_PATH = ROOT / "scripts" / "sutta-model-research.py"
REGISTRY = ROOT / "scratch" / "sutta-top3-forward-registry-20260715.json"
DEFAULT_CACHE = ROOT / "scratch" / "sutta-top3-forward-cache-20260715.json"
OUTPUT = ROOT / "scratch" / "sutta-top3-forward-score-20260715.json"
REPORT = ROOT / "backtest_reports" / "2026-07-15" / "sutta-top3-forward-registry-status.md"


def load_features():
    spec = importlib.util.spec_from_file_location("sutta_forward_score_features", FEATURE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import {FEATURE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


F = load_features()


def empty_metric() -> dict[str, int]:
    return {"calls": 0, "hits": 0}


def main() -> None:
    cache = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_CACHE
    if not cache.exists():
        raise FileNotFoundError(cache)
    F.CACHE = cache
    rows_by_market = F.load_rows()
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    totals = {name: empty_metric() for name in ("open", "close", "adjustedClose", "exactJodi", "jodiGrid")}
    scored: list[dict[str, Any]] = []
    pending = []

    for registration in registry["registrations"]:
        market = registration["market"]
        target = next((row for row in rows_by_market[market] if row.iso == registration["targetDate"]), None)
        if target is None:
            pending.append({"market": market, "targetDate": registration["targetDate"]})
            continue
        actual_jodi = f"{target.open}{target.close}"
        adjusted_picks = registration["adjustedCloseByKnownOpen"]["picks"][str(target.open)]
        hits = {
            "open": target.open in registration["open"]["picks"],
            "close": target.close in registration["close"]["picks"],
            "adjustedClose": target.close in adjusted_picks,
            "exactJodi": actual_jodi in registration["exactJodi"]["picks"],
            "jodiGrid": actual_jodi in registration["jodiGrid"]["picks"],
        }
        for name, hit in hits.items():
            totals[name]["calls"] += 1
            totals[name]["hits"] += int(hit)
        scored.append({
            "market": market,
            "targetDate": target.iso,
            "actual": {"open": target.open, "close": target.close, "jodi": actual_jodi},
            "adjustedClosePicks": adjusted_picks,
            "hits": hits,
        })

    for value in totals.values():
        value["accuracy"] = round(100 * value["hits"] / value["calls"], 3) if value["calls"] else None
    payload = {
        "schemaVersion": 1,
        "registry": str(REGISTRY.relative_to(ROOT)).replace("\\", "/"),
        "scoreCache": str(cache),
        "totals": totals,
        "scored": scored,
        "pending": pending,
    }
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Top-3 Forward Registry Status",
        "",
        f'Scored registrations: {len(scored)}. Pending source rows: {len(pending)}.',
        "",
        "| Target | Hits | Calls | Accuracy |",
        "| --- | ---: | ---: | ---: |",
    ]
    for name, value in totals.items():
        accuracy = "pending" if value["accuracy"] is None else f'{value["accuracy"]:.1f}%'
        lines.append(f'| {name} | {value["hits"]} | {value["calls"]} | {accuracy} |')
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
