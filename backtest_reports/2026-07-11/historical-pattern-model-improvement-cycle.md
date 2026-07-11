# Historical Pattern and Model Improvement Cycle

Generated: 2026-07-11

## Outcome

This cycle expanded the leakage-safe Top-6 research harness, tested new lag, echo, arithmetic, gap, frequency-regime, and hybrid hypotheses, and integrated one guarded Rajdhani Day Adjusted-Close improvement.

The new production ranking preserves the current first four digits and uses a seven-draw opposite echo only to select the remaining Top-6 digits. It therefore preserves the existing Top-4 result exactly.

## Step 1: Freeze the comparison

- Source cache: 12 markets, 7,287 completed records.
- Effective two-year window: July 2024 through 2026-07-03/05, depending on market schedule.
- Final audit window: the last 30 calendar days available per market, 309 market results.
- Minimum training history: 50 earlier records.
- Leakage rule: a target result and same-day later results are never included in its features.
- Development: results at least 213 days before each market's latest row.
- Validation: ages 30–212 days.
- Final holdout audit: ages 0–29 days.

## Step 2: Hypotheses tested

The existing candidate library already covered long and recent frequency, recent-cold reversal, weekday, date-of-month, one-step transitions, cross-side transitions, modular delta, opposite digits, houses, Bayesian shrinkage, known-Open Close conditionals, and direct Jodi models.

This cycle added:

1. Exact digit repeats at lags 1, 2, 3, 5, and 7.
2. Opposite digits at lags 1, 2, 3, 5, and 7.
3. Previous same-weekday and same-date echoes and opposites.
4. Previous Open/Close sum, signed difference, reverse difference, absolute difference, product, and opposite-sum formulas modulo 10.
5. Drought-as-due and drought-as-suppression formulas.
6. Short-versus-long frequency acceleration and mean reversion.
7. Entropy-weighted recent/long regime blending.
8. A canonical hybrid that preserves the existing Top-4 prefix and lets a challenger choose ranks 5–10.

## Step 3: What worked and what failed

### Broad findings

| Hypothesis | Two-year aggregate result | Decision |
|---|---:|---|
| Recent-7 hot Open | 62.7% | Rejected globally: strong long-run result but much weaker than production in the final 30-day window |
| Recent-14 hot Open | 62.2% | Rejected globally for the same recency instability |
| Frequency acceleration Open | 61.9% | Research-only; validation useful, holdout insufficient |
| Gap suppression Open | 61.7% | Research-only; small and unstable lift |
| Recent-30 cold Close | 61.6% | Already used selectively; strongest broad Close family |
| Modular delta Close | 60.9% | Keep only for the validated Rajdhani Day pre-Open Close model |
| Lag-7 opposite Close | 60.6% globally | Reject globally; useful only in one market/target |
| Previous sum-opposite Close | 60.4% | Reject; near coverage and inconsistent by market |
| Markov/transition families | About 60% | Reject as universal models |
| Same weekday/date echoes | About 60–61% | Reject as universal models |
| Direct Jodi formulas | Best 38.4% | Reject; sparse and unstable versus paired Open × Close ranking |

The nominal coverage baselines are 60% for six digits and 36% for 36 Jodis. Coverage does not establish profitability.

### Accepted local signal

Target: **Rajdhani Day Adjusted Close**, after the Open result is known.

Candidate formula:

1. Keep the existing Bayesian ranking's first four digits.
2. Let `L7` be the Close digit seven completed Rajdhani Day draws ago.
3. Compute `opposite(L7) = (L7 + 5) mod 10`.
4. Rank the remaining digits by long-run smoothed Close frequency, adding `0.045` to the opposite digit's rate.
5. Append that order after the preserved Top-4 prefix and take the first six digits.

The challenger versus the previous Bayesian ranking:

| Period | Previous | Hybrid | Improvement |
|---|---:|---:|---:|
| Development | baseline | +18 hits | +18 hits |
| Validation | baseline | +5 hits | +5 hits |
| Final 30-day market block | 19/26 (73.1%) | 19/26 (73.1%) | 0 |
| Two-year Rajdhani Day | 339/556 (61.0%) | 362/556 (65.1%) | **+23 hits, +4.1 points** |

Six consecutive 90-result block deltas were `0, +8, 0, +9, +2, +5`: no negative block, four positive blocks.

The paired exact test is nominally p=0.038. After a deliberately conservative 50-candidate Bonferroni correction it is not significant (adjusted p=1.0). Therefore this is a guarded, market-local improvement, not proof of a universal number law. The Top-4 prefix and final 30-day accuracy are frozen to prevent a short-window regression.

## Step 4: Exact production-path backtest

### Last 30 days: previous versus improved cycle

| Target | N | Previous | Improved | Change |
|---|---:|---:|---:|---:|
| Top-6 Open | 309 | 221/309 (71.5%) | 221/309 (71.5%) | 0.0 points |
| Top-6 Close | 309 | 209/309 (67.6%) | 209/309 (67.6%) | 0.0 points |
| Top-6 Jodi | 309 | 148/309 (47.9%) | 148/309 (47.9%) | 0.0 points |
| Top-6 Adjusted Close | 309 | 210/309 (68.0%) | 210/309 (68.0%) | 0.0 points |
| Top-4 Adjusted Close | 309 | 149/309 (48.2%) | 149/309 (48.2%) | 0.0 points |

The new cycle does **not** claim a last-30-day improvement. It preserves that holdout while improving the longer Rajdhani sequence.

### Full two-year production path

| Target | N | Previous | Improved | Change |
|---|---:|---:|---:|---:|
| Top-6 Open | 6,687 | 4,103 (61.4%) | 4,103 (61.4%) | 0 |
| Top-6 Close | 6,687 | 4,127 (61.7%) | 4,127 (61.7%) | 0 |
| Top-6 Jodi | 6,687 | 2,505 (37.5%) | 2,505 (37.5%) | 0 |
| Top-6 Adjusted Close | 6,687 | 4,098 (61.3%) | **4,121 (61.6%)** | **+23 hits, +0.34 points** |
| Top-4 Adjusted Close | 6,687 | 2,751 (41.1%) | 2,751 (41.1%) | 0 |

### Current model versus the original pre-improvement 30-day baseline

This is the meaningful overall improvement already present in the application after the full model-research program:

| Target | Original baseline | Current model | Improvement |
|---|---:|---:|---:|
| Top-6 Open | 196/309 (63.4%) | 221/309 (71.5%) | **+25 hits, +8.1 points** |
| Top-6 Close | 186/309 (60.2%) | 209/309 (67.6%) | **+23 hits, +7.4 points** |
| Top-6 Jodi | 131/309 (42.4%) | 148/309 (47.9%) | **+17 hits, +5.5 points** |
| Top-6 Adjusted Close | 188/309 (60.8%) | 210/309 (68.0%) | **+22 hits, +7.1 points** |

## Step 5: Interpretation

- Number patterns are mostly weak, local, and time-varying. No universal opposite, house, arithmetic, or Markov formula passed the market-wise validation gate.
- The strongest reliable approach remains market-specific model selection with shrinkage and chronological validation.
- A high recent percentage alone is not enough. The rejected formulas contain several apparently attractive 7-day and 30-day results that fail longer or earlier blocks.
- The accepted hybrid changes only ranks five and six for one market-side, preserving stronger existing evidence in ranks one through four.
- The data ends on 2026-07-03/05. This report is a historical audit, not a live prediction or profitability guarantee.

## Artifacts and verification

- Expanded harness: `scripts/sutta-model-research.py`
- Production model: `src/lib/sutta-model/adjusted-close.ts`
- Machine-readable hypothesis results: `scratch/sutta-candidate-research.json`
- Frozen 30-day baseline: `scratch/sutta-baseline-30d-cycle-baseline-confirm.json`
- Improved 30-day result: `scratch/sutta-baseline-30d-cycle-hybrid.json`
- Frozen two-year baseline: `scratch/sutta-baseline-730d-cycle-baseline.json`
- Improved two-year result: `scratch/sutta-baseline-730d-cycle-hybrid.json`

Verification completed:

- Ranking contract for all markets and Top counts 1–10: passed.
- TypeScript: passed.
- ESLint: 0 errors; 7 pre-existing warnings.

