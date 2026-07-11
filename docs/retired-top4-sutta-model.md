# Retired count-aware Top-4 sutta model

## Status

The count-aware model is retired from prediction selection. It is retained here as a design reference only. The copy counter must never select a different prediction strategy; it now slices one canonical ranking of all ten digits.

## Former behavior

- `1-4` selections used a market's `narrow` strategy.
- `5-10` selections used its `wide` strategy.
- Counts `2`, `5`, and `8` could have additional market-specific overrides.
- Open and Close used separate market strategy tables.
- Candidate ordering mixed drought-state priority (`fresh`, `snapback`, warming/cooling, `danger`) with a model score.
- The dedicated statistical models only ran when the requested count was exactly six.

Consequently, Top 4 was not guaranteed to be the first four digits of Top 6, and changing the UI counter could change the underlying model rather than only changing the number of displayed picks.

## Features worth retaining

- recent 24/30/60 digit frequency
- weekday and same-date-of-month frequency
- previous-open and previous-close transitions/deltas
- known-open conditional close distribution
- previous-jodi and cross-market liquidity conditions
- drought/snapback state as model evidence and a UI explanation
- market-specific feature selection validated by walk-forward backtests

## Replacement contract

Each Open, Close, adjusted Close, and Jodi model produces a complete deterministic ranking. Every digit has a unique rank, model score, normalized rating, and drought annotation. Top N is always `ranking.slice(0, N)`. Therefore Top 4 is a strict prefix of Top 6 and the Signal Map and copy container consume the same prediction output.

The displayed normalized rating is a relative share of the model ranking, not a promise of real-world probability. Calibration must be measured separately with out-of-sample backtests.
