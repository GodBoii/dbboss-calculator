# Sutta Prediction Model Notes

This file records what we have changed so far for the sutta prediction layer and which model is currently used market-wise for three categories:

1. Open sutta prediction
2. Close sutta prediction
3. Open-adjusted close prediction, also shown in the app as Jodi Close after the user enters today's open result

Main implementation files:

- `src/components/analysis/AnalysisTabs.tsx`
- `src/components/AnalysisSection.tsx`
- `src/lib/predictor/jodi.ts`
- `scratch/open-sutta-research.cjs`
- `scratch/close-sutta-research.cjs`
- `scratch/unified-sutta-backtest.cjs`

## What We Changed So Far

### 1. Separated open and close sutta logic

Earlier, the copy workflow could feel like one shared sutta list. We changed it so open and close are treated separately:

- Open sutta uses `result.openPicks` and `result.openSuttaDroughts`.
- Close sutta uses `result.closePicks` and `result.closeSuttaDroughts`.
- Open-adjusted close uses `jodiResult.adjustedClosePicks` when today's open is entered.

This matters because the same digit can be fresh for open but heated or snapback for close.

### 2. Added market-wise open sutta routing

The first improvement was a global open-sutta method, but some markets got worse. We then tested market-wise behavior and moved each market to the open selector that performed better for its pattern.

The biggest lesson: one global model is weaker than market-wise routing.

Examples:

- Kalyan improved by reverting to `rankOnly`.
- Kalyan Night improved at wider counts by using `weightedSnap`.
- Rajdhani Night and Madhur Day improved with `gapBalanced`.
- Milan Night improved with `sameDateOpposite`.

### 3. Added market-wise close sutta routing

Close sutta needed a separate market table because close behavior is more dependent on previous open, previous close, previous jodi, and known-open reaction.

Some markets use one close strategy. Some use a merged strategy list. When a market has a list, the app builds each source list, merges the evidence, removes duplicates, and then creates one final ordered list.

### 4. Added open-adjusted close logic

When the user enters today's open sutta, the app runs `computeJodiAnalysis`.

That model studies historical `open -> close` behavior for the same market:

- It counts closes that followed the same open sutta.
- It boosts historically favored close suttas.
- It penalizes rare close suttas.
- It re-scores close panel picks with those open-to-close penalties.
- If the exact open panel is provided, it also applies known-open operator reaction.
- The adjusted close picks are then passed into the same market-wise close sutta selector.

### 5. Unified top count behavior

We removed count-specific switching as a user-facing behavior. The app now builds one ranked list and then slices it:

- Top 4 = first 4 from the list.
- Top 6 = first 6 from the same list.
- Top 8 = first 8 from the same list.

This avoids the earlier issue where top 6 could disagree with the first four numbers shown in top 4.

### 6. Added final signal ordering

After any model scores the suttas, final display order protects signal quality:

1. Fresh / green
2. Snapback / blue
3. Warming / yellow
4. Cooling / orange
5. Danger / red
6. Unknown / gray

Within the same signal bucket, the model score and rank decide the order.

### 7. Added guarded raw-ranked close routing

The latest improvement pass found that some close and Jodi improvements were hidden by final signal ordering. For selected close strategies, we now use raw statistical ranking instead of putting green/blue/yellow signal state first.

This was only applied where a guarded test improved or did not regress both:

- Latest 30 results per market
- Latest 730 results per market

The guarded evaluator is:

```bash
node scratch/guarded-sutta-eval.cjs
```

The production verification showed improvement across close, Jodi, and open-adjusted close while open stayed unchanged.

## Strategy Definitions

### Open Sutta Strategies

`current`
: Uses the current panel predictor's sutta ranking, then applies final signal ordering.

`rankOnly`
: Uses the unique sutta order from panel picks. This is the older direct-rank method and is currently best for Kalyan.

`sameDate`
: Uses historical same calendar-date open results, blended with recent-24 and weekday frequency.

`sameDateOpposite`
: Uses the opposite digit from same-date history. Opposite pairs are `0-5`, `1-6`, `2-7`, `3-8`, `4-9`.

`gapBalanced`
: Uses recent-24, recent-60, weekday behavior, and moderate drought/gap pressure.

`gapSnapback`
: Similar to gap scoring but gives stronger support to long-gap snapback behavior.

`housePrevOpenSame`
: Favors the same house as previous open. House means `1,2,3,4,5` versus `6,7,8,9,0`.

`housePrevOpenFlip`
: Favors the opposite house from previous open.

`weightedSnap`
: Aggregates panel-pick scores with rank weighting and gives stronger blue snapback support.

### Close Sutta Strategies

`currentProduction`
: Weighted aggregate close-pick scoring from the base close predictor.

`currentUi`
: Fresh first, snapback next, then ranked close picks.

`rankOnly`
: Uses unique close sutta order from the close panel-pick ranking.

`sumCooling`
: Aggregates all close panel-pick scores by sutta and adds signal bonuses, especially cooling/snapback/fresh.

`calendarSameDate`
: Uses previous same-date close behavior with recent-24 and weekday support.

`calendarSameDateOpposite`
: Uses opposite digits from same-date close behavior.

`prevCloseCond`
: Looks at what close suttas historically followed the same previous close sutta.

`prevOpenCond`
: Looks at what close suttas historically followed the same previous open sutta.

`prevJodiCond`
: Looks at what close suttas historically followed the same previous jodi.

`currentOpenCond`
: After today's open is known, looks at close outcomes for the same open sutta.

`currentOpenOppHouse`
: After today's open is known, favors close suttas in the opposite house.

`currentOpenSameHouse`
: After today's open is known, favors close suttas in the same house.

`prevCloseDelta`
: Uses movement from previous close into next close.

`sourcePrevOpenCond`
: Uses the liquidity source market's previous open sutta as a conditioning signal.

`raw...` close strategies
: Raw-ranked versions of selected close strategies. These keep the same scoring formulas but sort by model/statistical score directly instead of final signal bucket priority. Examples: `rawPrevJodiCond`, `rawCalendarSameDate`, `rawRankOnly`, `rawWeightedSnap`.

## Important Close Fallback

Some close strategies require today's open sutta. If the user has not entered today's open yet, these strategies fall back to `currentProduction`.

Strategies that need today's open:

- `currentOpenCond`
- `currentOpenOppHouse`
- `currentOpenSameHouse`

After the user enters open sutta or open panel, those strategies become active.

## Market-Wise Current Model

| Market | Open Sutta Model | Close Sutta Model | Open-Adjusted Close Model |
|---|---|---|---|
| Sridevi | `current` | `currentOpenOppHouse` with fallback to `currentProduction` until open is known | `computeJodiAnalysis` adjusted close picks, then `currentOpenOppHouse` |
| Time Bazar | `sameDate` | `rawPrevJodiCond` | `computeJodiAnalysis` adjusted close picks, then `rawPrevJodiCond` |
| Madhur Day | `gapBalanced` | `rawPrevOpenCond` + `rawPrevOpenDelta` | `computeJodiAnalysis` adjusted close picks, then `rawPrevOpenCond` + `rawPrevOpenDelta` |
| Milan Day | `housePrevOpenFlip` | `sumCooling` | `computeJodiAnalysis` adjusted close picks, then `sumCooling` |
| Rajdhani Day | `sameDate` | `rawCalendarSameDateOpposite` + `rawPrevOpenDelta` | `computeJodiAnalysis` adjusted close picks, then `rawCalendarSameDateOpposite` + `rawPrevOpenDelta` |
| Kalyan | `rankOnly` | `rawCalendarSameDate` + `rawPrevCloseCond` | `computeJodiAnalysis` adjusted close picks, then `rawCalendarSameDate` + `rawPrevCloseCond` |
| Sridevi Night | `sameDate` | `currentProduction` + `currentUi` | `computeJodiAnalysis` adjusted close picks, then `currentProduction` + `currentUi` |
| Kalyan Night | `weightedSnap` | `currentOpenOppHouse` + `currentOpenCond` with fallback to `currentProduction` until open is known | `computeJodiAnalysis` adjusted close picks, then `currentOpenOppHouse` + `currentOpenCond` |
| Madhur Night | `sameDateOpposite` | `rawRankOnly` + `rawPrevCloseCond` | `computeJodiAnalysis` adjusted close picks, then `rawRankOnly` + `rawPrevCloseCond` |
| Milan Night | `sameDateOpposite` | `calendarSameDateOpposite` + `currentProduction` | `computeJodiAnalysis` adjusted close picks, then `calendarSameDateOpposite` + `currentProduction` |
| Rajdhani Night | `gapBalanced` | `rawRankOnly` + `rawPrevCloseCond` | `computeJodiAnalysis` adjusted close picks, then `rawRankOnly` + `rawPrevCloseCond` |
| Main Bazar | `housePrevOpenSame` | `rawCalendarSameDate` + `rawPrevCloseCond` | `computeJodiAnalysis` adjusted close picks, then `rawCalendarSameDate` + `rawPrevCloseCond` |

## Market Notes

### Sridevi

- Open uses `current` because the panel-pick model remained stable.
- Close uses opposite-house reaction after today's open is known.
- Open-adjusted close is strongest after the open is entered because the close side needs current-open context.

### Time Bazar

- Open uses `sameDate`, because calendar-date behavior improved the last-window result.
- Close uses raw previous-jodi conditioning, meaning the last jodi is treated as a signal for the next close without signal-bucket reshuffling.
- Open-adjusted close still uses Jodi history first, then `rawPrevJodiCond`.

### Madhur Day

- Open uses `gapBalanced`, because this market benefited from drought/gap pressure without going fully snapback-heavy.
- Close combines raw previous-open conditioning with raw previous-open delta movement.
- Open-adjusted close uses the known open to re-score close picks, then applies the same raw previous-open/delta close model.

### Milan Day

- Open uses `housePrevOpenFlip`, because the opposite house from previous open tested better than direct current ranking.
- Close uses `sumCooling`, a score aggregation model with cooling/snapback/fresh bonuses.
- Open-adjusted close applies open-to-close penalties before `sumCooling`.

### Rajdhani Day

- Open uses `sameDate`.
- Close now combines raw same-date-opposite behavior with raw previous-open delta movement.
- This replaced the same-house known-open close route because the guarded 30/730 test was stronger for close and Jodi.

### Kalyan

- Open was reverted to `rankOnly`, because the newer delta/calendar route made wider counts worse.
- Close merges raw `calendarSameDate` and raw `prevCloseCond`.
- Open-adjusted close uses Jodi frequency and then the same raw combined close model.

### Sridevi Night

- Open uses `sameDate`.
- Close merges the weighted production model with the old UI-style signal model.
- Open-adjusted close uses adjusted close picks, then the same merged close model.

### Kalyan Night

- Open uses `weightedSnap`, because wider counts improved with snapback-aware weighted aggregation.
- Close needs current-open logic, so it falls back to production close until the user enters open.
- Open-adjusted close is important here because both configured close signals depend on known-open behavior.

### Madhur Night

- Open uses `sameDateOpposite`.
- Close uses raw `rankOnly` plus raw `prevCloseCond`.
- Open-adjusted close applies Jodi penalties, then the same raw combined close selection.

### Milan Night

- Open uses `sameDateOpposite`.
- Close merges same-date-opposite with weighted production.
- Open-adjusted close applies Jodi frequency first, then the combined close selector.

### Rajdhani Night

- Open uses `gapBalanced`.
- Close uses raw `rankOnly` plus raw `prevCloseCond`.
- This market had the largest guarded gain in close and Jodi after removing signal-priority reshuffling.

### Main Bazar

- Open uses `housePrevOpenSame`.
- Close uses raw `calendarSameDate` plus raw `prevCloseCond`.
- Open-adjusted close applies open-to-close frequency first, then the same raw combined close model.

## Backtest / Verification Commands

Use these scripts when changing the models:

```bash
node scratch/open-sutta-research.cjs 30
node scratch/close-sutta-research.cjs 30
node scratch/unified-sutta-backtest.cjs 30
```

Use app checks after code changes:

```bash
npx tsc --noEmit
npx eslint src\components\analysis\AnalysisTabs.tsx src\components\AnalysisSection.tsx
```

## Current Principles

1. Do not use one global model for every market.
2. Open, close, and open-adjusted close are separate prediction problems.
3. Known-open close prediction should use Jodi history, not only base close ranking.
4. Top count should slice one ranked list, not switch to a different model.
5. Fresh and snapback signals should be protected in the final Bet Copy order.
6. If a strategy needs today's open and the open is not known, use the weighted production fallback.
