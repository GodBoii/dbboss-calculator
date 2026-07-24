# Goal 100: Research-Only Sutta Program

Created: 2026-07-15

## Objective

Research toward 100% Top-6 coverage for Open Sutta, Close Sutta, and the derived 6x6 Jodi grid in every market. Adjusted Close is maintained as a separate known-Open research target.

This is an aspirational research objective, not a promised result. A 100% claim is accepted only if it survives the validation protocol below. Historical fitting, tiny samples, hindsight selection, and increasing the prediction-set size do not qualify.

The detailed frozen rules are in `PROTOCOL.md`. Previously searched model families and their current decisions are recorded in `hypothesis-registry.json` so failed or contaminated searches are not presented later as new evidence.

## Production boundary

- Do not edit `src/`, `public/`, package files, application configuration, or existing production scripts.
- All new candidate code, model artifacts, data manifests, ledgers, and reports live under `research/goal100/`.
- Production is read-only and may be imported only to reproduce the baseline.
- Run `node research/goal100/production-guard.cjs` before and after every research cycle.
- No candidate is promoted to the app as part of this goal.

The production fingerprint recorded at goal creation covers 74 files and is stored in `manifest.json`.

## Fixed prediction size

- Open: exactly 6 distinct digits from 0-9.
- Close: exactly 6 distinct digits from 0-9.
- Jodi: the 36 combinations from the 6x6 Open/Close rectangle.
- Adjusted Close: exactly 6 distinct digits after the Open result is known.

Selecting more digits, changing denominators, skipping difficult markets, or reporting only high-confidence pockets cannot be called 100% full-market accuracy.

## Validation protocol

1. Freeze the data hash and the exact production baseline.
2. Use chronological blocks: development, validation, holdout, recent frozen block, then sealed forward draws created after this goal.
3. Generate and tune hypotheses using development only.
4. Use validation once for model-family selection.
5. Use holdout and the frozen recent block only for rejection or confirmation, never tuning.
6. Require non-regression for the target side and Jodi in every later block and per market.
7. Apply multiple-testing controls, permutation/null comparisons, confidence intervals, and minimum-support rules.
8. Record every attempted hypothesis, including failures.

## Success criterion

The 100% objective is achieved only when all 12 markets independently score:

- 100% Open Top-6 coverage;
- 100% Close Top-6 coverage;
- 100% Jodi 6x6 coverage;
- on at least 30 sealed forward draws per market;
- with predictions sealed before the relevant outcomes exist;
- with valid data-cutoff and integrity hashes;
- without changing the model during the scoring period.

Until that threshold is met, results are reported as progress or rejection, not achievement.

## Research families

- previous-result and fixed-lag relationships;
- day-to-night and causal cross-market influence graphs;
- digit/Jodi transitions and Markov/HMM state models;
- opposite, mirror, house, family, rotation, and modular transforms;
- frequency, drought, balance, streak, entropy, and saturation features;
- calendar, festival, timing, and regime/change-point effects;
- Bayesian, logistic, tree, boosting, sequence, neural, and calibrated ranking models;
- market-specific interactions, ensembles, and dynamic expert selection;
- known-Open Adjusted Close models;
- automated pattern discovery and adversarial falsification.

## Deliverables

- immutable baseline and data manifest;
- market-wise baseline and challenger ledgers;
- hypothesis registry with Keep/Reject decisions;
- calibration and statistical-significance report;
- failure and miss analysis;
- sealed-forward registry and scorecard;
- final feasibility verdict for the 100% objective.

## Current status

The outcome-history research space is complete under the frozen protocol. No 100%-accurate challenger passed validation, holdout, and recent-frozen gates; the separately frozen forward week also contradicted the earlier 90% expectation. The evidence-backed conclusion and resumption conditions are recorded in `FEASIBILITY_VERDICT.md`; the final eligible nested causal challenger was rejected in `NESTED_CAUSAL_RIDGE_V1_REPORT.md`.

Run the final integrity audit with:

```powershell
node research\goal100\verify-research.cjs
```

The verifier checks the frozen data and production hashes, every fixed-size prediction in both 6,558-row ledgers, causal/exact equality, challenger decisions, artifact hashes, documentation, and the pending 12-entry forward comparator seal.
