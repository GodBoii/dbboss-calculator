# Nested ML Absent-Digit Protocol

Created 2026-07-24. This study is research-only until every promotion gate
passes. It does not use the target result, does not alter the frozen V2
forward journal, and does not treat the observational V3 shortlist as
confirmatory evidence.

## Target and comparator

- Target: both selected digits are absent from the target three-digit panel.
- Comparator: the frozen V2 75% appearance / 25% direct-absence ensemble.
- One prediction is produced for every eligible market-side event.
- Ordinary Close is predicted without the target day's Open result.

## Chronology

| Block | Dates | Use |
| --- | --- | --- |
| Inner train | through 2025-03-31 | Fit candidate variants |
| Inner selection | 2025-04-01 through 2025-07-13 | Select exactly one frozen configuration |
| Validation | 2025-07-14 through 2025-11-12 | First external gate |
| Holdout | 2025-11-13 through 2026-03-14 | Confirmation |
| Recent | 2026-03-15 through 2026-07-05 | Stability confirmation |
| Post-cache | 2026-07-06 through 2026-07-19 | Inspected later extension |
| Independent extension | 2026-07-20 onward | Source-independent extension |

All features for event `t` use own-market rows strictly before `t`. The model
is refit once on all data through 2025-07-13 after configuration selection,
then frozen for every later block.

## Candidate family

The study compares ridge probability rankers with:

- pooled global learning with market-side and digit indicators;
- independently fitted market-side models;
- a hierarchical average of pooled and market-side estimates;
- ridge strengths `0.1, 1, 10, 100`;
- V2/ML probability blends `25%, 50%, 75%, 100%`.

Features include V2 probability, rolling frequencies at 2/3/5/7/10/15/30/
60/90/180/365/730 draws, momentum, own-digit and opposite-digit lags,
appearance gap and streak, weekday and month rates, previous panel kind,
previous sutta relationships, and position-specific rates.

Exactly one configuration is chosen by inner-selection strict accuracy, with
Brier loss and model simplicity as deterministic tie breakers. A separate
market-side fallback map may use the candidate only where it beat V2 during
inner selection by at least two net strict hits on at least 30 events.

## Promotion gate

A candidate may be recommended only when it:

1. improves Validation;
2. is non-degrading in Holdout and Recent;
3. wins the paired exact sign test on Holdout+Recent at `p < .05`;
4. is non-degrading on Post-cache+Independent extension;
5. loses no market-side by more than two percentage points in confirmation;
6. has non-negative lift in at least 60% of confirmation calendar months; and
7. improves or preserves digit-level Brier loss in every confirmation block.

Failure of any gate means rejection and no production change.
