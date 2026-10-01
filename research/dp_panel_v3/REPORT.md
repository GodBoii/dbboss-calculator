# DP panel model v3 (Open DP / Close DP lists)

Question scored: when a draw's Open or Close is a DP, is that DP panel in the app's DP list (Top 10/15/20/30 of 90), and does the "DP Numbers" pair match? Random baseline: Top10 11.1%, Top30 33.3%, exact pair 2.2%.

## Current production (before), walk-forward, 12 markets, end 2026-10-01

| Window | Side | DPs | Top10 | Top20 | Top30 |
|---|---|---:|---:|---:|---:|
| 7d | open / close | 9 / 8 | 0% / 0% | 11.1% / 0% | 22.2% / 12.5% |
| 30d | open / close | 79 / 65 | 10.1% / 4.6% | 19.0% / 12.3% | 30.4% / 24.6% |
| 90d | open / close | 224 / 213 | 7.1% / 8.0% | 17.4% / 20.2% | 29.0% / 36.2% |

The legacy recency/cooldown scorer is at or below random. Its "due panel" logic pushes recently seen DPs down, but the data shows that frequently drawn DPs stay frequent. The DP Numbers pair hit 1.8% exactly, versus 2.2% random.

## New model

A conditional logit over the 90 DP panels with 19 features. The features cover 28-month frequency (same market+side, both sides, all 12 markets), decayed recency, weekday, gap, repeated-digit / pair / sutta frequency, and digit overlap with the previous panel. For Close they also use today's Open (overlap, same repeated digit, same sutta, equal panel). There is one weight vector pooled across Open and Close, with L2=3000. It was fitted on 2023-01-01..2026-07-03 only.

Selection: an expanding-window check over 8 quarters before the test window (`rolling.py`). The chosen variant averaged Top30 37.7% (open) and 37.0% (close), and beat random in 8/8 and 7/8 quarters.

## After (same backtest, production code path, last 90 days are out-of-sample)

| Window | Side | Top10 | Top15 | Top20 | Top30 |
|---|---|---:|---:|---:|---:|
| 7d | open | 0% | 22.2% | 33.3% | 66.7% |
| 7d | close (open known) | 0% | 25.0% | 25.0% | 37.5% |
| 30d | open | 8.9% | 16.5% | 22.8% | 38.0% |
| 30d | close (open known) | 20.0% | 26.2% | 32.3% | 49.2% |
| 90d | open | 12.9% | 19.6% | 25.9% | 40.6% |
| 90d | close (open known) | 11.3% | 17.8% | 26.3% | 36.2% |
| 90d | close (before open) | 11.7% | 14.1% | 20.7% | 30.0% |

90d combined Top30: 32.5% → 38.4%. Top10: 7.6% → 12.1%.

## Limits

- The edge is small. Test log-loss is only ~0.01 below uniform, and the 7-day window (17 DPs) is noise.
- Close before the Open is published is no better than random in the last 90 days. Refresh after the Open for the Close list.
- The exact DP Numbers pair stays near random (2.3%). The pair is now the highest-probability pair, but don't expect a lift from it.
- The SP/DP kind call is unchanged at about 25% DP precision. `research/dp_only_v1` found nothing reliable there.

## Reproduce

```
node research/dp_panel_v3/fetch-data.cjs          # refresh data.json
node research/dp_panel_v3/baseline-backtest.cjs 90 v3-aware-ledger.json --open-aware
node research/dp_panel_v3/score.cjs research/dp_panel_v3/v3-aware-ledger.json
python research/dp_panel_v3/research.py && python research/dp_panel_v3/rolling.py
python research/dp_panel_v3/export_weights.py     # refit; copy arrays into dp-panel-model.ts
```
