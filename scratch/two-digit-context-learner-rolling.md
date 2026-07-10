# Two-Digit Context Learner Rolling Evaluation

Generated: 2026-07-09T12:07:13.704Z
Forward folds: 144
Aggregate strict accuracy: 51.0% (2204/4320)
Average correctly eliminated digits: 1.46 / 2
Folds >=70% strict: 4/144
Folds >=80% strict: 0/144

## Market-Side Stability

| Market | Side | Folds | Strict Accuracy | Avg Digits | >=70 Folds | >=80 Folds |
|---|---|---:|---:|---:|---:|---:|
| Milan Day | close | 6 | 56.7% (102/180) | 1.52 | 1/6 | 0/6 |
| Rajdhani Day | close | 6 | 56.1% (101/180) | 1.50 | 0/6 | 0/6 |
| Sridevi Night | open | 6 | 56.1% (101/180) | 1.54 | 0/6 | 0/6 |
| Kalyan Night | close | 6 | 54.4% (98/180) | 1.52 | 1/6 | 0/6 |
| Sridevi | close | 6 | 53.9% (97/180) | 1.52 | 0/6 | 0/6 |
| Kalyan Night | open | 6 | 53.3% (96/180) | 1.47 | 0/6 | 0/6 |
| Madhur Night | close | 6 | 53.3% (96/180) | 1.49 | 1/6 | 0/6 |
| Main Bazar | close | 6 | 53.3% (96/180) | 1.48 | 0/6 | 0/6 |
| Madhur Day | close | 6 | 52.8% (95/180) | 1.44 | 0/6 | 0/6 |
| Rajdhani Day | open | 6 | 52.8% (95/180) | 1.48 | 0/6 | 0/6 |
| Time Bazar | close | 6 | 51.7% (93/180) | 1.47 | 1/6 | 0/6 |
| Milan Night | close | 6 | 51.7% (93/180) | 1.47 | 0/6 | 0/6 |
| Kalyan | open | 6 | 51.1% (92/180) | 1.44 | 0/6 | 0/6 |
| Time Bazar | open | 6 | 50.6% (91/180) | 1.46 | 0/6 | 0/6 |
| Madhur Day | open | 6 | 50.6% (91/180) | 1.47 | 0/6 | 0/6 |
| Milan Day | open | 6 | 50.6% (91/180) | 1.46 | 0/6 | 0/6 |
| Sridevi | open | 6 | 49.4% (89/180) | 1.46 | 0/6 | 0/6 |
| Madhur Night | open | 6 | 49.4% (89/180) | 1.44 | 0/6 | 0/6 |
| Sridevi Night | close | 6 | 48.9% (88/180) | 1.45 | 0/6 | 0/6 |
| Main Bazar | open | 6 | 48.3% (87/180) | 1.42 | 0/6 | 0/6 |
| Milan Night | open | 6 | 46.1% (83/180) | 1.41 | 0/6 | 0/6 |
| Kalyan | close | 6 | 45.6% (82/180) | 1.40 | 0/6 | 0/6 |
| Rajdhani Night | open | 6 | 43.9% (79/180) | 1.42 | 0/6 | 0/6 |
| Rajdhani Night | close | 6 | 43.9% (79/180) | 1.37 | 0/6 | 0/6 |

## Top Individual Folds

| Market | Side | Window | Context | Validation | Test |
|---|---|---|---|---:|---:|
| Madhur Night | close | 2026-06-01..2026-07-04 | prev_opp_kind; train=365; support=3; shrink=0 | 70.0% (63/90) | 76.7% (23/30) |
| Kalyan Night | close | 2025-12-01..2026-01-09 | prev_opp_house_shape; train=365; support=3; shrink=0 | 67.8% (61/90) | 70.0% (21/30) |
| Milan Day | close | 2026-05-25..2026-06-27 | prev_opp_sutta; train=240; support=3; shrink=0 | 66.7% (60/90) | 70.0% (21/30) |
| Time Bazar | close | 2026-06-01..2026-07-04 | prev_opp_sutta; train=500; support=3; shrink=0 | 56.7% (51/90) | 70.0% (21/30) |
| Milan Night | close | 2025-12-04..2026-01-07 | weekday; train=180; support=3; shrink=0 | 63.3% (57/90) | 66.7% (20/30) |
| Rajdhani Day | open | 2026-01-09..2026-02-13 | prev_opp_house_shape; train=365; support=3; shrink=0 | 61.1% (55/90) | 66.7% (20/30) |
| Main Bazar | close | 2026-01-14..2026-02-25 | dom_bucket; train=180; support=3; shrink=0 | 60.0% (54/90) | 66.7% (20/30) |
| Rajdhani Day | open | 2026-03-23..2026-04-25 | prev_opp_kind; train=365; support=3; shrink=0 | 63.3% (57/90) | 63.3% (19/30) |
| Kalyan Night | open | 2026-04-08..2026-05-19 | prev_house_shape; train=240; support=3; shrink=0 | 63.3% (57/90) | 63.3% (19/30) |
| Sridevi Night | open | 2026-05-07..2026-06-05 | prev_opp_house_shape; train=500; support=3; shrink=0 | 62.2% (56/90) | 63.3% (19/30) |
| Sridevi Night | open | 2026-04-07..2026-05-06 | prev_opp_kind; train=240; support=3; shrink=0 | 61.1% (55/90) | 63.3% (19/30) |
| Milan Day | open | 2026-05-25..2026-06-27 | dom_bucket; train=365; support=3; shrink=0 | 60.0% (54/90) | 63.3% (19/30) |
| Sridevi Night | close | 2026-02-05..2026-03-07 | prev_house_shape; train=500; support=8; shrink=0 | 58.9% (53/90) | 63.3% (19/30) |
| Main Bazar | close | 2025-10-15..2025-12-02 | prev_opp_house_shape; train=240; support=3; shrink=0 | 58.9% (53/90) | 63.3% (19/30) |
| Madhur Day | close | 2026-04-07..2026-05-06 | dom_bucket; train=365; support=3; shrink=0 | 56.7% (51/90) | 63.3% (19/30) |
| Rajdhani Day | close | 2026-02-14..2026-03-21 | prev_opp_house_shape; train=365; support=3; shrink=0 | 56.7% (51/90) | 63.3% (19/30) |
| Rajdhani Day | close | 2026-01-09..2026-02-13 | prev_sutta; train=180; support=3; shrink=0 | 54.4% (49/90) | 63.3% (19/30) |
| Kalyan Night | close | 2025-10-13..2025-11-28 | prev_opp_house_shape; train=240; support=3; shrink=0 | 67.8% (61/90) | 60.0% (18/30) |
| Sridevi | open | 2026-03-08..2026-04-06 | prev_house_shape; train=240; support=3; shrink=0 | 64.4% (58/90) | 60.0% (18/30) |
| Milan Day | close | 2026-03-16..2026-04-18 | prev_sutta; train=500; support=3; shrink=0 | 64.4% (58/90) | 60.0% (18/30) |
| Kalyan | open | 2026-04-27..2026-05-30 | month; train=240; support=8; shrink=0 | 63.3% (57/90) | 60.0% (18/30) |
| Madhur Night | close | 2026-04-27..2026-05-30 | prev_house_shape; train=180; support=3; shrink=0 | 63.3% (57/90) | 60.0% (18/30) |
| Sridevi | close | 2026-01-05..2026-02-04 | prev_sum_bucket; train=180; support=3; shrink=0 | 62.2% (56/90) | 60.0% (18/30) |
| Sridevi | close | 2026-05-07..2026-06-05 | weekday; train=240; support=3; shrink=0 | 61.1% (55/90) | 60.0% (18/30) |
| Sridevi Night | open | 2026-03-08..2026-04-06 | prev_opp_house_shape; train=180; support=12; shrink=0 | 61.1% (55/90) | 60.0% (18/30) |
| Rajdhani Night | close | 2025-12-04..2026-01-14 | prev_kind; train=180; support=3; shrink=0 | 61.1% (55/90) | 60.0% (18/30) |
| Madhur Day | close | 2026-05-07..2026-06-05 | prev_opp_house_shape; train=500; support=8; shrink=0 | 60.0% (54/90) | 60.0% (18/30) |
| Milan Day | close | 2026-01-02..2026-02-06 | dom_mod3; train=365; support=3; shrink=0 | 60.0% (54/90) | 60.0% (18/30) |
| Madhur Night | open | 2026-01-09..2026-02-13 | prev_opp_sutta; train=365; support=3; shrink=0 | 60.0% (54/90) | 60.0% (18/30) |
| Main Bazar | open | 2026-02-26..2026-04-09 | prev_opp_sutta; train=365; support=3; shrink=0 | 60.0% (54/90) | 60.0% (18/30) |

## Interpretation

- This evaluates the context learner across several historical 30-day forward windows, not only the latest window.
- A durable 80% model should produce repeated >=80% folds for the same market-side, not isolated hindsight pockets.
- If high folds are rare and unstable, the context method should remain research-only.