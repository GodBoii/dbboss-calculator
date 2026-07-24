# Sutta Predictability Audit

The primary evidence is the separately frozen 72-row forward week. Historical results are reported but are selection-contaminated because production rules were researched using that history.

A Top-6 set contains 6 of 10 possible digits, so nominal coverage is 60% for Open and Close. The Cartesian Jodi set contains 36 of 100 pairs, so nominal coverage is 36% when outcomes are not predictably aligned with the rankings.

## Frozen forward evidence

| Target | Hits | Accuracy | 95% interval | Nominal | Market-wise permutation mean | Evidence rankings beat permutation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Open | 41/72 | 56.9% | 45.4%-67.7% | 60.0% | 60.6% | p=0.808 |
| Close | 44/72 | 61.1% | 49.6%-71.5% | 60.0% | 52.4% | p=0.054 |
| Jodi | 23/72 | 31.9% | 22.3%-43.4% | 36.0% | 31.9% | p=0.548 |

The forward results do not show evidence that the frozen rankings outperform nominal coverage or the market-frequency-preserving permutation null.

## Per-market frozen forward result

| Market | N | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| Sridevi | 7 | 4/7 (57.1%) | 4/7 (57.1%) | 2/7 (28.6%) |
| Time Bazar | 6 | 4/6 (66.7%) | 5/6 (83.3%) | 3/6 (50.0%) |
| Madhur Day | 7 | 4/7 (57.1%) | 6/7 (85.7%) | 3/7 (42.9%) |
| Milan Day | 6 | 2/6 (33.3%) | 4/6 (66.7%) | 2/6 (33.3%) |
| Rajdhani Day | 6 | 4/6 (66.7%) | 4/6 (66.7%) | 3/6 (50.0%) |
| Kalyan | 6 | 3/6 (50.0%) | 4/6 (66.7%) | 1/6 (16.7%) |
| Sridevi Night | 7 | 4/7 (57.1%) | 3/7 (42.9%) | 2/7 (28.6%) |
| Kalyan Night | 5 | 3/5 (60.0%) | 3/5 (60.0%) | 2/5 (40.0%) |
| Madhur Night | 6 | 3/6 (50.0%) | 3/6 (50.0%) | 1/6 (16.7%) |
| Milan Night | 6 | 4/6 (66.7%) | 3/6 (50.0%) | 2/6 (33.3%) |
| Rajdhani Night | 5 | 4/5 (80.0%) | 3/5 (60.0%) | 2/5 (40.0%) |
| Main Bazar | 5 | 2/5 (40.0%) | 2/5 (40.0%) | 0/5 (0.0%) |

## What a 95% claim requires

On 72 rows, at least 69 hits are required for 95% accuracy. Under nominal Top-6 coverage, the chance of reaching that mark is:

- Open: 2.01e-12
- Close: 2.01e-12
- Jodi: 3.89e-27

Therefore 95% cannot be obtained honestly by adding more formulas to essentially random coverage. It requires a large, stable conditional signal that repeats in untouched data. None of the causal rule, adaptive, ML, analogue, or joint-rectangle families tested so far supplies that signal.

## Decision

Do not promote a challenger from this audit. Continue accumulating sealed forward outcomes and require per-market development, validation, chronological holdout, and forward non-regression before any model version changes.
