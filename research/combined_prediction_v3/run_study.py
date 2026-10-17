"""Stages for the combined-prediction-v3 study.

    python run_study.py select    # development/validation search, freezes selection.json
    python run_study.py evaluate  # audit + October extension scoring, writes results/REPORT.md

Research only. No production file is imported for writing and none is modified.
"""
from __future__ import annotations

import argparse
import json

import numpy as np

from study import (HERE, PROTOCOL, ROOT, Change, Replay, candidate_changes, counts, digest_bytes, evaluate_change,
                   item_hits, paired, selection_items, sha256, write_json)


def frozen_selection() -> dict:
    manifest = json.loads((HERE / "selection_manifest.json").read_text(encoding="utf-8"))
    if manifest["selectionSHA256"] != sha256(HERE / "selection.json"):
        raise ValueError("selection.json changed after freezing")
    if manifest["protocolSHA256"] != sha256(HERE / "protocol.json"):
        raise ValueError("protocol.json changed after freezing")
    return json.loads((HERE / "selection.json").read_text(encoding="utf-8"))


def convert(entry: dict) -> Change:
    return Change(**entry)


def select() -> None:
    replay = Replay()
    candidates = candidate_changes()
    print(f"Replay rows: {len(replay.rows)}; candidates per item: {len(candidates)}", flush=True)
    payload = {
        "protocolSHA256": sha256(HERE / "protocol.json"),
        "replaySHA256": replay.meta["history"]["replaySHA256"],
        "extensionSHA256": replay.meta["extension"]["sha256"],
        "policySHA256": json.loads((HERE / "production_policy.json").read_text(encoding="utf-8"))["sourceSHA256"],
        "blocks": {
            "development": int(replay.development.sum()),
            "validation": int(replay.validation.sum()),
            "audit": int(replay.audit.sum()),
            "extension": int(replay.extension.sum()),
        },
        "candidateCount": len(candidates),
        "candidates": [change.as_dict() for change in candidates],
        "items": [],
    }
    for item in selection_items():
        baseline_development, baseline_validation = evaluate_change(replay, item, Change())
        rows = []
        for change in candidates:
            development, validation = evaluate_change(replay, item, change)
            rows.append((change, development, validation))
        survivors = [row for row in rows if row[1]["rate"] >= baseline_development["rate"] - 1e-12]
        best = min(survivors, key=lambda row: (-row[2]["rate"], row[0].complexity(), -row[1]["rate"]))
        payload["items"].append({
            "kind": item["kind"],
            "channel": item["channel"],
            "endpoint": item["endpoint"],
            "task": item["task"],
            "baseline": {"development": baseline_development, "validation": baseline_validation},
            "selected": {"change": best[0].as_dict(), "label": best[0].label(),
                         "development": best[1], "validation": best[2]},
        })
        print(f"{item['kind']:7s} {item['channel']:11s} {item['endpoint']:6s} {item['task']:9s} -> "
              f"{best[0].label():40s} dev {best[1]['hits']}/{best[1]['n']} val {best[2]['hits']}/{best[2]['n']}", flush=True)
    write_json(HERE / "selection.json", payload)
    write_json(HERE / "selection_manifest.json", {
        "selectionSHA256": sha256(HERE / "selection.json"),
        "protocolSHA256": sha256(HERE / "protocol.json"),
    })
    print(f"Selection frozen: {sha256(HERE / 'selection.json')}", flush=True)


def raw_weights(replay: Replay, endpoint: str) -> dict[str, np.ndarray]:
    """The uncombined baseline used by combined_prediction_v1: no adjustments,
    dedicated DP blend only for DP endpoints. Diagnostic only."""
    rows = len(replay.rows)
    return {
        "sutta": np.zeros(rows),
        "appearance": np.zeros(rows),
        "avoid_multiplier": np.ones(rows),
        "present_multiplier": np.ones(rows),
        "dp_blend": np.full(rows, 1.0 if endpoint.startswith("dp") else 0.0),
        "conditional_close": np.zeros(rows),
    }


def block_pairs(replay: Replay, item: dict, baseline_probs: np.ndarray, selected_probs: np.ndarray) -> dict:
    baseline_hits, eligible = item_hits(replay, item, baseline_probs)
    selected_hits, _ = item_hits(replay, item, selected_probs)
    return {
        "audit": paired(replay, baseline_hits, selected_hits, eligible, replay.audit),
        "extension": paired(replay, baseline_hits, selected_hits, eligible, replay.extension),
        "descriptive_all": paired(replay, baseline_hits, selected_hits, eligible,
                                  np.ones(len(replay.rows), dtype=bool)),
    }


def jodi_rows(replay: Replay, selection: dict) -> dict:
    chosen = {}
    for entry in selection["items"]:
        if entry["kind"] == "derived" and entry["task"] == "sutta6":
            chosen[entry["channel"]] = convert(entry["selected"]["change"])
    output = {}
    for count in (5, 6):
        for label, close_channel in (("jodi_pre", "close_pre"), ("jodi_known", "close_known")):
            baseline_open = replay.sutta_order(replay.endpoint_probs("open", "sp30", Change()), count)
            baseline_close = replay.sutta_order(replay.endpoint_probs(close_channel, "sp30", Change()), count)
            selected_open = replay.sutta_order(replay.endpoint_probs("open", "sp30", chosen.get("open", Change())), count)
            selected_close = replay.sutta_order(replay.endpoint_probs(close_channel, "sp30", chosen.get(close_channel, Change())), count)
            baseline_hits = replay.jodi_hits(baseline_open, baseline_close)
            selected_hits = replay.jodi_hits(selected_open, selected_close)
            eligible = np.ones(len(replay.rows), dtype=bool)
            output[f"{label}{count}"] = {
                "count": count,
                "audit": paired(replay, baseline_hits, selected_hits, eligible, replay.audit),
                "extension": paired(replay, baseline_hits, selected_hits, eligible, replay.extension),
                "descriptive_all": paired(replay, baseline_hits, selected_hits, eligible, eligible),
            }
    return output


def policy_diagnostic(replay: Replay) -> dict:
    """How much the frozen production policy adds over the raw combined inputs."""
    output = {}
    for channel in PROTOCOL["channels"]:
        output[channel] = {}
        for endpoint, task in PROTOCOL["primary_panel_task"].items():
            raw_probs = replay.endpoint_probs(channel, endpoint, Change(), weights=raw_weights(replay, endpoint))
            policy_probs = replay.endpoint_probs(channel, endpoint, Change())
            raw_hits, eligible = replay.panel_hits(channel, raw_probs)[task]
            policy_hits, _ = replay.panel_hits(channel, policy_probs)[task]
            output[channel][endpoint] = {
                "development": paired(replay, raw_hits, policy_hits, eligible, replay.development),
                "validation": paired(replay, raw_hits, policy_hits, eligible, replay.validation),
                "audit": paired(replay, raw_hits, policy_hits, eligible, replay.audit),
                "extension": paired(replay, raw_hits, policy_hits, eligible, replay.extension),
            }
    return output


def probabilistic(replay: Replay, selection: dict) -> dict:
    output = {}
    for entry in selection["items"]:
        if entry["kind"] != "panel":
            continue
        channel, endpoint = entry["channel"], entry["endpoint"]
        change = convert(entry["selected"]["change"])
        for name, probs in (("baseline", replay.endpoint_probs(channel, endpoint, Change())),
                            ("selected", replay.endpoint_probs(channel, endpoint, change))):
            losses = replay.probabilistic_losses(probs, channel)
            output.setdefault(f"{channel}/{endpoint}", {}).setdefault(name, {})["extension"] = losses
    return output


def evaluate() -> None:
    selection = frozen_selection()
    replay = Replay()
    if selection["replaySHA256"] != replay.meta["history"]["replaySHA256"]:
        raise ValueError("Replay changed after selection")
    if selection["policySHA256"] != json.loads((HERE / "production_policy.json").read_text(encoding="utf-8"))["sourceSHA256"]:
        raise ValueError("Production policy changed after selection")
    results = {
        "selectionSHA256": sha256(HERE / "selection.json"),
        "protocolSHA256": sha256(HERE / "protocol.json"),
        "rows": len(replay.rows),
        "blockCounts": {name: int(mask.sum()) for name, mask in
                        (("development", replay.development), ("validation", replay.validation),
                         ("audit", replay.audit), ("extension", replay.extension))},
        "items": [],
    }
    for entry in selection["items"]:
        item = {"kind": entry["kind"], "channel": entry["channel"], "endpoint": entry["endpoint"], "task": entry["task"]}
        change = convert(entry["selected"]["change"])
        baseline_probs = replay.endpoint_probs(item["channel"], item["endpoint"], Change())
        selected_probs = replay.endpoint_probs(item["channel"], item["endpoint"], change)
        row = {
            **item,
            "change": change.as_dict(),
            "label": change.label(),
            **block_pairs(replay, item, baseline_probs, selected_probs),
        }
        if item["kind"] == "panel":
            for task in PROTOCOL["panel_tasks"]:
                baseline_hits, eligible = replay.panel_hits(item["channel"], baseline_probs)[task]
                selected_hits, _ = replay.panel_hits(item["channel"], selected_probs)[task]
                row.setdefault("secondary", {})[task] = {
                    "extension": paired(replay, baseline_hits, selected_hits, eligible, replay.extension),
                    "audit": paired(replay, baseline_hits, selected_hits, eligible, replay.audit),
                }
        results["items"].append(row)
        print(f"Evaluated {item['kind']} {item['channel']} {item['endpoint']} {item['task']}", flush=True)
    results["jodi"] = jodi_rows(replay, selection)
    results["policyDiagnostic"] = policy_diagnostic(replay)
    results["probabilistic"] = probabilistic(replay, selection)
    write_json(HERE / "results.json", results)
    render_report(selection, results)
    print("Extension scored exactly once; no parameter was changed using it.", flush=True)


def format_paired(stats: dict) -> str:
    if not stats["n"]:
        return "-"
    low, high = stats["day_bootstrap95_pp"]
    return (f"{stats['baseline_hits']}/{stats['n']} -> {stats['candidate_hits']}/{stats['n']} "
            f"({100 * stats['baseline_rate']:.1f}% -> {100 * stats['candidate_rate']:.1f}%, "
            f"lift {stats['lift_pp']:+.2f} pp, 95% [{low:+.2f}, {high:+.2f}], p={stats['paired_p']:.4f})")


def render_fresh_section(fresh: dict) -> list[str]:
    missing = ", ".join(fresh["missingMarkets"]) if fresh["missingMarkets"] else "none"
    lines = [
        "",
        "## Fresh window (fetched once, after the selection was frozen)",
        "",
        f"Source rows: {fresh['rows']} events on {', '.join(fresh['dates'])} from {fresh['markets']} markets "
        f"(markets without fresh outcomes: {missing}), fetched {fresh['fetchedAtUTC']}. "
        "The fresh window postdates the hashed selection and was never used to choose any parameter; "
        "these columns are descriptive only.",
        "",
        "| Kind | Channel | Endpoint | Task | Selected change | Baseline | Selected | Delta | Discordant win/loss | Exact p |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for item in fresh["items"]:
        row = item["fresh"]
        lines.append("| {kind} | {channel} | {endpoint} | {task} | `{label}` | {base} | {sel} | {delta:+d} | {wins}/{losses} | {p:.3f} |".format(
            kind=item["kind"], channel=item["channel"], endpoint=item["endpoint"], task=item["task"],
            label=item["label"], base=f"{row['baseline_hits']}/{row['n']}", sel=f"{row['candidate_hits']}/{row['n']}",
            delta=row["candidate_hits"] - row["baseline_hits"], wins=row["candidate_only"],
            losses=row["baseline_only"], p=row["paired_p"]))
    lines += [
        "",
        "| Jodi output | Baseline | Selected | Delta | Discordant win/loss | Exact p |",
        "|---|---|---|---|---|---|",
    ]
    for name, row in fresh["jodi"].items():
        lines.append(f"| {name} | {row['baseline_hits']}/{row['n']} | {row['candidate_hits']}/{row['n']} | "
                     f"{row['candidate_hits'] - row['baseline_hits']:+d} | {row['candidate_only']}/{row['baseline_only']} | {row['paired_p']:.3f} |")
    lines += [
        "",
        "With 14 events this window can only detect very large effects; the exact paired test above is the "
        "strongest statement the sample supports.",
    ]
    return lines


def render_report(selection: dict, results: dict) -> None:
    lines = [
        "# Combined prediction V3: unused soft present-digit signal and DP kind-mass control",
        "",
        "Research only. Production code, settings and predictions are unchanged.",
        "",
        f"Baseline: the frozen production policy `combined-weighted-v1` (`src/lib/combined-policy.ts`). "
        f"Replays: {results['rows']} market-date events, July 4 - October 15, 2026. "
        f"Blocks: development {results['blockCounts']['development']}, validation {results['blockCounts']['validation']}, "
        f"audit {results['blockCounts']['audit']}, October extension {results['blockCounts']['extension']}.",
        "",
        "## What is new in this study",
        "",
        "- `present_soft`: the production present-digit model's soft per-digit appearance probabilities. "
        "The V1 exporter stored them (`presentAppearance`) but no candidate in combined_prediction_v1 or v2 ever used them; "
        "production only uses the hard `predictedDigits` list.",
        "- `kind_tilt`: an explicit log multiplier on the DP panel-kind mass. The production `dp_blend` only redistributes "
        "probability inside the DP kind and never changes the SP/DP mass split.",
        "- All candidates are scored against the actual production policy, not the uncombined inputs that "
        "combined_prediction_v1 used as its baseline.",
        "",
        "## Evidence limits",
        "",
    ]
    lines += [f"- {item}" for item in PROTOCOL["limitations"]]
    lines += [
        "",
        "## Frozen selections and their block results",
        "",
        "Selection used development only, then validation; the audit and October columns below were produced after "
        "selection.json was hashed. `production` means no candidate survived the development guard.",
        "",
        "| Kind | Channel | Endpoint | Task | Selected change | Development | Validation | Audit | October extension |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for entry, result in zip(selection["items"], results["items"]):
        selected = entry["selected"]
        lines.append("| {kind} | {channel} | {endpoint} | {task} | `{label}` | {dev} | {val} | {audit} | {ext} |".format(
            kind=entry["kind"], channel=entry["channel"], endpoint=entry["endpoint"], task=entry["task"],
            label=selected["label"],
            dev=f"{selected['development']['hits']}/{selected['development']['n']}",
            val=f"{selected['validation']['hits']}/{selected['validation']['n']}",
            audit=format_paired(result["audit"]), ext=format_paired(result["extension"]),
        ))
    lines += [
        "",
        "`sutta6`/`present2`/`absent2` are derived from the same `sp30` distribution the production model uses for them "
        "(Sutta list, present pair, absent pair). Panel tasks are evaluated on their own endpoint distribution.",
        "",
        "## Jodi (built from the selected Sutta lists, as the app does)",
        "",
        "| Output | Audit | October extension |",
        "|---|---|---|",
    ]
    for name, row in results["jodi"].items():
        lines.append(f"| {name} | {format_paired(row['audit'])} | {format_paired(row['extension'])} |")
    lines += [
        "",
        "## What the production policy itself adds over the raw combined inputs",
        "",
        "Diagnostic only (no selection). `raw` = no Sutta/appearance/avoid/present/conditional terms and the V1 DP-blend "
        "convention. This shows how much of the accuracy already comes from the frozen policy.",
        "",
        "| Channel | Endpoint | Development | Validation | Audit | October extension |",
        "|---|---|---|---|---|---|",
    ]
    for channel, endpoints in results["policyDiagnostic"].items():
        for endpoint, blocks in endpoints.items():
            lines.append(f"| {channel} | {endpoint} | " + " | ".join(
                format_paired(blocks[name]) for name in ("development", "validation", "audit", "extension")) + " |")
    lines += [
        "",
        "## Probabilistic quality on the October extension",
        "",
        "Mean multiclass Brier and log loss over all 220 panels (lower is better).",
        "",
        "| Channel / endpoint | Baseline Brier | Selected Brier | Baseline log loss | Selected log loss |",
        "|---|---|---|---|---|",
    ]
    for key, value in results["probabilistic"].items():
        base, chosen = value["baseline"]["extension"], value["selected"]["extension"]
        lines.append(f"| {key} | {base['brier']:.4f} | {chosen['brier']:.4f} | {base['log_loss']:.4f} | {chosen['log_loss']:.4f} |")
    fresh_path = HERE / "fresh_results.json"
    if fresh_path.exists():
        lines += render_fresh_section(json.loads(fresh_path.read_text(encoding="utf-8")))
    lines += [
        "",
        "## Interpretation",
        "",
        INTERPRETATION,
        "",
        "## Reproduce",
        "",
        "```powershell",
        "node research/combined_prediction_v3/dump_policy.cjs",
        "node research/combined_prediction_v3/parity_check.cjs",
        "python research/combined_prediction_v3/run_study.py select",
        "python research/combined_prediction_v3/run_study.py evaluate",
        "python research/combined_prediction_v3/fetch_fresh.py       # network; runs once, after selection",
        "node research/combined_prediction_v3/feature_parity.cjs",
        "node research/combined_prediction_v3/export_fresh.cjs",
        "node research/combined_prediction_v3/parity_check_fresh.cjs",
        "python research/combined_prediction_v3/score_fresh.py",
        "python research/combined_prediction_v3/verify_study.py",
        "```",
        "",
        "The replays are frozen inputs produced by combined_prediction_v1/v2 from strictly prior dates. "
        "The fresh rows are fetched by `fetch_fresh.py` only after `selection.json` is hashed, and its "
        "source-identity gate must reproduce the sealed history exactly. `verify_study.py` re-derives every "
        "selected change from the frozen replay and compares the reconstructed production lists with real "
        "`buildCombinedAnalysis` calls in `parity_production.json` and `parity_production_fresh.json`.",
        "",
        f"Frozen selection SHA-256: `{results['selectionSHA256']}`.",
        "",
    ]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


INTERPRETATION = (
    "**Panel tasks keep production everywhere.** Every panel-level selection (all10, sp30, dp20 on all "
    "three channels) fell back to `production`: no candidate using `present_soft` or `kind_tilt` beat the "
    "production development rate subject to the validation tie-break. The new degrees of freedom only ever "
    "survived on derived tasks (Sutta-6 and the present/absent pairs), which are read off the same `sp30` "
    "endpoint the production Sutta list uses.\n\n"
    "**The sealed blocks looked promising for the close-side Sutta-6.** `close_pre` Sutta-6 with "
    "`present_soft=-2;kind_tilt=-1` improved development 248/435 -> 259/435, validation 146/228 -> 155/228, "
    "audit 136/237 -> 144/237 and the October extension 81/152 -> 89/152, with consistent monthly totals "
    "(July -1, August +22, September +7, October +8). It is the only candidate positive in all four sealed "
    "blocks, and the `jodi_pre6` output built from it gained +25/+12/+4/+4 hits across those blocks.\n\n"
    "**But the gain does not look like a new signal.** The term decomposition (`decompose.py`, `stability.json`) "
    "shows `present_soft=-2` alone carries most of the effect (+31 hits across the sealed blocks; `kind_tilt=-1` "
    "alone adds +14), and simply rescaling the policy's existing `appearance` term (`appearance=-2.5`) reproduces "
    "almost the same result (audit +5 vs +8, extension +7 vs +8). The soft present-digit probabilities and the "
    "appearance probabilities are near-duplicate statements about digit presence, so the study is largely "
    "re-weighting an input the policy already consumes rather than adding information.\n\n"
    "**The fresh window contradicts the headline.** On the genuinely fresh 2026-10-16/17 window — fetched once, "
    "after `selection.json` was hashed, and never used to choose any parameter — `close_pre` Sutta-6 falls from "
    "8/14 to 5/14 (three discordant events, all losses) and `jodi_pre6` is flat. The only fresh gain is `open` "
    "Sutta-6 (9/14 -> 12/14, exact p=0.375), which was not significant in the sealed blocks either. With 14 "
    "events nothing in the fresh table can reach significance, but the direction of the only untuned evidence is "
    "negative for the strongest sealed-block candidate.\n\n"
    "**Verdict.** The two degrees of freedom remain unused in production, and this study does not justify using "
    "them: the sealed-block gains are best read as in-sample pattern, and the fresh window gives no confirmation. "
    "`combined-weighted-v1` stays as the production policy."
)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=("select", "evaluate"))
    args = parser.parse_args()
    select() if args.stage == "select" else evaluate()
