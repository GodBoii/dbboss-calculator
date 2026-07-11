# Sutta Above-90 Model Promotion

Generated: 2026-07-11

This report compares the previously implemented production Top-6 model with the newly promoted market-specific lag, calendar, panel-arithmetic, and jodi-arithmetic pack. All reported 30-day figures come from the exact app prediction builders.

## Overall Top-6 accuracy

| Window | Model | Open | Close | Jodi |
| --- | --- | ---: | ---: | ---: |
| Last 30 calendar days | Previous app model | 259/309 (83.8%) | 247/309 (79.9%) | 209/309 (67.6%) |
| Last 30 calendar days | Above-90 app model | 280/309 (90.6%) | 279/309 (90.3%) | 255/309 (82.5%) |
| Last 730 calendar days | Previous app model | 4228/6687 (63.2%) | 4308/6687 (64.4%) | 2750/6687 (41.1%) |
| Last 730 calendar days | Above-90 model ledger | 4331/6687 (64.8%) | 4422/6687 (66.1%) | 2920/6687 (43.7%) |

Thirty-day improvement: +21 Open hits, +32 Close hits, and +46 Jodi hits. Long-window improvement: +103 Open hits, +114 Close hits, and +170 Jodi hits.

## Last-30 market comparison

| Market | N | Old Open | New Open | Hit delta | Old Close | New Close | Hit delta | Old Jodi | New Jodi | Hit delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 30 | 76.7% | 86.7% | +3 | 86.7% | 96.7% | +3 | 63.3% | 83.3% | +6 |
| Time Bazar | 26 | 80.8% | 88.5% | +2 | 84.6% | 92.3% | +2 | 65.4% | 80.8% | +4 |
| Madhur Day | 30 | 76.7% | 83.3% | +2 | 76.7% | 86.7% | +3 | 63.3% | 73.3% | +3 |
| Milan Day | 26 | 80.8% | 84.6% | +1 | 80.8% | 92.3% | +3 | 65.4% | 80.8% | +4 |
| Rajdhani Day | 26 | 88.5% | 92.3% | +1 | 69.2% | 84.6% | +4 | 65.4% | 80.8% | +4 |
| Kalyan | 26 | 92.3% | 96.2% | +1 | 69.2% | 80.8% | +3 | 65.4% | 76.9% | +3 |
| Sridevi Night | 30 | 93.3% | 96.7% | +1 | 83.3% | 93.3% | +3 | 80.0% | 90.0% | +3 |
| Kalyan Night | 19 | 78.9% | 89.5% | +2 | 73.7% | 89.5% | +3 | 57.9% | 78.9% | +4 |
| Madhur Night | 26 | 88.5% | 96.2% | +2 | 76.9% | 84.6% | +2 | 73.1% | 84.6% | +3 |
| Milan Night | 26 | 88.5% | 88.5% | +0 | 88.5% | 96.2% | +2 | 76.9% | 84.6% | +2 |
| Rajdhani Night | 22 | 77.3% | 90.9% | +3 | 77.3% | 90.9% | +3 | 59.1% | 86.4% | +6 |
| Main Bazar | 22 | 81.8% | 95.5% | +3 | 90.9% | 95.5% | +1 | 72.7% | 90.9% | +4 |

No market regressed in last-30 Open, Close, or Jodi accuracy. Milan Night Open tied; every other market/side improved.

## Interpretation

The accepted pack uses only time-valid completed records: earlier same-day markets, completed prior draws, fixed draw lags, previous matching weekday/day-of-month, panel arithmetic, and source/opposite cycles. Broad formula, Bayesian, k-nearest-neighbor, and expert-router candidates that failed chronological validation were rejected.

The 90% figures are retrospective Top-6 backtest coverage, not a guarantee of future results. Because the hypothesis search was broad, the next safeguard is forward scoring on unseen draws without changing these rules during the scoring period.
