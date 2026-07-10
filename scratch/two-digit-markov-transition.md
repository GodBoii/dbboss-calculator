# Two-Digit Markov Transition Models

Generated: 2026-07-09T12:36:27.149Z
Configs tested: 96
Forward folds: 72

## Results

- All validation-selected folds: 51.9% (932/1797), folds=72, >=80 folds=2
- Val >=70% folds: 75.7% (28/37), folds=2, >=80 folds=0
- Val >=80% folds: n/a (0/0), folds=0, >=80 folds=0

## Top Test Folds

| Market | Side | Window | Val | Test | Coverage | Config |
|---|---|---|---:|---:|---:|---|
| Sridevi Night | open | 2026-06-06..2026-07-05 | 67.7% (21/31) | 100.0% (7/7) | 7/30 | two_step_sutta; train=365; support=5; shrink=5; global=false |
| Madhur Night | open | 2026-03-23..2026-04-25 | 65.7% (23/35) | 83.3% (5/6) | 6/30 | two_step_sutta; train=365; support=5; shrink=0; global=false |
| Madhur Night | close | 2026-06-01..2026-07-04 | 70.0% (63/90) | 76.7% (23/30) | 30/30 | prev_opp_kind; train=365; support=5; shrink=0; global=false |
| Kalyan | open | 2026-03-23..2026-04-25 | 68.2% (15/22) | 75.0% (6/8) | 8/30 | two_step_sutta; train=365; support=5; shrink=5; global=false |
| Madhur Night | close | 2026-03-23..2026-04-25 | 60.0% (6/10) | 75.0% (3/4) | 4/30 | two_step_sutta; train=240; support=5; shrink=5; global=false |
| Kalyan Night | open | 2026-05-20..2026-07-03 | 62.2% (56/90) | 73.3% (22/30) | 30/30 | prev_opp_sutta; train=240; support=5; shrink=0; global=false |
| Kalyan | open | 2026-04-27..2026-05-30 | 77.8% (14/18) | 71.4% (5/7) | 7/30 | two_step_sutta; train=365; support=5; shrink=5; global=false |
| Madhur Night | open | 2026-06-01..2026-07-04 | 62.1% (18/29) | 71.4% (5/7) | 7/30 | two_step_sutta; train=365; support=5; shrink=0; global=false |
| Milan Day | close | 2026-05-25..2026-06-27 | 66.7% (60/90) | 70.0% (21/30) | 30/30 | prev_opp_sutta; train=240; support=5; shrink=0; global=false |
| Madhur Night | close | 2026-04-27..2026-05-30 | 55.6% (50/90) | 70.0% (21/30) | 30/30 | prev_opp_kind; train=240; support=5; shrink=5; global=false |
| Sridevi | close | 2026-05-07..2026-06-05 | 60.6% (20/33) | 69.2% (9/13) | 13/30 | two_step_sutta; train=365; support=5; shrink=0; global=false |
| Milan Day | close | 2026-04-20..2026-05-23 | 63.3% (57/90) | 66.7% (20/30) | 30/30 | prev_sutta; train=365; support=5; shrink=0; global=false |
| Madhur Day | close | 2026-04-07..2026-05-06 | 56.7% (17/30) | 66.7% (10/15) | 15/30 | two_step_sutta; train=365; support=5; shrink=0; global=false |
| Milan Day | open | 2026-05-25..2026-06-27 | 60.7% (54/89) | 63.3% (19/30) | 30/30 | prev_kind; train=365; support=5; shrink=0; global=false |
| Time Bazar | open | 2026-06-01..2026-07-04 | 57.8% (52/90) | 63.3% (19/30) | 30/30 | two_step_sutta; train=365; support=5; shrink=0; global=true |
| Sridevi Night | open | 2026-04-07..2026-05-06 | 61.1% (55/90) | 62.1% (18/29) | 29/30 | prev_opp_kind; train=240; support=5; shrink=0; global=false |
| Rajdhani Day | open | 2026-03-23..2026-04-25 | 64.7% (22/34) | 60.0% (3/5) | 5/30 | two_step_sutta; train=365; support=5; shrink=0; global=false |
| Main Bazar | close | 2026-05-25..2026-07-03 | 61.1% (55/90) | 60.0% (18/30) | 30/30 | prev_opp_kind_sutta; train=240; support=8; shrink=0; global=true |
| Time Bazar | open | 2026-04-27..2026-05-30 | 58.4% (52/89) | 60.0% (18/30) | 30/30 | prev_kind; train=365; support=5; shrink=0; global=false |
| Time Bazar | close | 2026-06-01..2026-07-04 | 57.8% (52/90) | 60.0% (18/30) | 30/30 | prev_opp_sutta; train=365; support=5; shrink=5; global=false |
| Kalyan Night | open | 2026-04-08..2026-05-19 | 60.0% (54/90) | 56.7% (17/30) | 30/30 | prev_sutta; train=240; support=5; shrink=0; global=false |
| Rajdhani Night | close | 2026-02-27..2026-04-10 | 58.9% (53/90) | 56.7% (17/30) | 30/30 | prev_opp_kind; train=365; support=5; shrink=0; global=false |
| Time Bazar | open | 2026-03-23..2026-04-25 | 55.7% (49/88) | 56.7% (17/30) | 30/30 | prev_kind; train=365; support=5; shrink=5; global=false |
| Milan Night | open | 2026-04-27..2026-05-30 | 54.4% (49/90) | 56.7% (17/30) | 30/30 | prev_sutta; train=240; support=5; shrink=5; global=false |
| Main Bazar | open | 2026-04-10..2026-05-22 | 54.4% (49/90) | 56.7% (17/30) | 30/30 | prev_opp_sutta; train=365; support=5; shrink=5; global=false |
| Kalyan Night | close | 2026-05-20..2026-07-03 | 50.7% (35/69) | 56.5% (13/23) | 23/30 | prev_opp_kind_sutta; train=240; support=8; shrink=0; global=false |
| Kalyan | open | 2026-06-01..2026-07-04 | 65.4% (17/26) | 55.6% (5/9) | 9/30 | two_step_sutta; train=365; support=5; shrink=5; global=false |
| Main Bazar | open | 2026-02-26..2026-04-09 | 61.3% (46/75) | 53.6% (15/28) | 28/30 | prev_opp_kind_sutta; train=365; support=8; shrink=0; global=false |
| Rajdhani Night | open | 2026-05-25..2026-07-03 | 64.4% (58/90) | 53.3% (16/30) | 30/30 | prev_opp_kind; train=365; support=5; shrink=0; global=false |
| Madhur Day | open | 2026-04-07..2026-05-06 | 61.1% (55/90) | 53.3% (16/30) | 30/30 | prev_sutta; train=365; support=5; shrink=0; global=false |

## Interpretation

- These models learn previous-state to avoid-pair transition tables.
- A useful transition model should keep high validation folds high on the following test window.
- Low coverage high scores are not enough unless they repeat across folds.