# Sutta Goal-95 Forward Validation Cycle

Generated: 2026-07-13

## Decision

The previously reported 90% result did not generalize to the next unseen market week. The frozen production v1.0.9 model scored 38/72 Open (52.8%), 43/72 Close (59.7%), and 21/72 Jodi (29.2%) on the newly scraped July 4/5/6 through July 10/11/12 market rows. This week was not used to rank hypotheses.

Two rank-5/6 rules were promoted to v1.0.10 because they improved the older development, validation, chronological holdout, full historical ledger, prior 30-day block, and the untouched forward week:

| Target | Added rule | Historical delta | Dev/validation/holdout | Prior-30 delta | Forward delta |
| --- | --- | ---: | ---: | ---: | ---: |
| Madhur Night Open | same-day Kalyan close-panel first+middle sum, opposite digit | +13 Open / +10 Jodi | +1/+6/+6 | +1 Open | +3 Open / +1 Jodi |
| Rajdhani Night Close | Kalyan Close digit at lag 4, source digit | +10 Close / +5 Jodi | +5/+3/+2 | +1 Close | +1 Close / +1 Jodi |

The rules preserve the existing first four digits and only select ranks five and six. All other audited candidates were rejected or retained as research-only.

## Exact production-path result

| Window | Version | Open | Close | Jodi | Adjusted Close |
| --- | --- | ---: | ---: | ---: | ---: |
| New forward market week | v1.0.9 | 38/72 (52.8%) | 43/72 (59.7%) | 21/72 (29.2%) | 45/72 (62.5%) |
| New forward market week | v1.0.10 | 41/72 (56.9%) | 44/72 (61.1%) | 23/72 (31.9%) | 46/72 (63.9%) |
| Refreshed last 30 calendar days | v1.0.9 | 244/309 (79.0%) | 261/309 (84.5%) | 213/309 (68.9%) | 251/309 (81.2%) |
| Refreshed last 30 calendar days | v1.0.10 | 248/309 (80.3%) | 263/309 (85.1%) | 215/309 (69.6%) | 253/309 (81.9%) |

## v1.0.10 forward week by market

| Market | N | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 7 | 4/7 (57.1%) | 4/7 (57.1%) | 2/7 (28.6%) |
| Time Bazar | 6 | 4/6 (66.7%) | 5/6 (83.3%) | 3/6 (50.0%) |
| Madhur Day | 7 | 4/7 (57.1%) | 6/7 (85.7%) | 3/7 (42.9%) |
| Milan Day | 6 | 2/6 (33.3%) | 4/6 (66.7%) | 2/6 (33.3%) |
| Rajdhani Day | 6 | 4/6 (66.7%) | 4/6 (66.7%) | 3/6 (50.0%) |
| Kalyan | 6 | 3/6 (50.0%) | 4/6 (66.7%) | 1/6 (16.7%) |
| Sridevi Night | 7 | 4/7 (57.1%) | 3/7 (42.9%) | 2/7 (28.6%) |
| Kalyan Night | 5 | 3/5 (60.0%) | 3/5 (60.0%) | 2/5 (40.0%) |
| Madhur Night | 6 | 3/6 (50.0%) | 3/6 (50.0%) | 1/6 (16.7%) |
| Milan Night | 6 | 4/6 (66.7%) | 3/6 (50.0%) | 2/6 (33.3%) |
| Rajdhani Night | 5 | 4/5 (80.0%) | 3/5 (60.0%) | 2/5 (40.0%) |
| Main Bazar | 5 | 2/5 (40.0%) | 2/5 (40.0%) | 0/5 (0.0%) |
| **All markets** | **72** | **41/72 (56.9%)** | **44/72 (61.1%)** | **23/72 (31.9%)** |

## Methodology safeguards

- Historical candidate ranking used only ledgers ending before the new forward week.
- Forward metrics are attached after selection and are not part of the `stable` gate or sort order.
- Same-day rules only use markets that close earlier than the target market.
- Every target row excludes its own outcome and all same-day later-market outcomes.
- The search keeps the established Top-4 prefix, limiting candidate changes to ranks 5-6.
- The 95% objective remains active, but it is not currently achieved. The new forward evidence is close to nominal Top-6 coverage and rules out presenting the earlier researched-window percentage as expected future accuracy.

## Artifacts

- Frozen forward baseline: `scratch/sutta-baseline-7d-goal95-forward.json`
- Exact v1.0.10 forward ledger: `scratch/sutta-baseline-7d-goal95-v1010.json`
- Exact v1.0.10 refreshed 30-day ledger: `scratch/sutta-baseline-30d-goal95-v1010.json`
- Candidate audits: `scratch/goal95-*-candidates.json`
- Forward-aware research harness: `scripts/sutta-next-hybrid-search.cjs`

Verification: TypeScript passed, production build passed, ranking contracts passed for every market and Top count 1-10, and ESLint completed with 0 errors (7 pre-existing warnings).

## Full remaining-side audit

The forward-aware search was subsequently run for all 17 market-sides not covered by the first targeted sweep. Candidate selection was frozen using historical metrics only: minimum validation/holdout side delta, combined validation+holdout side delta, minimum validation/holdout Jodi delta, full-history side/Jodi delta, development delta, and prior-30 delta. The forward result is never a selector or tie-breaker.

The promotion gate was also tightened. A candidate must now be non-regressive for both its target side and Jodi separately in development, validation, chronological holdout, full history, and prior-30 evaluation.

| Audit outcome | Market-sides |
| --- | ---: |
| Remaining market-sides searched | 17 |
| Had at least one candidate passing the stricter historical gate | 11 |
| Historically selected candidate improved target side forward | 0 |
| Historically selected candidate tied target side forward | 6 |
| Historically selected candidate regressed target side forward | 5 |
| Had no candidate passing the stricter gate | 6 |

One Madhur Night Close candidate appeared attractive under the older side-focused gate (+2/+2/+2 Close across the three historical splits and +1 Close/+1 Jodi forward), but it lost three Jodi hits in development. It was rejected and was not added to production.

No additional production rule was promoted in the full remaining-side audit. Production remains v1.0.10.

The Rajdhani Night Close rule already present in v1.0.10 is target-side reproducible (+5/+3/+2 Close across development/validation/holdout), positive over full history (+10 Close/+5 Jodi), and positive forward (+1 Close/+1 Jodi), but its Jodi holdout delta is -1. Under the newly tightened all-metric gate it would not be selected as a new rule; this limitation is recorded rather than hidden.
