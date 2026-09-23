# Production prediction backtest: 2026-07-27 to 2026-07-30

Generated 2026-07-31T01:02:03.545Z. Model version: 1.0.9-above90. App version: 1.0.20.

## Method

- Test window: the explicitly requested date window 2026-07-27 through 2026-07-30.
- Walk-forward scoring: each draw is predicted using only records dated before that draw. No tested result or later result is included in its training history.
- Production defaults: Top 6 Open suttas, Top 6 Close suttas, their 36 Jodis, and Top 60 Open/Close panels. Top-30 panel accuracy is included in the combined summary.
- SP/DP is an exact kind classification. The app treats triple panels as SP because only SP and DP are modeled.
- Digit candidates are scored even when their UI gate says "No safe call" or "Research only"; gated results are reported separately and may have zero coverage.
- Accuracy is a hit rate per eligible completed result, not a claim of profitability. Different prediction sets have very different coverage sizes.

## Requested-window results by market

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @30 | Open panel @60 | Close panel @30 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 4 | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 25.0% (1/4) | 75.0% (3/4) | 25.0% (1/4) | 50.0% (2/4) | 50.0% (2/4) | 75.0% (3/4) |
| Time Bazar | 4 | 50.0% (2/4) | 25.0% (1/4) | 25.0% (1/4) | 50.0% (2/4) | 50.0% (2/4) | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 75.0% (3/4) |
| Madhur Day | 4 | 75.0% (3/4) | 50.0% (2/4) | 50.0% (2/4) | 0.0% (0/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) |
| Milan Day | 4 | 0.0% (0/4) | 75.0% (3/4) | 0.0% (0/4) | 0.0% (0/4) | 25.0% (1/4) | 0.0% (0/4) | 25.0% (1/4) | 75.0% (3/4) | 75.0% (3/4) |
| Rajdhani Day | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Kalyan | 4 | 50.0% (2/4) | 75.0% (3/4) | 50.0% (2/4) | 0.0% (0/4) | 25.0% (1/4) | 0.0% (0/4) | 0.0% (0/4) | 50.0% (2/4) | 75.0% (3/4) |
| Sridevi Night | 4 | 25.0% (1/4) | 50.0% (2/4) | 0.0% (0/4) | 0.0% (0/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) | 100.0% (4/4) | 50.0% (2/4) |
| Kalyan Night | 4 | 50.0% (2/4) | 75.0% (3/4) | 25.0% (1/4) | 25.0% (1/4) | 50.0% (2/4) | 0.0% (0/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) |
| Madhur Night | 4 | 75.0% (3/4) | 50.0% (2/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) | 0.0% (0/4) | 0.0% (0/4) | 25.0% (1/4) | 100.0% (4/4) |
| Milan Night | 4 | 50.0% (2/4) | 75.0% (3/4) | 25.0% (1/4) | 25.0% (1/4) | 50.0% (2/4) | 50.0% (2/4) | 50.0% (2/4) | 100.0% (4/4) | 75.0% (3/4) |
| Rajdhani Night | 4 | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) | 0.0% (0/4) | 0.0% (0/4) | 75.0% (3/4) | 50.0% (2/4) |
| Main Bazar | 4 | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 0.0% (0/4) | 0.0% (0/4) | 0.0% (0/4) | 75.0% (3/4) | 75.0% (3/4) | 75.0% (3/4) |
| **ALL MARKETS** | 44 | 52.3% (23/44) | 61.4% (27/44) | 29.5% (13/44) | 15.9% (7/44) | 38.6% (17/44) | 18.2% (8/44) | 36.4% (16/44) | 59.1% (26/44) | 65.9% (29/44) |

## Combined two-digit results

| Market | Avoid open | Avoid close | Avoid gated open | Avoid gated close | Present open | Present close | Present gated open | Present gated close |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 50.0% (2/4) | 50.0% (2/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Time Bazar | 75.0% (3/4) | 25.0% (1/4) | N/A | N/A | 50.0% (2/4) | 0.0% (0/4) | N/A | N/A |
| Madhur Day | 0.0% (0/4) | 75.0% (3/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Milan Day | 50.0% (2/4) | 50.0% (2/4) | N/A | N/A | 0.0% (0/4) | 25.0% (1/4) | N/A | N/A |
| Rajdhani Day | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Kalyan | 25.0% (1/4) | 75.0% (3/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Sridevi Night | 50.0% (2/4) | 50.0% (2/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Kalyan Night | 100.0% (4/4) | 50.0% (2/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Madhur Night | 25.0% (1/4) | 25.0% (1/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Milan Night | 50.0% (2/4) | 25.0% (1/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Rajdhani Night | 50.0% (2/4) | 25.0% (1/4) | N/A | N/A | 0.0% (0/4) | 0.0% (0/4) | N/A | N/A |
| Main Bazar | 50.0% (2/4) | 100.0% (4/4) | N/A | N/A | 25.0% (1/4) | 0.0% (0/4) | N/A | N/A |
| **ALL MARKETS** | 47.7% (21/44) | 50.0% (22/44) | N/A | N/A | 6.8% (3/44) | 2.3% (1/44) | N/A | N/A |

## Week 2026-07-27 to 2026-07-30

| Market | Draws | Open sutta @6 | Close sutta @6 | Jodi @36 | Open panel @60 | Close panel @60 | Open SP/DP | Close SP/DP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 4 | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 75.0% (3/4) | 50.0% (2/4) | 50.0% (2/4) | 75.0% (3/4) |
| Time Bazar | 4 | 50.0% (2/4) | 25.0% (1/4) | 25.0% (1/4) | 50.0% (2/4) | 75.0% (3/4) | 50.0% (2/4) | 75.0% (3/4) |
| Madhur Day | 4 | 75.0% (3/4) | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) | 25.0% (1/4) |
| Milan Day | 4 | 0.0% (0/4) | 75.0% (3/4) | 0.0% (0/4) | 25.0% (1/4) | 25.0% (1/4) | 75.0% (3/4) | 75.0% (3/4) |
| Rajdhani Day | 0 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Kalyan | 4 | 50.0% (2/4) | 75.0% (3/4) | 50.0% (2/4) | 25.0% (1/4) | 0.0% (0/4) | 50.0% (2/4) | 75.0% (3/4) |
| Sridevi Night | 4 | 25.0% (1/4) | 50.0% (2/4) | 0.0% (0/4) | 50.0% (2/4) | 50.0% (2/4) | 100.0% (4/4) | 50.0% (2/4) |
| Kalyan Night | 4 | 50.0% (2/4) | 75.0% (3/4) | 25.0% (1/4) | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 50.0% (2/4) |
| Madhur Night | 4 | 75.0% (3/4) | 50.0% (2/4) | 25.0% (1/4) | 25.0% (1/4) | 0.0% (0/4) | 25.0% (1/4) | 100.0% (4/4) |
| Milan Night | 4 | 50.0% (2/4) | 75.0% (3/4) | 25.0% (1/4) | 50.0% (2/4) | 50.0% (2/4) | 100.0% (4/4) | 75.0% (3/4) |
| Rajdhani Night | 4 | 75.0% (3/4) | 75.0% (3/4) | 50.0% (2/4) | 50.0% (2/4) | 0.0% (0/4) | 75.0% (3/4) | 50.0% (2/4) |
| Main Bazar | 4 | 50.0% (2/4) | 50.0% (2/4) | 25.0% (1/4) | 0.0% (0/4) | 75.0% (3/4) | 75.0% (3/4) | 75.0% (3/4) |
| **ALL MARKETS** | 44 | 52.3% (23/44) | 61.4% (27/44) | 29.5% (13/44) | 38.6% (17/44) | 36.4% (16/44) | 59.1% (26/44) | 65.9% (29/44) |

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

| Market | Avoid open | Avoid close | Avoid gated | Present open | Present close | Present gated |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 50.0% (2/4) | 50.0% (2/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Time Bazar | 75.0% (3/4) | 25.0% (1/4) | N/A / N/A | 50.0% (2/4) | 0.0% (0/4) | N/A / N/A |
| Madhur Day | 0.0% (0/4) | 75.0% (3/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Milan Day | 50.0% (2/4) | 50.0% (2/4) | N/A / N/A | 0.0% (0/4) | 25.0% (1/4) | N/A / N/A |
| Rajdhani Day | N/A | N/A | N/A / N/A | N/A | N/A | N/A / N/A |
| Kalyan | 25.0% (1/4) | 75.0% (3/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Sridevi Night | 50.0% (2/4) | 50.0% (2/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Kalyan Night | 100.0% (4/4) | 50.0% (2/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Madhur Night | 25.0% (1/4) | 25.0% (1/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Milan Night | 50.0% (2/4) | 25.0% (1/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Rajdhani Night | 50.0% (2/4) | 25.0% (1/4) | N/A / N/A | 0.0% (0/4) | 0.0% (0/4) | N/A / N/A |
| Main Bazar | 50.0% (2/4) | 100.0% (4/4) | N/A / N/A | 25.0% (1/4) | 0.0% (0/4) | N/A / N/A |
| **ALL MARKETS** | 47.7% (21/44) | 50.0% (22/44) | N/A / N/A | 6.8% (3/44) | 2.3% (1/44) | N/A / N/A |

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

Primary actual-result source: [dpbossss.boston](https://dpbossss.boston/). The application's configured independent supplement was also requested, fail-soft, and its audit is preserved in the JSON report.

The machine-readable ledger contains every prediction, actual result, gate status, and hit/miss used in these tables: `2026-07-27-to-2026-07-30-production-backtest.json`.
