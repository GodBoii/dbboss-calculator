# Operator Psychology Model Upgrade

Generated: 2026-07-03

## What Changed

Added an operator-utility layer to the predictor:

- `src/lib/predictor/operator-psychology.ts`
  - Builds panel-level operator adjustments from inferred public pressure.
  - Penalizes obvious public bait: fresh repeats, heavily droughty suttas, triples, sequential panels, overly lucky-looking panels.
  - Adds a small comfort prior for panels the operator has historically used often.
  - Penalizes never-used panels as too dead-obvious/low-confidence.
  - Computes a small DP mood multiplier: defensive after DP clusters, hooking after DP scarcity.
  - Applies known-open close reactions to the full jodi-adjusted close pick list.

Also softened broad DP cascade rules:

- Night-to-day one-open-DP warm-up: `x1.28 -> x1.12`.
- Night-to-day zero-open-DP dry signal: `x0.90 -> x0.96`.
- Same-day hot DP day: `x1.22 boost -> x0.92 defensive turn`.
- Same-day active DP day: `x1.14 -> x1.04`.
- Dry-day cascade: `x0.84 -> x0.94`, Sunday `x0.72 -> x0.78`.

## Before vs After: Last 30 Days

Same live scrape, same walk-forward logic, all 12 configured markets.

| target | metric | before | after | change |
| --- | --- | ---: | ---: | ---: |
| Open | kind accuracy | 58.2% | 61.9% | +3.7 |
| Close | kind accuracy | 67.8% | 69.7% | +1.9 |
| Jodi close | kind accuracy | 67.8% | 69.7% | +1.9 |
| Open | panel top-10 | 3.1% | 3.4% | +0.3 |
| Close | panel top-10 | 5.6% | 6.2% | +0.6 |
| Jodi close | panel top-10 | 5.9% | 6.2% | +0.3 |
| Close | panel top-3 | 1.9% | 2.2% | +0.3 |
| Jodi close | panel top-3 | 1.5% | 2.5% | +1.0 |
| Jodi close | avg actual rank | 15.8 | 14.7 | better by 1.1 |
| Jodi close | sutta top-10 | 41.5% | 60.7% | +19.2 |

Tradeoffs:

| target | metric | before | after | change |
| --- | --- | ---: | ---: | ---: |
| Open | DP recall | 47.8% | 27.2% | -20.6 |
| Close | DP recall | 36.5% | 25.7% | -10.8 |
| Open | DP predicted | 131 | 81 | -50 |
| Close | DP predicted | 84 | 62 | -22 |
| Jodi close | panel top-30 | 19.5% | 17.6% | -1.9 |

## Interpretation

The upgrade made the model more operator-defensive:

- It stopped overcalling DP on weak broad cascade signals.
- It improved overall kind accuracy.
- It improved top-3/top-10 close precision, especially jodi close.
- It reduced broad top-30 jodi coverage, which means the new ranking is sharper but less forgiving.

The biggest practical improvement is in close/jodi close:

- Close top-10 panel hit rate moved above random by more margin: `6.2%` vs random `4.55%`.
- Jodi close sutta top-10 jumped from `41.5%` to `60.7%`.
- Jodi close average actual panel rank improved from `15.8` to `14.7`.

The biggest caution:

- DP recall dropped hard. This is intentional in the first operator-aware pass because previous DP logic was over-firing. If the product needs aggressive DP hunting, expose a separate "aggressive DP mode" instead of raising default DP bias again.

## Verification

- `npx tsc --noEmit`: passed.
- `node scripts/dp-backtest-30d.cjs 30`: passed.
- Detailed outputs saved:
  - `scratch/operator_baseline_before.txt`
  - `scratch/operator_after_30d.txt`
  - `scratch/operator_after_panel_metrics.json`

`npm run build` was attempted but blocked by an active `next dev --port 3000` process locking `.next/codex-dev-3000.err.log`, not by a code error.
