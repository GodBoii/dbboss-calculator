# Independent DP prediction audit

## Result

None of the policies selected on 2025 reached 90% DP precision on the 2026 holdout. A DP-only display should abstain unless a new, prospective evaluation clears that bar.

The label is DP when a three-digit panel has exactly two distinct digits. SP and TP are both negative labels. The audit predicts no panel number and evaluates Open and Close separately as DP/not-DP outcomes.

## Data and test design

The audit read the existing `research/dp_only_v1/chart_rows.csv`. It contains 41,475 dated draws and 82,950 panel outcomes from 22 markets, through 2026-09-24. The 12 app markets account for 23,699 draw rows; 10 additional markets account for 17,776. The independent parser found no duplicate rows, conflicting keys, malformed dates, or non-three-digit panels in the saved export.

The earlier collector says it removed 49 conflicting chart rows and 43 rows where Jodi disagreed with the panel sums before saving this export. My duplicate check can only inspect that cleaned file. These checks validate its shape, not the historical results themselves. The export came from one chart provider. The prior collection report says the preferred `dpbossss.boston` pages redirected to a `dpboss.tax` host. The saved data has no second-source verification or publication timestamps. Historical charts can be revised.

The main scenario uses only information available before the target day's first draw. A second scenario includes same-day results whose configured event minutes in `src/lib/market-schedule.ts` are strictly earlier than the target. The archive has no publication timestamps, so the second scenario assumes those results were actually available by their scheduled times. That assumption is unverified.

The split is chronological: train through 2024-12-31, validation during 2025, and a retrospective 2026 holdout through 2026-09-24. Rules require at least 100 training calls, 30 validation calls, and 20 active validation dates. Model thresholds require at least 30 validation calls and 20 active dates. Numeric rule cutoffs come from training values. Validation selects the policy and threshold; 2026 is scored afterward. An early disposable run exposed an availability leak in the audit harness, so this is not a blinded, preregistered trial. The corrected start-of-day search excludes every same-day result feature.

## Search coverage

The search used 77 start-of-day and 85 schedule-aware feature columns across calendar, market/side, state transitions, rolling DP rates and gaps, prior-panel digit geometry, opposite-side history, and cross-market history. It evaluated 3,516 start-of-day rule configurations and 3,727 schedule-aware configurations, plus five model families at 80 thresholds each in both scenarios. These settings are correlated variants, not thousands of independent theories or experiments.

Confidence intervals include exact two-sided 95% binomial intervals and a weekly block bootstrap to reflect some within-week dependence. Both remain retrospective estimates from one provider's chart history.

## Results on the 12 app markets

| Scenario and validation-selected policy | Validation | 2026 holdout | Exact 95% interval | Weekly block 95% interval |
| --- | ---: | ---: | ---: | ---: |
| Start-of-day best rule: February for Time Bazar and prior 500-event DP rate at least 24% | 20/42, 47.6% | 8/31, 25.8% | 11.9%–44.6% | 20.0%–30.8% |
| Start-of-day daily rule: prior 60-event DP rate at most 16.7% | 209/870, 24.0% | 98/426, 23.0% | 19.1%–27.3% | 18.7%–27.4% |
| Schedule-aware best rule: Sridevi Night Open on Wednesdays after prior scheduled Opens meet its rate gate | 21/45, 46.7% | 9/36, 25.0% | 12.1%–42.2% | 11.1%–38.9% |
| Schedule-aware daily rule: previous opposite-side DP and same-day earlier DP rate at least 50% | 84/261, 32.2% | 84/266, 31.6% | 26.0%–37.5% | 26.0%–36.8% |

The validation-selected histogram gradient boosting threshold produced 113 correct calls out of 337 in the start-of-day scenario, or 33.5% (exact 95% interval 28.5%–38.9%). In the schedule-aware scenario, logistic regression produced 475/1,706 calls, or 27.8%. The validation-selected random-forest threshold produced 98/284, or 34.5% (exact interval 28.99%–40.35%). No model approached 90%.

## Daily calls

The schedule-aware daily rule produced 5–10 calls on 16 holdout dates, 41 correct out of 94 calls across those dates, and **zero dates at 70% precision or higher**. This includes the user's examples such as 5/7 and 7/9, which exceed 70% on a single date. The rule's full 2026 result was 84/266, or 31.6%.

The schedule-aware logistic model produced 5–10 calls on 135 holdout dates. It had 275 correct calls out of 996 in that bucket; only 3 of the 135 dates reached 70%, and one date was perfect. Across all calls it was 475/1,706, or 27.8%. Isolated perfect days appeared, but they were rare beside the overall false-call rate.

## Files

- `run_independent.py` reproduces feature creation, selection, and scoring from the saved CSV.
- `results.json` contains split counts, per-market source coverage, selected policies, model results, confidence intervals, and daily call-count buckets.
- `start_of_day_rule_validation.csv` and `schedule_aware_rule_validation.csv` list eligible rules ranked using 2025 only. They do not contain 2026 scores for every candidate.

To support a 90% claim, freeze the rule first, log every prospective Open and Close decision including abstentions, and accumulate enough independent dates and calls for the lower confidence bound to clear 90%. The existing historical export does not show that level of precision.
