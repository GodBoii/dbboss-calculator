# V2 50-panel walk-forward backtest

App 1.0.29 replayed 9,272 completed draws across 13 enabled markets from 26 July 2024 through 26 November 2026 (IST). The date range is the app’s 28-month history horizon as of the audit date. Earlier results supplied prior history where available.

## Combined Open and Close accuracy

| Market | First scored date | Last scored date | Open hit rate | Close hit rate |
| --- | --- | --- | ---: | ---: |
| Sridevi | 2024-07-26 | 2026-11-26 | 30.34% (257/847) | 25.15% (213/847) |
| Time Bazar | 2024-07-26 | 2026-11-26 | 24.71% (173/700) | 25.57% (179/700) |
| Madhur Day | 2024-07-26 | 2026-11-26 | 26.13% (213/815) | 26.99% (220/815) |
| Milan Day | 2024-07-26 | 2026-11-26 | 25.14% (176/700) | 25.00% (175/700) |
| Rajdhani Day | 2024-07-26 | 2026-11-21 | 27.32% (191/699) | 28.33% (198/699) |
| Supreme Day | 2024-07-26 | 2026-11-26 | 22.43% (190/847) | 25.62% (217/847) |
| Kalyan | 2024-07-26 | 2026-11-26 | 27.45% (193/703) | 26.32% (185/703) |
| Sridevi Night | 2024-07-26 | 2026-11-25 | 26.00% (220/846) | 23.52% (199/846) |
| Kalyan Night | 2024-07-26 | 2026-11-25 | 27.54% (160/581) | 22.38% (130/581) |
| Madhur Night | 2024-07-27 | 2026-10-10 | 26.99% (180/667) | 28.19% (188/667) |
| Milan Night | 2024-07-26 | 2026-11-25 | 25.43% (177/696) | 25.72% (179/696) |
| Rajdhani Night | 2024-07-26 | 2026-11-25 | 28.33% (166/586) | 30.20% (177/586) |
| Main Bazar | 2024-07-26 | 2026-11-25 | 23.25% (136/585) | 24.44% (143/585) |
| Supreme Night | — | — | Unavailable | Unavailable |
| **Overall** | **2024-07-26** | **2026-11-26** | **26.23% (2432/9272)** | **25.92% (2403/9272)** |

## Accuracy by actual panel type

SP and DP percentages use only draws with that actual type on the applicable side. Triple panels always miss the 50-pick list and remain in the combined denominator.

| Market | Open SP (30) | Open DP (20) | Open triples | Close SP (30) | Close DP (20) | Close triples |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 31.05% (204/657) | 27.89% (53/190) | 0 | 25.90% (172/664) | 22.65% (41/181) | 2 |
| Time Bazar | 24.80% (127/512) | 24.86% (46/185) | 3 | 26.98% (136/504) | 22.16% (43/194) | 2 |
| Madhur Day | 26.52% (148/558) | 25.59% (65/254) | 3 | 28.01% (172/614) | 24.37% (48/197) | 4 |
| Milan Day | 25.54% (131/513) | 24.59% (45/183) | 4 | 27.12% (131/483) | 20.56% (44/214) | 3 |
| Rajdhani Day | 29.71% (153/515) | 20.65% (38/184) | 0 | 30.04% (164/546) | 22.22% (34/153) | 0 |
| Supreme Day | 23.33% (143/613) | 20.09% (47/234) | 0 | 25.73% (167/649) | 25.25% (50/198) | 0 |
| Kalyan | 28.14% (150/533) | 25.44% (43/169) | 1 | 26.61% (145/545) | 25.32% (40/158) | 0 |
| Sridevi Night | 25.50% (153/600) | 27.35% (67/245) | 1 | 24.40% (163/668) | 20.34% (36/177) | 1 |
| Kalyan Night | 25.89% (109/421) | 31.88% (51/160) | 0 | 22.99% (103/448) | 20.30% (27/133) | 0 |
| Madhur Night | 26.99% (132/489) | 27.12% (48/177) | 1 | 29.92% (152/508) | 22.78% (36/158) | 1 |
| Milan Night | 26.15% (142/543) | 23.18% (35/151) | 2 | 27.04% (149/551) | 21.13% (30/142) | 3 |
| Rajdhani Night | 28.64% (122/426) | 27.50% (44/160) | 0 | 32.20% (142/441) | 24.14% (35/145) | 0 |
| Main Bazar | 22.36% (93/416) | 25.60% (43/168) | 1 | 25.47% (109/428) | 22.22% (34/153) | 4 |
| **Overall** | 26.59% (1807/6796) | 25.41% (625/2460) | 16 | 27.03% (1905/7049) | 22.61% (498/2203) | 20 |

## Draws after the current app release

This slice starts 4 November 2026, the calendar day after the current release. Individual market samples are small. Older scores can include draws used for model fitting or policy selection.

| Market | Open hit rate | Close hit rate |
| --- | ---: | ---: |
| Sridevi | 34.78% (8/23) | 21.74% (5/23) |
| Time Bazar | 41.67% (5/12) | 16.67% (2/12) |
| Madhur Day | 30.77% (4/13) | 23.08% (3/13) |
| Milan Day | 0.00% (0/12) | 33.33% (4/12) |
| Rajdhani Day | 25.00% (2/8) | 12.50% (1/8) |
| Supreme Day | 30.43% (7/23) | 17.39% (4/23) |
| Kalyan | 41.67% (5/12) | 8.33% (1/12) |
| Sridevi Night | 22.73% (5/22) | 22.73% (5/22) |
| Kalyan Night | 10.00% (1/10) | 50.00% (5/10) |
| Madhur Night | — | — |
| Milan Night | 18.18% (2/11) | 27.27% (3/11) |
| Rajdhani Night | 30.00% (3/10) | 20.00% (2/10) |
| Main Bazar | 20.00% (2/10) | 10.00% (1/10) |
| **Overall** | 26.51% (44/166) | 21.69% (36/166) |

## Replay and data coverage

- The replay called V2’s production ranking pipeline for the target IST date. Each call received only complete legal draws dated strictly earlier than its target from the selected market and the app’s 12-market pool. The model applied its 28-calendar-month limit and 180-draw minimum. Open and Close were both forecast before Open.
- For each side, a hit means the actual three-digit panel appeared anywhere in the union of the 30 SP and 20 DP picks. Each completed draw contributed one attempt per side. The overall rate pools all scored draws.
- Preferred charts supplied the outcomes. Overlap with tracked archives and fixtures agreed on every completed panel pair used in the source audit. The app’s existing independent-feed identity check admitted 35 additional completed draws from 23–26 November. [Preferred chart registry](../../src/lib/analysis-markets.ts) and [supplement identity check](../../src/lib/panel-history-supplement.ts).
- Madhur Night’s preferred chart ended on 10 October 2026. Its independent feed matched 34 of 37 overlapping dates and failed the app’s identity check. Rajdhani Day’s preferred chart ended on 21 November 2026. Each market’s last scored date is shown in the main table.
- Supreme Night remains disabled in the app. The preferred chart stopped on 18 October, and the alternate disagreed on 40 of 48 overlapping complete dates from 1 September. [Preferred Supreme Night chart](https://dpboss.tax/panel-chart-record/supreme-night.php) and [alternate Supreme Night chart](https://dpbosss.net.in/supreme-night-panel-chart.php).
- Only completed, validated chart rows were eligible. Days without a complete result and dates rejected for inconsistent chart data are outside the denominator. Every validated completed draw inside the target window met V2 input requirements.
- Results use the current policy and retrospective chart snapshots. The model inputs for each forecast stop before the target date. The older rows are historical replays of this release.
- A read-only replay optimization cached deterministic lookups and reused the same weight iteration. All four shortlist outputs and hit flags matched the unchanged runtime on 79 cross-market control draws and 25 additional Kalyan control draws. The model source revision was 9a76bae01c162526198ac64b5584abf56651c219.

The [daily forecast ledger](v2-panel-50-daily.csv) records the predicted shortlists, actual panel types and hit flags for every scored date. Individual outcomes are withheld.

Ledger SHA-256 with LF line endings `0fc1191eeb50c7120c7c1825a6b933b2d605ab45a4fc7ab1b7d541a3edaeed9e`.
