# Two-Digit Walk-Forward Context Learner

Generated: 2026-07-09T12:05:08.536Z
Strict accuracy: 51.0% (367/720)
Average correctly eliminated digits: 1.46 / 2
Market-sides >=70%: 3/24
Market-sides >=80%: 0/24

| Market | Side | Context | Val | Test | Avg Digits |
|---|---|---|---:|---:|---:|
| Sridevi | open | weekday; train=365; support=3; shrink=0 | 57.8% (52/90) | 46.7% (14/30) | 1.47 |
| Sridevi | close | weekday; train=180; support=3; shrink=0 | 65.6% (59/90) | 50.0% (15/30) | 1.50 |
| Time Bazar | open | prev_kind; train=500; support=5; shrink=0 | 58.9% (53/90) | 46.7% (14/30) | 1.30 |
| Time Bazar | close | prev_opp_sutta; train=500; support=3; shrink=0 | 56.7% (51/90) | 70.0% (21/30) | 1.67 |
| Madhur Day | open | prev_sum_bucket; train=500; support=3; shrink=0 | 66.7% (60/90) | 40.0% (12/30) | 1.30 |
| Madhur Day | close | prev_sutta; train=365; support=3; shrink=0 | 61.1% (55/90) | 43.3% (13/30) | 1.40 |
| Milan Day | open | dom_bucket; train=365; support=3; shrink=0 | 60.0% (54/90) | 63.3% (19/30) | 1.60 |
| Milan Day | close | prev_opp_sutta; train=240; support=3; shrink=0 | 66.7% (60/90) | 70.0% (21/30) | 1.63 |
| Rajdhani Day | open | prev_kind; train=500; support=3; shrink=0 | 65.6% (59/90) | 50.0% (15/30) | 1.47 |
| Rajdhani Day | close | prev_kind; train=240; support=3; shrink=0 | 67.8% (61/90) | 50.0% (15/30) | 1.40 |
| Kalyan | open | dom_bucket; train=500; support=3; shrink=0 | 67.8% (61/90) | 56.7% (17/30) | 1.50 |
| Kalyan | close | prev_sum_bucket; train=365; support=3; shrink=0 | 57.8% (52/90) | 40.0% (12/30) | 1.37 |
| Sridevi Night | open | month; train=180; support=3; shrink=0 | 64.4% (58/90) | 53.3% (16/30) | 1.50 |
| Sridevi Night | close | month; train=180; support=3; shrink=0 | 62.2% (56/90) | 46.7% (14/30) | 1.47 |
| Kalyan Night | open | dom_bucket; train=365; support=3; shrink=0 | 64.4% (58/90) | 40.0% (12/30) | 1.30 |
| Kalyan Night | close | prev_kind; train=180; support=3; shrink=0 | 53.3% (48/90) | 56.7% (17/30) | 1.53 |
| Madhur Night | open | prev_sum_bucket; train=180; support=3; shrink=0 | 57.8% (52/90) | 33.3% (10/30) | 1.30 |
| Madhur Night | close | prev_opp_kind; train=365; support=3; shrink=0 | 70.0% (63/90) | 76.7% (23/30) | 1.77 |
| Milan Night | open | prev_house_shape; train=240; support=3; shrink=0 | 58.9% (53/90) | 56.7% (17/30) | 1.53 |
| Milan Night | close | prev_sum_bucket; train=180; support=8; shrink=0 | 58.9% (53/90) | 53.3% (16/30) | 1.53 |
| Rajdhani Night | open | prev_opp_kind; train=365; support=3; shrink=0 | 64.4% (58/90) | 53.3% (16/30) | 1.53 |
| Rajdhani Night | close | prev_opp_kind; train=365; support=3; shrink=0 | 60.0% (54/90) | 26.7% (8/30) | 1.20 |
| Main Bazar | open | prev_house_shape; train=240; support=3; shrink=0 | 55.6% (50/90) | 56.7% (17/30) | 1.57 |
| Main Bazar | close | prev_house_shape; train=240; support=8; shrink=0 | 62.2% (56/90) | 43.3% (13/30) | 1.27 |

## Interpretation

- This is deployable in structure: context-pair tables are learned from history before the latest 30 test window.
- It tests whether the high context-oracle ceiling can be captured without looking at the test results.
- If validation is high but test falls, the context was fitting unstable history rather than a durable pattern.