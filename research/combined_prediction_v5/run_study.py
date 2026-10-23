"""Market-separated 500-candidate study with frozen future evaluation."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import os
from pathlib import Path
import sys

for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[variable] = "1"
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent / "combined_prediction_v3"))
from study import Replay  # noqa: E402
import numpy as np  # noqa: E402
from scipy.stats import binomtest  # noqa: E402
import fusion_candidates  # noqa: E402
import method_candidates  # noqa: E402
import pattern_candidates  # noqa: E402

CHANNELS = ("open", "close_pre", "close_known")
ENDPOINTS = ("all10", "sp30", "dp20")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name: str, value: object) -> None:
    (HERE/name).write_text(json.dumps(value, indent=2, allow_nan=False)+"\n", encoding="utf-8")


def load_replay(fresh: bool = False):
    replay = Replay()
    directory = HERE.parent / "combined_prediction_v3"
    raw = gzip.decompress((directory/"fresh_replay.jsonl.gz").read_bytes())
    meta = json.loads((directory/"fresh_replay_metadata.json").read_text())
    if hashlib.sha256(raw).hexdigest() != meta["sha256"]:
        raise ValueError("V3 replay hash mismatch")
    replay = Replay.from_rows(replay.rows + [json.loads(line) for line in raw.splitlines()])
    if not fresh:
        return replay
    raw = gzip.decompress((HERE/"fresh_replay.jsonl.gz").read_bytes())
    metadata = json.loads((HERE/"fresh_replay_metadata.json").read_text())
    if hashlib.sha256(raw).hexdigest() != metadata["sha256"]:
        raise ValueError("Fresh replay hash mismatch")
    return Replay.from_rows(replay.rows + [json.loads(line) for line in raw.splitlines()])


def stream_candidates(replay, channel: str, baseline: np.ndarray, bank):
    yield {"id": "production", "family": "baseline", "mechanism": "Exact current production policy"}, baseline
    yield from pattern_candidates.candidates(replay, channel, baseline, bank)
    for metadata, probabilities in method_candidates.candidates(replay, channel, baseline):
        yield {**metadata, "mechanism_family": metadata["family"], "family": "methods"}, probabilities
    yield from fusion_candidates.candidates(replay, channel, baseline)


def masks(replay) -> dict[str, np.ndarray]:
    return {"development": replay.dates <= "2026-08-16",
            "validation": (replay.dates >= "2026-08-17") & (replay.dates <= "2026-09-07"),
            "september_reused": (replay.dates >= "2026-09-08") & (replay.dates <= "2026-09-30"),
            "october_reused": (replay.dates >= "2026-10-01") & (replay.dates <= "2026-10-15"),
            "oct16_17_reused": (replay.dates >= "2026-10-16") & (replay.dates <= "2026-10-17"),
            "fresh": replay.dates >= "2026-10-18"}


def stats(baseline: np.ndarray, hits: np.ndarray, eligible: np.ndarray, use: np.ndarray) -> dict:
    use = use & eligible
    n = int(use.sum())
    wins = int((hits & ~baseline & use).sum())
    losses = int((baseline & ~hits & use).sum())
    return {"n": n, "baseline_hits": int(baseline[use].sum()), "candidate_hits": int(hits[use].sum()),
            "lift_pp": 100*(wins-losses)/n if n else None,
            "wins": wins, "losses": losses,
            "paired_p": float(binomtest(wins, wins+losses).pvalue) if wins+losses else 1.0}


def choose(hits: np.ndarray, eligible: np.ndarray, replay, scope: np.ndarray) -> int:
    blocks = masks(replay)
    dev, val = scope & blocks["development"] & eligible, scope & blocks["validation"] & eligible
    if dev.sum() < 15 or val.sum() < 8:
        return 0
    # Reject negative development lift and require a gain in both validation halves.
    early = val & (replay.dates <= "2026-08-27")
    late = val & (replay.dates >= "2026-08-28")
    gain = hits.astype(int)-hits[0].astype(int)
    eligible_ids = [0] + [i for i in range(1, len(hits)) if gain[i, dev].sum() >= 0
                         and gain[i, early].sum() > 0 and gain[i, late].sum() > 0]
    return min(eligible_ids, key=lambda i: (-int(hits[i, val].sum()), i != 0,
                                          -int(hits[i, dev].sum()), i))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fresh", action="store_true")
    args = parser.parse_args()
    if not args.fresh and (HERE/"selection_manifest.json").exists():
        raise ValueError("Selections are already frozen. Use --fresh or a new study folder.")
    replay = load_replay(args.fresh)
    blocks = masks(replay)
    market_names = sorted(set(replay.markets))
    scopes = {"ALL": np.ones(len(replay.rows), dtype=bool), **{m: replay.markets == m for m in market_names}}
    selections = [] if not args.fresh else json.loads((HERE/"selection.json").read_text())
    if args.fresh:
        manifest = json.loads((HERE/"selection_manifest.json").read_text())
        for name, expected in manifest["files"].items():
            if digest(HERE/name) != expected:
                raise ValueError(f"Frozen study file changed: {name}")
    summaries, catalog = [], None
    cache = {}
    output_name = "fresh_candidate_metrics.csv.gz" if args.fresh else "candidate_metrics.csv.gz"
    with gzip.open(HERE/output_name, "wt", encoding="utf-8", newline="") as handle:
        writer = None
        for channel in CHANNELS:
            bank = pattern_candidates.build_sources(replay, channel)
            for endpoint in ENDPOINTS:
                baseline = replay.endpoint_probs(channel, endpoint)
                actual = replay.actual(channel)
                base_hits, eligible = replay.panel_hits(channel, baseline)[endpoint]
                base_derived = replay.derived_hits(channel, baseline) if endpoint == "sp30" else {}
                all_hits, ids, metadata_list, fingerprints = [], [], [], set()
                for metadata, probs in stream_candidates(replay, channel, baseline, bank):
                    if probs.shape != baseline.shape or not np.isfinite(probs).all() or not (probs > 0).all():
                        raise ValueError(f"Invalid candidate probabilities: {metadata}")
                    np.testing.assert_allclose(probs.sum(axis=1), 1, atol=1e-10)
                    hits, _ = replay.panel_hits(channel, probs)[endpoint]
                    all_hits.append(hits)
                    ids.append(metadata["id"])
                    metadata_list.append(metadata)
                    fingerprints.add(hashlib.sha256(np.round(probs, 12).tobytes()).hexdigest())
                    loss = -np.log(probs[np.arange(len(actual)), actual])
                    true_p = probs[np.arange(len(actual)), actual]
                    brier = (probs*probs).sum(axis=1)-2*true_p+1
                    derived = replay.derived_hits(channel, probs) if endpoint == "sp30" else {}
                    for scope_name, scope in scopes.items():
                        for block_name, block in blocks.items():
                            if args.fresh != (block_name == "fresh"):
                                continue
                            use = scope & block
                            if not use.any():
                                continue
                            row = {"channel": channel, "endpoint": endpoint, "candidate": metadata["id"],
                                   "family": metadata["family"], "market": scope_name, "block": block_name,
                                   **stats(base_hits, hits, eligible, use),
                                   "probability_n": int(use.sum()), "log_loss": float(loss[use].mean()),
                                   "brier": float(brier[use].mean())}
                            for task in ("sutta6", "present2", "absent2"):
                                row[task+"_hits"] = int(derived[task][use].sum()) if derived else ""
                                row[task+"_baseline_hits"] = int(base_derived[task][use].sum()) if derived else ""
                            if writer is None:
                                writer = csv.DictWriter(handle, fieldnames=list(row))
                                writer.writeheader()
                            writer.writerow(row)
                if len(ids) != 501 or len(set(ids)) != 501:
                    raise ValueError(f"Expected production +500 unique candidate IDs, got {len(ids)}")
                if catalog is None:
                    catalog = metadata_list
                    families = {f: sum(m["family"] == f for m in catalog) for f in {m["family"] for m in catalog}}
                    if sorted(v for k, v in families.items() if k != "baseline") != [100]*5:
                        raise ValueError(f"Invalid catalogue counts: {families}")
                matrix = np.array(all_hits)
                key = channel+"__"+endpoint
                cache[key] = matrix
                cache[key+"__eligible"] = eligible
                for scope_name, scope in scopes.items():
                    if not args.fresh:
                        selected = choose(matrix, eligible, replay, scope)
                        selections.append({"channel": channel, "endpoint": endpoint, "market": scope_name,
                                           "candidate": ids[selected], "index": selected})
                    else:
                        entry = next(s for s in selections if (s["channel"],s["endpoint"],s["market"]) == (channel,endpoint,scope_name))
                        selected = ids.index(entry["candidate"])
                    summaries.append({"channel": channel, "endpoint": endpoint, "market": scope_name,
                                      "candidate": ids[selected], "unique_distributions": len(fingerprints),
                                      "blocks": {name: stats(base_hits, matrix[selected], eligible, scope & mask)
                                                 for name, mask in blocks.items() if mask.any()}})
                print(f"Scored {channel}/{endpoint}: {len(ids)-1} variants, {len(fingerprints)} distinct distributions", flush=True)
    if not args.fresh:
        save("catalogue.json", catalog)
        save("selection.json", selections)
        sources = ["run_study.py", "fusion_candidates.py", "method_candidates.py", "pattern_candidates.py", "protocol.json", "catalogue.json", "selection.json"]
        hashes = {name: digest(HERE/name) for name in sources}
        save("selection_manifest.json", {"files": hashes, "selectionSHA256": hashes["selection.json"],
                                         "protocolSHA256": hashes["protocol.json"],
                                         "fresh_outcomes_not_requested_yet": True})
    save("fresh_results.json" if args.fresh else "results.json",
         {"rows": len(replay.rows), "markets": market_names, "date_range": [str(replay.dates[0]), str(replay.dates[-1])],
          "selectionSHA256": digest(HERE/"selection.json"), "summaries": summaries})
    np.savez_compressed(HERE/("fresh_hits.npz" if args.fresh else "hits.npz"),
                        dates=replay.dates, markets=replay.markets, **cache)


if __name__ == "__main__":
    main()
