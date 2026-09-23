# Production app model backtest: 7, 30, and 90 days

Generated 2026-08-05T10:32:44.341Z. App version: 1.0.20. Sutta model version: 1.0.9-above90.

## Method

1. Fetched each production market through the app scrape route.
2. Used the latest fetched actual date, 2026-08-05, as the shared window anchor.
3. Replayed every eligible draw walk-forward: panel, avoid, and DP predictions used only rows dated before the draw.
4. Scored production Top 6 Open suttas, Top 6 Close suttas, and the 6x6 Jodi grid. Sutta source-hybrid rules may use same-date source rows only when that source open/close event happens earlier by the market schedule.
5. Scored production Top 40 Open and Close panel lists.
6. Scored the production avoided two-digit model; gated columns include only CALL rows.
7. Scored DP as DP-only counts. SP is not included as a "correct" kind result.

## Last 7 days (2026-07-30 to 2026-08-05)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 85.7% (6/7) | 71.4% (5/7) | 71.4% (5/7) | 85.7% (6/7) / 71.4% (5/7) / 71.4% (5/7) |
| Time Bazar | 6 | 50.0% (3/6) | 50.0% (3/6) | 16.7% (1/6) | 50.0% (3/6) / 16.7% (1/6) / 16.7% (1/6) |
| Madhur Day | 4 | 50.0% (2/4) | 50.0% (2/4) | 50.0% (2/4) | 50.0% (2/4) / 50.0% (2/4) / 50.0% (2/4) |
| Milan Day | 5 | 0.0% (0/5) | 40.0% (2/5) | 0.0% (0/5) | 0.0% (0/5) / 60.0% (3/5) / 0.0% (0/5) |
| Rajdhani Day | 3 | 66.7% (2/3) | 66.7% (2/3) | 66.7% (2/3) | 66.7% (2/3) / 66.7% (2/3) / 66.7% (2/3) |
| Kalyan | 5 | 80.0% (4/5) | 40.0% (2/5) | 40.0% (2/5) | 60.0% (3/5) / 40.0% (2/5) / 20.0% (1/5) |
| Sridevi Night | 6 | 0.0% (0/6) | 50.0% (3/6) | 0.0% (0/6) | 0.0% (0/6) / 50.0% (3/6) / 0.0% (0/6) |
| Kalyan Night | 4 | 75.0% (3/4) | 50.0% (2/4) | 50.0% (2/4) | 100.0% (4/4) / 50.0% (2/4) / 50.0% (2/4) |
| Madhur Night | 3 | 100.0% (3/3) | 66.7% (2/3) | 66.7% (2/3) | 100.0% (3/3) / 66.7% (2/3) / 66.7% (2/3) |
| Milan Night | 5 | 80.0% (4/5) | 60.0% (3/5) | 40.0% (2/5) | 100.0% (5/5) / 60.0% (3/5) / 60.0% (3/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 50.0% (2/4) | 0.0% (0/4) | 50.0% (2/4) / 50.0% (2/4) / 0.0% (0/4) |
| Main Bazar | 4 | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 75.0% (3/4) / 100.0% (4/4) / 75.0% (3/4) |
| **ALL MARKETS** | 56 | 57.1% (32/56) | 55.4% (31/56) | 35.7% (20/56) | 58.9% (33/56) / 55.4% (31/56) / 37.5% (21/56) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 7 | 14.3% (1/7) | 14.3% (1/7) |
| Time Bazar | 6 | 16.7% (1/6) | 0.0% (0/6) |
| Madhur Day | 4 | 25.0% (1/4) | 0.0% (0/4) |
| Milan Day | 5 | 40.0% (2/5) | 20.0% (1/5) |
| Rajdhani Day | 3 | 66.7% (2/3) | 66.7% (2/3) |
| Kalyan | 5 | 20.0% (1/5) | 0.0% (0/5) |
| Sridevi Night | 6 | 16.7% (1/6) | 16.7% (1/6) |
| Kalyan Night | 4 | 50.0% (2/4) | 25.0% (1/4) |
| Madhur Night | 3 | 66.7% (2/3) | 33.3% (1/3) |
| Milan Night | 5 | 40.0% (2/5) | 20.0% (1/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 0.0% (0/4) |
| Main Bazar | 4 | 0.0% (0/4) | 75.0% (3/4) |
| **ALL MARKETS** | 56 | 30.4% (17/56) | 19.6% (11/56) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 57.1% (4/7) | 28.6% (2/7) | N/A | N/A |
| Time Bazar | 6 | 33.3% (2/6) | 83.3% (5/6) | N/A | N/A |
| Madhur Day | 4 | 75.0% (3/4) | 75.0% (3/4) | N/A | N/A |
| Milan Day | 5 | 100.0% (5/5) | 40.0% (2/5) | N/A | N/A |
| Rajdhani Day | 3 | 0.0% (0/3) | 33.3% (1/3) | N/A | N/A |
| Kalyan | 5 | 20.0% (1/5) | 60.0% (3/5) | N/A | N/A |
| Sridevi Night | 6 | 33.3% (2/6) | 0.0% (0/6) | N/A | N/A |
| Kalyan Night | 4 | 75.0% (3/4) | 50.0% (2/4) | N/A | N/A |
| Madhur Night | 3 | 66.7% (2/3) | 33.3% (1/3) | N/A | N/A |
| Milan Night | 5 | 80.0% (4/5) | 60.0% (3/5) | N/A | N/A |
| Rajdhani Night | 4 | 25.0% (1/4) | 25.0% (1/4) | N/A | N/A |
| Main Bazar | 4 | 25.0% (1/4) | 75.0% (3/4) | N/A | N/A |
| **ALL MARKETS** | 56 | 50.0% (28/56) | 46.4% (26/56) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 7 | actual 1, predicted 5, correct 1, recall 100.0%, precision 20.0% | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Time Bazar | 6 | actual 0, predicted 5, correct 0, recall N/A, precision 0.0% | actual 1, predicted 3, correct 1, recall 100.0%, precision 33.3% |
| Madhur Day | 4 | actual 2, predicted 1, correct 1, recall 50.0%, precision 100.0% | actual 1, predicted 1, correct 0, recall 0.0%, precision 0.0% |
| Milan Day | 5 | actual 1, predicted 1, correct 1, recall 100.0%, precision 100.0% | actual 2, predicted 1, correct 1, recall 50.0%, precision 100.0% |
| Rajdhani Day | 3 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Kalyan | 5 | actual 1, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Sridevi Night | 6 | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan Night | 4 | actual 1, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% |
| Madhur Night | 3 | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% | actual 1, predicted 1, correct 1, recall 100.0%, precision 100.0% |
| Milan Night | 5 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Rajdhani Night | 4 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Main Bazar | 4 | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| **ALL MARKETS** | 56 | actual 10, predicted 16, correct 3, recall 30.0%, precision 18.8% | actual 12, predicted 7, correct 3, recall 25.0%, precision 42.9% |

## Last 30 days (2026-07-07 to 2026-08-05)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 53.3% (16/30) | 63.3% (19/30) | 36.7% (11/30) | 53.3% (16/30) / 63.3% (19/30) / 36.7% (11/30) |
| Time Bazar | 26 | 69.2% (18/26) | 69.2% (18/26) | 53.8% (14/26) | 69.2% (18/26) / 61.5% (16/26) / 46.2% (12/26) |
| Madhur Day | 27 | 63.0% (17/27) | 55.6% (15/27) | 37.0% (10/27) | 63.0% (17/27) / 55.6% (15/27) / 37.0% (10/27) |
| Milan Day | 25 | 28.0% (7/25) | 52.0% (13/25) | 16.0% (4/25) | 28.0% (7/25) / 60.0% (15/25) / 20.0% (5/25) |
| Rajdhani Day | 23 | 52.2% (12/23) | 47.8% (11/23) | 34.8% (8/23) | 56.5% (13/23) / 47.8% (11/23) / 34.8% (8/23) |
| Kalyan | 25 | 64.0% (16/25) | 72.0% (18/25) | 44.0% (11/25) | 64.0% (16/25) / 76.0% (19/25) / 44.0% (11/25) |
| Sridevi Night | 29 | 55.2% (16/29) | 58.6% (17/29) | 34.5% (10/29) | 58.6% (17/29) / 58.6% (17/29) / 41.4% (12/29) |
| Kalyan Night | 21 | 52.4% (11/21) | 61.9% (13/21) | 33.3% (7/21) | 61.9% (13/21) / 47.6% (10/21) / 28.6% (6/21) |
| Madhur Night | 23 | 56.5% (13/23) | 56.5% (13/23) | 30.4% (7/23) | 56.5% (13/23) / 60.9% (14/23) / 26.1% (6/23) |
| Milan Night | 25 | 72.0% (18/25) | 68.0% (17/25) | 44.0% (11/25) | 68.0% (17/25) / 72.0% (18/25) / 52.0% (13/25) |
| Rajdhani Night | 21 | 47.6% (10/21) | 66.7% (14/21) | 23.8% (5/21) | 47.6% (10/21) / 66.7% (14/21) / 23.8% (5/21) |
| Main Bazar | 21 | 61.9% (13/21) | 47.6% (10/21) | 33.3% (7/21) | 61.9% (13/21) / 42.9% (9/21) / 28.6% (6/21) |
| **ALL MARKETS** | 296 | 56.4% (167/296) | 60.1% (178/296) | 35.5% (105/296) | 57.4% (170/296) / 59.8% (177/296) / 35.5% (105/296) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 30 | 30.0% (9/30) | 26.7% (8/30) |
| Time Bazar | 26 | 38.5% (10/26) | 26.9% (7/26) |
| Madhur Day | 27 | 25.9% (7/27) | 29.6% (8/27) |
| Milan Day | 25 | 36.0% (9/25) | 20.0% (5/25) |
| Rajdhani Day | 23 | 21.7% (5/23) | 26.1% (6/23) |
| Kalyan | 25 | 28.0% (7/25) | 32.0% (8/25) |
| Sridevi Night | 29 | 27.6% (8/29) | 31.0% (9/29) |
| Kalyan Night | 21 | 19.0% (4/21) | 14.3% (3/21) |
| Madhur Night | 23 | 43.5% (10/23) | 43.5% (10/23) |
| Milan Night | 25 | 20.0% (5/25) | 28.0% (7/25) |
| Rajdhani Night | 21 | 33.3% (7/21) | 19.0% (4/21) |
| Main Bazar | 21 | 14.3% (3/21) | 23.8% (5/21) |
| **ALL MARKETS** | 296 | 28.4% (84/296) | 27.0% (80/296) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 63.3% (19/30) | 53.3% (16/30) | N/A | N/A |
| Time Bazar | 26 | 46.2% (12/26) | 53.8% (14/26) | N/A | N/A |
| Madhur Day | 27 | 48.1% (13/27) | 55.6% (15/27) | N/A | N/A |
| Milan Day | 25 | 64.0% (16/25) | 56.0% (14/25) | N/A | N/A |
| Rajdhani Day | 23 | 52.2% (12/23) | 52.2% (12/23) | N/A | N/A |
| Kalyan | 25 | 48.0% (12/25) | 56.0% (14/25) | N/A | N/A |
| Sridevi Night | 29 | 51.7% (15/29) | 31.0% (9/29) | N/A | N/A |
| Kalyan Night | 21 | 66.7% (14/21) | 52.4% (11/21) | N/A | N/A |
| Madhur Night | 23 | 60.9% (14/23) | 56.5% (13/23) | N/A | N/A |
| Milan Night | 25 | 40.0% (10/25) | 56.0% (14/25) | N/A | N/A |
| Rajdhani Night | 21 | 47.6% (10/21) | 38.1% (8/21) | N/A | N/A |
| Main Bazar | 21 | 57.1% (12/21) | 52.4% (11/21) | N/A | N/A |
| **ALL MARKETS** | 296 | 53.7% (159/296) | 51.0% (151/296) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 30 | actual 4, predicted 15, correct 3, recall 75.0%, precision 20.0% | actual 6, predicted 5, correct 2, recall 33.3%, precision 40.0% |
| Time Bazar | 26 | actual 6, predicted 12, correct 1, recall 16.7%, precision 8.3% | actual 7, predicted 9, correct 5, recall 71.4%, precision 55.6% |
| Madhur Day | 27 | actual 7, predicted 15, correct 3, recall 42.9%, precision 20.0% | actual 6, predicted 9, correct 2, recall 33.3%, precision 22.2% |
| Milan Day | 25 | actual 5, predicted 6, correct 2, recall 40.0%, precision 33.3% | actual 7, predicted 3, correct 1, recall 14.3%, precision 33.3% |
| Rajdhani Day | 23 | actual 8, predicted 4, correct 1, recall 12.5%, precision 25.0% | actual 8, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 25 | actual 10, predicted 4, correct 2, recall 20.0%, precision 50.0% | actual 4, predicted 0, correct 0, recall 0.0%, precision N/A |
| Sridevi Night | 29 | actual 6, predicted 8, correct 1, recall 16.7%, precision 12.5% | actual 4, predicted 9, correct 0, recall 0.0%, precision 0.0% |
| Kalyan Night | 21 | actual 4, predicted 3, correct 1, recall 25.0%, precision 33.3% | actual 3, predicted 3, correct 0, recall 0.0%, precision 0.0% |
| Madhur Night | 23 | actual 2, predicted 10, correct 0, recall 0.0%, precision 0.0% | actual 5, predicted 4, correct 1, recall 20.0%, precision 25.0% |
| Milan Night | 25 | actual 2, predicted 2, correct 1, recall 50.0%, precision 50.0% | actual 9, predicted 0, correct 0, recall 0.0%, precision N/A |
| Rajdhani Night | 21 | actual 3, predicted 2, correct 1, recall 33.3%, precision 50.0% | actual 8, predicted 3, correct 2, recall 25.0%, precision 66.7% |
| Main Bazar | 21 | actual 7, predicted 0, correct 0, recall 0.0%, precision N/A | actual 5, predicted 0, correct 0, recall 0.0%, precision N/A |
| **ALL MARKETS** | 296 | actual 64, predicted 81, correct 16, recall 25.0%, precision 19.8% | actual 72, predicted 45, correct 13, recall 18.1%, precision 28.9% |

## Last 90 days (2026-05-08 to 2026-08-05)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 90 | 67.8% (61/90) | 71.1% (64/90) | 50.0% (45/90) | 67.8% (61/90) / 71.1% (64/90) / 50.0% (45/90) |
| Time Bazar | 77 | 71.4% (55/77) | 72.7% (56/77) | 53.2% (41/77) | 71.4% (55/77) / 63.6% (49/77) / 44.2% (34/77) |
| Madhur Day | 87 | 70.1% (61/87) | 71.3% (62/87) | 50.6% (44/87) | 70.1% (61/87) / 71.3% (62/87) / 50.6% (44/87) |
| Milan Day | 76 | 57.9% (44/76) | 73.7% (56/76) | 47.4% (36/76) | 57.9% (44/76) / 72.4% (55/76) / 42.1% (32/76) |
| Rajdhani Day | 74 | 68.9% (51/74) | 68.9% (51/74) | 51.4% (38/74) | 67.6% (50/74) / 63.5% (47/74) / 43.2% (32/74) |
| Kalyan | 76 | 73.7% (56/76) | 73.7% (56/76) | 53.9% (41/76) | 71.1% (54/76) / 78.9% (60/76) / 57.9% (44/76) |
| Sridevi Night | 89 | 70.8% (63/89) | 70.8% (63/89) | 53.9% (48/89) | 66.3% (59/89) / 70.8% (63/89) / 49.4% (44/89) |
| Kalyan Night | 60 | 63.3% (38/60) | 75.0% (45/60) | 46.7% (28/60) | 68.3% (41/60) / 60.0% (36/60) / 38.3% (23/60) |
| Madhur Night | 74 | 63.5% (47/74) | 68.9% (51/74) | 45.9% (34/74) | 63.5% (47/74) / 62.2% (46/74) / 39.2% (29/74) |
| Milan Night | 76 | 73.7% (56/76) | 72.4% (55/76) | 50.0% (38/76) | 69.7% (53/76) / 63.2% (48/76) / 46.1% (35/76) |
| Rajdhani Night | 63 | 65.1% (41/63) | 74.6% (47/63) | 47.6% (30/63) | 65.1% (41/63) / 74.6% (47/63) / 47.6% (30/63) |
| Main Bazar | 63 | 69.8% (44/63) | 66.7% (42/63) | 47.6% (30/63) | 69.8% (44/63) / 58.7% (37/63) / 41.3% (26/63) |
| **ALL MARKETS** | 905 | 68.2% (617/905) | 71.6% (648/905) | 50.1% (453/905) | 67.4% (610/905) / 67.8% (614/905) / 46.2% (418/905) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 90 | 20.0% (18/90) | 26.7% (24/90) |
| Time Bazar | 77 | 27.3% (21/77) | 28.6% (22/77) |
| Madhur Day | 87 | 27.6% (24/87) | 28.7% (25/87) |
| Milan Day | 76 | 31.6% (24/76) | 18.4% (14/76) |
| Rajdhani Day | 74 | 21.6% (16/74) | 36.5% (27/74) |
| Kalyan | 76 | 18.4% (14/76) | 27.6% (21/76) |
| Sridevi Night | 89 | 24.7% (22/89) | 34.8% (31/89) |
| Kalyan Night | 60 | 26.7% (16/60) | 13.3% (8/60) |
| Madhur Night | 74 | 40.5% (30/74) | 33.8% (25/74) |
| Milan Night | 76 | 22.4% (17/76) | 31.6% (24/76) |
| Rajdhani Night | 63 | 28.6% (18/63) | 23.8% (15/63) |
| Main Bazar | 63 | 20.6% (13/63) | 25.4% (16/63) |
| **ALL MARKETS** | 905 | 25.7% (233/905) | 27.8% (252/905) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 90 | 52.2% (47/90) | 58.9% (53/90) | N/A | N/A |
| Time Bazar | 77 | 55.8% (43/77) | 55.8% (43/77) | N/A | N/A |
| Madhur Day | 87 | 59.8% (52/87) | 47.1% (41/87) | N/A | N/A |
| Milan Day | 76 | 59.2% (45/76) | 50.0% (38/76) | N/A | N/A |
| Rajdhani Day | 74 | 58.1% (43/74) | 50.0% (37/74) | N/A | N/A |
| Kalyan | 76 | 50.0% (38/76) | 53.9% (41/76) | N/A | N/A |
| Sridevi Night | 89 | 51.7% (46/89) | 51.7% (46/89) | N/A | N/A |
| Kalyan Night | 60 | 50.0% (30/60) | 55.0% (33/60) | N/A | N/A |
| Madhur Night | 74 | 52.7% (39/74) | 56.8% (42/74) | N/A | N/A |
| Milan Night | 76 | 43.4% (33/76) | 51.3% (39/76) | N/A | N/A |
| Rajdhani Night | 63 | 54.0% (34/63) | 42.9% (27/63) | N/A | N/A |
| Main Bazar | 63 | 46.0% (29/63) | 57.1% (36/63) | N/A | N/A |
| **ALL MARKETS** | 905 | 52.9% (479/905) | 52.6% (476/905) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 90 | actual 22, predicted 18, correct 4, recall 18.2%, precision 22.2% | actual 25, predicted 7, correct 4, recall 16.0%, precision 57.1% |
| Time Bazar | 77 | actual 24, predicted 20, correct 3, recall 12.5%, precision 15.0% | actual 20, predicted 17, correct 8, recall 40.0%, precision 47.1% |
| Madhur Day | 87 | actual 28, predicted 22, correct 6, recall 21.4%, precision 27.3% | actual 20, predicted 17, correct 5, recall 25.0%, precision 29.4% |
| Milan Day | 76 | actual 16, predicted 31, correct 7, recall 43.8%, precision 22.6% | actual 20, predicted 14, correct 4, recall 20.0%, precision 28.6% |
| Rajdhani Day | 74 | actual 21, predicted 12, correct 3, recall 14.3%, precision 25.0% | actual 17, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 76 | actual 24, predicted 20, correct 8, recall 33.3%, precision 40.0% | actual 17, predicted 2, correct 2, recall 11.8%, precision 100.0% |
| Sridevi Night | 89 | actual 27, predicted 20, correct 5, recall 18.5%, precision 25.0% | actual 16, predicted 14, correct 1, recall 6.3%, precision 7.1% |
| Kalyan Night | 60 | actual 15, predicted 14, correct 4, recall 26.7%, precision 28.6% | actual 13, predicted 13, correct 3, recall 23.1%, precision 23.1% |
| Madhur Night | 74 | actual 13, predicted 22, correct 5, recall 38.5%, precision 22.7% | actual 18, predicted 11, correct 3, recall 16.7%, precision 27.3% |
| Milan Night | 76 | actual 11, predicted 10, correct 3, recall 27.3%, precision 30.0% | actual 19, predicted 19, correct 4, recall 21.1%, precision 21.1% |
| Rajdhani Night | 63 | actual 16, predicted 7, correct 4, recall 25.0%, precision 57.1% | actual 17, predicted 7, correct 3, recall 17.6%, precision 42.9% |
| Main Bazar | 63 | actual 20, predicted 1, correct 1, recall 5.0%, precision 100.0% | actual 12, predicted 11, correct 1, recall 8.3%, precision 9.1% |
| **ALL MARKETS** | 905 | actual 237, predicted 197, correct 53, recall 22.4%, precision 26.9% | actual 214, predicted 132, correct 38, recall 17.8%, precision 28.8% |

## Data coverage

| Market | Latest actual | Rows fetched |
| --- | --- | --- |
| Sridevi | 2026-08-05 | 847 |
| Time Bazar | 2026-08-05 | 709 |
| Madhur Day | 2026-08-02 | 827 |
| Milan Day | 2026-08-04 | 709 |
| Rajdhani Day | 2026-08-01 | 712 |
| Kalyan | 2026-08-04 | 711 |
| Sridevi Night | 2026-08-04 | 847 |
| Kalyan Night | 2026-08-04 | 587 |
| Madhur Night | 2026-08-01 | 711 |
| Milan Night | 2026-08-04 | 706 |
| Rajdhani Night | 2026-08-04 | 592 |
| Main Bazar | 2026-08-04 | 591 |

The JSON ledger contains every prediction, actual result, gate status, and hit/miss used here: `production-model-window-report.json`.
