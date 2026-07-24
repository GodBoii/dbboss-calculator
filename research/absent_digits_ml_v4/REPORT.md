# Nested ML Absent-Digit Report

Generated 2026-07-24T17:23:26.632145+00:00.

## Decision

**Reject the ML candidate; preserve the validated baseline.**

Selected `hierarchical_ridge10p0_blend0p25` from 48 configurations using only the inner-selection block.

Market-side fallback enabled 12/24 routes: `Kalyan Night|close, Kalyan Night|open, Madhur Day|close, Madhur Night|close, Main Bazar|open, Milan Day|open, Milan Night|close, Milan Night|open, Rajdhani Day|open, Rajdhani Night|close, Rajdhani Night|open, Sridevi Night|open`.

## Chronological comparison

| Block | Candidate | V2 | Lift (pp) | Candidate-only | V2-only | Paired p | Digit Brier / V2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Validation | 1239/2348 (52.77%) | 1224/2348 (52.13%) | +0.64 | 109 | 94 | 0.3258 | 0.19979 / 0.19996 |
| Holdout | 1250/2466 (50.69%) | 1246/2466 (50.53%) | +0.16 | 106 | 102 | 0.8353 | 0.19974 / 0.19993 |
| Recent | 1215/2300 (52.83%) | 1193/2300 (51.87%) | +0.96 | 127 | 105 | 0.1678 | 0.19886 / 0.19904 |
| Post Cache | 133/288 (46.18%) | 132/288 (45.83%) | +0.35 | 12 | 11 | 1 | 0.20162 / 0.20170 |
| Independent Extension | 50/88 (56.82%) | 53/88 (60.23%) | -3.41 | 5 | 8 | 0.5811 | 0.19386 / 0.19398 |

## Promotion gates

| Gate | Passed |
| --- | --- |
| `validationImproves` | yes |
| `holdoutNonDegrading` | yes |
| `recentNonDegrading` | yes |
| `confirmationPairedP` | no |
| `laterNonDegrading` | no |
| `worstRoute` | no |
| `stableMonths` | no |
| `brierNonDegrading` | yes |
| `confirmationRowsPresent` | yes |

- Worst confirmation market-side lift: -6.53 pp.
- Stable confirmation months: 55.56%.
- Production changed: **no**.

## Interpretation

- Configuration and route fallback decisions are frozen before Validation.
- Every feature uses only prior own-market rows; current Open is not used for ordinary Close.
- Failure of any gate rejects the family even when one block or route looks promising.

## Reproduce

```powershell
python research/absent_digits_ml_v4/run_nested_ml.py
```
