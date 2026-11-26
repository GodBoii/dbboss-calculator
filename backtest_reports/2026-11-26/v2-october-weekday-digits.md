# V2 October weekday digit accuracy

This replay uses the same 258 completed weekday draws from 2–31 October 2026 (IST) as the [October panel and Sutta backtest](v2-october-weekday-backtest.md). V2 received only dates before each target. Both forecasts were made before Open.

- **Avoid 2** uses the two digits displayed by V2. A hit requires both digits to be absent from the actual panel.
- **Present 1** tests a one-digit version of V2. For each digit, sum the model probability of every legal panel containing it, counting a repeated digit once per panel. Pick the digit with the highest total. A tie goes to the smaller digit. A hit requires the digit to appear at least once.
- **Present 2** uses the existing pair displayed by V2. A hit requires both digits to appear.

| Market | Draws | Open avoid 2 | Close avoid 2 | Open present 1 | Close present 1 | Open present 2 | Close present 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 21 | 66.67% (14/21) | 47.62% (10/21) | 28.57% (6/21) | 38.10% (8/21) | 4.76% (1/21) | 4.76% (1/21) |
| Time Bazar | 21 | 42.86% (9/21) | 47.62% (10/21) | 28.57% (6/21) | 47.62% (10/21) | 4.76% (1/21) | 9.52% (2/21) |
| Madhur Day | 21 | 66.67% (14/21) | 52.38% (11/21) | 19.05% (4/21) | 33.33% (7/21) | 4.76% (1/21) | 0.00% (0/21) |
| Milan Day | 21 | 57.14% (12/21) | 61.90% (13/21) | 47.62% (10/21) | 28.57% (6/21) | 0.00% (0/21) | 9.52% (2/21) |
| Rajdhani Day | 21 | 38.10% (8/21) | 57.14% (12/21) | 14.29% (3/21) | 23.81% (5/21) | 9.52% (2/21) | 4.76% (1/21) |
| Supreme Day | 21 | 47.62% (10/21) | 66.67% (14/21) | 33.33% (7/21) | 38.10% (8/21) | 14.29% (3/21) | 0.00% (0/21) |
| Kalyan | 21 | 38.10% (8/21) | 52.38% (11/21) | 23.81% (5/21) | 42.86% (9/21) | 9.52% (2/21) | 4.76% (1/21) |
| Sridevi Night | 21 | 66.67% (14/21) | 57.14% (12/21) | 28.57% (6/21) | 14.29% (3/21) | 4.76% (1/21) | 9.52% (2/21) |
| Kalyan Night | 21 | 66.67% (14/21) | 42.86% (9/21) | 33.33% (7/21) | 14.29% (3/21) | 14.29% (3/21) | 4.76% (1/21) |
| Madhur Night | 6 | 83.33% (5/6) | 50.00% (3/6) | 66.67% (4/6) | 33.33% (2/6) | 33.33% (2/6) | 0.00% (0/6) |
| Supreme Night | — | — | — | — | — | — | — |
| Milan Night | 21 | 52.38% (11/21) | 47.62% (10/21) | 9.52% (2/21) | 42.86% (9/21) | 4.76% (1/21) | 0.00% (0/21) |
| Rajdhani Night | 21 | 52.38% (11/21) | 47.62% (10/21) | 38.10% (8/21) | 33.33% (7/21) | 9.52% (2/21) | 4.76% (1/21) |
| Main Bazar | 21 | 33.33% (7/21) | 61.90% (13/21) | 14.29% (3/21) | 33.33% (7/21) | 0.00% (0/21) | 4.76% (1/21) |
| **Overall** | 258 | 53.10% (137/258) | 53.49% (138/258) | 27.52% (71/258) | 32.56% (84/258) | 7.36% (19/258) | 4.65% (12/258) |

Madhur Night has six draws because its validated chart ends on 10 October. Supreme Night has no scores because the app disables its forecasts over conflicting source dates.

The one-digit result is a retrospective test of a selection rule. The existing production pair and 50-panel and Sutta outputs came from V2. Every hit flag was checked against the chart outcome, and the panel and Sutta picks matched the earlier replay.

The [daily digit ledger](v2-october-weekday-digits-daily.csv) contains each forecast and its hit flag. Individual actual results are omitted.
