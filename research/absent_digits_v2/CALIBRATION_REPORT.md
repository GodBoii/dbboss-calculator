# Confidence Calibration Audit

Generated: 2026-07-24T11:58:29.883996+00:00

## Decision

**Promoted.** Validation selected `local_beta_w240_s80` from 44 strictly causal reliability estimators. The runtime currently uses `local_beta_w120_s10`.

A candidate is promoted only if it improves validation Brier loss, does not regress on either Holdout or Recent, has a week-clustered 95% bootstrap interval below zero on their combined Brier difference, and does not regress on the later Post-cache + Independent extension.

## Chronological calibration

| Block | Method | N | Observed | Mean predicted | Brier | Log loss | ECE | AUC | Top 20% | Top 20% 95% lower |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | `local_beta_w240_s80` | 2348 | 52.1% | 51.6% | 0.2497 | 0.6926 | 0.8% | 0.5086 | 52.1% | 47.6% |
| Validation | `local_beta_w120_s10` | 2348 | 52.1% | 51.6% | 0.2507 | 0.6946 | 2.3% | 0.5082 | 53.0% | 48.5% |
| Holdout | `local_beta_w240_s80` | 2466 | 50.5% | 51.3% | 0.2511 | 0.6954 | 2.5% | 0.4849 | 47.2% | 42.8% |
| Holdout | `local_beta_w120_s10` | 2466 | 50.5% | 51.5% | 0.2521 | 0.6973 | 3.7% | 0.4852 | 49.4% | 45.0% |
| Recent | `local_beta_w240_s80` | 2300 | 51.9% | 51.1% | 0.2502 | 0.6936 | 1.7% | 0.4988 | 51.3% | 46.7% |
| Recent | `local_beta_w120_s10` | 2300 | 51.9% | 50.7% | 0.2510 | 0.6952 | 3.5% | 0.4982 | 54.3% | 49.8% |
| Post Cache | `local_beta_w240_s80` | 288 | 45.8% | 51.0% | 0.2506 | 0.6943 | 5.5% | 0.5179 | 36.2% | 25.1% |
| Post Cache | `local_beta_w120_s10` | 288 | 45.8% | 51.2% | 0.2520 | 0.6972 | 5.3% | 0.4931 | 39.7% | 28.1% |
| Independent Extension | `local_beta_w240_s80` | 88 | 60.2% | 50.9% | 0.2504 | 0.6940 | 9.9% | 0.4730 | 61.1% | 38.6% |
| Independent Extension | `local_beta_w120_s10` | 88 | 60.2% | 50.7% | 0.2514 | 0.6959 | 9.6% | 0.4450 | 61.1% | 38.6% |

## Paired Brier confirmation

| Evidence block | Candidate minus current | Week-clustered 95% interval | P(candidate improves) |
| --- | ---: | ---: | ---: |
| Holdout + Recent | -0.00087 | [-0.00157, -0.00014] | 99.1% |
| Post-cache + Independent extension | -0.00133 | [-0.00217, -0.00073] | 100.0% |

## Interpretation

- Brier and log loss test probability quality; AUC tests whether confidence ranks hits above misses.
- The top-quintile Wilson lower bound prevents a small high-score pocket from being mistaken for a safe call.
- The 80% action gate remains based on prequential Wilson evidence, not on the point confidence estimate.
