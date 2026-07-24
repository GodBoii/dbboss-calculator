# Dynamic Expert-Weighting Ablation

Generated: 2026-07-24T12:06:32.911463+00:00

## Decision

**Rejected validation winner `long_only`.** The family blend is fixed at 75% appearance and 25% direct absence so this audit isolates only within-family weighting.

Promotion requires a validation gain, no Holdout or Recent regression, a paired confirmation win at p < .05, no combined later-extension regression, and no market-side worst-case loss beyond two points.

## Validation selection

| Configuration | Strict | Avg absent | Macro | Worst market-side |
| --- | ---: | ---: | ---: | ---: |
| `dynamic_eta35_decay097` | 52.1% (1224/2348) | 1.471/2 | 52.2% | 39.7% |
| `uniform` | 52.0% (1220/2348) | 1.469/2 | 52.0% | 41.3% |
| `long_only` | 52.3% (1227/2348) | 1.470/2 | 52.2% | 41.5% |
| `dynamic_slow_eta10_decay099` | 51.9% (1218/2348) | 1.468/2 | 51.9% | 41.3% |
| `dynamic_moderate_eta15_decay095` | 51.7% (1214/2348) | 1.466/2 | 51.8% | 39.7% |
| `dynamic_fast_eta70_decay090` | 52.0% (1220/2348) | 1.468/2 | 52.0% | 40.5% |

## Chronological confirmation

| Block | Selected | Baseline | Selected-only | Baseline-only | Pair changes | Exact sign p |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 52.3% | 52.1% | 310 | 307 | 65.8% | 0.9358 |
| Holdout | 50.1% | 50.5% | 351 | 362 | 67.7% | 0.7081 |
| Recent | 49.8% | 51.9% | 339 | 386 | 72.0% | 0.0875 |
| Post Cache | 47.6% | 45.8% | 44 | 39 | 74.7% | 0.6609 |
| Independent Extension | 59.1% | 60.2% | 14 | 15 | 71.6% | 1.0000 |

## Interpretation

- Every target uses only earlier rows; Open and Close remain separate.
- Uniform and long-only are structural ablations. The remaining candidates vary loss-memory and weight sensitivity.
- A validation winner is descriptive unless every promotion gate persists later. Failed candidates do not enter the runtime engine.
