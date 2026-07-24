# Selective Top-60 confidence-gate audit

Generated: 2026-07-24T01:20:38.206485+05:30

The gate may abstain, but the selected rows still contain the same 60-panel prediction set. Gate thresholds and market lists were selected only from the historical model-selection block.

| Task | Gate | Selection coverage | Selection hit rate | Selection Wilson low | Terminal coverage | Terminal hit rate | Forward coverage | Forward hit rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| open | `profile_hot_agreement:high:0.80` | 86.0% | 41.7% | 38.2% | 79.2% | 35.3% | 81.3% | 40.2% |
| close_preopen | `top_selection_markets:4` | 37.7% | 46.3% | 41.1% | 38.0% | 38.9% | 36.0% | 37.0% |

## Ungated reference

| Task | Selection | Terminal | Forward |
|---|---:|---:|---:|
| open | 40.0% | 34.7% | 39.3% |
| close_preopen | 41.7% | 39.9% | 36.7% |

## Interpretation

A gate is not production-eligible merely because it wins on the block that selected it. It must retain the improvement on terminal and genuinely future rows, with enough coverage and a confidence interval that excludes the ungated rate. The frozen gate artifact exists so later rows can be evaluated without changing the rule after seeing their outcomes.
