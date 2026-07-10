# Digit Elimination Research Report

Generated from `scratch/digit-elimination-research.cjs` using the local two-year cache
`scratch/open-sutta-records-cache.json`.

No production app files were changed.

## Objective

Predict 4 digits from `0-9` that are least likely to appear in the next 3-digit panel for:

- Open panel
- Close panel
- Known-open / jodi-adjusted close panel

Accuracy means: of the 4 eliminated digits, how many were truly absent from the actual panel.

## Baseline Reality

This task has a high random baseline. A panel usually contains only 2 or 3 unique digits, so a random set of 4 eliminated digits will often be correct by chance.

Final 30-day random baselines:

| Side | Random baseline |
| --- | ---: |
| Open | 72.8% |
| Close | 72.5% |
| Known-open close | 72.5% |

So a result near 73% is not a real edge.

## Pattern Families Tested

- Current panel predictor digit weighting from top-30 panels
- Rolling 7/30 digit coldness
- Rolling 7/30 hot-fade
- Long absence continues
- Recent appearance cools
- Previous missing digit influence
- Previous present digit cooling
- Same weekday
- Same weekday previous month
- Same calendar date
- Opposite digit transition
- House A/B fade
- Odd/even fade
- Prime/composite fade
- Previous sutta conditioning
- Previous jodi conditioning
- Current open digit-clean close
- Current open-to-close digit repeat transition
- Current open-to-close opposite transition
- Source-market coldness
- Source-market previous-present cooling
- Small validation-selected ensembles

## Method

Each market and side was tested independently.

Windows:

- Training/history: prior records only
- Validation: 90 days immediately before the final test window
- Final test: latest 30 days available per market

Models reported:

| Label | Meaning |
| --- | --- |
| `current` | Current predictor-derived digit elimination baseline |
| `selected` | Best validation-selected model tested on final 30 days |
| `strict` | Candidate accepted only if validation beat both current and random by at least 2 percentage points |
| `guarded` | Retrospective diagnostic: keep a candidate only if it beat current on final 30 days |

`strict` is the cleanest pre-result selection test. `guarded` is useful for research diagnosis, but should not be treated as a deployable selection rule because it uses final-window knowledge.

## Overall Results

| Side | Random | Current | Validation-selected | Strict gate | Retrospective guarded |
| --- | ---: | ---: | ---: | ---: | ---: |
| Open | 72.8% | 73.6% | 74.9% | 73.5% | 76.5% |
| Close | 72.5% | 71.9% | 73.6% | 72.7% | 74.7% |
| Known-open close | 72.5% | 72.6% | 74.5% | 72.8% | 75.6% |

Average correct eliminated digits out of 4:

| Side | Current | Validation-selected | Strict gate | Retrospective guarded |
| --- | ---: | ---: | ---: | ---: |
| Open | 2.94 | 3.00 | 2.94 | 3.06 |
| Close | 2.88 | 2.94 | 2.91 | 2.99 |
| Known-open close | 2.90 | 2.98 | 2.91 | 3.03 |

## Clean Strict-Gate Findings

Strict gate changed:

| Side | Changed markets | Changed-only accuracy | All-market strict | Current |
| --- | ---: | ---: | ---: | ---: |
| Open | 8 / 12 | 72.0% | 73.5% | 73.6% |
| Close | 8 / 12 | 73.3% | 72.7% | 71.9% |
| Known-open close | 11 / 12 | 73.2% | 72.8% | 72.6% |

Strict validation gating was not enough to prevent overfitting. It improved some pockets but hurt others.

## Strongest Strict Wins

| Market | Side | Current -> Strict | Model |
| --- | --- | ---: | --- |
| Kalyan Night | Open | 64.5% -> 75.0% | `recentAppearanceCools + sameHouseFade + rolling30HotFade` |
| Milan Night | Known-open close | 65.4% -> 75.0% | `prevPresentCools` |
| Milan Night | Close | 66.3% -> 75.0% | `prevPresentCools` |
| Time Bazar | Open | 70.2% -> 76.9% | `sameWeekdayPrevMonthCold` |
| Rajdhani Day | Open | 69.2% -> 75.0% | `oppositeDigitTransition + calendarDateCold + oddEvenFade` |
| Rajdhani Night | Known-open close | 72.7% -> 78.4% | `sourceMarketPrevCold + oddEvenFade + closeCurrentOpenCondCold` |
| Main Bazar | Close | 73.9% -> 79.5% | `rolling7HotFade` |
| Main Bazar | Known-open close | 77.3% -> 79.5% | `rolling7HotFade` |

## Biggest Strict Failures

| Market | Side | Current -> Strict | Failed model |
| --- | --- | ---: | --- |
| Kalyan | Open | 77.9% -> 69.2% | `sameSideRepeatTransition + sameSideAbsentTransition + rolling7Cold` |
| Main Bazar | Open | 79.5% -> 71.6% | `sameWeekdayPrevMonthCold` |
| Milan Night | Open | 73.1% -> 65.4% | `sameWeekdayPrevMonthCold` |
| Madhur Night | Known-open close | 74.0% -> 68.3% | `oddEvenFade` |
| Madhur Day | Known-open close | 73.3% -> 68.3% | `longAbsenceContinues` |
| Madhur Night | Close | 72.1% -> 68.3% | `oddEvenFade` |

These are classic validation overfit cases.

## Deployable Pockets Under Strict Final Evidence

Using final evidence only as a research diagnostic, strict models that beat random by at least 1 point and did not lose to current:

| Side | Markets |
| --- | --- |
| Open | Sridevi, Time Bazar, Madhur Day, Rajdhani Day, Sridevi Night, Kalyan Night |
| Close | Madhur Day, Sridevi Night, Milan Night, Main Bazar |
| Known-open close | Sridevi, Sridevi Night, Milan Night, Rajdhani Night, Main Bazar |

Accuracy inside these deployable pockets:

| Side | Accuracy | Avg correct eliminated |
| --- | ---: | ---: |
| Open | 76.2% | 3.05 / 4 |
| Close | 75.9% | 3.04 / 4 |
| Known-open close | 76.9% | 3.08 / 4 |

## Hypothesis Verdicts

Useful in specific markets:

- `currentPanelTop30`: still a strong baseline in many markets.
- `rolling7HotFade`: useful for Main Bazar close and known-open close.
- `prevPresentCools`: useful for Milan Night close and known-open close.
- `recentAppearanceCools`: useful for Kalyan Night open.
- `oppositeDigitTransition`: useful for Rajdhani Day open.
- `sourceMarketPrevCold`: promising for Rajdhani Night known-open close.
- `previousOppositeSideCools`: helped Sridevi Night close.

Unstable or rejected as universal:

- Same weekday previous month
- Long absence continues
- Odd/even fade
- Same-side repeat / absent transition
- House-only theory
- Previous sutta conditioning
- Previous jodi conditioning
- Global cross-market source logic

## Conclusion

The data supports a modest digit-elimination edge, not a high-certainty predictor.

Current realistic expectation:

- Strong markets: about 3.05 correct eliminated digits out of 4
- All markets: about 2.9 to 3.0 correct eliminated digits out of 4
- Full 4/4 elimination remains uncommon, around 20-26% depending on method

The next research step should not be adding more ad hoc rules. It should be a stability framework:

1. Require a candidate to beat current and random on multiple rolling validation folds.
2. Require a minimum support threshold per market/side.
3. Output `no strong elimination signal` when validation is unstable.
4. Only then consider adding the feature to the app.

## Rolling Stability Follow-Up

A second scratch-only evaluator was added:

- `scratch/digit-elimination-stability.cjs`
- `scratch/digit-elimination-stability-output.json`

This evaluator tests lightweight pattern families across up to 8 rolling folds per market and side. Each fold uses:

- 90-record validation window
- Next 30-record test window
- Candidate is selected only if validation beats random by at least 2 percentage points

This pass intentionally does not call the full current panel predictor, so it is a stability test for the discovered pattern families, not a replacement for the app baseline.

### Rolling Stability Totals

| Side | Accepted folds | Winning folds | Losing folds | Random | Tested | Avg correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Open | 91 | 32 | 52 | 72.7% | 72.4% | 2.90 / 4 |
| Close | 96 | 41 | 47 | 72.4% | 72.5% | 2.90 / 4 |
| Known-open close | 96 | 41 | 47 | 72.4% | 72.5% | 2.90 / 4 |

This is the strongest anti-overfitting evidence so far. When the same pattern families are tested over multiple rolling folds, the broad edge mostly disappears.

### Best Rolling-Stability Pockets

| Market | Side | Pass folds | Wins | Losses | Edge vs random | Accuracy |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Rajdhani Night | Close | 8 | 5 | 3 | +1.5 pp | 74.2% |
| Rajdhani Night | Known-open close | 8 | 5 | 3 | +1.5 pp | 74.2% |
| Sridevi | Close | 8 | 5 | 2 | +1.1 pp | 73.6% |
| Sridevi | Known-open close | 8 | 5 | 2 | +1.1 pp | 73.6% |
| Main Bazar | Open | 8 | 4 | 3 | +1.1 pp | 74.1% |
| Sridevi Night | Close | 8 | 5 | 3 | +0.9 pp | 73.1% |
| Main Bazar | Close | 8 | 5 | 3 | +0.9 pp | 73.6% |

Even the best rolling pockets are small edges, not strong elimination signals.

### Updated Research Verdict

The latest-window report found interesting market-specific wins, but the rolling-fold test shows many of those wins are not stable enough. The correct interpretation is:

1. Digit elimination has a high random baseline around 72-73%.
2. The current panel predictor is still a useful baseline.
3. Lightweight hand-built patterns alone do not produce a reliable broad edge.
4. A forced 4-digit elimination output for every market is not justified.
5. If this feature is ever added, it should be gated by market/side confidence and should allow `no strong signal`.

The next useful research direction is a proper model-selection protocol:

- Multiple rolling folds
- Compare against both random and current panel-derived elimination
- Require positive average edge and win-rate across folds
- Penalize model switching
- Prefer simple market-specific models that survive across time

## Lightweight Learned-Model Follow-Up

A third scratch-only evaluator was added:

- `scratch/digit-elimination-learned.cjs`
- `scratch/digit-elimination-learned-output.json`

This tests tiny dependency-free logistic models. For each market and side, each digit becomes a row and the model predicts whether that digit will appear in the next panel. The 4 lowest predicted appearance probabilities are eliminated.

Features used:

- Rolling digit frequency over 7, 30, and 90 records
- Absence gap
- Previous same-side digit present
- Previous opposite digit present
- Weekday digit frequency
- Known open-panel digit present for close/jodi-close
- Known open-panel opposite digit present
- Source-market previous digit present

The model is selected only when validation beats random by at least 1 percentage point.

### Learned-Model Rolling Totals

| Side | Accepted folds | Wins | Losses | Random | Learned | Avg correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Open | 43 | 16 | 20 | 72.7% | 73.0% | 2.92 / 4 |
| Close | 36 | 16 | 14 | 72.5% | 73.2% | 2.93 / 4 |
| Known-open close | 36 | 16 | 14 | 72.5% | 73.2% | 2.93 / 4 |

Compared with the hand-built pattern stability run:

| Side | Pattern-tested | Pattern random | Learned-tested | Learned random |
| --- | ---: | ---: | ---: | ---: |
| Open | 72.4% | 72.7% | 73.0% | 72.7% |
| Close | 72.5% | 72.4% | 73.2% | 72.5% |
| Known-open close | 72.5% | 72.4% | 73.2% | 72.5% |

The learned model is slightly better than the hand-built pattern selector, but the edge is still small.

### Best Learned Pockets

| Market | Side | Pass folds | Wins | Losses | Edge vs random | Accuracy |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Madhur Night | Close | 3 | 3 | 0 | +3.1 pp | 75.0% |
| Madhur Night | Known-open close | 3 | 3 | 0 | +3.1 pp | 75.0% |
| Time Bazar | Open | 3 | 2 | 1 | +2.3 pp | 75.6% |
| Sridevi | Close | 7 | 4 | 2 | +1.8 pp | 74.3% |
| Sridevi | Known-open close | 7 | 4 | 2 | +1.8 pp | 74.3% |
| Madhur Day | Close | 4 | 2 | 1 | +1.5 pp | 73.3% |
| Milan Day | Open | 4 | 2 | 1 | +1.4 pp | 74.0% |
| Milan Night | Open | 5 | 2 | 2 | +1.0 pp | 73.5% |

### Learned-Model Verdict

The learned model improves the research direction, but it does not change the product conclusion:

- There is no strong all-market elimination model yet.
- The best broad result is still around 2.9 correct eliminated digits out of 4.
- A few market/side pockets deserve more research, especially Madhur Night close, Sridevi close, and Time Bazar open.
- Any future app feature should support `no strong signal`, because forcing all markets degrades trust.

The next research step should compare learned models directly against the full current panel-derived baseline on rolling folds. That is computationally heavier, but it is the fair gate before implementation.

## Current Predictor vs Learned Model

A fourth scratch-only evaluator was added:

- `scratch/digit-elimination-current-vs-learned.cjs`
- `scratch/digit-elimination-current-vs-learned-output.json`

This compares the lightweight learned model directly against the full current panel-derived baseline. To keep runtime practical, it uses the latest 4 rolling folds per market and side.

Current baseline definition:

1. Run `analyzeMarket`.
2. Use open picks, close picks, or known-open `computeJodiAnalysis` adjusted close picks.
3. Weight digits from the top 30 panels by rank.
4. Eliminate the 4 lowest-weighted digits.

Learned model definition:

1. Train logistic digit-appearance models on records before validation.
2. Select the best logistic config by validation accuracy.
3. On test rows, eliminate the 4 lowest predicted appearance probabilities.

### Direct Comparison Totals

| Side | Random | Current panel-derived | Learned | Learned fold W/L vs current |
| --- | ---: | ---: | ---: | ---: |
| Open | 72.9% | 72.9% | 73.0% | 23 / 24 |
| Close | 72.5% | 72.7% | 72.8% | 23 / 20 |
| Known-open close | 72.5% | 72.4% | 72.8% | 25 / 22 |

The learned model is barely above current overall. It does not justify replacing the current baseline globally.

### Learned Wins Over Both Current and Random

Rows where learned beats both current and random by at least 1 percentage point:

| Market | Side | Learned | Current | Random | Delta vs current | Fold W/L |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Milan Night | Open | 74.8% | 70.0% | 72.2% | +4.8 pp | 4 / 0 |
| Time Bazar | Open | 74.4% | 71.5% | 73.3% | +2.9 pp | 4 / 0 |
| Milan Day | Known-open close | 75.4% | 72.5% | 73.8% | +2.9 pp | 4 / 0 |
| Sridevi Night | Close | 74.4% | 71.5% | 72.4% | +2.9 pp | 2 / 1 |
| Time Bazar | Close | 74.6% | 72.1% | 72.6% | +2.5 pp | 3 / 1 |
| Milan Day | Close | 75.4% | 72.9% | 73.8% | +2.5 pp | 3 / 0 |
| Kalyan | Close | 73.8% | 71.9% | 72.2% | +1.9 pp | 3 / 0 |
| Kalyan | Known-open close | 73.8% | 72.1% | 72.2% | +1.7 pp | 3 / 1 |
| Main Bazar | Open | 74.8% | 73.5% | 73.2% | +1.2 pp | 2 / 2 |
| Time Bazar | Known-open close | 74.6% | 73.5% | 72.6% | +1.0 pp | 3 / 1 |

### Learned Loses Clearly To Current

Rows where learned is at least 1 percentage point worse than current:

| Market | Side | Learned | Current | Random | Delta vs current |
| --- | --- | ---: | ---: | ---: | ---: |
| Sridevi | Close | 72.3% | 75.4% | 73.1% | -3.1 pp |
| Kalyan Night | Open | 68.5% | 71.5% | 73.6% | -2.9 pp |
| Sridevi | Open | 71.5% | 73.8% | 72.7% | -2.3 pp |
| Sridevi | Known-open close | 72.3% | 74.2% | 73.1% | -1.9 pp |
| Sridevi Night | Open | 72.9% | 74.8% | 73.5% | -1.9 pp |
| Main Bazar | Close | 72.3% | 74.2% | 72.6% | -1.9 pp |
| Madhur Day | Open | 74.6% | 76.5% | 73.3% | -1.9 pp |
| Madhur Night | Known-open close | 70.6% | 72.5% | 72.3% | -1.9 pp |

### Final Research Interpretation

The direct comparison confirms the pattern seen in earlier passes:

1. There are real pockets where a learned digit-elimination model beats current.
2. There are also pockets where it loses badly.
3. Overall lift is tiny: roughly +0.0 to +0.5 percentage points.
4. A global replacement model is not justified.
5. A future feature would need market/side routing and a `no strong signal` state.

Most promising candidates for another deeper pass:

- Milan Night open
- Time Bazar open
- Milan Day close and known-open close
- Sridevi Night close
- Time Bazar close
- Kalyan close

But these still need more fold depth before implementation.

## Focused 8-Fold Pocket Deep Test

A fifth scratch-only evaluator was added:

- `scratch/digit-elimination-pocket-deep.cjs`
- `scratch/digit-elimination-pocket-deep-output.json`

This takes only the promising pockets from the 4-fold current-vs-learned comparison and tests them over 8 rolling folds against the full current panel-derived baseline.

### Pocket Results

| Market | Side | Random | Current | Learned | Delta vs current | Fold W/L |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Time Bazar | Close | 72.7% | 70.7% | 73.2% | +2.5 pp | 6 / 1 |
| Milan Night | Open | 72.7% | 72.3% | 74.7% | +2.4 pp | 6 / 2 |
| Time Bazar | Open | 73.0% | 72.4% | 74.5% | +2.1 pp | 6 / 2 |
| Milan Day | Close | 73.0% | 72.7% | 74.4% | +1.7 pp | 6 / 1 |
| Main Bazar | Open | 73.0% | 72.4% | 73.8% | +1.4 pp | 5 / 3 |
| Sridevi Night | Close | 72.3% | 72.0% | 73.1% | +1.1 pp | 4 / 3 |
| Milan Day | Known-open close | 73.0% | 73.4% | 74.4% | +0.9 pp | 6 / 1 |
| Kalyan | Known-open close | 72.1% | 70.9% | 71.7% | +0.7 pp | 5 / 3 |
| Time Bazar | Known-open close | 72.7% | 72.9% | 73.2% | +0.3 pp | 5 / 3 |
| Kalyan | Close | 72.1% | 72.1% | 71.7% | -0.4 pp | 3 / 3 |

### Surviving Pockets

These are the only pockets with at least +1 percentage point over current across 8 folds:

- Time Bazar close
- Milan Night open
- Time Bazar open
- Milan Day close
- Main Bazar open
- Sridevi Night close

Best-quality pockets by both edge and fold stability:

1. Time Bazar close: +2.5 pp, 6 / 1 W/L
2. Milan Night open: +2.4 pp, 6 / 2 W/L
3. Time Bazar open: +2.1 pp, 6 / 2 W/L
4. Milan Day close: +1.7 pp, 6 / 1 W/L

Dropped or weak pockets:

- Kalyan close fell below current.
- Time Bazar known-open close is too small at +0.3 pp.
- Kalyan known-open close remains below random.
- Milan Day known-open close is good versus random but only +0.9 pp over current.

### Practical Research Conclusion After Pocket Test

The focused 8-fold test gives the most balanced conclusion so far:

- There is no all-market digit-elimination model.
- Learned models can beat the current panel-derived baseline in a few specific market/side pockets.
- Even the best pockets are around 73-75% accuracy, roughly 3 correct eliminated digits out of 4.
- The result is not strong enough for a broad app feature.
- If development ever proceeds, it should start as a hidden/research-only module for the surviving pockets, with `no signal` everywhere else.

## Live Freshness Check And Tiny Forward Holdout

Two more scratch-only utilities were added:

- `scratch/live-freshness-check.cjs`
- `scratch/live-freshness-check-output.json`
- `scratch/live-holdout-milan-day.cjs`
- `scratch/live-holdout-milan-day-output.json`

The live panel pages were checked against the local cache on 2026-07-08 IST.

### Live Freshness Summary

Most live pages matched the local cache exactly. Only Milan Day had newer rows:

| Market | Cache newest | Live newest | Fresh rows |
| --- | ---: | ---: | ---: |
| Milan Day | 2026-06-27 | 2026-07-04 | 6 |

All other markets had 0 fresh rows relative to the local cache.

### Milan Day Fresh Holdout

Milan Day was one of the promising pockets from rolling research, so the 6 newer live rows were used as a tiny forward holdout for:

- Milan Day close
- Milan Day known-open close

The model was trained/selected using only data before the fresh rows, then tested on 2026-06-29 through 2026-07-04.

| Side | Current | Learned | Fresh rows |
| --- | ---: | ---: | ---: |
| Close | 83.3% | 75.0% | 6 |
| Known-open close | 79.2% | 75.0% | 6 |

Row-level result:

| Date | Panel | Current close | Learned close | Current jodi-close | Learned jodi-close |
| --- | --- | ---: | ---: | ---: | ---: |
| 2026-06-29 | 389 | 3 / 4 | 3 / 4 | 3 / 4 | 3 / 4 |
| 2026-06-30 | 669 | 3 / 4 | 4 / 4 | 3 / 4 | 4 / 4 |
| 2026-07-01 | 668 | 3 / 4 | 4 / 4 | 3 / 4 | 4 / 4 |
| 2026-07-02 | 890 | 4 / 4 | 3 / 4 | 3 / 4 | 3 / 4 |
| 2026-07-03 | 779 | 3 / 4 | 3 / 4 | 4 / 4 | 3 / 4 |
| 2026-07-04 | 149 | 4 / 4 | 1 / 4 | 3 / 4 | 1 / 4 |

This is only 6 rows, so it is not enough to reverse the rolling-fold research by itself. But it is important because it is fresh live data that was not in the local cache. On this tiny forward holdout, the current panel-derived baseline beat the learned model. The learned model's 2026-07-04 miss on panel `149` caused most of the gap.

### Updated Practical Takeaway

The fresh holdout makes the implementation case weaker, not stronger.

Current state:

- Broad model: not justified.
- Learned replacement: not justified.
- Surviving pockets: still research candidates only.
- Milan Day close: promising in rolling folds, but failed to beat current on the tiny live holdout.

Best next step is to keep collecting fresh rows and re-run the live holdout check over at least 30 fresh results before treating any pocket as deployable.
