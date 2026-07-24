# Top-3 Statistical Hypothesis Research

Tested 185 target-specific formula candidates. Selection uses development only; validation, chronological holdout, and the separately frozen forward week are gates, never selectors.

| Target | Development-selected formula | Development | Validation | Holdout | Frozen forward | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Open digit | `recent7_hot` | 391/1332 (29.4%) -> 410/1332 (30.8%) (+19) | 304/1001 (30.4%) -> 320/1001 (32.0%) (+16) | 320/1012 (31.6%) -> 321/1012 (31.7%) (+1) | 17/72 (23.6%) -> 22/72 (30.6%) (+5) | pass |
| Close digit | `lag7_opposite` | 417/1332 (31.3%) -> 435/1332 (32.7%) (+18) | 301/1001 (30.1%) -> 288/1001 (28.8%) (-13) | 333/1012 (32.9%) -> 301/1012 (29.7%) (-32) | 18/72 (25.0%) -> 18/72 (25.0%) (+0) | reject |
| Adjusted Close digit | `lag7_opposite` | 417/1332 (31.3%) -> 435/1332 (32.7%) (+18) | 301/1001 (30.1%) -> 288/1001 (28.8%) (-13) | 333/1012 (32.9%) -> 301/1012 (29.7%) (-32) | 18/72 (25.0%) -> 18/72 (25.0%) (+0) | reject |
| Exact Jodi (3 pairs) | `direct_jodi:recent30_hot` | 40/1332 (3.0%) -> 53/1332 (4.0%) (+13) | 28/1001 (2.8%) -> 24/1001 (2.4%) (-4) | 31/1012 (3.1%) -> 28/1012 (2.8%) (-3) | 0/72 (0.0%) -> 3/72 (4.2%) (+3) | reject |
| Jodi grid (3x3 = 9 pairs) | `grid:delta|calendar_date` | 110/1332 (8.3%) -> 138/1332 (10.4%) (+28) | 89/1001 (8.9%) -> 103/1001 (10.3%) (+14) | 115/1012 (11.4%) -> 98/1012 (9.7%) (-17) | 4/72 (5.6%) -> 9/72 (12.5%) (+5) | reject |

## Market-specific development selection

Each market selects its own formula on development rows only; all later blocks remain untouched tests.

| Target | Development | Validation | Holdout | Frozen forward | Gate |
| --- | --- | --- | --- | --- | --- |
| Open digit | 391/1332 (29.4%) -> 494/1332 (37.1%) (+103) | 304/1001 (30.4%) -> 280/1001 (28.0%) (-24) | 320/1012 (31.6%) -> 288/1012 (28.5%) (-32) | 17/72 (23.6%) -> 18/72 (25.0%) (+1) | reject |
| Close digit | 417/1332 (31.3%) -> 510/1332 (38.3%) (+93) | 301/1001 (30.1%) -> 296/1001 (29.6%) (-5) | 333/1012 (32.9%) -> 320/1012 (31.6%) (-13) | 18/72 (25.0%) -> 17/72 (23.6%) (-1) | reject |
| Adjusted Close digit | 417/1332 (31.3%) -> 515/1332 (38.7%) (+98) | 301/1001 (30.1%) -> 306/1001 (30.6%) (+5) | 333/1012 (32.9%) -> 317/1012 (31.3%) (-16) | 18/72 (25.0%) -> 13/72 (18.1%) (-5) | reject |
| Exact Jodi (3 pairs) | 40/1332 (3.0%) -> 74/1332 (5.6%) (+34) | 28/1001 (2.8%) -> 27/1001 (2.7%) (-1) | 31/1012 (3.1%) -> 31/1012 (3.1%) (+0) | 0/72 (0.0%) -> 3/72 (4.2%) (+3) | reject |
| Jodi grid (3x3 = 9 pairs) | 110/1332 (8.3%) -> 185/1332 (13.9%) (+75) | 89/1001 (8.9%) -> 91/1001 (9.1%) (+2) | 115/1012 (11.4%) -> 92/1012 (9.1%) (-23) | 4/72 (5.6%) -> 4/72 (5.6%) (+0) | reject |

| Market | Open choice | Close choice | Adjusted Close choice | Exact Jodi choice | Jodi-grid choice |
| --- | --- | --- | --- | --- | --- |
| Sridevi | `recent90_hot` | `recent14_hot` | `recent14_hot` | `direct_jodi:recent30_hot` | `grid:frequency_ensemble|transition` |
| Time Bazar | `same_house` | `calendar_date` | `known_open` | `direct_jodi:recent60_hot` | `grid:same_house|transition` |
| Madhur Day | `frequency_acceleration` | `opposite_house` | `known_open` | `direct_jodi:previous_open` | `grid:recent7_hot|recent30_cold` |
| Milan Day | `entropy_regime` | `recent30_cold` | `known_open_bayes` | `direct_jodi:recent7_cold_pair` | `grid:frequency_ensemble|recent7_hot` |
| Rajdhani Day | `same_house` | `gap_due` | `gap_due` | `direct_jodi:recent60_hot` | `grid:recent14_hot|recent30_cold` |
| Kalyan | `calendar_date` | `lag7_opposite` | `lag7_opposite` | `direct_jodi:recent60_hot` | `grid:recent14_hot|transition` |
| Sridevi Night | `previous_reverse_difference` | `recent7_hot` | `recent7_hot` | `direct_jodi:previous_open` | `grid:recent14_hot|recent7_hot` |
| Kalyan Night | `opposite_calendar` | `lag7_opposite` | `lag7_opposite` | `direct_jodi:recent30_hot` | `grid:recent7_hot|transition` |
| Madhur Night | `weekday` | `previous_absolute_difference` | `previous_absolute_difference` | `direct_jodi:weekday` | `grid:recent7_hot|calendar_date` |
| Milan Night | `gap_due` | `recent30_cold` | `recent30_cold` | `direct_jodi:previous_open` | `grid:recent7_hot|recent30_cold` |
| Rajdhani Night | `recent14_hot` | `calendar_date` | `calendar_date` | `direct_jodi:recent60_cold` | `grid:recent7_hot|delta` |
| Main Bazar | `calendar_date` | `gap_due` | `gap_due` | `direct_jodi:weekday` | `grid:frequency_ensemble|recent30_cold` |

## Candidates passing every gate

### Open digit

| Formula | Development | Validation | Holdout | Frozen forward |
| --- | --- | --- | --- | --- |
| `recent7_hot` | 391/1332 (29.4%) -> 410/1332 (30.8%) (+19) | 304/1001 (30.4%) -> 320/1001 (32.0%) (+16) | 320/1012 (31.6%) -> 321/1012 (31.7%) (+1) | 17/72 (23.6%) -> 22/72 (30.6%) (+5) |
| `calendar_date` | 391/1332 (29.4%) -> 409/1332 (30.7%) (+18) | 304/1001 (30.4%) -> 307/1001 (30.7%) (+3) | 320/1012 (31.6%) -> 328/1012 (32.4%) (+8) | 17/72 (23.6%) -> 20/72 (27.8%) (+3) |

### Close digit

None.

### Adjusted Close digit

| Formula | Development | Validation | Holdout | Frozen forward |
| --- | --- | --- | --- | --- |
| `known_open` | 417/1332 (31.3%) -> 420/1332 (31.5%) (+3) | 301/1001 (30.1%) -> 301/1001 (30.1%) (+0) | 333/1012 (32.9%) -> 336/1012 (33.2%) (+3) | 18/72 (25.0%) -> 29/72 (40.3%) (+11) |

### Exact Jodi (3 pairs)

| Formula | Development | Validation | Holdout | Frozen forward |
| --- | --- | --- | --- | --- |
| `direct_jodi:calendar_cold_pair` | 40/1332 (3.0%) -> 45/1332 (3.4%) (+5) | 28/1001 (2.8%) -> 38/1001 (3.8%) (+10) | 31/1012 (3.1%) -> 43/1012 (4.2%) (+12) | 0/72 (0.0%) -> 3/72 (4.2%) (+3) |
| `direct_jodi:recent7_cold_pair` | 40/1332 (3.0%) -> 44/1332 (3.3%) (+4) | 28/1001 (2.8%) -> 39/1001 (3.9%) (+11) | 31/1012 (3.1%) -> 31/1012 (3.1%) (+0) | 0/72 (0.0%) -> 1/72 (1.4%) (+1) |

### Jodi grid (3x3 = 9 pairs)

None.

## Paired evidence for development-selected formulas

Candidate-only:baseline-only counts use an exact two-sided sign test. These paired tests are interpretable on validation, holdout, and frozen forward only because development selected the formula.

| Target | Validation | Holdout | Frozen forward |
| --- | --- | --- | --- |
| Open digit | 215:199, p=0.461 | 201:200, p=1.000 | 14:9, p=0.405 |
| Close digit | 192:205, p=0.547 | 200:232, p=0.136 | 11:11, p=1.000 |
| Adjusted Close digit | 192:205, p=0.547 | 200:232, p=0.136 | 11:11, p=1.000 |
| Exact Jodi (3 pairs) | 23:27, p=0.672 | 28:31, p=0.795 | 3:0, p=0.250 |
| Jodi grid (3x3 = 9 pairs) | 93:79, p=0.322 | 87:104, p=0.247 | 8:3, p=0.227 |

## Out-of-selection market stability

The following table combines validation, holdout, and frozen forward rows for each development-selected formula.

| Market | Open | Close | Adjusted Close | Exact Jodi | 3x3 Jodi grid |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 55/210 (26.2%) -> 76/210 (36.2%) (+21) | 59/210 (28.1%) -> 65/210 (31.0%) (+6) | 59/210 (28.1%) -> 65/210 (31.0%) (+6) | 3/210 (1.4%) -> 6/210 (2.9%) (+3) | 8/210 (3.8%) -> 23/210 (11.0%) (+15) |
| Time Bazar | 56/173 (32.4%) -> 57/173 (32.9%) (+1) | 53/173 (30.6%) -> 47/173 (27.2%) (-6) | 53/173 (30.6%) -> 47/173 (27.2%) (-6) | 11/173 (6.4%) -> 5/173 (2.9%) (-6) | 22/173 (12.7%) -> 20/173 (11.6%) (-2) |
| Madhur Day | 76/204 (37.3%) -> 58/204 (28.4%) (-18) | 67/204 (32.8%) -> 66/204 (32.4%) (-1) | 67/204 (32.8%) -> 66/204 (32.4%) (-1) | 4/204 (2.0%) -> 2/204 (1.0%) (-2) | 21/204 (10.3%) -> 16/204 (7.8%) (-5) |
| Milan Day | 49/173 (28.3%) -> 50/173 (28.9%) (+1) | 51/173 (29.5%) -> 39/173 (22.5%) (-12) | 51/173 (29.5%) -> 39/173 (22.5%) (-12) | 5/173 (2.9%) -> 2/173 (1.2%) (-3) | 17/173 (9.8%) -> 17/173 (9.8%) (+0) |
| Rajdhani Day | 49/173 (28.3%) -> 50/173 (28.9%) (+1) | 58/173 (33.5%) -> 64/173 (37.0%) (+6) | 58/173 (33.5%) -> 64/173 (37.0%) (+6) | 2/173 (1.2%) -> 6/173 (3.5%) (+4) | 16/173 (9.2%) -> 17/173 (9.8%) (+1) |
| Kalyan | 57/173 (32.9%) -> 57/173 (32.9%) (+0) | 60/173 (34.7%) -> 63/173 (36.4%) (+3) | 60/173 (34.7%) -> 63/173 (36.4%) (+3) | 2/173 (1.2%) -> 5/173 (2.9%) (+3) | 22/173 (12.7%) -> 21/173 (12.1%) (-1) |
| Sridevi Night | 65/210 (31.0%) -> 65/210 (31.0%) (+0) | 62/210 (29.5%) -> 74/210 (35.2%) (+12) | 62/210 (29.5%) -> 74/210 (35.2%) (+12) | 8/210 (3.8%) -> 6/210 (2.9%) (-2) | 23/210 (11.0%) -> 22/210 (10.5%) (-1) |
| Kalyan Night | 45/140 (32.1%) -> 50/140 (35.7%) (+5) | 38/140 (27.1%) -> 28/140 (20.0%) (-10) | 38/140 (27.1%) -> 28/140 (20.0%) (-10) | 6/140 (4.3%) -> 4/140 (2.9%) (-2) | 17/140 (12.1%) -> 13/140 (9.3%) (-4) |
| Madhur Night | 46/173 (26.6%) -> 53/173 (30.6%) (+7) | 58/173 (33.5%) -> 56/173 (32.4%) (-2) | 58/173 (33.5%) -> 56/173 (32.4%) (-2) | 4/173 (2.3%) -> 5/173 (2.9%) (+1) | 16/173 (9.2%) -> 18/173 (10.4%) (+2) |
| Milan Night | 58/172 (33.7%) -> 56/172 (32.6%) (-2) | 52/172 (30.2%) -> 39/172 (22.7%) (-13) | 52/172 (30.2%) -> 39/172 (22.7%) (-13) | 5/172 (2.9%) -> 4/172 (2.3%) (-1) | 17/172 (9.9%) -> 14/172 (8.1%) (-3) |
| Rajdhani Night | 46/142 (32.4%) -> 45/142 (31.7%) (-1) | 49/142 (34.5%) -> 27/142 (19.0%) (-22) | 49/142 (34.5%) -> 27/142 (19.0%) (-22) | 7/142 (4.9%) -> 5/142 (3.5%) (-2) | 16/142 (11.3%) -> 10/142 (7.0%) (-6) |
| Main Bazar | 39/142 (27.5%) -> 46/142 (32.4%) (+7) | 45/142 (31.7%) -> 39/142 (27.5%) (-6) | 45/142 (31.7%) -> 39/142 (27.5%) (-6) | 2/142 (1.4%) -> 5/142 (3.5%) (+3) | 13/142 (9.2%) -> 19/142 (13.4%) (+6) |
## Interpretation

Passing a non-regression gate is not proof of a large signal, especially after testing many formulas. A candidate must also show a practically meaningful gain and survive additional sealed forward draws before any production recommendation.
