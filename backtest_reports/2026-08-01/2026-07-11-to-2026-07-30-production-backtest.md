# Production prediction backtest: 2026-07-11 to 2026-07-30

Generated 2026-08-01T10:41:23.198Z. Model version: 1.0.9-above90. App version: 1.0.20.

## Method

- Test window: the explicitly requested date window 2026-07-11 through 2026-07-30.
- Walk-forward scoring: each draw is predicted using only records dated before that draw. No tested result or later result is included in its training history.
- Production contract: Top 3 Open suttas, Top 3 Close suttas, their explicitly labelled 3x3 nine-Jodi grid, and Top 40 Open/Close panels. Top-30 panel accuracy is included as a comparison.
- SP/DP is an exact kind classification. The app treats triple panels as SP because only SP and DP are modeled.
- Digit candidates are scored even when their UI gate says "No safe call" or "Research only"; gated results are reported separately and may have zero coverage.
- Accuracy is a hit rate per eligible completed result, not a claim of profitability. Different prediction sets have very different coverage sizes.

## Requested-window results by market

| Market | Draws | Open sutta @3 | Close sutta @3 | Jodi grid @9 | Open panel @30 | Open panel @40 | Close panel @30 | Close panel @40 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 20 | 25.0% (5/20) | 30.0% (6/20) | 10.0% (2/20) | 25.0% (5/20) | 30.0% (6/20) | 20.0% (4/20) | 30.0% (6/20) | 75.0% (15/20) | 75.0% (15/20) |
| Time Bazar | 17 | 35.3% (6/17) | 35.3% (6/17) | 17.6% (3/17) | 29.4% (5/17) | 35.3% (6/17) | 23.5% (4/17) | 35.3% (6/17) | 47.1% (8/17) | 82.4% (14/17) |
| Madhur Day | 20 | 40.0% (8/20) | 30.0% (6/20) | 10.0% (2/20) | 5.0% (1/20) | 20.0% (4/20) | 20.0% (4/20) | 30.0% (6/20) | 40.0% (8/20) | 60.0% (12/20) |
| Milan Day | 17 | 17.6% (3/17) | 35.3% (6/17) | 11.8% (2/17) | 29.4% (5/17) | 35.3% (6/17) | 5.9% (1/17) | 23.5% (4/17) | 70.6% (12/17) | 64.7% (11/17) |
| Rajdhani Day | 13 | 23.1% (3/13) | 7.7% (1/13) | 0.0% (0/13) | 15.4% (2/13) | 15.4% (2/13) | 15.4% (2/13) | 15.4% (2/13) | 53.8% (7/13) | 61.5% (8/13) |
| Kalyan | 17 | 17.6% (3/17) | 23.5% (4/17) | 0.0% (0/17) | 11.8% (2/17) | 29.4% (5/17) | 23.5% (4/17) | 29.4% (5/17) | 64.7% (11/17) | 82.4% (14/17) |
| Sridevi Night | 20 | 20.0% (4/20) | 40.0% (8/20) | 5.0% (1/20) | 25.0% (5/20) | 35.0% (7/20) | 25.0% (5/20) | 30.0% (6/20) | 60.0% (12/20) | 50.0% (10/20) |
| Kalyan Night | 14 | 35.7% (5/14) | 28.6% (4/14) | 14.3% (2/14) | 14.3% (2/14) | 14.3% (2/14) | 7.1% (1/14) | 14.3% (2/14) | 71.4% (10/14) | 57.1% (8/14) |
| Madhur Night | 17 | 29.4% (5/17) | 35.3% (6/17) | 11.8% (2/17) | 29.4% (5/17) | 29.4% (5/17) | 29.4% (5/17) | 35.3% (6/17) | 35.3% (6/17) | 64.7% (11/17) |
| Milan Night | 17 | 29.4% (5/17) | 41.2% (7/17) | 11.8% (2/17) | 5.9% (1/17) | 11.8% (2/17) | 29.4% (5/17) | 41.2% (7/17) | 88.2% (15/17) | 64.7% (11/17) |
| Rajdhani Night | 14 | 28.6% (4/14) | 35.7% (5/14) | 14.3% (2/14) | 28.6% (4/14) | 35.7% (5/14) | 21.4% (3/14) | 21.4% (3/14) | 85.7% (12/14) | 64.3% (9/14) |
| Main Bazar | 14 | 28.6% (4/14) | 21.4% (3/14) | 7.1% (1/14) | 14.3% (2/14) | 14.3% (2/14) | 14.3% (2/14) | 14.3% (2/14) | 71.4% (10/14) | 78.6% (11/14) |
| **ALL MARKETS** | 200 | 27.5% (55/200) | 31.0% (62/200) | 9.5% (19/200) | 19.5% (39/200) | 26.0% (52/200) | 20.0% (40/200) | 27.5% (55/200) | 63.0% (126/200) | 67.0% (134/200) |

## Combined two-digit results

| Market | Avoid open | Avoid close | Avoid gated open | Avoid gated close | Present open | Present close | Present gated open | Present gated close |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 65.0% (13/20) | 55.0% (11/20) | N/A | N/A | 5.0% (1/20) | 10.0% (2/20) | N/A | N/A |
| Time Bazar | 47.1% (8/17) | 47.1% (8/17) | N/A | N/A | 11.8% (2/17) | 0.0% (0/17) | N/A | N/A |
| Madhur Day | 40.0% (8/20) | 45.0% (9/20) | N/A | N/A | 5.0% (1/20) | 5.0% (1/20) | N/A | N/A |
| Milan Day | 52.9% (9/17) | 52.9% (9/17) | N/A | N/A | 0.0% (0/17) | 11.8% (2/17) | N/A | N/A |
| Rajdhani Day | 53.8% (7/13) | 46.2% (6/13) | N/A | N/A | 7.7% (1/13) | 0.0% (0/13) | N/A | N/A |
| Kalyan | 47.1% (8/17) | 58.8% (10/17) | N/A | N/A | 5.9% (1/17) | 11.8% (2/17) | N/A | N/A |
| Sridevi Night | 55.0% (11/20) | 45.0% (9/20) | N/A | N/A | 10.0% (2/20) | 5.0% (1/20) | N/A | N/A |
| Kalyan Night | 78.6% (11/14) | 50.0% (7/14) | N/A | N/A | 7.1% (1/14) | 0.0% (0/14) | N/A | N/A |
| Madhur Night | 58.8% (10/17) | 47.1% (8/17) | N/A | N/A | 5.9% (1/17) | 0.0% (0/17) | N/A | N/A |
| Milan Night | 35.3% (6/17) | 58.8% (10/17) | N/A | N/A | 0.0% (0/17) | 0.0% (0/17) | N/A | N/A |
| Rajdhani Night | 57.1% (8/14) | 35.7% (5/14) | N/A | N/A | 7.1% (1/14) | 0.0% (0/14) | N/A | N/A |
| Main Bazar | 71.4% (10/14) | 42.9% (6/14) | N/A | N/A | 7.1% (1/14) | 0.0% (0/14) | N/A | N/A |
| **ALL MARKETS** | 54.5% (109/200) | 49.0% (98/200) | N/A | N/A | 6.0% (12/200) | 4.0% (8/200) | N/A | N/A |

## Week 2026-07-11 to 2026-07-30

| Market | Draws | Open sutta @3 | Close sutta @3 | Jodi grid @9 | Open panel @40 | Close panel @40 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 20 | 25.0% (5/20) | 30.0% (6/20) | 10.0% (2/20) | 30.0% (6/20) | 30.0% (6/20) | 75.0% (15/20) | 75.0% (15/20) |
| Time Bazar | 17 | 35.3% (6/17) | 35.3% (6/17) | 17.6% (3/17) | 35.3% (6/17) | 35.3% (6/17) | 47.1% (8/17) | 82.4% (14/17) |
| Madhur Day | 20 | 40.0% (8/20) | 30.0% (6/20) | 10.0% (2/20) | 20.0% (4/20) | 30.0% (6/20) | 40.0% (8/20) | 60.0% (12/20) |
| Milan Day | 17 | 17.6% (3/17) | 35.3% (6/17) | 11.8% (2/17) | 35.3% (6/17) | 23.5% (4/17) | 70.6% (12/17) | 64.7% (11/17) |
| Rajdhani Day | 13 | 23.1% (3/13) | 7.7% (1/13) | 0.0% (0/13) | 15.4% (2/13) | 15.4% (2/13) | 53.8% (7/13) | 61.5% (8/13) |
| Kalyan | 17 | 17.6% (3/17) | 23.5% (4/17) | 0.0% (0/17) | 29.4% (5/17) | 29.4% (5/17) | 64.7% (11/17) | 82.4% (14/17) |
| Sridevi Night | 20 | 20.0% (4/20) | 40.0% (8/20) | 5.0% (1/20) | 35.0% (7/20) | 30.0% (6/20) | 60.0% (12/20) | 50.0% (10/20) |
| Kalyan Night | 14 | 35.7% (5/14) | 28.6% (4/14) | 14.3% (2/14) | 14.3% (2/14) | 14.3% (2/14) | 71.4% (10/14) | 57.1% (8/14) |
| Madhur Night | 17 | 29.4% (5/17) | 35.3% (6/17) | 11.8% (2/17) | 29.4% (5/17) | 35.3% (6/17) | 35.3% (6/17) | 64.7% (11/17) |
| Milan Night | 17 | 29.4% (5/17) | 41.2% (7/17) | 11.8% (2/17) | 11.8% (2/17) | 41.2% (7/17) | 88.2% (15/17) | 64.7% (11/17) |
| Rajdhani Night | 14 | 28.6% (4/14) | 35.7% (5/14) | 14.3% (2/14) | 35.7% (5/14) | 21.4% (3/14) | 85.7% (12/14) | 64.3% (9/14) |
| Main Bazar | 14 | 28.6% (4/14) | 21.4% (3/14) | 7.1% (1/14) | 14.3% (2/14) | 14.3% (2/14) | 71.4% (10/14) | 78.6% (11/14) |
| **ALL MARKETS** | 200 | 27.5% (55/200) | 31.0% (62/200) | 9.5% (19/200) | 26.0% (52/200) | 27.5% (55/200) | 63.0% (126/200) | 67.0% (134/200) |

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

| Market | Avoid open | Avoid close | Avoid gated | Present open | Present close | Present gated |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 65.0% (13/20) | 55.0% (11/20) | N/A / N/A | 5.0% (1/20) | 10.0% (2/20) | N/A / N/A |
| Time Bazar | 47.1% (8/17) | 47.1% (8/17) | N/A / N/A | 11.8% (2/17) | 0.0% (0/17) | N/A / N/A |
| Madhur Day | 40.0% (8/20) | 45.0% (9/20) | N/A / N/A | 5.0% (1/20) | 5.0% (1/20) | N/A / N/A |
| Milan Day | 52.9% (9/17) | 52.9% (9/17) | N/A / N/A | 0.0% (0/17) | 11.8% (2/17) | N/A / N/A |
| Rajdhani Day | 53.8% (7/13) | 46.2% (6/13) | N/A / N/A | 7.7% (1/13) | 0.0% (0/13) | N/A / N/A |
| Kalyan | 47.1% (8/17) | 58.8% (10/17) | N/A / N/A | 5.9% (1/17) | 11.8% (2/17) | N/A / N/A |
| Sridevi Night | 55.0% (11/20) | 45.0% (9/20) | N/A / N/A | 10.0% (2/20) | 5.0% (1/20) | N/A / N/A |
| Kalyan Night | 78.6% (11/14) | 50.0% (7/14) | N/A / N/A | 7.1% (1/14) | 0.0% (0/14) | N/A / N/A |
| Madhur Night | 58.8% (10/17) | 47.1% (8/17) | N/A / N/A | 5.9% (1/17) | 0.0% (0/17) | N/A / N/A |
| Milan Night | 35.3% (6/17) | 58.8% (10/17) | N/A / N/A | 0.0% (0/17) | 0.0% (0/17) | N/A / N/A |
| Rajdhani Night | 57.1% (8/14) | 35.7% (5/14) | N/A / N/A | 7.1% (1/14) | 0.0% (0/14) | N/A / N/A |
| Main Bazar | 71.4% (10/14) | 42.9% (6/14) | N/A / N/A | 7.1% (1/14) | 0.0% (0/14) | N/A / N/A |
| **ALL MARKETS** | 54.5% (109/200) | 49.0% (98/200) | N/A / N/A | 6.0% (12/200) | 4.0% (8/200) | N/A / N/A |

## Actual-result data coverage

| Market | Latest actual | Rows fetched |
| --- | --- | --- |
| Sridevi | 2026-08-01 | 847 |
| Time Bazar | 2026-08-01 | 710 |
| Madhur Day | 2026-08-01 | 827 |
| Milan Day | 2026-07-31 | 709 |
| Rajdhani Day | 2026-07-25 | 711 |
| Kalyan | 2026-07-31 | 711 |
| Sridevi Night | 2026-07-31 | 847 |
| Kalyan Night | 2026-07-31 | 588 |
| Madhur Night | 2026-07-31 | 710 |
| Milan Night | 2026-07-31 | 706 |
| Rajdhani Night | 2026-07-31 | 593 |
| Main Bazar | 2026-07-31 | 592 |

Primary actual-result source: [dpbossss.boston](https://dpbossss.boston/). The application's configured independent supplement was also requested, fail-soft, and its audit is preserved in the JSON report.

The machine-readable ledger contains every prediction, actual result, gate status, and hit/miss used in these tables: `2026-07-11-to-2026-07-30-production-backtest.json`.
