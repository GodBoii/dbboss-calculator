# Same-market Open-to-Close DP feature evaluation

Evaluate Close DP probabilities after the same market's Open is available. Keep the verified call requirement at 90%. Do not tune a lower threshold or treat abstention as an SP prediction.

Freeze this comparison before scoring:

- Fit probability corrections on weekdays from 2023-07-01 through 2025-12-31.
- Score 2026-01-01 through 2026-10-01 as retrospective held-out outcomes. The daily-slate study already inspected this period and selected its highlighted markets on it.
- Report 2026-10-02 through 2026-10-08 separately as a short post-study audit, also retrospective because other repository studies inspected it. Exclude today's partial outcomes.
- Include all 12 app markets. Do not select the three highlighted markets using their 2026 results. Show those markets only as diagnostics.
- Reuse the daily-slate kind feature `k_cond`: logit of the market's cumulative, add-one-smoothed Close DP rate conditional on today's Open being DP or non-DP, minus logit of its decayed Close base rate. Update both states only after predicting that date; learn these states from weekdays since 2016. The Close base has a 300-draw half-life and the study's `(dp + 0.25) / (n + 1)` smoothing. TP is non-DP, not SP.
- Replay current production code with its rolling 28-month history, including weekends. For live Close, append only the target market's partial Open record, with Close panel, Close Sutta and Jodi blanked. Other markets expose earlier dates only. This isolates the same-market input and does not claim historical publication times are known.
- Compare raw production, production calibrated with a fixed logistic correction using its raw logit and market intercepts, and that identical correction plus the single study feature. Use fixed `C=1`, no test-selected parameters, no further refit. Report a one-coefficient raw-logit-offset correction as the smaller integration candidate, fitted on the same fit dates.
- Measure Brier loss, binary log loss, mean forecast versus observed rate, fixed 10-bin calibration, and DP precision/coverage/recall at probability >= 0.90. Report zero calls with undefined precision. Also show the existing heuristic kind calls separately; their threshold is not the verified 90% gate.
- Compare losses with a seeded paired calendar-date bootstrap, 3,000 replicates. Show month and market stability and recent 30/90-day windows, which are overlapping diagnostics, not independent confirmations.
- Keep the production call gate closed unless a frozen candidate supports 90% precision with meaningful later support. No production promotion from a calibration gain alone that creates no qualifying DP calls. A potential probability-only change also needs stable incremental gains over calibration alone and independent forward validation; this retrospective audit cannot supply that validation.

The production reference uses current code and previously fitted rules. It is not an as-deployed reconstruction or a claim that those rules were trained only before each evaluation outcome. Feature fit dates are held out from parameter fitting, but the overall research process is not blind. Confidence intervals are descriptive, without multiple-comparison correction.

Reproduction uses a frozen, validated chart snapshot and source/code SHA-256 hashes. No network fetch is needed. Missing Open results produce a zero study feature and are reported separately. Pre-Open forecasts have no new input. The feature cannot be applied to Open predictions or to Close before Open is actually declared.
