"""Render the production decision from frozen results."""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LABELS = {"production": "Current production", "calibrated": "Calibration alone",
          "with_feature": "Calibration + study feature", "offset_feature": "One-coefficient feature correction"}


def pct(value: float) -> str:
    return f"{100 * value:.2f}%"


def interval(values: list[float]) -> str:
    return f"{values[0]:+.6f} to {values[1]:+.6f}"


def main() -> None:
    r = json.loads((HERE / "results.json").read_text(encoding="utf-8"))
    replay = json.loads((HERE / "replay-audit.json").read_text(encoding="utf-8"))
    all_year = r["blocks"]["all2026"]
    post = r["blocks"]["postStudy"]
    # This decision is specific to the observed frozen evidence; fail on changed evidence.
    assert r["threshold"] == 0.90
    assert all_year["comparisons"][1]["brierGain95"][0] < 0
    assert all(m["at90"]["calls"] == 0 for m in all_year["models"].values())
    assert post["models"]["with_feature"]["brier"] > post["models"]["production"]["brier"]
    lines = [
        "# Same-market Open-to-Close DP feature: keep it out of production", "",
        "The learned daily-slate feature has a small retrospective probability-score gain, but it does not establish an incremental benefit over calibration alone. Its uncertainty intervals include zero, some markets regress, and the short post-study audit regresses. No candidate produces a call at the unchanged 90% probability threshold. Keep the new feature out of production and leave the existing verified DP gate closed.", "",
        "## What production already uses", "",
        "`src/lib/predictor/dp-kind-context.ts` already multiplies Close DP pressure by 1.10 after a same-market DP Open and by 0.92 after a non-DP Open. The replay includes this behavior and operator adjustments. The study feature would be an extra learned conditional effect, so its comparison must include the current heuristic. Do not stack the study's published conditional rates as another uncalibrated multiplier.", "",
        "`src/lib/verified-dp-call.ts` requires a frozen rule that demonstrates 90% precision on unseen outcomes and currently always abstains. The older SP/DP kind forecast uses pressure thresholds and overrides, not this verified gate. We report its calls separately. The DP panel list is a conditional ranking among DP panels; its ranking scores are not the probability that the Close itself will be DP.", "",
        "## Design and scope", "",
        f"Fit on {r['fit']['n']:,} weekday Close outcomes from {r['fit']['start']} through {r['fit']['end']}. The held-out parameter-fit comparison covers {all_year['n']:,} live Close outcomes across {all_year['dates']} weekdays and all 12 markets, from {all_year['start']} through {all_year['end']}. Actual coverage, not scheduled draws, determines the counts. There are no scored Closes with missing Open results; synthetic checks cover the missing-Open fallback.", "",
        "The feature is the study's `k_cond`, the log-odds difference between a market's smoothed Close DP rate conditional on today's Open DP/non-DP and its decayed Close base rate. Both states use prior weekday outcomes since 2016. Fit global coefficients on the fixed fit block. Do not select the three highlighted markets from their 2026 results. See [PROTOCOL.md](PROTOCOL.md) for the frozen design and regularization.", "",
        "Production runtime inputs use the rolling 28-month window, including weekends. Live Close adds only today's own Open, with Close panel, Close Sutta and Jodi blanked. No other same-day results enter the comparison. The source is frozen through October 8; today's partial results are excluded. The daily-slate source was extended with the repository's frozen October 8 snapshot, adding 79 market-days with zero conflicting rows. The merged snapshot has 23,062 market-days.", "",
        "The January-October 1 block was already inspected by the daily-slate study. October 2-8 was also inspected by other repository studies. These are retrospective held-out-from-fit audits, not blind forward evidence. The current-code production comparator contains previously selected rules, so it is not a historical as-deployed reconstruction. Schedule order alone cannot establish historical publication times; live results assume the own Open had actually been declared.", "",
        "## Calibration and proper scores", "",
        "All 2026 live Close outcomes. Lower Brier, log loss and fixed-bin calibration error are better. Calibration error is the sample-weighted absolute forecast/observed difference in ten fixed probability bins; it is descriptive and bin-dependent.", "",
        "| Model | Brier | Log loss | Mean forecast | Observed DP | Calibration error | Max probability | Calls at 90% |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for model, value in all_year["models"].items():
        lines.append(f"| {LABELS[model]} | {value['brier']:.6f} | {value['logLoss']:.6f} | {pct(value['meanForecast'])} | {pct(value['observed'])} | {pct(value['ece10'])} | {pct(value['maxProbability'])} | {value['at90']['calls']} |")
    lines += ["", "Positive paired gain means lower candidate loss. Intervals resample whole calendar dates, keeping markets on the same date together, with 3,000 seeded bootstrap replicates. They are not corrected for multiple comparisons.", "",
              "| Comparison | Brier gain | 95% interval | Log-loss gain | 95% interval |",
              "| --- | --- | --- | --- | --- |"]
    for c in all_year["comparisons"]:
        lines.append(f"| {LABELS[c['candidate']]} vs {LABELS[c['reference']]} | {c['brierGain']:+.6f} | {interval(c['brierGain95'])} | {c['logLossGain']:+.6f} | {interval(c['logLossGain95'])} |")
    lines += ["", "The study feature reduces average Brier loss, but every paired interval spans zero. Its calibration error is worse than calibration alone. The smaller one-coefficient correction also has an interval spanning zero and increases the overall overforecast bias. Neither result supports a production patch.", "",
              "## Precision at the unchanged threshold", "",
              "All four models make zero calls at probability >= 0.90. Coverage and recall are zero; precision and its interval are undefined, not 100% or 0%. The existing verified gate also makes zero calls. There is no demonstrated precision or coverage improvement under the production call contract.", "",
              f"The older heuristic kind forecast calls DP {all_year['legacyKindCalls']['calls']} times and hits {all_year['legacyKindCalls']['hits']}, for {pct(all_year['legacyKindCalls']['precision'])} precision. These are diagnostic kind forecasts, not qualifying 90% calls.", "",
              "Even the study's highlighted same-market DP-Open condition stays far below 90% on the later data:", "",
              "| Market | Close DP after DP Open | Close DP after non-DP Open | DP-Open condition 95% Wilson interval |",
              "| --- | --- | --- | --- |"]
    for market in ("Sridevi Night", "Sridevi", "Milan Day"):
        cond = r["openConditionalRates"][market]
        a, b = cond["dpOpen"], cond["nonDpOpen"]
        lines.append(f"| {market} | {a['hits']}/{a['n']} = {pct(a['observed'])} | {b['hits']}/{b['n']} = {pct(b['observed'])} | {pct(a['wilson95'][0])} to {pct(a['wilson95'][1])} |")
    lines += ["", "Non-DP includes TP. The study's SP label was shorthand for non-DP; this evaluation does not silently treat TP as DP or exclude it from the negative class.", "",
              "## Later and recent blocks", "",
              "| Block | Outcomes / weekdays | Production Brier | Calibration Brier | Calibration + feature Brier | One-coefficient Brier | Feature gain over calibration, 95% interval |",
              "| --- | --- | --- | --- | --- | --- | --- |"]
    for key in ("retrospective2026", "postStudy", "last30", "last90"):
        b = r["blocks"][key]
        m, c = b["models"], b["comparisons"][1]
        lines.append(f"| {key}, {b['start']} to {b['end']} | {b['n']} / {b['dates']} | {m['production']['brier']:.6f} | {m['calibrated']['brier']:.6f} | {m['with_feature']['brier']:.6f} | {m['offset_feature']['brier']:.6f} | {c['brierGain']:+.6f}, {interval(c['brierGain95'])} |")
    lines += ["", "The post-study block has only 48 outcomes on five weekdays, so it cannot establish long-term performance. It worsens both Brier and log loss for the new feature. Recent 30/90-day windows overlap the main audit and are descriptive, not extra independent replications.", "",
              "## Market stability", "",
              "Positive gain means improvement. These are diagnostics, not market routes selected for production.", "",
              "| Market | Outcomes | Feature Brier gain over calibration | One-coefficient Brier gain over production |",
              "| --- | --- | --- | --- |"]
    for market, models in r["byMarket"].items():
        lines.append(f"| {market} | {models['production']['n']} | {models['calibrated']['brier'] - models['with_feature']['brier']:+.6f} | {models['production']['brier'] - models['offset_feature']['brier']:+.6f} |")
    lines += ["", "The calibrated feature regresses in Kalyan, Kalyan Night and Time Bazar. Its largest improvement is in Sridevi Night. Four of ten calendar-month blocks regress against calibration alone. Full monthly scores, fixed calibration bins, fit-market coverage, coefficients and call diagnostics are in [results.json](results.json). No market-specific promotion is justified by these reused diagnostics.", "",
              "## Verification and reproduction", "",
              f"The fast replay matched the full `analyzeMarket` Close kind output on {replay['parityChecks']} market/date samples covering fit and test periods. Checks compare probability, predicted kind, confidence and DP bias. Focused tests verify current/future Close exclusion, weekend exclusion from the study state, TP/non-DP handling, missing-Open fallback, undefined zero-call precision, saved predictions, metrics, source/code hashes and the closed gate.", "",
              "The frozen source and compressed prediction ledgers are included. The fit outputs do not touch production source, weights, thresholds, panel rankings or app behavior. Reproduce without fetching new data:", "",
              "```powershell", "node research/dp_open_close_v1/replay.cjs",
              "python research/dp_open_close_v1/evaluate.py", "python research/dp_open_close_v1/report.py",
              "python research/dp_open_close_v1/verify.py", "```", "",
              "Use the saved Python dependency versions in `results.json`. The optional `--freeze-source` command rebuilds the source from the local daily-slate inputs and October 8 snapshot; the source/code hashes record exactly what was scored.", "",
              "## Production decision", "",
              "Leave the current model and 90% call gate unchanged. Keep this feature as a research candidate. Before reconsidering a probability-only change, freeze the candidate and score a new forward period with the same-market Open captured before Close. Require a stable paired gain over calibration alone and adequate coverage. Before enabling verified DP calls, separately demonstrate supported 90% precision on later outcomes. A same-day association at roughly 41%-42% does not satisfy that requirement.", ""]
    (HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
