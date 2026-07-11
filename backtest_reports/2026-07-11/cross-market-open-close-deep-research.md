# Cross-Market Open/Close Sutta Deep Research

Generated: 2026-07-11

## Executive outcome

This cycle focused exclusively on Open and pre-Open Close Top-6 suttas. It tested day-to-night effects, previous-market and previous-day effects, same weekday/date/week-of-month echoes, opposite digits, houses, panel positions, panel kind, conditional distributions, modular deltas, multi-model voting, and categorical Bayesian learning.

Only one market-specific change passed the chronological no-regression gate: **Milan Night Open uses the completed same-day Sridevi Night Open-panel kind to refine ranks 5–6 while preserving production ranks 1–4.**

- Final 30 days, Milan Night Open: 18/26 (69.2%) → **20/26 (76.9%)**.
- Two years, Milan Night Open: 329/551 (59.7%) → **343/551 (62.3%)**.
- Overall final-30 Open: 221/309 (71.5%) → **223/309 (72.2%)**.
- Overall final-30 Close: unchanged at **209/309 (67.6%)**.
- No validated full-coverage or selective model reached 90% accuracy. The 90% objective remains unproven.

## Leakage controls and test design

- Source cache: 12 markets, 7,287 completed rows.
- Research window: July 2024 through 2026-07-03/05.
- Exact baseline: rankings exported from the production application for each historical case.
- A previous-market feature uses only the latest row strictly before the target date.
- A same-day source is allowed only if its Close time is earlier than the target market's Open time.
- Production ranks 1–4 are frozen; challengers may only change ranks 5–6.
- Rule research blocks: development (age ≥213 days), validation (30–212), holdout (0–29).
- Bayesian research blocks: train (age ≥365), development (213–364), validation (30–212), holdout (0–29).
- One candidate per market/side is selected without looking at holdout. Holdout is used only to keep or revert.

## Accepted Milan Night relationship

Sridevi Night closes at approximately 20:15; Milan Night opens at approximately 21:05. Therefore the completed Sridevi Night result is time-safe for Milan Night Open.

Formula:

1. Build the existing Milan Night calendar-date ranking.
2. Preserve its first four digits exactly.
3. Classify the same-day Sridevi Night Open panel:
   - TP → anchor 1;
   - DP → anchor 2;
   - SP → anchor 3.
4. Build a challenger from Milan Night's smoothed long-run Open frequency and add `0.045` to the anchor digit.
5. Use the challenger only to order the digits outside the frozen first four; take its first two remaining digits for Top-6.
6. If the same-day Sridevi Night panel is unavailable, fall back to the existing Milan Night model.

Evidence:

| Block | Baseline | Hybrid | Delta |
|---|---:|---:|---:|
| Development | 213/371 | 219/371 | +6 hits |
| Validation | 98/154 | 104/154 | +6 hits |
| Final 30 days | 18/26 | 20/26 | +2 hits |
| Full two-year production path | 329/551 | 343/551 | **+14 hits** |

Rolling 90-result research deltas were `+3, +3, 0, -2, +4, +5`: five non-negative blocks and one small negative block.

## Market-wise final 30-day Open/Close accuracy

| Market | N | Open | Change | Close | Change |
|---|---:|---:|---:|---:|---:|
| Sridevi | 30 | 60.0% (18/30) | 0 | 63.3% (19/30) | 0 |
| Time Bazar | 26 | 80.8% (21/26) | 0 | 76.9% (20/26) | 0 |
| Madhur Day | 30 | 60.0% (18/30) | 0 | 63.3% (19/30) | 0 |
| Milan Day | 26 | 73.1% (19/26) | 0 | 65.4% (17/26) | 0 |
| Rajdhani Day | 26 | 76.9% (20/26) | 0 | 69.2% (18/26) | 0 |
| Kalyan | 26 | 80.8% (21/26) | 0 | 65.4% (17/26) | 0 |
| Sridevi Night | 30 | 80.0% (24/30) | 0 | 66.7% (20/30) | 0 |
| Kalyan Night | 19 | 63.2% (12/19) | 0 | 73.7% (14/19) | 0 |
| Madhur Night | 26 | 76.9% (20/26) | 0 | 69.2% (18/26) | 0 |
| Milan Night | 26 | **76.9% (20/26)** | **+2 hits** | 65.4% (17/26) | 0 |
| Rajdhani Night | 22 | 77.3% (17/22) | 0 | 77.3% (17/22) | 0 |
| Main Bazar | 22 | 59.1% (13/22) | 0 | 59.1% (13/22) | 0 |
| **All markets** | **309** | **72.2% (223/309)** | **+2** | **67.6% (209/309)** | **0** |

## Market-wise two-year accuracy after integration

| Market | Open | Open change | Close | Close change |
|---|---:|---:|---:|---:|
| Sridevi | 61.9% | 0 | 56.2% | 0 |
| Time Bazar | 65.0% | 0 | 60.3% | 0 |
| Madhur Day | 61.2% | 0 | 63.0% | 0 |
| Milan Day | 61.0% | 0 | 57.9% | 0 |
| Rajdhani Day | 59.2% | 0 | 68.3% | 0 |
| Kalyan | 61.9% | 0 | 63.3% | 0 |
| Sridevi Night | 61.1% | 0 | 63.8% | 0 |
| Kalyan Night | 65.1% | 0 | 61.1% | 0 |
| Madhur Night | 56.2% | 0 | 60.7% | 0 |
| Milan Night | **62.3%** | **+14 hits** | 60.8% | 0 |
| Rajdhani Night | 63.5% | 0 | 64.8% | 0 |
| Main Bazar | 61.7% | 0 | 61.0% | 0 |

## Day-to-night observations and decisions

| Night target | Strongest observed relationship | Development / validation / holdout delta | Decision |
|---|---|---:|---|
| Sridevi Night Close | Previous Milan Day Close opposite | +7 / +13 / -1 | Reject: holdout regression |
| Kalyan Night Close | Previous Milan Night Open learned delta | +9 / +6 / -2 | Reject: holdout regression |
| Madhur Night Open | Same-day Sridevi Night Open-panel first digit repeat | +9 / +19 / -6 | Reject: severe regime failure |
| Madhur Night Close | Same-day Rajdhani Day Close learned delta | +8 / +16 / -2 | Reject: holdout regression |
| Milan Night Open | Same-day Sridevi Night Open-panel kind | +6 / +6 / +2 | **Keep** |
| Milan Night Close | Same-day Milan Day Close opposite | +10 / +3 / 0 | Reject: unstable rolling blocks |
| Rajdhani Night Open | Previous Time Bazar Open conditional | +8 / +2 / -5 | Reject: severe holdout regression |
| Main Bazar Close | Previous Rajdhani Night Open opposite | +9 / +8 / -1 | Reject: holdout regression |

These failures are important: several relationships looked very strong before the final month and then reversed. This is direct evidence that a single cross-market rule must not be applied universally.

## Calendar, opposite, house, panel, and formula findings

- Same weekday/date/week-of-month echoes produced local gains but no market/side winner survived the complete selection gate.
- Opposite digits frequently appeared among the best development rules, but most failed holdout. They are not universal mappings.
- Same-house and opposite-house rules showed small Close improvements in isolated markets but failed selection stability.
- Panel positions contained more local signal than panel sutta alone in several searches, but almost all winners changed across blocks.
- Learned conditional distributions and modular deltas usually outperformed direct repeat formulas in training, but did not generalize reliably.
- Development-ranked multi-model voting produced an apparent 23/26 Rajdhani Day Open holdout, but rolling deltas were `-2, +3, +4, -4, +8, -1`; it was rejected.
- The categorical Bayesian learner tested temporal-only, previous-market, same-day, and all-feature families. No candidate reached 90%, and its two nominal Close winners merely tied holdout; neither was deployed.

## Night-market analogue-model follow-up

A separate walk-forward nearest-neighbor model compared each night-market context with earlier multivariate contexts. It tested temporal, previous-market sutta, all-sutta, and panel-inclusive distances with multiple neighbor counts and shrinkage strengths.

No market/side passed the full promotion gate. Examples:

- Sridevi Night Close improved validation by 6 hits and holdout by 3, but had no development lift and two negative rolling blocks.
- Madhur Night Close improved development and validation by 11 hits each, then lost 5 hits in holdout.
- Milan Night Open gained 4 holdout hits but lost 12 validation hits.
- Kalyan Night Close lost 7 validation and 7 holdout hits.

Validated ≥90% selective analogue regions: **0**. All analogue candidates were rejected and production remains unchanged.

## Regression audit of the immediately preceding update

The preceding accepted change affected only **Adjusted Close after Open is known**. It did not alter Open or pre-Open Close rankings. This cycle's Open change preserves production ranks 1–4 and changes only Milan Night ranks 5–6. Exact integration tests prove:

- 23 market/side slots are bit-for-result unchanged in the final 30-day and two-year comparisons.
- Milan Night Open improves by +2 final-month hits and +14 two-year hits.
- No Open or pre-Open Close market regressed from this cycle's production change.

## 90% target status

The research explicitly searched for:

- full-coverage Top-6 market models;
- validation-selected high-agreement single-model gates;
- validation-selected high-consensus ensemble gates;
- Bayesian confidence thresholds with at least 30 validation calls.

Results:

- Single-model validated ≥90% regions: **0**.
- Ensemble validated ≥90% regions: **0**.
- Bayesian validated ≥90% regions: **0**.

The goal of above 90% accuracy is therefore **not achieved**. Raising the number of selected digits toward 9/10 would mechanically approach 90% coverage but would not represent predictive improvement, so it was not used to claim success.

## Artifacts

- `scripts/cross-market-sutta-research.py`
- `scripts/cross-market-sutta-bayes.py`
- `scripts/cross-market-sutta-knn.py`
- `scratch/cross-market-sutta-research-output.json`
- `scratch/cross-market-sutta-bayes-output.json`
- `scratch/cross-market-sutta-knn-output.json`
- `scratch/sutta-baseline-730d-cross-market-baseline.json`
- `scratch/sutta-baseline-30d-cross-market-improved.json`
- `scratch/sutta-baseline-730d-cross-market-improved.json`
- `src/lib/sutta-model/open.ts`
