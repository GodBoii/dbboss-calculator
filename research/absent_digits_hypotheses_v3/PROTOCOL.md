# Domain Hypothesis Evaluation Protocol

Created 2026-07-24. This study extends the frozen Absent Digits V2 model but
does not change its runtime or its prospective journal.

## Target and baseline

- The target is the strict absent pair: both selected digits must be absent
  from the target three-digit panel.
- The comparator is the frozen V2 global 75% appearance / 25% direct-absence
  blend.
- Every domain hypothesis is scored twice: as a standalone pair and as a
  fixed 35% hypothesis adjustment to the V2 digit-appearance probabilities.
- Ordinary Open and Close calls are frozen fifteen minutes before the
  market's Open. The ordinary Close contract therefore cannot use the target
  Open result.
- Open-to-Close hypotheses are evaluated under a separately labelled
  `post_open_close` contract and are ineligible for promotion into the
  pre-Open runtime.

## Chronology and market events

For an own-market target at row `t`, all own-market inputs come from rows
strictly before `t`. Same-day cross-market inputs are admitted only when the
source event plus a 15-minute embargo is earlier than the target market's
Open-minus-15-minute freeze. Otherwise the source falls back to its most
recent completed prior date.

The IST schedule is copied from the repository's earlier causal audits. It is
research metadata, not inferred from panel outcomes.

## Frozen blocks

| Block | Dates | Use |
| --- | --- | --- |
| Warm-up | through 2025-07-13 | Fit frozen clusters, HMMs, and automatic selectors |
| Validation | 2025-07-14 through 2025-11-12 | Candidate screening |
| Holdout | 2025-11-13 through 2026-03-14 | Primary confirmation |
| Recent | 2026-03-15 through 2026-07-05 | Time-stability confirmation |
| Post-cache | 2026-07-06 through 2026-07-19 | Inspected later extension |
| Independent extension | 2026-07-20 onward | Source-independent extension |

All historical blocks are retrospective as of 2026-07-24. A historical Keep
decision would still require a new hash-frozen prospective cohort before a
runtime change.

## Multiplicity and promotion

Every named hypothesis is retained in the result table, including failures.
A candidate can receive a historical `KEEP_FOR_PROSPECTIVE` verdict only if:

1. it improves on V2 in Validation;
2. it is non-degrading in both Holdout and Recent;
3. its combined Holdout+Recent paired exact sign-test passes Benjamini-
   Hochberg FDR at 5% across the full hypothesis family;
4. it is non-degrading in the combined Post-cache+Independent extension;
5. its worst market-side confirmation loss is no worse than two percentage
   points; and
6. at least 60% of confirmation calendar months have non-negative lift.

Conditional post-Open Close candidates are always reported as
`RESEARCH_ONLY_CONDITIONAL`, even if they pass statistical gates.

## Automatic discovery

- Three-state discrete HMMs are fit per market-side on warm-up suttas. Their
  state-specific digit-appearance rates are frozen before Validation.
- A spectral embedding of the warm-up digit co-appearance graph creates
  learned digit families.
- Association and sequence rules condition on earlier panel masks, suttas,
  jodis, positions, and short symbolic sequences with Bayesian backoff.
- Warm-up-only selectors choose one lag hypothesis and one cross-market
  source per market-side; their selections are then frozen.

No geography labels exist in the source data. The study tests causal
market-to-market edges and day/night routes, but does not invent regional or
national classifications.

