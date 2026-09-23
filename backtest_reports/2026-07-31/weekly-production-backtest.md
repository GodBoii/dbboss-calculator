# Three-week production prediction backtest

Generated 2026-07-31T00:51:27.762Z. Model version: 1.0.9-above90. App version: 1.0.20.

## Method

- Test window: the three last completed Sunday-Saturday weeks before 2026-07-31; the incomplete current week is excluded.
- Walk-forward scoring: each draw is predicted using only records dated before that draw. No tested result or later result is included in its training history.
- Production defaults: Top 6 Open suttas, Top 6 Close suttas, their 36 Jodis, and Top 60 Open/Close panels. Top-30 panel accuracy is included in the combined summary.
- SP/DP is an exact kind classification. The app treats triple panels as SP because only SP and DP are modeled.
- Digit candidates are scored even when their UI gate says "No safe call" or "Research only"; gated results are reported separately and may have zero coverage.
- Accuracy is a hit rate per eligible completed result, not a claim of profitability. Different prediction sets have very different coverage sizes.

## Combined three-week results by market

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @30 | Open panel @60 | Close panel @30 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 21 | 47.6% (10/21) | 57.1% (12/21) | 19.0% (4/21) | 33.3% (7/21) | 57.1% (12/21) | 23.8% (5/21) | 33.3% (7/21) | 61.9% (13/21) | 76.2% (16/21) |
| Time Bazar | 18 | 83.3% (15/18) | 77.8% (14/18) | 66.7% (12/18) | 27.8% (5/18) | 38.9% (7/18) | 16.7% (3/18) | 33.3% (6/18) | 44.4% (8/18) | 77.8% (14/18) |
| Madhur Day | 21 | 71.4% (15/21) | 66.7% (14/21) | 38.1% (8/21) | 14.3% (3/21) | 28.6% (6/21) | 23.8% (5/21) | 38.1% (8/21) | 38.1% (8/21) | 66.7% (14/21) |
| Milan Day | 18 | 44.4% (8/18) | 61.1% (11/18) | 33.3% (6/18) | 27.8% (5/18) | 61.1% (11/18) | 16.7% (3/18) | 22.2% (4/18) | 72.2% (13/18) | 61.1% (11/18) |
| Rajdhani Day | 18 | 66.7% (12/18) | 50.0% (9/18) | 38.9% (7/18) | 5.6% (1/18) | 38.9% (7/18) | 5.6% (1/18) | 38.9% (7/18) | 55.6% (10/18) | 61.1% (11/18) |
| Kalyan | 18 | 72.2% (13/18) | 72.2% (13/18) | 44.4% (8/18) | 27.8% (5/18) | 33.3% (6/18) | 33.3% (6/18) | 61.1% (11/18) | 66.7% (12/18) | 88.9% (16/18) |
| Sridevi Night | 21 | 66.7% (14/21) | 57.1% (12/21) | 42.9% (9/21) | 23.8% (5/21) | 42.9% (9/21) | 38.1% (8/21) | 52.4% (11/21) | 42.9% (9/21) | 52.4% (11/21) |
| Kalyan Night | 15 | 46.7% (7/15) | 40.0% (6/15) | 26.7% (4/15) | 6.7% (1/15) | 26.7% (4/15) | 6.7% (1/15) | 20.0% (3/15) | 86.7% (13/15) | 66.7% (10/15) |
| Madhur Night | 18 | 38.9% (7/18) | 61.1% (11/18) | 22.2% (4/18) | 22.2% (4/18) | 44.4% (8/18) | 38.9% (7/18) | 50.0% (9/18) | 50.0% (9/18) | 55.6% (10/18) |
| Milan Night | 18 | 66.7% (12/18) | 66.7% (12/18) | 50.0% (9/18) | 5.6% (1/18) | 16.7% (3/18) | 16.7% (3/18) | 33.3% (6/18) | 83.3% (15/18) | 66.7% (12/18) |
| Rajdhani Night | 15 | 60.0% (9/15) | 73.3% (11/15) | 33.3% (5/15) | 26.7% (4/15) | 46.7% (7/15) | 20.0% (3/15) | 33.3% (5/15) | 80.0% (12/15) | 66.7% (10/15) |
| Main Bazar | 15 | 53.3% (8/15) | 40.0% (6/15) | 26.7% (4/15) | 20.0% (3/15) | 46.7% (7/15) | 6.7% (1/15) | 40.0% (6/15) | 73.3% (11/15) | 73.3% (11/15) |
| **ALL MARKETS** | 216 | 60.2% (130/216) | 60.6% (131/216) | 37.0% (80/216) | 20.4% (44/216) | 40.3% (87/216) | 21.3% (46/216) | 38.4% (83/216) | 61.6% (133/216) | 67.6% (146/216) |

## Combined two-digit results

| Market | Avoid open | Avoid close | Avoid gated open | Avoid gated close | Present open | Present close | Present gated open | Present gated close |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 61.9% (13/21) | 47.6% (10/21) | N/A | N/A | 9.5% (2/21) | 14.3% (3/21) | N/A | N/A |
| Time Bazar | 50.0% (9/18) | 44.4% (8/18) | N/A | N/A | 0.0% (0/18) | 5.6% (1/18) | N/A | N/A |
| Madhur Day | 47.6% (10/21) | 52.4% (11/21) | N/A | N/A | 0.0% (0/21) | 4.8% (1/21) | N/A | N/A |
| Milan Day | 66.7% (12/18) | 50.0% (9/18) | N/A | N/A | 11.1% (2/18) | 5.6% (1/18) | N/A | N/A |
| Rajdhani Day | 61.1% (11/18) | 55.6% (10/18) | N/A | N/A | 5.6% (1/18) | 0.0% (0/18) | N/A | N/A |
| Kalyan | 66.7% (12/18) | 44.4% (8/18) | N/A | N/A | 11.1% (2/18) | 16.7% (3/18) | N/A | N/A |
| Sridevi Night | 52.4% (11/21) | 42.9% (9/21) | N/A | N/A | 9.5% (2/21) | 4.8% (1/21) | N/A | N/A |
| Kalyan Night | 66.7% (10/15) | 60.0% (9/15) | N/A | N/A | 13.3% (2/15) | 0.0% (0/15) | N/A | N/A |
| Madhur Night | 61.1% (11/18) | 44.4% (8/18) | N/A | N/A | 5.6% (1/18) | 5.6% (1/18) | N/A | N/A |
| Milan Night | 33.3% (6/18) | 61.1% (11/18) | N/A | N/A | 0.0% (0/18) | 0.0% (0/18) | N/A | N/A |
| Rajdhani Night | 53.3% (8/15) | 40.0% (6/15) | N/A | N/A | 13.3% (2/15) | 0.0% (0/15) | N/A | N/A |
| Main Bazar | 53.3% (8/15) | 40.0% (6/15) | N/A | N/A | 0.0% (0/15) | 6.7% (1/15) | N/A | N/A |
| **ALL MARKETS** | 56.0% (121/216) | 48.6% (105/216) | N/A | N/A | 6.5% (14/216) | 5.6% (12/216) | N/A | N/A |

## Week 2026-07-05 to 2026-07-11

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @60 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 71.4% (5/7) | 71.4% (5/7) | 42.9% (3/7) | 71.4% (5/7) | 14.3% (1/7) | 28.6% (2/7) | 85.7% (6/7) |
| Time Bazar | 6 | 66.7% (4/6) | 66.7% (4/6) | 50.0% (3/6) | 50.0% (3/6) | 50.0% (3/6) | 50.0% (3/6) | 66.7% (4/6) |
| Madhur Day | 7 | 57.1% (4/7) | 100.0% (7/7) | 57.1% (4/7) | 28.6% (2/7) | 28.6% (2/7) | 42.9% (3/7) | 57.1% (4/7) |
| Milan Day | 6 | 33.3% (2/6) | 66.7% (4/6) | 33.3% (2/6) | 66.7% (4/6) | 33.3% (2/6) | 66.7% (4/6) | 83.3% (5/6) |
| Rajdhani Day | 6 | 66.7% (4/6) | 66.7% (4/6) | 50.0% (3/6) | 33.3% (2/6) | 16.7% (1/6) | 50.0% (3/6) | 50.0% (3/6) |
| Kalyan | 6 | 66.7% (4/6) | 66.7% (4/6) | 33.3% (2/6) | 33.3% (2/6) | 66.7% (4/6) | 66.7% (4/6) | 100.0% (6/6) |
| Sridevi Night | 7 | 57.1% (4/7) | 28.6% (2/7) | 14.3% (1/7) | 14.3% (1/7) | 57.1% (4/7) | 42.9% (3/7) | 71.4% (5/7) |
| Kalyan Night | 5 | 60.0% (3/5) | 40.0% (2/5) | 40.0% (2/5) | 40.0% (2/5) | 0.0% (0/5) | 80.0% (4/5) | 80.0% (4/5) |
| Madhur Night | 6 | 0.0% (0/6) | 50.0% (3/6) | 0.0% (0/6) | 50.0% (3/6) | 50.0% (3/6) | 83.3% (5/6) | 66.7% (4/6) |
| Milan Night | 6 | 66.7% (4/6) | 33.3% (2/6) | 33.3% (2/6) | 33.3% (2/6) | 16.7% (1/6) | 83.3% (5/6) | 83.3% (5/6) |
| Rajdhani Night | 5 | 80.0% (4/5) | 40.0% (2/5) | 20.0% (1/5) | 20.0% (1/5) | 40.0% (2/5) | 60.0% (3/5) | 60.0% (3/5) |
| Main Bazar | 5 | 40.0% (2/5) | 20.0% (1/5) | 0.0% (0/5) | 40.0% (2/5) | 20.0% (1/5) | 80.0% (4/5) | 60.0% (3/5) |
| **ALL MARKETS** | 72 | 55.6% (40/72) | 55.6% (40/72) | 31.9% (23/72) | 40.3% (29/72) | 33.3% (24/72) | 59.7% (43/72) | 72.2% (52/72) |

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

| Market | Avoid open | Avoid close | Avoid gated | Present open | Present close | Present gated |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 42.9% (3/7) | 42.9% (3/7) | N/A / N/A | 14.3% (1/7) | 14.3% (1/7) | N/A / N/A |
| Time Bazar | 66.7% (4/6) | 33.3% (2/6) | N/A / N/A | 0.0% (0/6) | 16.7% (1/6) | N/A / N/A |
| Madhur Day | 57.1% (4/7) | 71.4% (5/7) | N/A / N/A | 0.0% (0/7) | 0.0% (0/7) | N/A / N/A |
| Milan Day | 83.3% (5/6) | 33.3% (2/6) | N/A / N/A | 33.3% (2/6) | 0.0% (0/6) | N/A / N/A |
| Rajdhani Day | 50.0% (3/6) | 66.7% (4/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Kalyan | 83.3% (5/6) | 16.7% (1/6) | N/A / N/A | 16.7% (1/6) | 16.7% (1/6) | N/A / N/A |
| Sridevi Night | 28.6% (2/7) | 57.1% (4/7) | N/A / N/A | 0.0% (0/7) | 0.0% (0/7) | N/A / N/A |
| Kalyan Night | 40.0% (2/5) | 40.0% (2/5) | N/A / N/A | 20.0% (1/5) | 0.0% (0/5) | N/A / N/A |
| Madhur Night | 50.0% (3/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 16.7% (1/6) | N/A / N/A |
| Milan Night | 33.3% (2/6) | 66.7% (4/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Rajdhani Night | 60.0% (3/5) | 40.0% (2/5) | N/A / N/A | 20.0% (1/5) | 0.0% (0/5) | N/A / N/A |
| Main Bazar | 20.0% (1/5) | 80.0% (4/5) | N/A / N/A | 0.0% (0/5) | 20.0% (1/5) | N/A / N/A |
| **ALL MARKETS** | 51.4% (37/72) | 50.0% (36/72) | N/A / N/A | 8.3% (6/72) | 6.9% (5/72) | N/A / N/A |

## Week 2026-07-12 to 2026-07-18

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @60 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 14.3% (1/7) | 42.9% (3/7) | 0.0% (0/7) | 57.1% (4/7) | 42.9% (3/7) | 71.4% (5/7) | 85.7% (6/7) |
| Time Bazar | 6 | 100.0% (6/6) | 83.3% (5/6) | 83.3% (5/6) | 16.7% (1/6) | 0.0% (0/6) | 50.0% (3/6) | 83.3% (5/6) |
| Madhur Day | 7 | 71.4% (5/7) | 42.9% (3/7) | 14.3% (1/7) | 14.3% (1/7) | 42.9% (3/7) | 14.3% (1/7) | 57.1% (4/7) |
| Milan Day | 6 | 50.0% (3/6) | 66.7% (4/6) | 50.0% (3/6) | 66.7% (4/6) | 0.0% (0/6) | 66.7% (4/6) | 33.3% (2/6) |
| Rajdhani Day | 6 | 66.7% (4/6) | 50.0% (3/6) | 33.3% (2/6) | 50.0% (3/6) | 33.3% (2/6) | 50.0% (3/6) | 66.7% (4/6) |
| Kalyan | 6 | 66.7% (4/6) | 83.3% (5/6) | 50.0% (3/6) | 33.3% (2/6) | 66.7% (4/6) | 83.3% (5/6) | 83.3% (5/6) |
| Sridevi Night | 7 | 57.1% (4/7) | 57.1% (4/7) | 42.9% (3/7) | 57.1% (4/7) | 42.9% (3/7) | 14.3% (1/7) | 14.3% (1/7) |
| Kalyan Night | 5 | 20.0% (1/5) | 60.0% (3/5) | 20.0% (1/5) | 0.0% (0/5) | 40.0% (2/5) | 80.0% (4/5) | 80.0% (4/5) |
| Madhur Night | 6 | 50.0% (3/6) | 100.0% (6/6) | 50.0% (3/6) | 16.7% (1/6) | 66.7% (4/6) | 50.0% (3/6) | 50.0% (3/6) |
| Milan Night | 6 | 83.3% (5/6) | 83.3% (5/6) | 66.7% (4/6) | 16.7% (1/6) | 33.3% (2/6) | 83.3% (5/6) | 66.7% (4/6) |
| Rajdhani Night | 5 | 80.0% (4/5) | 80.0% (4/5) | 60.0% (3/5) | 80.0% (4/5) | 20.0% (1/5) | 100.0% (5/5) | 80.0% (4/5) |
| Main Bazar | 5 | 60.0% (3/5) | 60.0% (3/5) | 60.0% (3/5) | 40.0% (2/5) | 40.0% (2/5) | 60.0% (3/5) | 80.0% (4/5) |
| **ALL MARKETS** | 72 | 59.7% (43/72) | 66.7% (48/72) | 43.1% (31/72) | 37.5% (27/72) | 36.1% (26/72) | 58.3% (42/72) | 63.9% (46/72) |

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

| Market | Avoid open | Avoid close | Avoid gated | Present open | Present close | Present gated |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 71.4% (5/7) | 28.6% (2/7) | N/A / N/A | 14.3% (1/7) | 14.3% (1/7) | N/A / N/A |
| Time Bazar | 66.7% (4/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Madhur Day | 28.6% (2/7) | 42.9% (3/7) | N/A / N/A | 0.0% (0/7) | 14.3% (1/7) | N/A / N/A |
| Milan Day | 50.0% (3/6) | 66.7% (4/6) | N/A / N/A | 0.0% (0/6) | 16.7% (1/6) | N/A / N/A |
| Rajdhani Day | 83.3% (5/6) | 50.0% (3/6) | N/A / N/A | 16.7% (1/6) | 0.0% (0/6) | N/A / N/A |
| Kalyan | 66.7% (4/6) | 66.7% (4/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Sridevi Night | 28.6% (2/7) | 0.0% (0/7) | N/A / N/A | 14.3% (1/7) | 0.0% (0/7) | N/A / N/A |
| Kalyan Night | 100.0% (5/5) | 80.0% (4/5) | N/A / N/A | 0.0% (0/5) | 0.0% (0/5) | N/A / N/A |
| Madhur Night | 66.7% (4/6) | 16.7% (1/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Milan Night | 0.0% (0/6) | 66.7% (4/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Rajdhani Night | 60.0% (3/5) | 40.0% (2/5) | N/A / N/A | 20.0% (1/5) | 0.0% (0/5) | N/A / N/A |
| Main Bazar | 80.0% (4/5) | 0.0% (0/5) | N/A / N/A | 0.0% (0/5) | 0.0% (0/5) | N/A / N/A |
| **ALL MARKETS** | 56.9% (41/72) | 41.7% (30/72) | N/A / N/A | 5.6% (4/72) | 4.2% (3/72) | N/A / N/A |

## Week 2026-07-19 to 2026-07-25

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @60 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 7 | 57.1% (4/7) | 57.1% (4/7) | 14.3% (1/7) | 42.9% (3/7) | 42.9% (3/7) | 85.7% (6/7) | 57.1% (4/7) |
| Time Bazar | 6 | 83.3% (5/6) | 83.3% (5/6) | 66.7% (4/6) | 50.0% (3/6) | 50.0% (3/6) | 33.3% (2/6) | 83.3% (5/6) |
| Madhur Day | 7 | 85.7% (6/7) | 57.1% (4/7) | 42.9% (3/7) | 42.9% (3/7) | 42.9% (3/7) | 57.1% (4/7) | 85.7% (6/7) |
| Milan Day | 6 | 50.0% (3/6) | 50.0% (3/6) | 16.7% (1/6) | 50.0% (3/6) | 33.3% (2/6) | 83.3% (5/6) | 66.7% (4/6) |
| Rajdhani Day | 6 | 66.7% (4/6) | 33.3% (2/6) | 33.3% (2/6) | 33.3% (2/6) | 66.7% (4/6) | 66.7% (4/6) | 66.7% (4/6) |
| Kalyan | 6 | 83.3% (5/6) | 66.7% (4/6) | 50.0% (3/6) | 33.3% (2/6) | 50.0% (3/6) | 50.0% (3/6) | 83.3% (5/6) |
| Sridevi Night | 7 | 85.7% (6/7) | 85.7% (6/7) | 71.4% (5/7) | 57.1% (4/7) | 57.1% (4/7) | 71.4% (5/7) | 71.4% (5/7) |
| Kalyan Night | 5 | 60.0% (3/5) | 20.0% (1/5) | 20.0% (1/5) | 40.0% (2/5) | 20.0% (1/5) | 100.0% (5/5) | 40.0% (2/5) |
| Madhur Night | 6 | 66.7% (4/6) | 33.3% (2/6) | 16.7% (1/6) | 66.7% (4/6) | 33.3% (2/6) | 16.7% (1/6) | 50.0% (3/6) |
| Milan Night | 6 | 50.0% (3/6) | 83.3% (5/6) | 50.0% (3/6) | 0.0% (0/6) | 50.0% (3/6) | 83.3% (5/6) | 50.0% (3/6) |
| Rajdhani Night | 5 | 20.0% (1/5) | 100.0% (5/5) | 20.0% (1/5) | 40.0% (2/5) | 40.0% (2/5) | 80.0% (4/5) | 60.0% (3/5) |
| Main Bazar | 5 | 60.0% (3/5) | 40.0% (2/5) | 20.0% (1/5) | 60.0% (3/5) | 60.0% (3/5) | 80.0% (4/5) | 80.0% (4/5) |
| **ALL MARKETS** | 72 | 65.3% (47/72) | 59.7% (43/72) | 36.1% (26/72) | 43.1% (31/72) | 45.8% (33/72) | 66.7% (48/72) | 66.7% (48/72) |

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

| Market | Avoid open | Avoid close | Avoid gated | Present open | Present close | Present gated |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 71.4% (5/7) | 71.4% (5/7) | N/A / N/A | 0.0% (0/7) | 14.3% (1/7) | N/A / N/A |
| Time Bazar | 16.7% (1/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Madhur Day | 57.1% (4/7) | 42.9% (3/7) | N/A / N/A | 0.0% (0/7) | 0.0% (0/7) | N/A / N/A |
| Milan Day | 66.7% (4/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Rajdhani Day | 50.0% (3/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Kalyan | 50.0% (3/6) | 50.0% (3/6) | N/A / N/A | 16.7% (1/6) | 33.3% (2/6) | N/A / N/A |
| Sridevi Night | 100.0% (7/7) | 71.4% (5/7) | N/A / N/A | 14.3% (1/7) | 14.3% (1/7) | N/A / N/A |
| Kalyan Night | 60.0% (3/5) | 60.0% (3/5) | N/A / N/A | 20.0% (1/5) | 0.0% (0/5) | N/A / N/A |
| Madhur Night | 66.7% (4/6) | 66.7% (4/6) | N/A / N/A | 16.7% (1/6) | 0.0% (0/6) | N/A / N/A |
| Milan Night | 66.7% (4/6) | 50.0% (3/6) | N/A / N/A | 0.0% (0/6) | 0.0% (0/6) | N/A / N/A |
| Rajdhani Night | 40.0% (2/5) | 40.0% (2/5) | N/A / N/A | 0.0% (0/5) | 0.0% (0/5) | N/A / N/A |
| Main Bazar | 60.0% (3/5) | 40.0% (2/5) | N/A / N/A | 0.0% (0/5) | 0.0% (0/5) | N/A / N/A |
| **ALL MARKETS** | 59.7% (43/72) | 54.2% (39/72) | N/A / N/A | 5.6% (4/72) | 5.6% (4/72) | N/A / N/A |

## Actual-result data coverage

| Market | Latest actual | Rows fetched |
| --- | --- | --- |
| Sridevi | 2026-07-30 | 724 |
| Time Bazar | 2026-07-30 | 604 |
| Madhur Day | 2026-07-30 | 704 |
| Milan Day | 2026-07-30 | 604 |
| Rajdhani Day | 2026-07-25 | 606 |
| Kalyan | 2026-07-30 | 606 |
| Sridevi Night | 2026-07-30 | 724 |
| Kalyan Night | 2026-07-30 | 500 |
| Madhur Night | 2026-07-30 | 605 |
| Milan Night | 2026-07-30 | 601 |
| Rajdhani Night | 2026-07-30 | 505 |
| Main Bazar | 2026-07-30 | 504 |

Primary actual-result source: [dpbossss.boston](https://dpbossss.boston/). The application’s configured independent supplement was also requested, fail-soft, and its audit is preserved in the JSON report.

The machine-readable ledger contains every prediction, actual result, gate status, and hit/miss used in these tables: `weekly-production-backtest.json`.
