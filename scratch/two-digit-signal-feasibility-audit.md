# Two-Digit Signal Feasibility Audit

Generated: 2026-07-10T07:23:05.099Z

## Outcome Geometry

| Panel kind | Rows | Share | Random pair strict accuracy |
|---|---:|---:|---:|
| SP (3 unique digits) | 10905 | 74.8% | 46.7% |
| DP (2 unique digits) | 3640 | 25.0% | 62.2% |
| TP (1 unique digit) | 29 | 0.2% | 80.0% |
| Empirical mixture | 14574 | 100.0% | 50.6% |

## Stable-Signal Checks

- A fixed pair chosen on the first 70% of each market-side scored 51.6% (2263/4386) on the later 30%.
- Across every pair and market-side, the base strict rate was 50.6%. After the same pair succeeded, its next-result rate was 50.8%; after failure it was 50.5%.
- The 23/30 isolated result has a 95% Wilson interval of 59.1% to 88.2%.
- The 63/95 rolling result has a 95% Wilson interval of 56.3% to 75.0%.

## Interpretation

- For an SP panel, 21 of the 45 possible avoid pairs are correct, so an uninformed pair starts at 46.7%, not near 80%.
- Reaching 80% requires stable information about which specific digits will appear, not merely knowing general panel frequencies.
- A confidence interval that includes values below the target cannot establish a production-safe 80% rate.