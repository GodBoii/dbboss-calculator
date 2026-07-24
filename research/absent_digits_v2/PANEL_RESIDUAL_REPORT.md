# Exact-Panel Residual Signal Audit

Generated: 2026-07-24T11:51:09.077607+00:00

## Decision

**Rejected.** The earlier terminal half selected digit-engine weight `0.75` and panel-ranker weight `0.25`. Promotion requires a persistent confirmation and forward advantage over both single-family controls.

## Results

| Block | N | Selected | Panel only | Digit engine only | Avg absent | Macro | Worst market-side |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Selection | 982 | 51.0% (501/982) | 50.3% | 49.8% | 1.462/2 | 51.2% | 39.0% |
| Confirmation | 966 | 54.2% (524/966) | 49.1% | 52.3% | 1.481/2 | 54.2% | 39.6% |
| Prospective Forward | 156 | 47.4% (74/156) | 51.9% | 50.0% | 1.436/2 | 47.8% | 0.0% |

## Paired comparisons

| Block | Comparator | Selected-only | Comparator-only | Exact sign p |
| --- | --- | ---: | ---: | ---: |
| Selection | Panel only | 195 | 188 | 0.7592 |
| Selection | Digit engine only | 60 | 48 | 0.2898 |
| Confirmation | Panel only | 223 | 173 | 0.0137 |
| Confirmation | Digit engine only | 58 | 39 | 0.0671 |
| Prospective Forward | Panel only | 33 | 40 | 0.4828 |
| Prospective Forward | Digit engine only | 6 | 10 | 0.4545 |

## Exact-pair consensus

| Block | Coverage | Hits | Strict accuracy | 95% lower |
| --- | ---: | ---: | ---: | ---: |
| Selection | 3.5% | 16/34 | 47.1% | 31.5% |
| Confirmation | 4.2% | 23/41 | 56.1% | 41.0% |
| Prospective Forward | 3.2% | 4/5 | 80.0% | 37.6% |

The panel model and digit engine share historical outcomes, so agreement is a selective diagnostic rather than independent confirmation.

The selected blend failed the prospective ledger and is not eligible for the runtime engine. The five-call consensus pocket is descriptive only; its Wilson lower bound is far below 80%.
