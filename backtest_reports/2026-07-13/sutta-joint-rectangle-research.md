# Joint Top-6 Rectangle Research

This experiment models the 100 Open-Close outcomes jointly and chooses the highest-mass 6x6 rectangle. Every row uses only earlier records. Strategy selection uses development only; validation gates the selection; holdout and the frozen forward week are untouched tests.

## Aggregate gated result

| Block | N | Open baseline -> candidate | Close baseline -> candidate | Jodi baseline -> candidate |
| --- | ---: | ---: | ---: | ---: |
| Development | 3966 | 62.8% -> 62.8% (+0) | 65.0% -> 65.0% (+0) | 41.5% -> 41.5% (+0) |
| Validation | 1323 | 65.8% -> 65.8% (+0) | 64.4% -> 64.4% (+0) | 42.7% -> 42.7% (+0) |
| Holdout | 1326 | 70.5% -> 70.5% (+0) | 72.1% -> 72.1% (+0) | 52.0% -> 52.0% (+0) |
| Forward | 72 | 56.9% -> 56.9% (+0) | 61.1% -> 61.1% (+0) | 31.9% -> 31.9% (+0) |

## Per-market selection and final tests

| Market | Development selection | Validation gate | Holdout O/C/J delta | Forward O/C/J delta |
| --- | --- | --- | ---: | ---: |
| Sridevi | free:recent40 | reject | +0/+0/+0 | +0/+0/+0 |
| Time Bazar | production | pass | +0/+0/+0 | +0/+0/+0 |
| Madhur Day | production | pass | +0/+0/+0 | +0/+0/+0 |
| Milan Day | production | pass | +0/+0/+0 | +0/+0/+0 |
| Rajdhani Day | production | pass | +0/+0/+0 | +0/+0/+0 |
| Kalyan | production | pass | +0/+0/+0 | +0/+0/+0 |
| Sridevi Night | production | pass | +0/+0/+0 | +0/+0/+0 |
| Kalyan Night | production | pass | +0/+0/+0 | +0/+0/+0 |
| Madhur Night | free:weekday | reject | +0/+0/+0 | +0/+0/+0 |
| Milan Night | free:recent80 | reject | +0/+0/+0 | +0/+0/+0 |
| Rajdhani Night | production | pass | +0/+0/+0 | +0/+0/+0 |
| Main Bazar | production | pass | +0/+0/+0 | +0/+0/+0 |

## Decision

Fully reproducible market candidates: 0.

A production promotion requires non-regression for Open, Close, and Jodi in development, validation, chronological holdout, and forward evidence. A candidate that only improves the development search window is rejected.
