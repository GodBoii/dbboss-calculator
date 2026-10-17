"""Render the complete V2 findings without selecting any new policy."""
from __future__ import annotations

import csv
import json
import platform

import numpy as np

from wide_models import HERE, PROTOCOL, sha


def pct(value: float | None) -> str:
    return "N/A" if value is None else f"{100*value:.1f}%"


def count(stats: dict, key: str = "candidate") -> str:
    return f"{stats[key+'_hits']}/{stats['n']} ({pct(stats[key+'_rate'])})"


def recipe(definition: dict) -> str:
    p = definition["parameters"]
    if definition["family"] == "ridge_stack":
        return f"ridge_stack, L2={p['l2']}, DP-only={p['dp_only']}; full coefficients in catalogue"
    return definition["family"] + ": " + json.dumps(p, separators=(",", ":"))


def plot_market_matrix(rows: list[dict]) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.colors import TwoSlopeNorm
    markets = sorted({row["market"] for row in rows})
    policies = ["global_stable", "market_shrink_100", "online_guarded", "v1_routed"]
    data = np.zeros((len(markets), len(policies)), dtype=int)
    observations = {}
    for row in rows:
        if row["block"] == "extension" and row["channel"] == "close_known" and row["task"] == "all30" and row["policy"] in policies:
            data[markets.index(row["market"]), policies.index(row["policy"])] = int(row["net_hits"])
            observations[row["market"]] = row["n"]
    extent = max(1, int(np.abs(data).max()))
    fig, ax = plt.subplots(figsize=(10, 7.5), layout="constrained")
    im = ax.imshow(data, cmap="RdBu", norm=TwoSlopeNorm(vmin=-extent, vcenter=0, vmax=extent), aspect="auto")
    for i in range(len(markets)):
        for j in range(len(policies)):
            ax.text(j, i, f"{data[i,j]:+d}", ha="center", va="center", color="white" if abs(data[i,j]) >= .7 * extent else "#15202b", fontsize=12)
    ax.set_yticks(range(len(markets)), [f"{m}  (n={observations[m]})" for m in markets])
    ax.set_xticks(range(len(policies)), ["Shared stable rule", "Local weights, prior 100", "Online with guard", "Previous V1 routes"], rotation=15, ha="right")
    ax.set_title("Close Top 30 after Open: extra hits over the same baseline\nOctober 1-15, 2026; small per-market samples", loc="left", fontsize=13, pad=16)
    ax.tick_params(length=0)
    fig.colorbar(im, ax=ax, label="Net hits; negative values mean fewer correct panels")
    fig.savefig(HERE / "market_reversals.png", dpi=160, metadata={"Software": "Matplotlib"})
    plt.close(fig)


def main() -> None:
    result = json.loads((HERE / "extension_results.json").read_text())
    frozen = json.loads((HERE / "frozen_policy.json").read_text())
    audit = json.loads((HERE / "extension_source_audit.json").read_text())
    matrix = list(csv.DictReader((HERE / "market_matrix.csv").open(encoding="utf-8", newline="")))
    historical = list(csv.DictReader((HERE / "historical_market_matrix.csv").open(encoding="utf-8", newline="")))
    candidates = {c: json.loads((HERE / f"catalogue_{c}.json").read_text()) for c in PROTOCOL["channels"]}
    panel_count = sum(len(c) for c in candidates.values())
    secondary_count = sum(spec["candidate_count"] for tasks in frozen["secondary"].values() for spec in tasks.values())
    online_count = sum(len(spec["tried"]) for values in frozen["channels"].values() for spec in values["online"].values())
    lines = ["# Wide prediction-combination research", "", "## Result", "",
             "No universal combination or market router is confirmed. Several historical winners fail the newly scored October extension. A few candidates retain small gains, but none of the 231 selected comparisons passes the exact day-cluster test with Holm correction. Production code and the previous frozen policy are unchanged.", "",
             f"Tested {panel_count:,} panel candidates, {secondary_count:,} separate Sutta/present-pair/absent-pair/kind/Jodi variants, and {online_count:,} online controller settings. These are parameterized hypotheses, not thousands of independent scientific theories.", "",
             "The previous V1 routed Close Top-30 policy improved September's final block from 45/237 to 59/237. On October 1-15 it regresses from 32/152 to 30/152. That reversal is the strongest reason not to promote the September result.", "",
             "## Data and separation", "",
             "- Exploration: 900 market-date events, July 4 through September 30. All three earlier blocks were already inspected and are explicitly exploratory.",
             f"- New extension for this policy selection: {result['extension_rows']} complete market-date events from October 1 through October 15. This gives 304 actual Open/Close panels, not 27,360 independent outcomes.",
             "- All twelve markets passed exact identity checks against 180 overlapping frozen observations each. Older frozen rows were retained; October was appended. Missing rows are not invented or assumed to be closed markets.",
             "- Candidate definitions, coefficient fits, market mappings, confidence thresholds and online update rules were frozen, hashed and pushed before the full October collection. An earlier availability probe printed only Kalyan's latest date and count.",
             "- This is not a pre-event forecast registry. The extension outcomes already existed publicly, some October 1-2 dates occur in older repository audits, and current base-model selection has used historical outcomes. No October outcomes were read by the selection scripts. October 3-15 is also reported as a post-hoc sensitivity check without changing any policy.",
             "- Other same-day markets enter a model only when their configured result time plus ten minutes precedes the forecast time. Before-Open Close uses the target Open time as its information cutoff. Historical publication timestamps are unavailable, so scheduled availability remains an assumption.",
             "- Online rules update after the whole market-date. They never use today's target Close to select an Open prediction.", "",
             f"Frozen policy SHA-256: `{result['policySHA256']}`.", "",
             "## What was actually tried", "",
             "1. Positive and negative Sutta and appearance weights, multipliers from 0.01 to 10, and direct/conditional Close corrections.",
             "2. Arithmetic, geometric and harmonic averaging; minimum, maximum and median consensus; reciprocal-rank fusion, Borda ranks and majority voting.",
             "3. Digit rotations by 1/3/5/7/9, mirror maps, opposite digits, cold/hot frequencies, gaps and previous-panel overlap.",
             "4. Sutta bucket allocation, preserved Top-1/3/6/10 prefixes, greedy digit/Sutta diversification, near-hard constraints and XOR/conflict rules.",
             "5. Nonlinear feature interactions and sign flips based on weekday/weekend, previous DP, declared Open kind, model agreement and earlier-source count.",
             "6. Strictly earlier scheduled-market digit/Sutta context, plus regularized pooled and DP-only stacking. Stacks use three expanding historical refit folds; final coefficients use dates through September 30 only.",
             "7. Shared and stability-penalized choices, local routes shrunk with 30/100/300 prior observations, selection excluding the target market, and causal local/global online experts.",
             "8. Joint digit-pair models, separate Sutta combinations, 25/36-pair Jodi rankers, selective confidence/agreement gates, frequency controls and seeded random controls.", "",
             "All exact-panel outputs contain the requested number of unique legal panels. SP means three different digits; DP means exactly two different digits; TP is separate. DP/SP conditional rates and unconditional rates are kept separate.", "",
             "## October panel results", "",
             "The table reports the preselected stable policy, local prior-100 policy and guarded online policy. Mean-winning, prior-30/prior-300, leave-market-out and both V1 policies are included in extension_results.json and the exact call ledger. A 0 net change may mean the guard retained the baseline.", "",
             "| Channel | Task | Baseline | Stable rule | Local prior 100 | Online guarded |", "|---|---|---:|---:|---:|---:|"]
    for channel in PROTOCOL["channels"]:
        for task, policies in result["channels"][channel].items():
            base = policies["global_stable"]
            lines.append(f"| {channel} | {task} | {count(base, 'baseline')} | {count(policies['global_stable'])} | {count(policies['market_shrink_100'])} | {count(policies['online_guarded'])} |")
    lines += ["", "Open is forecast before Open; close_pre is forecast before Open; close_known uses the same market's declared Open. DP lists are evaluated conditional on actual DP, and SP30 conditional on actual SP. Each channel has only 152 extension events; actual DP subsets have 37 Open and 41 Close events.", "",
              "## Promising points and failures", "",
              "- Pre-Open Close Top-10 stable: 7/152 to 13/152, 4.6% to 8.6%. Its 95% date-bootstrap lift interval spans a loss; the day-cluster p-value is about .324. The rule deliberately reverses Sutta, appearance and conditional-Close adjustments while boosting predicted-absent digits. This is a measured research variant, not proof the models are universally inverted.",
              "- Known-Open Close DP Top-20 stable: 13/41 to 15/41. The selected map mirrors digit appearance around 3 with weight 0.25. Two additional hits are too few to establish an advantage.",
              "- Jodi-25 stable: 34/152 to 40/152. It uses 75% reciprocal-rank support from the last 30 historical Jodis and 25% from the native pair ranking. Jodi-36 uses a 50/50 arithmetic mixture and rises from 53/152 to 56/152. Both remain unconfirmed.",
              "- Open Top-30 stable: 41/152 to 39/152. More aggressive historical fitting did not improve the extension.",
              "- Close-known Sutta Top-3 stable: 51/152 to 32/152. Close-pre absent-pair market routing falls from 84/152 to 67/152. These failures are included alongside gains.",
              "- Seeded random controls reached 34/152 for a pre-Open Close Top-30 family leader against 28/152 baseline, and 34/152 for known-Open Close against 32/152. A small isolated lift is therefore an inadequate selection standard.", "",
              "## Exact stable recipes", "", "These choices were frozen before the October extension was admitted for evaluation. Full learned coefficients are in the catalogues.", "", "| Channel | Task | Candidate | Definition |", "|---|---|---:|---|"]
    for channel in PROTOCOL["channels"]:
        for task in ("all10", "all30", "sp30", "dp10", "dp20", "dp30"):
            index = frozen["channels"][channel]["static"]["tasks"][task]["global_stable"]
            lines.append(f"| {channel} | {task} | {index} | `{recipe(candidates[channel][index])}` |")
    lines += ["", "## Market reversals", "",
              "The same pre-Open Close Top-10 stable formula gains two hits in Kalyan and Kalyan Night, but loses two in Sridevi and one each in Sridevi Night and Time Bazar. A positive pooled result does not establish a positive local result.", "",
              "The previous routed Close Top-30 policy keeps a Kalyan Night gain in October, 2/11 to 5/11, while losing in Time Bazar, 5/13 to 3/13, and Sridevi Night, 2/15 to 0/15. Different routes are already part of that policy; market-specific tuning still does not guarantee local stability.", "",
              "| Market | Extension events | Pre-Open Close Top-10 baseline / stable | Previous Close-known Top-30 baseline / routed |", "|---|---:|---|---|"]
    for market in sorted(audit["markets"]):
        one = next(x for x in matrix if x["block"] == "extension" and x["channel"] == "close_pre" and x["task"] == "all10" and x["policy"] == "global_stable" and x["market"] == market)
        two = next(x for x in matrix if x["block"] == "extension" and x["channel"] == "close_known" and x["task"] == "all30" and x["policy"] == "v1_routed" and x["market"] == market)
        lines.append(f"| {market} | {one['n']} | {one['baseline_hits']} / {one['candidate_hits']} | {two['baseline_hits']} / {two['candidate_hits']} |")
    lines += ["", "Kalyan Night's earlier V1 route has net gains of +1, +4 and +3 across the three exploratory blocks, then +3 in October. This is the most consistent local observation for that route, but it was found among many market/task choices and October contains only eleven events. It remains a candidate for a future frozen test.", "",
              f"![Market reversals](/{(HERE / 'market_reversals.png').as_posix()})", "",
              "## Model-family transfer", "",
              "Every family leader below was chosen on July-September, then scored unchanged. Values are net October hits versus the relevant baseline. These 84 family/endpoint diagnostics are exploratory; they do not select another October winner.", "",
              "| Family | Open Top-30 | Close-pre Top-30 | Close-known Top-30 | Open DP20 | Close-pre DP20 | Close-known DP20 |", "|---|---:|---:|---:|---:|---:|---:|"]
    families = sorted({r["family"] for r in result["family_leaders"]})
    for family in families:
        values = []
        for task in ("all30", "dp20"):
            for channel in PROTOCOL["channels"]:
                item = next(x for x in result["family_leaders"] if x["family"] == family and x["channel"] == channel and x["task"] == task)
                stats = item["metrics"]
                values.append(f"{stats['candidate_hits']-stats['baseline_hits']:+d}")
        lines.append(f"| {family} | " + " | ".join(values) + " |")
    lines += ["", "The full file family_extension.csv covers every panel task and family. market_matrix.csv gives every market's extension result for every selected policy and family. historical_market_matrix.csv adds 13,608 earlier market/block comparisons, explicitly marked as exploratory.", "",
              "## Secondary outputs", "", "The stable and market-routed versions are independently selected per output. Marginal-independence pair scores are tested as an approximation; true joint co-presence/absence scores are also tested. No individual-digit success is counted as a successful two-digit pair.", "",
              "| Channel | Output | Native | Stable | Market routes |", "|---|---|---:|---:|---:|"]
    for channel, tasks in result["secondary"].items():
        for task, policies in tasks.items():
            lines.append(f"| {channel} | {task} | {count(policies['stable'], 'baseline')} | {count(policies['stable'])} | {count(policies['market_routes'])} |")
    lines += ["", "## Confidence, abstention and hard constraints", "",
              "All 162 frozen top-K mass, boundary-margin and model-agreement gates are included in confidence_gates.csv. Called predictions are compared with the baseline on exactly the same observations. A no-call is not a hit. These ranking/confidence scores have not been calibrated into reliable betting probabilities.", "",
              "For example, the upper-quartile Open Top-30 mass gate calls 30/152 observations and scores 8/30 versus the baseline's 10/30 on those same calls. The corresponding Close-known gate calls 25/152 and scores 5/25 versus 6/25. More selective confidence is not automatically better.", "",
              "The hard intersection of native Sutta Top-6 and the absent pair allows the actual panel through on 49/152 Open outcomes and 51/152 Close outcomes. Those are eligibility ceilings for that intersection on this sample, not achieved Top-30 accuracy. All constraint counts and undersized-list checks are in hard_constraint_diagnostics.csv.", "",
              "## Sensitivity and uncertainty", "",
              "October 3-15 leaves 128 events per channel after excluding dates that occur in earlier October audits. No parameters or market routes are changed. The following sensitivity table is post-hoc and descriptive.", "",
              "| Channel / task / policy | October 1-15 baseline / candidate | October 3-15 baseline / candidate |", "|---|---|---|"]
    for channel, task, policy in [("close_pre", "all10", "global_stable"), ("close_known", "dp20", "global_stable"), ("close_known", "all30", "online_guarded"), ("close_known", "all30", "v1_routed"), ("open", "all30", "global_stable")]:
        stats = result["channels"][channel][task][policy]
        sub = stats["october3_onward_sensitivity"]
        lines.append(f"| {channel} / {task} / {policy} | {stats['baseline_hits']}/{stats['n']} / {stats['candidate_hits']}/{stats['n']} | {sub['baseline_hits']}/{sub['n']} / {sub['candidate_hits']}/{sub['n']} |")
    lines += ["", "Uncertainty uses 10,000 whole-date bootstrap replicates, exact sign flips of whole-date paired differences, and Holm correction across all 231 selected panel/secondary comparisons. McNemar p-values are saved as a separate event-paired diagnostic. No selected comparison clears the adjusted day-cluster threshold. Per-market samples and DP subsets are especially small.", "",
              "## Decision", "",
              "Keep every candidate research-only. Preserve the October failures rather than retuning and calling the same dates a holdout again. Kalyan Night's previous local route, the pre-Open Close Top-10 reversal rule and the 30-draw Jodi blend are specific candidates worth freezing for another independently collected extension. No evidence here supports one common multiplier, automatic absent-digit exclusion, or a confirmed increase across all markets.", "",
              "## Verification and reproduction", "",
              "Verified source identities and hashes, all candidate families, exact list sizes/types, causal earlier-source context, exclusion of later same-day markets and undeclared own Open, future-reward poisoning for online rules, DP-only preservation, and all 27,360 panel plus 7,752 secondary October prediction lists. Every published count is reconciled to an exact call ledger. Adding audit details did not alter any of the original 231 comparison statistics.", "",
              "```powershell", "# Regenerate ignored historical caches only with unchanged frozen code:", "node research/combined_prediction_v1/export_replay.cjs", "python research/combined_prediction_v2/wide_search.py open", "python research/combined_prediction_v2/wide_search.py close_pre", "python research/combined_prediction_v2/wide_search.py close_known", "python research/combined_prediction_v2/secondary_search.py", "# Regenerated definitions must match freeze_manifest.json exactly.", "# Do not refreeze this study; freeze.py rejects an existing October snapshot.", "# Score the committed October snapshot without fetching the source again:", "node research/combined_prediction_v2/export_extension.cjs", "python research/combined_prediction_v2/evaluate_extension.py", "python research/combined_prediction_v2/historical_breakdown.py", "python research/combined_prediction_v2/verify_study.py", "python research/combined_prediction_v2/report_study.py", "```", "",
              "Python dependencies are NumPy, SciPy, requests, BeautifulSoup, scikit-learn and Matplotlib. The source parser imports scikit-learn; the search itself uses SciPy for bounded conditional-logit optimization. Node uses the repository's installed TypeScript package.", "",
              "Raw replay/OOF/hit caches are regenerable and ignored by Git. Candidate catalogues, frozen coefficients and routes, source snapshot, identities, results, every selected exact call, all search summaries and the report are committed. Rebuilding after historical source or production source changes produces a different study and must not overwrite this frozen experiment.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    with (HERE / "confidence_gates.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["channel", "task", "feature", "quantile", "threshold", "coverage", "eligible_calls", "baseline_hits", "candidate_hits", "lift_pp", "day_cluster_p"])
        for gate in result["confidence_gates"]:
            stats = gate["metrics"]
            writer.writerow([gate["channel"], gate["task"], gate["feature"], gate["quantile"], gate["threshold"], stats["coverage"], stats["n"], stats["baseline_hits"], stats["candidate_hits"], stats["lift_pp"], stats["day_cluster_p"]])
    plot_market_matrix(matrix)
    import scipy
    import sklearn
    import matplotlib
    environment = {"python": platform.python_version(), "numpy": np.__version__, "scipy": scipy.__version__, "scikit_learn": sklearn.__version__, "matplotlib": matplotlib.__version__}
    (HERE / "execution_environment.json").write_text(json.dumps(environment, indent=2) + "\n", encoding="utf-8")
    print(f"Report saved: {panel_count} panel candidates, {secondary_count} secondary variants, {online_count} controllers.")


if __name__ == "__main__":
    main()
