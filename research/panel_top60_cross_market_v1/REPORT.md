# Top-60 cross-market context audit

Generated: 2026-07-24T01:17:57.872735+05:30

All model-family and blend choices use only the model-selection block. The terminal and post-cache forward blocks do not choose a strategy.

| Task | Selected strategy | Selection baseline | Selection selected | Terminal baseline | Terminal selected | Forward baseline | Forward selected | Forward p |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| open | base | 40.0% | 40.0% | 34.7% | 34.7% | 39.3% | 39.3% | 1.0000 |
| close_preopen | base | 41.7% | 41.7% | 39.9% | 39.9% | 36.7% | 36.7% | 1.0000 |

## open

Best contextual candidate: `combined_coarse:lowrank_d50`.

| Candidate | Selection Top-60 | Epoch |
|---|---:|---:|
| base | 40.0% | 3 |
| combined_coarse:lowrank_d50 | 37.3% | 1 |
| same_day_coarse:lowrank_d50 | 37.2% | 1 |
| previous_coarse:lowrank_d50 | 36.3% | 1 |
| previous_coarse:additive_wd1 | 35.4% | 7 |
| same_day_exact:additive_wd1 | 35.3% | 3 |
| combined_coarse:additive_wd1 | 34.7% | 3 |
| same_day_coarse:additive_wd1 | 33.1% | 5 |

### Forward per market

| Market | N | Baseline | Selected |
|---|---:|---:|---:|
| Sridevi | 14 | 57.1% | 57.1% |
| Time Bazar | 12 | 25.0% | 25.0% |
| Madhur Day | 14 | 28.6% | 28.6% |
| Milan Day | 18 | 44.4% | 44.4% |
| Rajdhani Day | 12 | 41.7% | 41.7% |
| Kalyan | 12 | 58.3% | 58.3% |
| Sridevi Night | 14 | 35.7% | 35.7% |
| Kalyan Night | 10 | 50.0% | 50.0% |
| Madhur Night | 12 | 58.3% | 58.3% |
| Milan Night | 12 | 16.7% | 16.7% |
| Rajdhani Night | 10 | 30.0% | 30.0% |
| Main Bazar | 10 | 20.0% | 20.0% |

## close_preopen

Best contextual candidate: `same_day_coarse:lowrank_d50`.

| Candidate | Selection Top-60 | Epoch |
|---|---:|---:|
| base | 41.7% | 4 |
| same_day_coarse:lowrank_d50 | 41.0% | 1 |
| previous_coarse:lowrank_d50 | 39.9% | 1 |
| same_day_exact:additive_wd1 | 39.7% | 1 |
| combined_coarse:lowrank_d50 | 39.4% | 3 |
| previous_coarse:additive_wd1 | 38.8% | 1 |
| combined_coarse:additive_wd1 | 38.6% | 3 |
| same_day_coarse:additive_wd1 | 36.8% | 1 |

### Forward per market

| Market | N | Baseline | Selected |
|---|---:|---:|---:|
| Sridevi | 14 | 50.0% | 50.0% |
| Time Bazar | 12 | 50.0% | 50.0% |
| Madhur Day | 14 | 7.1% | 7.1% |
| Milan Day | 18 | 27.8% | 27.8% |
| Rajdhani Day | 12 | 25.0% | 25.0% |
| Kalyan | 12 | 58.3% | 58.3% |
| Sridevi Night | 14 | 35.7% | 35.7% |
| Kalyan Night | 10 | 50.0% | 50.0% |
| Madhur Night | 12 | 58.3% | 58.3% |
| Milan Night | 12 | 33.3% | 33.3% |
| Rajdhani Night | 10 | 40.0% | 40.0% |
| Main Bazar | 10 | 10.0% | 10.0% |

## Decision rule

A cross-market strategy is eligible for production only if it improves the untouched terminal block, improves the post-cache forward block, and has a credible paired advantage. Otherwise the production ranker remains unchanged.
