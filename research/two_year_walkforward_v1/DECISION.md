# First study decision

The study used only outcome records dated October 9, 2024 through October 8, 2026. It refreshed twelve market charts, retained 7,279 complete draws, and saved predictions for 5,119 market-days after 180-draw warmup. Each market-day includes the current production reference and eight challengers. Initial incomplete or missing draws are not synthesized. Madhur Day's latest complete draw is October 4; Madhur Night and Rajdhani Day end October 3.

Candidate formulas were fixed before execution. Winners were selected on October 9, 2025 through April 8, 2026. The later six-month comparison has 1,856 paired market-days over 182 recorded dates. Historical outcomes before the scope cutoff were not passed into runtime functions or challenger training. Existing production weights and rules remain a previously trained reference; this is not proof that those weights were originally learned exclusively within the permitted window. New challengers learn entirely from permitted earlier outcomes.

## Ranking results

| Task | Production | Frozen challenger | Difference |
| --- | --- | --- | --- |
| Open Top-10 panels | 6.95% | 5.77% | -1.19 pp |
| Close Top-10 panels before Open | 6.84% | 5.55% | -1.29 pp |
| Close Top-10 panels after Open | 6.36% | 6.25% | -0.11 pp |
| Open Top-6 Sutta | 62.45% | 60.51% | -1.94 pp |
| Close Top-6 Sutta before Open | 62.50% | 59.21% | -3.29 pp |
| Close Top-6 Sutta after Open | 62.50% | 59.11% | -3.39 pp |
| Jodi 36-pair grid | 38.09% | 36.10% | -1.99 pp |
| Open absent pair | 51.72% | 51.72% | 0.00 pp |
| Close absent pair | 49.35% | 50.05% | +0.70 pp |

No selected ranking challenger has a confirmation improvement interval entirely above zero. The Close absent-pair gain has a date-clustered 95% interval of -1.83 to +3.11 percentage points. The selected pre-Open Close panel challenger is worse, with a difference interval of -2.53 to -0.11 points. Therefore these replacements are rejected for production ranking changes. The full report includes post-July-2 panel comparisons to avoid replaying panel weights before the end of their training period.

## Probability estimates and errors

Open DP Brier loss fell from 0.19754 to 0.19458 with the selected pooled-history challenger. The reduction's unadjusted paired interval is 0.00028 to 0.00567. It improves probability error slightly, but it has zero DP calls at a 50% threshold. Production made 404 DP calls and got 112 correct, a precision of 27.72%. This does not demonstrate a useful DP alert improvement. Close DP probability improvement is not confirmed. There are eleven reported task comparisons; the intervals are not adjusted for multiple comparisons.

Frequency-derived confidence is too optimistic. The selected Open panel candidate's mean predicted Top-10 coverage was 13.01%, while actual coverage was 5.77%. The Open Sutta decay model's confidence bins averaged 68.17% and 71.82%, but their hit rates were 60.67% and 60.37%. The highest Open absent-pair confidence bin averaged 61.92% and hit 51.00%. Raw frequency confidence should not be presented as calibrated success probability.

The current Open Top-10 list hit 129 of 1,357 SP outcomes and zero of 493 DP outcomes in confirmation. That exposes a coverage limitation, but reserving slots for DP may lose more SP hits than it gains DP hits. That tradeoff needs an explicit, separate experiment. Of the production Open panel misses, 1,032 of 1,727 still had the correct Sutta in the six-digit shortlist. Better digit coverage alone will not solve exact-panel ranking.

## Next development targets

1. Calibrate shortlist probabilities using only earlier replay predictions, then score later probability error separately from ranking accuracy.
2. Refit a regularized panel model from this two-year dataset rather than inheriting the old panel weights. Compare within-Sutta panel ranking and DP slot allocation at the same Top-10 budget.
3. Treat market/month breakdowns from this run as development findings. Do not change a route based on its later-window performance and describe that same window as untouched confirmation.

Production rankings remain unchanged because the tested replacements lost or lacked a confirmed advantage. No waiting for new data was required to reach this result. The source snapshot, compressed prediction ledger, report and verification runner make the next historical experiment reproducible.

Verification: `node --test scripts/verify-two-year-walkforward.cjs` passed all nine checks. Saved ledger checks recompute every score, verify same-market and pooled history boundaries, reproduce winner selection and challenger predictions on each market's final target, and verify the ledger hash.
