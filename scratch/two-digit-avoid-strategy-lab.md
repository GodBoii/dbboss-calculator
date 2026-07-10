# Two-Digit Avoid Strategy Lab

Generated: 2026-07-09T07:25:47.048Z
Strategies tested: 324
Market-side folds tested: 192

## Overall Validation-Selected Result

- Strict 2-digit avoid accuracy: 50.8% (2878/5665)
- Folds at or above 80% strict accuracy: 0/192
- Average hindsight oracle per fold: 68.9%

## Market / Side Summary

| market         | side  | folds | selected | oracle | 80% folds | families                             |
| -------------- | ----- | ----- | -------- | ------ | --------- | ------------------------------------ |
| Sridevi        | open  | 8     | 50.5%    | 71.3%  | 0         | recent-vs-long:2, opposite-side:2    |
| Sridevi        | close | 8     | 53.8%    | 68.3%  | 0         | recent-vs-long:5, opposite-side:1    |
| Time Bazar     | open  | 8     | 53.3%    | 67.5%  | 0         | recent-vs-long:2, house:2            |
| Time Bazar     | close | 8     | 48.3%    | 66.2%  | 0         | opposite-side:4, digit-rate:2        |
| Madhur Day     | open  | 8     | 48.9%    | 69.2%  | 0         | recent-vs-long:3, opposite-side:2    |
| Madhur Day     | close | 8     | 50.8%    | 67.9%  | 0         | recent-vs-long:4, source-market:2    |
| Milan Day      | open  | 8     | 47.9%    | 67.5%  | 0         | opposite-side:2, recent-vs-long:2    |
| Milan Day      | close | 8     | 54.2%    | 70.8%  | 0         | opposite-side:3, recent-vs-long:2    |
| Rajdhani Day   | open  | 8     | 50.0%    | 70.4%  | 0         | digit-rate:2, target-pair-rate:2     |
| Rajdhani Day   | close | 8     | 50.4%    | 70.4%  | 0         | opposite-side:2, gap:2               |
| Kalyan         | open  | 8     | 50.8%    | 67.9%  | 0         | opposite-side:4, recent-vs-long:1    |
| Kalyan         | close | 8     | 50.0%    | 67.1%  | 0         | recent-vs-long:4, opposite-side:1    |
| Sridevi Night  | open  | 8     | 47.1%    | 69.2%  | 0         | target-pair-rate:2, recent-vs-long:2 |
| Sridevi Night  | close | 8     | 53.8%    | 67.5%  | 0         | recent-vs-long:4, gap:2              |
| Kalyan Night   | open  | 8     | 51.7%    | 69.2%  | 0         | source-market:3, previous-panel:2    |
| Kalyan Night   | close | 8     | 47.9%    | 67.9%  | 0         | recent-vs-long:3, opposite-side:2    |
| Madhur Night   | open  | 8     | 47.1%    | 68.3%  | 0         | recent-vs-long:3, opposite-side:3    |
| Madhur Night   | close | 8     | 49.2%    | 68.8%  | 0         | recent-vs-long:3, previous-panel:2   |
| Milan Night    | open  | 8     | 55.8%    | 67.9%  | 0         | recent-vs-long:5, source-market:2    |
| Milan Night    | close | 8     | 53.3%    | 67.9%  | 0         | source-market:3, previous-panel:3    |
| Rajdhani Night | open  | 8     | 52.9%    | 70.4%  | 0         | recent-vs-long:4, opposite-side:1    |
| Rajdhani Night | close | 8     | 52.9%    | 71.3%  | 0         | recent-vs-long:3, source-market:3    |
| Main Bazar     | open  | 8     | 48.3%    | 70.4%  | 0         | opposite-side:3, previous-panel:2    |
| Main Bazar     | close | 8     | 50.0%    | 71.3%  | 0         | recent-vs-long:2, gated:2            |

## Top Global Strategies By Test Accuracy

| strategy                                | family           | folds | val   | test  | n    | 80% folds |
| --------------------------------------- | ---------------- | ----- | ----- | ----- | ---- | --------- |
| gated_pair_rate_l60_t74                 | gated            | 192   | 44.0% | 54.5% | 11   | 0         |
| gated_pair_rate_l90_t70                 | gated            | 192   | 56.7% | 53.1% | 32   | 0         |
| gated_pair_rate_l120_t70                | gated            | 192   | 59.3% | 52.6% | 19   | 0         |
| opposite_side_pair_l240                 | opposite-side    | 192   | 52.1% | 52.6% | 5760 | 0         |
| gated_pair_rate_l90_t66                 | gated            | 192   | 54.4% | 52.2% | 383  | 0         |
| house_low_fade_l240                     | house            | 192   | 51.9% | 52.0% | 5760 | 0         |
| pair_hot_fade_s14_l120                  | recent-vs-long   | 192   | 51.5% | 52.0% | 5760 | 1         |
| target_pair_absence_recent_penalty_l240 | target-pair-rate | 192   | 51.7% | 52.0% | 5760 | 0         |
| odd_even_mixed_l90                      | parity           | 192   | 51.1% | 51.9% | 5760 | 0         |
| opposite_side_hot_fade_l365             | opposite-side    | 192   | 51.6% | 51.8% | 5760 | 0         |
| pair_failed_recently_l365               | gap              | 192   | 51.8% | 51.7% | 5760 | 0         |
| gated_pair_rate_l120_t62                | gated            | 192   | 51.6% | 51.7% | 1031 | 0         |
| pair_hot_fade_s30_l90                   | recent-vs-long   | 192   | 51.0% | 51.6% | 5760 | 0         |
| opposite_side_hot_fade_l30              | opposite-side    | 192   | 51.6% | 51.6% | 5760 | 1         |
| opposite_side_pair_l180                 | opposite-side    | 192   | 51.1% | 51.6% | 5760 | 0         |
| pair_absent_streak_l90                  | gap              | 192   | 50.9% | 51.6% | 5760 | 0         |
| target_pair_absence_recent_penalty_l30  | target-pair-rate | 192   | 51.6% | 51.6% | 5760 | 1         |
| prev_panel_digits_exclude_l60           | previous-panel   | 192   | 51.4% | 51.6% | 5760 | 0         |
| digit_absence_min_l90                   | digit-rate       | 192   | 51.5% | 51.6% | 5760 | 0         |
| gated_pair_rate_l45_t70                 | gated            | 192   | 51.2% | 51.6% | 915  | 0         |
| gated_pair_rate_l30_t66                 | gated            | 192   | 51.3% | 51.6% | 4751 | 0         |
| digit_absence_sum_l90                   | digit-rate       | 192   | 51.4% | 51.5% | 5760 | 0         |
| digit_present_fade_l90                  | digit-rate       | 192   | 51.4% | 51.5% | 5760 | 0         |
| house_low_fade_l365                     | house            | 192   | 51.2% | 51.5% | 5760 | 0         |
| odd_even_mixed_l120                     | parity           | 192   | 51.0% | 51.5% | 5760 | 0         |
| target_pair_absence_l365                | target-pair-rate | 192   | 51.2% | 51.5% | 5760 | 0         |
| opposite_side_hot_fade_l180             | opposite-side    | 192   | 50.8% | 51.5% | 5760 | 0         |
| pair_absent_streak_l180                 | gap              | 192   | 51.2% | 51.4% | 5760 | 0         |
| prev_panel_digits_exclude_l90           | previous-panel   | 192   | 51.2% | 51.4% | 5760 | 0         |
| odd_even_mixed_l365                     | parity           | 192   | 51.3% | 51.4% | 5760 | 0         |
