# Top-6 Sutta and Jodi Model Research

Generated: 2026-07-10

## Executive result

The production Top-6 models improved in every requested evaluation window after exact walk-forward integration testing. The largest durable gains are in Close Sutta and Jodi. The long-run Adjusted Close result improves over the old app but remains below the 60% six-digit coverage baseline, so it should not be described as a proven predictive edge.

| window | n | Open baseline | Open improved | Close baseline | Close improved | Jodi baseline | Jodi improved | Adjusted Close baseline | Adjusted Close improved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7 days | 72 | 69.4% | **75.0%** | 56.9% | **69.4%** | 43.1% | **56.9%** | 56.9% | **63.9%** |
| 30 days | 309 | 63.4% | **72.2%** | 60.2% | **66.3%** | 42.4% | **49.5%** | 60.8% | **63.1%** |
| 6 months | 1,855 | 61.1% | **64.5%** | 57.9% | **61.9%** | 36.3% | **40.1%** | 58.5% | **61.5%** |
| 1 year | 3,641 | 61.9% | **63.1%** | 58.4% | **60.8%** | 37.0% | **38.4%** | 58.7% | **59.9%** |
| 2 years | 6,687 | 61.2% | **62.3%** | 58.7% | **60.8%** | 36.4% | **38.0%** | 58.7% | **59.6%** |

Top-6 random coverage is 60% for a single sutta and 36% for the 36 Jodis formed by six Open × six Close digits. These are coverage baselines, not profitability baselines.

## Scope and data hygiene

- Source: fresh scrape through the app's existing `dpbossss.boston` route handler.
- Markets: all 12 configured markets.
- Refreshed rows: 7,287.
- Latest completed result: 2026-07-03 to 2026-07-05, depending on market schedule.
- Effective two-year test dates: 2024-07-04/06 through 2026-07-03/05.
- Walk-forward rule: every prediction used only records with an ISO date earlier than the scored result.
- Cross-market rule: other-market history was also cut strictly before the target date.
- Minimum history: 50 market records.
- Primary operating point: exactly six Open digits, six Close digits, and their 36 Jodi combinations.
- The unchanged app was tested first and saved before any production source edit.

The window sizes are calendar windows relative to each market's latest completed result. Markets that do not operate every day therefore have fewer scored draws than calendar days.

## Existing system audit

The existing engine first ranks the 220-panel universe separately for Open and Close. Its panel score combines recency, cooldown, sequential/triple/lucky-number penalties, sutta drought state, weekday effects, market volume, temporal mode, liquidity flow, operator-psychology adjustments, and market calibration. SP/DP kind prediction is a separate layer with market, weekday, digit, and cross-market overrides.

The user-facing sutta ticket is not a direct panel Top-6. `AnalysisTabs.tsx` reduces panel rankings to digits and applies market-specific strategies such as same calendar date, previous-result conditionals, gap state, opposite/same house, delta transitions, and score aggregation. Known-open Adjusted Close first re-ranks panels through `computeJodiAnalysis`, then runs a Close sutta builder.

Principal limitations found:

1. The old Top-6 Close and Adjusted Close models were below 60% over one and two years.
2. Static calibration fields describe panel Top-30 history, not the probability that a Top-6 sutta set will hit.
3. Some statistical digit rankings were being sorted a second time by drought-signal priority, partially erasing the model ordering. The new statistical paths bypass that redundant sort.
4. Several older strategy maps were strong in short research windows but weak across the complete two-year walk-forward.
5. Jodi accuracy is mechanically tied to both Open and pre-open Close coverage; it must be optimized as a paired problem.

## Baseline hit counts and improvements

| window | target | baseline hits | improved hits | added hits | percentage-point gain |
| --- | --- | ---: | ---: | ---: | ---: |
| 7 days | Open | 50 | 54 | +4 | +5.6 |
| 7 days | Close | 41 | 50 | +9 | +12.5 |
| 7 days | Jodi | 31 | 41 | +10 | +13.9 |
| 7 days | Adjusted Close | 41 | 46 | +5 | +6.9 |
| 30 days | Open | 196 | 223 | +27 | +8.7 |
| 30 days | Close | 186 | 205 | +19 | +6.1 |
| 30 days | Jodi | 131 | 153 | +22 | +7.1 |
| 30 days | Adjusted Close | 188 | 195 | +7 | +2.3 |
| 6 months | Open | 1,134 | 1,196 | +62 | +3.3 |
| 6 months | Close | 1,074 | 1,149 | +75 | +4.0 |
| 6 months | Jodi | 673 | 743 | +70 | +3.8 |
| 6 months | Adjusted Close | 1,085 | 1,141 | +56 | +3.0 |
| 1 year | Open | 2,253 | 2,296 | +43 | +1.2 |
| 1 year | Close | 2,128 | 2,214 | +86 | +2.4 |
| 1 year | Jodi | 1,346 | 1,399 | +53 | +1.5 |
| 1 year | Adjusted Close | 2,138 | 2,182 | +44 | +1.2 |
| 2 years | Open | 4,094 | 4,163 | +69 | +1.0 |
| 2 years | Close | 3,926 | 4,066 | +140 | +2.1 |
| 2 years | Jodi | 2,433 | 2,540 | +107 | +1.6 |
| 2 years | Adjusted Close | 3,926 | 3,983 | +57 | +0.9 |

## Last-30 market performance

Each cell is baseline → improved Top-6 accuracy. Unchanged cells are markets retained on their old target-specific strategy or cases where a changed Open/Close set did not alter the final outcome count.

| market | n | Open | Close | Jodi | Adjusted Close |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 30 | 73.3 → 73.3 | 60.0 → 60.0 | 50.0 → 50.0 | 63.3 → 63.3 |
| Time Bazar | 26 | 73.1 → **80.8** | 80.8 → 80.8 | 69.2 → **73.1** | 80.8 → 80.8 |
| Madhur Day | 30 | 50.0 → **60.0** | 63.3 → 63.3 | 30.0 → **43.3** | 63.3 → 63.3 |
| Milan Day | 26 | 80.8 → 80.8 | 65.4 → 65.4 | 53.8 → 53.8 | 61.5 → 61.5 |
| Rajdhani Day | 26 | 69.2 → **76.9** | 57.7 → 57.7 | 42.3 → 42.3 | 57.7 → 57.7 |
| Kalyan | 26 | 73.1 → 73.1 | 46.2 → **65.4** | 34.6 → **50.0** | 46.2 → 46.2 |
| Sridevi Night | 30 | 66.7 → **80.0** | 63.3 → **66.7** | 50.0 → 50.0 | 70.0 → 70.0 |
| Kalyan Night | 19 | 52.6 → **63.2** | 63.2 → **73.7** | 36.8 → **42.1** | 63.2 → **68.4** |
| Madhur Night | 26 | 69.2 → 69.2 | 65.4 → **69.2** | 50.0 → 50.0 | 61.5 → **69.2** |
| Milan Night | 26 | 53.8 → **69.2** | 61.5 → **65.4** | 42.3 → **46.2** | 61.5 → 61.5 |
| Rajdhani Night | 22 | 31.8 → **77.3** | 36.4 → **77.3** | 13.6 → **59.1** | 40.9 → **59.1** |
| Main Bazar | 22 | 59.1 → 59.1 | 54.5 → 54.5 | 27.3 → **31.8** | 54.5 → 54.5 |

Rajdhani Night's recent lift is unusually large and should be expected to regress toward its longer-run mean. It is reported, not extrapolated.

## Selected production models

### Open Sutta: calendar-date recurrence with market gating

For each digit, count prior Open results occurring on the same day of the month as the target date, apply symmetric smoothing, and take the six highest counts. The statistical order is preserved without drought-priority re-sorting.

Enabled only at Top-6 for Time Bazar, Madhur Day, Rajdhani Day, Sridevi Night, Kalyan Night, Milan Night, Rajdhani Night, and Main Bazar. Sridevi, Milan Day, Kalyan, and Madhur Night retain their previous Open strategy because the candidate regressed in at least one recent validation window.

### Close Sutta: recent-30 contrarian frequency with market gating

Count Close suttas over the last 30 completed draws and rank the least frequent digits first. This is a contrarian absence model, not a hot-number model.

Enabled only at Top-6 for Madhur Day, Kalyan, Sridevi Night, Kalyan Night, Madhur Night, Milan Night, and Rajdhani Night. Other markets retain their previous Close strategy.

### Jodi: paired selected Open and Close sets

The app forms all 36 combinations from the selected six Open and six pre-open Close digits. Research showed that optimizing the pair outperformed applying one universal strategy to both sides. The exact integrated result rises from 36.4% to 38.0% over two years and from 42.4% to 49.5% over the latest 30 days.

### Adjusted Close: conditional and contrarian models with market gating

After the actual Open sutta is available, the selected conditional model counts the historical Close distribution for that same Open digit and takes the six most frequent Close digits. This deliberately ignores unsupported panel-score complexity at the final digit-selection stage.

The known-open model is enabled only at Top-6 for Kalyan Night, Milan Night, and Rajdhani Night. Madhur Day and Madhur Night use the same recent-30 contrarian Close model after Open because that fallback improved their integrated Adjusted Close validation. All other markets retain their previous Adjusted Close behavior.

## Feature importance and ablation evidence

These models are transparent count models, so feature importance is structural rather than an opaque tree-model importance score.

| target | primary feature | role | two-year candidate result | important ablation/comparator |
| --- | --- | ---: | ---: | --- |
| Open | same calendar day-of-month history | 100% inside selected statistical ranker | 61.4% global candidate | recent-7 hot 62.7% long-run but regressed to 59.5% in the latest 30 days; rejected globally |
| Close | inverse frequency over last 30 draws | 100% inside selected statistical ranker | 61.6% global candidate | long-frequency 60.1%; shrunk delta 60.9% |
| Adjusted Close | `P(close digit | known open digit)` or inverse recent-30 frequency | 100% inside each selected market ranker | known-open global candidate 60.6% | Bayesian blend 59.9%; opposite-house blend 59.3% |
| Jodi | selected Open set × selected Close set | Open and Close both required | 37.9% ungated pair candidate | same-strategy calendar pair 37.0%; old production 36.4% |

The production market gates improve the exact integrated Open candidate from 61.4% to 62.3% over two years by avoiding markets where pure calendar recurrence is harmful.

## Hypotheses accepted and rejected

| hypothesis/model | result | decision |
| --- | --- | --- |
| Same day-of-month recurrence for Open | Stable after market gating; especially strong in the latest six months | Deploy at Top-6 in eight markets |
| Recent-30 cold Close digits | Best Close candidate over two years, one year, six months, 30 days, and 7 days | Deploy at Top-6 in seven markets |
| Direct known-open conditional Close frequency | Best long-run Adjusted Close candidate | Deploy conservatively in three markets |
| Recent-30 cold Adjusted Close fallback | Improved exact integration for Madhur Day and Madhur Night | Deploy only in those two markets |
| Paired Open/Close optimization for Jodi | Beats using one common strategy for both sides | Deploy through the selected Open and Close sets |
| Recent-7 hot Open digits | Best raw two-year Open candidate, but latest-30 regression versus the old app | Reject as universal production model |
| Recent-14 hot Open digits | Strong raw Jodi partner but less robust than calendar Open in the latest window | Research/watchlist only |
| Markov previous-sutta transition | 60.1% Close; below recent-30 cold | Reject as primary model |
| Delta transition | 60.9% Close and 60.9% Open candidate at best; inconsistent by market | Reject as primary model |
| Opposite-number mapping | Useful in isolated windows, not consistently best | Reject as universal rule |
| Same/opposite house | Inconsistent across targets and markets | Retain only where already part of an unchanged legacy strategy |
| Weekday-only frequency | Did not lead any durable target | Reject as primary model |
| Long-frequency hot digits | Near coverage baseline | Reject as primary model |
| Weighted frequency ensemble | Did not beat the simpler selected models | Reject; added complexity without lift |
| Shrunk Bayesian/Markov ensemble | Did not beat simple conditional counts | Reject for production |
| Festival effects | Only two independent annual cycles and no reliable out-of-sample festival sample | Insufficient evidence; do not deploy |
| Neural/HMM sequence models | Data has only ten nearly uniform classes and about 500-700 rows per market | Not justified without more independent history; high overfit risk |

The earlier project research also rejected broad cross-market correlations, Jodi reversals, hot-digit temperature, monthly weekday echo, and drought-overdue as standalone boosts. Those failed ideas were not reintroduced.

## Confidence calibration

The current application does not emit a calibrated probability for a Top-6 set. Its existing calibration fields describe panel-ranking history and must not be presented as Top-6 confidence. For this report, a calibration forecast was formed from the preceding portion of the one-year window (one year minus the latest 30 days), then compared with the latest 30 days.

| target/model | prior empirical forecast | latest-30 observed | absolute calibration error | Brier score |
| --- | ---: | ---: | ---: | ---: |
| Open baseline | 61.7% | 63.4% | 1.7 | 0.232 |
| Open improved | 62.2% | 72.2% | 10.0 | **0.211** |
| Close baseline | 58.3% | 60.2% | 1.9 | 0.240 |
| Close improved | 60.3% | 66.3% | 6.0 | **0.227** |
| Jodi baseline | 36.5% | 42.4% | 5.9 | **0.248** |
| Jodi improved | 37.4% | 49.5% | 12.1 | 0.265 |
| Adjusted Close baseline | 58.5% | 60.8% | 2.3 | 0.239 |
| Adjusted Close improved | 59.6% | 63.1% | 3.5 | **0.234** |

Interpretation:

- The improved model's latest window is hotter than its long-run forecast, so long-run empirical confidence underestimates current coverage.
- Brier score improves for Open, Close, and Adjusted Close, but worsens for Jodi because the recent Jodi lift is much larger than the historical forecast.
- Do not label the latest 72.2% Open or 49.5% Jodi result as a stable future probability.
- A production confidence label should use rolling out-of-sample market/target coverage with Wilson intervals and should abstain from “high confidence” when fewer than 50 recent predictions are available.

## Verification

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with zero errors and seven pre-existing warnings.
- Exact unchanged baseline saved for 7, 30, 183, 365, and 730 calendar-day windows.
- Exact improved production rerun saved for the same five windows.
- Top-4 metrics remained unchanged in every rerun, confirming the implementation is isolated to Top-6.

Reproduction:

```powershell
node scripts/sutta-research-baseline.cjs 30 --refresh
python scripts/sutta-model-research.py
node scripts/sutta-research-baseline.cjs 30 --label=improved-final
```

## Remaining weaknesses and ranked future work

1. **Calibrate Top-6 confidence explicitly.** Store per-market, per-target walk-forward outcomes and expose rolling Wilson intervals rather than panel-calibration proxies.
2. **Collect forward results.** Freeze the current model and evaluate the next 60-90 completed draws without further tuning; this is the strongest test against research overfitting.
3. **Revisit Adjusted Close.** Its two-year result is 59.6%, still below the 60% coverage baseline despite beating the old app. More same-open conditional data is needed.
4. **Add change-point gates.** Rajdhani Night's recent jump is too large to extrapolate. A formal regime test can decide when to fall back to the long-run model.
5. **Test probability-ranked Jodis directly.** The current Jodi ticket is a Cartesian product. A future model could rank 36 out of 100 Jodis directly, but it must preserve the same coverage for a fair comparison.
6. **Festival research needs more cycles.** With only two years, festival effects cannot be separated reliably from weekday, month, and market drift.
7. **Avoid larger model classes until data grows.** Gradient boosting, neural networks, and HMMs can memorize these small market sequences; nested forward validation is mandatory before considering them.

## Responsible interpretation

These are historical coverage results, not guarantees and not evidence of profitability. A Top-6 sutta ticket covers 60% of all digits, and a 36-Jodi ticket covers 36% of all Jodis. Cost, payout, dependence between bets, source revisions, and operator behavior can erase small statistical lifts. The correct next step is a frozen forward test, not further tuning on the same history.
