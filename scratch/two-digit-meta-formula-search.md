# Two-Digit Meta Formula Search

Generated: 2026-07-09T12:55:59.059Z
Formulas tested: 167

## Latest 30 Full Coverage

- Strict accuracy: 53.5% (385/720)
- Average correctly eliminated digits: 1.48 / 2
- Market-sides >=70%: 0/24
- Market-sides >=80%: 0/24

## Rolling Forward Check

- Strict accuracy: 54.5% (1177/2160)
- Average correctly eliminated digits: 1.50 / 2
- Folds >=70%: 5/72
- Folds >=80%: 0/72

| Market | Side | Formula | Val | Test | Avg Digits |
|---|---|---|---:|---:|---:|
| Sridevi | open | mix_cold_7_in_prev_opp | 63.3% (57/90) | 56.7% (17/30) | 1.57 |
| Sridevi | close | single_weekday | 62.2% (56/90) | 53.3% (16/30) | 1.50 |
| Time Bazar | open | mix_cold_7_in_prev | 63.3% (57/90) | 56.7% (17/30) | 1.50 |
| Time Bazar | close | mix_cold_7_hot_30 | 61.1% (55/90) | 53.3% (16/30) | 1.43 |
| Madhur Day | open | tilt_cold_3_prev_kind | 63.3% (57/90) | 66.7% (20/30) | 1.63 |
| Madhur Day | close | tilt_hot_30_cold_7 | 61.1% (55/90) | 63.3% (19/30) | 1.63 |
| Milan Day | open | single_hot_30 | 66.7% (60/90) | 43.3% (13/30) | 1.37 |
| Milan Day | close | single_pair_abs_7 | 67.8% (61/90) | 46.7% (14/30) | 1.37 |
| Rajdhani Day | open | tilt_cold_90_cold_3 | 67.8% (61/90) | 46.7% (14/30) | 1.40 |
| Rajdhani Day | close | single_prev_kind | 67.8% (61/90) | 53.3% (16/30) | 1.43 |
| Kalyan | open | tilt_prev_kind_cold_3 | 63.3% (57/90) | 60.0% (18/30) | 1.53 |
| Kalyan | close | tilt_hot_30_cold_3 | 61.1% (55/90) | 50.0% (15/30) | 1.47 |
| Sridevi Night | open | tilt_dom_mod3_cold_7 | 65.6% (59/90) | 60.0% (18/30) | 1.57 |
| Sridevi Night | close | tilt_prev_sutta_cold_3 | 66.7% (60/90) | 60.0% (18/30) | 1.60 |
| Kalyan Night | open | tilt_hot_30_cold_7 | 65.6% (59/90) | 56.7% (17/30) | 1.50 |
| Kalyan Night | close | mix_cold_3_same_parity | 57.8% (52/90) | 56.7% (17/30) | 1.50 |
| Madhur Night | open | mix_cold_3_opp_in_prev | 62.2% (56/90) | 50.0% (15/30) | 1.47 |
| Madhur Night | close | context_dominant | 67.8% (61/90) | 60.0% (18/30) | 1.57 |
| Milan Night | open | single_in_prev | 57.8% (52/90) | 36.7% (11/30) | 1.27 |
| Milan Night | close | tilt_in_prev_cold_3 | 58.9% (53/90) | 36.7% (11/30) | 1.37 |
| Rajdhani Night | open | single_prev_kind | 61.1% (55/90) | 60.0% (18/30) | 1.57 |
| Rajdhani Night | close | mix_cold_3_weekday | 65.6% (59/90) | 63.3% (19/30) | 1.57 |
| Main Bazar | open | mix_cold_7_prev_sutta | 66.7% (60/90) | 43.3% (13/30) | 1.33 |
| Main Bazar | close | mix_cold_3_hot_7 | 65.6% (59/90) | 50.0% (15/30) | 1.47 |

## Interpretation

- This searches a large family of weighted pair-scoring formulas across frequency, gaps, context buckets, previous-result features, house/parity features, opposite mapping, and cross-market lag.
- Formula selection uses only the validation window before each test window.
- Any 80%+ row here should still be treated as a candidate, not proof, unless it repeats across rolling folds with enough support.