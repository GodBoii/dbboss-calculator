# Universal Prediction Model Improvement Audit

Generated: 2026-07-11  
Decision: **retain the current production model; do not promote another candidate in this cycle**

## Executive result

The repository already contains a broad research program covering statistical, rule-based, transition, calendar, cross-market, regime, supervised, nonlinear, ensemble, and abstention models. The strongest production improvement is the unified Top-6 sutta ranking. It improves the exact walk-forward baseline in every aggregate evaluation window tested.

No additional candidate has enough temporally stable out-of-sample evidence to replace it. In particular, none of 48 audited two-digit elimination experiments proved a deployable 80% strict strategy. The strongest isolated non-hindsight pocket scored 76.7% (23/30), but its rolling, multiple-search-adjusted result was not significant (bootstrap p=0.4628).

The data cache used by these reports contains 12 markets and 7,287 rows. The latest completed result varies by market from 2026-07-03 through 2026-07-05. All two-year comparisons use only July 2024 onward. Every scored prediction uses records strictly earlier than its target date.

## 1. Current system architecture

1. `src/app/api/scrape/route.ts` fetches and parses market panel charts.
2. `src/lib/db.ts` normalizes and dates panel records.
3. `src/lib/predictor/analyze.ts` orchestrates panel scoring, market context, calibration, kind prediction, and Jodi adjustment.
4. `src/lib/predictor/scoring.ts` ranks the 220-panel universe using frequency, recency, drought, popularity, kind, operator, and market-specific evidence.
5. `src/lib/predictor/dp-kind-context.ts` and `precision-kind-overrides.ts` estimate SP/DP context and apply guarded overrides.
6. `src/lib/predictor/jodi.ts` adjusts Close rankings after an Open result is known.
7. `src/lib/sutta-model/*` produces one deterministic ten-digit ranking. Every Top-N result is a prefix of this ranking.
8. `src/lib/backtest.ts` evaluates predictions walk-forward, including panel, sutta, kind, rank, and Jodi metrics.

Known technical constraints:

- The displayed normalized rating is a relative score share, not an empirically calibrated probability.
- Several market-specific Top-6 rules are simple selectors and can drift.
- The upstream chart is an observational result source; the repository has no betting-ledger/liability data, so claims about operator intent are hypotheses rather than identified causes.
- Searching many hypotheses creates a severe false-discovery risk; isolated holdout wins are not sufficient.

## 2. Baseline versus improved performance

### Aggregate exact walk-forward Top-6 coverage

| Window | N | Open baseline | Current | Close baseline | Current | Jodi baseline | Current | Adjusted Close baseline | Current |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 days | 72 | 69.4% | **75.0%** | 56.9% | **69.4%** | 43.1% | **56.9%** | 56.9% | **63.9%** |
| 30 days | 309 | 63.4% | **72.2%** | 60.2% | **66.3%** | 42.4% | **49.5%** | 60.8% | **63.1%** |
| 180 days | 1,855 | 61.1% | **64.5%** | 57.9% | **61.9%** | 36.3% | **40.1%** | 58.5% | **61.5%** |
| 365 days | 3,641 | 61.9% | **63.1%** | 58.4% | **60.8%** | 37.0% | **38.4%** | 58.7% | **59.9%** |
| 730 days | 6,687 | 61.2% | **62.3%** | 58.7% | **60.8%** | 36.4% | **38.0%** | 58.7% | **59.6%** |

Random coverage is 60% for six of ten suttas and 36% for the 36 Jodis formed by six Open × six Close digits. These are coverage baselines, not profitability estimates. The two-year current lift is +1.1 points Open, +2.1 Close, +1.6 Jodi, and +0.9 Adjusted Close. Adjusted Close remains below the 60% nominal coverage baseline over two years and is not a proven edge.

### Latest 30-day current model by market

| Market | N | Open | Close | Jodi | Adjusted Close |
|---|---:|---:|---:|---:|---:|
| Sridevi | 30 | 73.3% | 60.0% | 50.0% | 63.3% |
| Time Bazar | 26 | 80.8% | 80.8% | 73.1% | 80.8% |
| Madhur Day | 30 | 60.0% | 63.3% | 43.3% | 63.3% |
| Milan Day | 26 | 80.8% | 65.4% | 53.8% | 61.5% |
| Rajdhani Day | 26 | 76.9% | 69.2% | 50.0% | 73.1% |
| Kalyan | 26 | 73.1% | 65.4% | 53.8% | 46.2% |
| Sridevi Night | 30 | 80.0% | 66.7% | 50.0% | 70.0% |
| Kalyan Night | 19 | 63.2% | 73.7% | 42.1% | 68.4% |
| Madhur Night | 26 | 69.2% | 69.2% | 50.0% | 69.2% |
| Milan Night | 26 | 69.2% | 65.4% | 46.2% | 65.4% |
| Rajdhani Night | 22 | 77.3% | 77.3% | 59.1% | 77.3% |
| Main Bazar | 22 | 59.1% | 54.5% | 31.8% | 54.5% |
| **All markets** | **309** | **72.2%** | **67.3%** | **50.5%** | **66.0%** |

The final row is the independently rerun unified-ranking integration result. Small differences from the research snapshot above (66.3/49.5/63.1) arise from the final unified ranking contract and must not be silently pooled.

## 3. Best current model and features by market

The production model is deliberately market- and side-specific. A blank specialized entry means the canonical panel-derived ranking remains active.

| Market | Open Top-6 specialization | Close Top-6 specialization | Known-Open Close specialization | Most useful validated evidence |
|---|---|---|---|---|
| Sridevi | canonical | canonical | canonical | canonical ranking; Sunday SP suppression context |
| Time Bazar | calendar date | canonical | canonical | date-of-month Open frequency |
| Madhur Day | calendar date | recent-30 cold | recent-30 cold | calendar Open; short-window Close reversal |
| Milan Day | canonical | canonical | canonical | canonical ranking; no durable replacement |
| Rajdhani Day | calendar date | previous-Close delta | known-Open Bayesian blend | calendar, delta, known-Open conditional |
| Kalyan | canonical | calendar date | canonical | date-of-month Close frequency |
| Sridevi Night | calendar date | recent-30 cold | canonical | calendar Open; short-window Close reversal |
| Kalyan Night | calendar date | recent-30 cold | known-Open conditional | calendar, recent frequency, Open→Close |
| Madhur Night | canonical | recent-30 cold | recent-30 cold | short-window Close reversal |
| Milan Night | calendar date | recent-30 cold | recent-30 cold | recent/calendar signal, under drift watch |
| Rajdhani Night | calendar date | recent-30 cold | recent-30 cold | strongest recent and long-window lift |
| Main Bazar | calendar date | canonical | canonical | date-of-month Open frequency |

Feature importance here means validated model-selection importance, not causal importance. The most repeatedly useful families are recent 30/60 frequency, date-of-month frequency, previous-result delta, known-Open conditional Close distribution, weekday context, long-run base rate, and cross-market context. Drought is retained as explanatory evidence and a tie/context signal, not as proof that a digit is “due.”

## 4. Ranked hypothesis decisions

### Retain

| Rank | Hypothesis | Evidence | Decision |
|---:|---|---|---|
| 1 | Market-specific Top-6 selection | Aggregate improvement in all 7/30/180/365/730-day windows | Keep with per-market fallbacks |
| 2 | Calendar-date Open frequency | Material gains in several markets; +45.5 points for Rajdhani Night Open in the latest 30-day comparison, +2.9 over two years | Keep only configured markets |
| 3 | Recent-30 cold Close ranking | Durable aggregate Close gain; useful in multiple night markets | Keep, monitor drift |
| 4 | Previous-Close delta | Selected for Rajdhani Day Close | Keep locally |
| 5 | Known-Open conditional Close | Useful for Kalyan Night; Bayesian blend for Rajdhani Day | Keep after Open only |
| 6 | SP-biased kind thresholds | 72.7% kind accuracy versus 63.1% baseline over 594 final-window cases | Keep as conservative kind layer; DP recall is only 10.1% |
| 7 | Sunday SP suppression | Two-year Sunday DP rates 17.6% Open and 14.0% Close | Keep as context, not a standalone oracle |
| 8 | Open→Close digit carry | Large observational separation (6.9%–30.3% Close-DP rate by carry pattern) | Research/after-Open use only; prevent leakage |

### Reject or quarantine

| Family | Best forward evidence | Decision |
|---|---|---|
| Opposite, 0–4/5–9 houses, odd/even, high/low | Best isolated constrained selector 70.0% (21/30); no viable ≥80% gate | Reject standalone |
| Markov/transition | 51.9% overall (932/1,797); tiny selected pocket 75.7% (28/37) | Reject production gate |
| Weekday selector | 52.3% (661/1,264) | Reject standalone |
| Calendar buckets | 58.1% (61/105) | Reject broad rule; retain only independently selected date models |
| Cross-market lead/lag | 53.3% (16/30) | Reject standalone |
| Streak/cycle | 60.0% (18/30) | Reject |
| Previous-result transforms | 55.0% (99/180) | Reject broad transform search |
| Regime/volatility | 65.0% (26/40) | Quarantine; insufficient durability |
| Latent regimes | 66.7% (20/30) | Quarantine; insufficient support |
| Change-point models | 52.7% (743/1,410) | Reject |
| Multivariate market kNN | 49.7% (686/1,380) | Reject |
| Nonlinear classifier | 51.2% (569/1,112) | Reject |
| Randomized forest | isolated 63.5% (40/63) | Reject after search correction |
| Temporal reservoir | 60.6% (43/71) | Reject |
| Symbolic sequence grammar | 54.5% (42/77) | Reject |
| Adaptive expert ensemble | 48.3% (87/180) | Reject |
| Validation portfolio | isolated 76.7% (23/30), rolling 66.3% (63/95), corrected p=0.4628 | Reject deployment; forward-register only |

## 5. Confidence calibration

- The current UI rating is a temperature-scaled relative share of model score. It should be labeled **rating**, not “chance” or “probability.”
- Top-6 empirical coverage should be reported by market, side, and rolling window, with Wilson intervals.
- A useful calibration table needs out-of-sample rows binned by predeclared rating deciles. That artifact does not yet exist; therefore Brier score, expected calibration error, and reliability slope are **not available** and must not be invented.
- Kind confidence is directionally interpretable, but the model is conservative: the improved kind layer reached 72.7% overall accuracy largely through 95.4% SP recall, while DP recall fell to 10.1%.

## 6. Failure analysis

The dominant failure mode is false discovery from repeated model search. Attractive 20–30-row pockets frequently collapse in rolling tests. The permutation audit demonstrates this directly: an isolated 23/30 result has nominal p=0.0060, yet the rolling portfolio search has corrected p=0.4628.

Other recurring failures:

- **Regime drift:** Milan Night loses 0.4 Open, 0.5 Close, 3.6 Jodi, and 1.6 Adjusted-Close points over two years despite recent gains.
- **Base-rate exploitation mistaken for prediction:** SP kind accuracy can rise while DP recall approaches zero.
- **Information leakage risk:** same-day later-market or known-Open features are only legal if they were observable before the target draw.
- **Sample fragmentation:** market × side × weekday × context trees quickly produce unsupported leaves.
- **Causal overstatement:** operator-liability narratives are not verifiable without stake/liability records.
- **Metric confusion:** Top-6 coverage does not establish positive expected monetary value.

## 7. Research journal summary

The audited journal contains 48 consolidated experiment artifacts plus the panel/SP-DP and Top-6 research suites. It covers 324-formula searches, 134-model ranker research, Markov chains, fixed-pair and contextual selectors, calendar and weekday effects, panel shape, house/opposite mappings, cross-market graphs, kNN, supervised nonlinear models, forests, reservoir dynamics, symbolic sequences, regime/change-point methods, ensembles, abstention gates, false-discovery tests, and frozen forward registers.

Successful work was promoted only through market-specific fallback. Failed work remains documented in `scratch/two-digit-research-master-audit.md` with its evidence file and strict result.

## 8. Self-critique and remaining weaknesses

- The latest cache ends up to eight days before this audit date; no claim here is a live-result forecast.
- Aggregate windows overlap, so they demonstrate temporal breadth but are not independent replications.
- The original baseline and improved model were developed in the same broader research program; fully pristine prospective evidence is still limited.
- Multiple hypothesis correction was applied to the two-digit search, but not uniformly to every historical rule in the repository.
- Precision/recall are meaningful for SP/DP, but not directly for multiclass Top-6 coverage unless a one-vs-rest definition is fixed.
- Festival/holiday hypotheses lack a versioned, authoritative calendar feature table and remain untested.
- Year-over-year same-date tests have too little two-year-window support for market-specific deployment.

## 9. Prioritized roadmap

1. Keep the production ranking frozen and score the existing forward registers on genuinely new results.
2. Add a versioned evaluation ledger containing prediction timestamp, feature cutoff, model hash, ranking, rating, and realized result.
3. Add rating-decile calibration reports (Brier score, ECE, reliability plot) without changing ranking.
4. Require rolling multi-block improvement, minimum support, and family-wise false-discovery control before promotion.
5. Add automatic drift alarms for market-side degradation, especially Milan Night and Main Bazar.
6. Build an authoritative holiday/festival feature table, pre-register the tests, then run them once.
7. Evaluate profitability separately using explicit payout and stake assumptions; do not infer it from hit rate.
8. Promote a new market-side model only if it beats the current model in repeated forward blocks and never use the scored block itself as a fallback-selection guard.

## 10. Verification

- `npm run verify:sutta-ranking`: passed for all markets and Top counts 1–10.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 0 errors and 7 pre-existing warnings.
- `npm run build`: passed on Next.js 16.2.6; `/api/scrape` is dynamic and the application pages build successfully.

## Evidence index

- `backtest_reports/2026-07-10/top6-sutta-model-research.md`
- `backtest_reports/2026-07-11/unified-ranking-30d.md`
- `backtest_reports/2026-07-07/sp-dp-model-deep-research.md`
- `backtest_reports/2026-06-28/sp-dp-pattern-research.md`
- `scratch/two-digit-research-master-audit.md`
- `scratch/two-digit-permutation-false-discovery-audit-output.json`
- `scratch/sutta-baseline-{7,30,183,365,730}d*.json`

