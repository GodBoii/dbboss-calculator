# Exact-Panel Top-60 Model Research

Generated: 2026-07-24

## Decision

The product now exposes the first 60 ranked Open panels and the first 60 ranked
Close panels. The change increases coverage and keeps the existing Open/Close
rankers separate. It does not promote the experimental DP-number, routing, or
post-Open adjustment models.

No tested model supports an 80-90% exact-panel accuracy claim. The strongest
honest results are approximately 35-40%, depending on side and evaluation
window. Presenting a higher number would require hindsight leakage or selecting
far more than 60 of the 220 legal panels.

## Leakage-safe evaluation

The research used three distinct evaluation layers:

1. A chronological terminal block containing 974 untouched market-draw rows.
2. A post-cache forward block containing 150 newly fetched market-draw rows.
3. A production walk-forward backtest over 321 draws in the latest 30-day
   calendar window and 1,840 draws in the latest 180-day window.

For comparison, selecting 60 panels uniformly from 220 covers 27.3% of the
panel universe.

| Evaluator | Open Top-60 | Close Top-60 |
| --- | ---: | ---: |
| Learned model, terminal block | 34.7% (338/974) | 39.9% (389/974) |
| Learned model, post-cache forward block | 39.3% (59/150) | 36.7% (55/150) |
| Fixed-profile control, post-cache forward block | 38.7% | 41.3% |
| Production ranker, latest 30 days | 38.5% | 36.9% |
| Production ranker, latest 180 days | 35.0% | 36.0% |

The terminal-block negative-label controls scored 35.0% Open and 37.6% Close.
Therefore the apparent learned Open advantage is not yet distinguishable from
the temporal/profile structure captured by a control. Close also did not
produce a stable learned-model advantage over the simple fixed-profile model.

## Model families tested

The experiment compared:

- dynamic linear probability models;
- additive market, weekday, and temporal categorical models;
- low-rank neural models;
- Top-60 margin objectives;
- market-frequency and recent-hot controls;
- weighted ensembles;
- market-specific routing;
- pre-Open Close prediction and post-Open adjusted Close prediction;
- positive-label and negative-label ranking angles.

Dynamic cross-entropy models were the best learned models on the selection
block. Top-60-specific margin losses and low-rank neural models were worse.
Combining positive and negative angles did not create independent information:
the negative-label control performed approximately as well as the learned
positive model.

Market-specific routing also failed its forward gate:

| Forward comparison | Open | Close |
| --- | ---: | ---: |
| Global learned model | 39.3% | 36.7% |
| Market-routed model | 39.3% | 38.0% |
| Fixed-profile model | 38.7% | 41.3% |

The routed Close improvement over the global learned model was not statistically
meaningful (paired McNemar p = 0.8642), and it remained below the fixed-profile
control. Routing was therefore rejected for production.

## Additional iteration after the initial audit

Three further model families were frozen and evaluated:

1. **All-market temporal context.** Exact and coarse features from every source
   market whose Close was available before the target Open were combined with
   the latest prior result from every market. Open selection fell from 40.0% to
   37.3%; Close selection fell from 41.7% to 41.0%. The baseline was retained.
2. **Selective confidence and abstention.** Eight score, entropy, boundary,
   agreement, and sutta-concentration signals plus market whitelists were tested
   at predeclared coverage levels of 25-80%. No candidate reached 80% even on
   the block that selected it. The chosen Open gate scored 40.2% forward versus
   39.3% ungated; the chosen Close gate scored 37.0% versus 36.7%.
3. **Hierarchical sutta-to-panel allocation.** Fifty-plus strategies allocated
   exactly 60 slots among predicted suttas before ranking panels within each
   sutta. The selected Open allocation improved selection from 40.0% to 40.9%
   and forward from 39.3% to 42.7%, but failed the terminal block
   (34.7% to 34.5%) and was not significant forward (p = 0.3018). It remains a
   frozen watchlist model. Close selected the unchanged flat ranker.

These results reinforce the same conclusion from independent angles: the
available chart-derived confidence scores do not isolate an 80-90% subset, and
cross-market or hierarchical structure does not yet yield a stable deployable
gain.

## Independent prospective extension

The original chart source stopped between July 17 and July 19. A second public
chart API was therefore audited from its shipped client bundle. Source-market
identity was accepted only when its panels matched the target series exactly on
at least 42 historical overlapping rows. Eleven markets achieved 100% agreement
over 42-61 overlaps. The same-named Rajdhani Day series matched 0/42 and was
excluded.

This recovered 44 genuinely later rows dated July 20-23 without changing any
model:

| Frozen strategy | Open Top-60 | Close Top-60 |
| --- | ---: | ---: |
| Learned flat model | 54.5% (24/44) | 25.0% (11/44) |
| Hierarchical watchlist | 43.2% (19/44) | 25.0% (11/44) |
| Cross-market contextual challenger | 50.0% (22/44) | 27.3% (12/44) |
| Actual production predictor | 47.7% (21/44) | 40.9% (18/44) |

The hierarchy lost five Open hits relative to the flat learned model
(paired p = 0.0625). Combined with its prior forward comparison, its discordant
hits are now tied 10-10 (p = 1.0), eliminating its earlier apparent advantage.
The contextual Close result differed from the learned baseline by only one net
hit (4 model-only versus 3 baseline-only, p = 1.0).

No strategy was promoted. The block remains below the predeclared 100-row
prospective minimum, no challenger has a paired p-value below 0.05 across
confirmation blocks, and the requested 80-90% rate remains unsupported.

During this replay, the backtest window was found to use local-time date
arithmetic, which shifted inclusive windows one day earlier in IST. Window
boundaries now use UTC arithmetic and have a dedicated regression verifier.

## Why 80-90% is not supported

Even an optimistic hindsight frequency table using market plus weekday reaches
about 81%, but it learns from the same rows it scores and is not a deployable
forecast. Hindsight market-only Top-60 tables reach only about 53%.

To include the actual panel in 90% of rows, the median hindsight set needed
about 142 Open panels and 138 Close panels, not 60. The terminal evaluation
would require 877 hits for a 90% result; the learned models were short by 539
Open hits and 488 Close hits.

Under a uniform 220-panel reference, a 90%-accurate Top-60 selector requires
roughly 1.264 bits of usable pre-draw information per draw by the generalized
Fano bound. The prior information audit found only about 0.041 bits for Open
and 0.004 bits for Close in the available historical outcome features. More
formulas over the same result chart are therefore likely to overfit rather than
close this gap.

## Product and betting implications

Top-60 should be described as coverage, not confidence. It selects 27.3% of the
legal panel universe and currently captures roughly 35-40% of observed results.
That is a measurable lift, but placing 60 equal-stake panel bets can still have
negative expected value after payout rules, limits, commissions, and correlated
bet costs are included.

DP two-number calls remain especially unsupported and should not be used as a
high-confidence gate. Choukda multiplies two uncertain events, so its hit rate
is necessarily below either component. MPSP/MPDP can show higher raw coverage
only by covering many digits or panels; profitability must be evaluated against
the exact ticket cost and payout, not accuracy alone.

## Evidence needed for a genuine next step

The most promising additional inputs are timestamped information available
before the draw that is not derivable from the result chart:

- aggregate stake or liability by panel and digit;
- bookmaker price or odds movement;
- timestamped public-tip volume;
- market suspension, limit, and settlement events;
- audited operator-side or exchange-flow data.

Any new signal should be frozen before its target draw and admitted only after a
chronological selection block, an untouched terminal block, and a later
post-freeze forward block. Until such data exists, the honest product is a
ranked Top-60 coverage tool with visible backtest rates, not an 80-90% predictor.

## Reproducible artifacts

- `research/panel_top60_v1/REPORT.md`
- `research/panel_top60_v1/ROUTING_REPORT.md`
- `research/panel_top60_v1/results.json`
- `research/panel_top60_v1/routing_results.json`
- `research/panel_top60_cross_market_v1/REPORT.md`
- `research/panel_top60_selective_v1/REPORT.md`
- `research/panel_top60_selective_v1/FROZEN_GATE.json`
- `research/panel_top60_hierarchical_v1/REPORT.md`
- `research/panel_top60_hierarchical_v1/FROZEN_WATCHLIST.json`
- `research/panel_top60_prospective_v2/REPORT.md`
- `research/panel_top60_prospective_v2/independent_forward_records.json`
- `research/panel_top60_prospective_v2/ledger.csv`
- `backtest_reports/2026-07-24/top60-production-backtest.md`
- `backtest_reports/2026-07-24/top60-production-backtest.json`
- `backtest_reports/2026-07-24/top60-independent-production-score.md`
- `scripts/panel-top60-production-backtest.cjs`
- `scripts/panel-top60-independent-production-score.cjs`
- `scripts/verify-backtest-utc-window.cjs`
- `scripts/verify-panel-top60.cjs`
