# Absent-Digits Goal Completion Audit

Generated: 2026-07-24T12:24:16.316672+00:00

## Decision

**Completion is not yet supported.**

- Implementation requirements proven: yes
- Prospective evidence complete: no
- Safe actionable calls empirically supported: no

## Requirement matrix

| Requirement | Status | Current finding |
| --- | --- | --- |
| `market_specific_open_close` | **PROVEN** | The frozen registry contains 24 unique market-sides across 12 markets; runtime parity covers all of them. |
| `complementary_model_families` | **PROVEN** | Model A estimates digit appearance and complements it; Model B directly estimates pair absence. The frozen blend is 75/25. |
| `causal_walk_forward_evaluation` | **PROVEN** | Five chronological blocks are reported, every prediction uses strictly earlier rows, and runtime contamination checks pass. |
| `calibrated_uncertainty` | **PROVEN** | `local_beta_w240_s80` was promoted for point confidence; the independent 120-draw Wilson gate is unchanged. |
| `dynamic_ensembles` | **PROVEN** | Exponentially weighted within-family experts are deployed. Long-only won validation narrowly but failed confirmation, so the dynamic baseline was retained. |
| `evidence_based_feature_selection` | **PROVEN** | Context removal, exact-panel residual blending, local routing, and confidence/agreement gating all failed their promotion rules. |
| `model_selection_uncertainty` | **PROVEN** | The 75/25 blend is retained but classified selection-uncertain: 53.2% bootstrap selection frequency. |
| `runtime_research_parity` | **PROVEN** | Exact parity passed for 24 market-sides, with both registry hashes verified. |
| `continuous_prospective_evidence` | **PENDING** | 1 hash-chained cohort exists; 0 market-sides are scored and 24 remain pending. |
| `safe_actionable_accuracy` | **NOT_ACHIEVED** | The frozen cohort contains 0 calls and 24 abstentions. No market-side has empirical support for an 80% lower bound. |

## Chronological accuracy

| Block | Hits | Rows | Strict accuracy |
| --- | ---: | ---: | ---: |
| Validation | 1224 | 2348 | 52.1% |
| Holdout | 1246 | 2466 | 50.5% |
| Recent | 1193 | 2300 | 51.9% |
| Post Cache | 132 | 288 | 45.8% |
| Independent Extension | 53 | 88 | 60.2% |

## Remaining work

- Observe and score all Jul 25/27 cohort-001 outcomes.
- Regenerate this audit after prospective scoring.
- Register cohort 002 only after cohort 001 has zero pending rows.
- Continue abstaining unless a market-side reaches the frozen 80% Wilson-lower-bound gate with at least 30 comparable calls.

This audit separates system implementation from empirical actionability. A correct abstention is not an 80% accuracy claim.
