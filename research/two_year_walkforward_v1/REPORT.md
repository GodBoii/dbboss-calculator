# Two-year walk-forward results

Permitted outcomes: 2024-10-09 through 2026-10-08. Generated 2026-10-09T01:41:30.416Z. Saved 5119 market-day predictions for production and eight causal challengers.

No outcome before the fixed cutoff enters this study. Every ordinary prediction uses strictly earlier dates, including all pooled inputs. CloseLive additionally receives the target Open panel and never its Close. Initial 180 complete draws per market are warmup. All rankings use Top-6 Sutta, Top-10 panels and a 36-pair Cartesian Jodi grid.

Selection: 2025-10-09 through 2026-04-08. Confirmation: 2026-04-09 through 2026-10-08. One candidate per task was chosen on selection only. The selection criterion for DP is Brier loss, not alert accuracy. TP is not counted as DP.

Production is the fixed current-code comparator, not a historical deployment reconstruction. Its rules and calibration were previously chosen from other data, and panel weights were fit through July 2, 2026. Only challenger training is guaranteed to use exclusively permitted, prior outcomes. Earlier research inspected overlapping dates. Confidence intervals here are retrospective and are not corrected for multiple task comparisons.

## Source coverage

| Market | Complete draws | First | Latest | First scored target | Targets |
| --- | --- | --- | --- | --- | --- |
| Sridevi | 724 | 2024-10-09 | 2026-10-08 | 2025-04-09 | 544 |
| Time Bazar | 604 | 2024-10-09 | 2026-10-08 | 2025-05-17 | 424 |
| Madhur Day | 700 | 2024-10-09 | 2026-10-04 | 2025-04-19 | 520 |
| Rajdhani Day | 602 | 2024-10-09 | 2026-10-03 | 2025-05-17 | 422 |
| Milan Day | 604 | 2024-10-09 | 2026-10-08 | 2025-05-17 | 424 |
| Kalyan | 606 | 2024-10-09 | 2026-10-08 | 2025-05-17 | 426 |
| Sridevi Night | 724 | 2024-10-09 | 2026-10-08 | 2025-04-09 | 544 |
| Madhur Night | 602 | 2024-10-09 | 2026-10-03 | 2025-05-17 | 422 |
| Milan Night | 601 | 2024-10-09 | 2026-10-08 | 2025-05-17 | 421 |
| Rajdhani Night | 506 | 2024-10-09 | 2026-10-08 | 2025-06-30 | 326 |
| Kalyan Night | 501 | 2024-10-09 | 2026-10-08 | 2025-06-30 | 321 |
| Main Bazar | 505 | 2024-10-09 | 2026-10-08 | 2025-06-30 | 325 |

Source hash: 7592f4b19d1135f717911a770aab6c582a733c0cbf33b2804db26b73f0d9a63c. Missing or incomplete draws are excluded, not filled. Latest source date is shown per market; the end of the requested window does not imply complete source coverage.

## Confirmation, 1856 market-days

| Task | Frozen candidate | Production | Candidate | Lift / Brier reduction | 95% date interval |
| --- | --- | --- | --- | --- | --- |
| openPanel | frequency_all | 6.95% | 5.77% | -1.19 pp | -2.63 pp to 0.27 pp |
| openSutta | decay_45 | 62.45% | 60.51% | -1.94 pp | -4.49 pp to 0.72 pp |
| openAvoid | frequency_180 | 51.72% | 51.72% | 0.00 pp | -2.42 pp to 2.52 pp |
| openDpBrier | pooled_50 | 0.1975 | 0.1946 | 0.0030 | 0.0003 to 0.0057 |
| closePanel | frequency_90 | 6.84% | 5.55% | -1.29 pp | -2.53 pp to -0.11 pp |
| closeSutta | pooled_50 | 62.50% | 59.21% | -3.29 pp | -6.57 pp to 0.05 pp |
| closeAvoid | pooled_50 | 49.35% | 50.05% | 0.70 pp | -1.83 pp to 3.11 pp |
| closeDpBrier | pooled_50 | 0.1849 | 0.1846 | 0.0004 | -0.0021 to 0.0028 |
| closeLivePanel | pooled_50 | 6.36% | 6.25% | -0.11 pp | -1.65 pp to 1.40 pp |
| closeLiveSutta | frequency_90 | 62.50% | 59.11% | -3.39 pp | -6.54 pp to -0.17 pp |
| jodi | pooled_50 | 38.09% | 36.10% | -1.99 pp | -5.07 pp to 1.22 pp |

## After panel-weight training, 984 market-days

| Task | Frozen candidate | Production | Candidate | Lift / Brier reduction | 95% date interval |
| --- | --- | --- | --- | --- | --- |
| openPanel | frequency_all | 7.01% | 6.00% | -1.02 pp | -3.16 pp to 1.10 pp |
| openSutta | decay_45 | 60.77% | 59.65% | -1.12 pp | -4.67 pp to 2.51 pp |
| openAvoid | frequency_180 | 52.34% | 51.52% | -0.81 pp | -4.22 pp to 2.58 pp |
| openDpBrier | pooled_50 | 0.1917 | 0.1863 | 0.0053 | 0.0019 to 0.0087 |
| closePanel | frequency_90 | 5.59% | 5.18% | -0.41 pp | -1.91 pp to 1.19 pp |
| closeSutta | pooled_50 | 61.89% | 59.15% | -2.74 pp | -7.43 pp to 2.28 pp |
| closeAvoid | pooled_50 | 47.66% | 48.68% | 1.02 pp | -2.21 pp to 4.27 pp |
| closeDpBrier | pooled_50 | 0.1850 | 0.1848 | 0.0002 | -0.0029 to 0.0033 |
| closeLivePanel | pooled_50 | 5.79% | 5.49% | -0.30 pp | -2.15 pp to 1.58 pp |
| closeLiveSutta | frequency_90 | 61.89% | 58.94% | -2.95 pp | -7.27 pp to 1.46 pp |
| jodi | pooled_50 | 36.28% | 37.30% | 1.02 pp | -3.56 pp to 5.69 pp |

## Last 30 calendar days, 297 market-days

| Task | Frozen candidate | Production | Candidate | Lift / Brier reduction | 95% date interval |
| --- | --- | --- | --- | --- | --- |
| openPanel | frequency_all | 6.40% | 6.73% | 0.34 pp | -3.00 pp to 4.00 pp |
| openSutta | decay_45 | 58.25% | 56.23% | -2.02 pp | -9.63 pp to 5.56 pp |
| openAvoid | frequency_180 | 49.16% | 53.87% | 4.71 pp | -1.40 pp to 11.01 pp |
| openDpBrier | pooled_50 | 0.1941 | 0.1906 | 0.0036 | -0.0030 to 0.0097 |
| closePanel | frequency_90 | 5.72% | 6.73% | 1.01 pp | -1.74 pp to 3.74 pp |
| closeSutta | pooled_50 | 61.28% | 53.87% | -7.41 pp | -15.60 pp to 2.03 pp |
| closeAvoid | pooled_50 | 47.81% | 50.51% | 2.69 pp | -3.67 pp to 9.16 pp |
| closeDpBrier | pooled_50 | 0.1730 | 0.1748 | -0.0018 | -0.0076 to 0.0038 |
| closeLivePanel | pooled_50 | 6.73% | 5.72% | -1.01 pp | -4.72 pp to 3.03 pp |
| closeLiveSutta | frequency_90 | 61.28% | 60.94% | -0.34 pp | -7.09 pp to 6.80 pp |
| jodi | pooled_50 | 35.35% | 36.03% | 0.67 pp | -7.99 pp to 9.84 pp |

## Last 90 calendar days, 900 market-days

| Task | Frozen candidate | Production | Candidate | Lift / Brier reduction | 95% date interval |
| --- | --- | --- | --- | --- | --- |
| openPanel | frequency_all | 7.11% | 5.89% | -1.22 pp | -3.52 pp to 1.00 pp |
| openSutta | decay_45 | 60.44% | 59.33% | -1.11 pp | -4.92 pp to 2.68 pp |
| openAvoid | frequency_180 | 52.33% | 51.56% | -0.78 pp | -4.27 pp to 2.88 pp |
| openDpBrier | pooled_50 | 0.1906 | 0.1853 | 0.0052 | 0.0013 to 0.0091 |
| closePanel | frequency_90 | 5.56% | 4.56% | -1.00 pp | -2.53 pp to 0.55 pp |
| closeSutta | pooled_50 | 62.22% | 58.89% | -3.33 pp | -8.00 pp to 1.80 pp |
| closeAvoid | pooled_50 | 47.44% | 48.56% | 1.11 pp | -2.40 pp to 4.54 pp |
| closeDpBrier | pooled_50 | 0.1861 | 0.1857 | 0.0003 | -0.0030 to 0.0036 |
| closeLivePanel | pooled_50 | 5.44% | 5.44% | 0.00 pp | -1.94 pp to 2.03 pp |
| closeLiveSutta | frequency_90 | 62.22% | 58.33% | -3.89 pp | -8.39 pp to 0.81 pp |
| jodi | pooled_50 | 36.33% | 36.56% | 0.22 pp | -4.47 pp to 4.93 pp |

## Last 365 calendar days, 3637 market-days

| Task | Frozen candidate | Production | Candidate | Lift / Brier reduction | 95% date interval |
| --- | --- | --- | --- | --- | --- |
| openPanel | frequency_all | 7.01% | 5.88% | -1.13 pp | -2.17 pp to -0.03 pp |
| openSutta | decay_45 | 63.07% | 60.71% | -2.36 pp | -4.21 pp to -0.41 pp |
| openAvoid | frequency_180 | 51.61% | 52.68% | 1.07 pp | -0.66 pp to 2.81 pp |
| openDpBrier | pooled_50 | 0.1984 | 0.1957 | 0.0027 | 0.0007 to 0.0046 |
| closePanel | frequency_90 | 6.68% | 5.77% | -0.91 pp | -1.81 pp to 0.05 pp |
| closeSutta | pooled_50 | 62.50% | 60.32% | -2.17 pp | -4.49 pp to 0.08 pp |
| closeAvoid | pooled_50 | 50.26% | 50.43% | 0.16 pp | -1.68 pp to 1.91 pp |
| closeDpBrier | pooled_50 | 0.1834 | 0.1817 | 0.0016 | -0.0003 to 0.0036 |
| closeLivePanel | pooled_50 | 6.49% | 6.27% | -0.22 pp | -1.29 pp to 0.87 pp |
| closeLiveSutta | frequency_90 | 62.50% | 60.74% | -1.76 pp | -3.90 pp to 0.34 pp |
| jodi | pooled_50 | 39.48% | 36.07% | -3.41 pp | -5.71 pp to -1.14 pp |

## Confirmation by market

| Market | N | Open panel production / candidate | Close panel production / candidate | Open Sutta production / candidate | Close Sutta production / candidate | Jodi production / candidate |
| --- | --- | --- | --- | --- | --- | --- |
| Sridevi | 182 | 7.14% / 7.14% | 5.49% / 4.40% | 60.99% / 58.24% | 61.54% / 65.93% | 34.62% / 41.76% |
| Time Bazar | 155 | 3.87% / 5.16% | 9.68% / 5.16% | 54.19% / 64.52% | 53.55% / 60.00% | 27.74% / 35.48% |
| Madhur Day | 178 | 6.18% / 7.87% | 7.30% / 4.49% | 62.36% / 60.11% | 69.10% / 66.29% | 43.82% / 39.33% |
| Rajdhani Day | 152 | 9.21% / 5.92% | 9.21% / 6.58% | 67.11% / 63.82% | 71.05% / 57.89% | 46.71% / 32.24% |
| Milan Day | 155 | 5.81% / 1.29% | 3.87% / 2.58% | 61.29% / 58.06% | 60.65% / 52.26% | 36.13% / 35.48% |
| Kalyan | 156 | 10.26% / 7.69% | 6.41% / 4.49% | 60.90% / 64.10% | 58.97% / 58.97% | 34.62% / 38.46% |
| Sridevi Night | 182 | 5.49% / 4.95% | 6.59% / 7.69% | 66.48% / 62.09% | 59.34% / 64.29% | 39.01% / 40.11% |
| Madhur Night | 152 | 1.97% / 5.92% | 10.53% / 6.58% | 56.58% / 52.63% | 65.79% / 56.58% | 38.16% / 32.89% |
| Milan Night | 155 | 9.03% / 7.74% | 5.81% / 8.39% | 67.10% / 58.71% | 67.10% / 54.19% | 41.29% / 30.32% |
| Rajdhani Night | 131 | 7.63% / 4.58% | 8.40% / 6.87% | 64.12% / 64.12% | 71.76% / 57.25% | 48.09% / 32.06% |
| Kalyan Night | 128 | 6.25% / 4.69% | 5.47% / 7.03% | 64.06% / 61.72% | 53.91% / 60.94% | 32.03% / 39.06% |
| Main Bazar | 130 | 11.54% / 5.38% | 3.08% / 2.31% | 64.62% / 58.46% | 56.15% / 51.54% | 34.62% / 33.08% |

## Panel errors by actual kind

| Side | Model | SP hits / draws | DP hits / draws | TP hits / draws | Panel misses despite Sutta hit |
| --- | --- | --- | --- | --- | --- |
| open | production | 129/1357 | 0/493 | 0/6 | 1032/1727 |
| open | frequency_all | 107/1357 | 0/493 | 0/6 | 1017/1749 |
| close | production | 122/1399 | 5/450 | 0/7 | 1072/1729 |
| close | frequency_90 | 96/1399 | 7/450 | 0/7 | 1008/1753 |

## Interpretation

A confidence interval above zero identifies a candidate worth further review, not an automatic deployment. Check month and market stability, source completeness, multiple comparisons, and the post-training panel comparison. Recent and annual windows overlap selection or confirmation and do not independently validate the winner. See results.json for all candidate scores, monthly comparisons, DP precision/coverage, and probability calibration bins.

## Reproduce

`node scripts/two-year-walkforward.cjs` refreshes validated sources and replays. `--snapshot` uses only the frozen source; `--analyze-only` recomputes summaries from predictions.jsonl.gz. `node --test scripts/verify-two-year-walkforward.cjs` checks date exclusion, causal invariants, selection isolation and scoring.

The gzip ledger contains one JSON record per market-day with actuals, history boundaries, every model prediction and every scored task. Decompress with Node zlib.gunzipSync to inspect or analyze. Production rankings remain unchanged.
