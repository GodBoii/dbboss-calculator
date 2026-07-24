# Combined prediction and bet-strategy audit

Generated: 2026-07-16T14:09:12.844Z

## Executive decision

The historical evidence does not support a no-loss betting strategy. A separate absence view is useful as a constraint and abstention signal, but it is not independent evidence when derived from the same panel ranking. The only credible next product is a calibrated probability-and-value engine that is allowed to output **NO BET**.

Under the stated payout assumptions, none of the broad ticket families is promoted from this audit. Positive-looking small pockets must survive a frozen prospective ledger, confidence intervals, and corrected model-selection tests before any user-facing recommendation.

The strongest payout-aware research candidate is the pre-Open Close exact-panel Top-10 portfolio: 88/1052 hits (8.37%), +17.1% ROI, with a 95% Wilson hit-rate interval of 6.84%-10.19%. The 7.14% SP break-even rate remains inside that interval, so the edge is unproven.

The most temporally stable transformed candidate is five-digit pre-Open Close MPSP: 81/1052 hits (7.70%), +7.8% ROI, with a 95% Wilson hit-rate interval of 6.24%-9.47%. Its 7.14% break-even rate also remains inside the interval.

## Assumptions

- Every generated panel or Choukda cross-product is charged one unit.
- Gross panel payouts are SP 140, DP 280, TP 900 units. If these are net-profit quotes, returns change slightly.
- Choukda is evaluated twice: 1200 units per winning exact combination, and 12x gross return. The user's phrase '1200%' is ambiguous, so the two interpretations are not mixed.
- Rankings are frozen, chronological out-of-sample predictions from the existing research ledgers.

## Exact-panel portfolio economics: terminal holdout

| Side | Top N | Hits | Hit rate | ROI |
| --- | --- | ---: | ---: | ---: |
| open | 1 | 6/974 | 0.62% | -13.8% |
| open | 3 | 13/974 | 1.33% | -37.7% |
| open | 10 | 45/974 | 4.62% | -35.3% |
| open | 30 | 173/974 | 17.76% | -15.7% |
| close_preopen | 1 | 6/974 | 0.62% | -13.8% |
| close_preopen | 3 | 29/974 | 2.98% | +38.9% |
| close_preopen | 10 | 82/974 | 8.42% | +17.9% |
| close_preopen | 30 | 216/974 | 22.18% | +3.5% |

ROI counts all selected panels as separate one-unit tickets. Coverage alone is not profit.

## Exact-panel portfolio economics: prospective forward

| Side | Top N | Hits | Hit rate | ROI |
| --- | --- | ---: | ---: | ---: |
| open | 1 | 1/78 | 1.28% | +79.5% |
| open | 3 | 2/78 | 2.56% | +19.7% |
| open | 10 | 6/78 | 7.69% | +7.7% |
| open | 30 | 17/78 | 21.79% | +1.7% |
| close_preopen | 1 | 0/78 | 0.00% | -100.0% |
| close_preopen | 3 | 1/78 | 1.28% | -40.2% |
| close_preopen | 10 | 6/78 | 7.69% | +7.7% |
| close_preopen | 30 | 15/78 | 19.23% | -10.3% |

## MPSP and MPDP: terminal holdout

| Side | Bet | Digits | Tickets | Hits | Hit rate | Random-set reference | Break-even | ROI |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| open | MPSP | 5 | 10 | 58/974 | 5.95% | 5.96% | 7.14% | -16.6% |
| open | MPSP | 6 | 20 | 113/974 | 11.60% | 11.93% | 14.29% | -18.8% |
| open | MPSP | 7 | 35 | 199/974 | 20.43% | 20.87% | 25.00% | -18.3% |
| open | MPSP | 8 | 56 | 295/974 | 30.29% | 33.39% | 40.00% | -24.3% |
| open | MPDP | 5 | 20 | 67/974 | 6.88% | 6.27% | 7.14% | -3.7% |
| open | MPDP | 6 | 30 | 88/974 | 9.03% | 9.41% | 10.71% | -15.7% |
| open | MPDP | 7 | 42 | 118/974 | 12.11% | 13.18% | 15.00% | -19.2% |
| open | MPDP | 8 | 56 | 160/974 | 16.43% | 17.57% | 20.00% | -17.9% |
| close_preopen | MPSP | 5 | 10 | 75/974 | 7.70% | 6.29% | 7.14% | +7.8% |
| close_preopen | MPSP | 6 | 20 | 130/974 | 13.35% | 12.58% | 14.29% | -6.6% |
| close_preopen | MPSP | 7 | 35 | 227/974 | 23.31% | 22.01% | 25.00% | -6.8% |
| close_preopen | MPSP | 8 | 56 | 366/974 | 37.58% | 35.22% | 40.00% | -6.1% |
| close_preopen | MPDP | 5 | 20 | 40/974 | 4.11% | 5.34% | 7.14% | -42.5% |
| close_preopen | MPDP | 6 | 30 | 59/974 | 6.06% | 8.01% | 10.71% | -43.5% |
| close_preopen | MPDP | 7 | 42 | 101/974 | 10.37% | 11.21% | 15.00% | -30.9% |
| close_preopen | MPDP | 8 | 56 | 141/974 | 14.48% | 14.95% | 20.00% | -27.6% |

The selected digit set maximizes reciprocal-rank mass among the model's Top-30 panels of the requested kind. This is the direct implementation of 'likely present' plus its complementary avoided digits.

## Forward MPSP and MPDP check

| Side | Bet | Digits | Hits | Hit rate | Break-even | ROI |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| open | MPSP | 5 | 7/78 | 8.97% | 7.14% | +25.6% |
| open | MPSP | 6 | 12/78 | 15.38% | 14.29% | +7.7% |
| open | MPSP | 7 | 16/78 | 20.51% | 25.00% | -17.9% |
| open | MPSP | 8 | 25/78 | 32.05% | 40.00% | -19.9% |
| open | MPDP | 5 | 5/78 | 6.41% | 7.14% | -10.3% |
| open | MPDP | 6 | 7/78 | 8.97% | 10.71% | -16.2% |
| open | MPDP | 7 | 9/78 | 11.54% | 15.00% | -23.1% |
| open | MPDP | 8 | 16/78 | 20.51% | 20.00% | +2.6% |
| close_preopen | MPSP | 5 | 6/78 | 7.69% | 7.14% | +7.7% |
| close_preopen | MPSP | 6 | 15/78 | 19.23% | 14.29% | +34.6% |
| close_preopen | MPSP | 7 | 23/78 | 29.49% | 25.00% | +17.9% |
| close_preopen | MPSP | 8 | 31/78 | 39.74% | 40.00% | -0.6% |
| close_preopen | MPDP | 5 | 8/78 | 10.26% | 7.14% | +43.6% |
| close_preopen | MPDP | 6 | 9/78 | 11.54% | 10.71% | +7.7% |
| close_preopen | MPDP | 7 | 9/78 | 11.54% | 15.00% | -23.1% |
| close_preopen | MPDP | 8 | 10/78 | 12.82% | 20.00% | -35.9% |

The forward block has only 78 rows per side, so it can falsify large claims but cannot certify a narrow edge.

## Avoid-digit reliability

| Side | Avoid count | All avoided digits absent | Random strict reference | Per-digit accuracy | Average correct |
| --- | --- | ---: | ---: | ---: | ---: |
| open | 2 | 466/974 (47.84%) | 51.13% | 71.05% | 1.42/2 |
| open | 4 | 205/974 (21.05%) | 21.46% | 72.74% | 2.91/4 |
| close_preopen | 2 | 502/974 (51.54%) | 50.57% | 72.74% | 1.45/2 |
| close_preopen | 4 | 221/974 (22.69%) | 20.89% | 72.87% | 2.91/4 |

Per-digit accuracy is a misleading headline because most digits are absent from every panel. The strict all-digits-absent event is the relevant test for using the output as a hard filter.

## DP two-number pair predictions

| Side | Pairs | Tickets | Hits | Hit rate | DP recall | Random reference | Break-even | ROI |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| open | 1 | 2 | 5/974 | 0.51% | 1.82% | 0.63% | 0.71% | -28.1% |
| open | 2 | 4 | 8/974 | 0.82% | 2.91% | 1.25% | 1.43% | -42.5% |
| open | 3 | 6 | 13/974 | 1.33% | 4.73% | 1.88% | 2.14% | -37.7% |
| open | 5 | 10 | 28/974 | 2.87% | 10.18% | 3.14% | 3.57% | -19.5% |
| close_preopen | 1 | 2 | 2/974 | 0.21% | 0.85% | 0.53% | 0.71% | -71.3% |
| close_preopen | 2 | 4 | 4/974 | 0.41% | 1.71% | 1.07% | 1.43% | -71.3% |
| close_preopen | 3 | 6 | 7/974 | 0.72% | 2.99% | 1.60% | 2.14% | -66.5% |
| close_preopen | 5 | 10 | 13/974 | 1.33% | 5.56% | 2.67% | 3.57% | -62.6% |

Each unordered DP digit pair expands to two exact DP panels, so ticket cost is two units per pair.

## Choukda cross-product audit

Best observed configuration under a 1200-unit gross payout:

| Direction | Panel N | Sutta N | Tickets | Hits | Joint hit rate | Break-even | ROI |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openSutta_closePanel (terminal) | 3 | 3 | 9 | 11/974 | 1.13% | 0.75% | +50.6% |
| openSutta_closePanel (forward) | 3 | 3 | 9 | 0/78 | 0.00% | 0.75% | -100.0% |

Best observed configuration if '1200%' means only 12x gross:

| Direction | Panel N | Sutta N | Tickets | Hits | Joint hit rate | Break-even | ROI |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| openSutta_closePanel (terminal) | 3 | 3 | 9 | 11/974 | 1.13% | 75.00% | -98.5% |
| openSutta_closePanel (forward) | 3 | 3 | 9 | 0/78 | 0.00% | 75.00% | -100.0% |

These are maxima over 32 configurations per payout interpretation, so they are selection-biased research results, not deployable evidence. A fresh frozen test is required.

## Recommended model architecture

1. Train one calibrated 220-panel probability distribution per market and side, using only information available at prediction time.
2. Derive coherent marginals from that distribution: sutta, SP/DP/TP, digit-present, digit-absent, DP pair, MPSP/MPDP set, and Choukda joint probabilities.
3. Add a genuinely independent residual/absence model only if its out-of-fold predictions improve log loss, Brier score, calibration, and payout-aware utility after stacking.
4. Price every possible ticket or ticket set: EV = calibrated win probability × gross payout − total stake.
5. Output NO BET unless the lower confidence bound on EV is positive after bookmaker/source uncertainty and multiple-testing correction.
6. Freeze model hashes and log prediction timestamp, data cutoff, full probability vector, offered payout, selected tickets, stake, and realized result.

## Promotion gate

A bet family should be user-facing only after at least three untouched forward blocks, positive aggregate ROI, no catastrophic market-side block, calibrated probabilities, and a predeclared false-discovery correction. Until then the app should label outputs as research ratings, not probabilities or safe bets.

## Methodological references

- Gneiting and Raftery, *Probabilistic Forecasts, Calibration and Sharpness* (2007): evaluate probability distributions with calibration, sharpness, and proper scoring rules.
- van der Laan, Polley, and Hubbard, *Super Learner* (2007): learn ensemble weights from cross-validated predictions rather than combining model opinions by hand.
- White, *A Reality Check for Data Snooping* (2000): adjust claims about the best strategy when many alternatives were searched.
- Angelopoulos et al., *Conformal Risk Control* (2022): calibrate prediction-set or abstention rules against an explicit risk target.
