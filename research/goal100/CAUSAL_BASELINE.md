# Goal100 Causal Production Baseline

Generated: 2026-07-14T22:49:52.749Z

## Result

The exact production replay and the nominal-schedule event-time-censored replay produced identical ordered Top-6 rankings on all 6,558 scored rows. The current selected production rules therefore show no same-day leakage under the registered schedule and ten-minute source embargo. This does not validate previously searched generic same-day candidates, and historical publication delays remain unavailable.

| Block | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| development | 2929 | 1854/2929 (63.3%) | 1876/2929 (64.0%) | 1183/2929 (40.4%) |
| validation | 1174 | 715/1174 (60.9%) | 787/1174 (67.0%) | 492/1174 (41.9%) |
| holdout | 1233 | 807/1233 (65.5%) | 790/1233 (64.1%) | 520/1233 (42.2%) |
| recentFrozen | 1222 | 852/1222 (69.7%) | 879/1222 (71.9%) | 631/1222 (51.6%) |
| overall | 6558 | 4228/6558 (64.5%) | 4332/6558 (66.1%) | 2826/6558 (43.1%) |

## All-history market table

| Market | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 653 | 427/653 (65.4%) | 411/653 (62.9%) | 266/653 (40.7%) |
| Time Bazar | 544 | 357/544 (65.6%) | 366/544 (67.3%) | 244/544 (44.9%) |
| Madhur Day | 633 | 414/633 (65.4%) | 420/633 (66.4%) | 280/633 (44.2%) |
| Milan Day | 544 | 349/544 (64.2%) | 341/544 (62.7%) | 226/544 (41.5%) |
| Rajdhani Day | 545 | 343/545 (62.9%) | 375/545 (68.8%) | 235/545 (43.1%) |
| Kalyan | 545 | 355/545 (65.1%) | 375/545 (68.8%) | 238/545 (43.7%) |
| Sridevi Night | 653 | 436/653 (66.8%) | 430/653 (65.8%) | 291/653 (44.6%) |
| Kalyan Night | 449 | 301/449 (67.0%) | 286/449 (63.7%) | 195/449 (43.4%) |
| Madhur Night | 544 | 316/544 (58.1%) | 370/544 (68.0%) | 219/544 (40.3%) |
| Milan Night | 541 | 334/541 (61.7%) | 354/541 (65.4%) | 227/541 (42.0%) |
| Rajdhani Night | 454 | 301/454 (66.3%) | 296/454 (65.2%) | 206/454 (45.4%) |
| Main Bazar | 453 | 295/453 (65.1%) | 308/453 (68.0%) | 199/453 (43.9%) |

## Recent-frozen market table

| Market | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 120 | 84/120 (70.0%) | 87/120 (72.5%) | 62/120 (51.7%) |
| Time Bazar | 102 | 71/102 (69.6%) | 71/102 (69.6%) | 50/102 (49.0%) |
| Madhur Day | 120 | 87/120 (72.5%) | 90/120 (75.0%) | 67/120 (55.8%) |
| Milan Day | 102 | 72/102 (70.6%) | 72/102 (70.6%) | 53/102 (52.0%) |
| Rajdhani Day | 102 | 74/102 (72.5%) | 76/102 (74.5%) | 59/102 (57.8%) |
| Kalyan | 102 | 74/102 (72.5%) | 77/102 (75.5%) | 56/102 (54.9%) |
| Sridevi Night | 120 | 88/120 (73.3%) | 84/120 (70.0%) | 63/120 (52.5%) |
| Kalyan Night | 82 | 58/82 (70.7%) | 57/82 (69.5%) | 40/82 (48.8%) |
| Madhur Night | 102 | 61/102 (59.8%) | 72/102 (70.6%) | 46/102 (45.1%) |
| Milan Night | 101 | 70/101 (69.3%) | 74/101 (73.3%) | 53/101 (52.5%) |
| Rajdhani Night | 85 | 59/85 (69.4%) | 59/85 (69.4%) | 43/85 (50.6%) |
| Main Bazar | 84 | 54/84 (64.3%) | 60/84 (71.4%) | 39/84 (46.4%) |

## Statistical diagnostics

| Block | Target | Coverage | Date-block bootstrap 95% | Circular-shift null mean | Shift p (one-sided) | Worst market |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| development | open | 63.3% | 61.6% - 65.0% | 61.3% | 0.0225 | Madhur Night (53.7%) |
| development | close | 64.0% | 62.3% - 65.8% | 60.2% | 0.000200 | Milan Night (56.8%) |
| development | jodi | 40.4% | 38.5% - 42.5% | 36.9% | 0.000200 | Milan Night (30.9%) |
| validation | open | 60.9% | 57.7% - 64.1% | 60.7% | 0.447 | Rajdhani Day (55.7%) |
| validation | close | 67.0% | 64.8% - 69.3% | 60.1% | 0.000100 | Milan Day (59.4%) |
| validation | jodi | 41.9% | 39.6% - 44.3% | 36.4% | 0.000100 | Sridevi Night (37.2%) |
| holdout | open | 65.5% | 63.0% - 68.2% | 60.6% | 0.000500 | Rajdhani Day (51.5%) |
| holdout | close | 64.1% | 61.8% - 66.2% | 60.3% | 0.0119 | Sridevi (52.5%) |
| holdout | jodi | 42.2% | 39.9% - 44.4% | 36.5% | 0.000300 | Rajdhani Day (32.0%) |
| recentFrozen | open | 69.7% | 64.2% - 75.6% | 60.2% | 0.000100 | Madhur Night (59.8%) |
| recentFrozen | close | 71.9% | 66.7% - 77.6% | 59.0% | 0.000100 | Rajdhani Night (69.4%) |
| recentFrozen | jodi | 51.6% | 43.5% - 60.4% | 35.6% | 0.000100 | Madhur Night (45.1%) |
| overall | open | 64.5% | 62.9% - 66.2% | 60.7% | 0.000100 | Madhur Night (58.1%) |
| overall | close | 66.1% | 64.7% - 67.7% | 60.2% | 0.000100 | Milan Day (62.7%) |
| overall | jodi | 43.1% | 41.2% - 45.4% | 36.5% | 0.000100 | Madhur Night (40.3%) |

The circular-shift diagnostic preserves each market's observed Open/Close pairs and forecast-set frequencies while breaking their date alignment. It is not selection-adjusted, so low p-values cannot rehabilitate a model tuned on these same rows.

## Goal100 feasibility verdict at this checkpoint

The recent-frozen block still contains 370 Open misses, 343 Close misses, and 591 Jodi misses. Its worst markets are Madhur Night for Open (59.8%), Rajdhani Night for Close (69.4%), and Madhur Night for Jodi (45.1%).

If the recent aggregate Jodi coverage (51.6%) were stationary and independent - a deliberately simplified diagnostic - the probability of 360 consecutive all-market hits would be approximately 4.62e-104. This is not a formal forecast, but it shows how far the outcomes-only baseline is from empirical Goal100.

Conclusion: 100% is statistically unsupported by the current outcomes-only model and all inspected historical evidence. The production comparator remains useful, but it is not a Goal100 candidate. A challenger may enter sealed-forward testing only after nested chronological selection, full hash freezing, and non-regression in every retrospective gate.

## Integrity

- Source audit SHA-256: `21675bcb6b1764098b916c0f34f57b3139b17aa49956b1406c374cc693f62d24`
- Frozen data SHA-256: `8674f471f4056ce2c2eb18508952604834f5c1d94577bef11cde7e7d7f1318c3`
- Production fingerprint: `d8f09a304bc2eb0a35df2394b850fea0bf932fbb3983196bb53bd3575ba13d8b`
- Prediction sizes: six Open digits, six Close digits, and their 36-cell Jodi rectangle.
- No production files were modified by this research cycle.
