# Nested Causal Ridge V1 Report

Date: 2026-07-15  
Status: rejected  
Scope: research only

## Model contract

The challenger returns exactly six Open digits, six ordinary Close digits, their 36-cell Jodi rectangle, and six separately labelled Adjusted Close digits after the Open is known. Missing or skipped draws are not allowed.

Each market has three independent ridge rankers. Candidate features cover rolling and exponentially weighted frequencies, drought, weekday/month/calendar-date effects, first-order transitions, lag transforms, causally available same-day earlier-market results, and known-Open conditional frequencies for Adjusted Close. Ridge strength is chosen within development only; all later blocks are untouched gates.

## Aggregate result

| Block | Open candidate / baseline | Delta | Close candidate / baseline | Delta | Jodi candidate / baseline | Delta | Adjusted Close |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Development | 2210/2929 / 1854/2929 | +356 | 2197/2929 / 1876/2929 | +321 | 1653/2929 / 1183/2929 | +470 | 2199/2929 (75.1%) |
| Validation | 718/1174 / 715/1174 | +3 | 735/1174 / 787/1174 | -52 | 440/1174 / 492/1174 | -52 | 725/1174 (61.8%) |
| Holdout | 749/1233 / 807/1233 | -58 | 741/1233 / 790/1233 | -49 | 446/1233 / 520/1233 | -74 | 737/1233 (59.8%) |
| Recent frozen | 725/1222 / 852/1222 | -127 | 747/1222 / 879/1222 | -132 | 440/1222 / 631/1222 | -191 | 762/1222 (62.4%) |

On recent frozen data, candidate coverage was 59.3% Open, 61.1% Close, and 36.0% Jodi. The paired regression against production was statistically significant for Open (`p=8.73e-8`), Close (`p=1.07e-8`), and Jodi (`p=4.89e-15`). The 95% Wilson intervals were 56.5%-62.0%, 58.4%-63.8%, and 33.4%-38.7%.

## Market stability

Values below are candidate-minus-production Jodi hits.

| Market | Validation | Holdout | Recent frozen |
| --- | ---: | ---: | ---: |
| Sridevi | -2 | +9 | -17 |
| Time Bazar | +3 | -7 | -14 |
| Madhur Day | -2 | -8 | -21 |
| Milan Day | -4 | -1 | -17 |
| Rajdhani Day | -3 | +9 | -24 |
| Kalyan | +3 | -7 | -23 |
| Sridevi Night | 0 | -15 | -18 |
| Kalyan Night | -2 | -10 | -13 |
| Madhur Night | -16 | -2 | -7 |
| Milan Night | -18 | -23 | -19 |
| Rajdhani Night | 0 | -19 | -10 |
| Main Bazar | -11 | 0 | -8 |

No market maintained a positive Jodi delta through validation, holdout, and recent frozen. Recent frozen Jodi performance regressed in all 12 markets.

## Decision

Reject the challenger. The large development lift is not a durable signal; it is contradicted by every later aggregate block and collapses toward the nominal 60%/60%/36% fixed-set coverage rates. It is not eligible for a sealed-forward Goal100 cohort or production promotion.

Reproduce with:

```powershell
python research\goal100\run-nested-ensemble.py
node research\goal100\production-guard.cjs
```

Machine-readable ledger: `artifacts/nested-causal-ridge-v1.json`.
