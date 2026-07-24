# Exact-panel Top-30 research v2

Generated: 2026-07-15T03:43:15.099027+05:30

## Outcome

The 90% target is reported only against the terminal chronological holdout. No holdout result was used for model or blend selection.

| Task | Chosen model | Holdout N | Top-30 hits | Accuracy | 95% Wilson interval | 90% achieved |
|---|---:|---:|---:|---:|---:|---:|
| open | learned | 974 | 173 | 17.8% | 15.5%–20.3% | no |
| close_preopen | learned | 974 | 216 | 22.2% | 19.7%–24.9% | no |
| close_adjusted | learned | 974 | 196 | 20.1% | 17.7%–22.8% | no |

The target would require 877 hits in each 974-row terminal block. The observed shortfalls are 704 Open, 661 pre-Open Close, and 681 adjusted Close hits.

## Data audit

- Frozen cache SHA-256: `02819f1d933f4fe2e340bb241ebcbe2d4f5859a7228b8f72682a234818056bd0`.
- 7287 valid completed rows across 12 markets, from 2024-06-28 through 2026-07-05.
- Invalid rows: 0; duplicate market-dates: 0; panel/sutta mismatches: 0.

## Baselines and learned models

| Task | Hot | Fixed profile | Learned | Ensemble |
|---|---:|---:|---:|---:|
| open | 16.4% | 16.9% | 17.8% | 17.8% |
| close_preopen | 19.1% | 19.6% | 22.2% | 22.2% |
| close_adjusted | 19.1% | 19.4% | 20.1% | 20.1% |

## Model selection evidence

Hyperparameters below are ordered by the untouched-for-training 2026 Q1 selection block. The terminal and post-cache results did not select a model.

### open

| Candidate | Loss | 2025 Q4 early-stop Top-30 | 2026 Q1 selection Top-30 | Decision |
|---|---:|---:|---:|---:|
| dynamic_wd01 | cross_entropy | 20.2% | 20.8% | keep |
| additive_top30 | top30_margin | 18.3% | 19.6% | reject |
| dynamic_wd1 | cross_entropy | 20.7% | 19.1% | reject |
| additive_wd01 | cross_entropy | 18.5% | 18.9% | reject |
| additive_wd1 | cross_entropy | 18.5% | 18.2% | reject |
| lowrank_d50 | cross_entropy | 18.4% | 17.5% | reject |
| lowrank_top30 | top30_margin | 20.1% | 17.4% | reject |
| lowrank_d25 | cross_entropy | 20.5% | 17.2% | reject |
| dynamic_top30 | top30_margin | 17.9% | 16.8% | reject |

### close_preopen

| Candidate | Loss | 2025 Q4 early-stop Top-30 | 2026 Q1 selection Top-30 | Decision |
|---|---:|---:|---:|---:|
| additive_wd01 | cross_entropy | 20.7% | 20.7% | keep |
| additive_wd1 | cross_entropy | 20.7% | 20.6% | reject |
| lowrank_d50 | cross_entropy | 22.1% | 19.1% | reject |
| dynamic_wd01 | cross_entropy | 21.8% | 19.1% | reject |
| dynamic_wd1 | cross_entropy | 21.5% | 19.1% | reject |
| additive_top30 | top30_margin | 21.0% | 19.1% | reject |
| lowrank_d25 | cross_entropy | 21.2% | 19.0% | reject |
| lowrank_top30 | top30_margin | 19.7% | 18.1% | reject |
| dynamic_top30 | top30_margin | 20.6% | 17.8% | reject |

### close_adjusted

| Candidate | Loss | 2025 Q4 early-stop Top-30 | 2026 Q1 selection Top-30 | Decision |
|---|---:|---:|---:|---:|
| dynamic_wd1 | cross_entropy | 22.6% | 20.6% | keep |
| dynamic_wd01 | cross_entropy | 22.6% | 20.4% | reject |
| additive_wd1 | cross_entropy | 21.2% | 20.2% | reject |
| dynamic_top30 | top30_margin | 20.4% | 20.1% | reject |
| additive_wd01 | cross_entropy | 20.9% | 20.0% | reject |
| lowrank_d25 | cross_entropy | 23.0% | 19.9% | reject |
| additive_top30 | top30_margin | 20.4% | 19.5% | reject |
| lowrank_d50 | cross_entropy | 22.9% | 18.0% | reject |
| lowrank_top30 | top30_margin | 19.0% | 17.6% | reject |

## Market robustness on the terminal holdout

| Market | Open | Pre-Open Close | Adjusted Close |
|---|---:|---:|---:|
| Sridevi | 17.7% | 20.8% | 18.8% |
| Time Bazar | 13.4% | 23.2% | 23.2% |
| Madhur Day | 20.8% | 11.5% | 14.6% |
| Milan Day | 19.7% | 25.0% | 21.1% |
| Rajdhani Day | 13.4% | 24.4% | 17.1% |
| Kalyan | 15.9% | 24.4% | 18.3% |
| Sridevi Night | 17.7% | 25.0% | 17.7% |
| Kalyan Night | 24.6% | 27.7% | 27.7% |
| Madhur Night | 18.3% | 19.5% | 17.1% |
| Milan Night | 19.5% | 30.5% | 32.9% |
| Rajdhani Night | 19.1% | 16.2% | 19.1% |
| Main Bazar | 13.4% | 19.4% | 16.4% |

## Calibration

Top-30 probability mass should match the realized Top-30 hit rate. All selected models are overconfident, so raw score mass must not be shown as a success probability.

| Task | Mean predicted Top-30 mass | Realized hit rate | ECE (5 bins) |
|---|---:|---:|---:|
| open | 24.0% | 17.8% | 6.3% |
| close_preopen | 27.2% | 22.2% | 5.0% |
| close_adjusted | 26.4% | 20.1% | 6.2% |

## Post-cache forward check

After the model specification was frozen, the public charts supplied 78 completed rows newer than each market's cache cutoff.

| Task | Forward N | Chosen Top-30 hits | Accuracy | Fixed profile |
|---|---:|---:|---:|---:|
| open | 78 | 17 | 21.8% | 24.4% |
| close_preopen | 78 | 15 | 19.2% | 17.9% |
| close_adjusted | 78 | 10 | 12.8% | 19.2% |

## Negative-label control

Training labels were permuted within market while terminal labels stayed untouched. This retains marginal market frequencies but destroys learned temporal relationships.

| Task | Selected model | Negative control |
|---|---:|---:|
| open | 17.8% | 16.4% |
| close_preopen | 22.2% | 19.9% |
| close_adjusted | 20.1% | 20.3% |

## Hypothesis decisions

- Keep cautiously: smoothed panel kind/pair structure, short-window counts, and sparse lag-transition terms. They supply small rank improvements, especially for pre-Open Close.
- Reject as a universal rule: opposite digits, weekday identities, hot/cold panels, and same-day cross-market relations. Their learned weights and market/month results are unstable.
- Reject: adjusted Close as an improvement over pre-Open Close. It is worse on the 974-row holdout, worse on the 78-row forward slice, and no better than its permuted-label control.
- Reject: low-rank neural models. Added capacity reduced selection accuracy.
- Reject: direct Top-30 margin optimization. None of its dynamic, additive, or low-rank variants displaced the cross-entropy winners on the selection block.
- Reject: profile/learned probability blending. Validation selected 100% learned weight for all three tasks.

## Feasibility audit

These hindsight references are intentionally optimistic because they see all outcomes.

| Side | Uniform 30/220 | Hindsight market Top-30 | Hindsight market+weekday Top-30 | Median labels needed to cover 90% | Effective panels |
|---|---:|---:|---:|---:|---:|
| open | 13.6% | 30.9% | 51.5% | 142 | 163.0 |
| close | 13.6% | 31.6% | 51.5% | 138 | 159.9 |

## Validation design

- Minimum 120 prior results per market.
- Causal rolling features only; a target outcome never enters its own features.
- Same-day inputs use only the declared earlier-market timing map.
- Only adjusted Close receives the known same-day Open panel.
- Training ends 2025-09-30, early stopping uses 2025 Q4, selection uses 2026 Q1, and the final audit starts 2026-04-01.
- Exact McNemar tests compare the chosen model with the fixed profile on identical draws.

## Interpretation

A Top-30 hit is set coverage, not a profitable wager. Selecting 30 outcomes has a cost, and this research has no payout, stake, or liability data. A result below 90% is not raised by changing the denominator, selecting only favorable markets, or looking at holdout outcomes.

The full market table, calibration bins, selection trials, weights, hashes, and shortfalls are in `results.json`; every terminal prediction is in `holdout_ledger.csv`.

## Research artifacts

- `research\panel_top30_v2\models\open.pt` — SHA-256 `d467ae2066d20842d9b3ffceafa5502cf15138536d9f28e6206cb5950b72f28e`.
- `research\panel_top30_v2\models\close_preopen.pt` — SHA-256 `964b71c482d2d9f53316c3fb5689fc19e9f559e01e3e5b9e4ccf832d16947044`.
- `research\panel_top30_v2\models\close_adjusted.pt` — SHA-256 `3c8747e3b0f5849e7a78dfc395f28f60b8049a4149a554ce13ca9ea1e5fe3604`.

These artifacts are intentionally not wired into the application. The adjusted-Close artifact is retained for reproducibility, not recommended for use.
