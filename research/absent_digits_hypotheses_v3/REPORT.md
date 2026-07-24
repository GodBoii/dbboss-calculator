# Domain-Specific Absent-Digit Hypothesis Report

Tested **110** named hypotheses against the frozen 75/25 V2 baseline. The production runtime was not changed.

## Outcome

No pre-Open hypothesis passed every out-of-sample, multiplicity, route, and time-stability gate. All pre-Open candidates are rejected; the V2 runtime remains unchanged.

Conditional Open→Close candidates are reported separately and cannot alter the ordinary pre-Open Close contract.

## Baseline

| Block | Hits / n | Accuracy |
| --- | ---: | ---: |
| validation | 1224 / 2348 | 52.13% |
| holdout | 1246 / 2466 | 50.53% |
| recent | 1193 / 2300 | 51.87% |
| post_cache | 132 / 288 | 45.83% |
| independent_extension | 53 / 88 | 60.23% |

## Every hypothesis

| Hypothesis | Category | Contract | Validation lift (pp) | Holdout | Recent | Confirm p / FDR q | Later lift | Worst route | Stable months | Verdict |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `frequency_saturation_w90` | frequency | pre_open | +0.17 | +2.27 | -0.17 | 0.1966 / 0.9993 | +2.66 | -7.54 | 55.56% | REJECT |
| `calendar_season` | calendar | pre_open | -1.15 | +1.62 | +0.30 | 0.1312 / 0.9993 | +1.86 | -7.04 | 66.67% | REJECT |
| `frequency_saturation_w30` | frequency | pre_open | -0.77 | +1.87 | +0.04 | 0.3009 / 0.9993 | +2.13 | -8.15 | 66.67% | REJECT |
| `sequence_two_sutta` | automatic_discovery | pre_open | -2.04 | +1.34 | +0.57 | 0.1447 / 0.9993 | +4.26 | -6.17 | 66.67% | REJECT |
| `interaction_saturation_opposite` | interaction | pre_open | -0.21 | +1.42 | +0.43 | 0.2599 / 0.9993 | +0.27 | -4.52 | 77.78% | REJECT |
| `position_order_pattern` | position | pre_open | -0.51 | +1.46 | +0.26 | 0.1497 / 0.9993 | -1.33 | -5.03 | 66.67% | REJECT |
| `calendar_same_month` | calendar | pre_open | -0.13 | +1.66 | +0.00 | 0.2347 / 0.9993 | -0.27 | -4.52 | 55.56% | REJECT |
| `lag_absence_continue_2` | previous_result | pre_open | -1.58 | +1.70 | -0.17 | 0.226 / 0.9993 | +2.13 | -3.52 | 66.67% | REJECT |
| `lag_panel_repeat_2` | previous_result | pre_open | -1.58 | +1.70 | -0.17 | 0.226 / 0.9993 | +2.13 | -3.52 | 66.67% | REJECT |
| `group_transition_signature` | groups_houses | pre_open | -0.64 | +1.58 | -0.13 | 0.321 / 0.9993 | +0.53 | -6.44 | 55.56% | REJECT |
| `hmm_three_state_sutta` | automatic_discovery | pre_open | -0.17 | +1.46 | +0.00 | 0.2182 / 0.9993 | -1.06 | -5.03 | 44.44% | REJECT |
| `lag_jodi_transition_2` | sutta_jodi | pre_open | -0.72 | +1.09 | +0.26 | 0.3089 / 0.9993 | -1.33 | -4.52 | 44.44% | REJECT |
| `auto_warmup_cross_source_selector` | automatic_discovery | pre_open | -1.96 | +1.78 | -0.57 | 0.3301 / 0.9993 | +3.99 | -4.52 | 55.56% | REJECT |
| `symbolic_previous_sum` | automatic_discovery | pre_open | -1.36 | +1.50 | -0.30 | 0.3182 / 0.9993 | -0.27 | -3.43 | 66.67% | REJECT |
| `lag_absence_continue_15` | previous_result | pre_open | -0.98 | +1.46 | -0.30 | 0.3504 / 0.9993 | +2.66 | -4.52 | 44.44% | REJECT |
| `lag_panel_repeat_15` | previous_result | pre_open | -0.98 | +1.46 | -0.30 | 0.3504 / 0.9993 | +2.66 | -4.52 | 44.44% | REJECT |
| `missing_persistence` | streak_pressure | pre_open | -0.60 | +1.34 | -0.22 | 0.3136 / 0.9993 | +1.06 | -3.66 | 44.44% | REJECT |
| `calendar_same_day_of_month` | calendar | pre_open | -1.96 | +0.81 | +0.30 | 0.4727 / 0.9993 | +0.53 | -4.02 | 44.44% | REJECT |
| `cross_source_sridevi` | cross_market | pre_open | -1.80 | +1.12 | -0.05 | 0.4387 / 0.9993 | +2.65 | -5.03 | 55.56% | REJECT |
| `conditional_current_open_opposite` | open_to_close | post_open_close | -1.45 | +0.73 | +0.35 | 0.5948 / 0.9993 | -1.06 | -6.53 | 66.67% | RESEARCH_ONLY_CONDITIONAL |
| `cross_market_consensus` | cross_market | pre_open | -1.75 | +1.22 | -0.22 | 0.4079 / 0.9993 | +1.60 | -2.51 | 55.56% | REJECT |
| `lag_absence_continue_60` | previous_result | pre_open | -1.49 | +1.70 | -0.78 | 0.4612 / 0.9993 | +0.53 | -6.01 | 55.56% | REJECT |
| `lag_panel_repeat_60` | previous_result | pre_open | -1.49 | +1.70 | -0.78 | 0.4612 / 0.9993 | +0.53 | -6.01 | 55.56% | REJECT |
| `cross_source_madhur_night` | cross_market | pre_open | -0.65 | +1.24 | -0.33 | 0.4894 / 0.9993 | +0.87 | -3.00 | 55.56% | REJECT |
| `cross_source_milan_day` | cross_market | pre_open | -1.02 | +1.02 | -0.09 | 0.4925 / 0.9993 | +2.33 | -3.52 | 66.67% | REJECT |
| `missing_pressure` | streak_pressure | pre_open | -1.36 | +1.38 | -0.52 | 0.4339 / 0.9993 | +1.33 | -4.02 | 55.56% | REJECT |
| `lag_opposite_2` | opposite_rotation | pre_open | -2.47 | +1.70 | -0.91 | 0.533 / 0.9993 | +1.06 | -6.03 | 33.33% | REJECT |
| `frequency_hot_w2` | frequency | pre_open | +0.81 | +1.18 | -0.39 | 0.5736 / 0.9993 | +0.53 | -3.52 | 44.44% | REJECT |
| `frequency_saturation_w15` | frequency | pre_open | -0.55 | +0.93 | -0.13 | 0.6675 / 0.9993 | +0.53 | -6.87 | 55.56% | REJECT |
| `day_to_night_transfer` | day_to_night | pre_open | -0.45 | +1.55 | -0.83 | 0.7187 / 0.9993 | +0.00 | -5.53 | 66.67% | REJECT |
| `lag_sutta_transition_1` | sutta_jodi | pre_open | -0.72 | +1.01 | -0.26 | 0.6071 / 0.9993 | +1.06 | -6.71 | 66.67% | REJECT |
| `appearance_streak_reverse` | streak_pressure | pre_open | -1.62 | +1.18 | -0.52 | 0.5645 / 0.9993 | +2.13 | -4.02 | 44.44% | REJECT |
| `association_previous_exact_mask` | automatic_discovery | pre_open | -0.30 | +0.93 | -0.39 | 0.6739 / 0.9993 | +1.86 | -7.32 | 55.56% | REJECT |
| `lag_sutta_transition_5` | sutta_jodi | pre_open | -0.04 | +0.53 | +0.00 | 0.7304 / 0.9993 | +2.39 | -4.52 | 44.44% | REJECT |
| `lag_absence_continue_90` | previous_result | pre_open | -0.64 | +0.89 | -0.43 | 0.7251 / 0.9993 | +0.80 | -4.88 | 44.44% | REJECT |
| `lag_panel_repeat_90` | previous_result | pre_open | -0.64 | +0.89 | -0.43 | 0.7251 / 0.9993 | +0.80 | -4.88 | 44.44% | REJECT |
| `cross_source_rajdhani_night` | cross_market | pre_open | -1.28 | +1.35 | -0.93 | 0.7371 / 0.9993 | +2.87 | -4.02 | 55.56% | REJECT |
| `frequency_hot_w3` | frequency | pre_open | +0.38 | +0.41 | +0.04 | 0.7726 / 0.9993 | +1.86 | -5.03 | 55.56% | REJECT |
| `frequency_saturation_w10` | frequency | pre_open | -1.15 | +1.38 | -1.00 | 0.8192 / 0.9993 | +2.66 | -7.27 | 44.44% | REJECT |
| `lag_jodi_transition_5` | sutta_jodi | pre_open | -0.51 | +1.09 | -0.70 | 0.7512 / 0.9993 | -1.06 | -6.03 | 55.56% | REJECT |
| `auto_warmup_lag_selector` | automatic_discovery | pre_open | -2.77 | +0.65 | -0.30 | 0.7976 / 0.9993 | -2.39 | -4.02 | 55.56% | REJECT |
| `lag_jodi_transition_1` | sutta_jodi | pre_open | -0.51 | +0.32 | +0.04 | 0.8004 / 0.9993 | -0.53 | -6.10 | 55.56% | REJECT |
| `cross_source_main_bazar` | cross_market | pre_open | -1.24 | +1.39 | -1.12 | 0.8098 / 0.9993 | -0.57 | -4.72 | 66.67% | REJECT |
| `calendar_festival_holiday_window` | calendar | pre_open | -0.72 | +1.05 | -0.78 | 0.8064 / 0.9993 | +0.80 | -5.15 | 44.44% | REJECT |
| `lag_absence_continue_7` | previous_result | pre_open | -1.06 | +0.73 | -0.48 | 0.8441 / 0.9993 | +2.39 | -6.03 | 55.56% | REJECT |
| `lag_opposite_3` | opposite_rotation | pre_open | -2.68 | +1.26 | -1.04 | 0.8496 / 0.9993 | +0.80 | -4.02 | 33.33% | REJECT |
| `lag_panel_repeat_7` | previous_result | pre_open | -1.06 | +0.73 | -0.48 | 0.8441 / 0.9993 | +2.39 | -6.03 | 55.56% | REJECT |
| `position_markov` | position | pre_open | -1.24 | +0.77 | -0.52 | 0.8459 / 0.9993 | +0.53 | -6.53 | 44.44% | REJECT |
| `previous_predicted_pair_persistence` | previous_prediction | pre_open | -1.02 | +0.65 | -0.43 | 0.8583 / 0.9993 | +0.80 | -6.53 | 66.67% | REJECT |
| `rotation_plus_3` | opposite_rotation | pre_open | -1.70 | +0.77 | -0.61 | 0.899 / 0.9993 | -1.06 | -3.02 | 33.33% | REJECT |
| `interaction_daynight_weekday` | interaction | pre_open | -0.09 | +1.20 | -1.11 | 0.9639 / 0.9993 | +0.54 | -6.03 | 55.56% | REJECT |
| `symbolic_previous_product` | automatic_discovery | pre_open | -0.77 | +0.85 | -0.74 | 0.9173 / 0.9993 | +1.86 | -4.52 | 66.67% | REJECT |
| `balance_even_w15` | balance | pre_open | -0.09 | -0.32 | +0.48 | 0.9496 / 0.9993 | +0.53 | -4.02 | 55.56% | REJECT |
| `lag_absence_continue_1` | previous_result | pre_open | -0.09 | +0.69 | -0.61 | 0.9477 / 0.9993 | +1.86 | -4.72 | 44.44% | REJECT |
| `lag_panel_repeat_1` | previous_result | pre_open | -0.09 | +0.69 | -0.61 | 0.9477 / 0.9993 | +1.86 | -4.72 | 44.44% | REJECT |
| `learned_digit_family` | learned_family | pre_open | -0.72 | +0.65 | -0.61 | 0.9728 / 0.9993 | +1.60 | -6.03 | 66.67% | REJECT |
| `lag_opposite_7` | opposite_rotation | pre_open | -1.28 | +1.54 | -1.61 | 1 / 1 | -3.46 | -4.55 | 44.44% | REJECT |
| `frequency_saturation_w7` | frequency | pre_open | -1.24 | +0.85 | -1.00 | 0.9812 / 0.9993 | -0.27 | -6.53 | 55.56% | REJECT |
| `appearance_streak_continue` | streak_pressure | pre_open | -0.89 | +0.97 | -1.17 | 0.9422 / 0.9993 | +1.86 | -4.88 | 44.44% | REJECT |
| `frequency_hot_w5` | frequency | pre_open | -0.85 | -0.41 | +0.30 | 0.9549 / 0.9993 | +0.80 | -6.53 | 55.56% | REJECT |
| `lag_opposite_5` | opposite_rotation | pre_open | -1.87 | +0.61 | -0.78 | 0.9499 / 0.9993 | +1.06 | -4.29 | 33.33% | REJECT |
| `cross_source_kalyan` | cross_market | pre_open | -1.58 | +0.71 | -0.95 | 0.9181 / 0.9993 | +1.45 | -10.05 | 33.33% | REJECT |
| `frequency_hot_w90` | frequency | pre_open | -1.19 | +0.24 | -0.48 | 0.8891 / 0.9993 | +1.33 | -4.52 | 55.56% | REJECT |
| `balance_prime_w15` | balance | pre_open | -0.85 | -0.08 | -0.17 | 0.8745 / 0.9993 | +1.06 | -5.58 | 44.44% | REJECT |
| `conditional_current_open_sutta` | open_to_close | post_open_close | +1.02 | -0.81 | +0.61 | 0.9337 / 0.9993 | +4.26 | -4.52 | 55.56% | RESEARCH_ONLY_CONDITIONAL |
| `lag_opposite_30` | opposite_rotation | pre_open | -1.28 | -0.08 | -0.17 | 0.876 / 0.9993 | -0.27 | -6.44 | 55.56% | REJECT |
| `lag_sutta_transition_2` | sutta_jodi | pre_open | -0.81 | +0.36 | -0.65 | 0.8847 / 0.9993 | +0.80 | -5.03 | 55.56% | REJECT |
| `lag_sutta_transition_7` | sutta_jodi | pre_open | +0.00 | +0.53 | -0.83 | 0.8857 / 0.9993 | +0.80 | -3.43 | 44.44% | REJECT |
| `frequency_hot_w10` | frequency | pre_open | -0.55 | -0.28 | +0.00 | 0.864 / 0.9993 | +3.99 | -6.03 | 33.33% | REJECT |
| `cross_source_madhur_day` | cross_market | pre_open | -2.30 | +0.09 | -0.43 | 0.8309 / 0.9993 | +0.29 | -5.03 | 44.44% | REJECT |
| `frequency_hot_w60` | frequency | pre_open | -0.55 | +0.24 | -0.61 | 0.8183 / 0.9993 | +0.53 | -4.02 | 44.44% | REJECT |
| `cross_source_kalyan_night` | cross_market | pre_open | -1.10 | +0.65 | -1.07 | 0.8109 / 0.9993 | +1.72 | -4.27 | 44.44% | REJECT |
| `cross_source_rajdhani_day` | cross_market | pre_open | +0.46 | -0.27 | -0.14 | 0.7849 / 0.9993 | -1.14 | -4.52 | 22.22% | REJECT |
| `balance_low_w15` | balance | pre_open | -1.49 | +0.28 | -0.78 | 0.7475 / 0.9993 | +1.60 | -5.53 | 33.33% | REJECT |
| `lag_absence_continue_30` | previous_result | pre_open | -1.02 | +0.53 | -1.04 | 0.7415 / 0.9993 | -2.93 | -4.72 | 22.22% | REJECT |
| `lag_panel_repeat_30` | previous_result | pre_open | -1.02 | +0.53 | -1.04 | 0.7415 / 0.9993 | -2.93 | -4.72 | 22.22% | REJECT |
| `calendar_same_year` | calendar | pre_open | +0.00 | +0.12 | -0.65 | 0.7095 / 0.9993 | +2.39 | -4.52 | 44.44% | REJECT |
| `lag_opposite_60` | opposite_rotation | pre_open | -0.77 | -0.12 | -0.39 | 0.7293 / 0.9993 | +1.06 | -4.72 | 33.33% | REJECT |
| `lag_absence_continue_3` | previous_result | pre_open | -1.15 | +0.41 | -1.04 | 0.6672 / 0.9993 | -2.66 | -6.03 | 33.33% | REJECT |
| `lag_absence_continue_5` | previous_result | pre_open | -2.26 | +0.45 | -1.09 | 0.6699 / 0.9993 | +1.86 | -4.52 | 44.44% | REJECT |
| `lag_panel_repeat_3` | previous_result | pre_open | -1.15 | +0.41 | -1.04 | 0.6672 / 0.9993 | -2.66 | -6.03 | 33.33% | REJECT |
| `lag_panel_repeat_5` | previous_result | pre_open | -2.26 | +0.45 | -1.09 | 0.6699 / 0.9993 | +1.86 | -4.52 | 44.44% | REJECT |
| `lag_opposite_90` | opposite_rotation | pre_open | -0.81 | +0.93 | -1.70 | 0.6332 / 0.9993 | +1.06 | -6.03 | 44.44% | REJECT |
| `interaction_weekday_previous_sutta` | interaction | pre_open | -0.85 | -0.20 | -0.52 | 0.6291 / 0.9993 | +1.06 | -9.05 | 55.56% | REJECT |
| `rotation_plus_2` | opposite_rotation | pre_open | -1.87 | +0.45 | -1.22 | 0.6117 / 0.9993 | -1.06 | -7.93 | 33.33% | REJECT |
| `lag_opposite_1` | opposite_rotation | pre_open | -0.77 | +0.24 | -1.04 | 0.5909 / 0.9993 | -0.27 | -3.43 | 33.33% | REJECT |
| `rotation_plus_5` | opposite_rotation | pre_open | -0.77 | +0.24 | -1.04 | 0.5909 / 0.9993 | -0.27 | -3.43 | 33.33% | REJECT |
| `lag_opposite_15` | opposite_rotation | pre_open | -1.06 | +0.77 | -1.65 | 0.5655 / 0.9993 | -3.19 | -5.03 | 44.44% | REJECT |
| `lag_absence_continue_10` | previous_result | pre_open | -1.87 | +0.49 | -1.43 | 0.5014 / 0.9993 | -1.86 | -5.53 | 44.44% | REJECT |
| `lag_panel_repeat_10` | previous_result | pre_open | -1.87 | +0.49 | -1.43 | 0.5014 / 0.9993 | -1.86 | -5.53 | 44.44% | REJECT |
| `symbolic_previous_difference` | automatic_discovery | pre_open | -1.79 | +0.73 | -1.70 | 0.4884 / 0.9993 | +0.53 | -5.03 | 44.44% | REJECT |
| `calendar_same_weekday_month` | calendar | pre_open | -0.04 | -0.12 | -0.83 | 0.5597 / 0.9993 | +3.72 | -10.55 | 44.44% | REJECT |
| `cross_source_milan_night` | cross_market | pre_open | -2.50 | +0.53 | -1.56 | 0.482 / 0.9993 | +2.62 | -5.15 | 55.56% | REJECT |
| `cross_source_time_bazar` | cross_market | pre_open | -1.53 | +0.00 | -1.00 | 0.4935 / 0.9993 | +0.29 | -5.49 | 33.33% | REJECT |
| `frequency_saturation_w60` | frequency | pre_open | +0.04 | +0.49 | -1.70 | 0.5294 / 0.9993 | +3.99 | -8.04 | 33.33% | REJECT |
| `frequency_hot_w7` | frequency | pre_open | -0.72 | -0.97 | -0.22 | 0.4301 / 0.9993 | +1.86 | -5.53 | 33.33% | REJECT |
| `frequency_saturation_w5` | frequency | pre_open | -1.58 | +1.09 | -2.48 | 0.4877 / 0.9993 | -2.39 | -7.54 | 44.44% | REJECT |
| `frequency_saturation_w2` | frequency | pre_open | -1.36 | +0.61 | -2.13 | 0.3945 / 0.9993 | -3.72 | -8.02 | 44.44% | REJECT |
| `lag_sutta_transition_10` | sutta_jodi | pre_open | -0.26 | -0.32 | -1.13 | 0.3363 / 0.9993 | -1.06 | -5.03 | 33.33% | REJECT |
| `frequency_hot_w15` | frequency | pre_open | -0.43 | -0.36 | -1.17 | 0.2999 / 0.9993 | +3.19 | -8.15 | 33.33% | REJECT |
| `frequency_hot_w30` | frequency | pre_open | -0.55 | -1.09 | -0.39 | 0.2536 / 0.9993 | +4.79 | -6.44 | 33.33% | REJECT |
| `rotation_plus_1` | opposite_rotation | pre_open | -2.26 | -0.45 | -1.09 | 0.265 / 0.9993 | +1.06 | -8.54 | 22.22% | REJECT |
| `calendar_same_weekday` | calendar | pre_open | -1.24 | -0.93 | -0.74 | 0.2119 / 0.9993 | -0.80 | -9.05 | 33.33% | REJECT |
| `lag_opposite_10` | opposite_rotation | pre_open | -1.41 | -0.28 | -1.43 | 0.2184 / 0.9993 | -1.60 | -6.03 | 33.33% | REJECT |
| `lag_jodi_transition_3` | sutta_jodi | pre_open | -1.45 | +0.45 | -2.30 | 0.1862 / 0.9993 | +1.33 | -9.15 | 33.33% | REJECT |
| `frequency_saturation_w3` | frequency | pre_open | -3.24 | -0.04 | -1.83 | 0.2893 / 0.9993 | -2.93 | -8.15 | 33.33% | REJECT |
| `previous_predicted_pair_reversal` | previous_prediction | pre_open | -1.66 | -0.36 | -1.57 | 0.2577 / 0.9993 | +2.39 | -6.03 | 44.44% | REJECT |
| `lag_sutta_transition_3` | sutta_jodi | pre_open | +0.34 | -0.69 | -1.35 | 0.1709 / 0.9993 | +1.60 | -8.54 | 22.22% | REJECT |
| `conditional_current_open_panel` | open_to_close | post_open_close | -2.98 | -0.89 | -1.30 | 0.2597 / 0.9993 | +1.06 | -5.03 | 44.44% | RESEARCH_ONLY_CONDITIONAL |
| `cross_source_sridevi_night` | cross_market | pre_open | +0.24 | +0.13 | -0.14 | 1 / 1 | +1.47 | -4.32 | 44.44% | REJECT |

The JSON artifact contains each hypothesis's standalone accuracy, adjusted accuracy, baseline comparison, exact paired significance, Wilson interval, support, cost, overfit risk, per-block stability, and gate outcomes.

## Automatic discovery

- Learned spectral digit families: `{0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0, 7: 0, 8: 2, 9: 0}`.
- A frozen three-state sutta HMM was evaluated independently for every market-side.
- Exact-mask association rules, two-sutta sequences, symbolic arithmetic, warm-up lag selection, and warm-up cross-source selection were evaluated.
- The directed influence summary counts which source candidate each route's warm-up selector chose; selection alone is not evidence of a causal effect.

## Scope and limitations

- The source data contains no market geography; regional/national labels were not inferred.
- All historical blocks were inspected before this study and are retrospective evidence.
- Post-Open Close hypotheses have a later information set and cannot be promoted to the pre-Open Close runtime.
- Holiday coding uses Government of India dates for 2025-2026 only; it is not a complete local festival calendar.

Holiday/festival dates were coded from official Government of India lists: [2025 CGCA list](https://www.cgca.gov.in/ccadl/list-of-holiday) and [India Post 2026 list](https://www.indiapost.gov.in/holidays-list).

See `PROTOCOL.md` for the chronology, contracts, multiplicity correction, and promotion rules.
