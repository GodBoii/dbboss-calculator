"""Independent selection, panel-ranking, source-integrity, and causality audit.

Historical upstream features are treated as frozen inputs. Label perturbation
checks the new 500 candidates, not historical fitting decisions upstream.
"""
from __future__ import annotations

import copy
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import run_study as study5
import numpy as np

HERE, ROOT = study5.HERE, study5.ROOT


def read(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def independent_choice(matrix, eligible, dates, scope) -> int:
    dev = eligible & scope & (dates <= "2026-08-16")
    val = eligible & scope & (dates >= "2026-08-17") & (dates <= "2026-09-07")
    if dev.sum() < 15 or val.sum() < 8:
        return 0
    early, late = val & (dates <= "2026-08-27"), val & (dates >= "2026-08-28")
    scores = matrix.astype(np.int64)
    baseline = scores[0]
    survivors = [0]
    for index in range(1, len(scores)):
        diff = scores[index] - baseline
        if diff[dev].sum() >= 0 and diff[early].sum() > 0 and diff[late].sum() > 0:
            survivors.append(index)
    return min(survivors, key=lambda i: (-int(scores[i, val].sum()), i != 0,
                                         -int(scores[i, dev].sum()), i))


def independent_hits(replay, channel, endpoint, probs):
    kind, count = {"all10": (None, 10), "sp30": ("SP", 30), "dp20": ("DP", 20)}[endpoint]
    allowed = np.arange(220) if kind is None else np.flatnonzero(replay.kind == kind)
    order = np.argsort(-probs[:, allowed], axis=1, kind="stable")[:, :count]
    picks = allowed[order]
    require(np.all(np.diff(np.sort(picks, axis=1), axis=1) > 0), "Duplicate panel picks")
    actual = replay.actual(channel)
    return (picks == actual[:, None]).any(axis=1), np.ones(len(actual), dtype=bool) if kind is None else replay.kind[actual] == kind


def verify_parity(replay) -> int:
    parity_path = HERE / "parity_production.json"
    if not parity_path.exists():
        parity_path = HERE.parent / "combined_prediction_v4/parity_production.json"
    parity = json.loads(parity_path.read_text())
    if parity_path.parent == HERE:
        require(parity["scriptSHA256"] == hash_file(HERE / "parity_check.cjs"), "Parity script changed")
        require(parity["octoberCsvSHA256"] == hash_file(HERE.parent / "combined_prediction_v2/october_rows.csv"),
                "Parity October source changed")
    for name, digest in parity["productionSourceHashes"].items():
        require(hash_file(ROOT / name) == digest, f"Production parity source changed: {name}")
    keys = {(str(day), str(market)): i for i, (day, market) in enumerate(zip(replay.dates, replay.markets))}
    comparisons = 0
    for sample in parity["samples"].values():
        i = keys[sample["date"], sample["market"]]
        for channel, field in (("open", "open"), ("close_pre", "closePre"), ("close_known", "closeKnown")):
            if sample[field] is None:
                continue
            for endpoint, pick_field, kind, count in (("all10", "panelPicks", None, 10),
                                                      ("sp30", "spPicks", "SP", 30),
                                                      ("dp20", "dpPicks", "DP", 20)):
                probs = replay.endpoint_probs(channel, endpoint)[i]
                allowed = np.arange(220) if kind is None else np.flatnonzero(replay.kind == kind)
                chosen = allowed[np.argsort(-probs[allowed], kind="stable")[:count]]
                require([replay.panels[j] for j in chosen] == sample[field][pick_field],
                        f"Production parity failed: {sample['market']}/{channel}/{endpoint}")
                comparisons += 1
    return comparisons


def verify_results(name: str, archive, replay, catalogue, selections) -> int:
    results = read(name)
    require(results["rows"] == len(replay.rows), f"Wrong row count: {name}")
    require(results["selectionSHA256"] == hash_file(HERE / "selection.json"), "Results selection changed")
    require(len(results["summaries"]) == len(selections), "Missing market/endpoint summaries")
    comparisons = 0
    for summary in results["summaries"]:
        entry = next(item for item in selections if all(item[key] == summary[key] for key in ("channel", "endpoint", "market")))
        require(summary["candidate"] == entry["candidate"], "Summary uses an unfrozen selection")
        key = summary["channel"] + "__" + summary["endpoint"]
        matrix, eligible = archive[key], archive[key + "__eligible"]
        scope = np.ones(len(replay.rows), dtype=bool) if summary["market"] == "ALL" else replay.markets == summary["market"]
        for block_name, result in summary["blocks"].items():
            dates = replay.dates
            block = {"development": dates <= "2026-08-16",
                     "validation": (dates >= "2026-08-17") & (dates <= "2026-09-07"),
                     "september_reused": (dates >= "2026-09-08") & (dates <= "2026-09-30"),
                     "october_reused": (dates >= "2026-10-01") & (dates <= "2026-10-15"),
                     "oct16_17_reused": (dates >= "2026-10-16") & (dates <= "2026-10-17"),
                     "fresh": dates >= "2026-10-18"}[block_name]
            used = scope & eligible & block
            baseline, candidate = matrix[0], matrix[entry["index"]]
            expected = {"n": int(used.sum()), "baseline_hits": int(baseline[used].sum()),
                        "candidate_hits": int(candidate[used].sum()),
                        "wins": int((candidate & ~baseline & used).sum()),
                        "losses": int((baseline & ~candidate & used).sum())}
            for field, value in expected.items():
                require(result[field] == value, f"Summary count mismatch {name}/{key}/{field}")
            comparisons += 1
    return comparisons


def main() -> None:
    manifest = read("selection_manifest.json")
    for name, digest in manifest["files"].items():
        require(hash_file(HERE / name) == digest, f"Frozen file changed: {name}")
    require(manifest["selectionSHA256"] == hash_file(HERE / "selection.json"), "Frozen selection changed")
    require(manifest["protocolSHA256"] == hash_file(HERE / "protocol.json"), "Frozen protocol changed")
    catalogue, selections = read("catalogue.json"), read("selection.json")
    require(len(catalogue) == 501 and len({c["id"] for c in catalogue}) == 501, "Expected 500 variants and production")
    counts = Counter(c["family"] for c in catalogue)
    require(sorted(value for key, value in counts.items() if key != "baseline") == [100] * 5, f"Incorrect family counts: {counts}")
    historical = study5.load_replay(False)
    archive = np.load(HERE / "hits.npz", allow_pickle=False)
    require(np.array_equal(archive["dates"], historical.dates), "Historical archive dates differ")
    require(np.array_equal(archive["markets"], historical.markets), "Historical archive markets differ")
    for entry in selections:
        key = entry["channel"] + "__" + entry["endpoint"]
        scope = np.ones(len(historical.rows), dtype=bool) if entry["market"] == "ALL" else historical.markets == entry["market"]
        chosen = independent_choice(archive[key], archive[key + "__eligible"], historical.dates, scope)
        require(entry["index"] == chosen and entry["candidate"] == catalogue[chosen]["id"], "Cannot reconstruct selection")
    summary_checks = verify_results("results.json", archive, historical, catalogue, selections)
    parity_checks = verify_parity(historical)
    has_fresh = (HERE / "fresh_results.json").exists() and (HERE / "fresh_hits.npz").exists()
    replay = study5.load_replay(has_fresh)
    full_archive = np.load(HERE / "fresh_hits.npz", allow_pickle=False) if has_fresh else archive
    if has_fresh:
        summary_checks += verify_results("fresh_results.json", full_archive, replay, catalogue, selections)
        require(np.array_equal(full_archive["dates"], replay.dates), "Fresh dates differ")
        require(np.array_equal(full_archive["markets"], replay.markets), "Fresh markets differ")
        for key in archive.files:
            if key not in ("dates", "markets"):
                actual = full_archive[key][:, :len(historical.rows)] if full_archive[key].ndim == 2 else full_archive[key][:len(historical.rows)]
                require(np.array_equal(actual, archive[key]), f"Fresh run changed historical predictions: {key}")
    if "--fresh-only" in sys.argv:
        require(has_fresh, "Fresh results and hit archive must both exist")
        previous = read("verification.json")
        require(previous["status"] == "pass" and previous["distribution_reconstructions"] == 4509,
                "Complete historical distribution verification is required first")
        previous.update({"total_rows": len(replay.rows), "fresh_verified": True,
                         "fresh_verification_scope": "Frozen selections, source hashes, 108 production lists, all summaries and historical hit-prefix stability. Historical candidate distributions and causality were independently verified previously.",
                         "summary_count_checks": summary_checks})
        (HERE / "verification.json").write_text(json.dumps(previous, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(previous, indent=2), flush=True)
        return
    perturbed_rows = copy.deepcopy(replay.rows)
    cutoff = "2026-09-01"
    for row in perturbed_rows:
        if row["date"] >= cutoff:
            row["actualOpen"] = "111" if row["actualOpen"] != "111" else "222"
            row["actualClose"] = "333" if row["actualClose"] != "333" else "444"
    perturbed = study5.Replay.from_rows(perturbed_rows)
    through = replay.dates <= cutoff
    distribution_checks, causality_checks = 0, 0
    for channel in study5.CHANNELS:
        bank = study5.pattern_candidates.build_sources(replay, channel)
        altered_bank = study5.pattern_candidates.build_sources(perturbed, channel)
        for endpoint in study5.ENDPOINTS:
            baseline = replay.endpoint_probs(channel, endpoint)
            stream = study5.stream_candidates(replay, channel, baseline, bank)
            altered_stream = study5.stream_candidates(perturbed, channel, baseline, altered_bank) if endpoint == "sp30" else None
            for index, (metadata, probs) in enumerate(stream):
                require(metadata["id"] == catalogue[index]["id"], "Catalogue order changed")
                require(np.isfinite(probs).all() and (probs > 0).all(), "Invalid probabilities")
                np.testing.assert_allclose(probs.sum(axis=1), 1, atol=1e-10)
                hits, eligible = independent_hits(replay, channel, endpoint, probs)
                key = channel + "__" + endpoint
                require(np.array_equal(hits, full_archive[key][index]), f"Distribution-hit mismatch {key}/{index}")
                require(np.array_equal(eligible, full_archive[key + "__eligible"]), "Eligibility mismatch")
                distribution_checks += 1
                if altered_stream is not None:
                    altered_metadata, altered_probs = next(altered_stream)
                    require(altered_metadata["id"] == metadata["id"], "Perturbation changed catalogue")
                    require(np.array_equal(probs[through], altered_probs[through]),
                            f"Same-day/future-label leakage: {channel}/{metadata['id']}")
                    causality_checks += 1
            require(index == 500, "Wrong candidate count during reconstruction")
            print(f"Verified {channel}/{endpoint}, 501 distributions", flush=True)
    report = {"status": "pass", "historical_rows": len(historical.rows), "total_rows": len(replay.rows),
              "frozen_selections": len(selections), "family_counts": dict(counts),
              "distribution_reconstructions": distribution_checks, "causality_comparisons": causality_checks,
              "causality_cutoff_inclusive": cutoff, "production_parity_lists": parity_checks,
              "summary_count_checks": summary_checks, "fresh_verified": has_fresh,
              "limitation": "Perturbation verifies new candidate logic with upstream replay features frozen; historical upstream selection bias remains."}
    (HERE / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
