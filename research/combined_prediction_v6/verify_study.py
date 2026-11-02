"""Independent fixed-budget hit, frozen-selection and causal-feature audit."""
from __future__ import annotations

import copy
import hashlib
import itertools
import json
import argparse
import os
from pathlib import Path

for variable in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[variable] = "1"

import numpy as np

import run_study as study

HERE = Path(__file__).resolve().parent


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def read(name: str) -> object:
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_archive(name: str) -> dict[str, np.ndarray]:
    # Materialize once: NPZ otherwise decompresses a whole matrix on every lookup.
    with np.load(HERE / name, allow_pickle=False) as archive:
        return {key: archive[key] for key in archive.files}


def independent_hits(replay, channel: str, probabilities: np.ndarray) -> dict:
    """Rebuild lists explicitly instead of using the runner's rank-count path."""
    n = len(replay.rows)
    require(probabilities.shape == (n, 220), "Unexpected probability shape")
    require(np.isfinite(probabilities).all() and (probabilities > 0).all(), "Invalid probability distribution")
    np.testing.assert_allclose(probabilities.sum(axis=1), 1, atol=1e-10, rtol=0)
    actual = replay.actual(channel)
    panels = replay.panels
    kinds = np.array(["SP" if len(set(panel)) == 3 else "DP" if len(set(panel)) == 2 else "TP" for panel in panels])
    sutta = np.array([sum(map(int, panel)) % 10 for panel in panels])
    mass = probabilities @ np.eye(10)[sutta]
    sutta_picks = np.argsort(-mass, axis=1, kind="stable")[:, :5]
    require(sutta_picks.shape == (n, 5), "Sutta budget changed")
    top5 = (sutta_picks == sutta[actual, None]).any(axis=1)
    pairs = np.array(list(itertools.combinations(range(10), 2)))
    absent = np.array([[str(a) not in panel and str(b) not in panel for a, b in pairs] for panel in panels])
    pair_mass = probabilities @ absent.astype(float)
    avoid_picks = pairs[np.argmax(pair_mass, axis=1)]
    require(avoid_picks.shape == (n, 2) and np.all(avoid_picks[:, 0] < avoid_picks[:, 1]), "Avoid-two budget changed")
    avoid = absent[actual, np.argmax(pair_mass, axis=1)]
    all_events = np.ones(n, dtype=bool)
    output = {"top5": (top5, all_events), "avoid2": (avoid, all_events),
              "sutta_avoid": (top5 & avoid, all_events)}
    for metric, kind, count in (("panel10", None, 10), ("sp30", "SP", 30), ("dp20", "DP", 20)):
        allowed = np.arange(220) if kind is None else np.flatnonzero(kinds == kind)
        picks = allowed[np.argsort(-probabilities[:, allowed], axis=1, kind="stable")[:, :count]]
        require(picks.shape == (n, count) and np.all(np.diff(np.sort(picks, axis=1), axis=1) > 0), f"Invalid {metric} budget")
        eligible = all_events if kind is None else kinds[actual] == kind
        hit = (picks == actual[:, None]).any(axis=1) & eligible
        output[metric] = (hit, eligible)
        output[{"panel10": "joint10", "sp30": "joint_sp30", "dp20": "joint_dp20"}[metric]] = (hit & top5 & avoid, eligible)
    return output


def independent_choice(archive, channel: str, stage: str, objective: str, market: str, replay) -> int:
    dates = replay.dates
    train = dates <= "2026-08-16" if stage == "coarse" else (dates >= "2026-09-08") & (dates <= "2026-09-30")
    val = (dates >= "2026-08-17") & (dates <= "2026-09-07") if stage == "coarse" else (dates >= "2026-10-01") & (dates <= "2026-10-15")
    scope = np.ones(len(dates), dtype=bool) if market == "ALL" else replay.markets == market
    prefix = f"{channel}__{stage}__"
    hits = archive[prefix + objective]
    eligible = archive[prefix + objective + "__eligible"]
    train, val = train & scope & eligible, val & scope & eligible
    if train.sum() < 15 or val.sum() < 8:
        return 0
    guardrails = {"sutta_avoid": ("top5", "avoid2"), "joint10": ("top5", "avoid2", "panel10"), "joint_sp30": ("top5", "avoid2", "sp30"),
                  "joint_dp20": ("top5", "avoid2", "dp20")}.get(objective, ())
    survivors = [0]
    for index in range(1, len(hits)):
        gain = hits[index].astype(int) - hits[0].astype(int)
        if gain[train].sum() < 0 or gain[val].sum() <= 0:
            continue
        valid = True
        for metric in guardrails:
            matrix = archive[prefix + metric]
            allowed = archive[prefix + metric + "__eligible"] & scope
            delta = matrix[index].astype(int) - matrix[0].astype(int)
            # Guardrails use their own eligibility masks, not the joint subset.
            train_dates = dates <= "2026-08-16" if stage == "coarse" else (dates >= "2026-09-08") & (dates <= "2026-09-30")
            val_dates = (dates >= "2026-08-17") & (dates <= "2026-09-07") if stage == "coarse" else (dates >= "2026-10-01") & (dates <= "2026-10-15")
            if delta[allowed & train_dates].sum() < 0 or delta[allowed & val_dates].sum() < 0:
                valid = False
                break
        if valid:
            survivors.append(index)
    return min(survivors, key=lambda i: (-int(hits[i, val].sum()), i != 0, -int(hits[i, train].sum()), i))


def independent_baseline(replay, channel: str) -> dict:
    result = independent_hits(replay, channel, replay.endpoint_probs(channel, "sp30"))
    top5, avoid = result["top5"][0], result["avoid2"][0]
    for metric, endpoint in (("panel10", "all10"), ("sp30", "sp30"), ("dp20", "dp20")):
        hits, eligible = independent_hits(replay, channel, replay.endpoint_probs(channel, endpoint))[metric]
        result[metric] = hits, eligible
        result[{"panel10": "joint10", "sp30": "joint_sp30", "dp20": "joint_dp20"}[metric]] = hits & top5 & avoid, eligible
    return result


def verify_summaries(filename: str, archive, replay, selections: list[dict]) -> int:
    results = read(filename)
    require(results["rows"] == len(replay.rows), "Result row count changed")
    require(results["selectionSHA256"] == digest(HERE / "selection.json"), "Result selection hash mismatch")
    key = lambda row: (row["channel"], row["objective"], row["market"])
    chosen = {key(row): row for row in selections}
    require(len(results["summaries"]) == len(chosen), "Wrong summary count")
    require({key(row) for row in results["summaries"]} == set(chosen), "Summary scope mismatch")
    checks = 0
    for row in results["summaries"]:
        entry = chosen[key(row)]
        require(row["candidate"] == entry["candidate"] and row["index"] == entry["index"], "Unfrozen result candidate")
        require(set(row["metrics"]) == set(study.METRICS), "Summary companion metrics missing")
        scope = np.ones(len(replay.rows), dtype=bool) if row["market"] == "ALL" else replay.markets == row["market"]
        for metric, blocks in row["metrics"].items():
            prefix = f"{row['channel']}__refined__{metric}"
            matrix, eligible = archive[prefix], archive[prefix + "__eligible"]
            for block, result in blocks.items():
                used = scope & eligible & study.blocks(replay)[block]
                base, hits = matrix[0], matrix[entry["index"]]
                expected = {"n": int(used.sum()), "baseline_hits": int(base[used].sum()),
                            "candidate_hits": int(hits[used].sum()), "wins": int((hits & ~base & used).sum()),
                            "losses": int((base & ~hits & used).sum())}
                for name, value in expected.items():
                    require(result[name] == value, f"Wrong {filename}/{key(row)}/{metric}/{block}/{name}")
                checks += 1
    return checks


def verify_parity(replay) -> int:
    parity = read("parity_production.json")
    require(parity["scriptSHA256"] == digest(HERE / "parity_check.cjs"), "Panel parity script changed")
    require(parity["octoberCsvSHA256"] == digest(HERE.parent / "combined_prediction_v2/october_rows.csv"), "Panel parity source changed")
    features = read("feature_parity.json")
    require(features["status"] == "pass" and features["sampleSize"] == 12, "Feature parity has not passed")
    require(features["scriptSHA256"] == digest(HERE / "feature_parity.cjs"), "Feature parity script changed")
    require(features["frozenReplaySHA256"] == digest(HERE.parent / "combined_prediction_v2/extension_replay.jsonl.gz"), "Feature parity replay changed")
    require(features["octoberCsvSHA256"] == digest(HERE.parent / "combined_prediction_v2/october_rows.csv"), "Feature parity CSV changed")
    for name, expected in parity["productionSourceHashes"].items():
        require(digest(study.ROOT / name) == expected, f"Production source changed: {name}")
    rows = {(str(day), str(market)): i for i, (day, market) in enumerate(zip(replay.dates, replay.markets))}
    checks = 0
    for sample in parity["samples"].values():
        i = rows[sample["date"], sample["market"]]
        for channel, field in (("open", "open"), ("close_pre", "closePre"), ("close_known", "closeKnown")):
            if sample[field] is None:
                continue
            for endpoint, pick_field, kind, count in (("all10", "panelPicks", None, 10), ("sp30", "spPicks", "SP", 30), ("dp20", "dpPicks", "DP", 20)):
                allowed = np.arange(220) if kind is None else np.flatnonzero(replay.kind == kind)
                p = replay.endpoint_probs(channel, endpoint)[i]
                picks = allowed[np.argsort(-p[allowed], kind="stable")[:count]]
                require([replay.panels[j] for j in picks] == sample[field][pick_field], "Production list parity failed")
                checks += 1
    return checks


def audit_control_drift(changes: list[tuple], replay, extension, catalogues: dict, selections: list[dict]) -> list[dict]:
    """Allow only a proven, unselected uniform-Sutta numerical control tie."""
    if not changes:
        return []
    require(len(changes) == 1, "Unexpected historical prediction drift count")
    name, candidate_index, row_index, extension_index, old, new = changes[0]
    require(name == "close_pre__refined__top5", "Unexpected prediction drift metric")
    metadata = catalogues["close_pre"]["refined"][candidate_index]
    expected_id = "refine:probability_mixture/source=uniform_sutta/alpha=1.0:base=1.0"
    require(metadata["id"] == expected_id and metadata["baseline_fraction"] == 0 and metadata["fractions"] == [1.0], "Drift is not the declared numerical control")
    require(not any(s["channel"] == "close_pre" and s["index"] == candidate_index for s in selections), "A selected output drifted")
    require(str(replay.dates[row_index]) == "2026-10-22" and str(replay.markets[row_index]) == "Time Bazar", "Unexpected control drift observation")
    p = next(study.refined_candidates(replay, "close_pre", [metadata]))[1]
    q = next(study.refined_candidates(extension, "close_pre", [metadata]))[1]
    before, after = (p @ replay.sutta_matrix)[row_index], (q @ extension.sutta_matrix)[extension_index]
    boundary_before = np.sort(before)[-5] - np.sort(before)[-6]
    boundary_after = np.sort(after)[-5] - np.sort(after)[-6]
    maximum = float(np.max(np.abs(p[row_index] - q[extension_index])))
    require(maximum < 1e-12 and max(abs(boundary_before), abs(boundary_after)) < 1e-12, "Control drift is not a numerical boundary tie")
    require(np.max(abs(before - .1)) < 1e-12 and np.max(abs(after - .1)) < 1e-12, "Control is not uniform Sutta")
    return [{"channel": "close_pre", "stage": "refined", "candidate": expected_id, "index": int(candidate_index),
             "metric": "top5", "date": "2026-10-22", "market": "Time Bazar", "historical_hit": bool(old), "extension_replay_hit": bool(new),
             "max_panel_probability_difference": maximum, "max_sutta_mass_difference": float(np.max(abs(before - after))),
             "historical_sutta_masses": before.tolist(), "extension_sutta_masses": after.tolist(),
             "historical_fifth_sixth_gap": float(boundary_before), "extension_fifth_sixth_gap": float(boundary_after),
             "selected_by_any_scope": False,
             "limitation": "Floating arithmetic changes a uniform-control tie. All selected predictions and every other historical hit remain identical; no frozen definition or selection was changed."}]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--extension-only", action="store_true")
    args = parser.parse_args()
    manifest = read("selection_manifest.json")
    for name, expected in manifest["files"].items():
        require(digest(HERE / name) == expected, f"Frozen file changed: {name}")
    require(manifest["selectionSHA256"] == digest(HERE / "selection.json"), "Frozen selection changed")
    require(manifest["protocolSHA256"] == digest(HERE / "protocol.json"), "Frozen protocol changed")
    catalogues, selections, shortlist = read("catalogues.json"), read("selection.json"), read("shortlist.json")
    replay = study.load_replay(False)
    archive = read_archive("hits.npz")
    expected_scopes = {(channel, metric, market) for channel in study.CHANNELS for metric in study.METRICS for market in ("ALL", *sorted(set(replay.markets)))}
    for entries in (selections, shortlist):
        require(len(entries) == len(expected_scopes) and {(s["channel"], s["objective"], s["market"]) for s in entries} == expected_scopes, "Missing or duplicate selector scopes")
    require(np.array_equal(archive["dates"], replay.dates) and np.array_equal(archive["markets"], replay.markets), "Archive rows differ")
    for stage, entries in (("coarse", shortlist), ("refined", selections)):
        for entry in entries:
            chosen = independent_choice(archive, entry["channel"], stage, entry["objective"], entry["market"], replay)
            require(entry["index"] == chosen and entry["candidate"] == catalogues[entry["channel"]][stage][chosen]["id"], "Selection cannot be reconstructed")
    for channel in study.CHANNELS:
        local = [s for s in shortlist if s["channel"] == channel]
        # Refined metadata must be completely derived from the stage-one winners.
        require(study.refine_catalogue(local) == catalogues[channel]["refined"], "Refinement definitions changed")
    summary_checks = verify_summaries("results.json", archive, replay, selections)
    parity_checks = verify_parity(replay)
    has_extension = (HERE / "extension_results.json").exists() and (HERE / "extension_hits.npz").exists()
    extension = study.load_replay(True) if has_extension else None
    extension_archive = read_archive("extension_hits.npz") if has_extension else None
    control_drift = []
    if has_extension:
        require(np.array_equal(extension_archive["dates"], extension.dates) and np.array_equal(extension_archive["markets"], extension.markets), "Extension archive row mismatch")
        summary_checks += verify_summaries("extension_results.json", extension_archive, extension, selections)
        # New rows may interleave by market/date; compare by stable observation key.
        positions = {(str(day), str(market)): i for i, (day, market) in enumerate(zip(extension.dates, extension.markets))}
        indices = [positions[str(day), str(market)] for day, market in zip(replay.dates, replay.markets)]
        changes = []
        for name in extension_archive:
            if name not in ("dates", "markets"):
                values = extension_archive[name][:, indices] if extension_archive[name].ndim == 2 else extension_archive[name][indices]
                if not np.array_equal(values, archive[name]):
                    require(values.ndim == 2 and not name.endswith("__eligible"), "Historical eligibility drifted")
                    changes.extend((name, int(i), int(j), indices[j], archive[name][i, j], values[i, j]) for i, j in np.argwhere(values != archive[name]))
        control_drift = audit_control_drift(changes, replay, extension, catalogues, selections)
    if args.extension_only:
        require(has_extension, "Extension artifacts are missing")
        previous = read("verification.json")
        require(previous["status"] == "pass" and previous["distribution_reconstructions"] > 0, "Full historical audit must pass first")
        previous.update(extension_verified=True, total_rows=len(extension.rows), summary_count_checks=summary_checks,
                        control_tie_limitation=control_drift, selected_historical_predictions_identical=True,
                        extension_verification_scope="Frozen files, selectors, all summary counts and strict selected historical prediction stability; one unselected numerical control tie is separately audited. Distribution reconstruction was historical only.")
        study.save("verification.json", previous)
        print(json.dumps(previous, indent=2))
        return
    altered_rows = copy.deepcopy(replay.rows)
    cutoff = "2026-09-01"
    for row in altered_rows:
        if row["date"] >= cutoff:
            row["actualOpen"] = "111" if row["actualOpen"] != "111" else "222"
            row["actualClose"] = "333" if row["actualClose"] != "333" else "444"
    altered = study.Replay.from_rows(altered_rows)
    through = replay.dates <= cutoff
    distributions = causal_checks = 0
    for channel in study.CHANNELS:
        bank = study.models.build_bank(replay, channel)
        altered_bank = study.models.build_bank(altered, channel)
        base = independent_baseline(replay, channel)
        baseline_p = replay.endpoint_probs(channel, "sp30")
        coarse = itertools.chain([({"id": "production"}, baseline_p)], study.models.candidates(replay, channel, bank))
        perturbed_stream = study.models.candidates(altered, channel, altered_bank)
        for stage, stream in (("coarse", coarse), ("refined", study.refined_candidates(replay, channel, catalogues[channel]["refined"], bank))):
            count = 0
            for index, (metadata, probabilities) in enumerate(stream):
                require(metadata["id"] == catalogues[channel][stage][index]["id"], "Catalogue order changed")
                values = base if index == 0 else independent_hits(replay, channel, probabilities)
                for metric in study.METRICS:
                    name = f"{channel}__{stage}__{metric}"
                    require(np.array_equal(values[metric][0], archive[name][index]), f"Hit reconstruction failed: {name}/{index}")
                    require(np.array_equal(values[metric][1], archive[name + "__eligible"]), f"Eligibility reconstruction failed: {name}")
                if stage == "coarse" and index:
                    changed_metadata, changed_p = next(perturbed_stream)
                    require(changed_metadata["id"] == metadata["id"], "Perturbation changed catalogue")
                    require(np.array_equal(probabilities[through], changed_p[through]), f"Current/future label leakage: {channel}/{metadata['id']}")
                    causal_checks += 1
                distributions += 1
                count += 1
            require(count == len(catalogues[channel][stage]), "Candidate stream length mismatch")
            print(f"Verified {channel}/{stage}: {count} distributions", flush=True)
        if has_extension:
            bank_extension = study.models.build_bank(extension, channel)
            base_extension = independent_baseline(extension, channel)
            for index, (metadata, probabilities) in enumerate(study.refined_candidates(extension, channel, catalogues[channel]["refined"], bank_extension)):
                values = base_extension if index == 0 else independent_hits(extension, channel, probabilities)
                for metric in study.METRICS:
                    name = f"{channel}__refined__{metric}"
                    require(np.array_equal(values[metric][0], extension_archive[name][index]), f"Extension reconstruction failed: {name}/{metadata['id']}")
                distributions += 1
    report = {"status": "pass", "historical_rows": len(replay.rows), "total_rows": len(extension.rows) if has_extension else len(replay.rows),
              "frozen_selections": len(selections), "stage1_selections": len(shortlist), "distribution_reconstructions": distributions,
              "causality_comparisons": causal_checks, "causality_cutoff_inclusive": cutoff, "production_parity_lists": parity_checks,
              "summary_count_checks": summary_checks, "extension_verified": has_extension,
              "control_tie_limitation": control_drift, "selected_historical_predictions_identical": has_extension,
              "limitation": "New feature logic and frozen selectors audited; upstream historical fitting, outcome reuse and research selection bias remain."}
    study.save("verification.json", report)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
