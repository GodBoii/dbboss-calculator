# Production Decision

Date: 2026-07-25

Following an explicit user-directed deployment decision, the app default is
`absent-digits-guarded-market-routing-v3`. The frozen
`absent-digits-complementary-online-v2` model remains available through
`buildAbsentDigitsPredictionV2` and is automatically used whenever a V3 route
fails its causal performance guard.

## Evidence

- The complete 110-hypothesis replay retained zero pre-Open hypotheses after
  out-of-sample, FDR, route-stability, and time-stability gates.
- V3's eight routes were shortlisted after inspecting the recent 30/180-day
  results. Aggregate lift was +0.63 percentage points over 180 days
  (`p=.0865`) and +0.33 points over 30 days (`p=.7905`); no route survived FDR.
- The nested ridge family selected one configuration without later-block
  access. Its raw candidate improved the large Validation, Holdout, and Recent
  blocks but failed paired confirmation (`p=.0579`) and worst-route stability.
- Its market-gated variant regressed on the independent extension.

## Consequence

V2 remains the scientific comparator. V3 is enabled as a guarded,
user-directed production choice because it improved both inspected aggregate
windows, while retaining automatic V2 fallback and the unchanged Wilson
actionability gate. This deployment is not evidence that V3 is statistically
confirmed; prospective scoring remains required.
