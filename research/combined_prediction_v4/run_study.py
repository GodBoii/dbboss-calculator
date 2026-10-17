"""Research-only causal probability shrinkage. All outputs stay beside this file."""
from __future__ import annotations

import csv
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / "combined_prediction_v3"))

import numpy as np
from study import Replay, paired, softmax

CHANNELS = ("open", "close_pre", "close_known")
ENDPOINTS = ("all10", "sp30", "dp20")


def write_json(name: str, value: object) -> None:
    (HERE / name).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot() -> dict[str, str]:
    """Include dirty/untracked existing files, excluding only our output folder and caches."""
    raw = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT)
    paths = set(raw.decode().split("\0")) - {""}
    return {name: digest(ROOT / name) for name in sorted(paths)
            if not name.startswith("research/combined_prediction_v4/") and (ROOT / name).is_file()}


def load_replay() -> Replay:
    base = Replay()
    directory = HERE.parent / "combined_prediction_v3"
    raw = gzip.decompress((directory / "fresh_replay.jsonl.gz").read_bytes())
    meta = json.loads((directory / "fresh_replay_metadata.json").read_text())
    if hashlib.sha256(raw).hexdigest() != meta["sha256"]:
        raise ValueError("V3 replay hash mismatch")
    return Replay.from_rows(base.rows + [json.loads(line) for line in raw.splitlines()])


def causal_prior(replay: Replay, channel: str, *, local: bool) -> np.ndarray:
    """Predict every market on a date before adding any outcomes from that date.

    Global Dirichlet prior has total mass 220. Local histories have mass 100
    centered on the strictly previous-date global distribution. No fit on labels
    from the current day, including for close_known.
    """
    actual = replay.actual(channel)
    global_counts = np.ones(220)
    local_counts: dict[str, np.ndarray] = {}
    output = np.empty((len(actual), 220))
    for day in np.unique(replay.dates):
        indices = np.flatnonzero(replay.dates == day)
        global_prior = global_counts / global_counts.sum()
        for i in indices:
            market = str(replay.markets[i])
            counts = local_counts.setdefault(market, np.zeros(220))
            output[i] = (counts + 100 * global_prior) / (counts.sum() + 100) if local else global_prior
        for i in indices:
            global_counts[actual[i]] += 1
            local_counts[str(replay.markets[i])][actual[i]] += 1
    return output


def candidates(replay: Replay, channel: str, endpoint: str) -> dict[str, np.ndarray]:
    base = replay.endpoint_probs(channel, endpoint)
    output = {"production": base}
    for temperature in (0.5, 2.0, 4.0):
        output[f"temperature={temperature:g}"] = softmax(np.log(base) / temperature)
    sources = {
        "uniform": np.full_like(base, 1 / 220),
        "prior_global": causal_prior(replay, channel, local=False),
        "prior_market": causal_prior(replay, channel, local=True),
        "raw": softmax(replay.channels[channel]["logits"]),
        "endpoint_mean": np.mean([replay.endpoint_probs(channel, name) for name in ENDPOINTS], axis=0),
    }
    for name, source in sources.items():
        for fraction in (0.25, 0.5, 0.75, 1.0):
            output[f"{name}:{fraction:g}"] = (1 - fraction) * base + fraction * source
    return output


def losses(replay: Replay, channel: str, probs: np.ndarray, mask: np.ndarray) -> dict:
    actual = replay.actual(channel)
    true_p = probs[np.arange(len(actual)), actual]
    return {"log_loss": float(-np.log(true_p[mask]).mean()),
            "brier": float((np.square(probs).sum(axis=1) - 2 * true_p + 1)[mask].mean())}


def verify(replay: Replay) -> dict:
    # Changing all outcomes on/after a cutoff must leave predictions through that
    # day exactly unchanged. The cutoff day is included to detect within-day leaks.
    cutoff = "2026-09-08"
    mutated = Replay.from_rows(replay.rows)
    mutated.actual_open = replay.actual_open.copy()
    mutated.actual_close = replay.actual_close.copy()
    for channel in CHANNELS:
        target = mutated.actual_open if channel == "open" else mutated.actual_close
        target[replay.dates >= cutoff] = (replay.actual(channel)[replay.dates >= cutoff] + 17) % 220
        for local in (False, True):
            before = causal_prior(replay, channel, local=local)
            after = causal_prior(mutated, channel, local=local)
            np.testing.assert_array_equal(before[replay.dates <= cutoff], after[replay.dates <= cutoff])
    parity = json.loads((HERE / "parity_production.json").read_text())
    for name, expected in parity["productionSourceHashes"].items():
        if digest(ROOT / name) != expected:
            raise ValueError(f"Stale parity source: {name}")
    samples = 0
    for sample in parity["samples"].values():
        i = next(i for i, row in enumerate(replay.rows) if row["date"] == sample["date"] and row["market"] == sample["market"])
        for channel, key in (("open", "open"), ("close_pre", "closePre"), ("close_known", "closeKnown")):
            if sample[key] is None:
                continue
            for endpoint, public, kind, count in (("all10", "panelPicks", "all", 10), ("sp30", "spPicks", "SP", 30), ("dp20", "dpPicks", "DP", 20)):
                p = replay.endpoint_probs(channel, endpoint)
                allowed = np.arange(220) if kind == "all" else np.flatnonzero(replay.kind == kind)
                order = allowed[np.argsort(-p[i, allowed], kind="stable")[:count]]
                if [replay.panels[j] for j in order] != sample[key][public]:
                    raise ValueError(f"Production parity failed: {sample['market']}/{channel}/{endpoint}")
                samples += 1
    return {"causality": "pass", "same_day_labels_excluded": True, "production_list_comparisons": samples}


def main() -> None:
    before = snapshot()
    replay = load_replay()
    checks = verify(replay)
    development = replay.dates <= "2026-08-16"
    validation = (replay.dates >= "2026-08-17") & (replay.dates <= "2026-09-07")
    blocks = {
        "september": (replay.dates >= "2026-09-08") & (replay.dates <= "2026-09-30"),
        "october": (replay.dates >= "2026-10-01") & (replay.dates <= "2026-10-15"),
        "oct16_17_reused": replay.dates >= "2026-10-16",
    }
    selection, search, selected = [], [], {}
    for channel in CHANNELS:
        for endpoint in ENDPOINTS:
            pool = candidates(replay, channel, endpoint)
            for label, probs in pool.items():
                np.testing.assert_allclose(probs.sum(axis=1), 1, atol=1e-12)
                if not (np.isfinite(probs).all() and (probs > 0).all()):
                    raise ValueError(f"Invalid probabilities: {label}")
                # Pure temperature changes must preserve every panel ranking.
                if label.startswith("temperature"):
                    np.testing.assert_array_equal(np.argsort(-probs, axis=1, kind="stable"), np.argsort(-pool["production"], axis=1, kind="stable"))
            hit_arrays = {label: replay.panel_hits(channel, p)[endpoint] for label, p in pool.items()}
            base_hits, eligible = hit_arrays["production"]
            scores = {}
            for label, probs in pool.items():
                hits, _ = hit_arrays[label]
                scores[label] = {
                    "development_hits": int(hits[development].sum()),
                    "validation_hits": int(hits[validation].sum()),
                    "development_loss": losses(replay, channel, probs, development)["log_loss"],
                    "validation_loss": losses(replay, channel, probs, validation)["log_loss"],
                }
                search.append({"channel": channel, "endpoint": endpoint, "candidate": label, **scores[label]})
            for objective in ("hits", "log_loss"):
                if objective == "hits":
                    survivors = [label for label in pool if scores[label]["development_hits"] >= scores["production"]["development_hits"]]
                    label = min(survivors, key=lambda name: (-scores[name]["validation_hits"], name != "production", -scores[name]["development_hits"], name))
                else:
                    survivors = [label for label in pool if scores[label]["development_loss"] <= scores["production"]["development_loss"] + 1e-12]
                    label = min(survivors, key=lambda name: (scores[name]["validation_loss"], name != "production", name))
                key = f"{channel}/{endpoint}/{objective}"
                selection.append({"key": key, "candidate": label, **scores[label]})
                selected[key] = (channel, endpoint, pool["production"], pool[label], eligible)
            print(f"Selected {channel}/{endpoint}", flush=True)
    write_json("selection.json", selection)
    selection_hash = digest(HERE / "selection.json")
    with (HERE / "search.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(search[0]))
        writer.writeheader()
        writer.writerows(search)
    results = []
    for entry in selection:
        channel, endpoint, baseline, challenger, eligible = selected[entry["key"]]
        base_hits, _ = replay.panel_hits(channel, baseline)[endpoint]
        candidate_hits, _ = replay.panel_hits(channel, challenger)[endpoint]
        result = {**entry, "blocks": {}}
        for block, mask in blocks.items():
            result["blocks"][block] = {
                **paired(replay, base_hits, candidate_hits, eligible, mask),
                "baseline_probability": losses(replay, channel, baseline, mask),
                "candidate_probability": losses(replay, channel, challenger, mask),
            }
        # Derived outputs always use sp30 in the app. Report these only there.
        if endpoint == "sp30":
            result["derived"] = {}
            for task, base_array in replay.derived_hits(channel, baseline).items():
                candidate_array = replay.derived_hits(channel, challenger)[task]
                result["derived"][task] = {block: paired(replay, base_array, candidate_array, np.ones(len(replay.rows), dtype=bool), mask)
                                            for block, mask in blocks.items()}
        results.append(result)
    write_json("results.json", {"rows": len(replay.rows), "markets": len(set(replay.markets)),
                              "dates": [str(replay.dates[0]), str(replay.dates[-1])],
                              "candidate_distributions": len(search), "selection_sha256": selection_hash,
                              "blocks": {k: int(v.sum()) for k, v in blocks.items()}, "items": results})
    after = snapshot()
    if before != after:
        raise ValueError("A file outside this research folder changed during the study")
    write_json("verification.json", {**checks, "all_candidate_probabilities": "pass", "temperature_rank_invariance": "pass",
                                     "external_files_unchanged": True, "external_file_count": len(before),
                                     "selection_sha256": selection_hash,
                                     "python": sys.version, "numpy": np.__version__})
    write_json("input_manifest.json", {"external_files": before,
        "limitations": ["All dates were inspected in previous research; no fresh confirmatory holdout.",
                        "Prior counts start July 4, not the model's full historical training window.",
                        "Probability metrics use all 220 panels; SP/DP hit rates condition on the actual type.",
                        "Frozen upstream models were not refitted; causal selection cannot remove their historical selection bias.",
                        "Individual paired p-values are exploratory and uncorrected for multiple selection."]})
    print(f"PASS: {len(replay.rows)} events, {len(search)} candidate distributions, {checks['production_list_comparisons']} parity comparisons")


if __name__ == "__main__":
    main()
