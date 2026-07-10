# Two-Digit Permutation / False-Discovery Audit

Generated: 2026-07-10T07:57:07.193Z
Null repetitions: 2000

## Exact Portfolio Outcome Permutation

| Coverage | Observed best | Null p-value | Null best p90 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| >=30 calls | 76.7% (23/30) | 0.0060 | 66.7% | 70.0% | 73.3% |
| >=120 calls | 54.7% (394/720) | 0.0970 | 54.6% | 55.2% | 56.4% |

## Configuration-Search Bootstrap

| Family | Searched configs | Observed | Null p-value | Null best p95 | Null best p99 |
|---|---:|---:|---:|---:|---:|
| Rolling portfolio | 480 | 66.3% (63/95) | 0.4628 | 71.7% | 75.0% |
| Regime/volatility | 72 | 65.0% (26/40) | 0.3998 | 71.4% | 75.0% |
| Latent regime | 4 | 66.7% (20/30) | 0.1014 | 66.7% | 73.3% |
| Randomized forest | 5 | 63.5% (40/63) | 0.0410 | 63.2% | 66.7% |
| Temporal reservoir | 5 | 60.6% (43/71) | 0.0815 | 62.0% | 64.8% |

## Interpretation

- Exact permutation preserves every portfolio prediction, validation decision, market-side panel mix, and call count while breaking date-to-prediction alignment.
- The bootstrap asks how often broad configuration search can produce an equally high best pocket from a 50.6% null process.
- A large null p-value means the observed pocket is compatible with search luck and should not be promoted as an 80% model.