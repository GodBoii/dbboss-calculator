# Two-Digit Bayesian Lower-Bound Gate

Generated: 2026-07-09T12:53:09.880Z
Configs tested: 11520
Forward folds: 144

## Validation-Gated Results

- All selected best folds: 51.6% (327/634), folds=144, >=80 test folds=27
- Val >=80% and n>=5: 53.7% (138/257), folds=73, >=80 test folds=18
- Val >=70% and n>=5: 53.5% (250/467), folds=114, >=80 test folds=25

## Top Test Folds

| Market | Side | Window | Val | Test | Coverage | Config |
|---|---|---|---:|---:|---:|---|
| Sridevi | open | 2026-01-05..2026-02-04 | 100.0% (3/3) | 100.0% (1/1) | 1/30 | prev_sum_bucket; train=365; support=5; lower>=0.6; z=1.28; global=false |
| Madhur Day | open | 2026-01-05..2026-02-04 | 100.0% (5/5) | 100.0% (1/1) | 1/30 | prev_sum_bucket; train=240; support=5; lower>=0.65; z=1.28; global=false |
| Madhur Day | close | 2026-03-08..2026-04-06 | 100.0% (5/5) | 100.0% (1/1) | 1/30 | prev_sum_bucket; train=180; support=5; lower>=0.62; z=1.28; global=false |
| Madhur Night | close | 2026-03-23..2026-04-25 | 100.0% (7/7) | 100.0% (2/2) | 2/30 | prev_sum_bucket; train=240; support=5; lower>=0.6; z=1.28; global=false |
| Rajdhani Night | open | 2026-02-27..2026-04-10 | 100.0% (3/3) | 100.0% (2/2) | 2/30 | prev_sutta; train=240; support=24; lower>=0.58; z=1.28; global=false |
| Main Bazar | close | 2026-01-14..2026-02-25 | 100.0% (6/6) | 100.0% (1/1) | 1/30 | prev_sutta; train=180; support=5; lower>=0.7; z=1.28; global=false |
| Milan Day | close | 2026-04-20..2026-05-23 | 90.0% (9/10) | 100.0% (1/1) | 1/30 | prev_sutta; train=180; support=24; lower>=0.52; z=1.28; global=false |
| Madhur Night | close | 2026-06-01..2026-07-04 | 88.9% (8/9) | 100.0% (3/3) | 3/30 | prev_sum_bucket; train=240; support=5; lower>=0.6; z=1.28; global=false |
| Milan Night | close | 2026-01-08..2026-02-12 | 85.7% (6/7) | 100.0% (3/3) | 3/30 | prev_sutta; train=180; support=5; lower>=0.65; z=1.28; global=false |
| Sridevi Night | open | 2026-03-08..2026-04-06 | 83.3% (10/12) | 100.0% (1/1) | 1/30 | prev_house_shape; train=240; support=24; lower>=0.6; z=1.28; global=false |
| Main Bazar | open | 2026-01-14..2026-02-25 | 83.3% (5/6) | 100.0% (1/1) | 1/30 | prev_sum_bucket; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Main Bazar | open | 2026-05-25..2026-07-03 | 81.8% (9/11) | 100.0% (2/2) | 2/30 | prev_sum_bucket; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Madhur Night | close | 2026-02-14..2026-03-21 | 80.0% (4/5) | 100.0% (3/3) | 3/30 | prev_sum_bucket; train=180; support=5; lower>=0.58; z=1.28; global=false |
| Rajdhani Night | close | 2025-12-04..2026-01-14 | 80.0% (8/10) | 100.0% (2/2) | 2/30 | prev_sum_bucket; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Time Bazar | open | 2026-01-09..2026-02-13 | 75.0% (6/8) | 100.0% (3/3) | 3/30 | prev_opp_sutta; train=365; support=5; lower>=0.6; z=1.28; global=false |
| Rajdhani Night | open | 2025-12-04..2026-01-14 | 75.0% (6/8) | 100.0% (1/1) | 1/30 | prev_sutta; train=180; support=24; lower>=0.52; z=1.28; global=false |
| Rajdhani Night | open | 2025-10-16..2025-12-03 | 75.0% (9/12) | 100.0% (2/2) | 2/30 | prev_sutta; train=180; support=24; lower>=0.52; z=1.28; global=false |
| Rajdhani Day | close | 2026-02-14..2026-03-21 | 72.7% (8/11) | 100.0% (1/1) | 1/30 | prev_house_shape; train=240; support=5; lower>=0.58; z=1.28; global=false |
| Rajdhani Day | close | 2026-03-23..2026-04-25 | 88.9% (8/9) | 83.3% (5/6) | 6/30 | prev_opp_house_shape; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Time Bazar | close | 2026-06-01..2026-07-04 | 72.7% (16/22) | 81.8% (9/11) | 11/30 | prev_opp_sutta; train=365; support=5; lower>=0.58; z=1.96; global=false |
| Rajdhani Night | close | 2026-02-27..2026-04-10 | 100.0% (6/6) | 80.0% (4/5) | 5/30 | prev_sum_bucket; train=365; support=5; lower>=0.58; z=1.28; global=false |
| Sridevi Night | open | 2026-01-05..2026-02-04 | 88.9% (8/9) | 80.0% (4/5) | 5/30 | prev_house_shape; train=240; support=24; lower>=0.6; z=1.28; global=false |
| Main Bazar | open | 2026-02-26..2026-04-09 | 85.7% (6/7) | 80.0% (4/5) | 5/30 | prev_sum_bucket; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Main Bazar | open | 2026-04-10..2026-05-22 | 83.3% (10/12) | 80.0% (4/5) | 5/30 | prev_sum_bucket; train=365; support=5; lower>=0.55; z=1.28; global=false |
| Time Bazar | open | 2026-06-01..2026-07-04 | 80.0% (12/15) | 80.0% (4/5) | 5/30 | weekday; train=180; support=5; lower>=0.6; z=1.28; global=false |
| Kalyan | open | 2026-03-23..2026-04-25 | 78.6% (11/14) | 80.0% (4/5) | 5/30 | weekday; train=240; support=5; lower>=0.65; z=1.28; global=false |
| Rajdhani Day | open | 2026-04-27..2026-05-30 | 71.4% (10/14) | 80.0% (4/5) | 5/30 | prev_sutta; train=240; support=5; lower>=0.65; z=1.28; global=false |
| Madhur Day | close | 2026-05-07..2026-06-05 | 72.7% (24/33) | 78.6% (11/14) | 14/30 | prev_opp_sutta; train=240; support=5; lower>=0.6; z=1.28; global=false |
| Madhur Night | open | 2025-12-05..2026-01-08 | 83.3% (5/6) | 75.0% (3/4) | 4/30 | prev_sum_bucket; train=240; support=5; lower>=0.58; z=1.28; global=false |
| Sridevi Night | open | 2026-04-07..2026-05-06 | 77.8% (7/9) | 75.0% (3/4) | 4/30 | prev_house_shape; train=180; support=5; lower>=0.65; z=1.28; global=false |

## Interpretation

- This model only predicts when a context/pair has enough support and a high lower-confidence bound.
- If high validation folds do not retain high test accuracy, the lower-bound evidence is still unstable.
- Rows with low coverage are safe-call candidates only if their forward test accuracy is repeatedly high.