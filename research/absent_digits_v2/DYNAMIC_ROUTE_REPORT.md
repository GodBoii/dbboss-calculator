# Dynamic Market-Side Family-Blend Routing Audit

Generated: 2026-07-24T12:16:02.791230+00:00

## Decision

**Retained `global_075`.** Each Open/Close route can choose among appearance weights 0%, 25%, 50%, 75%, and 100% from its own prior hit ledger.

Promotion requires a validation gain, no Holdout or Recent regression, a paired confirmation win at p < .05, no combined later-extension regression, and no market-side worst-case loss beyond two points.

## Validation selection

| Strategy | Strict | Avg absent | Macro | Worst | Blend changes | Pair changes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `global_075` | 52.1% (1224/2348) | 1.471/2 | 52.2% | 39.7% | 0.0% | 0.0% |
| `local_w60_s20` | 51.1% (1200/2348) | 1.457/2 | 51.1% | 38.8% | 62.2% | 13.2% |
| `local_w120_s40` | 51.7% (1214/2348) | 1.465/2 | 51.7% | 38.8% | 69.3% | 14.1% |
| `local_w240_s80` | 51.7% (1213/2348) | 1.466/2 | 51.7% | 42.1% | 77.1% | 14.2% |
| `local_w120_s40_margin02` | 51.9% (1219/2348) | 1.467/2 | 51.9% | 39.7% | 12.6% | 3.3% |
| `local_w240_s80_margin01` | 51.7% (1213/2348) | 1.467/2 | 51.7% | 38.0% | 24.8% | 5.6% |
| `local_w240_s120_margin02` | 52.1% (1223/2348) | 1.471/2 | 52.1% | 39.7% | 3.0% | 0.9% |

## Selected router versus global 75/25

| Block | Selected | Global | Selected-only | Global-only | Pair changes | Exact sign p |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 52.1% | 52.1% | 0 | 0 | 0.0% | 1.0000 |
| Holdout | 50.5% | 50.5% | 0 | 0 | 0.0% | 1.0000 |
| Recent | 51.9% | 51.9% | 0 | 0 | 0.0% | 1.0000 |
| Post Cache | 45.8% | 45.8% | 0 | 0 | 0.0% | 1.0000 |
| Independent Extension | 60.2% | 60.2% | 0 | 0 | 0.0% | 1.0000 |

## Selected blend distribution

| Block | 0% A | 25% A | 50% A | 75% A | 100% A |
| --- | ---: | ---: | ---: | ---: | ---: |
| Validation | 0 | 0 | 0 | 2348 | 0 |
| Holdout | 0 | 0 | 0 | 2466 | 0 |
| Recent | 0 | 0 | 0 | 2300 | 0 |
| Post Cache | 0 | 0 | 0 | 288 | 0 |
| Independent Extension | 0 | 0 | 0 | 88 | 0 |

## Interpretation

- Full-feedback routing can score every blend after each observed panel without using the target outcome early.
- Shrinkage stabilizes local hit rates; margin variants fall back to the global 75/25 blend unless the local advantage is large enough.
- A dynamic route is not deployed unless its validation choice persists across every confirmation gate.
