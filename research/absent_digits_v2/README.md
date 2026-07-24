# Absent Digits V2

This directory contains the leakage-safe complementary appearance/absence
research cycle created on 2026-07-24.

## Commands

```powershell
npm run research:absent-digits
npm run research:absent-digits-blend-stability
npm run research:absent-digits-calibration
npm run research:absent-digits-routing
npm run research:absent-digits-features
npm run research:absent-digits-selective
npm run research:absent-digits-weighting
npm run verify:absent-digits
npm run score:absent-digits
npm run forward:absent-digits:status
npm run forward:absent-digits:register
npm run audit:absent-digits
```

- `run_research.py` rebuilds the chronological experiment, report, result
  payload, and frozen forward registry.
- `verify_research.py` verifies source, code, and registry hashes plus the
  prediction contract.
- `score_forward.py` scores the immutable registry when later source rows are
  added. It never changes the frozen predictions.
- `forward_journal.py` maintains hash-chained prospective cohorts. It refuses
  to register another cohort until the latest cohort has no pending targets.
- `generate_completion_audit.py` maps every goal requirement to authoritative
  artifacts and refuses to equate implementation with prospective evidence.
- `src/lib/absent-digits.ts` is the browser-safe runtime port. The runtime
  verifier proves exact parity with all 24 frozen Python Open/Close rows and
  checks that target or future records cannot change a prediction.

## Current status

The validation-selected 75% appearance / 25% direct-absence ensemble did not
produce a stable confirmation advantage. All 24 Open/Close market-sides remain
below the actionability gate, so the production `NO_SAFE_CALL` behavior must be
retained.

See `PROTOCOL.md` for the frozen methodology and `REPORT.md` for results.

`PANEL_RESIDUAL_REPORT.md` tests the existing exact-panel ranker as an
additional residual expert. Its validation-selected blend was rejected after
falling below both controls on the prospective ledger.

`CALIBRATION_REPORT.md` compares strictly causal local, global, hierarchical,
and exponentially weighted reliability estimators using validation-only
selection and later confirmation. The promoted 240-draw, strongly shrunk
point-confidence estimator is frozen in `FROZEN_CALIBRATION_REGISTRY.json`;
it does not alter candidate pairs or the 120-draw Wilson action gate.

`WEIGHTING_ABLATION_REPORT.md` isolates the adaptive within-family weighting
against uniform, long-only, slower, moderate, and faster update regimes.

`FEATURE_ABLATION_REPORT.md` removes weekday, previous-state/transition, and
short-window expert groups one at a time under the frozen dynamic regime.

`SELECTIVE_GATE_REPORT.md` tests whether family agreement or calibrated
confidence thresholds can identify a stable higher-accuracy subset.

`DYNAMIC_ROUTE_REPORT.md` lets each market-side causally route among the five
appearance/absence family blends using only its prior outcome ledger.

`BLEND_STABILITY_REPORT.md` quantifies clustered-bootstrap and exclusion
uncertainty around the validation-selected global 75/25 family blend.
