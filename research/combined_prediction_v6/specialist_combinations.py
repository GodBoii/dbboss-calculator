"""Posthoc diagnostic of independent output routing among frozen specialists."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import hashlib
import itertools
import json
from pathlib import Path

import numpy as np


HERE = Path(__file__).resolve().parent
CHANNELS = ("open", "close_pre", "close_known")
BUDGETS = ("panel10", "sp30", "dp20")
CHOICES = tuple(itertools.product((0, 1), repeat=3))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def periods(dates: np.ndarray) -> dict[str, np.ndarray]:
    return {
        "development": dates <= "2026-08-16",
        "validation": (dates >= "2026-08-17") & (dates <= "2026-09-07"),
        "refine_train": (dates >= "2026-09-08") & (dates <= "2026-09-30"),
        "refine_validation": (dates >= "2026-10-01") & (dates <= "2026-10-15"),
        "late_reused": (dates >= "2026-10-16") & (dates <= "2026-10-22"),
        "extension": dates >= "2026-10-23",
    }


def route(components: tuple[np.ndarray, np.ndarray, np.ndarray],
          choice: tuple[int, int, int]) -> tuple[np.ndarray, ...]:
    selected = tuple(matrix[bit] for matrix, bit in zip(components, choice, strict=True))
    return (*selected, selected[0] & selected[1] & selected[2])


def verify_fixture() -> None:
    top = np.array([[1, 1, 0, 1], [1, 0, 1, 1]], dtype=bool)
    avoid = np.array([[1, 0, 1, 1], [0, 1, 1, 1]], dtype=bool)
    panel = np.array([[1, 1, 1, 0], [1, 1, 1, 1]], dtype=bool)
    np.testing.assert_array_equal(route((top, avoid, panel), (0, 0, 0))[-1], [1, 0, 0, 0])
    np.testing.assert_array_equal(route((top, avoid, panel), (1, 1, 1))[-1], [0, 0, 1, 1])
    np.testing.assert_array_equal(route((top, avoid, panel), (0, 1, 1))[-1], [0, 1, 0, 1])
    # Kind eligibility is applied after logical conjunction, not to its inputs.
    np.testing.assert_array_equal(route((top, avoid, panel), (1, 1, 1))[-1] & np.array([1, 1, 1, 0], bool), [0, 0, 1, 0])


def save_json(name: str, value: object) -> None:
    (HERE / name).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main() -> None:
    verify_fixture()
    manifest = json.loads((HERE / "selection_manifest.json").read_text())
    for name, expected in manifest["files"].items():
        if digest(HERE / name) != expected:
            raise ValueError(f"Frozen source changed: {name}")
    selection = json.loads((HERE / "selection.json").read_text())
    catalogues = json.loads((HERE / "catalogues.json").read_text())
    mapping = {(r["channel"], r["market"], r["objective"]): r for r in selection}
    with np.load(HERE / "hits.npz", allow_pickle=False) as archive:
        historical = {key: archive[key] for key in archive.files}
    with np.load(HERE / "extension_hits.npz", allow_pickle=False) as archive:
        combined = {key: archive[key] for key in archive.files}
    n_history = len(historical["dates"])
    prefix_differences = []
    for key, array in historical.items():
        if "__coarse__" in key:
            continue
        later = combined[key]
        if key in ("dates", "markets") or key.endswith("__eligible"):
            np.testing.assert_array_equal(array, later[:n_history])
        else:
            different = np.argwhere(array != later[:, :n_history])
            if len(different):
                prefix_differences.append({"key": key, "count": len(different), "indices": different.tolist()})
            np.testing.assert_array_equal(array[0], later[0, :n_history])
            channel, _, metric = key.split("__")
            used = sorted({entry["index"] for entry in selection if entry["channel"] == channel and entry["objective"] == metric})
            np.testing.assert_array_equal(array[used], later[used, :n_history])
            # Frozen original scores govern historical choice; rescore only the new dates.
            later[:, :n_history] = array
    # The combined archive includes the same historical prefix and new extension.
    dates, markets = combined["dates"], combined["markets"]
    block_masks = periods(dates)
    scopes = {"ALL": np.ones(len(dates), dtype=bool), **{str(m): markets == m for m in sorted(set(markets))}}
    inputs = ("selection_manifest.json", "selection.json", "catalogues.json", "hits.npz", "extension_hits.npz", "extension_results.json")
    protocol = {
        "createdAtUTC": datetime.now(timezone.utc).isoformat(),
        "status": "posthoc diagnostic, not newly untouched confirmation",
        "disclosure": "This independent-output-routing design was conceived AFTER reading the main study extension scores. Source specialist choices were frozen before fetching extension outcomes; router combinations were not preregistered before that fetch.",
        "sourceFreezeUTC": manifest["frozenAtUTC"],
        "sourceSHA256": {name: digest(HERE / name) for name in inputs},
        "scriptSHA256": digest(Path(__file__)),
        "design": "3 channels x 13 scopes x 3 panel budgets x 2^3 production/specialist output choices = 936 configurations; all are logged including failures and duplicate choices.",
        "componentOrder": ["top5", "avoid2", "panel budget"],
        "selection": "No extension outcomes enter router choice. Require >=15 eligible refine_train and >=8 eligible refine_validation rows; joint train delta>=0 and validation delta>0; top5, avoid2 and panel component deltas>=0 in both blocks, each on its own eligibility. Maximize validation joint hits then prefer production, then training joint hits, then lexicographic choice. Fall back to 000 if none pass.",
        "interpretation": "Outputs are independently routed and need not come from one coherent panel probability distribution. Fixed budgets remain Top5Sutta, two avoid digits, and top10/SP30/DP20 panels. No model fitting or new probability model occurs.",
        "historicalRescoreDifferences": prefix_differences,
        "archivePolicy": "Use original hits.npz for all historical dates and extension_hits.npz only for extension dates. Historical dates, markets, eligibility and production hit prefixes match exactly. Any nonproduction rescore differences are disclosed; no frozen historical score is replaced by a later rescore.",
        "checks": ["manual Boolean routing fixture", "frozen source manifest hashes", "historical date/market/eligibility/production prefix equality", "all frozen selected-specialist historical hit prefixes equal", "catalogue index and candidate-ID consistency", "baseline joint/component archive equality"],
    }
    save_json("specialist_protocol.json", protocol)
    rows, selected = [], []
    for channel in CHANNELS:
        prefix = f"{channel}__refined__"
        for market, scope in scopes.items():
            for budget in BUDGETS:
                metrics = ("top5", "avoid2", budget)
                indices = [mapping[channel, market, metric]["index"] for metric in metrics]
                for metric, index in zip(metrics, indices, strict=True):
                    entry = mapping[channel, market, metric]
                    if catalogues[channel]["refined"][index]["id"] != entry["candidate"]:
                        raise ValueError("Selection/catalogue mismatch")
                components = tuple(combined[prefix + metric][[0, index]].astype(bool) for metric, index in zip(metrics, indices, strict=True))
                eligibility = tuple(combined[prefix + metric + "__eligible"].astype(bool) for metric in metrics)
                base = route(components, (0, 0, 0))
                joint_metric = {"panel10": "joint10", "sp30": "joint_sp30", "dp20": "joint_dp20"}[budget]
                np.testing.assert_array_equal(base[-1], combined[prefix + joint_metric][0])
                configurations = []
                for choice in CHOICES:
                    output = route(components, choice)
                    code = "".join(map(str, choice))
                    config_rows = {}
                    for block, block_mask in block_masks.items():
                        use = scope & block_mask & eligibility[-1]
                        record = {"channel": channel, "market": market, "panel_budget": budget, "choice": code, "block": block,
                                  "top5_index": indices[0] if choice[0] else 0, "avoid2_index": indices[1] if choice[1] else 0,
                                  "panel_index": indices[2] if choice[2] else 0,
                                  "n": int(use.sum()), "baseline_joint_hits": int(base[-1][use].sum()), "candidate_joint_hits": int(output[-1][use].sum())}
                        record["joint_delta"] = record["candidate_joint_hits"] - record["baseline_joint_hits"]
                        for j, name in enumerate(("top5", "avoid2", "panel")):
                            component_use = scope & block_mask & eligibility[j]
                            record[f"{name}_n"] = int(component_use.sum())
                            record[f"{name}_baseline_hits"] = int(base[j][component_use].sum())
                            record[f"{name}_candidate_hits"] = int(output[j][component_use].sum())
                            record[f"{name}_delta"] = record[f"{name}_candidate_hits"] - record[f"{name}_baseline_hits"]
                        config_rows[block] = record
                    train, val = config_rows["refine_train"], config_rows["refine_validation"]
                    passes = train["n"] >= 15 and val["n"] >= 8 and train["joint_delta"] >= 0 and val["joint_delta"] > 0
                    passes = passes and all(config_rows[b][f"{component}_delta"] >= 0 for b in ("refine_train", "refine_validation") for component in ("top5", "avoid2", "panel"))
                    configurations.append((choice, config_rows, bool(passes)))
                survivors = [config for config in configurations if config[2] or config[0] == (0, 0, 0)]
                winner = min(survivors, key=lambda config: (-config[1]["refine_validation"]["candidate_joint_hits"], config[0] != (0, 0, 0), -config[1]["refine_train"]["candidate_joint_hits"], config[0]))
                for choice, config_rows, passes in configurations:
                    for record in config_rows.values():
                        rows.append({**record, "passes_historical_guard": passes, "selected_historically": choice == winner[0]})
                selected.append({"channel": channel, "market": market, "panel_budget": budget, "choice": "".join(map(str, winner[0])), "blocks": winner[1]})
    if len(scopes) != 13 or len(rows) != 936 * 6 or len(selected) != 117:
        raise ValueError("Unexpected scope/configuration cardinality")
    with (HERE / "specialist_combinations.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    save_json("specialist_selection.json", selected)
    all_scope = [row for row in selected if row["market"] == "ALL"]
    report = ["# Independent output specialist routing", "", protocol["disclosure"], "", "This is a posthoc diagnostic. The extension is displayed after historical selection and cannot validate a newly preregistered claim. No production changes were made.", "", "Each bit in `TAP` chooses production (0) or the previously frozen specialist (1), independently for Top5Sutta, avoid-two, and panels. Components retain their original output budgets. This routing can be inconsistent with a single panel distribution. All 936 configurations, including guard failures and equivalent routes, appear in `specialist_combinations.csv` over all six blocks (5,616 rows).", "", "Selection requires a nonnegative joint training delta, strictly positive joint validation delta, and no component regression in either historical refinement block; each component uses its own eligibility. Historical minimum sizes are 15 training and 8 validation eligible rows. The extension never breaks ties or changes the winner.", "", "## Pooled scope: historically selected routes", "", "|Channel|Panel budget|TAP|Train joint Δ|Validation joint Δ|Extension n|Extension baseline → route joint|Extension joint Δ|Extension component Δ (T/A/P)|", "|---|---|---|---:|---:|---:|---|---:|---|"]
    for row in all_scope:
        b = row["blocks"]; e = b["extension"]
        report.append(f"|{row['channel']}|{row['panel_budget']}|{row['choice']}|{b['refine_train']['joint_delta']:+}|{b['refine_validation']['joint_delta']:+}|{e['n']}|{e['baseline_joint_hits']} → {e['candidate_joint_hits']}|{e['joint_delta']:+}|{e['top5_delta']:+}/{e['avoid2_delta']:+}/{e['panel_delta']:+}|")
    active = [r for r in selected if r["choice"] != "000"]
    report += ["", f"Across all 117 channel/scope/budget selectors, {len(active)} historically select a nonproduction route. Their extension joint deltas are positive in {sum(r['blocks']['extension']['joint_delta'] > 0 for r in active)}, zero in {sum(r['blocks']['extension']['joint_delta'] == 0 for r in active)}, and negative in {sum(r['blocks']['extension']['joint_delta'] < 0 for r in active)}. These counts overlap because pooled and market scopes and panel budgets share observations; they are not independent experiments.", "", "## Every market selector", "", "|Channel|Market|Budget|TAP|Validation joint Δ|Extension joint Δ|Extension component Δ (T/A/P)|", "|---|---|---|---|---:|---:|---|"]
    for row in selected:
        if row["market"] == "ALL":
            continue
        e = row["blocks"]["extension"]
        report.append(f"|{row['channel']}|{row['market']}|{row['panel_budget']}|{row['choice']}|{row['blocks']['refine_validation']['joint_delta']:+}|{e['joint_delta']:+}|{e['top5_delta']:+}/{e['avoid2_delta']:+}/{e['panel_delta']:+}|")
    report += ["", "Verification passed: manual logical fixtures, all frozen manifest hashes, catalogue ID/index mapping, production joint identity, and historical date/market/eligibility/production prefix equality. Every frozen selected-specialist historical hit prefix also matches exactly. Input and script hashes are recorded in `specialist_protocol.json`.", "", f"Historical rescore audit found {sum(item['count'] for item in prefix_differences)} differing nonproduction hit cells across {len(prefix_differences)} refined metric matrices. These do not affect any selected specialist. Historical routing and selection use the original `hits.npz` values; only new extension dates use `extension_hits.npz`. Exact discrepant indices are recorded in the protocol. This avoids silently revising frozen historical scores.", ""]
    (HERE / "SPECIALISTS.md").write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote {len(rows)} ledger rows; {len(active)}/117 nonproduction historical routes. All source and fixture checks passed.")
    for row in all_scope:
        print(row["channel"], row["panel_budget"], row["choice"], "extension joint delta", row["blocks"]["extension"]["joint_delta"])


if __name__ == "__main__":
    main()
