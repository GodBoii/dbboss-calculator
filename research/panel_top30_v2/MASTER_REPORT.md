# Exact-panel Top-30 research master report

Generated: 2026-07-15

## Goal status

The requested 90% exact-panel Top-30 accuracy has **not** been achieved. The research is
blocked pending a materially new pre-Open data source. The available public outcome history
has been exhausted across the audited causal model families. No result is promoted by
changing the metric, using more than 30 panels, choosing markets after seeing test outcomes,
or allowing future/same-day leakage.

## Strongest verified results

| Model family | Open terminal | Close terminal | Open forward | Close forward | Decision |
|---|---:|---:|---:|---:|---|
| Two-year causal v2 | 173/974 (17.8%) | **216/974 (22.2%)** | 17/78 (21.8%) | **15/78 (19.2%)** | Current research reference |
| Extended lifetime/history-window | 166/974 (17.0%) | 182/974 (18.7%) | 18/78 (23.1%) | 10/78 (12.8%) | Reject |
| 64-event exact-panel GRU | **174/974 (17.9%)** | 178/974 (18.3%) | 19/78 (24.4%) | 12/78 (15.4%) | Open research challenger only |
| Long-cycle/same-day library | 158/974 (16.2%) | 170/974 (17.5%) | 22/78 (28.2%) | 11/78 (14.1%) | Reject; forward-only Open spike |
| Conditional-context audit | 162/974 (16.6%) | 193/974 (19.8%) | 19/78 (24.4%) | 13/78 (16.7%) | Reject; no stable information lift |

No single model is close to 90% on either verification block. The strongest Close result is
the original two-year causal model. The event GRU adds one Open hit on the terminal block
and two on the forward block, but the effect is far too small to establish a 90% path.

## Data expansion and reconciliation

- Trusted cache: 7,287 completed rows covering the recent two years.
- Extended public charts: 23,279 parsed completed rows.
- Exact overlap: 7,287/7,287 records, including Open and Close panels and suttas.
- Three older non-canonical source rows were dropped without guessed corrections.
- Canonical extended research set: 23,276 rows across 12 markets.
- Availability varies by market, from 2013–2026 at the longest to 2022–2026 at the shortest.
- Older/recent distribution drift is material; market-side Jensen–Shannon divergence reaches
  about 0.20.

The expanded history therefore supplies valid additional data, but it reduces rather than
improves terminal and forward accuracy.

## Experiment families completed

### Causal v2 models

- Long/recent/weekday exact-panel frequencies.
- Position, pair, sutta, kind, and transition profiles.
- Lag overlap and opposite transformations.
- Timing-safe same-day source features.
- Dynamic market-specific linear models.
- Additive categorical conditional tables.
- Low-rank neural models.
- Cross-entropy and direct Top-30 margin objectives.
- Fixed-profile/learned probability blends.
- Adjusted Close after the Open panel becomes known.

### Extended-history models

- 180-, 365-, 730-day, and lifetime histories.
- Dynamic and additive models with identical chronological gates.
- Same terminal and post-cache comparisons as the two-year models.

### Actual-time event model

- Last 64 completed events ordered by real market Close times.
- Strict invariant: each event Close timestamp is earlier than target Open timestamp.
- Shared 220-class Open and pre-Open Close GRU heads.
- 16,097 targets and zero cutoff violations.

### Long-cycle and same-day library

- 260 rankers per side.
- Calendar lags: 7, 14, 21, 28, 35, 56, 91, 182, and 364 days.
- Row lags: 5, 10, 20, 40, 80, 160, and 260 draws.
- Exact echo, digit overlap, digit opposite, same sutta, and opposite sutta.
- Timing-safe aggregation of all markets closed before the target Open.
- Calendar, row, same-day, and combined consensus variants.

### Conditional-information audit

- 49 causal conditional models per side over 16,097 event targets.
- Calendar, prior-own-market sutta/kind, last completed cross-market event, coarse regime,
  and nearest-event-context features.
- Top-30 selection and probability-information selection were kept separate.
- Best historical-context information gain over a market-marginal model was 0.101 bits/draw
  for Open and 0.062 for Close on the terminal block.
- Those gains fell to 0.041 Open and 0.004 Close on the forward block.

## Falsification evidence

- The 90% target needs 877 hits in each 974-row terminal side. The best observed totals are
  174 Open and 216 Close.
- In hindsight, a median 142 Open or 138 Close panel labels are needed to cover 90% of each
  market's outcomes—not 30.
- Even hindsight market+weekday Top-30 lists cover only 51.5%.
- Effective outcome counts are approximately 163 Open and 160 Close panels.
- Permuting training labels within market leaves much of the apparent accuracy intact,
  showing that marginal market frequencies explain a substantial portion of performance.
- Adjusted Close matched its permuted-label control and deteriorated on the forward slice.
- Longer history, greater capacity, Top-30-specific loss, exact event sequences, long cycles,
  and broader same-day inputs all failed to produce a stable large lift.
- A uniform generalized-Fano calculation puts the necessary mutual-information scale for 90%
  Top-30 coverage at about 2.14 bits/draw; even a looser conservative form is 1.59 bits/draw.
  This is a necessary-scale comparison under a uniform-label assumption, not a proof that no
  unobserved causal feature could work.

## Evidence required for a credible 90% path

Historical published outcomes alone do not demonstrate the conditional information needed
for 90% coverage with 30 labels. A materially new data source would be required, such
as timestamped operator/liability exposure, stake distribution by panel, payout pressure,
result-generation provenance, or another feature causally available before market Open.

Without such inputs, continued formula search over the same outcomes primarily increases
multiple-testing and overfitting risk.

## Reproducibility index

- `REPORT.md` and `results.json`: two-year v2 model selection and stress tests.
- `EXTENDED_AUDIT.md` and `extended_audit.json`: source reconciliation.
- `EXTENDED_REPORT.md` and `extended_results.json`: history-window experiment.
- `EVENT_SEQUENCE_REPORT.md` and `event_sequence_results.json`: exact-panel event GRU.
- `LONG_CYCLE_REPORT.md` and `long_cycle_results.json`: 260-ranker cycle library.
- `INFORMATION_CEILING_REPORT.md` and `information_ceiling_results.json`: causal conditional
  feature and information-gain audit.
- Corresponding ledgers contain every terminal and post-cache Top-30 prediction.
- All code and serialized artifacts remain under `research/panel_top30_v2/` and are not wired
  into the application.
