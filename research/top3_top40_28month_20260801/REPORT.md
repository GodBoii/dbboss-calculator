# Top-3 / Top-40 / 28-month research decision

Date: 2026-08-01  
Status: production contract implemented; ranking challengers remain rejected or shadow-only

## Decision

The application now returns exactly:

- 3 ranked Open suttas;
- 3 ranked Close suttas;
- the explicitly labelled 3 x 3 grid of 9 Jodis;
- 40 ranked Open panels;
- 40 ranked Close panels;
- 2 candidate digits to avoid for each panel side, still subject to the existing `NO_SAFE_CALL` gate;
- history from an exact rolling 28-calendar-month window.

The output-count and history-window changes are promoted. No newly searched pattern formula is promoted because none has shown stable lift across chronological holdout, independent-source, and genuinely forward evidence.

## What was researched

The repository's completed research cycles cover the requested families rather than assuming that a named theory is predictive:

- previous draw, lagged draw, same weekday, same calendar date, previous month weekday/date, previous year/date;
- Open-to-Close and day-to-night relationships;
- cross-market lead/lag edges, source-market routing, causal event order, market graphs, and market chains;
- immediate/delayed opposite mappings, opposite suppression/release, low/high and other digit houses;
- hot/cold frequency, absence, drought, saturation, streak, gap and entropy regimes;
- position-specific first/middle/last panel digits, exact/sorted panel identities, pair profiles and panel kind;
- sequential, circular, opposite, house, weekly, monthly, alternating, and positional rotations;
- weekday, month, month-edge, and calendar interactions;
- DP/SP weekly regimes and operator-psychology features;
- statistical experts, causal MLPs, factorization interactions, GRU event sequences, hierarchical panel models, contextual panel models, ridge models, and ensembles.

The Top-3 cycle evaluated 189 target-specific statistical candidates plus neural, whole-panel and event-sequence challengers. The later universal cycle evaluated 109 causal experts per side. The strongest historical market-specific routes repeatedly lost their gains on later blocks, so selecting them after seeing the whole chart would be leakage.

## Public-source research

Public result sites describe the same result contract used by this app: Open panel and single, Close panel and single, with Jodi formed from the two singles. See [SattaResults' rules](https://sattaresults.mobi/learn-matka) and [Matkabook's format summary](https://matkabook.com/).

Searches found public result archives, but no credible, auditable per-number ledger of bettors, stakes, timestamps, or operator liabilities for these markets. Result-chart sites such as [Satta Results](https://www.sattaresults.co/panel-chart-list) provide outcomes, not the hidden bet book needed to test the proposed profit-maximizing operator theory. Academic work can model player choice when an operator supplies wager-level data—for example, [Ho et al.](https://www.tandfonline.com/doi/full/10.1080/14459795.2018.1529814)—but that is a different lottery dataset and cannot be transferred as if it were Open Satta betting flow.

Consequently, “operator psychology” inferred only from outcomes is a hypothesis, not an observed causal variable. It must beat an outcome-only baseline on sealed future calls before receiving additional production weight.

## Latest walk-forward result

The new contract was replayed on 200 completed market-date rows from 2026-07-11 through 2026-07-30. Each prediction used records strictly earlier than its target date.

| Output | Hits | Accuracy | Nominal set coverage |
| --- | ---: | ---: | ---: |
| Open sutta Top-3 | 55 / 200 | 27.5% | 30.0% |
| Close sutta Top-3 | 62 / 200 | 31.0% | 30.0% |
| 3 x 3 Jodi grid | 19 / 200 | 9.5% | 9.0% |
| Open panel Top-40 | 52 / 200 | 26.0% | 18.2% of 220 valid panels |
| Close panel Top-40 | 55 / 200 | 27.5% | 18.2% of 220 valid panels |
| Open avoid pair | 109 / 200 | 54.5% | descriptive only; gate made no calls |
| Close avoid pair | 98 / 200 | 49.0% | descriptive only; gate made no calls |

The Top-3 and Jodi results are near their nominal set sizes. Top-40 panel ranking is the most promising component in this short check, but 200 pooled rows are not enough to promote another searched reranker, particularly after previous independent panel challengers failed. The avoid-pair model correctly abstained because no market-side satisfied its safety threshold.

## Operator/game-theory conclusion

The user's operator model is logically possible: an operator with complete stake information could choose a result that balances liabilities, short-run profit, and player retention. Historical outcomes alone do not identify that mechanism. Many different hidden bet books can produce the same result, and any story fitted after the result can explain almost anything.

A defensible operator model requires timestamped pre-result inputs such as stake by number, bet count, stake concentration, payout liability, repeat-bettor behavior, and result publication time. Until such a lawful and reliable feed exists, the app should treat operator features as low-weight outcome proxies and never describe them as observed betting pressure.

## Promotion protocol

1. Freeze candidate formulas before the next results are published.
2. Store source hashes, prediction timestamps, target market/date, output count, and full ranking.
3. Require at least 100 future calls per market-local route and report worst-month as well as pooled lift.
4. Compare against the frozen production ranking at the same Top-K count.
5. Correct for multiple comparisons within each hypothesis family.
6. Reject a route that improves discovery but regresses chronological holdout, independent-source, or forward blocks.
7. Keep Jodi grid coverage explicit: a 3 x 3 grid is nine bets, not “three Jodis.”

## Reproducibility

```powershell
node scripts\verify-panel-top60.cjs
node scripts\weekly-production-backtest.cjs 2026-08-01 2026-07-11 2026-07-30
npm run lint
npx tsc --noEmit
npm run build
```

Detailed row-level predictions and hits are in `backtest_reports/2026-08-01/2026-07-11-to-2026-07-30-production-backtest.json`.
