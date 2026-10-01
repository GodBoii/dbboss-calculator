# Production app model backtest: 7, 30, and 90 days

Generated 2026-10-01T11:12:50.498Z. App version: 1.0.22. Sutta model version: 1.0.9-above90.

## Method

1. Fetched each production market through the app scrape route.
2. Used the latest fetched actual date, 2026-10-01, as the shared window anchor.
3. Replayed every eligible draw walk-forward: panel, avoid, and DP predictions used only rows dated before the draw.
4. Scored production Top 6 Open suttas, Top 6 Close suttas, and the 6x6 Jodi grid. Sutta source-hybrid rules may use same-date source rows only when that source open/close event happens earlier by the market schedule.
5. Scored production Top 40 Open and Close panel lists.
6. Scored the production avoided two-digit model; gated columns include only CALL rows.
7. Scored DP as DP-only counts. SP is not included as a "correct" kind result.

## Last 7 days (2026-09-25 to 2026-10-01)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 71.4% (5/7) | 85.7% (6/7) | 57.1% (4/7) | 71.4% (5/7) / 85.7% (6/7) / 57.1% (4/7) |
| Time Bazar | 6 | 50.0% (3/6) | 66.7% (4/6) | 33.3% (2/6) | 50.0% (3/6) / 33.3% (2/6) / 16.7% (1/6) |
| Madhur Day | 3 | 66.7% (2/3) | 66.7% (2/3) | 33.3% (1/3) | 66.7% (2/3) / 66.7% (2/3) / 33.3% (1/3) |
| Milan Day | 5 | 80.0% (4/5) | 100.0% (5/5) | 80.0% (4/5) | 80.0% (4/5) / 80.0% (4/5) / 60.0% (3/5) |
| Rajdhani Day | 2 | 0.0% (0/2) | 50.0% (1/2) | 0.0% (0/2) | 50.0% (1/2) / 50.0% (1/2) / 50.0% (1/2) |
| Kalyan | 5 | 40.0% (2/5) | 20.0% (1/5) | 20.0% (1/5) | 80.0% (4/5) / 60.0% (3/5) / 60.0% (3/5) |
| Sridevi Night | 6 | 50.0% (3/6) | 33.3% (2/6) | 16.7% (1/6) | 50.0% (3/6) / 33.3% (2/6) / 16.7% (1/6) |
| Kalyan Night | 4 | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) / 50.0% (2/4) / 25.0% (1/4) |
| Madhur Night | 2 | 50.0% (1/2) | 100.0% (2/2) | 50.0% (1/2) | 50.0% (1/2) / 100.0% (2/2) / 50.0% (1/2) |
| Milan Night | 5 | 60.0% (3/5) | 80.0% (4/5) | 40.0% (2/5) | 60.0% (3/5) / 80.0% (4/5) / 40.0% (2/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) / 50.0% (2/4) / 25.0% (1/4) |
| Main Bazar | 4 | 75.0% (3/4) | 25.0% (1/4) | 0.0% (0/4) | 75.0% (3/4) / 25.0% (1/4) / 0.0% (0/4) |
| **ALL MARKETS** | 53 | 56.6% (30/53) | 60.4% (32/53) | 34.0% (18/53) | 62.3% (33/53) / 58.5% (31/53) / 35.8% (19/53) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 7 | 42.9% (3/7) | 28.6% (2/7) |
| Time Bazar | 6 | 16.7% (1/6) | 33.3% (2/6) |
| Madhur Day | 3 | 33.3% (1/3) | 33.3% (1/3) |
| Milan Day | 5 | 20.0% (1/5) | 20.0% (1/5) |
| Rajdhani Day | 2 | 0.0% (0/2) | 0.0% (0/2) |
| Kalyan | 5 | 20.0% (1/5) | 20.0% (1/5) |
| Sridevi Night | 6 | 16.7% (1/6) | 50.0% (3/6) |
| Kalyan Night | 4 | 0.0% (0/4) | 25.0% (1/4) |
| Madhur Night | 2 | 0.0% (0/2) | 0.0% (0/2) |
| Milan Night | 5 | 20.0% (1/5) | 20.0% (1/5) |
| Rajdhani Night | 4 | 50.0% (2/4) | 25.0% (1/4) |
| Main Bazar | 4 | 0.0% (0/4) | 25.0% (1/4) |
| **ALL MARKETS** | 53 | 20.8% (11/53) | 26.4% (14/53) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 57.1% (4/7) | 42.9% (3/7) | N/A | N/A |
| Time Bazar | 6 | 83.3% (5/6) | 83.3% (5/6) | N/A | N/A |
| Madhur Day | 3 | 33.3% (1/3) | 0.0% (0/3) | N/A | N/A |
| Milan Day | 5 | 40.0% (2/5) | 80.0% (4/5) | N/A | N/A |
| Rajdhani Day | 2 | 50.0% (1/2) | 50.0% (1/2) | N/A | N/A |
| Kalyan | 5 | 60.0% (3/5) | 40.0% (2/5) | N/A | N/A |
| Sridevi Night | 6 | 50.0% (3/6) | 83.3% (5/6) | N/A | N/A |
| Kalyan Night | 4 | 50.0% (2/4) | 25.0% (1/4) | N/A | N/A |
| Madhur Night | 2 | 50.0% (1/2) | 0.0% (0/2) | N/A | N/A |
| Milan Night | 5 | 40.0% (2/5) | 40.0% (2/5) | N/A | N/A |
| Rajdhani Night | 4 | 75.0% (3/4) | 25.0% (1/4) | N/A | N/A |
| Main Bazar | 4 | 25.0% (1/4) | 25.0% (1/4) | N/A | N/A |
| **ALL MARKETS** | 53 | 52.8% (28/53) | 47.2% (25/53) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 7 | actual 0, predicted 3, correct 0, recall N/A, precision 0.0% | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Time Bazar | 6 | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% |
| Madhur Day | 3 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Milan Day | 5 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% |
| Rajdhani Day | 2 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 5 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 3, predicted 0, correct 0, recall 0.0%, precision N/A |
| Sridevi Night | 6 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| Kalyan Night | 4 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A |
| Madhur Night | 2 | actual 1, predicted 2, correct 1, recall 100.0%, precision 50.0% | actual 1, predicted 1, correct 1, recall 100.0%, precision 100.0% |
| Milan Night | 5 | actual 2, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% |
| Rajdhani Night | 4 | actual 1, predicted 0, correct 0, recall 0.0%, precision N/A | actual 0, predicted 1, correct 0, recall N/A, precision 0.0% |
| Main Bazar | 4 | actual 0, predicted 0, correct 0, recall N/A, precision N/A | actual 0, predicted 0, correct 0, recall N/A, precision N/A |
| **ALL MARKETS** | 53 | actual 9, predicted 5, correct 1, recall 11.1%, precision 20.0% | actual 8, predicted 5, correct 1, recall 12.5%, precision 20.0% |

## Last 30 days (2026-09-02 to 2026-10-01)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 70.0% (21/30) | 66.7% (20/30) | 53.3% (16/30) | 70.0% (21/30) / 66.7% (20/30) / 53.3% (16/30) |
| Time Bazar | 25 | 60.0% (15/25) | 72.0% (18/25) | 36.0% (9/25) | 60.0% (15/25) / 52.0% (13/25) / 28.0% (7/25) |
| Madhur Day | 26 | 69.2% (18/26) | 57.7% (15/26) | 30.8% (8/26) | 69.2% (18/26) / 57.7% (15/26) / 30.8% (8/26) |
| Milan Day | 24 | 66.7% (16/24) | 58.3% (14/24) | 37.5% (9/24) | 66.7% (16/24) / 62.5% (15/24) / 37.5% (9/24) |
| Rajdhani Day | 22 | 54.5% (12/22) | 77.3% (17/22) | 40.9% (9/22) | 50.0% (11/22) / 72.7% (16/22) / 36.4% (8/22) |
| Kalyan | 25 | 44.0% (11/25) | 52.0% (13/25) | 24.0% (6/25) | 52.0% (13/25) / 60.0% (15/25) / 44.0% (11/25) |
| Sridevi Night | 29 | 55.2% (16/29) | 55.2% (16/29) | 34.5% (10/29) | 58.6% (17/29) / 55.2% (16/29) / 31.0% (9/29) |
| Kalyan Night | 21 | 66.7% (14/21) | 52.4% (11/21) | 38.1% (8/21) | 71.4% (15/21) / 52.4% (11/21) / 42.9% (9/21) |
| Madhur Night | 22 | 45.5% (10/22) | 72.7% (16/22) | 27.3% (6/22) | 45.5% (10/22) / 63.6% (14/22) / 31.8% (7/22) |
| Milan Night | 24 | 75.0% (18/24) | 58.3% (14/24) | 45.8% (11/24) | 70.8% (17/24) / 58.3% (14/24) / 33.3% (8/24) |
| Rajdhani Night | 21 | 61.9% (13/21) | 52.4% (11/21) | 23.8% (5/21) | 61.9% (13/21) / 52.4% (11/21) / 23.8% (5/21) |
| Main Bazar | 21 | 61.9% (13/21) | 66.7% (14/21) | 38.1% (8/21) | 61.9% (13/21) / 52.4% (11/21) / 28.6% (6/21) |
| **ALL MARKETS** | 290 | 61.0% (177/290) | 61.7% (179/290) | 36.2% (105/290) | 61.7% (179/290) / 59.0% (171/290) / 35.5% (103/290) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 30 | 40.0% (12/30) | 30.0% (9/30) |
| Time Bazar | 25 | 28.0% (7/25) | 28.0% (7/25) |
| Madhur Day | 26 | 15.4% (4/26) | 19.2% (5/26) |
| Milan Day | 24 | 25.0% (6/24) | 12.5% (3/24) |
| Rajdhani Day | 22 | 13.6% (3/22) | 31.8% (7/22) |
| Kalyan | 25 | 44.0% (11/25) | 20.0% (5/25) |
| Sridevi Night | 29 | 20.7% (6/29) | 41.4% (12/29) |
| Kalyan Night | 21 | 23.8% (5/21) | 28.6% (6/21) |
| Madhur Night | 22 | 27.3% (6/22) | 27.3% (6/22) |
| Milan Night | 24 | 33.3% (8/24) | 16.7% (4/24) |
| Rajdhani Night | 21 | 23.8% (5/21) | 23.8% (5/21) |
| Main Bazar | 21 | 33.3% (7/21) | 14.3% (3/21) |
| **ALL MARKETS** | 290 | 27.6% (80/290) | 24.8% (72/290) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 30 | 63.3% (19/30) | 43.3% (13/30) | N/A | N/A |
| Time Bazar | 25 | 44.0% (11/25) | 44.0% (11/25) | N/A | N/A |
| Madhur Day | 26 | 46.2% (12/26) | 26.9% (7/26) | N/A | N/A |
| Milan Day | 24 | 54.2% (13/24) | 58.3% (14/24) | N/A | N/A |
| Rajdhani Day | 22 | 31.8% (7/22) | 54.5% (12/22) | N/A | N/A |
| Kalyan | 25 | 60.0% (15/25) | 48.0% (12/25) | N/A | N/A |
| Sridevi Night | 29 | 72.4% (21/29) | 62.1% (18/29) | N/A | N/A |
| Kalyan Night | 21 | 57.1% (12/21) | 42.9% (9/21) | N/A | N/A |
| Madhur Night | 22 | 63.6% (14/22) | 45.5% (10/22) | N/A | N/A |
| Milan Night | 24 | 41.7% (10/24) | 54.2% (13/24) | N/A | N/A |
| Rajdhani Night | 21 | 47.6% (10/21) | 38.1% (8/21) | N/A | N/A |
| Main Bazar | 21 | 33.3% (7/21) | 38.1% (8/21) | N/A | N/A |
| **ALL MARKETS** | 290 | 52.1% (151/290) | 46.6% (135/290) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 30 | actual 4, predicted 12, correct 2, recall 50.0%, precision 16.7% | actual 6, predicted 6, correct 1, recall 16.7%, precision 16.7% |
| Time Bazar | 25 | actual 6, predicted 4, correct 0, recall 0.0%, precision 0.0% | actual 5, predicted 3, correct 0, recall 0.0%, precision 0.0% |
| Madhur Day | 26 | actual 9, predicted 6, correct 3, recall 33.3%, precision 50.0% | actual 3, predicted 5, correct 2, recall 66.7%, precision 40.0% |
| Milan Day | 24 | actual 5, predicted 6, correct 2, recall 40.0%, precision 33.3% | actual 6, predicted 4, correct 1, recall 16.7%, precision 25.0% |
| Rajdhani Day | 22 | actual 4, predicted 6, correct 2, recall 50.0%, precision 33.3% | actual 7, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 25 | actual 7, predicted 6, correct 1, recall 14.3%, precision 16.7% | actual 10, predicted 1, correct 1, recall 10.0%, precision 100.0% |
| Sridevi Night | 29 | actual 12, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 6, predicted 1, correct 0, recall 0.0%, precision 0.0% |
| Kalyan Night | 21 | actual 8, predicted 4, correct 3, recall 37.5%, precision 75.0% | actual 5, predicted 1, correct 1, recall 20.0%, precision 100.0% |
| Madhur Night | 22 | actual 7, predicted 9, correct 2, recall 28.6%, precision 22.2% | actual 9, predicted 3, correct 1, recall 11.1%, precision 33.3% |
| Milan Night | 24 | actual 3, predicted 2, correct 0, recall 0.0%, precision 0.0% | actual 0, predicted 2, correct 0, recall N/A, precision 0.0% |
| Rajdhani Night | 21 | actual 9, predicted 3, correct 2, recall 22.2%, precision 66.7% | actual 4, predicted 2, correct 0, recall 0.0%, precision 0.0% |
| Main Bazar | 21 | actual 5, predicted 1, correct 0, recall 0.0%, precision 0.0% | actual 4, predicted 5, correct 2, recall 50.0%, precision 40.0% |
| **ALL MARKETS** | 290 | actual 79, predicted 60, correct 17, recall 21.5%, precision 28.3% | actual 65, predicted 33, correct 9, recall 13.8%, precision 27.3% |

## Last 90 days (2026-07-04 to 2026-10-01)

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

| Market | Draws | Open sutta Top 6 | Close sutta Top 6 | Jodi Top 36 | Strict prior-only |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 89 | 67.4% (60/89) | 64.0% (57/89) | 44.9% (40/89) | 67.4% (60/89) / 64.0% (57/89) / 44.9% (40/89) |
| Time Bazar | 75 | 65.3% (49/75) | 72.0% (54/75) | 45.3% (34/75) | 65.3% (49/75) / 61.3% (46/75) / 38.7% (29/75) |
| Madhur Day | 85 | 64.7% (55/85) | 61.2% (52/85) | 37.6% (32/85) | 64.7% (55/85) / 61.2% (52/85) / 37.6% (32/85) |
| Milan Day | 74 | 55.4% (41/74) | 52.7% (39/74) | 31.1% (23/74) | 55.4% (41/74) / 56.8% (42/74) / 32.4% (24/74) |
| Rajdhani Day | 72 | 55.6% (40/72) | 65.3% (47/72) | 40.3% (29/72) | 55.6% (40/72) / 61.1% (44/72) / 40.3% (29/72) |
| Kalyan | 75 | 56.0% (42/75) | 56.0% (42/75) | 33.3% (25/75) | 57.3% (43/75) / 60.0% (45/75) / 37.3% (28/75) |
| Sridevi Night | 88 | 58.0% (51/88) | 54.5% (48/88) | 35.2% (31/88) | 62.5% (55/88) / 54.5% (48/88) / 36.4% (32/88) |
| Kalyan Night | 63 | 63.5% (40/63) | 55.6% (35/63) | 36.5% (23/63) | 66.7% (42/63) / 52.4% (33/63) / 36.5% (23/63) |
| Madhur Night | 72 | 52.8% (38/72) | 61.1% (44/72) | 31.9% (23/72) | 52.8% (38/72) / 62.5% (45/72) / 33.3% (24/72) |
| Milan Night | 74 | 73.0% (54/74) | 63.5% (47/74) | 45.9% (34/74) | 64.9% (48/74) / 60.8% (45/74) / 37.8% (28/74) |
| Rajdhani Night | 63 | 55.6% (35/63) | 61.9% (39/63) | 28.6% (18/63) | 55.6% (35/63) / 61.9% (39/63) / 28.6% (18/63) |
| Main Bazar | 63 | 58.7% (37/63) | 61.9% (39/63) | 39.7% (25/63) | 58.7% (37/63) / 50.8% (32/63) / 28.6% (18/63) |
| **ALL MARKETS** | 893 | 60.7% (542/893) | 60.8% (543/893) | 37.7% (337/893) | 60.8% (543/893) / 59.1% (528/893) / 36.4% (325/893) |

### Open and close panels

| Market | Draws | Open panel Top 40 | Close panel Top 40 |
| --- | --- | --- | --- |
| Sridevi | 89 | 30.3% (27/89) | 24.7% (22/89) |
| Time Bazar | 75 | 24.0% (18/75) | 25.3% (19/75) |
| Madhur Day | 85 | 22.4% (19/85) | 22.4% (19/85) |
| Milan Day | 74 | 31.1% (23/74) | 20.3% (15/74) |
| Rajdhani Day | 72 | 15.3% (11/72) | 26.4% (19/72) |
| Kalyan | 75 | 28.0% (21/75) | 25.3% (19/75) |
| Sridevi Night | 88 | 22.7% (20/88) | 31.8% (28/88) |
| Kalyan Night | 63 | 23.8% (15/63) | 15.9% (10/63) |
| Madhur Night | 72 | 27.8% (20/72) | 36.1% (26/72) |
| Milan Night | 74 | 23.0% (17/74) | 18.9% (14/74) |
| Rajdhani Night | 63 | 28.6% (18/63) | 15.9% (10/63) |
| Main Bazar | 63 | 28.6% (18/63) | 22.2% (14/63) |
| **ALL MARKETS** | 893 | 25.4% (227/893) | 24.1% (215/893) |

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

| Market | Draws | Avoid open pair | Avoid close pair | Gated open | Gated close |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 89 | 62.9% (56/89) | 42.7% (38/89) | N/A | N/A |
| Time Bazar | 75 | 46.7% (35/75) | 45.3% (34/75) | N/A | N/A |
| Madhur Day | 85 | 55.3% (47/85) | 47.1% (40/85) | N/A | N/A |
| Milan Day | 74 | 58.1% (43/74) | 52.7% (39/74) | N/A | N/A |
| Rajdhani Day | 72 | 44.4% (32/72) | 50.0% (36/72) | N/A | N/A |
| Kalyan | 75 | 57.3% (43/75) | 53.3% (40/75) | N/A | N/A |
| Sridevi Night | 88 | 56.8% (50/88) | 50.0% (44/88) | N/A | N/A |
| Kalyan Night | 63 | 55.6% (35/63) | 42.9% (27/63) | N/A | N/A |
| Madhur Night | 72 | 56.9% (41/72) | 44.4% (32/72) | N/A | N/A |
| Milan Night | 74 | 41.9% (31/74) | 55.4% (41/74) | N/A | N/A |
| Rajdhani Night | 63 | 55.6% (35/63) | 36.5% (23/63) | N/A | N/A |
| Main Bazar | 63 | 46.0% (29/63) | 46.0% (29/63) | N/A | N/A |
| **ALL MARKETS** | 893 | 53.4% (477/893) | 47.4% (423/893) | N/A | N/A |

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

| Market | Draws | Open DP only | Close DP only |
| --- | --- | --- | --- |
| Sridevi | 89 | actual 17, predicted 35, correct 7, recall 41.2%, precision 20.0% | actual 23, predicted 13, correct 4, recall 17.4%, precision 30.8% |
| Time Bazar | 75 | actual 19, predicted 26, correct 3, recall 15.8%, precision 11.5% | actual 17, predicted 20, correct 8, recall 47.1%, precision 40.0% |
| Madhur Day | 85 | actual 26, predicted 25, correct 8, recall 30.8%, precision 32.0% | actual 17, predicted 17, correct 5, recall 29.4%, precision 29.4% |
| Milan Day | 74 | actual 16, predicted 15, correct 5, recall 31.3%, precision 33.3% | actual 18, predicted 9, correct 3, recall 16.7%, precision 33.3% |
| Rajdhani Day | 72 | actual 19, predicted 15, correct 5, recall 26.3%, precision 33.3% | actual 21, predicted 0, correct 0, recall 0.0%, precision N/A |
| Kalyan | 75 | actual 24, predicted 17, correct 5, recall 20.8%, precision 29.4% | actual 19, predicted 2, correct 1, recall 5.3%, precision 50.0% |
| Sridevi Night | 88 | actual 28, predicted 10, correct 1, recall 3.6%, precision 10.0% | actual 21, predicted 10, correct 0, recall 0.0%, precision 0.0% |
| Kalyan Night | 63 | actual 16, predicted 12, correct 5, recall 31.3%, precision 41.7% | actual 15, predicted 7, correct 1, recall 6.7%, precision 14.3% |
| Madhur Night | 72 | actual 17, predicted 23, correct 5, recall 29.4%, precision 21.7% | actual 24, predicted 8, correct 2, recall 8.3%, precision 25.0% |
| Milan Night | 74 | actual 8, predicted 7, correct 1, recall 12.5%, precision 14.3% | actual 10, predicted 7, correct 0, recall 0.0%, precision 0.0% |
| Rajdhani Night | 63 | actual 21, predicted 14, correct 6, recall 28.6%, precision 42.9% | actual 15, predicted 12, correct 2, recall 13.3%, precision 16.7% |
| Main Bazar | 63 | actual 13, predicted 4, correct 0, recall 0.0%, precision 0.0% | actual 13, predicted 9, correct 3, recall 23.1%, precision 33.3% |
| **ALL MARKETS** | 893 | actual 224, predicted 203, correct 51, recall 22.8%, precision 25.1% | actual 213, predicted 114, correct 29, recall 13.6%, precision 25.4% |

## Data coverage

| Market | Latest actual | Rows fetched |
| --- | --- | --- |
| Sridevi | 2026-10-01 | 846 |
| Time Bazar | 2026-10-01 | 707 |
| Madhur Day | 2026-09-27 | 827 |
| Milan Day | 2026-09-30 | 708 |
| Rajdhani Day | 2026-09-26 | 711 |
| Kalyan | 2026-09-30 | 711 |
| Sridevi Night | 2026-09-30 | 847 |
| Kalyan Night | 2026-09-30 | 588 |
| Madhur Night | 2026-09-26 | 710 |
| Milan Night | 2026-09-30 | 705 |
| Rajdhani Night | 2026-09-30 | 593 |
| Main Bazar | 2026-09-30 | 592 |

The JSON ledger contains every prediction, actual result, gate status, and hit/miss used here: `production-model-window-report.json`.
