# DP Pattern Hunter

Generated: 2026-07-07T12:24:09.656Z

## Method

- Priority metric: DP recall and DP F1, not only total accuracy.
- Train window: 2023-06-07 to 2025-06-05
- Validation window: 2025-06-06 to 2026-06-05
- Final unseen test window: 2026-06-06 to 2026-07-05
- Candidate model: current baseline OR validated DP attack rules.
- Selection guard: a market/side keeps the DP rules only when final DP recall improves and final accuracy does not fall by more than 8 points. Otherwise that market/side stays on the current baseline.
- All features are known before the target draw: previous market history, previous day/night, same weekday history, same calendar date history, earlier same-day markets, and known open for close prediction.

## Market Results

| market | side | actualDP | baselinePredDP | baselineDPCorrect | baselineRecall | candidatePredDP | candidateDPCorrect | candidateRecall | selected | selectedRecall | accuracy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | open | 7 | 1 | 0 | 0% | 11 | 3 | 42.9% | baseline | 0% | 73.3% |
| Sridevi | close | 9 | 1 | 1 | 11.1% | 10 | 5 | 55.6% | rules+baseline | 55.6% | 70% |
| Time Bazar | open | 9 | 6 | 2 | 22.2% | 17 | 7 | 77.8% | rules+baseline | 77.8% | 52% |
| Time Bazar | close | 8 | 6 | 3 | 37.5% | 23 | 8 | 100% | baseline | 37.5% | 68% |
| Madhur Day | open | 11 | 0 | 0 | 0% | 8 | 3 | 27.3% | rules+baseline | 27.3% | 56.7% |
| Madhur Day | close | 5 | 3 | 1 | 20% | 17 | 4 | 80% | baseline | 20% | 80% |
| Milan Day | open | 7 | 9 | 2 | 28.6% | 12 | 3 | 42.9% | rules+baseline | 42.9% | 48% |
| Milan Day | close | 10 | 5 | 3 | 30% | 16 | 6 | 60% | baseline | 30% | 64% |
| Rajdhani Day | open | 6 | 3 | 0 | 0% | 11 | 3 | 50% | rules+baseline | 50% | 56% |
| Rajdhani Day | close | 5 | 2 | 1 | 20% | 10 | 3 | 60% | baseline | 20% | 80% |
| Kalyan | open | 6 | 9 | 2 | 33.3% | 18 | 3 | 50% | baseline | 33.3% | 56% |
| Kalyan | close | 9 | 7 | 3 | 33.3% | 15 | 4 | 44.4% | baseline | 33.3% | 60% |
| Sridevi Night | open | 11 | 8 | 3 | 27.3% | 16 | 6 | 54.5% | rules+baseline | 54.5% | 50% |
| Sridevi Night | close | 5 | 3 | 0 | 0% | 10 | 2 | 40% | baseline | 0% | 73.3% |
| Kalyan Night | open | 4 | 7 | 2 | 50% | 14 | 4 | 100% | baseline | 50% | 58.8% |
| Kalyan Night | close | 6 | 6 | 2 | 33.3% | 11 | 5 | 83.3% | rules+baseline | 83.3% | 58.8% |
| Madhur Night | open | 7 | 9 | 5 | 71.4% | 17 | 7 | 100% | baseline | 71.4% | 76% |
| Madhur Night | close | 5 | 6 | 2 | 40% | 8 | 3 | 60% | rules+baseline | 60% | 72% |
| Milan Night | open | 3 | 14 | 1 | 33.3% | 17 | 1 | 33.3% | baseline | 33.3% | 40% |
| Milan Night | close | 7 | 12 | 3 | 42.9% | 16 | 4 | 57.1% | rules+baseline | 57.1% | 40% |
| Rajdhani Night | open | 6 | 3 | 2 | 33.3% | 13 | 4 | 66.7% | baseline | 33.3% | 75% |
| Rajdhani Night | close | 5 | 3 | 0 | 0% | 11 | 2 | 40% | baseline | 0% | 60% |
| Main Bazar | open | 6 | 12 | 4 | 66.7% | 18 | 6 | 100% | baseline | 66.7% | 50% |
| Main Bazar | close | 1 | 10 | 0 | 0% | 15 | 1 | 100% | baseline | 0% | 45% |

## Overall

| model | total | correct | accuracy | actualDP | predDP | dpCorrect | DP precision | DP recall | DP F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 594 | 375 | 63.1% | 158 | 145 | 42 | 29% | 26.6% | 27.7 |
| candidate rules | 594 | 296 | 49.8% | 158 | 334 | 97 | 29% | 61.4% | 39.4 |
| selected per market | 594 | 365 | 61.4% | 158 | 203 | 66 | 32.5% | 41.8% | 36.6 |

## Validated DP Attack Rules

### Sridevi open

Validation baseline: DP recall 26.8%, DP F1 25.5, accuracy 64.6%.

Validation with rules: DP recall 61%, DP F1 41, accuracy 60.2%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDate.allDpCount=0 | 19 | 7 | 36.8% | 31 | 11 | 35.5% | 6 |
| prevDate.any.Time Bazar.open.sutta=8 | 11 | 4 | 36.4% | 12 | 6 | 50% | 5 |
| sameSide.last5Dp=2 && sameWeek2.prev.lowHigh=HHH | 10 | 5 | 50% | 14 | 5 | 35.7% | 5 |
| prevDate.any.Madhur Day.open.sutta=1 | 9 | 4 | 44.4% | 10 | 5 | 50% | 4 |
| target.date=19 | 8 | 4 | 50% | 12 | 5 | 41.7% | 4 |
| target.date=13 | 8 | 3 | 37.5% | 12 | 5 | 41.7% | 4 |
| prevDate.any.Rajdhani Night.close.sutta=8 | 10 | 4 | 40% | 4 | 3 | 75% | 3 |
| sameSide.last5Dp=2 && sameWeek2.prev.last=6 | 8 | 3 | 37.5% | 8 | 3 | 37.5% | 3 |

### Sridevi close

Validation baseline: DP recall 19.2%, DP F1 23.2, accuracy 72.7%.

Validation with rules: DP recall 57.7%, DP F1 41.7, accuracy 65.2%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameSide.prev.dpDigit=4 | 8 | 3 | 37.5% | 12 | 6 | 50% | 6 |
| sameSide.prev.middle=9 | 16 | 6 | 37.5% | 19 | 7 | 36.8% | 6 |
| sameDate.openKnown.middle=2 | 14 | 6 | 42.9% | 18 | 7 | 38.9% | 5 |
| sameDate.openKnown.oddEven=OEE && sameDate.openKnown.sutta=7 | 8 | 5 | 62.5% | 13 | 5 | 38.5% | 5 |
| sameWeek2.prev.firstLast=20 | 13 | 5 | 38.5% | 13 | 6 | 46.2% | 4 |
| sameSide.prev.last=4 | 13 | 5 | 38.5% | 16 | 5 | 31.3% | 4 |
| prevDate.any.Rajdhani Night.close.sutta=8 | 10 | 4 | 40% | 4 | 3 | 75% | 3 |
| sameDate.openKnown.oddEven=OEE && sameSide.prev.first=2 | 10 | 4 | 40% | 8 | 3 | 37.5% | 3 |

### Time Bazar open

Validation baseline: DP recall 27.8%, DP F1 22.9, accuracy 55.3%.

Validation with rules: DP recall 81.9%, DP F1 42.6, accuracy 47.4%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Sridevi.close.kind=DP | 41 | 15 | 36.6% | 71 | 23 | 32.4% | 16 |
| sameDate.Sridevi.open.oddEven=OOE | 33 | 14 | 42.4% | 53 | 17 | 32.1% | 15 |
| prevDay.close.firstLast=10 | 11 | 4 | 36.4% | 21 | 8 | 38.1% | 8 |
| sameSide.prev.middle=9 | 20 | 7 | 35% | 26 | 9 | 34.6% | 7 |
| sameWeek1.prev.oddEven=EEE && target.day=Monday | 8 | 4 | 50% | 7 | 5 | 71.4% | 4 |
| sameSide.prev.firstLast=19 | 10 | 6 | 60% | 14 | 7 | 50% | 4 |
| sameDate.Sridevi.open.firstLast=20 | 8 | 4 | 50% | 14 | 5 | 35.7% | 3 |

### Time Bazar close

Validation baseline: DP recall 21.5%, DP F1 26.1, accuracy 68.2%.

Validation with rules: DP recall 84.8%, DP F1 52.8, accuracy 60.3%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.openKnown.sumBand=low | 55 | 22 | 40% | 85 | 28 | 32.9% | 25 |
| sameSide.prev.oddEven=OOE | 29 | 10 | 34.5% | 49 | 19 | 38.8% | 18 |
| sameDate.openKnown.middle=3 | 19 | 11 | 57.9% | 33 | 14 | 42.4% | 12 |
| prevDay.open.firstLast=20 | 16 | 8 | 50% | 13 | 7 | 53.8% | 6 |
| sameWeek1.prev.lowHigh=HHH | 24 | 9 | 37.5% | 26 | 10 | 38.5% | 6 |
| target.date=21 | 8 | 4 | 50% | 9 | 5 | 55.6% | 4 |

### Madhur Day open

Validation baseline: DP recall 28.8%, DP F1 31.9, accuracy 63.6%.

Validation with rules: DP recall 75%, DP F1 50.2, accuracy 56%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Time Bazar.open.first=1 | 51 | 20 | 39.2% | 89 | 27 | 30.3% | 22 |
| sameDate.Time Bazar.open.lowHigh=LLH | 49 | 17 | 34.7% | 70 | 23 | 32.9% | 21 |
| sameDatePrevMonth.prev.sutta=6 | 30 | 12 | 40% | 34 | 14 | 41.2% | 12 |
| sameDate.Time Bazar.open.middle=8 | 28 | 14 | 50% | 29 | 12 | 41.4% | 9 |

### Madhur Day close

Validation baseline: DP recall 17.6%, DP F1 20.7, accuracy 67.3%.

Validation with rules: DP recall 77.6%, DP F1 48, accuracy 59.4%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Sridevi.close.kind=DP | 52 | 21 | 40.4% | 75 | 24 | 32% | 19 |
| sameWeek1.prev.oddEven=EEE | 22 | 8 | 36.4% | 42 | 17 | 40.5% | 17 |
| sameDate.Sridevi.close.oddEven=EEO | 20 | 8 | 40% | 32 | 11 | 34.4% | 10 |
| sameDate.openKnown.dpDigit=4 | 9 | 4 | 44.4% | 10 | 8 | 80% | 6 |
| sameDate.Time Bazar.close.firstLast=18 | 8 | 3 | 37.5% | 10 | 6 | 60% | 6 |
| sameDate.earlierDpCount=3 | 9 | 7 | 77.8% | 16 | 6 | 37.5% | 6 |
| sameDate.Sridevi.close.firstLast=15 | 8 | 3 | 37.5% | 8 | 4 | 50% | 4 |
| sameDate.Sridevi.close.firstLast=49 | 9 | 4 | 44.4% | 12 | 4 | 33.3% | 4 |

### Milan Day open

Validation baseline: DP recall 32.9%, DP F1 29, accuracy 57.9%.

Validation with rules: DP recall 98.7%, DP F1 51, accuracy 50.3%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Time Bazar.close.last=9 | 40 | 14 | 35% | 63 | 20 | 31.7% | 15 |
| sameDate.Time Bazar.open.last=7 | 25 | 10 | 40% | 36 | 16 | 44.4% | 13 |
| sameDate.Time Bazar.open.middle=4 | 30 | 13 | 43.3% | 46 | 14 | 30.4% | 11 |
| sameDate.Madhur Day.open.firstLast=20 | 12 | 5 | 41.7% | 16 | 10 | 62.5% | 8 |
| sameSide.dpGapBin=6-10 | 26 | 9 | 34.6% | 59 | 18 | 30.5% | 8 |
| sameWeek2.prev.sutta=6 | 16 | 6 | 37.5% | 23 | 8 | 34.8% | 7 |
| sameDate.Madhur Day.close.middle=9 | 16 | 6 | 37.5% | 19 | 9 | 47.4% | 5 |
| sameDate.Time Bazar.close.middle=8 && sameSide.prev.lowHigh=LLH | 9 | 5 | 55.6% | 9 | 4 | 44.4% | 3 |

### Milan Day close

Validation baseline: DP recall 9.9%, DP F1 13.5, accuracy 61.9%.

Validation with rules: DP recall 76.9%, DP F1 50.3, accuracy 54.3%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameSide.last30.dpDigit6Count=2+ | 23 | 10 | 43.5% | 88 | 35 | 39.8% | 33 |
| sameDate.Sridevi.close.oddEven=OEE | 32 | 12 | 37.5% | 53 | 20 | 37.7% | 19 |
| sameDate.Madhur Day.close.oddEven=EEE | 18 | 7 | 38.9% | 40 | 16 | 40% | 16 |
| sameDate.Madhur Day.open.last=6 | 17 | 8 | 47.1% | 26 | 13 | 50% | 11 |
| prevDay.open.oddEven=EOE | 23 | 9 | 39.1% | 30 | 10 | 33.3% | 10 |
| sameDate.Time Bazar.close.dpDigit=6 | 8 | 3 | 37.5% | 6 | 5 | 83.3% | 5 |

### Rajdhani Day open

Validation baseline: DP recall 28.4%, DP F1 33.6, accuracy 70%.

Validation with rules: DP recall 81.5%, DP F1 53.5, accuracy 62%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDate.nightDpCount=3 | 35 | 13 | 37.1% | 60 | 23 | 38.3% | 20 |
| sameDate.Milan Day.open.oddEven=EOE | 24 | 9 | 37.5% | 29 | 13 | 44.8% | 10 |
| sameWeek2.prev.oddEven=EOO | 13 | 5 | 38.5% | 27 | 12 | 44.4% | 10 |
| prevDate.any.Kalyan Night.open.sutta=2 | 10 | 5 | 50% | 8 | 5 | 62.5% | 5 |
| sameDate.Time Bazar.open.firstLast=19 | 10 | 5 | 50% | 14 | 5 | 35.7% | 5 |
| sameDate.Milan Day.close.middle=2 | 10 | 4 | 40% | 22 | 7 | 31.8% | 5 |
| sameDate.Time Bazar.open.first=7 | 11 | 5 | 45.5% | 8 | 5 | 62.5% | 4 |
| prevDate.any.Kalyan.open.sutta=8 | 8 | 3 | 37.5% | 5 | 3 | 60% | 3 |

### Rajdhani Day close

Validation baseline: DP recall 15.2%, DP F1 19.1, accuracy 71.9%.

Validation with rules: DP recall 48.5%, DP F1 37.4, accuracy 64.7%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDay.open.lowHigh=LHL | 29 | 11 | 37.9% | 45 | 15 | 33.3% | 11 |
| sameDate.Milan Day.open.firstLast=18 | 10 | 4 | 40% | 16 | 6 | 37.5% | 6 |
| sameDate.Milan Day.open.last=8 && sameWeek1.prev.middle=6 | 9 | 5 | 55.6% | 6 | 3 | 50% | 3 |
| sameDate.Sridevi.close.firstLast=39 | 8 | 3 | 37.5% | 7 | 3 | 42.9% | 3 |

### Kalyan open

Validation baseline: DP recall 28.2%, DP F1 24.3, accuracy 58.7%.

Validation with rules: DP recall 77.5%, DP F1 42.5, accuracy 50.8%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDay.close.kind=DP | 45 | 16 | 35.6% | 68 | 21 | 30.9% | 16 |
| sameDate.Time Bazar.open.sutta=0 | 29 | 10 | 34.5% | 34 | 11 | 32.4% | 10 |
| sameSide.prev.middle=2 | 14 | 5 | 35.7% | 20 | 6 | 30% | 5 |
| sameDatePrevMonth.prev.firstLast=16 | 9 | 4 | 44.4% | 10 | 5 | 50% | 4 |
| sameDate.Milan Day.close.last=5 | 11 | 4 | 36.4% | 10 | 5 | 50% | 4 |
| sameDate.Madhur Day.open.firstLast=18 | 8 | 5 | 62.5% | 15 | 5 | 33.3% | 4 |
| sameDate.Rajdhani Day.close.kind=DP && sameDate.Rajdhani Day.close.lowHigh=HHH | 11 | 6 | 54.5% | 12 | 5 | 41.7% | 3 |
| prevDate.any.Rajdhani Night.open.sutta=1 | 8 | 3 | 37.5% | 5 | 2 | 40% | 2 |

### Kalyan close

Validation baseline: DP recall 13.4%, DP F1 16.8, accuracy 70.6%.

Validation with rules: DP recall 64.2%, DP F1 43.2, accuracy 62.7%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDay.open.oddEven=OOO | 21 | 8 | 38.1% | 41 | 14 | 34.1% | 11 |
| sameDate.Milan Day.close.last=7 | 14 | 5 | 35.7% | 35 | 11 | 31.4% | 11 |
| sameDate.Milan Day.close.middle=2 | 10 | 5 | 50% | 22 | 8 | 36.4% | 7 |
| sameDate.Milan Day.open.oddEven=EEO && sameDate.Milan Day.open.lowHigh=LLH | 10 | 7 | 70% | 15 | 5 | 33.3% | 5 |
| prevDate.any.Main Bazar.open.dpDigit=7 | 8 | 3 | 37.5% | 9 | 4 | 44.4% | 4 |
| sameDate.Milan Day.open.lowHigh=LLH && sameDate.Madhur Day.close.oddEven=OEO | 8 | 5 | 62.5% | 10 | 4 | 40% | 4 |

### Sridevi Night open

Validation baseline: DP recall 27.6%, DP F1 29.4, accuracy 61.6%.

Validation with rules: DP recall 88.6%, DP F1 52.7, accuracy 53.9%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Milan Day.open.first=1 | 61 | 25 | 41% | 89 | 31 | 34.8% | 27 |
| sameDate.Milan Day.close.last=0 | 58 | 21 | 36.2% | 80 | 26 | 32.5% | 22 |
| sameDate.Madhur Day.open.middle=4 | 28 | 13 | 46.4% | 47 | 20 | 42.6% | 18 |
| sameDate.Milan Day.open.oddEven=OOO | 29 | 12 | 41.4% | 37 | 16 | 43.2% | 12 |
| sameWeek2.prev.dpDigit=9 | 9 | 5 | 55.6% | 10 | 5 | 50% | 5 |
| target.date=24 | 8 | 4 | 50% | 12 | 5 | 41.7% | 4 |

### Sridevi Night close

Validation baseline: DP recall 18.1%, DP F1 20.8, accuracy 72.7%.

Validation with rules: DP recall 50%, DP F1 37.5, accuracy 66.9%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.openKnown.last=4 | 9 | 4 | 44.4% | 16 | 7 | 43.8% | 7 |
| sameDate.openKnown.dpDigit=4 | 8 | 6 | 75% | 14 | 6 | 42.9% | 5 |
| prevDay.open.firstLast=19 | 8 | 3 | 37.5% | 15 | 5 | 33.3% | 5 |
| sameDate.Madhur Day.open.dpDigit=7 | 8 | 4 | 50% | 8 | 4 | 50% | 3 |
| sameWeek1.prev.dpDigit=7 | 8 | 3 | 37.5% | 6 | 3 | 50% | 3 |
| sameDate.Rajdhani Day.open.firstLast=17 | 11 | 4 | 36.4% | 8 | 3 | 37.5% | 3 |
| target.date=18 | 8 | 3 | 37.5% | 12 | 4 | 33.3% | 3 |
| sameDatePrevMonth.prev.first=1 && sameSide.prev.last=7 | 9 | 5 | 55.6% | 10 | 3 | 30% | 3 |

### Kalyan Night open

Validation baseline: DP recall 25%, DP F1 23.8, accuracy 54.2%.

Validation with rules: DP recall 94.4%, DP F1 50.3, accuracy 46.6%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Sridevi Night.close.sumBand=low | 36 | 14 | 38.9% | 67 | 23 | 34.3% | 18 |
| sameDatePrevMonth.prev.lowHigh=LLH | 29 | 13 | 44.8% | 61 | 19 | 31.1% | 16 |
| sameDate.Kalyan.open.oddEven=EOE | 15 | 7 | 46.7% | 39 | 18 | 46.2% | 14 |
| sameDate.earlierDpCount=6 | 21 | 8 | 38.1% | 45 | 18 | 40% | 13 |
| sameDatePrevMonth.prev.middle=3 | 17 | 8 | 47.1% | 35 | 15 | 42.9% | 12 |
| sameWeek2.prev.sutta=8 | 11 | 4 | 36.4% | 24 | 10 | 41.7% | 8 |
| prevDay.close.sutta=0 | 16 | 6 | 37.5% | 23 | 9 | 39.1% | 7 |
| sameDate.Sridevi Night.close.lowHigh=LLH && sameDate.Milan Day.open.last=8 | 8 | 5 | 62.5% | 11 | 4 | 36.4% | 4 |

### Kalyan Night close

Validation baseline: DP recall 22.4%, DP F1 19.8, accuracy 64.5%.

Validation with rules: DP recall 65.3%, DP F1 37, accuracy 56.6%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| prevDay.open.lowHigh=LLL | 13 | 5 | 38.5% | 37 | 13 | 35.1% | 10 |
| sameWeek1.prev.middle=8 | 15 | 8 | 53.3% | 23 | 7 | 30.4% | 7 |
| sameDate.Sridevi Night.open.middle=2 | 9 | 4 | 44.4% | 18 | 7 | 38.9% | 6 |
| sameDate.Sridevi Night.open.firstLast=10 | 10 | 4 | 40% | 15 | 5 | 33.3% | 4 |
| sameWeek2.prev.dpDigit=3 | 8 | 3 | 37.5% | 6 | 2 | 33.3% | 2 |

### Madhur Night open

Validation baseline: DP recall 24.1%, DP F1 28, accuracy 67.7%.

Validation with rules: DP recall 84.8%, DP F1 52.4, accuracy 59.7%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| target.dateBand=25+ | 41 | 14 | 34.1% | 64 | 21 | 32.8% | 18 |
| sameDate.Sridevi Night.close.sutta=8 | 15 | 6 | 40% | 29 | 12 | 41.4% | 12 |
| sameDate.Rajdhani Day.open.sutta=9 | 25 | 9 | 36% | 34 | 14 | 41.2% | 12 |
| sameDate.Kalyan.open.oddEven=OEO | 24 | 9 | 37.5% | 32 | 11 | 34.4% | 10 |
| sameWeek1.prev.firstLast=20 | 14 | 5 | 35.7% | 13 | 7 | 53.8% | 6 |
| sameDate.Rajdhani Day.open.firstLast=20 && sameDate.Rajdhani Day.open.lowHigh=LHL | 9 | 6 | 66.7% | 7 | 4 | 57.1% | 4 |
| prevDay.close.last=4 | 8 | 3 | 37.5% | 7 | 4 | 57.1% | 4 |

### Madhur Night close

Validation baseline: DP recall 15%, DP F1 19.6, accuracy 75.6%.

Validation with rules: DP recall 61.7%, DP F1 43, accuracy 67.7%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Rajdhani Day.open.oddEven=EOE | 28 | 10 | 35.7% | 41 | 13 | 31.7% | 12 |
| sameWeek1.prev.sutta=6 | 19 | 7 | 36.8% | 32 | 12 | 37.5% | 11 |
| sameDatePrevMonth.prev.firstLast=20 | 9 | 4 | 44.4% | 14 | 6 | 42.9% | 6 |
| target.date=21 | 8 | 4 | 50% | 9 | 5 | 55.6% | 4 |

### Milan Night open

Validation baseline: DP recall 18.8%, DP F1 21.8, accuracy 63.9%.

Validation with rules: DP recall 82.5%, DP F1 50, accuracy 55.9%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Madhur Night.close.lowHigh=LHL | 19 | 7 | 36.8% | 53 | 21 | 39.6% | 18 |
| sameDate.Madhur Night.open.oddEven=OOE | 24 | 9 | 37.5% | 58 | 19 | 32.8% | 17 |
| sameDate.Madhur Night.close.firstLast=39 | 8 | 3 | 37.5% | 11 | 7 | 63.6% | 6 |
| sameDate.Kalyan Night.open.middle=2 | 8 | 3 | 37.5% | 24 | 8 | 33.3% | 6 |
| sameWeek1.prev.firstLast=39 | 8 | 4 | 50% | 16 | 6 | 37.5% | 5 |
| prevDate.any.Madhur Day.open.dpDigit=5 | 8 | 3 | 37.5% | 7 | 4 | 57.1% | 4 |
| sameDate.Sridevi Night.open.first=5 | 23 | 8 | 34.8% | 16 | 6 | 37.5% | 4 |
| sameDate.Kalyan Night.close.middle=2 | 19 | 8 | 42.1% | 10 | 5 | 50% | 3 |

### Milan Night close

Validation baseline: DP recall 8.9%, DP F1 10.4, accuracy 71.2%.

Validation with rules: DP recall 57.1%, DP F1 36.8, accuracy 63.2%.

Final decision: keep rules for this market/side.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Sridevi Night.open.oddEven=OEO | 16 | 8 | 50% | 35 | 11 | 31.4% | 10 |
| sameWeek1.prev.lowHigh=HHH | 13 | 5 | 38.5% | 30 | 9 | 30% | 9 |
| sameDate.Sridevi Night.close.lowHigh=HHL | 17 | 6 | 35.3% | 14 | 5 | 35.7% | 5 |
| prevDate.any.Rajdhani Day.open.sutta=6 | 8 | 4 | 50% | 10 | 5 | 50% | 4 |
| sameSide.last5Dp=3 | 21 | 8 | 38.1% | 12 | 4 | 33.3% | 4 |

### Rajdhani Night open

Validation baseline: DP recall 40.6%, DP F1 35.7, accuracy 60.1%.

Validation with rules: DP recall 95.7%, DP F1 52.2, accuracy 52.2%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Kalyan Night.open.last=9 | 23 | 10 | 43.5% | 62 | 19 | 30.6% | 13 |
| sameWeek1.prev.lowHigh=LLH | 46 | 16 | 34.8% | 56 | 18 | 32.1% | 12 |
| sameDate.Kalyan Night.close.sutta=5 | 10 | 4 | 40% | 24 | 10 | 41.7% | 9 |
| sameDate.Kalyan Night.open.sutta=9 | 17 | 6 | 35.3% | 22 | 10 | 45.5% | 7 |
| sameDatePrevMonth.prev.lowHigh=HHL | 18 | 7 | 38.9% | 15 | 6 | 40% | 6 |
| sameDatePrevMonth.prev.sutta=6 | 12 | 5 | 41.7% | 22 | 9 | 40.9% | 5 |
| sameWeek2.prev.sutta=1 | 19 | 8 | 42.1% | 20 | 7 | 35% | 4 |
| sameDate.Kalyan Night.open.oddEven=EEO | 15 | 6 | 40% | 24 | 8 | 33.3% | 4 |

### Rajdhani Night close

Validation baseline: DP recall 23.2%, DP F1 27.6, accuracy 66.8%.

Validation with rules: DP recall 69.6%, DP F1 48, accuracy 58.9%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDate.Madhur Night.open.kind=DP | 38 | 14 | 36.8% | 66 | 24 | 36.4% | 18 |
| sameDate.Kalyan Night.open.last=6 | 18 | 8 | 44.4% | 27 | 12 | 44.4% | 11 |
| sameWeek2.prev.oddEven=EEO | 11 | 5 | 45.5% | 23 | 12 | 52.2% | 7 |
| sameDate.Madhur Night.close.firstLast=28 | 8 | 3 | 37.5% | 11 | 5 | 45.5% | 3 |
| target.day=Monday && sameDate.Sridevi Night.close.last=6 | 9 | 6 | 66.7% | 8 | 3 | 37.5% | 2 |
| sameDate.Milan Night.close.last=7 && sameDate.Milan Night.close.oddEven=EEO | 9 | 4 | 44.4% | 8 | 3 | 37.5% | 2 |

### Main Bazar open

Validation baseline: DP recall 24.3%, DP F1 27.9, accuracy 63.1%.

Validation with rules: DP recall 68.9%, DP F1 47.5, accuracy 55.2%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameDatePrevMonth.prev.kind=DP | 41 | 14 | 34.1% | 78 | 28 | 35.9% | 22 |
| sameDate.Kalyan Night.open.first=4 | 17 | 7 | 41.2% | 37 | 15 | 40.5% | 12 |
| sameDate.Rajdhani Night.open.first=5 | 13 | 5 | 38.5% | 22 | 11 | 50% | 7 |

### Main Bazar close

Validation baseline: DP recall 16.7%, DP F1 23.8, accuracy 69.4%.

Validation with rules: DP recall 77.8%, DP F1 53.6, accuracy 61.5%.

Final decision: reject rules for final model.

| rule | trainN | trainDP | trainPrecision | valN | valDP | valPrecision | baselineMissDP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sameSide.last10Dp=2 | 48 | 17 | 35.4% | 60 | 21 | 35% | 17 |
| sameDate.Kalyan Night.close.sutta=2 | 17 | 6 | 35.3% | 24 | 12 | 50% | 9 |
| sameDate.Milan Night.open.oddEven=EEO | 10 | 4 | 40% | 22 | 10 | 45.5% | 9 |
| sameDate.Milan Night.open.middle=9 | 8 | 3 | 37.5% | 17 | 8 | 47.1% | 7 |
| sameDate.Milan Night.open.middle=1 | 8 | 3 | 37.5% | 10 | 4 | 40% | 4 |
| sameSide.prev.lowHigh=HHL | 11 | 5 | 45.5% | 13 | 5 | 38.5% | 4 |
| sameWeek2.prev.firstLast=20 | 8 | 3 | 37.5% | 4 | 2 | 50% | 2 |
| sameDate.Kalyan Night.close.firstLast=16 | 8 | 3 | 37.5% | 10 | 3 | 30% | 2 |

## Interpretation

- A useful DP rule is one that catches baseline-missed DPs in validation and still catches them in the final test.
- Many strange number patterns look strong in training but disappear in validation; those are rejected.
- The selected model keeps rules market-by-market, so a pattern that hurts one market is not copied into another.
