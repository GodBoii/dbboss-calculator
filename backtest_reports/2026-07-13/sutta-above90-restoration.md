# Above-90 Sutta Model Restoration

Generated: 2026-07-13

## Restored model

The application now identifies the frozen Sutta model separately from the app release as `1.0.9-above90`.
The production Sutta ranking uses the original scorer input from the July 11 model. Later panel-profile research is exposed only through the panel-pick UI and can no longer silently rerank Sutta inputs.

The production model was extracted from the UI component into `src/lib/sutta-model/production.ts`. The Bet Copy desk was extracted into `src/components/analysis/BetCopyDesk.tsx`. `AnalysisTabs.tsx` now contains only the analysis-tab UI and compatibility re-exports.

## Historical reproduction

Using the current historical cache on the 309 researched-window rows, the restored model scores:

| Window | Open | Close | Jodi |
| --- | ---: | ---: | ---: |
| July 11 researched window | 280/309 (90.6%) | 280/309 (90.6%) | 255/309 (82.5%) |

The published report recorded 279 Close hits; the refreshed historical cache produces one additional Close hit. The old cache was mutable and was not content-addressed, so ranking-order drift is reported instead of hidden.

The user-supplied 72-row table is not an exact saved result. Eleven markets match the tracked artifact, but the tracked Sridevi row is 7/7 Open, 7/7 Close, and 7/7 Jodi. The reproducible saved totals are 70/72 Open, 66/72 Close, and 65/72 Jodi, not 67/72, 66/72, and 62/72.

## Fresh trailing-window results

All three ledgers use model `1.0.9-above90` and source-cache SHA-256 `5e7886bbc57159f7b05e0b8c28b981dda389dae020682eed5269614e4d350ffa`.

| Window | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Last 7 calendar days | 72 | 38/72 (52.8%) | 43/72 (59.7%) | 21/72 (29.2%) |
| Last 30 calendar days | 309 | 251/309 (81.2%) | 261/309 (84.5%) | 219/309 (70.9%) |
| Last 90 calendar days | 929 | 658/929 (70.8%) | 687/929 (74.0%) | 499/929 (53.7%) |

### Last 7 days by market

| Market | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 7 | 4/7 (57.1%) | 4/7 (57.1%) | 2/7 (28.6%) |
| Time Bazar | 6 | 4/6 (66.7%) | 5/6 (83.3%) | 3/6 (50.0%) |
| Madhur Day | 7 | 4/7 (57.1%) | 6/7 (85.7%) | 3/7 (42.9%) |
| Milan Day | 6 | 2/6 (33.3%) | 4/6 (66.7%) | 2/6 (33.3%) |
| Rajdhani Day | 6 | 4/6 (66.7%) | 4/6 (66.7%) | 3/6 (50.0%) |
| Kalyan | 6 | 3/6 (50.0%) | 4/6 (66.7%) | 1/6 (16.7%) |
| Sridevi Night | 7 | 4/7 (57.1%) | 3/7 (42.9%) | 2/7 (28.6%) |
| Kalyan Night | 5 | 3/5 (60.0%) | 3/5 (60.0%) | 2/5 (40.0%) |
| Madhur Night | 6 | 0/6 (0.0%) | 3/6 (50.0%) | 0/6 (0.0%) |
| Milan Night | 6 | 4/6 (66.7%) | 3/6 (50.0%) | 2/6 (33.3%) |
| Rajdhani Night | 5 | 4/5 (80.0%) | 2/5 (40.0%) | 1/5 (20.0%) |
| Main Bazar | 5 | 2/5 (40.0%) | 2/5 (40.0%) | 0/5 (0.0%) |

### Last 30 days by market

| Market | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 30 | 23/30 (76.7%) | 27/30 (90.0%) | 21/30 (70.0%) |
| Time Bazar | 26 | 21/26 (80.8%) | 25/26 (96.2%) | 20/26 (76.9%) |
| Madhur Day | 30 | 23/30 (76.7%) | 26/30 (86.7%) | 20/30 (66.7%) |
| Milan Day | 26 | 19/26 (73.1%) | 23/26 (88.5%) | 19/26 (73.1%) |
| Rajdhani Day | 26 | 24/26 (92.3%) | 22/26 (84.6%) | 21/26 (80.8%) |
| Kalyan | 26 | 22/26 (84.6%) | 20/26 (76.9%) | 16/26 (61.5%) |
| Sridevi Night | 30 | 26/30 (86.7%) | 24/30 (80.0%) | 22/30 (73.3%) |
| Kalyan Night | 19 | 16/19 (84.2%) | 15/19 (78.9%) | 13/19 (68.4%) |
| Madhur Night | 26 | 19/26 (73.1%) | 20/26 (76.9%) | 17/26 (65.4%) |
| Milan Night | 26 | 21/26 (80.8%) | 23/26 (88.5%) | 19/26 (73.1%) |
| Rajdhani Night | 22 | 19/22 (86.4%) | 17/22 (77.3%) | 15/22 (68.2%) |
| Main Bazar | 22 | 18/22 (81.8%) | 19/22 (86.4%) | 16/22 (72.7%) |

### Last 90 days by market

| Market | Draws | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 90 | 64/90 (71.1%) | 64/90 (71.1%) | 47/90 (52.2%) |
| Time Bazar | 78 | 57/78 (73.1%) | 56/78 (71.8%) | 41/78 (52.6%) |
| Madhur Day | 90 | 67/90 (74.4%) | 71/90 (78.9%) | 55/90 (61.1%) |
| Milan Day | 78 | 52/78 (66.7%) | 58/78 (74.4%) | 41/78 (52.6%) |
| Rajdhani Day | 78 | 60/78 (76.9%) | 61/78 (78.2%) | 49/78 (62.8%) |
| Kalyan | 78 | 60/78 (76.9%) | 61/78 (78.2%) | 47/78 (60.3%) |
| Sridevi Night | 90 | 66/90 (73.3%) | 65/90 (72.2%) | 49/90 (54.4%) |
| Kalyan Night | 62 | 44/62 (71.0%) | 46/62 (74.2%) | 32/62 (51.6%) |
| Madhur Night | 78 | 43/78 (55.1%) | 55/78 (70.5%) | 33/78 (42.3%) |
| Milan Night | 78 | 56/78 (71.8%) | 55/78 (70.5%) | 40/78 (51.3%) |
| Rajdhani Night | 65 | 46/65 (70.8%) | 48/65 (73.8%) | 34/65 (52.3%) |
| Main Bazar | 64 | 43/64 (67.2%) | 47/64 (73.4%) | 31/64 (48.4%) |

## Interpretation

The Above-90 historical figure is reproduced on the researched rows, but it remains a post-selection result. The model-selection search required improvement on that same final 30-day block. The fresh seven-day window is therefore the more honest forward-like signal and is currently near or below nominal Top-6 coverage.

## Verification

- Production build: passed.
- TypeScript: passed.
- ESLint: zero errors, seven existing warnings.
- Top-count contract: passed for all markets and counts 1 through 10.
- Above-90 researched-window coverage guard: passed.

## Artifacts

- `scratch/sutta-baseline-7d-above90-final-20260713.json`
- `scratch/sutta-baseline-30d-above90-final-20260713.json`
- `scratch/sutta-baseline-90d-above90-final-20260713.json`
- `scripts/verify-above-90-regression.cjs`
