"""Export retrospective, fixed-recipe endpoint evidence and parity fixtures."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RESEARCH = HERE.parent
RECIPES = (
    ("Sridevi", "open", "avoid2", "absent2", 255),
    ("Sridevi", "open", "panel10", "all10", 244),
    ("Sridevi", "open", "sp30", "sp30", 255),
    ("Sridevi", "open", "dp20", "dp20", 255),
    ("Rajdhani Night", "close_pre", "sp30", "sp30", 266),
)
BLOCKS = {
    "development": ("2026-07-04", "2026-08-16"),
    "validation": ("2026-08-17", "2026-09-07"),
    "weight_train": ("2026-09-08", "2026-09-30"),
    "weight_validation": ("2026-10-01", "2026-10-15"),
    "late_reused": ("2026-10-16", "2026-10-22"),
    "november_reused": ("2026-10-23", "2026-11-01"),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main() -> None:
    spec = importlib.util.spec_from_file_location("release_v7", RESEARCH / "combined_prediction_v7/run_study.py")
    if spec is None or spec.loader is None:
        raise ImportError("V7 runner unavailable")
    runner = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runner
    spec.loader.exec_module(runner)
    replay = runner.load_replay()
    catalogue = json.loads((RESEARCH / "combined_prediction_v7/catalogues.json").read_text())
    v8_catalogue = json.loads((RESEARCH / "combined_prediction_v8/catalogues.json").read_text())
    source_paths = [
        "combined_prediction_v8/hits.npz", "combined_prediction_v8/catalogues.json",
        "combined_prediction_v8/audit_manifest.json", "combined_prediction_v7/hits.npz",
        "combined_prediction_v7/catalogues.json", "combined_prediction_v7/experts.py",
        "combined_prediction_v6/candidates.py", "combined_prediction_v3/study.py",
        "combined_prediction_v1/replay.jsonl.gz",
        "combined_prediction_v1/replay_metadata.json", "combined_prediction_v2/extension_replay.jsonl.gz",
        "combined_prediction_v2/extension_replay_metadata.json",
        "combined_prediction_v3/fresh_replay.jsonl.gz", "combined_prediction_v5/fresh_replay.jsonl.gz",
        "combined_prediction_v6/extension_replay.jsonl.gz",
    ]
    # Replay's base filename is owned by its frozen protocol, not guessed here.
    source_paths = [p for p in source_paths if (RESEARCH / p).exists()]
    source_hashes = {"research/" + p: digest(RESEARCH / p) for p in source_paths}
    picks: dict[tuple[str, int], dict] = {}
    base: dict[str, dict] = {}
    base_probabilities: dict[str, np.ndarray] = {}
    for channel in ("open", "close_pre"):
        wanted = {r[4] for r in RECIPES if r[1] == channel}
        bank = runner.experts.build_bank(replay, channel)
        for index, (metadata, probabilities) in enumerate(runner.experts.candidates(replay, channel, bank), 1):
            if index in wanted:
                if metadata["id"] != catalogue[channel]["experts"][index]["id"]:
                    raise ValueError("Expert index/catalogue mismatch")
                picks[channel, index] = runner.picks(replay, probabilities)
            if index >= max(wanted):
                break
        base_probabilities[channel] = replay.endpoint_probs(channel, "sp30")
        base[channel] = runner.baseline_picks(replay, channel)
    evidence = []
    recipes = []
    with np.load(RESEARCH / "combined_prediction_v8/hits.npz", allow_pickle=False) as archive:
        if not np.array_equal(archive["dates"], replay.dates) or not np.array_equal(archive["markets"], replay.markets):
            raise ValueError("V8 archive alignment differs")
        for market, channel, metric, field, index in RECIPES:
            metadata = catalogue[channel]["experts"][index]
            source_id = "expert/" + metadata["id"]
            v8_index = next(i for i, value in enumerate(v8_catalogue["sources"][channel]) if value["id"] == source_id)
            reference = runner.hits(replay, channel, base[channel])[metric]
            candidate = runner.hits(replay, channel, picks[channel, index])[metric]
            np.testing.assert_array_equal(candidate, archive[f"{channel}__{metric}"][v8_index])
            np.testing.assert_array_equal(reference, archive[f"{channel}__{metric}"][0])
            stats = {}
            for name, (start, end) in BLOCKS.items():
                mask = (replay.markets == market) & (replay.dates >= start) & (replay.dates <= end) & runner.eligibility(replay, channel)[metric]
                old, new = int(reference[mask].sum()), int(candidate[mask].sum())
                stats[name] = {"n": int(mask.sum()), "baselineHits": old, "candidateHits": new, "netHits": new - old}
                if name in ("weight_train", "weight_validation", "late_reused", "november_reused") and new < old:
                    raise ValueError(f"Regression: {market}/{channel}/{metric}/{name}")
            if stats["november_reused"]["netHits"] <= 0:
                raise ValueError("Latest audit must improve")
            recipes.append({"market": market, "channel": channel, "field": field, "expertIndex": index, "id": metadata["id"], "parameters": metadata["parameters"], "v8SourceIndex": v8_index})
            evidence.append({**recipes[-1], "blocks": stats})
    cases = []
    for row_index, row in enumerate(replay.rows):
        market, date = row["market"], row["date"]
        if not "2026-09-08" <= date <= "2026-11-01" or market not in ("Sridevi", "Rajdhani Night"):
            continue
        channel = "open" if market == "Sridevi" else "close_pre"
        expected, baseline = {}, {}
        for recipe_market, recipe_channel, metric, field, index in RECIPES:
            if (recipe_market, recipe_channel) != (market, channel):
                continue
            for target, source in ((expected, picks[channel, index]), (baseline, base[channel])):
                values = source[metric][row_index]
                target[field] = values.tolist() if metric == "avoid2" else [replay.panels[int(i)] for i in values]
        history = [{"date": old["date"], "openPanel": old["actualOpen"], "closePanel": old["actualClose"]}
                   for old in replay.rows if old["market"] == market and old["date"] < date]
        cases.append({"date": date, "market": market, "channel": channel, "expected": expected,
                      "baseline": baseline, "baseSP30": base_probabilities[channel][row_index].tolist(), "history": history})
    metadata = {"selectionType": "new_posthoc_fixed_presets", "freshConfirmation": False,
                "supportedAnalysisStartDate": "2026-09-08",
                "earlierAnalyses": "Production leaves earlier analysis dates unchanged; earlier evidence below describes the unguarded formula only.",
                "historyStartDate": str(min(replay.dates)), "historyRule": "Only prior complete market draws; exclude the entire target date",
                "rankingRule": "Round probabilities and pair masses to 12 decimals; stable original panel order and lexicographic digit pairs",
                "sourceHashes": source_hashes, "recipes": recipes}
    write_json(HERE / "evidence.json", {**metadata, "evidence": evidence, "fixtureCases": len(cases)})
    write_json(ROOT / "scripts/fixtures/combined-selective-endpoints.json", {**metadata, "panelOrder": list(replay.panels), "cases": cases})
    print(json.dumps({"cases": len(cases), "recipes": len(recipes), "status": "pass"}))


if __name__ == "__main__":
    main()
