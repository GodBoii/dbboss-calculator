# Market-Wise Sutta Deep Analysis and Isolation Upgrade

Generated: 2026-07-10

## Diagnosis: why the app once appeared to be 80-100%

The older 100% figures were not fabricated, but they were mostly three-result samples.

- In `sutta_backtest_report_3d.md`, 100% meant `3/3`. One miss would immediately reduce it to `2/3 = 66.7%`.
- The old three-day overall results were Open 72.2%, Close 61.1%, and joint/Jodi 47.2%—not 80-100% overall.
- In `sutta_backtest_report_7d.md`, only Kalyan Open reached 100% (`7/7`). Overall Open was 66.7%, Close was 58.3%, and Jodi was 39.3%.
- Different reports previously mixed three calendar days, seven market results, panel Top-30, sutta Top-6, and known-open Close. Those percentages are not comparable.

The current model was not simply “broken.” Short windows made several markets look perfect, while the long walk-forward tests revealed the sustainable accuracy. The correct comparison is always the same target, same number of picks, same markets, and same walk-forward cutoff.

## Final exact production results

The table compares the unchanged app before this research cycle with the final isolated Top-6 implementation.

| window | n | Open | Close | Jodi (36 brackets) | Adjusted Close |
| --- | ---: | ---: | ---: | ---: | ---: |
| 7 days | 72 | 69.4% → **75.0%** | 56.9% → **69.4%** | 43.1% → **56.9%** | 56.9% → **66.7%** |
| 30 days | 309 | 63.4% → **72.2%** | 60.2% → **67.3%** | 42.4% → **50.5%** | 60.8% → **66.0%** |
| 6 months | 1,855 | 61.1% → **64.5%** | 57.9% → **63.2%** | 36.3% → **40.8%** | 58.5% → **62.3%** |
| 1 year | 3,641 | 61.9% → **63.1%** | 58.4% → **62.1%** | 37.0% → **38.9%** | 58.7% → **61.2%** |
| 2 years | 6,687 | 61.2% → **62.3%** | 58.7% → **61.9%** | 36.4% → **38.6%** | 58.7% → **60.7%** |

Coverage baselines are 60% for six suttas and 36% for 36 Jodis. The final two-year model is above coverage on all four targets, though the margins remain modest and are not evidence of profitability.

## Research method

- Fresh source cache: 7,287 completed market rows across all 12 markets.
- Effective dates: early July 2024 through July 3-5, 2026, depending on market schedule.
- Every prediction used only rows dated before the result being scored.
- Candidate selection used three disjoint periods:
  - older-year development;
  - recent-year validation excluding the final month;
  - final 30-day holdout.
- A market-target change was retained only when it added hits in development and validation, did not lose a holdout hit, and improved the combined two-year result.
- The final app path was rerun after integration. Standalone research results were not accepted as production proof.

## Market-wise number observations

Hot digits below are descriptive two-year frequencies. Cold Close digits are the three least frequent in the latest 30 completed draws. “Close delta” is the most frequent modular transition from the previous Close digit.

| market | hot Open digits | hot Close digits | current cold Close | strongest Close delta | final 30d O/C/J/A | final 2y O/C/J/A |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 8, 5, 9 | 9, 7, 1 | 3, 0, 1 | +8 (10.9%) | 73.3 / 60.0 / 50.0 / 63.3 | 64.5 / 60.8 / 39.2 / 61.1 |
| Time Bazar | 0, 8, 4 | 1, 2, 3 | 2, 5, 6 | +7 (12.6%) | 80.8 / 80.8 / 73.1 / 80.8 | 65.0 / 55.6 / 36.8 / 55.6 |
| Madhur Day | 9, 0, 6 | 0, 1, 9 | 3, 0, 6 | +5 (13.5%) | 60.0 / 63.3 / 43.3 / 63.3 | 61.2 / 63.0 / 39.0 / 63.0 |
| Milan Day | 3, 2, 9 | 8, 6, 9 | 5, 8, 2 | +3 (11.9%) | 80.8 / 65.4 / 53.8 / 61.5 | 66.1 / 61.4 / 43.0 / 60.8 |
| Rajdhani Day | 6, 1, 9 | 0, 1, 2 | 8, 3, 1 | +8 (13.7%) | 76.9 / 69.2 / 50.0 / 73.1 | 59.2 / 68.3 / 39.0 / 61.0 |
| Kalyan | 0, 1, 8 | 4, 1, 2 | 5, 9, 1 | +2 (10.7%) | 73.1 / 65.4 / 53.8 / 46.2 | 62.2 / 63.3 / 39.4 / 59.0 |
| Sridevi Night | 4, 5, 0 | 2, 1, 0 | 3, 1, 7 | +8 (11.3%) | 80.0 / 66.7 / 50.0 / 70.0 | 61.1 / 63.8 / 38.6 / 59.9 |
| Kalyan Night | 3, 0, 8 | 2, 7, 1 | 7, 3, 5 | +7 (11.6%) | 63.2 / 73.7 / 42.1 / 68.4 | 65.1 / 61.1 / 40.2 / 62.9 |
| Madhur Night | 6, 2, 1 | 4, 0, 1 | 6, 1, 3 | +2 (11.8%) | 69.2 / 69.2 / 50.0 / 69.2 | 58.4 / 60.7 / 36.2 / 60.7 |
| Milan Night | 6, 0, 7 | 3, 4, 8 | 8, 2, 5 | +7 (12.0%) | 69.2 / 65.4 / 46.2 / 65.4 | 59.7 / 60.8 / 34.7 / 60.8 |
| Rajdhani Night | 4, 0, 5 | 7, 8, 2 | 3, 8, 0 | +6 (12.1%) | 77.3 / 77.3 / 59.1 / 77.3 | 63.5 / 64.8 / 41.3 / 64.8 |
| Main Bazar | 6, 5, 1 | 3, 6, 9 | 0, 4, 5 | +4 (12.7%) | 59.1 / 54.5 / 31.8 / 54.5 | 61.7 / 59.0 / 35.2 / 59.0 |

The hot/cold lists are observations, not standalone betting rules. Several globally frequent digits failed walk-forward testing when used without market and recency context.

## Selected market-specific methods

### Open Sutta

The prior calendar-date model remains enabled for Time Bazar, Madhur Day, Rajdhani Day, Sridevi Night, Kalyan Night, Milan Night, Rajdhani Night, and Main Bazar. Other markets keep their legacy Open model.

A recent-14 Kalyan Open candidate added hits over one and two years but lost one hit in the requested seven-day window. It was rejected to preserve all requested windows.

### Close Sutta

- Rajdhani Day: previous-Close modular delta distribution. This was the strongest new market-specific discovery.
- Kalyan: same day-of-month Close recurrence.
- Madhur Day, Sridevi Night, Kalyan Night, Madhur Night, Milan Night, and Rajdhani Night: least-frequent digits over the latest 30 Close results.
- Other markets retain the existing Close strategy.

The new Close configuration improves from 60.8% to 61.9% over two years and from 66.3% to 67.3% over 30 days compared with the preceding improved version.

### Adjusted Close

- Rajdhani Day: shrunk Bayesian blend using long frequency, recent-60 frequency, weekday, known-Open conditional frequency, and modular delta.
- Kalyan Night: direct `P(Close | known Open)` frequency.
- Madhur Day, Madhur Night, Milan Night, and Rajdhani Night: recent-30 contrarian Close frequency.
- Other markets retain the existing Adjusted Close model.

Adjusted Close rises from 59.6% to 60.7% over two years and from 63.1% to 66.0% over 30 days compared with the preceding improved version.

### Jodi

Direct 100-class Jodi models, reversal theory, weekday Jodi, calendar Jodi, recent-hot/cold Jodi, and sparse Jodi transition models were tested. None beat the current paired model in development, validation, and holdout simultaneously.

The production Jodi contract therefore remains the Cartesian product of the final ordered Open and Close lists: four × four produces 16 unique Jodis; six × six produces 36 unique Jodis. The construction code is isolated and defensively sorts/deduplicates inputs.

## Successful and rejected theories

| theory | outcome |
| --- | --- |
| Market-specific same day-of-month recurrence | Accepted for selected Open markets and Kalyan Close |
| Recent-30 cold/contrarian Close | Accepted for selected markets; strongest global Close family |
| Previous-Close modular delta | Accepted only for Rajdhani Day Close |
| Known-Open conditional frequency | Accepted for Kalyan Night Adjusted Close |
| Shrunk known-Open Bayesian blend | Accepted only for Rajdhani Day Adjusted Close |
| Recent-7/14 hot Open | Strong long-run candidate but failed the final all-window preservation gate |
| Opposite-number mapping | Inconsistent; rejected as a universal rule |
| Same/opposite house | Inconsistent; retained only inside unchanged legacy market strategies |
| Weekday-only and long-frequency-only | Near coverage baseline; rejected as primary models |
| Markov previous digit | Too weak outside isolated pockets |
| Direct Jodi frequency/reversal | Sparse and unstable; rejected |
| Neural/HMM/large ML models | Not justified for roughly 450-700 rows per market and ten nearly uniform classes |
| Festival effects | Only two independent yearly cycles; insufficient out-of-sample support |

## Code isolation

The Top-6 statistical models are no longer embedded in the React UI component.

- `src/lib/sutta-model/open.ts`: Open-only model configuration and ranking.
- `src/lib/sutta-model/close.ts`: pre-open Close-only models.
- `src/lib/sutta-model/adjusted-close.ts`: known-open Adjusted Close models.
- `src/lib/sutta-model/jodi.ts`: Jodi construction contract.
- `src/lib/sutta-model/shared.ts`: probability normalization and statistical helpers.
- `src/lib/sutta-model/types.ts`: stable output interface.

The old panel scorer, SP/DP kind model, operator psychology, calibration, DP focus, avoid-digit safety gate, and all non-Top-6 strategy paths remain unchanged. The existing sutta engine remains the fallback when no isolated model is selected.

## Ranking, probability, color, and copy contract

Every returned sutta now contains:

- a sequential rank;
- the internal model score;
- a normalized per-digit model percentage;
- an independent drought/snapback state and color.

The ten ranked digit percentages sum to 100%. Percentages use a conservative monotonic normalization around the 10% uniform prior because legacy strategies use incompatible score scales. They are relative model ratings, not guaranteed real-world odds.

Color meanings are independent of rank:

- green: fresh;
- yellow: warming/cooling;
- red: danger;
- blue: snapback.

Colors never reorder the already finalized copy list. The UI explains that digits are shown from highest to lowest model chance and that colors describe drought state only.

Runtime and browser checks cover:

- unique digits for every market and count 1-10;
- sequential ranks;
- monotonically decreasing percentages;
- a 100% total across all ten digits;
- Top-4 output lengths of 4 Open, 4 Close, and 16 Jodis;
- Top-6 output lengths of 6 Open, 6 Close, and 36 Jodis;
- Jodi order exactly following visible Open-rank × Close-rank order;
- clipboard Open/Close/Jodi text matching the visible ranked order.

## Remaining cautions

1. A 60-90 result frozen forward test is still required. Repeatedly tuning the same history eventually overfits it.
2. Main Bazar Close/Jodi and Time Bazar long-run Close remain weak despite strong recent windows. Their current models were preserved because no candidate passed all gates.
3. The displayed percentages are normalized ratings. True probability calibration needs stored rank-by-rank forward outcomes.
4. Rajdhani Night's recent performance is unusually high and should be expected to regress toward its two-year rate.
5. Historical coverage is not a profitability guarantee; Top-6 and 36-Jodi tickets cover large portions of the outcome space.

