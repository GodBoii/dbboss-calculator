# Family-Blend Selection Stability Audit

Generated: 2026-07-24T12:19:00.356903+00:00

## Decision

**The 75/25 validation winner is retained, but its selection uncertainty is material.**

Later blocks are descriptive only and never feed back into blend choice.

## Validation grid

| Appearance weight | Hits | Strict | Avg absent | Bootstrap selection frequency |
| ---: | ---: | ---: | ---: | ---: |
| 0% | 1204/2348 | 51.3% | 1.456/2 | 1.9% |
| 25% | 1217/2348 | 51.8% | 1.463/2 | 25.4% |
| 50% | 1215/2348 | 51.7% | 1.466/2 | 5.7% |
| 75% | 1224/2348 | 52.1% | 1.471/2 | 53.2% |
| 100% | 1215/2348 | 51.7% | 1.465/2 | 13.7% |

## Clustered uncertainty for 75% appearance

| Comparator | Mean accuracy difference | 95% cluster interval | P(75% is better) |
| ---: | ---: | ---: | ---: |
| 0% | +0.86 pp | [-0.44, +2.28] pp | 89.3% |
| 25% | +0.30 pp | [-0.88, +1.56] pp | 66.3% |
| 50% | +0.38 pp | [-0.40, +1.25] pp | 79.7% |
| 100% | +0.38 pp | [-0.45, +1.23] pp | 79.6% |

## Exclusion stability

- Leave-one-market-side-out: 100.0% retained 75%.
- Leave-one-calendar-month-out: 60.0% retained 75%.

## Descriptive block optima

| Block | Best appearance weight | 75% strict | Best strict |
| --- | ---: | ---: | ---: |
| Validation | 75% | 52.1% | 52.1% |
| Holdout | 0% | 50.5% | 51.1% |
| Recent | 75% | 51.9% | 51.9% |
| Post Cache | 100% | 45.8% | 48.6% |
| Independent Extension | 0% | 60.2% | 63.6% |

## Interpretation

- Week-cluster resampling preserves within-week dependence across markets.
- Route and month exclusions expose whether one pocket determines the winner.
- A non-robust selection remains frozen for honest forward scoring; later descriptive optima cannot replace it.
