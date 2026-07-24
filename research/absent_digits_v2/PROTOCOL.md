# Absent Digits V2 Evaluation Protocol

Created 2026-07-24. This protocol applies only to
`research/absent_digits_v2/`. It does not authorize production promotion.

## Prediction contract

- Produce one Open pair and one pre-Open Close pair for every completed draw.
- A strict hit requires both selected digits to be absent from the three-digit
  panel.
- Report per-digit appearance probabilities, the most likely digits, the
  selected avoid pair, model-family agreement, historical reliability, and a
  confidence interval.
- A pair is actionable only when its prequential 95% Wilson lower bound is at
  least 80% with at least 30 comparable prior calls. Otherwise it is a
  research candidate and the engine must abstain.

## Causality

Every feature for target row `t` is computed only from rows strictly before
`t`. Open and Close are modeled separately. The ordinary Close model cannot use
the target draw's Open result. Source files are deduplicated by market and ISO
date, with independently audited July 20-23 rows appended only for accepted
market identities.

## Frozen time blocks

| Block | Dates | Permitted use |
| --- | --- | --- |
| Warm-up | through 2025-07-13 | Online history only |
| Validation | 2025-07-14 through 2025-11-12 | Select one global family blend |
| Holdout | 2025-11-13 through 2026-03-14 | Confirmation/rejection |
| Recent | 2026-03-15 through 2026-07-05 | Stability check |
| Post-cache | 2026-07-06 through 2026-07-19 | Retrospective extension |
| Independent extension | 2026-07-20 onward | Source-independent extension |

All blocks are now considered inspected. None is pristine prospective evidence
for a model created on 2026-07-24. Genuine confirmation begins only after a
candidate and its code hash are frozen.

## Model families

Model A estimates digit appearance probabilities using long, short, weekday,
and previous-state views. Pair absence is derived from the complement of those
appearance probabilities.

Model B directly estimates each pair's joint absence probability using long,
short, weekday, and previous pair-state views.

Experts are combined within each family using exponentially weighted
prequential Brier loss. The only searched hyperparameter is the fixed blend
between Model A and Model B: `0, .25, .5, .75, 1`. It is selected once on the
validation block and then frozen.

## Required reporting

- strict pair accuracy and average correctly absent digits;
- digit-level Brier score for Model A;
- random-pair reference conditional on observed panel kind;
- paired exact sign tests against both single-family models;
- micro, market-macro, and worst-market accuracy;
- calibration reliability, Wilson interval, calls, and abstentions;
- a latest-state payload with all ten digit probabilities and contributing
  model weights.

No accuracy claim may use the confidence score itself as evidence.

## Calibrated point confidence

The point confidence and the actionability gate are intentionally separate.
`run_calibration_audit.py` compares 44 strictly causal local, pooled,
hierarchical, and exponentially weighted reliability estimators. Warm-up
predictions initialize each market-side history, and outcomes sharing a date
are batch-updated so they cannot inform one another.

Validation-only Brier selection chose a 240-draw local beta mean with prior
mean `0.506` and strength `80`. It improved Brier loss on both Holdout and
Recent, with a week-clustered confirmation interval below zero, and did not
regress on the later extensions. This estimator is used only for the displayed
point confidence. The action gate remains the frozen 120-draw Wilson lower
bound. The calibrated addendum is hash-frozen before the Jul 25/27 outcomes in
`FROZEN_CALIBRATION_REGISTRY.json`.

## Dynamic-weighting ablation

`run_weighting_ablation.py` fixes the 75/25 family blend and isolates six
within-family weighting regimes: the deployed exponentially weighted baseline,
uniform weights, long-only weights, and three slower/faster loss-memory
settings. Validation selects a candidate, but promotion additionally requires
non-degradation on both Holdout and Recent, a paired confirmation win at
`p < .05`, no combined later-extension regression, and no worst-market-side
loss beyond two points.

Long-only weighting won validation by only 3 strict hits, then regressed on
Holdout and Recent and lost the combined paired comparison 690-748
(`p = .1328`). It is rejected. The deployed dynamic regime with decay `0.97`
and weight sensitivity `35` remains unchanged.

## Context-feature ablation

`run_feature_ablation.py` holds the family blend and dynamic weighting fixed
while removing weekday, previous-state/direct-transition, 30-row, and 90-row
experts individually, plus a context-free long/short configuration.

Removing the state experts won validation by 16 net strict hits, but lost 13
net hits on Holdout and 5 on Recent. Its combined paired confirmation was
158-176 (`p = .3523`), and it also failed the later-extension gate. No other
removal won validation. The full feature set is retained; the mixed signs in
the removal table are evidence against post-hoc pruning from later blocks.

## Selective agreement/confidence gates

`run_selective_gate_audit.py` prequentially evaluates family agreement and
thresholds on the promoted 240-draw calibrated confidence. Validation
candidates require at least 10% coverage and 200 rows, and selection maximizes
the strict-hit Wilson lower bound. Later promotion additionally requires
non-degradation on both Holdout and Recent, a significant selected-versus-
excluded contrast, a positive week-clustered excess over the panel-kind random
reference, and non-degradation on the combined later extensions.

The validation-selected `confidence_ge_052` gate reached 53.8% at 53.0%
coverage, but fell to 48.9% on Holdout. Across Holdout and Recent it achieved
50.4% versus 51.7% for excluded rows (`p = .3829`), and its random-reference
excess was -0.3 percentage points with a 95% clustered interval of
[-2.6, +1.9]. Family agreement alone also failed to improve validation. No
selective gate is promoted and none approaches the 80% Wilson requirement.

## Dynamic market-side family routing

`run_dynamic_route_audit.py` lets each Open/Close market-side choose causally
among the five frozen appearance-family weights using its own earlier
full-feedback hit ledger. Candidate routers vary the local window, beta
shrinkage, and the advantage margin required to leave the global 75/25 blend.

No adaptive router beat the global blend on validation. Unconstrained local
routers changed 13-14% of candidate pairs and lost roughly 0.4-1.0 percentage
points. The most conservative router changed 0.9% of pairs and still finished
one validation hit behind. The global 75/25 family blend is retained.

## Family-blend selection stability

`run_blend_stability_audit.py` quantifies uncertainty in the validation choice
without retuning on later blocks. It uses 6,000 week-cluster bootstrap samples,
leave-one-market-side-out fits, and leave-one-calendar-month-out fits.

The 75/25 blend remains the modal bootstrap choice at 53.2% and survives every
market-side exclusion, but survives only 60% of month exclusions. Its
validation advantage over the 25/75 runner-up is +0.30 percentage points with
a clustered 95% interval of [-0.88, +1.56]. The blend remains frozen because
it is the protocol-selected winner, but it must be described as
selection-uncertain rather than uniquely superior.

## Prospective cohort journal

`forward_journal.py` converts the one-off forward registry into an immutable
cohort sequence. Each prediction cohort has a canonical content hash and a
pointer to the previous cohort hash. Score files reference prediction hashes
but never alter prediction files. The first journal cohort is an exact merge
of the frozen base registry and calibrated-confidence addendum.

Registration of cohort `n + 1` is rejected until cohort `n` has a score file
with zero pending market-sides. The registrar also rejects silent model-code
changes and requires every source cutoff to precede its target date. Cohort
001 currently contains the 24 Jul 25/27 market-sides and locks further
registration while they remain pending.
