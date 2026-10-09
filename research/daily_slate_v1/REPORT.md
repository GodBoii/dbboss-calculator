# Daily slate: how many of a day's draws can be predicted? (Monday-Friday only)

A playing day has up to 24 draws: 12 markets x Open/Close, averaging 23.7. Saturday and Sunday are excluded everywhere, both from the evaluation and from the history the models learn from. The draws are ordered by result time from `src/lib/market-schedule.ts`. Data: 2016-01-01..2026-10-01, 2,739 weekdays. Models were fitted on 2023-07..2025-12 and tested on 2026 (194 weekdays), with the last 90 days (64 weekdays) also shown.

## 1. Are the day's draws linked at all?

Each market's panels were shuffled across dates within the same year and weekday. This keeps each market's own habits but breaks any same-day link between markets. The real days were compared with 200 shuffles.

| Day-level pattern | Discovery (2016-25) | 2026 |
|---|---|---|
| DP count per day more spread out than chance | z=+2.1 | z=+1.2 (not confirmed) |
| DPs cluster into dry or flood days | no (0-DP days 0.1% real vs 0.1% shuffled) | no |
| Same sutta repeats more within a day | z=+2.0 | z=+2.9, but the effect is +0.7 points (62.2% vs 61.6%) |
| Operator balances suttas across the day | no (used-earlier ratio 0.97-1.09) | no |
| Morning DP count predicts evening DP rate | no (evening rate 25-26% whatever the morning) | no |

Slot-pair links (276 combinations) were picked on 2016-2025 and checked on 2026:
- **Both DP:** held for the same market's Open and Close in Sridevi Night, Sridevi and Milan Day.
- **Same sutta:** held, weakly, for Sridevi Night Open and Close (13.3% vs 10%), and Madhur Day Close with Sridevi Night Close (12.4% vs 9.7%). The 2026 z-score was only about 1.7 for both.
- **Digit overlap:** nothing held up.

## 2. Hits per weekday (2026, average 23.7 draws/day)

"Morning" uses history only. "Live" also sees every result declared earlier that day, including the same market's Open.

| Target | Random / always-SP | Most-frequent list | Morning | Live |
|---|---|---|---|---|
| SP/DP correct | 17.45 (always SP, 73.5%) | - | 17.45 | 17.45 |
| Sutta in top 3 | 7.09 (29.9%) | - | 7.38 (31.1%) | 7.45 (31.4%) |
| Sutta in top 6 | 14.17 (59.7%) | - | 14.23 (60.0%) | 14.30 (60.3%) |
| Panel in top 10 | 1.18 (5.0%) | 6.8% | 1.61 (6.8%) | 1.71 (7.2%) |
| Panel in top 30 | 3.23 (13.6%) | 19.9% | 4.79 (20.2%) | 5.04 (21.2%) |

Last 90 days, live: sutta top 6 is 13.94 of 23.3 (random 13.56), panel top 30 is 5.06 (most-frequent list 21.6%), and SP/DP is identical to always-SP.

The panel "lift" over random is structural. SP panels are drawn more often than DP panels, so a fixed list of the most frequent panels already gets about 20%. Same-day information adds about +1 point on Top 30, about 0.25 extra hits a day. The SP/DP model never reaches 50% DP probability, so its calls match always-SP. Its daily top 3 DP picks were DP 27.5-30% of the time, against a 26% base rate.

## 3. The usable within-day signal

Close is more often DP after a DP Open in the same market:

| Market | Close DP after DP Open, 2016-25 / 2026 | Close DP after SP Open, 2016-25 / 2026 |
|---|---|---|
| Sridevi Night | 32.8% / 41.0% | 20.2% / 17.4% |
| Sridevi | 33.2% / 41.2% | 18.4% / 27.3% |
| Milan Day | 41.7% / 43.8% | 26.1% / 25.7% |

Rajdhani Day goes the other way (12.0% / 19.2% vs 22.2% / 25.4%). A Close DP call here would still be right only about 40% of the time.

### Production feature evaluation

The [Open-to-Close DP feature audit](../dp_open_close_v1/REPORT.md) compares this conditional signal with the current production predictor on 2,369 later weekday Close outcomes, keeping the 90% call threshold. The small probability-score gain has an uncertainty interval spanning zero, some markets regress, and no model makes a qualifying 90% call. Keep the learned feature out of production. The existing same-market Open heuristic and verified abstention gate remain unchanged.

## Reproduce

```
node research/dp_panel_v3/fetch-data.cjs
cd research/daily_slate_v1
$env:PYTHONPATH="..\dp_panel_v3"; $env:PYTHONIOENCODING="utf-8"
python dependence.py; python daily_eval.py; python checks.py
```
