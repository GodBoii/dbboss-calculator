# Open/Close Exact-Panel Model Improvement

Generated: 2026-07-12

## Executive result

The production Open exact-panel ranker was replaced by a validated, leakage-safe market-profile model. The Close ranker was deliberately retained because its strongest development/validation challenger regressed on the final 30-day holdout.

On the last 30 available calendar days per market (309 market draws):

| Target | Previous Top-30 | Improved Top-30 | Change |
|---|---:|---:|---:|
| Open panel | 46/309 (14.9%) | **60/309 (19.4%)** | **+14 hits, +4.5 points** |
| Close panel | 56/309 (18.1%) | **56/309 (18.1%)** | no change |
| Open + Close | 102/618 (16.5%) | **116/618 (18.8%)** | **+14 hits, +2.3 points** |

The 30-of-220 nominal random-coverage reference is 13.64%. It is a coverage reference, not evidence of profitability.

## Data and leakage controls

- Source: the repository's frozen `scratch/open-sutta-records-cache.json`.
- Markets: 12.
- Completed rows: 7,287.
- Latest available result: 2026-07-03 through 2026-07-05, depending on market schedule.
- Minimum training history: 50 earlier market rows.
- Development: target age at least 213 days.
- Validation: target age 30 through 212 days.
- Final holdout: target age 0 through 29 days.
- Every target was scored using only rows with a date strictly before the target date.
- The 0.35 opposite-digit coefficient was selected on validation. Although 0.50 happened to score higher on holdout, it was not substituted after seeing holdout.

## Baseline and improved Open results

| Block | N | Previous | Improved | Change |
|---|---:|---:|---:|---:|
| Development | 4,520 | 691 (15.3%) | **850 (18.8%)** | +159, +3.5 points |
| Validation | 1,858 | 302 (16.3%) | **336 (18.1%)** | +34, +1.8 points |
| Final 30 days | 309 | 46 (14.9%) | **60 (19.4%)** | +14, +4.5 points |
| Full two-year path | 6,687 | 1,039 (15.5%) | **1,246 (18.6%)** | +207, +3.1 points |

The Open improvement is not caused by merely rearranging ranks 11-30:

| Final 30-day metric | Previous | Improved |
|---|---:|---:|
| Top-3 | 3/309 (1.0%) | **4/309 (1.3%)** |
| Top-10 | 11/309 (3.6%) | **14/309 (4.5%)** |
| Top-30 | 46/309 (14.9%) | **60/309 (19.4%)** |

Seven of eight pre-holdout rolling 90-day blocks improved. Their Top-30 hit deltas, newest first, were `+18, +14, +46, +37, +45, +19, +17, -3`. The one negative block was the earliest and smallest block (109 cases).

Paired exact-test results were development p=0.00000053, validation p=0.109, and holdout p=0.135. The final month is directionally positive but not independently significant at 5%; it should be monitored prospectively rather than described as proof of a fixed number law.

## Final 30-day market comparison

| Market | N | Open previous | Open improved | Open delta | Close retained |
|---|---:|---:|---:|---:|---:|
| Sridevi | 30 | 3 | 5 | +2 | 5 |
| Time Bazar | 26 | 4 | 5 | +1 | 3 |
| Madhur Day | 30 | 4 | 7 | +3 | 8 |
| Milan Day | 26 | 4 | 7 | +3 | 5 |
| Rajdhani Day | 26 | 6 | 5 | -1 | 5 |
| Kalyan | 26 | 8 | 5 | -3 | 2 |
| Sridevi Night | 30 | 6 | 7 | +1 | 4 |
| Kalyan Night | 19 | 1 | 5 | +4 | 5 |
| Madhur Night | 26 | 5 | 6 | +1 | 5 |
| Milan Night | 26 | 2 | 3 | +1 | 7 |
| Rajdhani Night | 22 | 3 | 3 | 0 | 2 |
| Main Bazar | 22 | 0 | 2 | +2 | 5 |
| **All markets** | **309** | **46** | **60** | **+14** | **56** |

The Open model improved or tied in 10 of 12 markets. Rajdhani Day and Kalyan regressed in this particular holdout, so they require drift monitoring; the model is not claimed to be uniformly better for every market-month.

## Accepted Open formula

For every possible panel `p`:

```text
profile(p) =
    log(longRunPanelCount(p) + 1.5)
  + 0.45 * sum(log(positionDigitCount + 2))
  + 0.25 * sum(log(positionPairCount + 1))
  + 0.25 * log(suttaCount(p) + 2)
  + 0.20 * log(kindCount(p) + 2)
  + 0.35 * oppositeDigitOverlap(p, previousOpenPanel)
```

Panels are ranked by this score, then long-run exact-panel count, then panel number for deterministic ties. The previous scorer's score envelope is retained, so the rank-only layer does not manufacture larger confidence values.

Interpretation:

- Exact-panel frequency supplies a smoothed market-specific prior.
- Position and pair terms share evidence with panels that have similar structure, reducing sparse-count instability.
- Sutta and SP/DP kind terms provide broad structural shrinkage.
- The opposite mapping `0<->5, 1<->6, 2<->7, 3<->8, 4<->9` is a small tie/refinement term, not the main model.

## Hypotheses tested

Top-30 results are shown as development / validation / holdout hits.

| Hypothesis | Open | Close | Decision |
|---|---:|---:|---|
| Existing production model | 691 / 302 / 46 | 719 / 306 / 56 | Baseline |
| Long-run hot exact panels | 775 / 329 / 45 | 764 / 359 / 49 | Reject alone; Open holdout tie/regression, Close regression |
| Recent-30 hot | 729 / 317 / 45 | 715 / 267 / 41 | Reject |
| Recent-60 hot | 754 / 319 / 48 | 731 / 330 / 53 | Reject |
| Recent-120 hot | 754 / 311 / 40 | 713 / 325 / 54 | Reject |
| Weekday panel frequency | 738 / 297 / 32 | 739 / 335 / 50 | Reject |
| Same calendar-date frequency | 765 / 325 / 48 | 745 / 328 / 52 | Reject alone |
| Smoothed panel profile | 839 / 325 / 55 | 851 / 380 / 54 | Keep as Open component; reject Close promotion |
| Previous-panel digit repeat | 844 / 326 / 52 | 849 / 380 / 51 | Reject |
| Previous-panel digit avoidance | 824 / 330 / 49 | 847 / 379 / 50 | Reject |
| Profile + opposite digits | **850 / 336 / 60** | 830 / 376 / 47 | **Keep for Open; reject for Close** |

The Close profile challenger looked strong before holdout (15.9% to 18.8% development and 16.5% to 20.5% validation) but fell from 18.1% to 17.5% in the final month. Deploying it would have violated the no-regression rule.

## Coefficient sensitivity

All predeclared opposite-digit weights improved final-month Open Top-30 coverage over the 46-hit baseline:

| Weight | Validation hits | Holdout hits |
|---:|---:|---:|
| 0.15 | 334 | 57 |
| 0.25 | 335 | 61 |
| **0.35** | **336** | **60** |
| 0.50 | 331 | 64 |
| 0.75 | 332 | 60 |

This sensitivity pattern reduces concern that the result depends on one exact coefficient. Production remains at 0.35 because it was the validation winner.

## Remaining weaknesses and monitoring

- The cache is not a live feed and ends up to nine days before this report.
- Validation and holdout improvements are not independently significant at 5% after paired testing.
- Many hypotheses were searched; false-discovery risk remains even with the frozen holdout.
- The same two-year history influenced model development, so genuinely prospective scoring is still required.
- Exact-panel Top-30 coverage does not demonstrate positive expected value after payouts and the cost of 30 selections.
- Add a versioned forward ledger and monitor Rajdhani Day, Kalyan, and Close drift before any further promotion.

## Reproducibility and verification

- Research harness: `scripts/panel-ranking-research.cjs`
- Machine-readable metrics and paired ledger: `scratch/panel-ranking-research-output.json`
- Production ranker: `src/lib/predictor/panel-profile.ts`
- Integration: `src/lib/predictor/analyze.ts`
- `npx tsc --noEmit`: passed.
- `npm run verify:sutta-ranking`: passed for all markets and Top counts 1-10.
- `npm run lint`: 0 errors and 7 pre-existing warnings.
- `npm run build`: passed on Next.js 16.2.6.
- Independent production-path final-month replay: Open `4/14/60` and Close `4/16/56` at Top-3/10/30, exactly matching the research result.
