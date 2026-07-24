# Top-3 / 90% Goal Completion Audit

Audit time: 2026-07-15 04:11 IST  
Scope: research only; production application and model files are excluded.

## Requirement verdict

| Requirement | Authoritative evidence | Verdict |
| --- | --- | --- |
| Open prediction contains exactly three digits | Content-addressed registries and scorers enforce three picks | Research contract achieved |
| Close prediction contains exactly three digits | Content-addressed registries and scorers enforce three picks | Research contract achieved |
| Jodi prediction contains exactly three pairs | Exact-Jodi registry field enforces three pairs; the 3x3 grid is separately labelled as nine | Research contract achieved |
| Adjusted Close freezes three picks for every possible known Open | All ten Open states are stored before the event | Research contract achieved |
| At least 90% accuracy on untouched chronological evidence | Every validation, holdout, forward, and independent replication result is far below 90% | **Not achieved; contradicted** |
| A verified model satisfying the complete objective | No candidate passes the 90% gate | **Not achieved** |
| Production remains unchanged | `git diff --name-only -- src` is empty | Achieved |

The overall objective is not complete because its defining accuracy requirement is false on the available evidence.

## Strongest non-selected external replication

The fixed formulas were replayed without retuning on the per-market final 20% of the independently parsed history (725 rows).

| Contract | Accuracy | Nominal coverage | Gap to 90% |
| --- | ---: | ---: | ---: |
| Open Top 3 | 30.3% | 30% | -59.7 points |
| Close Top 3 | 27.7% | 30% | -62.3 points |
| Adjusted Close Top 3 | 31.2% | 30% | -58.8 points |
| Three exact Jodis | 3.3% | 3% | -86.7 points |
| 3x3 nine-pair grid | 9.7% | 9% | -80.3 points |

The independent source agrees exactly with the original source on Open panel, Jodi, and Close panel for all 3,381 overlapping rows. Source disagreement therefore does not explain the failure.

## Model-family audit

The following distinct causal families were completed:

1. Current production ranking sliced to Top 3.
2. 189 fixed statistical hypotheses covering frequency, calendar, transition, cross-market, opposite/house, lag, delta, known-Open, exact-Jodi, and grid rules.
3. Additive and multilayer categorical neural models.
4. Market-specific formula selection and its overfitting audit.
5. Selective prediction, abstention, expert agreement, and coverage reporting.
6. Context-pocket mining with support thresholds and later-block tests.
7. Whole-panel exact-token, sorted-token, structural, and factor-interaction models.
8. A 64-event causal cross-market multitask GRU using actual publication order.
9. Independent-source fixed-formula replication.
10. Retrospective cross-source scoring and a clean content-addressed pre-event registry.

No family produces a durable effect remotely approaching the requested threshold. Apparent development gains repeatedly reverse on validation or holdout.

## Current external-state audit

- The independent refresh remains byte-identical with SHA-256 `70c50faa1feb1220e7f7d7b06129772346f0f62bb9b7a1f34fc012b8feb7dac7`.
- All eight accessible markets still end on 2026-07-14.
- The July 15 registry was sealed at 04:01 IST before the earliest scheduled Open.
- Registry content SHA-256 is `913432a06679c2be7f25a49604c43d1ce81a981280f37d2e69dcc594fcc64267`.
- Registry integrity verifies, with 0 scored and 8 pending rows.

## Blocking condition

Historical result sequences and panel histories do not contain a validated 90% Top-3 signal. The same condition persisted through three resumed goal turns:

1. Panel-aware models failed untouched blocks; a clean future registry was created.
2. Event-sequence learning and independent replication failed; the future rows were still unavailable.
3. The deterministic source refresh remained unchanged and all preregistered rows remained pending.

Meaningful continuation now requires an external-state change or genuinely new causal information:

- publication of the sealed July 15 outcomes and later write-once rows; or
- legally and ethically obtained pre-draw features such as current betting/liability information that are not derivable from historical outcomes.

Creating another outcome-only model or searching more contexts would repeat the same multiple-testing process, not provide new evidence toward 90%.
