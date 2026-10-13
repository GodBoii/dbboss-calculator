# Two-year panel refit and nonlinear interactions

Use only the frozen two-year source dated 2024-10-09 through 2026-10-08. Validate its hash and every calendar date, weekday, legal panel, ordering, and comparator outcome. Score the same target events as the existing two-year comparator, with 180 completed own-market warmup draws. Every ranking returns ten distinct panels from the same 220-panel universe.

Use the 22 deployable features of the existing panel model. Reuse the existing research feature builder without its three pooled columns. All history is strictly prior-date; live Close additionally receives its own declared target Open panel. Open receives neither target panel. Fit normalization only on training observations, and disable random internal validation/early stopping.

Fix three candidate models before execution:

1. Conditional logit refit on this restricted source, with L2=0.001.
2. Histogram gradient-boosted binary panel classifier with 3 leaves per tree.
3. The same classifier with 7 leaves per tree.

Both tree candidates use 60 iterations, learning rate 0.05, minimum 500 panel examples per leaf, L2=20, 64 histogram bins, early stopping disabled, and random seed 1729. Each target supplies all 220 candidate examples, with exactly one positive actual panel. Do not alter class weights. Sort classifier scores within a target using canonical panel order for ties. Binary probabilities are ranking scores, not automatically calibrated 220-way outcome probabilities.

Fit on comparator targets through 2025-12-31. Choose one model per side on 2026-01-01 through 2026-07-02 by Top-10 accuracy, with fixed protocol order resolving ties. Refit that choice on all comparator targets through 2026-07-02. Freeze it for 2026-07-03 through 2026-10-08. The existing production panel weights were fit through July 2 as well, so the main paired comparison occurs after both weight-fitting cutoffs.

Report every candidate on selection and the two selected models on the later block, September-October and last-30-day slices, and each market. Save all selected predictions, binary hits, fitted candidate parameters, hashes, software versions, and paired gains/losses. Use whole-date bootstrap intervals and 97.5% intervals for the two selected task comparisons. Verify Python production-feature ranking against the saved TypeScript Top-10 comparator using the deployed rounded weights before accepting an experiment. Test that changing the current Close or a future row cannot alter earlier features; live Close is allowed to react to its current Open.

The dataset has appeared in many earlier studies. This is retrospective evaluation with chronological training, not blind prospective confirmation. Do not promote a model based on one market, a larger shortlist, more permissive gates, or an exploratory candidate chosen after seeing later outcomes. A production change requires a positive family-adjusted later interval, positive September-October and last-30-day point estimates, improvement across at least six markets, and runtime parity with the frozen candidate. Otherwise save the rejection decision and leave app/PWA versions unchanged.
