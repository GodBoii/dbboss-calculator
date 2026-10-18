"""Freeze research-only next-observed-result calls and score them without refitting.

Initialize once: python research/present_digits_v3/forward.py init
Score new complete chart rows: python research/present_digits_v3/forward.py score --input rows.csv
The CSV schema is date,market,open,close, matching the tracked source snapshots.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import run_study as study

REGISTRY = study.HERE / "forward_registry.json"
MODEL = "pool_all_75"


def freeze(markets: dict[str, list[dict[str, str]]]) -> dict:
    observed_through = max(row["date"] for rows in markets.values() for row in rows)
    target = (date.fromisoformat(observed_through) + timedelta(days=1)).isoformat()
    pool = study.histories(markets)
    counts, n = pool["all"].counts(target)
    prior = (counts + 1) / (n + 20)
    calls = []
    for market, rows in sorted(markets.items()):
        history = [row for row in rows if study.previous.cutoff(target) <= row["date"] < target]
        if len(history) < 180:
            continue
        for side in ("open", "close"):
            base = (np.array([study.panel_pairs(row[side]) for row in history[-180:]]).sum(axis=0) + 1) / 200
            scores = 0.25 * base + 0.75 * prior
            candidate, baseline = int(scores.argmax()), int(base.argmax())
            calls.append({"market": market, "side": side, "historyEnds": history[-1]["date"],
                          "candidatePair": list(study.PAIRS[candidate]), "baselinePair": list(study.PAIRS[baseline]),
                          "candidateScore": float(scores[candidate])})
    return {"model": MODEL, "observedThrough": observed_through,
            "target": "First subsequently observed complete panel row per market, strictly after observedThrough.",
            "status": "RESEARCH_ONLY", "calls": calls}


def load_csv(paths: list[Path]) -> tuple[dict[str, list[dict[str, str]]], list[dict]]:
    markets: dict[str, dict[str, dict[str, str]]] = {}
    manifest = []
    for path in paths:
        with path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            if not {"date", "market", "open", "close"}.issubset(reader.fieldnames or []):
                raise ValueError(f"Missing date,market,open,close columns in {path}")
            for raw in reader:
                row = {key: raw[key] for key in ("date", "market", "open", "close")}
                if date.fromisoformat(row["date"]).isoformat() != row["date"] or not row["market"]:
                    raise ValueError(f"Invalid market/date in {path}: {row}")
                if any(len(row[side]) != 3 or any(c not in "0123456789" for c in row[side])
                       for side in ("open", "close")):
                    raise ValueError(f"Invalid complete panel row in {path}: {row}")
                dates = markets.setdefault(row["market"], {})
                previous = dates.get(row["date"])
                if previous is not None and previous != row:
                    raise ValueError(f"Conflicting market/date in {path}: {row}")
                dates[row["date"]] = row
        manifest.append({"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    return {market: [rows[key] for key in sorted(rows)] for market, rows in markets.items()}, manifest


def score(registry: dict, markets: dict[str, list[dict[str, str]]]) -> dict:
    if registry["model"] != MODEL or registry["status"] != "RESEARCH_ONLY":
        raise ValueError("This scorer accepts only the frozen research pool_all_75 model")
    rows = []
    for call in registry["calls"]:
        for key in ("candidatePair", "baselinePair"):
            pair = call[key]
            if len(pair) != 2 or any(type(digit) is not int or not 0 <= digit <= 9 for digit in pair) or pair[0] >= pair[1]:
                raise ValueError("Invalid frozen digit pair")
        if call["side"] not in ("open", "close"):
            raise ValueError("Invalid frozen panel side")
        future = sorted((row for row in markets.get(call["market"], [])
                         if row["date"] > registry["observedThrough"]), key=lambda row: row["date"])
        item = {"market": call["market"], "side": call["side"], "status": "PENDING"}
        if future:
            actual = future[0]
            panel = actual[call["side"]]
            item.update({"status": "SCORED", "date": actual["date"], "actualPanel": panel,
                         "candidateHit": all(str(digit) in panel for digit in call["candidatePair"]),
                         "baselineHit": all(str(digit) in panel for digit in call["baselinePair"])})
        rows.append(item)
    scored = [row for row in rows if row["status"] == "SCORED"]
    return {"model": MODEL, "observedThrough": registry["observedThrough"], "scored": len(scored),
            "pending": len(rows) - len(scored), "candidateHits": sum(row["candidateHit"] for row in scored),
            "baselineHits": sum(row["baselineHit"] for row in scored), "calls": rows}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("init", "score"))
    parser.add_argument("--input", type=Path, action="append", help="Complete CSV rows for scoring; repeat for multiple files")
    args = parser.parse_args()
    if args.action == "init":
        if args.input:
            parser.error("init uses the study's frozen source snapshots; --input is for scoring")
        result = json.loads((study.HERE / "results.json").read_text(encoding="utf-8"))
        if result["selectedChallenger"] != MODEL:
            raise ValueError("The selected model differs from the frozen forward model")
        markets, manifest = study.previous.load_rows()
        registry = freeze(markets)
        registry.update({"frozenAtUTC": datetime.now(timezone.utc).isoformat(), "sources": manifest,
                         "studyResultsSHA256": study.text_sha256(study.HERE / "results.json"),
                         "note": "Offline observation only. Promotion checks did not pass; production remains unchanged."})
        with REGISTRY.open("x", encoding="utf-8") as handle:
            handle.write(json.dumps(registry, indent=2) + "\n")
        print(json.dumps({"registry": str(REGISTRY), "calls": len(registry["calls"]), "observedThrough": registry["observedThrough"]}))
    else:
        registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
        if args.input:
            markets, manifest = load_csv(args.input)
        else:
            markets, manifest = study.previous.load_rows()
        result = score(registry, markets)
        result.update({"registrySHA256": study.text_sha256(REGISTRY), "scoreSources": manifest})
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
