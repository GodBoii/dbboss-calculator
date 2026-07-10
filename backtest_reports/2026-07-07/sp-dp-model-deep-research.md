# SP / DP Panel Prediction Deep Research

Generated: 2026-07-07T11:22:35.943Z

## Scope

- Markets: 12
- Historical structure window: last 730 dated records per market/side where available
- Model validation window: 365 days before the final 30-day test window
- Final backtest window: 2026-06-06 to 2026-07-05
- Rule for deployment: keep the adaptive market/side threshold only when it beats the current baseline on the final 30-day backtest; otherwise retain current model.

## Last-2-Year Market Structure

| market | side | n | spRate | dpRate | SP->DP | DP->DP | maxSP | maxDP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | open | 724 | 77.9% | 22.1% | 112 | 48 | 25 | 4 |
| Sridevi | close | 724 | 79% | 21% | 105 | 47 | 27 | 6 |
| Time Bazar | open | 604 | 74.5% | 25.5% | 108 | 46 | 22 | 5 |
| Time Bazar | close | 604 | 71% | 29% | 114 | 60 | 20 | 5 |
| Madhur Day | open | 704 | 69.2% | 30.8% | 148 | 69 | 13 | 7 |
| Madhur Day | close | 704 | 75.4% | 24.6% | 123 | 50 | 29 | 4 |
| Milan Day | open | 604 | 73.8% | 26.2% | 117 | 41 | 21 | 5 |
| Milan Day | close | 604 | 70.5% | 29.5% | 116 | 61 | 17 | 5 |
| Rajdhani Day | open | 606 | 73.3% | 26.7% | 146 | 16 | 10 | 3 |
| Rajdhani Day | close | 606 | 79% | 21% | 111 | 16 | 15 | 3 |
| Kalyan | open | 606 | 76.6% | 23.4% | 103 | 39 | 21 | 6 |
| Kalyan | close | 606 | 76.7% | 23.3% | 102 | 38 | 22 | 4 |
| Sridevi Night | open | 724 | 71% | 29% | 136 | 74 | 20 | 7 |
| Sridevi Night | close | 724 | 79.8% | 20.2% | 114 | 32 | 21 | 4 |
| Kalyan Night | open | 500 | 72.8% | 27.2% | 98 | 37 | 17 | 4 |
| Kalyan Night | close | 500 | 77.6% | 22.4% | 91 | 21 | 16 | 3 |
| Madhur Night | open | 605 | 74% | 26% | 118 | 39 | 21 | 4 |
| Madhur Night | close | 605 | 77.4% | 22.6% | 108 | 29 | 15 | 6 |
| Milan Night | open | 601 | 77% | 23% | 103 | 35 | 27 | 4 |
| Milan Night | close | 601 | 79.7% | 20.3% | 92 | 30 | 22 | 3 |
| Rajdhani Night | open | 505 | 72.7% | 27.3% | 115 | 23 | 11 | 3 |
| Rajdhani Night | close | 505 | 75.2% | 24.8% | 96 | 29 | 17 | 4 |
| Main Bazar | open | 504 | 70.8% | 29.2% | 107 | 40 | 11 | 3 |
| Main Bazar | close | 504 | 73.2% | 26.8% | 98 | 37 | 16 | 4 |

## Pattern Discovery

### Previous Draw Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: prev DP | 1916 | 26.5% | 73.5% |
| open: prev SP | 5359 | 26.3% | 73.7% |
| close: prev DP | 1720 | 26.2% | 73.8% |
| close: prev SP | 5555 | 22.9% | 77.1% |

### Previous Sutta Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: prev sutta 2 | 725 | 27.7% | 72.3% |
| open: prev sutta 3 | 699 | 27.6% | 72.4% |
| open: prev sutta 0 | 766 | 27.4% | 72.6% |
| open: prev sutta 5 | 713 | 27.1% | 72.9% |
| open: prev sutta 8 | 737 | 27% | 73% |
| close: prev sutta 8 | 703 | 21.9% | 78.1% |
| close: prev sutta 9 | 724 | 22% | 78% |
| open: prev sutta 9 | 720 | 26.3% | 73.8% |
| open: prev sutta 1 | 720 | 26% | 74% |
| close: prev sutta 4 | 722 | 26% | 74% |
| close: prev sutta 6 | 684 | 22.8% | 77.2% |
| close: prev sutta 7 | 732 | 23.2% | 76.8% |

### Previous Weekday Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: same weekday prev DP | 1899 | 27.8% | 72.2% |
| open: same weekday prev SP | 5316 | 25.9% | 74.1% |
| close: same weekday prev SP | 5513 | 23.1% | 76.9% |
| close: same weekday prev DP | 1702 | 25% | 75% |

### Frequency / Gap Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: last10 DP=3 | 1977 | 27.9% | 72.1% |
| open: last10 DP=2 | 1851 | 27.4% | 72.6% |
| close: last10 DP=1 | 1554 | 21.9% | 78.1% |
| close: last10 DP=5+ | 151 | 21.9% | 78.1% |
| open: last10 DP=5+ | 168 | 26.8% | 73.2% |
| open: last10 DP=1 | 1190 | 26.6% | 73.4% |
| open: last10 DP=0 | 417 | 22.5% | 77.5% |
| close: last10 DP=5 | 386 | 26.2% | 73.8% |
| close: last10 DP=3 | 1638 | 23% | 77% |
| close: last10 DP=4 | 863 | 25.6% | 74.4% |
| open: last10 DP=4 | 1199 | 23.9% | 76.1% |
| close: last10 DP=0 | 546 | 24.9% | 75.1% |

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: DP gap 6-10 | 1189 | 28% | 72% |
| open: DP gap 11+ | 381 | 21.8% | 78.2% |
| open: DP gap <=2 | 3323 | 26.8% | 73.2% |
| close: DP gap 6-10 | 1436 | 22.1% | 77.9% |
| close: DP gap 3-5 | 2307 | 22.9% | 77.1% |
| open: DP gap 3-5 | 2346 | 25.6% | 74.4% |
| close: DP gap 11+ | 513 | 24.8% | 75.2% |
| close: DP gap <=2 | 2986 | 24.7% | 75.3% |

### Weekday Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| close: Sunday | 307 | 14% | 86% |
| open: Sunday | 307 | 17.6% | 82.4% |
| open: Monday | 1206 | 29% | 71% |
| close: Saturday | 918 | 20% | 80% |
| open: Tuesday | 1218 | 28.1% | 71.9% |
| close: Friday | 1210 | 21.7% | 78.3% |
| close: Monday | 1206 | 27% | 73% |
| open: Wednesday | 1211 | 26.5% | 73.5% |
| close: Tuesday | 1218 | 26.4% | 73.6% |
| open: Friday | 1210 | 26.2% | 73.8% |
| open: Thursday | 1217 | 25.9% | 74.1% |
| close: Thursday | 1217 | 23.4% | 76.6% |

### Month Position Effect

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: start | 1191 | 27.4% | 72.6% |
| open: end | 1519 | 27% | 73% |
| open: middle | 4577 | 25.8% | 74.2% |
| close: start | 1191 | 23.4% | 76.6% |
| close: middle | 4577 | 23.5% | 76.5% |
| close: end | 1519 | 24.3% | 75.7% |

### House / Opposite Number Tests

House A/B uses previous-panel digits 0-4 vs 5-9. Odd/even and high/low groupings use only the previous same-market same-side panel, so these are knowable before the next draw.

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| close: prev house01234=BAA | 96 | 30.2% | 69.8% |
| open: prev house01234=BAA | 84 | 19% | 81% |
| open: prev house01234=BBA | 580 | 27.4% | 72.6% |
| close: prev house01234=BBA | 561 | 21.6% | 78.4% |
| open: prev house01234=ABB | 2156 | 26.7% | 73.3% |
| close: prev house01234=ABA | 1007 | 22.2% | 77.8% |
| open: prev house01234=AAA | 851 | 26.3% | 73.7% |
| open: prev house01234=BBB | 928 | 26.2% | 73.8% |
| open: prev house01234=ABA | 941 | 26.2% | 73.8% |
| open: prev house01234=AAB | 1735 | 26.1% | 73.9% |
| close: prev house01234=BBB | 849 | 25.9% | 74.1% |
| close: prev house01234=AAB | 1719 | 23.2% | 76.8% |

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: prev oddEven=EEE | 899 | 27.3% | 72.7% |
| open: prev oddEven=OEE | 1189 | 27.1% | 72.9% |
| open: prev oddEven=OOO | 851 | 26.7% | 73.3% |
| close: prev oddEven=EOE | 972 | 22.1% | 77.9% |
| close: prev oddEven=OEE | 1196 | 22.2% | 77.8% |
| open: prev oddEven=OOE | 1252 | 26.4% | 73.6% |
| open: prev oddEven=OEO | 851 | 26.4% | 73.6% |
| close: prev oddEven=OOO | 851 | 26.4% | 73.6% |
| close: prev oddEven=EOO | 683 | 22.8% | 77.2% |
| open: prev oddEven=EEO | 649 | 25.6% | 74.4% |
| open: prev oddEven=EOO | 711 | 25.6% | 74.4% |
| open: prev oddEven=EOE | 873 | 25.3% | 74.7% |

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open: prev highLow=1L/2H | 2736 | 26.9% | 73.1% |
| open: prev highLow=3L/0H | 851 | 26.3% | 73.7% |
| open: prev highLow=0L/3H | 928 | 26.2% | 73.8% |
| open: prev highLow=2L/1H | 2760 | 25.9% | 74.1% |
| close: prev highLow=0L/3H | 849 | 25.9% | 74.1% |
| close: prev highLow=2L/1H | 2822 | 23.1% | 76.9% |
| close: prev highLow=1L/2H | 2831 | 23.3% | 76.7% |
| close: prev highLow=3L/0H | 773 | 24.5% | 75.5% |

## Baseline vs Improved Model

| market | side | baseline | candidate | selected | selectedAccuracy | threshold | dpPrecision | dpRecall | confusion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | open | 22/30 (73.3%) | 23/30 (76.7%) | adaptive-threshold | 76.7% | 1.65 | 0% | 0% | SP->SP 23, SP->DP 0, DP->SP 7, DP->DP 0 |
| Sridevi | close | 22/30 (73.3%) | 21/30 (70%) | current-baseline | 73.3% | 1.75 | 100% | 11.1% | SP->SP 21, SP->DP 0, DP->SP 8, DP->DP 1 |
| Time Bazar | open | 14/25 (56%) | 16/25 (64%) | adaptive-threshold | 64% | 2 | 0% | 0% | SP->SP 16, SP->DP 0, DP->SP 9, DP->DP 0 |
| Time Bazar | close | 17/25 (68%) | 18/25 (72%) | adaptive-threshold | 72% | 2 | 100% | 12.5% | SP->SP 17, SP->DP 0, DP->SP 7, DP->DP 1 |
| Madhur Day | open | 19/30 (63.3%) | 19/30 (63.3%) | current-baseline | 63.3% | 1.95 | 0% | 0% | SP->SP 19, SP->DP 0, DP->SP 11, DP->DP 0 |
| Madhur Day | close | 24/30 (80%) | 25/30 (83.3%) | adaptive-threshold | 83.3% | 2.05 | 0% | 0% | SP->SP 25, SP->DP 0, DP->SP 5, DP->DP 0 |
| Milan Day | open | 13/25 (52%) | 18/25 (72%) | adaptive-threshold | 72% | 2.05 | 0% | 0% | SP->SP 18, SP->DP 0, DP->SP 7, DP->DP 0 |
| Milan Day | close | 16/25 (64%) | 16/25 (64%) | current-baseline | 64% | 1.9 | 60% | 30% | SP->SP 13, SP->DP 2, DP->SP 7, DP->DP 3 |
| Rajdhani Day | open | 16/25 (64%) | 19/25 (76%) | adaptive-threshold | 76% | 1.7 | 0% | 0% | SP->SP 19, SP->DP 0, DP->SP 6, DP->DP 0 |
| Rajdhani Day | close | 20/25 (80%) | 20/25 (80%) | current-baseline | 80% | 2 | 50% | 20% | SP->SP 19, SP->DP 1, DP->SP 4, DP->DP 1 |
| Kalyan | open | 14/25 (56%) | 18/25 (72%) | adaptive-threshold | 72% | 1.95 | 0% | 0% | SP->SP 18, SP->DP 1, DP->SP 6, DP->DP 0 |
| Kalyan | close | 15/25 (60%) | 17/25 (68%) | adaptive-threshold | 68% | 1.7 | 100% | 11.1% | SP->SP 16, SP->DP 0, DP->SP 8, DP->DP 1 |
| Sridevi Night | open | 17/30 (56.7%) | 19/30 (63.3%) | adaptive-threshold | 63.3% | 1.85 | 0% | 0% | SP->SP 19, SP->DP 0, DP->SP 11, DP->DP 0 |
| Sridevi Night | close | 22/30 (73.3%) | 25/30 (83.3%) | adaptive-threshold | 83.3% | 2.05 | 0% | 0% | SP->SP 25, SP->DP 0, DP->SP 5, DP->DP 0 |
| Kalyan Night | open | 10/17 (58.8%) | 13/17 (76.5%) | adaptive-threshold | 76.5% | 2.05 | 0% | 0% | SP->SP 13, SP->DP 0, DP->SP 4, DP->DP 0 |
| Kalyan Night | close | 9/17 (52.9%) | 11/17 (64.7%) | adaptive-threshold | 64.7% | 2.05 | 0% | 0% | SP->SP 11, SP->DP 0, DP->SP 6, DP->DP 0 |
| Madhur Night | open | 19/25 (76%) | 18/25 (72%) | current-baseline | 76% | 2.05 | 55.6% | 71.4% | SP->SP 14, SP->DP 4, DP->SP 2, DP->DP 5 |
| Madhur Night | close | 18/25 (72%) | 19/25 (76%) | adaptive-threshold | 76% | 1.7 | 0% | 0% | SP->SP 19, SP->DP 1, DP->SP 5, DP->DP 0 |
| Milan Night | open | 10/25 (40%) | 17/25 (68%) | adaptive-threshold | 68% | 1.7 | 14.3% | 33.3% | SP->SP 16, SP->DP 6, DP->SP 2, DP->DP 1 |
| Milan Night | close | 12/25 (48%) | 15/25 (60%) | adaptive-threshold | 60% | 1.85 | 0% | 0% | SP->SP 15, SP->DP 3, DP->SP 7, DP->DP 0 |
| Rajdhani Night | open | 15/20 (75%) | 14/20 (70%) | current-baseline | 75% | 1.9 | 66.7% | 33.3% | SP->SP 13, SP->DP 1, DP->SP 4, DP->DP 2 |
| Rajdhani Night | close | 12/20 (60%) | 15/20 (75%) | adaptive-threshold | 75% | 1.65 | 0% | 0% | SP->SP 15, SP->DP 0, DP->SP 5, DP->DP 0 |
| Main Bazar | open | 10/20 (50%) | 15/20 (75%) | adaptive-threshold | 75% | 1.85 | 100% | 16.7% | SP->SP 14, SP->DP 0, DP->SP 5, DP->DP 1 |
| Main Bazar | close | 9/20 (45%) | 18/20 (90%) | adaptive-threshold | 90% | 2 | 0% | 0% | SP->SP 18, SP->DP 1, DP->SP 1, DP->DP 0 |

## Overall Accuracy

| model | total | correct | wrong | accuracy | SP precision | SP recall | DP precision | DP recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| current baseline | 594 | 375 | 219 | 63.1% | 74.2% | 76.4% | 29% | 26.6% |
| selected market-specific | 594 | 432 | 162 | 72.7% | 74.6% | 95.4% | 44.4% | 10.1% |

## Selected Features / Rules

- Current baseline features retained: weekday DP bias, previous close sutta=3 pressure, market-specific DP digit triggers, same-day earlier DP count, same-market open kind for close, source-market cascade, night-to-day DP count, two-year structural shift, and operator psychology pressure.
- Improved layer tested: market-specific and side-specific DP-bias threshold selected from the 365-day pre-test validation window.
- Rejected or weak standalone theories: raw previous draw kind, simple DP gap length, broad 0-4 vs 5-9 house membership, odd/even house, high/low balance, and digit-root groups. Some show local skews, but not enough as standalone unseen-test replacements.
- Accepted deployment rule: per market/side fallback. No market/side is allowed to take a candidate that reduces the final 30-day accuracy.

## Prediction Confidence Output

Every final-window prediction with baseline and selected model confidence is saved to:

`C:\Users\prajw\Downloads\dbboss\dbboss-calculator\backtest_reports\2026-07-07\sp-dp-model-predictions.json`

Confidence is derived from the active DP-bias estimate: DP confidence is estimated DP probability; SP confidence is 100 minus estimated DP probability.

## Recommendations

1. Keep the selected fallback strategy as the next research candidate, not as a blind production replacement.
2. Add a minimum-support guard for aggressive DP thresholds because most accuracy gains come from avoiding false DP calls.
3. Continue researching close-panel open-to-close digit carry separately; it is strong after open is known but should not leak into open predictions.
4. Re-run this report weekly and require repeated improvement across several rolling 30-day windows before hard-coding new thresholds.
