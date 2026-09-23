# Production app model backtest: 7, 30, and 90 days

Generated 2026-08-07T11:26:22.233Z. App version: 1.0.20. Sutta model version: 1.0.9-above90.

## Method

1. Fetched each production market through the app scrape route.
2. Used the latest fetched actual date, 2026-08-07, as the shared window anchor.
3. Replayed every eligible draw walk-forward: panel, avoid, and DP predictions used only rows dated before the draw.
4. Scored production Top 6 Open suttas, Top 6 Close suttas, and the 6x6 Jodi grid. Sutta source-hybrid rules may use same-date source rows only when that source open/close event happens earlier by the market schedule.
5. Scored production Top 40 Open and Close panel lists.
6. Scored the production avoided two-digit model; gated columns include only CALL rows.
7. Scored DP as DP-only counts. SP is not included as a "correct" kind result.

## Last 7 days (2026-08-01 to 2026-08-07)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 71.4% (5/7) | 42.9% (3/7) | 42.9% (3/7) | 71.4% (5/7) / 42.9% (3/7) / 42.9% (3/7) |
| Time Bazar | 6 | 33.3% (2/6) | 50.0% (3/6) | 16.7% (1/6) | 33.3% (2/6) / 16.7% (1/6) / 16.7% (1/6) |
| Madhur Day | 2 | 50.0% (1/2) | 50.0% (1/2) | 50.0% (1/2) | 50.0% (1/2) / 50.0% (1/2) / 50.0% (1/2) |
| Milan Day | 5 | 40.0% (2/5) | 40.0% (2/5) | 20.0% (1/5) | 40.0% (2/5) / 40.0% (2/5) / 20.0% (1/5) |
| Rajdhani Day | 1 | 0.0% (0/1) | 0.0% (0/1) | 0.0% (0/1) | 0.0% (0/1) / 0.0% (0/1) / 0.0% (0/1) |
| Kalyan | 5 | 80.0% (4/5) | 60.0% (3/5) | 40.0% (2/5) | 100.0% (5/5) / 20.0% (1/5) / 20.0% (1/5) |
| Sridevi Night | 6 | 16.7% (1/6) | 33.3% (2/6) | 0.0% (0/6) | 16.7% (1/6) / 33.3% (2/6) / 0.0% (0/6) |
| Kalyan Night | 4 | 100.0% (4/4) | 75.0% (3/4) | 75.0% (3/4) | 100.0% (4/4) / 75.0% (3/4) / 75.0% (3/4) |
| Madhur Night | 1 | 100.0% (1/1) | 0.0% (0/1) | 0.0% (0/1) | 100.0% (1/1) / 0.0% (0/1) / 0.0% (0/1) |
| Milan Night | 5 | 60.0% (3/5) | 60.0% (3/5) | 40.0% (2/5) | 80.0% (4/5) / 60.0% (3/5) / 60.0% (3/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 75.0% (3/4) | 25.0% (1/4) | 50.0% (2/4) / 75.0% (3/4) / 25.0% (1/4) |
| Main Bazar | 4 | 100.0% (4/4) | 75.0% (3/4) | 75.0% (3/4) | 100.0% (4/4) / 75.0% (3/4) / 75.0% (3/4) |
| **ALL MARKETS** | 50 | 58.0% (29/50) | 52.0% (26/50) | 34.0% (17/50) | 62.0% (31/50) / 44.0% (22/50) / 34.0% (17/50) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 7 | 28.6% (2/7) | 14.3% (1/7) |
| Time Bazar | 6 | 16.7% (1/6) | 0.0% (0/6) |
| Madhur Day | 2 | 50.0% (1/2) | 0.0% (0/2) |
| Milan Day | 5 | 40.0% (2/5) | 20.0% (1/5) |
| Rajdhani Day | 1 | 100.0% (1/1) | 0.0% (0/1) |
| Kalyan | 5 | 0.0% (0/5) | 0.0% (0/5) |
| Sridevi Night | 6 | 33.3% (2/6) | 16.7% (1/6) |
| Kalyan Night | 4 | 25.0% (1/4) | 25.0% (1/4) |
| Madhur Night | 1 | 100.0% (1/1) | 100.0% (1/1) |
| Milan Night | 5 | 60.0% (3/5) | 0.0% (0/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 0.0% (0/4) |
| Main Bazar | 4 | 0.0% (0/4) | 50.0% (2/4) |
| **ALL MARKETS** | 50 | 32.0% (16/50) | 14.0% (7/50) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 71.4% (5/7) | 57.1% (4/7) | N/A | N/A |
| Time Bazar | 6 | 33.3% (2/6) | 66.7% (4/6) | N/A | N/A |
| Madhur Day | 2 | 100.0% (2/2) | 100.0% (2/2) | N/A | N/A |
| Milan Day | 5 | 80.0% (4/5) | 40.0% (2/5) | N/A | N/A |
| Rajdhani Day | 1 | 0.0% (0/1) | 0.0% (0/1) | N/A | N/A |
| Kalyan | 5 | 60.0% (3/5) | 60.0% (3/5) | N/A | N/A |
| Sridevi Night | 6 | 16.7% (1/6) | 33.3% (2/6) | N/A | N/A |
| Kalyan Night | 4 | 50.0% (2/4) | 25.0% (1/4) | N/A | N/A |
| Madhur Night | 1 | 0.0% (0/1) | 0.0% (0/1) | N/A | N/A |
| Milan Night | 5 | 60.0% (3/5) | 20.0% (1/5) | N/A | N/A |
| Rajdhani Night | 4 | 25.0% (1/4) | 25.0% (1/4) | N/A | N/A |
| Main Bazar | 4 | 25.0% (1/4) | 50.0% (2/4) | N/A | N/A |
| **ALL MARKETS** | 50 | 48.0% (24/50) | 44.0% (22/50) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 7 | actual 1, predicted 5, correct 1, recall 100.0%, precision 20.0% | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Time Bazar | 6 | actual 0, predicted 6, correct 0, recall N/A, precision 0.0% | actual 1, predicted 2, correct 1, recall 100.0%, precision 50.0% |
| Madhur Day | 2 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Milan Day | 5 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Rajdhani Day | 1 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Kalyan | 5 | actual 3, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Sridevi Night | 6 | actual 1, predicted 2, correct 0, recall 0.0%, precision 0.0% | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan Night | 4 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Madhur Night | 1 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Milan Night | 5 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Rajdhani Night | 4 | actual 1, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Main Bazar | 4 | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| **ALL MARKETS** | 50 | actual 11, predicted 15, correct 1, recall 9.1%, precision 6.7% | actual 11, predicted 2, correct 1, recall 9.1%, precision 50.0% |

## Last 30 days (2026-07-09 to 2026-08-07)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 53.3% (16/30) | 56.7% (17/30) | 33.3% (10/30) | 53.3% (16/30) / 56.7% (17/30) / 33.3% (10/30) |
| Time Bazar | 26 | 73.1% (19/26) | 69.2% (18/26) | 57.7% (15/26) | 73.1% (19/26) / 57.7% (15/26) / 50.0% (13/26) |
| Madhur Day | 25 | 60.0% (15/25) | 52.0% (13/25) | 32.0% (8/25) | 60.0% (15/25) / 52.0% (13/25) / 32.0% (8/25) |
| Milan Day | 25 | 32.0% (8/25) | 48.0% (12/25) | 16.0% (4/25) | 32.0% (8/25) / 56.0% (14/25) / 20.0% (5/25) |
| Rajdhani Day | 21 | 52.4% (11/21) | 47.6% (10/21) | 38.1% (8/21) | 61.9% (13/21) / 47.6% (10/21) / 38.1% (8/21) |
| Kalyan | 25 | 64.0% (16/25) | 76.0% (19/25) | 48.0% (12/25) | 68.0% (17/25) / 72.0% (18/25) / 44.0% (11/25) |
| Sridevi Night | 29 | 58.6% (17/29) | 58.6% (17/29) | 34.5% (10/29) | 62.1% (18/29) / 58.6% (17/29) / 41.4% (12/29) |
| Kalyan Night | 21 | 57.1% (12/21) | 66.7% (14/21) | 38.1% (8/21) | 66.7% (14/21) / 52.4% (11/21) / 33.3% (7/21) |
| Madhur Night | 21 | 61.9% (13/21) | 57.1% (12/21) | 33.3% (7/21) | 61.9% (13/21) / 61.9% (13/21) / 28.6% (6/21) |
| Milan Night | 25 | 68.0% (17/25) | 64.0% (16/25) | 40.0% (10/25) | 64.0% (16/25) / 64.0% (16/25) / 44.0% (11/25) |
| Rajdhani Night | 21 | 52.4% (11/21) | 71.4% (15/21) | 28.6% (6/21) | 52.4% (11/21) / 71.4% (15/21) / 28.6% (6/21) |
| Main Bazar | 21 | 66.7% (14/21) | 52.4% (11/21) | 42.9% (9/21) | 66.7% (14/21) / 47.6% (10/21) / 33.3% (7/21) |
| **ALL MARKETS** | 290 | 58.3% (169/290) | 60.0% (174/290) | 36.9% (107/290) | 60.0% (174/290) / 58.3% (169/290) / 35.9% (104/290) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 30 | 30.0% (9/30) | 30.0% (9/30) |
| Time Bazar | 26 | 34.6% (9/26) | 26.9% (7/26) |
| Madhur Day | 25 | 24.0% (6/25) | 28.0% (7/25) |
| Milan Day | 25 | 32.0% (8/25) | 20.0% (5/25) |
| Rajdhani Day | 21 | 23.8% (5/21) | 28.6% (6/21) |
| Kalyan | 25 | 28.0% (7/25) | 24.0% (6/25) |
| Sridevi Night | 29 | 31.0% (9/29) | 24.1% (7/29) |
| Kalyan Night | 21 | 23.8% (5/21) | 14.3% (3/21) |
| Madhur Night | 21 | 42.9% (9/21) | 42.9% (9/21) |
| Milan Night | 25 | 20.0% (5/25) | 28.0% (7/25) |
| Rajdhani Night | 21 | 33.3% (7/21) | 19.0% (4/21) |
| Main Bazar | 21 | 14.3% (3/21) | 19.0% (4/21) |
| **ALL MARKETS** | 290 | 28.3% (82/290) | 25.5% (74/290) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 60.0% (18/30) | 60.0% (18/30) | N/A | N/A |
| Time Bazar | 26 | 46.2% (12/26) | 57.7% (15/26) | N/A | N/A |
| Madhur Day | 25 | 48.0% (12/25) | 52.0% (13/25) | N/A | N/A |
| Milan Day | 25 | 60.0% (15/25) | 56.0% (14/25) | N/A | N/A |
| Rajdhani Day | 21 | 52.4% (11/21) | 52.4% (11/21) | N/A | N/A |
| Kalyan | 25 | 48.0% (12/25) | 56.0% (14/25) | N/A | N/A |
| Sridevi Night | 29 | 44.8% (13/29) | 37.9% (11/29) | N/A | N/A |
| Kalyan Night | 21 | 66.7% (14/21) | 47.6% (10/21) | N/A | N/A |
| Madhur Night | 21 | 61.9% (13/21) | 57.1% (12/21) | N/A | N/A |
| Milan Night | 25 | 40.0% (10/25) | 52.0% (13/25) | N/A | N/A |
| Rajdhani Night | 21 | 47.6% (10/21) | 38.1% (8/21) | N/A | N/A |
| Main Bazar | 21 | 61.9% (13/21) | 38.1% (8/21) | N/A | N/A |
| **ALL MARKETS** | 290 | 52.8% (153/290) | 50.7% (147/290) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 30 | actual 4, predicted 14, correct 3, recall 75.0%, precision 21.4% | actual 7, predicted 4, correct 2, recall 28.6%, precision 50.0% |
| Time Bazar | 26 | actual 5, predicted 14, correct 1, recall 20.0%, precision 7.1% | actual 7, predicted 9, correct 5, recall 71.4%, precision 55.6% |
| Madhur Day | 25 | actual 7, predicted 13, correct 3, recall 42.9%, precision 23.1% | actual 4, predicted 8, correct 1, recall 25.0%, precision 12.5% |
| Milan Day | 25 | actual 5, predicted 6, correct 2, recall 40.0%, precision 33.3% | actual 7, predicted 3, correct 1, recall 14.3%, precision 33.3% |
| Rajdhani Day | 21 | actual 7, predicted 4, correct 1, recall 14.3%, precision 25.0% | actual 6, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 25 | actual 10, predicted 4, correct 2, recall 20.0%, precision 50.0% | actual 4, predicted 0, correct 0, recall 0.0%, precision N/A |
| Sridevi Night | 29 | actual 5, predicted 9, correct 1, recall 20.0%, precision 11.1% | actual 5, predicted 8, correct 0, recall 0.0%, precision 0.0% |
| Kalyan Night | 21 | actual 4, predicted 3, correct 1, recall 25.0%, precision 33.3% | actual 4, predicted 3, correct 0, recall 0.0%, precision 0.0% |
| Madhur Night | 21 | actual 1, predicted 10, correct 0, recall 0.0%, precision 0.0% | actual 4, predicted 4, correct 1, recall 25.0%, precision 25.0% |
| Milan Night | 25 | actual 2, predicted 2, correct 1, recall 50.0%, precision 50.0% | actual 8, predicted 0, correct 0, recall 0.0%, precision N/A |
| Rajdhani Night | 21 | actual 4, predicted 3, correct 1, recall 25.0%, precision 33.3% | actual 8, predicted 3, correct 2, recall 25.0%, precision 66.7% |
| Main Bazar | 21 | actual 7, predicted 0, correct 0, recall 0.0%, precision N/A | actual 4, predicted 0, correct 0, recall 0.0%, precision N/A |
| **ALL MARKETS** | 290 | actual 61, predicted 82, correct 16, recall 26.2%, precision 19.5% | actual 68, predicted 42, correct 12, recall 17.6%, precision 28.6% |

## Last 90 days (2026-05-10 to 2026-08-07)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 90 | 66.7% (60/90) | 68.9% (62/90) | 47.8% (43/90) | 66.7% (60/90) / 68.9% (62/90) / 47.8% (43/90) |
| Time Bazar | 77 | 71.4% (55/77) | 72.7% (56/77) | 54.5% (42/77) | 71.4% (55/77) / 63.6% (49/77) / 45.5% (35/77) |
| Madhur Day | 85 | 69.4% (59/85) | 70.6% (60/85) | 49.4% (42/85) | 69.4% (59/85) / 70.6% (60/85) / 49.4% (42/85) |
| Milan Day | 76 | 59.2% (45/76) | 72.4% (55/76) | 47.4% (36/76) | 59.2% (45/76) / 71.1% (54/76) / 43.4% (33/76) |
| Rajdhani Day | 72 | 68.1% (49/72) | 68.1% (49/72) | 50.0% (36/72) | 66.7% (48/72) / 62.5% (45/72) / 41.7% (30/72) |
| Kalyan | 76 | 72.4% (55/76) | 73.7% (56/76) | 52.6% (40/76) | 71.1% (54/76) / 77.6% (59/76) / 56.6% (43/76) |
| Sridevi Night | 89 | 70.8% (63/89) | 71.9% (64/89) | 53.9% (48/89) | 66.3% (59/89) / 71.9% (64/89) / 49.4% (44/89) |
| Kalyan Night | 61 | 65.6% (40/61) | 75.4% (46/61) | 49.2% (30/61) | 70.5% (43/61) / 60.7% (37/61) / 41.0% (25/61) |
| Madhur Night | 72 | 65.3% (47/72) | 68.1% (49/72) | 47.2% (34/72) | 65.3% (47/72) / 61.1% (44/72) / 40.3% (29/72) |
| Milan Night | 76 | 72.4% (55/76) | 72.4% (55/76) | 50.0% (38/76) | 69.7% (53/76) / 63.2% (48/76) / 46.1% (35/76) |
| Rajdhani Night | 64 | 65.6% (42/64) | 73.4% (47/64) | 46.9% (30/64) | 65.6% (42/64) / 73.4% (47/64) / 46.9% (30/64) |
| Main Bazar | 64 | 71.9% (46/64) | 67.2% (43/64) | 50.0% (32/64) | 71.9% (46/64) / 57.8% (37/64) / 42.2% (27/64) |
| **ALL MARKETS** | 902 | 68.3% (616/902) | 71.2% (642/902) | 50.0% (451/902) | 67.7% (611/902) / 67.2% (606/902) / 46.1% (416/902) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 90 | 21.1% (19/90) | 26.7% (24/90) |
| Time Bazar | 77 | 27.3% (21/77) | 28.6% (22/77) |
| Madhur Day | 85 | 27.1% (23/85) | 27.1% (23/85) |
| Milan Day | 76 | 31.6% (24/76) | 17.1% (13/76) |
| Rajdhani Day | 72 | 22.2% (16/72) | 37.5% (27/72) |
| Kalyan | 76 | 18.4% (14/76) | 26.3% (20/76) |
| Sridevi Night | 89 | 25.8% (23/89) | 32.6% (29/89) |
| Kalyan Night | 61 | 26.2% (16/61) | 13.1% (8/61) |
| Madhur Night | 72 | 40.3% (29/72) | 33.3% (24/72) |
| Milan Night | 76 | 21.1% (16/76) | 30.3% (23/76) |
| Rajdhani Night | 64 | 29.7% (19/64) | 21.9% (14/64) |
| Main Bazar | 64 | 20.3% (13/64) | 21.9% (14/64) |
| **ALL MARKETS** | 902 | 25.8% (233/902) | 26.7% (241/902) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 90 | 51.1% (46/90) | 57.8% (52/90) | N/A | N/A |
| Time Bazar | 77 | 57.1% (44/77) | 55.8% (43/77) | N/A | N/A |
| Madhur Day | 85 | 61.2% (52/85) | 47.1% (40/85) | N/A | N/A |
| Milan Day | 76 | 59.2% (45/76) | 50.0% (38/76) | N/A | N/A |
| Rajdhani Day | 72 | 58.3% (42/72) | 48.6% (35/72) | N/A | N/A |
| Kalyan | 76 | 52.6% (40/76) | 56.6% (43/76) | N/A | N/A |
| Sridevi Night | 89 | 50.6% (45/89) | 52.8% (47/89) | N/A | N/A |
| Kalyan Night | 61 | 50.8% (31/61) | 47.5% (29/61) | N/A | N/A |
| Madhur Night | 72 | 52.8% (38/72) | 56.9% (41/72) | N/A | N/A |
| Milan Night | 76 | 42.1% (32/76) | 52.6% (40/76) | N/A | N/A |
| Rajdhani Night | 64 | 53.1% (34/64) | 43.8% (28/64) | N/A | N/A |
| Main Bazar | 64 | 46.9% (30/64) | 54.7% (35/64) | N/A | N/A |
| **ALL MARKETS** | 902 | 53.1% (479/902) | 52.2% (471/902) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 90 | actual 20, predicted 19, correct 4, recall 20.0%, precision 21.1% | actual 25, predicted 7, correct 4, recall 16.0%, precision 57.1% |
| Time Bazar | 77 | actual 22, predicted 22, correct 3, recall 13.6%, precision 13.6% | actual 19, predicted 17, correct 8, recall 42.1%, precision 47.1% |
| Madhur Day | 85 | actual 28, predicted 22, correct 6, recall 21.4%, precision 27.3% | actual 19, predicted 17, correct 5, recall 26.3%, precision 29.4% |
| Milan Day | 76 | actual 17, predicted 31, correct 7, recall 41.2%, precision 22.6% | actual 20, predicted 14, correct 4, recall 20.0%, precision 28.6% |
| Rajdhani Day | 72 | actual 21, predicted 12, correct 3, recall 14.3%, precision 25.0% | actual 16, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 76 | actual 25, predicted 18, correct 7, recall 28.0%, precision 38.9% | actual 16, predicted 2, correct 2, recall 12.5%, precision 100.0% |
| Sridevi Night | 89 | actual 27, predicted 20, correct 5, recall 18.5%, precision 25.0% | actual 17, predicted 14, correct 1, recall 5.9%, precision 7.1% |
| Kalyan Night | 61 | actual 15, predicted 13, correct 4, recall 26.7%, precision 30.8% | actual 14, predicted 12, correct 3, recall 21.4%, precision 25.0% |
| Madhur Night | 72 | actual 13, predicted 22, correct 5, recall 38.5%, precision 22.7% | actual 17, predicted 11, correct 3, recall 17.6%, precision 27.3% |
| Milan Night | 76 | actual 11, predicted 10, correct 3, recall 27.3%, precision 30.0% | actual 19, predicted 18, correct 4, recall 21.1%, precision 22.2% |
| Rajdhani Night | 64 | actual 17, predicted 8, correct 4, recall 23.5%, precision 50.0% | actual 17, predicted 7, correct 3, recall 17.6%, precision 42.9% |
| Main Bazar | 64 | actual 21, predicted 1, correct 1, recall 4.8%, precision 100.0% | actual 11, predicted 11, correct 1, recall 9.1%, precision 9.1% |
| **ALL MARKETS** | 902 | actual 237, predicted 198, correct 52, recall 21.9%, precision 26.3% | actual 210, predicted 130, correct 38, recall 18.1%, precision 29.2% |

## Data coverage

| Market | Latest actual | Rows fetched |
| --- | --- | --- |
| Sridevi | 2026-08-07 | 847 |
| Time Bazar | 2026-08-07 | 709 |
| Madhur Day | 2026-08-02 | 827 |
| Milan Day | 2026-08-06 | 709 |
| Rajdhani Day | 2026-08-01 | 712 |
| Kalyan | 2026-08-06 | 711 |
| Sridevi Night | 2026-08-06 | 847 |
| Kalyan Night | 2026-08-06 | 587 |
| Madhur Night | 2026-08-01 | 711 |
| Milan Night | 2026-08-06 | 706 |
| Rajdhani Night | 2026-08-06 | 592 |
| Main Bazar | 2026-08-06 | 591 |

The JSON ledger contains every prediction, actual result, gate status, and hit/miss used here: `production-model-window-report.json`.
