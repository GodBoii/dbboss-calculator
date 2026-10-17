# Analysis V1 and V2

The Analysis section defaults to V1. Switching versions keeps the selected market, session, declared Open input, copy count, and active view. Loading another market retains the chosen version. Leaving and reopening the Analysis component follows its existing reset behavior.

V1 uses the existing predictor, Sutta rankings, digit models, copy formats and historical backtest. The full-score APIs added for V2 are opt-in. V1 does not receive the added full-order/probability fields.

V2 is an experimental weighted combination. It ports the fixed `all10`, `sp30` and `dp20` selections and market overrides from `research/combined_prediction_v1/selection.json` into `src/lib/combined-policy.ts`. It does not run research searches or fit coefficients in the browser. These rules did not establish a consistent accuracy improvement on the later October audit.

## Outputs

- Top 10 Open and Close panels use the endpoint's combined ranking.
- Expandable SP sections contain exactly 30 panels with three distinct digits.
- DP lists contain exactly 20 panels with two distinct digits.
- Sutta rankings and present/absent pairs come from summed probabilities of the combined panel distribution. Scores are experimental ratings, not verified betting probabilities.
- The existing count control still selects 1-10 Open and Close Suttas, and Jodi remains their count-squared Cartesian grid.
- Declared Open panels activate the known-Open Close model. A Sutta-only input uses smoothed historical Open-to-Close conditioning with a minimum weight of 0.25; exact-panel features remain unavailable in that case.
- The verified DP-call boundary remains unchanged. V2 does not emit a verified DP alert.

V2 uses only complete legal rows strictly before its target date, within the existing 28-calendar-month history. It derives Suttas/Jodi from panel digits, rejects conflicting dates, and requires 180 completed draws. A complete current-day result advances the unconditioned target by one calendar day. A declared Open explicitly targets the current date. Missing operating calendars are not guessed.

## Responsiveness and metrics

V2 runs in a dedicated worker. It sends live predictions before calculating the 30-day panel backtest and 7-day Sutta/Jodi report. The backtest uses V2 callbacks; V1's default backtest path stays unchanged. Historical replays disclose today's Open only for the after-Open Close forecast.

Changing market/version cancels the old worker. Editing Open inputs preserves the input element and shows an updating state; prediction copy controls are disabled while their result is stale. Changes to the count preserve the live ranking and hide accuracy computed for another count until its replacement is ready. Responses from cancelled workers are ignored.

V1 calibration figures are hidden in V2. V2 derived digit pairs do not inherit V1's reliability or safe-call labels. Insufficient history and worker errors are shown explicitly rather than silently displaying V1 predictions as V2.

## Verification

Run:

```powershell
node scripts/verify-analysis-versions.cjs
npx tsc --noEmit
npm run lint
npm run build
```

The verification script uses tracked fixtures and the tracked frozen chart CSV. It needs no downloaded replay cache, network request, or historical Git object. It checks 21 complete V1 baseline snapshots, three original default backtests, 189 combined lists against the frozen research reference, unique panel/Sutta counts, every copy-count contract, input immutability, future exclusion, insufficient history, and Sutta zero.

Manual browser checks cover V1/V2 switching, the declared panel and Sutta-zero inputs, cancelled requests, SP expansion and copying, count changes, V2 Stats, and responsive layout. App/PWA version 1.0.26 is synchronized across package metadata, lockfile, manifest, service worker, and the in-app version.
