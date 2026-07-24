# Exact-panel Top-60 market-specific research v1

Generated: 2026-07-24T00:58:04.725604+05:30

## Outcome

The 90% target is reported only against the terminal chronological holdout. No holdout result was used for model or blend selection.

| Task | Chosen model | Holdout N | Top-60 hits | Accuracy | 95% Wilson interval | 90% achieved |
|---|---:|---:|---:|---:|---:|---:|
| open | learned | 974 | 338 | 34.7% | 31.8%–37.7% | no |
| close_preopen | learned | 974 | 389 | 39.9% | 36.9%–43.0% | no |
| close_adjusted | learned | 974 | 375 | 38.5% | 35.5%–41.6% | no |

Required hits and observed shortfalls are computed independently for each task:

| Task | Required for 90% | Actual | Shortfall |
|---|---:|---:|---:|
| open | 877 | 338 | 539 |
| close_preopen | 877 | 389 | 488 |
| close_adjusted | 877 | 375 | 502 |

## Data audit

- Frozen cache SHA-256: `02819f1d933f4fe2e340bb241ebcbe2d4f5859a7228b8f72682a234818056bd0`.
- 7287 valid completed rows across 12 markets, from 2024-06-28 through 2026-07-05.
- Invalid rows: 0; duplicate market-dates: 0; panel/sutta mismatches: 0.

## Baselines and learned models

| Task | Hot | Fixed profile | Learned | Ensemble |
|---|---:|---:|---:|---:|
| open | 30.3% | 33.9% | 34.7% | 34.7% |
| close_preopen | 35.0% | 38.7% | 39.9% | 39.9% |
| close_adjusted | 35.0% | 38.3% | 38.5% | 40.6% |

## Model selection evidence

Hyperparameters below are ordered by the untouched-for-training 2026 Q1 selection block. The terminal and post-cache results did not select a model.

### open

| Candidate | Loss | 2025 Q4 early-stop Top-60 | 2026 Q1 selection Top-60 | Decision |
|---|---:|---:|---:|---:|
| dynamic_wd01 | cross_entropy | 39.2% | 40.0% | keep |
| dynamic_wd1 | cross_entropy | 39.3% | 37.4% | reject |
| additive_wd1 | cross_entropy | 38.4% | 37.2% | reject |
| additive_wd01 | cross_entropy | 38.3% | 36.8% | reject |
| dynamic_top60 | topk_margin | 33.6% | 36.5% | reject |
| lowrank_d50 | cross_entropy | 37.4% | 35.8% | reject |
| lowrank_d25 | cross_entropy | 39.8% | 34.5% | reject |
| additive_top60 | topk_margin | 37.5% | 33.9% | reject |
| lowrank_top60 | topk_margin | 38.0% | 32.3% | reject |

### close_preopen

| Candidate | Loss | 2025 Q4 early-stop Top-60 | 2026 Q1 selection Top-60 | Decision |
|---|---:|---:|---:|---:|
| dynamic_wd01 | cross_entropy | 42.2% | 41.7% | keep |
| dynamic_wd1 | cross_entropy | 41.7% | 41.0% | reject |
| additive_wd1 | cross_entropy | 41.4% | 40.0% | reject |
| additive_wd01 | cross_entropy | 41.0% | 40.0% | reject |
| lowrank_d25 | cross_entropy | 40.9% | 38.5% | reject |
| lowrank_d50 | cross_entropy | 40.6% | 37.9% | reject |
| additive_top60 | topk_margin | 40.4% | 37.9% | reject |
| dynamic_top60 | topk_margin | 37.2% | 37.2% | reject |
| lowrank_top60 | topk_margin | 41.5% | 36.8% | reject |

### close_adjusted

| Candidate | Loss | 2025 Q4 early-stop Top-60 | 2026 Q1 selection Top-60 | Decision |
|---|---:|---:|---:|---:|
| dynamic_wd01 | cross_entropy | 42.4% | 40.9% | keep |
| dynamic_wd1 | cross_entropy | 42.2% | 40.9% | reject |
| additive_wd01 | cross_entropy | 41.5% | 39.7% | reject |
| additive_wd1 | cross_entropy | 41.5% | 39.7% | reject |
| lowrank_d50 | cross_entropy | 39.5% | 39.4% | reject |
| lowrank_d25 | cross_entropy | 39.2% | 38.7% | reject |
| lowrank_top60 | topk_margin | 39.7% | 35.8% | reject |
| additive_top60 | topk_margin | 38.0% | 35.3% | reject |
| dynamic_top60 | topk_margin | 38.2% | 32.8% | reject |

## Market robustness on the terminal holdout

| Market | Open | Pre-Open Close | Adjusted Close |
|---|---:|---:|---:|
| Sridevi | 37.5% | 40.6% | 40.6% |
| Time Bazar | 28.0% | 37.8% | 37.8% |
| Madhur Day | 32.3% | 25.0% | 34.4% |
| Milan Day | 32.9% | 34.2% | 34.2% |
| Rajdhani Day | 30.5% | 48.8% | 46.3% |
| Kalyan | 34.1% | 46.3% | 36.6% |
| Sridevi Night | 33.3% | 44.8% | 45.8% |
| Kalyan Night | 43.1% | 46.2% | 44.6% |
| Madhur Night | 36.6% | 34.1% | 41.5% |
| Milan Night | 36.6% | 50.0% | 37.8% |
| Rajdhani Night | 44.1% | 36.8% | 33.8% |
| Main Bazar | 29.9% | 35.8% | 25.4% |

## Calibration

Top-60 probability mass should match the realized Top-60 hit rate. All selected models are overconfident, so raw score mass must not be shown as a success probability.

| Task | Mean predicted Top-60 mass | Realized hit rate | ECE (5 bins) |
|---|---:|---:|---:|
| open | 42.1% | 34.7% | 7.4% |
| close_preopen | 45.0% | 39.9% | 5.1% |
| close_adjusted | 43.7% | 38.5% | 5.2% |

## Post-cache forward check

After the model specification was frozen, the public charts supplied 150 completed rows newer than each market's cache cutoff.

| Task | Forward N | Chosen Top-60 hits | Accuracy | Fixed profile |
|---|---:|---:|---:|---:|
| open | 150 | 59 | 39.3% | 38.7% |
| close_preopen | 150 | 55 | 36.7% | 41.3% |
| close_adjusted | 150 | 57 | 38.0% | 40.7% |

## Negative-label control

Training labels were permuted within market while terminal labels stayed untouched. This retains marginal market frequencies but destroys learned temporal relationships.

| Task | Selected model | Negative control |
|---|---:|---:|
| open | 34.7% | 35.0% |
| close_preopen | 39.9% | 37.6% |
| close_adjusted | 38.5% | 38.6% |

## Hypothesis decisions

- Keep cautiously: smoothed panel kind/pair structure, short-window counts, and sparse lag-transition terms. They supply small rank improvements, especially for pre-Open Close.
- Reject as a universal rule: opposite digits, weekday identities, hot/cold panels, and same-day cross-market relations. Their learned weights and market/month results are unstable.
- Treat adjusted Close as a separate candidate only when it beats pre-Open Close on both the terminal holdout and the untouched forward slice.
- Reject: low-rank neural models. Added capacity reduced selection accuracy.
- Direct Top-60 margin optimization is promoted only if its dynamic, additive, or low-rank variant displaces the cross-entropy candidates on the selection block.
- Reject: profile/learned probability blending. Validation selected 100% learned weight for all three tasks.

## Feasibility audit

These hindsight references are intentionally optimistic because they see all outcomes.

| Side | Uniform 60/220 | Hindsight market Top-60 | Hindsight market+weekday Top-60 | Median labels needed to cover 90% | Effective panels |
|---|---:|---:|---:|---:|---:|
| open | 27.3% | 52.5% | 81.1% | 142 | 163.0 |
| close | 27.3% | 53.8% | 81.2% | 138 | 159.9 |

## Validation design

- Minimum 120 prior results per market.
- Causal rolling features only; a target outcome never enters its own features.
- Same-day inputs use only the declared earlier-market timing map.
- Only adjusted Close receives the known same-day Open panel.
- Training ends 2025-09-30, early stopping uses 2025 Q4, selection uses 2026 Q1, and the final audit starts 2026-04-01.
- Exact McNemar tests compare the chosen model with the fixed profile on identical draws.

## Interpretation

A Top-60 hit is set coverage, not a profitable wager. Selecting 60 outcomes has a cost, and this research has no payout, stake, or liability data. A result below 90% is not raised by changing the denominator, selecting only favorable markets, or looking at holdout outcomes.

The full market table, calibration bins, selection trials, weights, hashes, and shortfalls are in `results.json`; every terminal prediction is in `holdout_ledger.csv`.

## Research artifacts

- `research\panel_top60_v1\models\open.pt` — SHA-256 `d467ae2066d20842d9b3ffceafa5502cf15138536d9f28e6206cb5950b72f28e`.
- `research\panel_top60_v1\models\close_preopen.pt` — SHA-256 `6b15db4dca7032c8cf2498319fe979ec899e76438b6911f17419fe73734e39fd`.
- `research\panel_top60_v1\models\close_adjusted.pt` — SHA-256 `c1b482948be9497fa8a3ca9b930d303617e397fb9e377d47d313d136da7c72c4`.

These artifacts are intentionally not wired into the application. The adjusted-Close artifact is retained for reproducibility, not recommended for use.
