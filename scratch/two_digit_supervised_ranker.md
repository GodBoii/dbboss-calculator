# Two-Digit Supervised Pair Ranker

Generated: 2026-07-09T13:09:57.408406Z
Methods tested: 2

## Latest 30 Full Coverage

- Strict accuracy: 53.3% (384/720)
- Average correctly eliminated digits: 1.48 / 2
- Market-sides >=70%: 1/24
- Market-sides >=80%: 0/24

## Rolling Forward Check

- Skipped in this compact run because the uncached supervised feature builder is too slow for repeated folds.

| Market | Side | Model | Val | Test | Avg Digits |
|---|---|---|---:|---:|---:|
| Sridevi | open | ridge_l2_100 | 41.7% (25/60) | 56.7% (17/30) | 1.53 |
| Sridevi | close | ridge_l2_100 | 48.3% (29/60) | 56.7% (17/30) | 1.53 |
| Time Bazar | open | ridge_l2_100 | 38.3% (23/60) | 43.3% (13/30) | 1.40 |
| Time Bazar | close | ridge_l2_100 | 56.7% (34/60) | 53.3% (16/30) | 1.43 |
| Madhur Day | open | ridge_l2_100 | 51.7% (31/60) | 63.3% (19/30) | 1.60 |
| Madhur Day | close | ridge_l2_100 | 55.0% (33/60) | 66.7% (20/30) | 1.60 |
| Milan Day | open | ridge_l2_100 | 55.0% (33/60) | 46.7% (14/30) | 1.40 |
| Milan Day | close | ridge_l2_500 | 50.0% (30/60) | 50.0% (15/30) | 1.47 |
| Rajdhani Day | open | ridge_l2_100 | 55.0% (33/60) | 70.0% (21/30) | 1.70 |
| Rajdhani Day | close | ridge_l2_100 | 53.3% (32/60) | 56.7% (17/30) | 1.50 |
| Kalyan | open | ridge_l2_100 | 58.3% (35/60) | 60.0% (18/30) | 1.60 |
| Kalyan | close | ridge_l2_500 | 56.7% (34/60) | 43.3% (13/30) | 1.40 |
| Sridevi Night | open | ridge_l2_100 | 50.0% (30/60) | 63.3% (19/30) | 1.53 |
| Sridevi Night | close | ridge_l2_100 | 51.7% (31/60) | 56.7% (17/30) | 1.57 |
| Kalyan Night | open | ridge_l2_100 | 50.0% (30/60) | 50.0% (15/30) | 1.50 |
| Kalyan Night | close | ridge_l2_100 | 48.3% (29/60) | 53.3% (16/30) | 1.53 |
| Madhur Night | open | ridge_l2_100 | 36.7% (22/60) | 40.0% (12/30) | 1.30 |
| Madhur Night | close | ridge_l2_100 | 40.0% (24/60) | 53.3% (16/30) | 1.47 |
| Milan Night | open | ridge_l2_100 | 51.7% (31/60) | 50.0% (15/30) | 1.43 |
| Milan Night | close | ridge_l2_100 | 46.7% (28/60) | 36.7% (11/30) | 1.30 |
| Rajdhani Night | open | ridge_l2_100 | 60.0% (36/60) | 56.7% (17/30) | 1.57 |
| Rajdhani Night | close | ridge_l2_100 | 50.0% (30/60) | 46.7% (14/30) | 1.30 |
| Main Bazar | open | ridge_l2_100 | 56.7% (34/60) | 43.3% (13/30) | 1.37 |
| Main Bazar | close | ridge_l2_100 | 48.3% (29/60) | 63.3% (19/30) | 1.60 |

## Interpretation

- This is a deployable-style supervised ranker: it trains only on records before validation/test windows.
- Each possible two-digit pair becomes a candidate row with frequency, context, gap, transition, house, parity, and previous-result features.
- The model chooses the pair with the highest learned score for both digits being absent.
- If it cannot repeatedly clear 80% strict in rolling folds, it should not be used as a live avoid-call engine.