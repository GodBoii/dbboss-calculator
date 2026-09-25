# Conditional DP pattern search

## Result

The past-only selection procedure did not establish a selective DP rule. The pooled 2021-2024 walk-forward table below is the main result. Earlier project reports examined overlapping chart history, including 2024-2025 validation, so this is a retrospective diagnostic rather than a blind holdout.

## Walk-forward protocol

For each year from 2021 through 2024, the search ranks signals using data ending the prior December, then evaluates the selected one-, two-, or three-signal rule on the full next year. A rule must have at least 60 training calls across at least 25 dates. Signal thresholds come from that fold's training data only.

Signals cover target market and side, weekday and month, rolling DP rates, lag and gap state, the preceding panel's digit shape, the previous day's market regime, and outcomes scheduled strictly earlier on the same date. Same-day features follow the current app schedule. The archive does not contain result publication timestamps, so actual availability at each configured time is unverified.

The search keeps a training-ranked quota from each signal family, intersects pairs, and extends the strongest training pairs into triples. It reports a training-only Bonferroni p-value as a multiple-testing diagnostic. That p-value uses the pooled training DP rate and does not account for different base rates by market. The rule's next-year score and the four-week moving-block interval are the primary checks. Exact call-level bounds assume independent calls; same-day events are clustered in the block bootstrap.

## Selected rules by year

| Test year | Selected rule from prior years | Training support | Test calls | Hits | Precision | One-sided exact 95% lower bound | Active dates | Days at 5-10 calls |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 2021 | (market_side == Rajdhani Day|open) AND (gap_dp_events >= 4) AND (prior_panel_spread == 5) | 37/78 (78 dates) | 6 | 5 | 83.3% | 41.8% | 6 | 0 |
| 2022 | (same_day_prior_last_market_side == Madhur Day|close) AND (gap_dp_days >= 6) AND (prior_panel_sum <= 11) | 40/84 (84 dates) | 16 | 8 | 50.0% | 27.9% | 16 | 0 |
| 2023 | (market_side_weekday == Rajdhani Day|open|2) AND (rate_5_minus_40 <= -0.1) AND (prior_panel_spread_rate_20 <= 5.3) | 40/73 (73 dates) | 10 | 1 | 10.0% | 0.5% | 10 | 0 |
| 2024 | (market_side_weekday == Rajdhani Day|open|2) AND (gap_dp_days >= 4) AND (prev_day_other_dp_count >= 6) | 42/76 (76 dates) | 29 | 10 | 34.5% | 20.0% | 29 | 0 |

Pooled next-year calls: **24 correct out of 61 calls (39.3%)**, across 61 active dates. The call-level one-sided exact 95% lower bound is 28.8%. The four-week moving-block bootstrap 95% interval is 29.3%-50.0%.

### Daily calls and hits in the pooled walk-forward period

| Calls on date | Dates | Calls | Hits | Precision | Dates at 70%+ | Perfect dates |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 61 | 61 | 24 | 39.3% | 24 | 24 |
| 2 | 0 | 0 | 0 | 0.0% | 0 | 0 |
| 3-4 | 0 | 0 | 0 | 0.0% | 0 | 0 |
| 5-10 | 0 | 0 | 0 | 0.0% | 0 | 0 |
| 11+ | 0 | 0 | 0 | 0.0% | 0 | 0 |

The 70% day count is descriptive. A date with one successful call is not evidence that the rule's call-level precision is stable.

## Final rule and 2026 retrospective audit

The rule selected using data through 2025 was `(market_side_weekday == Rajdhani Day|open|5) AND (gap_dp_days >= 4) AND (same_day_prior_dp_rate >= 0.166667)`. It had training support 38/71 across 71 dates. Its training Bonferroni-adjusted nominal p-value was 0.00227; the underlying independent-call assumption is not satisfied by the date clusters.

On the previously inspected 2026 history, the rule was correct on **5 of its 12 calls (41.7%)**, with a one-sided exact 95% lower bound of 18.1%, across 12 dates. All were one-call dates; 5 of those dates had a correct call. No date had 5-10 calls.

## Why operator psychology remains unmeasured

The project notes suggest that operators choose results from betting liability, but this archive contains only published panels. It has no wagers by number, payout exposure, operator records, or result-selection timestamps. Public panel sequences can test predictive association, but they cannot tell us what an operator thought or whether a pattern reflects intent. The historical schedule is also an assumption, and the chart export has not been independently checked against a second provider.

## Reproduction

Run `python research/dp_conditional_v1/conditional_search.py` from the repository root. Outputs are `conditional_results.json` and this report. The script reads the saved `research/dp_only_v1/chart_rows.csv` and does not edit app code.
