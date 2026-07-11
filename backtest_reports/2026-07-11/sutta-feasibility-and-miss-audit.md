# Sutta Feasibility and Miss Audit

Generated: 2026-07-11T07:59:25.203Z

This audit is research-only. It evaluates the current Top-6 production ledger, fixed hindsight limits, rolling frequency fallbacks, and simple source-market/opposite/near-number formulas. No production predictor change is made from this file alone.

## Current Top-6 Accuracy

| Market | N | Open | Close | Jodi |
| --- | --- | --- | --- | --- |
| Sridevi | 30 | 18/30 (60.0%) | 19/30 (63.3%) | 10/30 (33.3%) |
| Time Bazar | 26 | 21/26 (80.8%) | 20/26 (76.9%) | 17/26 (65.4%) |
| Madhur Day | 30 | 18/30 (60.0%) | 19/30 (63.3%) | 13/30 (43.3%) |
| Milan Day | 26 | 19/26 (73.1%) | 17/26 (65.4%) | 11/26 (42.3%) |
| Rajdhani Day | 26 | 20/26 (76.9%) | 18/26 (69.2%) | 13/26 (50.0%) |
| Kalyan | 26 | 21/26 (80.8%) | 17/26 (65.4%) | 14/26 (53.8%) |
| Sridevi Night | 30 | 24/30 (80.0%) | 20/30 (66.7%) | 15/30 (50.0%) |
| Kalyan Night | 19 | 12/19 (63.2%) | 14/19 (73.7%) | 8/19 (42.1%) |
| Madhur Night | 26 | 20/26 (76.9%) | 18/26 (69.2%) | 13/26 (50.0%) |
| Milan Night | 26 | 20/26 (76.9%) | 17/26 (65.4%) | 14/26 (53.8%) |
| Rajdhani Night | 22 | 17/22 (77.3%) | 17/22 (77.3%) | 13/22 (59.1%) |
| Main Bazar | 22 | 13/22 (59.1%) | 13/22 (59.1%) | 9/22 (40.9%) |

30-day totals: Open 223/309 (72.2%), Close 209/309 (67.6%), Jodi 150/309 (48.5%).

730-day totals: Open 4117/6687 (61.6%), Close 4127/6687 (61.7%), Jodi 2525/6687 (37.8%).

## 90% Feasibility Signal

The `minimumKFor90` columns are cheating hindsight: they ask how many different sutta digits would be needed to cover 90% of the last 30 actual results if we already knew the results. If this is usually 8-10, a true Top-6 90% target needs a very strong conditional signal, not just better frequency ranking.

| Market | Open minimumKFor90 | Close minimumKFor90 | Best fixed Open-6 | Best fixed Close-6 |
| --- | --- | --- | --- | --- |
| Sridevi | 7 | 8 | 24/30 (80.0%) | 21/30 (70.0%) |
| Time Bazar | 8 | 7 | 21/26 (80.8%) | 23/26 (88.5%) |
| Madhur Day | 7 | 8 | 24/30 (80.0%) | 24/30 (80.0%) |
| Milan Day | 8 | 7 | 21/26 (80.8%) | 22/26 (84.6%) |
| Rajdhani Day | 8 | 7 | 20/26 (76.9%) | 22/26 (84.6%) |
| Kalyan | 8 | 8 | 22/26 (84.6%) | 21/26 (80.8%) |
| Sridevi Night | 6 | 8 | 27/30 (90.0%) | 23/30 (76.7%) |
| Kalyan Night | 7 | 6 | 17/19 (89.5%) | 18/19 (94.7%) |
| Madhur Night | 8 | 7 | 20/26 (76.9%) | 22/26 (84.6%) |
| Milan Night | 8 | 8 | 22/26 (84.6%) | 20/26 (76.9%) |
| Rajdhani Night | 8 | 9 | 17/22 (77.3%) | 15/22 (68.2%) |
| Main Bazar | 8 | 8 | 17/22 (77.3%) | 16/22 (72.7%) |

## Current Miss Clusters

| Market | Open misses | Open miss digits | Close misses | Close miss digits |
| --- | --- | --- | --- | --- |
| Sridevi | 12/30 | 0, 1, 4, 5 | 11/30 | 2, 4, 6, 7 |
| Time Bazar | 5/26 | 9, 4, 6, 0 | 6/26 | 3, 0, 4, 5 |
| Madhur Day | 12/30 | 9, 2, 5, 6 | 11/30 | 4, 5, 2, 7 |
| Milan Day | 7/26 | 0, 5, 7, 9 | 9/26 | 1, 4, 0, 2 |
| Rajdhani Day | 6/26 | 8, 5, 6, 7 | 8/26 | 0, 4, 5, 1 |
| Kalyan | 5/26 | 0, 3, 4, 6 | 9/26 | 3, 2, 7, 0 |
| Sridevi Night | 6/30 | 9, 4, 5, 8 | 10/30 | 8, 0, 2, 4 |
| Kalyan Night | 7/19 | 6, 8, 4, 7 | 5/19 | 2, 0, 4, 6 |
| Madhur Night | 6/26 | 3, 6, 7, 8 | 8/26 | 7, 0, 4, 8 |
| Milan Night | 6/26 | 8, 3, 5, 7 | 9/26 | 4, 1, 3, 6 |
| Rajdhani Night | 5/22 | 1, 0, 2, 9 | 5/22 | 1, 6, 8, 9 |
| Main Bazar | 9/22 | 3, 5, 7, 1 | 9/22 | 8, 9, 2, 3 |

## Rolling Fallbacks vs Current Model

These are simple market-specific fallbacks on the last 30 days: all-history frequency, same-weekday frequency, same month-day frequency, and recent-20 frequency. Positive delta means the fallback beat the current model for that market and side.

| Market | Side | Fallback | Fallback | Current | Delta |
| --- | --- | --- | --- | --- | --- |
| Kalyan Night | open | recent20 | 15/19 (78.9%) | 12/19 (63.2%) | 3 |
| Milan Day | close | monthday | 20/26 (76.9%) | 17/26 (65.4%) | 3 |
| Milan Night | close | monthday | 20/26 (76.9%) | 17/26 (65.4%) | 3 |
| Rajdhani Day | close | all | 20/26 (76.9%) | 18/26 (69.2%) | 2 |
| Sridevi | open | weekday | 20/30 (66.7%) | 18/30 (60.0%) | 2 |
| Sridevi | open | monthday | 20/30 (66.7%) | 18/30 (60.0%) | 2 |
| Kalyan Night | close | monthday | 15/19 (78.9%) | 14/19 (73.7%) | 1 |
| Kalyan | close | monthday | 18/26 (69.2%) | 17/26 (65.4%) | 1 |
| Kalyan | close | recent20 | 18/26 (69.2%) | 17/26 (65.4%) | 1 |
| Madhur Day | close | monthday | 20/30 (66.7%) | 19/30 (63.3%) | 1 |
| Main Bazar | open | all | 14/22 (63.6%) | 13/22 (59.1%) | 1 |
| Main Bazar | open | weekday | 14/22 (63.6%) | 13/22 (59.1%) | 1 |

## Source Formula Search

Stable candidates below beat or tied current over dev/validation/holdout/full-730 and improved final-30.

| Target | Rule | 730 delta | 730 hit | 30 delta | 30 hit | dev/val/holdout delta | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main Bazar.close | previousDraw:Rajdhani Night.close.mirrorOpposite | 22 | 299/454 | 6 | 19/22 | 7/3/12 | yes |
| Main Bazar.open | sameDayEarlier:Kalyan Night.close.addThreeCycle | 15 | 295/454 | 6 | 19/22 | 4/2/9 | yes |
| Sridevi.open | previousDraw:Sridevi.open.oppositeNearTwo | 12 | 429/674 | 6 | 24/30 | 9/0/3 | yes |
| Sridevi.close | previousDraw:Madhur Night.close.mirrorOpposite | 40 | 419/674 | 4 | 23/30 | 5/22/13 | yes |
| Milan Day.close | previousDraw:Rajdhani Night.open.nearTwoOpposite | 39 | 360/554 | 4 | 21/26 | 21/12/6 | yes |
| Main Bazar.open | previousDraw:Milan Night.close.nearTwoOpposite | 8 | 288/454 | 4 | 17/22 | 3/0/5 | yes |
| Main Bazar.close | sameDayEarlier:Kalyan.open.oppositeNearTwo | 8 | 285/454 | 4 | 17/22 | 2/2/4 | yes |
| Main Bazar.close | previousDraw:Madhur Night.close.mirrorOpposite | 6 | 283/454 | 4 | 17/22 | 3/0/3 | yes |
| Sridevi.close | previousDraw:Madhur Day.close.nearTwoOpposite | 47 | 426/674 | 3 | 22/30 | 13/17/17 | yes |
| Milan Day.close | sameDayEarlier:Madhur Day.close.oppositeNearTwo | 47 | 368/554 | 3 | 20/26 | 24/21/2 | yes |

## Source Formula Hybrid Search

These candidates preserve the current Top-4 digits and only use the formula for ranks 5-6. This is the safer shape for production review.

| Target | Rule | 730 delta | 730 hit | 30 delta | 30 hit | dev/val/holdout delta | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Madhur Day.open | previousDraw:Milan Day.open.sourceOpposite | 10 | 410/654 | 7 | 25/30 | 6/2/2 | yes |
| Madhur Day.open | previousDraw:Sridevi.open.sourceOpposite | 7 | 407/654 | 6 | 24/30 | 3/0/4 | yes |
| Sridevi.close | previousDraw:Kalyan.open.mirrorOpposite | 16 | 395/674 | 5 | 24/30 | 4/1/11 | yes |
| Sridevi.open | previousDraw:Milan Night.close.mirrorOpposite | 14 | 431/674 | 5 | 23/30 | 6/7/1 | yes |
| Sridevi Night.close | previousDraw:Sridevi.close.mirrorOpposite | 11 | 441/674 | 5 | 25/30 | 2/3/6 | yes |
| Madhur Day.open | previousDraw:Milan Day.open.oppositeNearTwo | 7 | 407/654 | 5 | 23/30 | 4/1/2 | yes |
| Sridevi.close | previousDraw:Time Bazar.open.oppositeNearTwo | 29 | 408/674 | 4 | 23/30 | 14/2/13 | yes |
| Sridevi.close | previousDraw:Kalyan.open.sourceOpposite | 20 | 399/674 | 4 | 23/30 | 6/6/8 | yes |
| Milan Day.close | sameDayEarlier:Madhur Day.close.oppositeNearTwo | 13 | 334/554 | 4 | 21/26 | 5/7/1 | yes |
| Milan Night.close | sameDayEarlier:Madhur Day.close.addThreeCycle | 11 | 346/551 | 4 | 21/26 | 1/2/8 | yes |

## Interpretation

Found 63 full-replacement stable source formula candidates and 116 Top-4-preserving stable hybrid candidates. They still need manual review before production integration because this search was broad and can overfit.

## Implemented Conservative Promotion Pack

After the audit, only four previous-draw Top-4-preserving rules were promoted into production. Each keeps the existing Top-4 ranking and only uses the source formula to fill ranks 5-6.

| Target | Source rule | 30d delta | 730d delta |
| --- | --- | ---: | ---: |
| Madhur Day.open | previous Milan Day open, source+opposite | +5 open hits in exact production backtest | +14 open hits |
| Sridevi.open | previous Milan Night close, mirror/opposite formula | +5 open hits | +14 open hits |
| Sridevi.close | previous Kalyan open, mirror/opposite formula | +4 close hits | +15 close hits |
| Sridevi Night.close | previous Sridevi close, mirror/opposite formula | +5 close hits | +9 close hits |

Exact production Top-6 after implementation:

| Window | Open | Close | Jodi | Adjusted Close |
| --- | ---: | ---: | ---: | ---: |
| Last 30 calendar days | 233/309 (75.4%) | 218/309 (70.6%) | 162/309 (52.4%) | 213/309 (68.9%) |
| Last 730 calendar days | 4145/6687 (62.0%) | 4151/6687 (62.1%) | 2576/6687 (38.5%) | 4121/6687 (61.6%) |

Regression check: no market lost Top-6 Open, Close, or Jodi hits versus the prior current-ledger baseline. The changed markets were Sridevi, Madhur Day, and Sridevi Night; all other markets were unchanged.

## Implemented Same-Day Earlier-Market Pack

The next pass promoted timing-valid same-day source rules. These are still Top-4-preserving hybrids: the current model keeps ranks 1-4, and the source formula can only fill ranks 5-6. Same-day rules are only used for source markets that are earlier in the market order than the target.

| Target | Source rule | 30d delta vs conservative pack | 730d delta vs conservative pack |
| --- | --- | ---: | ---: |
| Sridevi Night.open | same-day Madhur Day close, +3 cycle | +2 open, +3 jodi | +9 open, +3 jodi |
| Time Bazar.close | same-day Sridevi open, opposite-near formula | +2 close | +23 close, +17 jodi |
| Milan Day.close | same-day Madhur Day close, opposite-near formula | +4 close, +4 jodi | +13 close, +10 jodi |
| Kalyan.close | same-day Time Bazar open, near-opposite formula | +1 close, +2 jodi | +21 close, +17 jodi |
| Madhur Night.close | same-day Sridevi Night open, +3 cycle | +2 close, +3 jodi | +33 close, +16 jodi |
| Milan Night.close | same-day Madhur Day close, +3 cycle | +4 close, +1 jodi | +11 close, +5 jodi |
| Main Bazar.close | same-day Time Bazar open, +3 cycle | +4 close, +1 jodi | +11 close, +6 jodi |

Exact production Top-6 after the same-day pack:

| Window | Open | Close | Jodi | Adjusted Close |
| --- | ---: | ---: | ---: | ---: |
| Last 30 calendar days | 235/309 (76.1%) | 235/309 (76.1%) | 176/309 (57.0%) | 230/309 (74.4%) |
| Last 730 calendar days | 4154/6687 (62.1%) | 4263/6687 (63.8%) | 2650/6687 (39.6%) | 4230/6687 (63.3%) |

Regression check against the conservative promotion pack: no market lost Top-6 Open, Close, Jodi, or adjusted-close hits in either the 30-day or 730-day production backtest.

## Implemented Panel-Feature Pack

The next search tested panel-derived source features against the latest same-day model: first/middle/last panel digits, outer sum, outer difference, and sutta anchors. Accepted rules still preserve the current Top-4 and only compete for ranks 5-6. One Rajdhani Day Close candidate was rejected because it caused a one-hit 730-day adjusted-close regression.

Accepted panel-feature rules:

| Target | Source feature rule |
| --- | --- |
| Main Bazar.open | previous Madhur Day open-panel first digit |
| Madhur Day.close | previous Main Bazar close-panel first digit, mirror/opposite formula |
| Rajdhani Day.open | same-day Time Bazar open-panel outer-sum, mirror/opposite formula |
| Sridevi.close | previous Milan Night open-panel outer-difference, opposite formula |
| Milan Night.open | same-day Madhur Night open sutta, source+opposite |
| Madhur Night.open | previous Kalyan Night close-panel outer-sum, opposite formula |
| Kalyan Night.open | same-day Madhur Day close-panel outer-difference, low-house-first formula |

Exact production Top-6 after pruning:

| Window | Open | Close | Jodi | Adjusted Close |
| --- | ---: | ---: | ---: | ---: |
| Last 30 calendar days | 252/309 (81.6%) | 242/309 (78.3%) | 199/309 (64.4%) | 235/309 (76.1%) |
| Last 730 calendar days | 4188/6687 (62.6%) | 4290/6687 (64.2%) | 2708/6687 (40.5%) | 4258/6687 (63.7%) |

Regression check against the same-day pack: no market lost Top-6 Open, Close, Jodi, or adjusted-close hits in either the 30-day or 730-day production backtest.
