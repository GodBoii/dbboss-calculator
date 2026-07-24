# Goal 100 Evaluation Protocol

This protocol is frozen for the Goal100 research program created on 2026-07-15. It applies only to files below `research/goal100/` and does not authorize production changes.

## Prediction contract

One ordinary prediction bundle is frozen before the target market opens:

- Open: exactly six distinct digits from 0-9.
- Close: exactly six distinct digits, without knowing the target draw's Open result.
- Jodi: exactly the 36-cell Cartesian product of those Open and Close sets.
- Jodi hit: `openHit && closeHit`; it is not an independent outcome for this rectangle contract.
- Adjusted Close is a separate target generated only after the target Open is published. It cannot count as ordinary Close or Jodi.
- A missing, late, invalid, expanded, selectively omitted, or post-result prediction is a failure.

## Retrospective chronology

All 7,287 rows in the frozen cache have already been inspected during earlier research. These blocks are therefore retrospective controls, never sealed evidence.

| Block | Global dates | Permitted use |
| --- | --- | --- |
| Warm-up | through 2024-09-22 | Feature history only; never scored |
| Development | 2024-09-23 through 2025-07-13 | Nested expanding-origin discovery and tuning |
| Validation | 2025-07-14 through 2025-11-12 | One-time portfolio/family selection |
| Holdout | 2025-11-13 through 2026-03-14 | Confirmation or rejection only |
| Recent frozen | 2026-03-15 through 2026-07-12 | Final retrospective rejection gate only |
| Sealed forward | after a candidate manifest is frozen | Genuine prospective evidence |

Use global dates, not a different trailing-day cutoff for each market. Every scored retrospective prediction must be prequential: fit only with events available before that prediction.

## Event-time causality

Date-only filtering is insufficient. A source field is available only after that exact event was published and only when:

```text
source publication timestamp + safety embargo <= prediction freeze timestamp
```

The default safety embargo is 10 minutes. Unknown, disputed, delayed, or unscheduled publication times mean the same-day field is unavailable.

Field availability:

- source Open Sutta and Open panel: after source Open publication;
- source Close Sutta, Close panel, and Jodi: after source Close publication;
- target Open/panel: prohibited for ordinary Open, Close, and Jodi;
- target Open/panel: allowed only for the separately labelled Adjusted Close target.

Current nominal IST schedule for research auditing (minutes after midnight):

| Market | Open | Close |
| --- | ---: | ---: |
| Sridevi | 695 | 755 |
| Time Bazar | 790 | 850 |
| Madhur Day | 810 | 870 |
| Rajdhani Day | 905 | 1025 |
| Milan Day | 910 | 1030 |
| Kalyan | 945 | 1065 |
| Sridevi Night | 1155 | 1215 |
| Madhur Night | 1230 | 1350 |
| Milan Night | 1265 | 1385 |
| Rajdhani Night | 1295 | 1415 |
| Kalyan Night | 1305 | 1425 |
| Main Bazar | 1320 | 1450 |

These times are an initial versioned research schedule, not proof of exact publication. A future authoritative schedule or observed timestamp supersedes it through an append-only revision. Array order and day/night labels never establish availability.

## Candidate gate

Before sealed-forward evaluation, exactly one paired Open/Close candidate must be fully specified and hash-frozen. It must:

1. use only causally available fields;
2. preserve the fixed six/six/36 contract on every scheduled draw;
3. be selected entirely before holdout/recent inspection;
4. show no per-market Open, Close, or Jodi hit-count regression versus the frozen comparator in validation, holdout, or recent;
5. record all attempted variants and multiplicity corrections;
6. have a deterministic, preregistered fallback;
7. pass replay, timing, completeness, and integrity checks.

A new model family must be selected through nested chronological cross-fitting. Previously searched Above90, hybrid, causal ML, rolling/adaptive, joint-rectangle, rule-ablation, and Top3 families are prior evidence, not new hypotheses.

## Metrics and tests

Report every block and market:

- hits/N and coverage for Open, Close, and Jodi;
- candidate-minus-baseline hit delta;
- candidate-only and baseline-only hits;
- Open-only, Close-only, and both-miss counts;
- missing, invalid, skipped, or late predictions;
- micro aggregate, unweighted market macro average, worst market, and rolling 30 completed draws.

Use Wilson intervals for descriptive coverage, exact paired McNemar/sign tests, date-block bootstrap, and blocked/circular-shift nulls that rerun the complete selection pipeline. Use max-statistic correction over searched candidates and Holm family-wise correction over the 36 market-target claims. FDR is exploratory only.

## Sealed-forward cohort

The first candidate-eligible draw occurs only after the final candidate manifest is frozen. For every market-day:

1. freeze the target-time-censored feature snapshot;
2. generate baseline and candidate before the market Open;
3. seal code/model hash, input hash, predictions, timestamps, and source cutoffs;
4. store outcomes later as separate append-only result events;
5. score every scheduled completed draw, without selective stopping or restarts.

The first checkpoint is 30 completed draws per market. One miss means that frozen model failed empirical Goal100 for that cohort, but scoring continues for an honest estimate. Any model change starts a new cohort and cannot carry forward earlier successes.

Thirty successes out of 30 is empirical 100%, not proof that the true miss probability is zero. Its unadjusted one-sided 95% exact lower bound is only about 90.5%. No finite sample proves a literal future probability of 100%.

## Integrity requirements

Each immutable prediction row or batch records:

- research model ID and prediction-code SHA-256;
- production comparator fingerprint;
- input/feature snapshot SHA-256;
- generation timestamps in UTC and IST;
- target market, date, and Open deadline;
- field-level source cutoffs where same-day inputs are used;
- ordered Open six, Close six, and all 36 Jodis.

Actual-result events must separately record source, observation timestamp, and raw-result hash. Local hashes are tamper-evident but are weak timestamp evidence; an append-only remote or independently timestamped anchor is preferred for confirmatory claims.

