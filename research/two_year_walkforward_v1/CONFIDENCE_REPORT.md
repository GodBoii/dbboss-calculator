# Historical confidence correction

Follow-up hypothesis conceived after inspecting the first study. This is an exploratory retrospective confidence correction, not untouched confirmation or a ranking improvement.

No older outcomes are used. Each target confidence correction uses only earlier prediction outcomes from the two-year replay. The bin needs 120 earlier observations and shrinks its observed hit rate toward the raw probability with 20 pseudo-observations. All markets on a date are scored before that date updates calibration. Candidate identities remain those selected before April 9. Picks and hit rates are unchanged.

| Task | Actual hit rate | Raw mean confidence | Corrected mean confidence | Raw Brier | Corrected Brier | Reduction 95% interval |
| --- | --- | --- | --- | --- | --- | --- |
| openPanel | 5.77% | 13.01% | 5.87% | 0.05963 | 0.05434 | 0.00363 to 0.00678 |
| closePanel | 5.55% | 24.84% | 5.62% | 0.08966 | 0.05248 | 0.03313 to 0.04106 |
| openSutta | 60.51% | 70.17% | 60.95% | 0.24910 | 0.23915 | 0.00577 to 0.01407 |
| closeSutta | 59.21% | 64.03% | 59.86% | 0.24374 | 0.24160 | 0.00016 to 0.00432 |
| openAvoid | 51.72% | 59.20% | 52.56% | 0.25583 | 0.24998 | 0.00253 to 0.00913 |
| closeAvoid | 50.05% | 54.47% | 49.76% | 0.25201 | 0.25008 | -0.00045 to 0.00430 |

Intervals resample whole dates and are not corrected for multiple tasks. The correction is implemented as a separate research module, not a production confidence change. It measures confidence reliability rather than finding more winning numbers.

Reproduce with `node scripts/two-year-confidence-audit.cjs`. All raw and corrected probabilities, outcomes and prior-bin counts are stored in confidence-predictions.jsonl.gz. Run `node --test scripts/verify-two-year-confidence.cjs` to check earlier-date-only updates against the saved ledger.
