# Two-year nonlinear panel experiment

Three fixed candidates were trained on the frozen two-year source. Selection used January 1 through July 2, 2026. Selected candidates were refit through July 2 and compared with the same production targets from July 3 through October 8. All dates have appeared in earlier research; this is retrospective chronological evaluation, not blind forward evidence.

The Python deployable features reproduce the TypeScript Top-10 orders on every scored comparator target. Live Close sees only today's own Open; Open sees neither target panel. Every call contains exactly ten panels.

| Side | Frozen model | Later production | Later candidate | Gained / lost | 97.5% paired interval | Decision |
| --- | --- | ---: | ---: | ---: | --- | --- |
| open | linear_refit | 7.01% (69/984) | 7.22% (71/984) | 36 / 34 | -1.56 pp to 2.02 pp | REJECT |
| close | boost_7 | 5.79% (57/984) | 5.28% (52/984) | 37 / 42 | -2.47 pp to 1.46 pp | REJECT |

| Side | Candidate | Selection hits | Selection rate |
| --- | --- | ---: | ---: |
| open | linear_refit | 132/1855 | 7.12% |
| open | boost_3 | 115/1855 | 6.20% |
| open | boost_7 | 118/1855 | 6.36% |
| close | linear_refit | 108/1855 | 5.82% |
| close | boost_3 | 113/1855 | 6.09% |
| close | boost_7 | 116/1855 | 6.25% |

| Side | Block | Production | Candidate | Difference |
| --- | --- | ---: | ---: | ---: |
| open | septemberOctober | 6.82% | 6.30% | -0.52 pp |
| open | recent30 | 6.40% | 6.73% | 0.34 pp |
| close | septemberOctober | 6.04% | 4.99% | -1.05 pp |
| close | recent30 | 6.73% | 5.05% | -1.68 pp |

| Market | Side | N | Production hits | Candidate hits |
| --- | --- | ---: | ---: | ---: |
| Kalyan | open | 83 | 8 | 7 |
| Kalyan Night | open | 70 | 4 | 6 |
| Madhur Day | open | 93 | 2 | 5 |
| Madhur Night | open | 79 | 0 | 4 |
| Main Bazar | open | 70 | 10 | 9 |
| Milan Day | open | 82 | 6 | 8 |
| Milan Night | open | 82 | 8 | 6 |
| Rajdhani Day | open | 79 | 7 | 7 |
| Rajdhani Night | open | 70 | 5 | 5 |
| Sridevi | open | 97 | 8 | 5 |
| Sridevi Night | open | 97 | 6 | 4 |
| Time Bazar | open | 82 | 5 | 5 |
| Kalyan | close | 83 | 3 | 3 |
| Kalyan Night | close | 70 | 3 | 2 |
| Madhur Day | close | 93 | 5 | 2 |
| Madhur Night | close | 79 | 4 | 3 |
| Main Bazar | close | 70 | 5 | 7 |
| Milan Day | close | 82 | 0 | 0 |
| Milan Night | close | 82 | 8 | 6 |
| Rajdhani Day | close | 79 | 6 | 4 |
| Rajdhani Night | close | 70 | 2 | 8 |
| Sridevi | close | 97 | 10 | 8 |
| Sridevi Night | close | 97 | 7 | 6 |
| Time Bazar | close | 82 | 4 | 3 |

Promotion requires a positive two-task-adjusted later interval, positive later/recent slices, and gains in at least six markets. Larger lists, market routes selected on evaluation results, and DP gate relaxation are disallowed. Binary classifier scores are used for within-event ranking only.

Source and comparator hashes, fitted model files, the code dependencies, software versions, and the selected prediction ledger are saved with the results. No source refresh occurred. The decision concerns exact-panel accuracy, not betting return or profit.

Reproduce with `python research/panel_nonlinear_v1/run.py`. Verify with `python research/panel_nonlinear_v1/verify.py`.
