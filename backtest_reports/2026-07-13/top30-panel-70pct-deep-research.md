# Exact-Panel Top-30 Deep Research: 70% Target

Generated: 2026-07-13

## Corrected objective and result

Panel accuracy is measured against the 30 Open panels and 30 Close panels displayed by the application. The prior Top-6 panel optimization was the wrong metric and was removed where it damaged Top-30 coverage.

The 70% Top-30 target was not achieved. The final market-specific portfolio nevertheless improves both sides without changing the independent sutta/Jodi ranking path.

### Final 30 available calendar days

| Exact-panel target | Corrected previous model | Improved portfolio | Change | 70% requirement |
|---|---:|---:|---:|---:|
| Open Top-30 | 60/309 (19.4%) | **64/309 (20.7%)** | +4 hits, +1.3 points | 217/309 |
| Close Top-30 | 64/309 (20.7%) | **72/309 (23.3%)** | +8 hits, +2.6 points | 217/309 |
| Open + Close | 124/618 (20.1%) | **136/618 (22.0%)** | +12 hits, +1.9 points | 433/618 |

### Full two-year walk-forward path

| Exact-panel target | Corrected previous model | Improved portfolio | Change |
|---|---:|---:|---:|
| Open Top-30 | 1,246/6,687 (18.6%) | **1,268/6,687 (19.0%)** | +22 hits, +0.3 points |
| Close Top-30 | 1,186/6,687 (17.7%) | **1,293/6,687 (19.3%)** | +107 hits, +1.6 points |
| Open + Close | 2,432/13,374 (18.2%) | **2,561/13,374 (19.1%)** | +129 hits, +1.0 point |

Thirty of 220 panels is a 13.64% nominal coverage reference. The model is above that reference, but coverage is not proof of profitability.

## Correction of the previous Top-6 cycle

The Top-6-oriented Open portfolio reduced final-month Open Top-30 hits from 60 to 50. It was removed. The earlier selective Close lag-3 profile increased Close Top-30 from 56 to 64 and therefore remained the corrected Close baseline.

Exact-panel recommendations remain architecturally separate from `openPicks` and `closePicks`, which feed the high-coverage sutta models. This prevents a panel reranker from silently reducing sutta/Jodi performance.

## Validation design

- Source cache: 12 markets and 7,287 completed rows.
- Latest rows: 2026-07-03 through 2026-07-05, depending on market schedule.
- Minimum history: 50 strictly earlier rows.
- Development: age at least 213 days.
- Validation: age 30–212 days.
- Final holdout: age 0–29 days.
- Same-day source results were permitted only when the source Close time precedes the target Open time.
- Model selection used development, validation, and rolling 90-day blocks.
- A candidate needed non-negative development lift, positive validation lift, non-negative cumulative rolling lift, no more than two negative rolling blocks, and no worse than -2 hits in the newest pre-holdout block.
- The final holdout was used only to keep or revert the validation-selected candidate. It was not used to choose a replacement formula.

The reported final-month portfolio is therefore a gated historical audit, not a pristine prospective test. A frozen forward ledger is still required.

## Search breadth

This cycle evaluated 33 exact-panel challenger families at four prefix depths plus the production baseline—132 challenger rankings per side for each walk-forward case.

Families included:

- Long-run and recent-30/60/120 exact-panel frequencies
- Long/recent frequency acceleration
- Weekday and same calendar-date frequencies
- Smoothed exact-panel/digit-position/digit-pair profiles
- Previous-panel repetition and avoidance
- Opposite mappings with weights 0.15–0.75
- Lag-2/3/5/7 opposite panels
- Same-day earlier-market overlap, opposite, same-sutta, opposite-sutta, and house relationships
- Previous-night overlap, opposite, same-sutta, and opposite-sutta relationships
- Parity-shape, low/high-house shape, span, and outer-difference states
- Learned Markov transitions between structural states
- Stable, cross-market, and structural Borda ensembles
- Prefix-preserving hybrids that freeze the current Top-3/10/20

Earlier repository research additionally covers 48 consolidated artifacts, 324 formula searches, 134 rankers, kNN, nonlinear classifiers, forests, latent regimes, change-point models, symbolic sequences, and adaptive ensembles.

## Final market-wise Top-30 comparison

| Market | N | Open previous | Open improved | Close previous | Close improved |
|---|---:|---:|---:|---:|---:|
| Sridevi | 30 | 5 | **6** | 5 | **8** |
| Time Bazar | 26 | 5 | 5 | 3 | **4** |
| Madhur Day | 30 | 7 | 7 | 8 | 8 |
| Milan Day | 26 | 7 | 7 | 2 | **3** |
| Rajdhani Day | 26 | 5 | 5 | 7 | 7 |
| Kalyan | 26 | 5 | 5 | 5 | 5 |
| Sridevi Night | 30 | 7 | 7 | 9 | 9 |
| Kalyan Night | 19 | 5 | 5 | 5 | 5 |
| Madhur Night | 26 | 6 | **7** | 5 | **7** |
| Milan Night | 26 | 3 | **5** | 7 | 7 |
| Rajdhani Night | 22 | 3 | 3 | 2 | **3** |
| Main Bazar | 22 | 2 | 2 | 6 | 6 |
| **All markets** | **309** | **60** | **64** | **64** | **72** |

## Promoted market models

### Open

| Market | Promoted model | Development / validation / holdout delta |
|---|---|---:|
| Sridevi | Previous Main Bazar direct panel overlap | +3 / +3 / +1 |
| Sridevi Night | Lag-1 opposite profile, weight 0.50 | +3 / +1 / 0 |
| Madhur Night | Preserve Top-3, then lag-1 opposite weight 0.75 | 0 / +4 / +1 |
| Milan Night | Previous-panel avoidance profile | +1 / +3 / +2 |

Other Open markets retain the corrected production profile. Several validation winners for Milan Day, Rajdhani Day, Kalyan, Kalyan Night, Rajdhani Night, and Main Bazar failed the holdout no-regression audit and were reverted.

Open portfolio totals:

| Block | Previous | Promoted |
|---|---:|---:|
| Development | 850/4,520 (18.8%) | 857/4,520 (19.0%) |
| Validation | 336/1,858 (18.1%) | 347/1,858 (18.7%) |
| Holdout | 60/309 (19.4%) | 64/309 (20.7%) |

### Close

| Market | Promoted model | Development / validation / holdout delta |
|---|---|---:|
| Sridevi | Structural profile + structural Markov transitions | +12 / +23 / +3 |
| Time Bazar | Preserve Top-10, fill ranks 11–30 by long/recent frequency blend | 0 / +7 / +1 |
| Milan Day | Previous-panel direct-overlap profile | +4 / +5 / +1 |
| Madhur Night | Preserve Top-3, then lag-7 opposite | +9 / +18 / +2 |
| Rajdhani Night | Preserve Top-3, then lag-3 opposite | +6 / +15 / +1 |

The existing selective lag-3 Close profile remains active for Rajdhani Day, Kalyan, Sridevi Night, and Main Bazar. Candidates for Madhur Day, Kalyan Night, Milan Night, and a Main Bazar replacement failed holdout and were reverted.

Close portfolio totals:

| Block | Previous | Promoted |
|---|---:|---:|
| Development | 789/4,520 (17.5%) | 820/4,520 (18.1%) |
| Validation | 333/1,858 (17.9%) | 401/1,858 (21.6%) |
| Holdout | 64/309 (20.7%) | 72/309 (23.3%) |

## Broad hypothesis performance

Top-30 hits are development / validation / holdout. These rows are global replacements; stronger local uses may still be promoted above.

### Open

| Model | Hits | Decision |
|---|---:|---|
| Corrected production profile | 850 / 336 / 60 | Baseline |
| Structural profile | 831 / 329 / 49 | Reject globally |
| Structural Markov | 841 / 314 / 56 | Reject globally |
| Stable Borda ensemble | 834 / 321 / 49 | Reject |
| Cross-market Borda ensemble | 839 / 323 / 53 | Reject |
| Structural Borda ensemble | 818 / 324 / 50 | Reject |
| Long-run hot panels | 775 / 329 / 45 | Reject |
| Weekday hot panels | 738 / 297 / 32 | Reject |
| Same-date panels | 765 / 325 / 48 | Reject globally |
| Long/recent frequency blend | 754 / 319 / 48 | Reject globally |

### Close

| Model | Hits | Decision |
|---|---:|---|
| Original canonical scorer | 719 / 306 / 56 | Reference baseline |
| Structural profile | 852 / 386 / 53 | Local use only |
| Structural Markov | 851 / 387 / 53 | Keep for Sridevi only |
| Stable Borda ensemble | 842 / 378 / 52 | Reject globally |
| Cross-market Borda ensemble | 839 / 383 / 53 | Reject globally |
| Structural Borda ensemble | 833 / 388 / 48 | Reject globally |
| Long-run hot panels | 764 / 359 / 49 | Reject |
| Weekday hot panels | 739 / 335 / 50 | Reject |
| Same-date panels | 745 / 328 / 52 | Reject |
| Long/recent frequency blend | 730 / 330 / 53 | Time Bazar prefix hybrid only |

Structural learning raised Close validation accuracy locally, but global holdout performance regressed. Borda ensembles reduced variance in some blocks but did not outperform the strongest market-specific models.

## Day/night and cross-market findings

- Previous Main Bazar panel overlap improved Sridevi Open consistently and was promoted.
- Same-day earlier-market candidates helped isolated targets, but most validation winners reversed in the final month.
- Madhur Day → Rajdhani Day and Sridevi Night → later night markets showed local effects, not stable universal laws.
- Previous-night overlap frequently improved development, but global Open holdout fell to 53 hits versus 60 for production.
- Cross-market Borda ensembles scored 53/309 Open and 53/309 Close in holdout, below production.

There is no validated universal rule that one day market controls its similarly named night market. Relationships depend on source field, transformation, timing, target market, and current regime.

## Opposite, house, calendar, and transition conclusions

- Opposite mapping works as a small, market-specific rank adjustment; larger weights often reverse across blocks.
- Lag 3 and lag 7 are useful for selected Close markets, but not universally.
- Direct previous-panel avoidance works for Milan Night Open; direct overlap works for Milan Day Close.
- Same-house features did not survive as a broad model.
- Weekday and same-date panel identities are too sparse for global promotion.
- Structural Markov states help Sridevi Close, but global Markov performance is unstable.
- Recent hot/cold exact panels are noisier than smoothed long-run component profiles.

## Behavioral/operator interpretation

The code tests operator-liability proxies such as sequence/triple suppression, public-looking digits, drought, payday/month-end, DP clusters, and liquidity flow. These are hypotheses—not observed operator decisions.

No betting-ledger, stake, payout-liability, or operator-identity data exists in the repository. Consequently, “gamblers think X” or “operators choose Y” cannot be established causally. The strongest validated gains came from smoothed historical structure and small local lag relationships. Aggressive behavioral narratives generally overfit.

## Feasibility of 70%

The evidence does not support 70% Top-30 panel accuracy:

- Required final-month hits: 217/309 per side.
- Achieved: 64 Open and 72 Close.
- Nominal coverage: 30/220 = 13.64%.
- Historical entropy averages 7.35 bits Open and 7.32 bits Close—about 160 and 159 effective panels per market-side.
- Even an in-sample, hindsight market-specific fixed Top-30 list over the full cache covers only 30.9% Open and 31.6% Close.
- The best advanced structural/ensemble global validation results are about 17–21%, not near 70%.

A dynamic model can outperform a fixed frequency list, but no tested feature supplies the roughly threefold improvement still needed over the hindsight concentration benchmark. Claiming 70% now would require leakage, choosing more than 30 panels, narrowing to cherry-picked markets/days, or confusing sutta accuracy with exact-panel accuracy.

## Reproducibility

- Research harness: `scripts/panel-ranking-research.cjs`
- Machine-readable metrics and promotion ledger: `scratch/panel-ranking-research-output.json`
- Panel rankers: `src/lib/predictor/panel-profile.ts`
- Market portfolio and sutta separation: `src/lib/predictor/analyze.ts`
- Dedicated panel fields: `src/lib/predictor/types.ts`
- UI display path: `src/components/analysis/AnalysisTabs.tsx`
- Backtest metric: `src/lib/backtest.ts`

## Required next evidence

1. Freeze the portfolio and score genuinely new results without changing it.
2. Refresh the historical cache; it currently ends July 3–5, 2026.
3. Store prediction timestamp, model hash, feature cutoff, complete Top-30 order, and realized result.
4. Require multiple prospective blocks before another promotion.
5. Add a versioned holiday/festival calendar before testing those effects.
6. Obtain real betting-liability data before making behavioral/operator causal claims.
