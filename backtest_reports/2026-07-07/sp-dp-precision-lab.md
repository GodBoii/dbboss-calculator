# SP / DP Precision Lab

Generated: 2026-07-07T12:24:09.658Z

## Method

- Goal: reduce the gap between predicted kind and correct kind.
- Primary metric: DP precision plus SP precision plus accuracy.
- Train window: 2023-06-07 to 2025-06-05
- Validation window: 2025-06-06 to 2026-06-05
- Final unseen test window: 2026-06-06 to 2026-07-05
- Tested model families: threshold grids, DP high-precision rules, SP high-precision rules, DP/SP conflict priority, baseline fallback.
- Approximate candidates per market/side: 4,410 threshold/rule/priority combinations, plus thousands of mined single/pair rules.

## Market Results

| market | side | selected | actualDP | baselinePredDP | baselineDPCorrect | baselineDPPrecision | baselineDPRecall | precisionPredDP | precisionDPCorrect | precisionDPPrecision | precisionDPRecall | precisionAccuracy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi | open | baseline | 7 | 1 | 0 | 0% | 0% | 3 | 0 | 0% | 0% | 73.3% |
| Sridevi | close | baseline | 9 | 1 | 1 | 100% | 11.1% | 0 | 0 | 0% | 0% | 73.3% |
| Time Bazar | open | baseline | 9 | 6 | 2 | 33.3% | 22.2% | 1 | 0 | 0% | 0% | 56% |
| Time Bazar | close | baseline | 8 | 6 | 3 | 50% | 37.5% | 6 | 1 | 16.7% | 12.5% | 68% |
| Madhur Day | open | baseline | 11 | 0 | 0 | 0% | 0% | 0 | 0 | 0% | 0% | 63.3% |
| Madhur Day | close | baseline | 5 | 3 | 1 | 33.3% | 20% | 3 | 1 | 33.3% | 20% | 80% |
| Milan Day | open | baseline | 7 | 9 | 2 | 22.2% | 28.6% | 0 | 0 | 0% | 0% | 52% |
| Milan Day | close | baseline | 10 | 5 | 3 | 60% | 30% | 2 | 1 | 50% | 10% | 64% |
| Rajdhani Day | open | baseline | 6 | 3 | 0 | 0% | 0% | 2 | 0 | 0% | 0% | 64% |
| Rajdhani Day | close | precision-model | 5 | 2 | 1 | 50% | 20% | 1 | 1 | 100% | 20% | 84% |
| Kalyan | open | baseline | 6 | 9 | 2 | 22.2% | 33.3% | 1 | 0 | 0% | 0% | 56% |
| Kalyan | close | precision-model | 9 | 7 | 3 | 42.9% | 33.3% | 1 | 1 | 100% | 11.1% | 68% |
| Sridevi Night | open | baseline | 11 | 8 | 3 | 37.5% | 27.3% | 0 | 0 | 0% | 0% | 56.7% |
| Sridevi Night | close | baseline | 5 | 3 | 0 | 0% | 0% | 2 | 0 | 0% | 0% | 73.3% |
| Kalyan Night | open | baseline | 4 | 7 | 2 | 28.6% | 50% | 0 | 0 | 0% | 0% | 58.8% |
| Kalyan Night | close | baseline | 6 | 6 | 2 | 33.3% | 33.3% | 0 | 0 | 0% | 0% | 52.9% |
| Madhur Night | open | baseline | 7 | 9 | 5 | 55.6% | 71.4% | 4 | 2 | 50% | 28.6% | 76% |
| Madhur Night | close | baseline | 5 | 6 | 2 | 33.3% | 40% | 3 | 1 | 33.3% | 20% | 72% |
| Milan Night | open | precision-model | 3 | 14 | 1 | 7.1% | 33.3% | 8 | 1 | 12.5% | 33.3% | 64% |
| Milan Night | close | baseline | 7 | 12 | 3 | 25% | 42.9% | 2 | 0 | 0% | 0% | 48% |
| Rajdhani Night | open | baseline | 6 | 3 | 2 | 66.7% | 33.3% | 0 | 0 | 0% | 0% | 75% |
| Rajdhani Night | close | precision-model | 5 | 3 | 0 | 0% | 0% | 3 | 1 | 33.3% | 20% | 70% |
| Main Bazar | open | precision-model | 6 | 12 | 4 | 33.3% | 66.7% | 1 | 1 | 100% | 16.7% | 75% |
| Main Bazar | close | baseline | 1 | 10 | 0 | 0% | 0% | 4 | 0 | 0% | 0% | 45% |

## Overall

| model | total | correct | accuracy | actualDP | predDP | dpCorrect | DP precision | DP recall | DP F1 | SP recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 594 | 375 | 63.1% | 158 | 145 | 42 | 29% | 26.6% | 27.7 | 76.4% |
| precision candidates | 594 | 411 | 69.2% | 158 | 47 | 11 | 23.4% | 7% | 10.8 | 91.7% |
| selected per market | 594 | 391 | 65.8% | 158 | 121 | 38 | 31.4% | 24.1% | 27.3 | 81% |

## Selected Precision Models

### Sridevi open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.65, conflict priority: baseline

Validation baseline: DP precision 24.4%, DP recall 26.8%, accuracy 64.6%.

Validation precision model: DP precision 54.8%, DP recall 20.7%, accuracy 78.2%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 73.3%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 66.7%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDate.any.Rajdhani Night.close.sutta=8 | 10 | 4 | 40% | 4 | 3 | 75% |
| DP | prevDate.any.Time Bazar.open.sutta=8 | 11 | 4 | 36.4% | 12 | 6 | 50% |
| DP | prevDate.any.Madhur Day.open.sutta=1 | 9 | 4 | 44.4% | 10 | 5 | 50% |
| SP | sameSide.last30.dpDigit6Count=2+ && prevDate.nightDpCount=4 | 17 | 17 | 100% | 17 | 17 | 100% |
| SP | sameSide.last30.dpDigit6Count=2+ && sameDatePrevMonth.prev.oddEven=EEE | 12 | 10 | 83.3% | 15 | 15 | 100% |
| SP | sameWeek2.prev.firstLast=48 | 8 | 7 | 87.5% | 13 | 13 | 100% |
| SP | prevDay.close.firstLast=26 | 10 | 8 | 80% | 13 | 13 | 100% |
| SP | model.signal=Operator: Regime hooking: OGI 74/100 (x1.10) | 14 | 11 | 78.6% | 11 | 11 | 100% |

### Sridevi close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.95, conflict priority: baseline

Validation baseline: DP precision 29.4%, DP recall 19.2%, accuracy 72.7%.

Validation precision model: DP precision 100%, DP recall 3.8%, accuracy 79.3%.

Final baseline: DP precision 100%, DP recall 11.1%, accuracy 73.3%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 70%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDate.any.Rajdhani Night.close.sutta=8 | 10 | 4 | 40% | 4 | 3 | 75% |
| SP | sameDatePrevMonth.prev.last=5 | 12 | 10 | 83.3% | 20 | 20 | 100% |

### Time Bazar open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.9, conflict priority: baseline

Validation baseline: DP precision 19.4%, DP recall 27.8%, accuracy 55.3%.

Validation precision model: DP precision 100%, DP recall 5.6%, accuracy 77.5%.

Final baseline: DP precision 33.3%, DP recall 22.2%, accuracy 56%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 60%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Sridevi.close.dpDigit=5 | 8 | 3 | 37.5% | 4 | 4 | 100% |
| SP | sameDate.Sridevi.open.lowHigh=HHH && sameDate.Sridevi.close.last=0 | 8 | 7 | 87.5% | 11 | 11 | 100% |
| SP | sameDate.Sridevi.close.middle=9 && sameDate.Sridevi.close.last=0 | 11 | 9 | 81.8% | 11 | 11 | 100% |
| SP | sameWeek1.prev.first=7 | 12 | 10 | 83.3% | 8 | 8 | 100% |

### Time Bazar close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.9, conflict priority: baseline

Validation baseline: DP precision 33.3%, DP recall 21.5%, accuracy 68.2%.

Validation precision model: DP precision 64.7%, DP recall 27.8%, accuracy 77.2%.

Final baseline: DP precision 50%, DP recall 37.5%, accuracy 68%.

Final precision model: DP precision 16.7%, DP recall 12.5%, accuracy 52%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDay.open.firstLast=20 && sameDate.Sridevi.close.lowHigh=LHH | 8 | 5 | 62.5% | 5 | 4 | 80% |
| DP | sameDate.openKnown.middle=3 && sameDate.openKnown.first=2 | 9 | 5 | 55.6% | 13 | 8 | 61.5% |
| DP | prevDate.any.Milan Day.close.sutta=8 | 8 | 5 | 62.5% | 5 | 3 | 60% |
| DP | sameDatePrevMonth.prev.firstLast=60 | 8 | 3 | 37.5% | 7 | 4 | 57.1% |
| DP | sameDate.Sridevi.close.middle=7 && sameSide.last30.dpDigit6Count=2+ | 8 | 5 | 62.5% | 9 | 5 | 55.6% |
| SP | sameDatePrevMonth.prev.middle=9 && sameDatePrevMonth.prev.oddEven=OOE | 11 | 11 | 100% | 10 | 10 | 100% |
| SP | prevDate.any.Rajdhani Day.open.sutta=6 | 8 | 7 | 87.5% | 10 | 10 | 100% |
| SP | sameWeek2.prev.first=2 && sameDate.Sridevi.close.middle=3 | 8 | 7 | 87.5% | 8 | 8 | 100% |
| SP | sameWeek1.prev.oddEven=OEO && sameDate.Sridevi.close.kind=DP | 9 | 9 | 100% | 7 | 7 | 100% |
| SP | sameDate.Sridevi.open.sutta=8 && sameSide.last30.dpDigit4Count=2+ | 9 | 9 | 100% | 5 | 5 | 100% |
| SP | sameWeek1.prev.last=9 && sameSide.last10Dp=1 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | sameSide.last30.dpDigit4Count=2+ && sameWeek2.prev.lowHigh=LLH | 12 | 11 | 91.7% | 4 | 4 | 100% |
| SP | sameWeek2.prev.dpDigit=4 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Rajdhani Night.close.sutta=8 | 10 | 8 | 80% | 4 | 4 | 100% |
| SP | sameSide.prev.last=5 | 15 | 13 | 86.7% | 16 | 15 | 93.8% |
| SP | prevDay.close.last=5 | 15 | 13 | 86.7% | 16 | 15 | 93.8% |
| SP | sameSide.prev.last=5 && prevDay.close.last=5 | 15 | 13 | 86.7% | 16 | 15 | 93.8% |

### Madhur Day open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.95, conflict priority: baseline

Validation baseline: DP precision 35.7%, DP recall 28.8%, accuracy 63.6%.

Validation precision model: DP precision 100%, DP recall 1%, accuracy 70.7%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 63.3%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 63.3%.

_No rows passed the threshold._

### Madhur Day close

Decision: reject precision model (precision model failed final guard)

Threshold: 2.05, conflict priority: baseline

Validation baseline: DP precision 25%, DP recall 17.6%, accuracy 67.3%.

Validation precision model: DP precision 76%, DP recall 22.4%, accuracy 79.5%.

Final baseline: DP precision 33.3%, DP recall 20%, accuracy 80%.

Final precision model: DP precision 33.3%, DP recall 20%, accuracy 80%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.openKnown.dpDigit=4 | 9 | 4 | 44.4% | 10 | 8 | 80% |
| DP | sameDate.Time Bazar.close.dpDigit=6 | 9 | 4 | 44.4% | 6 | 4 | 66.7% |
| DP | sameDate.Time Bazar.open.firstLast=17 | 10 | 4 | 40% | 11 | 7 | 63.6% |
| SP | sameDatePrevMonth.prev.firstLast=39 | 10 | 8 | 80% | 13 | 13 | 100% |
| SP | sameDate.Sridevi.open.dpDigit=9 | 8 | 8 | 100% | 7 | 7 | 100% |
| SP | sameDate.Sridevi.open.dpDigit=9 && sameDate.Sridevi.open.middle=9 | 8 | 8 | 100% | 7 | 7 | 100% |
| SP | sameDate.Time Bazar.close.firstLast=48 | 11 | 9 | 81.8% | 7 | 7 | 100% |
| SP | prevDate.any.Time Bazar.open.dpDigit=7 | 9 | 9 | 100% | 6 | 6 | 100% |

### Milan Day open

Decision: reject precision model (precision model failed final guard)

Threshold: 2.05, conflict priority: baseline

Validation baseline: DP precision 26%, DP recall 32.9%, accuracy 57.9%.

Validation precision model: DP precision 100%, DP recall 6.3%, accuracy 75.5%.

Final baseline: DP precision 22.2%, DP recall 28.6%, accuracy 52%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 72%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDate.any.Madhur Day.open.dpDigit=5 | 8 | 4 | 50% | 7 | 5 | 71.4% |
| SP | sameDatePrevMonth.prev.sutta=4 && sameDate.Madhur Day.close.oddEven=OEO | 8 | 8 | 100% | 5 | 5 | 100% |
| SP | prevDate.any.Madhur Day.close.sutta=5 | 8 | 7 | 87.5% | 5 | 5 | 100% |
| SP | sameDatePrevMonth.prev.dpDigit=7 | 10 | 8 | 80% | 4 | 4 | 100% |
| SP | sameDate.Madhur Day.open.first=6 | 15 | 12 | 80% | 20 | 19 | 95% |
| SP | sameDate.Sridevi.close.firstLast=16 | 9 | 8 | 88.9% | 11 | 10 | 90.9% |
| SP | sameDate.Sridevi.close.firstLast=29 | 9 | 8 | 88.9% | 11 | 10 | 90.9% |
| SP | sameWeek2.prev.dpDigit=6 | 12 | 10 | 83.3% | 11 | 10 | 90.9% |
| SP | target.date=21 | 8 | 7 | 87.5% | 9 | 8 | 88.9% |
| SP | prevDay.close.dpDigit=9 | 8 | 7 | 87.5% | 9 | 8 | 88.9% |
| SP | sameDatePrevMonth.prev.firstLast=30 | 8 | 7 | 87.5% | 17 | 15 | 88.2% |
| SP | sameDatePrevMonth.prev.oddEven=EOO | 16 | 15 | 93.8% | 24 | 21 | 87.5% |
| SP | sameDate.Time Bazar.open.lowHigh=HHL | 15 | 12 | 80% | 24 | 21 | 87.5% |

### Milan Day close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.9, conflict priority: baseline

Validation baseline: DP precision 21.4%, DP recall 9.9%, accuracy 61.9%.

Validation precision model: DP precision 100%, DP recall 6.6%, accuracy 71.9%.

Final baseline: DP precision 60%, DP recall 30%, accuracy 64%.

Final precision model: DP precision 50%, DP recall 10%, accuracy 60%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Time Bazar.close.dpDigit=6 | 8 | 3 | 37.5% | 6 | 5 | 83.3% |
| SP | sameDatePrevMonth.prev.middle=5 && target.day=Tuesday | 9 | 9 | 100% | 5 | 5 | 100% |

### Rajdhani Day open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.85, conflict priority: baseline

Validation baseline: DP precision 41.1%, DP recall 28.4%, accuracy 70%.

Validation precision model: DP precision 73.9%, DP recall 21%, accuracy 76.9%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 64%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 68%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDate.any.Milan Day.close.sutta=8 | 8 | 5 | 62.5% | 5 | 4 | 80% |
| DP | prevDate.any.Madhur Day.close.sutta=5 | 8 | 3 | 37.5% | 5 | 4 | 80% |
| DP | prevDate.any.Main Bazar.close.sutta=0 | 8 | 3 | 37.5% | 4 | 3 | 75% |
| DP | prevDate.any.Kalyan Night.open.sutta=2 | 10 | 5 | 50% | 8 | 5 | 62.5% |
| DP | sameDate.Time Bazar.open.first=7 | 11 | 5 | 45.5% | 8 | 5 | 62.5% |
| SP | prevDate.any.Milan Day.open.dpDigit=6 | 10 | 8 | 80% | 9 | 9 | 100% |
| SP | sameSide.prev.kind=DP && sameDatePrevMonth.prev.lowHigh=LHL | 13 | 12 | 92.3% | 8 | 8 | 100% |
| SP | prevDay.open.kind=DP && sameDatePrevMonth.prev.lowHigh=LHL | 13 | 12 | 92.3% | 8 | 8 | 100% |
| SP | sameSide.prev.kind=DP && sameDate.Sridevi.open.oddEven=EEE | 10 | 10 | 100% | 6 | 6 | 100% |
| SP | prevDay.open.kind=DP && sameDate.Sridevi.open.oddEven=EEE | 10 | 10 | 100% | 6 | 6 | 100% |
| SP | sameDate.Time Bazar.close.firstLast=39 | 10 | 8 | 80% | 6 | 6 | 100% |
| SP | prevDate.any.Milan Night.close.sutta=8 | 8 | 8 | 100% | 5 | 5 | 100% |
| SP | sameDate.Time Bazar.close.firstLast=47 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | sameDate.Milan Day.close.middle=9 && sameDate.Sridevi.open.middle=6 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | model.signal=Operator: Regime conservative: OGI 40/100 (x0.94) | 15 | 12 | 80% | 18 | 17 | 94.4% |
| SP | sameDate.Madhur Day.close.last=8 && sameSide.prev.kind=DP | 11 | 10 | 90.9% | 16 | 15 | 93.8% |
| SP | sameDate.Madhur Day.close.last=8 && prevDay.open.kind=DP | 11 | 10 | 90.9% | 16 | 15 | 93.8% |

### Rajdhani Day close

Decision: keep precision model (precision model improves final precision score)

Threshold: 2, conflict priority: baseline

Validation baseline: DP precision 25.6%, DP recall 15.2%, accuracy 71.9%.

Validation precision model: DP precision 60%, DP recall 4.5%, accuracy 78.5%.

Final baseline: DP precision 50%, DP recall 20%, accuracy 80%.

Final precision model: DP precision 100%, DP recall 20%, accuracy 84%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Milan Day.open.last=8 && sameWeek1.prev.middle=6 | 9 | 5 | 55.6% | 6 | 3 | 50% |
| SP | prevDate.nightDpCount=6 | 12 | 10 | 83.3% | 18 | 18 | 100% |
| SP | sameDate.openKnown.firstLast=18 | 8 | 8 | 100% | 8 | 8 | 100% |
| SP | prevDate.any.Main Bazar.close.dpDigit=9 | 8 | 7 | 87.5% | 8 | 8 | 100% |
| SP | sameDate.Time Bazar.close.middle=1 | 8 | 8 | 100% | 6 | 6 | 100% |
| SP | sameDate.Time Bazar.close.dpDigit=1 | 8 | 8 | 100% | 6 | 6 | 100% |
| SP | sameDate.Time Bazar.close.middle=1 && sameDate.Time Bazar.close.dpDigit=1 | 8 | 8 | 100% | 6 | 6 | 100% |
| SP | sameDate.Time Bazar.close.firstLast=47 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | sameWeek1.prev.first=4 && sameWeek1.prev.sutta=9 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | sameDate.Time Bazar.close.firstLast=47 && sameDate.Time Bazar.close.last=7 | 8 | 8 | 100% | 4 | 4 | 100% |
| SP | sameDate.Time Bazar.close.dpDigit=4 | 9 | 8 | 88.9% | 4 | 4 | 100% |
| SP | prevDate.any.Rajdhani Night.open.dpDigit=9 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Sridevi.close.dpDigit=5 | 8 | 7 | 87.5% | 4 | 4 | 100% |

### Kalyan open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.95, conflict priority: baseline

Validation baseline: DP precision 21.3%, DP recall 28.2%, accuracy 58.7%.

Validation precision model: DP precision 100%, DP recall 1.4%, accuracy 76.9%.

Final baseline: DP precision 22.2%, DP recall 33.3%, accuracy 56%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 72%.

_No rows passed the threshold._

### Kalyan close

Decision: keep precision model (precision model improves final precision score)

Threshold: 1.7, conflict priority: baseline

Validation baseline: DP precision 22.5%, DP recall 13.4%, accuracy 70.6%.

Validation precision model: DP precision 100%, DP recall 1.5%, accuracy 78.2%.

Final baseline: DP precision 42.9%, DP recall 33.3%, accuracy 60%.

Final precision model: DP precision 100%, DP recall 11.1%, accuracy 68%.

_No rows passed the threshold._

### Sridevi Night open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.95, conflict priority: baseline

Validation baseline: DP precision 31.5%, DP recall 27.6%, accuracy 61.6%.

Validation precision model: DP precision 100%, DP recall 1%, accuracy 71.3%.

Final baseline: DP precision 37.5%, DP recall 27.3%, accuracy 56.7%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 63.3%.

_No rows passed the threshold._

### Sridevi Night close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.5, conflict priority: SP

Validation baseline: DP precision 24.5%, DP recall 18.1%, accuracy 72.7%.

Validation precision model: DP precision 51.4%, DP recall 25%, accuracy 80.4%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 73.3%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 76.7%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Madhur Day.open.dpDigit=7 | 8 | 4 | 50% | 8 | 4 | 50% |
| DP | sameWeek1.prev.dpDigit=7 | 8 | 3 | 37.5% | 6 | 3 | 50% |
| DP | sameDate.openKnown.last=4 | 9 | 4 | 44.4% | 16 | 7 | 43.8% |
| SP | prevDate.nightDpCount=5 | 23 | 21 | 91.3% | 27 | 27 | 100% |
| SP | sameDate.Milan Day.open.firstLast=29 | 8 | 7 | 87.5% | 14 | 14 | 100% |
| SP | prevDate.any.Madhur Day.close.dpDigit=4 | 8 | 8 | 100% | 13 | 13 | 100% |
| SP | sameDate.Madhur Day.open.dpDigit=3 | 11 | 9 | 81.8% | 13 | 13 | 100% |
| SP | target.date=10 | 8 | 7 | 87.5% | 12 | 12 | 100% |
| SP | sameWeek1.prev.oddEven=EEE && prevDate.allDpCount=8 | 10 | 10 | 100% | 11 | 11 | 100% |
| SP | prevDate.any.Milan Day.close.sutta=6 | 9 | 8 | 88.9% | 11 | 11 | 100% |
| SP | sameDate.Sridevi.close.oddEven=OEE | 10 | 8 | 80% | 11 | 11 | 100% |

### Kalyan Night open

Decision: reject precision model (precision model failed final guard)

Threshold: 2, conflict priority: baseline

Validation baseline: DP precision 22.8%, DP recall 25%, accuracy 54.2%.

Validation precision model: DP precision 100%, DP recall 5.6%, accuracy 72.9%.

Final baseline: DP precision 28.6%, DP recall 50%, accuracy 58.8%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 76.5%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Rajdhani Day.close.first=2 && sameWeek2.prev.oddEven=OOE | 8 | 3 | 37.5% | 5 | 4 | 80% |
| SP | sameDate.Milan Day.open.firstLast=15 | 8 | 7 | 87.5% | 5 | 5 | 100% |
| SP | sameWeek2.prev.sutta=1 && sameWeek1.prev.sumBand=low | 8 | 7 | 87.5% | 5 | 5 | 100% |
| SP | sameDate.Sridevi Night.close.oddEven=EEO | 16 | 14 | 87.5% | 17 | 16 | 94.1% |
| SP | prevDay.close.firstLast=19 | 9 | 8 | 88.9% | 10 | 9 | 90% |
| SP | sameDate.Kalyan.close.middle=3 | 21 | 17 | 81% | 27 | 24 | 88.9% |
| SP | sameDate.Rajdhani Day.close.firstLast=30 | 8 | 7 | 87.5% | 18 | 16 | 88.9% |
| SP | sameDate.Rajdhani Day.close.middle=5 | 25 | 23 | 92% | 34 | 30 | 88.2% |
| SP | sameWeek1.prev.oddEven=EEE | 16 | 13 | 81.3% | 38 | 33 | 86.8% |

### Kalyan Night close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.85, conflict priority: baseline

Validation baseline: DP precision 17.7%, DP recall 22.4%, accuracy 64.5%.

Validation precision model: DP precision 66.7%, DP recall 4.1%, accuracy 80.9%.

Final baseline: DP precision 33.3%, DP recall 33.3%, accuracy 52.9%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 64.7%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SP | sameDate.Rajdhani Day.close.lowHigh=HHH | 10 | 10 | 100% | 22 | 22 | 100% |
| SP | sameWeek2.prev.sutta=0 | 16 | 13 | 81.3% | 22 | 22 | 100% |
| SP | sameWeek1.prev.sutta=4 | 17 | 15 | 88.2% | 16 | 16 | 100% |

### Madhur Night open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.55, conflict priority: SP

Validation baseline: DP precision 33.3%, DP recall 24.1%, accuracy 67.7%.

Validation precision model: DP precision 58.9%, DP recall 41.8%, accuracy 77.2%.

Final baseline: DP precision 55.6%, DP recall 71.4%, accuracy 76%.

Final precision model: DP precision 50%, DP recall 28.6%, accuracy 72%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Rajdhani Day.open.lowHigh=LHL && sameDate.Rajdhani Day.open.oddEven=EOE | 13 | 5 | 38.5% | 12 | 7 | 58.3% |
| DP | sameDate.Rajdhani Day.open.firstLast=20 && sameDate.Rajdhani Day.open.lowHigh=LHL | 9 | 6 | 66.7% | 7 | 4 | 57.1% |
| DP | prevDay.close.last=4 | 8 | 3 | 37.5% | 7 | 4 | 57.1% |
| DP | sameWeek1.prev.firstLast=20 | 14 | 5 | 35.7% | 13 | 7 | 53.8% |
| DP | sameDate.Rajdhani Day.open.firstLast=20 | 12 | 6 | 50% | 10 | 5 | 50% |
| DP | prevDate.any.Sridevi Night.open.dpDigit=9 | 8 | 3 | 37.5% | 8 | 4 | 50% |
| DP | sameDate.Kalyan Night.open.firstLast=37 | 8 | 3 | 37.5% | 4 | 2 | 50% |
| DP | sameDate.Kalyan.open.firstLast=19 | 10 | 7 | 70% | 17 | 8 | 47.1% |
| SP | sameDate.Milan Day.close.first=2 | 10 | 8 | 80% | 13 | 13 | 100% |
| SP | sameDate.Rajdhani Day.open.firstLast=28 | 8 | 7 | 87.5% | 8 | 8 | 100% |
| SP | prevDate.any.Madhur Day.open.dpDigit=5 | 8 | 7 | 87.5% | 7 | 7 | 100% |
| SP | prevDate.nightDpCount=2 && sameDate.Kalyan Night.open.middle=5 | 9 | 9 | 100% | 6 | 6 | 100% |
| SP | sameDate.Milan Day.open.middle=7 | 8 | 7 | 87.5% | 6 | 6 | 100% |
| SP | sameDatePrevMonth.prev.last=4 | 8 | 7 | 87.5% | 6 | 6 | 100% |
| SP | sameDate.Sridevi Night.open.firstLast=16 | 11 | 9 | 81.8% | 6 | 6 | 100% |
| SP | sameWeek1.prev.sutta=1 && sameSide.last30.dpDigit3Count=2+ | 9 | 9 | 100% | 5 | 5 | 100% |
| SP | sameDate.Kalyan.close.dpDigit=5 | 9 | 8 | 88.9% | 5 | 5 | 100% |
| SP | sameDate.Rajdhani Day.open.middle=5 && sameSide.last30.dpDigit3Count=2+ | 8 | 7 | 87.5% | 5 | 5 | 100% |
| SP | prevDate.any.Rajdhani Night.open.dpDigit=9 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Sridevi.close.dpDigit=5 | 8 | 7 | 87.5% | 4 | 4 | 100% |

### Madhur Night close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.7, conflict priority: baseline

Validation baseline: DP precision 28.1%, DP recall 15%, accuracy 75.6%.

Validation precision model: DP precision 100%, DP recall 6.7%, accuracy 81.5%.

Final baseline: DP precision 33.3%, DP recall 40%, accuracy 72%.

Final precision model: DP precision 33.3%, DP recall 20%, accuracy 76%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDay.open.dpDigit=3 | 8 | 3 | 37.5% | 4 | 3 | 75% |
| SP | sameDate.Kalyan Night.close.sutta=1 | 17 | 16 | 94.1% | 24 | 24 | 100% |
| SP | sameDate.Rajdhani Day.open.last=4 | 8 | 7 | 87.5% | 14 | 14 | 100% |
| SP | sameDate.Milan Day.close.first=2 | 10 | 8 | 80% | 13 | 13 | 100% |
| SP | prevDate.any.Time Bazar.open.sutta=8 | 8 | 7 | 87.5% | 12 | 12 | 100% |
| SP | prevDay.open.firstLast=26 | 8 | 8 | 100% | 9 | 9 | 100% |

### Milan Night open

Decision: keep precision model (precision model improves final precision score)

Threshold: 1.7, conflict priority: baseline

Validation baseline: DP precision 25.9%, DP recall 18.8%, accuracy 63.9%.

Validation precision model: DP precision 69.2%, DP recall 22.5%, accuracy 76.6%.

Final baseline: DP precision 7.1%, DP recall 33.3%, accuracy 40%.

Final precision model: DP precision 12.5%, DP recall 33.3%, accuracy 64%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Madhur Night.close.firstLast=39 | 8 | 3 | 37.5% | 11 | 7 | 63.6% |
| DP | prevDate.any.Madhur Day.open.dpDigit=5 | 8 | 3 | 37.5% | 7 | 4 | 57.1% |
| DP | sameDate.Kalyan Night.close.middle=2 | 19 | 8 | 42.1% | 10 | 5 | 50% |
| SP | sameDate.Kalyan.close.first=4 && prevDay.close.oddEven=OOE | 8 | 8 | 100% | 7 | 7 | 100% |
| SP | sameDate.Kalyan.close.middle=8 && sameWeek2.prev.lowHigh=LLH | 8 | 8 | 100% | 7 | 7 | 100% |
| SP | sameDate.Sridevi Night.close.firstLast=30 && sameDate.Sridevi Night.close.lowHigh=LHL | 11 | 11 | 100% | 6 | 6 | 100% |
| SP | sameWeek2.prev.firstLast=15 | 10 | 8 | 80% | 6 | 6 | 100% |
| SP | sameDate.Madhur Night.open.firstLast=20 && sameDate.Madhur Night.open.oddEven=EOE | 9 | 9 | 100% | 5 | 5 | 100% |
| SP | sameDate.Rajdhani Day.open.middle=6 | 8 | 8 | 100% | 5 | 5 | 100% |
| SP | sameDate.Madhur Night.close.oddEven=EEE && prevDay.close.oddEven=OOE | 8 | 8 | 100% | 5 | 5 | 100% |
| SP | prevDate.any.Rajdhani Night.open.dpDigit=9 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Main Bazar.close.sutta=0 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Sridevi.close.dpDigit=5 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Time Bazar.close.dpDigit=4 | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | prevDate.any.Sridevi Night.open.sutta=7 | 8 | 7 | 87.5% | 4 | 4 | 100% |

### Milan Night close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.85, conflict priority: SP

Validation baseline: DP precision 12.5%, DP recall 8.9%, accuracy 71.2%.

Validation precision model: DP precision 71.4%, DP recall 8.9%, accuracy 82.3%.

Final baseline: DP precision 25%, DP recall 42.9%, accuracy 48%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 64%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | prevDate.any.Rajdhani Day.open.sutta=6 | 8 | 4 | 50% | 10 | 5 | 50% |
| SP | sameDate.Rajdhani Day.close.sumBand=mid | 18 | 15 | 83.3% | 24 | 24 | 100% |
| SP | sameDatePrevMonth.prev.firstLast=10 | 16 | 14 | 87.5% | 17 | 17 | 100% |
| SP | sameDate.Rajdhani Day.open.last=0 | 13 | 11 | 84.6% | 17 | 17 | 100% |
| SP | prevDate.any.Sridevi Night.open.dpDigit=6 | 9 | 8 | 88.9% | 13 | 13 | 100% |
| SP | sameDate.Rajdhani Day.open.first=1 | 9 | 8 | 88.9% | 13 | 13 | 100% |
| SP | sameDate.Madhur Night.open.firstLast=20 | 14 | 12 | 85.7% | 13 | 13 | 100% |
| SP | sameDate.Rajdhani Day.close.kind=DP | 8 | 8 | 100% | 12 | 12 | 100% |
| SP | prevDay.open.firstLast=19 | 16 | 14 | 87.5% | 12 | 12 | 100% |

### Rajdhani Night open

Decision: reject precision model (precision model failed final guard)

Threshold: 1.95, conflict priority: baseline

Validation baseline: DP precision 31.8%, DP recall 40.6%, accuracy 60.1%.

Validation precision model: DP precision 100%, DP recall 2.9%, accuracy 73.5%.

Final baseline: DP precision 66.7%, DP recall 33.3%, accuracy 75%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 70%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SP | sameSide.last10Dp=4 && sameSide.prev.kind=DP | 10 | 8 | 80% | 18 | 18 | 100% |
| SP | sameSide.last10Dp=4 && prevDay.open.kind=DP | 10 | 8 | 80% | 18 | 18 | 100% |
| SP | sameDate.Milan Night.close.sutta=3 && prevDate.allDpCount=8 | 8 | 8 | 100% | 11 | 11 | 100% |
| SP | sameDate.Milan Night.open.sutta=0 && sameDate.Sridevi Night.close.lowHigh=LHH | 9 | 8 | 88.9% | 9 | 9 | 100% |
| SP | sameDate.Milan Night.close.firstLast=27 | 9 | 8 | 88.9% | 7 | 7 | 100% |

### Rajdhani Night close

Decision: keep precision model (precision model improves final precision score)

Threshold: 1.35, conflict priority: SP

Validation baseline: DP precision 34%, DP recall 23.2%, accuracy 66.8%.

Validation precision model: DP precision 74.2%, DP recall 33.3%, accuracy 78.7%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 60%.

Final precision model: DP precision 33.3%, DP recall 20%, accuracy 70%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Kalyan Night.open.sutta=4 && sameDate.Madhur Night.open.kind=DP | 8 | 6 | 75% | 6 | 4 | 66.7% |
| DP | sameWeek2.prev.oddEven=EEO | 11 | 5 | 45.5% | 23 | 12 | 52.2% |
| SP | sameDate.Kalyan Night.open.sumBand=high && sameWeek1.prev.sumBand=high | 8 | 7 | 87.5% | 12 | 12 | 100% |
| SP | sameWeek2.prev.firstLast=20 | 8 | 7 | 87.5% | 7 | 7 | 100% |
| SP | model.signal=Operator: Regime TRAP: recent close-chase risk, OGI 40/100 (x0.94) && sameSide.last5Dp=3 | 8 | 8 | 100% | 6 | 6 | 100% |
| SP | sameDate.Kalyan Night.open.sutta=3 && sameWeek1.prev.sumBand=high | 8 | 7 | 87.5% | 4 | 4 | 100% |
| SP | sameDatePrevMonth.prev.sutta=5 | 13 | 12 | 92.3% | 24 | 23 | 95.8% |
| SP | sameDate.Milan Night.close.sutta=2 | 15 | 12 | 80% | 23 | 22 | 95.7% |
| SP | sameDate.Sridevi Night.open.oddEven=OEO && sameDate.Sridevi Night.open.first=1 | 8 | 7 | 87.5% | 16 | 15 | 93.8% |
| SP | sameDate.Kalyan Night.close.sutta=6 | 16 | 16 | 100% | 29 | 27 | 93.1% |
| SP | sameDate.Madhur Night.close.oddEven=EEE | 17 | 14 | 82.4% | 28 | 26 | 92.9% |
| SP | sameDate.Kalyan Night.open.lowHigh=HHH && sameDate.Kalyan Night.open.first=6 | 8 | 8 | 100% | 13 | 12 | 92.3% |
| SP | sameDate.Kalyan Night.open.sumBand=high && sameDate.Kalyan Night.open.first=6 | 8 | 8 | 100% | 13 | 12 | 92.3% |
| SP | sameDate.Kalyan Night.open.sutta=1 | 15 | 12 | 80% | 24 | 22 | 91.7% |

### Main Bazar open

Decision: keep precision model (precision model improves final precision score)

Threshold: 1.85, conflict priority: baseline

Validation baseline: DP precision 32.7%, DP recall 24.3%, accuracy 63.1%.

Validation precision model: DP precision 100%, DP recall 5.4%, accuracy 72.2%.

Final baseline: DP precision 33.3%, DP recall 66.7%, accuracy 50%.

Final precision model: DP precision 100%, DP recall 16.7%, accuracy 75%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameDate.Milan Night.close.first=3 && sameDate.Kalyan Night.close.last=8 | 10 | 7 | 70% | 4 | 3 | 75% |
| SP | sameDate.Milan Night.close.firstLast=27 | 9 | 8 | 88.9% | 7 | 7 | 100% |
| SP | prevDay.close.oddEven=OEE && sameDate.Rajdhani Night.close.middle=5 | 9 | 8 | 88.9% | 10 | 9 | 90% |
| SP | sameDate.Rajdhani Night.close.middle=5 && sameWeek2.prev.last=9 | 8 | 7 | 87.5% | 10 | 9 | 90% |
| SP | sameDate.Kalyan Night.close.last=5 && sameDate.Kalyan Night.close.lowHigh=LLH | 8 | 8 | 100% | 15 | 13 | 86.7% |
| SP | sameDate.Kalyan Night.close.last=5 | 9 | 8 | 88.9% | 15 | 13 | 86.7% |
| SP | sameWeek1.prev.firstLast=20 | 8 | 7 | 87.5% | 15 | 13 | 86.7% |
| SP | sameDate.Kalyan Night.close.middle=4 && sameDate.Kalyan Night.close.lowHigh=LLH | 14 | 14 | 100% | 22 | 19 | 86.4% |
| SP | sameDatePrevMonth.prev.sutta=6 | 17 | 14 | 82.4% | 29 | 25 | 86.2% |

### Main Bazar close

Decision: reject precision model (precision model failed final guard)

Threshold: 1.85, conflict priority: SP

Validation baseline: DP precision 41.4%, DP recall 16.7%, accuracy 69.4%.

Validation precision model: DP precision 66.7%, DP recall 25%, accuracy 75%.

Final baseline: DP precision 0%, DP recall 0%, accuracy 45%.

Final precision model: DP precision 0%, DP recall 0%, accuracy 75%.

| target | rule | trainN | trainHit | trainPrecision | valN | valHit | valPrecision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DP | sameSide.prev.firstLast=20 | 8 | 4 | 50% | 5 | 4 | 80% |
| DP | prevDay.close.firstLast=20 | 8 | 4 | 50% | 5 | 4 | 80% |
| DP | sameSide.prev.firstLast=20 && prevDay.close.firstLast=20 | 8 | 4 | 50% | 5 | 4 | 80% |
| DP | prevDay.open.firstLast=29 | 8 | 3 | 37.5% | 15 | 8 | 53.3% |
| DP | sameDate.Kalyan Night.close.sutta=2 | 17 | 6 | 35.3% | 24 | 12 | 50% |
| SP | sameWeek2.prev.firstLast=10 | 11 | 10 | 90.9% | 9 | 9 | 100% |
| SP | sameWeek1.prev.last=4 | 11 | 11 | 100% | 8 | 8 | 100% |
| SP | sameWeek1.prev.last=4 && sameWeek1.prev.lowHigh=LLL | 11 | 11 | 100% | 8 | 8 | 100% |
| SP | sameDate.Madhur Night.open.kind=DP && sameWeek1.prev.lowHigh=LLL | 8 | 8 | 100% | 6 | 6 | 100% |
| SP | sameDate.Kalyan Night.open.first=7 | 11 | 10 | 90.9% | 5 | 5 | 100% |
| SP | prevDate.any.Kalyan.open.sutta=8 | 8 | 7 | 87.5% | 5 | 5 | 100% |
| SP | sameWeek2.prev.first=7 | 8 | 7 | 87.5% | 12 | 11 | 91.7% |
| SP | sameSide.prev.middle=3 | 21 | 18 | 85.7% | 19 | 17 | 89.5% |
| SP | prevDay.close.middle=3 | 21 | 18 | 85.7% | 19 | 17 | 89.5% |
| SP | sameWeek1.prev.lowHigh=LLL | 27 | 24 | 88.9% | 24 | 21 | 87.5% |
| SP | sameDate.Rajdhani Night.open.middle=2 | 12 | 10 | 83.3% | 27 | 23 | 85.2% |
| SP | sameDate.Madhur Night.close.lowHigh=LLL | 22 | 18 | 81.8% | 27 | 23 | 85.2% |
