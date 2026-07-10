# SP / DP Pattern Research

Generated: 2026-06-28T13:33:17.205Z

## Dataset

- Markets: 11
- Date range: 2013-05-06 to 2026-06-28
- Calendar days seen: 4426
- Open/close panels: 42548
- SP: 32092 (75.4%)
- DP: 10385 (24.4%)
- TP: 71 (0.17%)
- Average DPs per calendar day across all markets/sides: 2.35

## How Many DPs Come Per Day

| dpCount | days |
| --- | --- |
| 0 | 1237 |
| 1 | 1117 |
| 2 | 474 |
| 3 | 376 |
| 4 | 304 |
| 5 | 273 |
| 6 | 261 |
| 7 | 177 |
| 8 | 116 |
| 9 | 50 |
| 10 | 31 |
| 11 | 6 |
| 12 | 3 |
| 16 | 1 |

## Highest DP Markets / Gaps

Gap means number of same-market same-side draws from one DP to the next. A gap of 1 means back-to-back DP.

| market | side | n | dpRate | avgGap | medianGap | p90Gap | maxGap | currentWait |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Milan Day | close | 1168 | 30.6% | 3.3 | 2 | 7 | 21 | 3 |
| Sridevi Night | open | 1962 | 30.1% | 3.3 | 2 | 7 | 21 | 1 |
| Time Bazar | close | 1700 | 28% | 3.6 | 2 | 8 | 21 | 0 |
| Main Bazar | close | 1138 | 27.8% | 3.6 | 3 | 7 | 20 | 11 |
| Milan Day | open | 1168 | 27.7% | 3.6 | 3 | 7 | 22 | 0 |
| Rajdhani Day | open | 3963 | 25.7% | 3.9 | 3 | 7 | 14 | 0 |
| Main Bazar | open | 1138 | 25.7% | 3.9 | 3 | 9 | 19 | 4 |
| Kalyan | open | 1119 | 25.1% | 3.9 | 2 | 9 | 23 | 1 |
| Rajdhani Night | open | 1390 | 25.1% | 4 | 3 | 8 | 19 | 3 |
| Madhur Night | open | 2533 | 24.8% | 4 | 3 | 8 | 27 | 6 |
| Time Bazar | open | 1700 | 24.7% | 4 | 3 | 9 | 23 | 3 |
| Rajdhani Night | close | 1390 | 24.7% | 4 | 3 | 8 | 18 | 2 |

## Base Rates

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open/night | 8069 | 26% | 74% |
| open/day | 12520 | 24.7% | 75.3% |
| close/night | 8064 | 23.9% | 76.1% |
| close/day | 12518 | 23.4% | 76.6% |

## Weekday Rates

| segment | n | dpRate | spRate |
| --- | --- | --- | --- |
| open/Tuesday | 3361 | 26.8% | 73.2% |
| open/Monday | 3330 | 26.2% | 73.8% |
| close/Tuesday | 3360 | 25.6% | 74.4% |
| open/Wednesday | 3353 | 25.5% | 74.5% |
| open/Friday | 3326 | 25% | 75% |
| open/Thursday | 3366 | 24.8% | 75.2% |
| open/Saturday | 2863 | 24.7% | 75.3% |
| close/Wednesday | 3355 | 24.2% | 75.8% |
| close/Monday | 3331 | 24.2% | 75.8% |
| close/Thursday | 3363 | 23.9% | 76.1% |
| close/Friday | 3321 | 23.5% | 76.5% |
| close/Saturday | 2863 | 21.4% | 78.6% |
| close/Sunday | 989 | 18.7% | 81.3% |
| open/Sunday | 990 | 18.2% | 81.8% |

## DP Gap Buckets

| gap | n | dpRate | spRate |
| --- | --- | --- | --- |
| 4-5 | 7620 | 24.8% | 75.2% |
| 6-8 | 5658 | 24.7% | 75.3% |
| 3 | 5755 | 24.6% | 75.4% |
| 1 | 10030 | 24.4% | 75.6% |
| 2 | 7590 | 24.2% | 75.8% |
| 9-13 | 3272 | 23.9% | 76.1% |
| 14+ | 1246 | 22.7% | 77.3% |

## Same Weekday Repeat Test

This answers the "last Sunday had DP, can current Sunday get DP?" style question using the previous same weekday in the same market and same side.

| previousSameWeekdayKind | n | dpRate | spRate |
| --- | --- | --- | --- |
| TP | 68 | 33.8% | 66.2% |
| DP | 10023 | 25.2% | 74.8% |
| SP | 31080 | 24.1% | 75.9% |

## Open To Close Tests

These rows are observational candidate clues, not standalone pre-draw kind predictors: they describe whether the eventual close panel reused digits from the known open panel.

| todayOpenKind | n | closeDpRate | closeSpRate |
| --- | --- | --- | --- |
| DP | 5178 | 26.4% | 73.6% |
| SP | 15373 | 22.7% | 77.3% |

| digitCarry | n | closeDpRate | closeSpRate |
| --- | --- | --- | --- |
| openFirstInClose=false, openLastInClose=false | 10306 | 30.3% | 69.7% |
| openFirstInClose=false, openLastInClose=true | 4574 | 18.7% | 81.3% |
| openFirstInClose=true, openLastInClose=false | 4675 | 17.4% | 82.6% |
| openFirstInClose=true, openLastInClose=true | 1027 | 6.9% | 93.1% |

## Walk-Forward DP Rules

Known-before-draw features only. Train before 2026-03-31; validate from 2026-03-31. Validation DP baseline: 26.4%.

_No rows passed the support threshold._

## Walk-Forward SP Rules

Known-before-draw features only. Train before 2026-03-31; validate from 2026-03-31. Validation SP baseline: 73.6%.

| precision | lift | support | hits | trainPrecision | trainSupport | rule |
| --- | --- | --- | --- | --- | --- | --- |
| 94.4 | 20.8 | 18 | 17 | 79.2 | 582 | prevRecord.close.firstLast=30 && sameDate.earlierDpCount=0 |
| 94.1 | 20.5 | 17 | 16 | 83 | 764 | sameDate.jodiDouble=true && sameDate.earlierDpCount=0 |
| 92.3 | 18.7 | 26 | 24 | 83.8 | 524 | target.market=Sridevi && target.day=Sunday |
| 92.3 | 18.7 | 13 | 12 | 79.5 | 400 | sameDate.open.kind=SP && sameDate.open.firstLast=60 |
| 91.7 | 18.1 | 12 | 11 | 86.4 | 177 | prevRecord.close.firstLast=30 && sameWeekday.prev.sutta=1 |
| 91.7 | 18.1 | 12 | 11 | 81.7 | 382 | prevRecord.open.firstLast=58 && sameDate.earlierDpCount=0 |
| 91.7 | 18.1 | 12 | 11 | 78.3 | 405 | sameDate.open.firstLast=37 |
| 89.3 | 15.7 | 28 | 25 | 81.5 | 780 | target.day=Sunday && sameDate.open.kind=SP |
| 88.2 | 14.6 | 17 | 15 | 80.6 | 273 | sameDate.open.kind=SP && source.prev.close.firstLast=27 |
| 88.1 | 14.5 | 59 | 52 | 81.2 | 927 | target.market=Milan Night && sameDate.open.kind=SP |
| 87.5 | 13.9 | 40 | 35 | 79.8 | 1616 | sameWeekday.prev.sutta=1 && sameDate.earlierDpCount=0 |
| 87.1 | 13.5 | 31 | 27 | 79.5 | 658 | prevRecord.close.firstLast=30 && sameDate.open.kind=SP |
| 86.4 | 12.8 | 22 | 19 | 78.4 | 519 | source.prev.open.firstLast=37 |
| 85.7 | 12.1 | 63 | 54 | 80.8 | 1581 | sameDate.open.kind=SP && sameDate.jodiDouble=true |
| 85.7 | 12.1 | 14 | 12 | 85.9 | 64 | source.prev.open.firstLast=78 && source.prev.open.dpDigit=8 |
| 85.7 | 12.1 | 14 | 12 | 79.3 | 222 | prevRecord.close.sutta=0 && prevRecord.close.firstLast=25 |
| 84.6 | 11 | 26 | 22 | 78.6 | 504 | sameDate.prevMarket.close.last=3 |
| 84.6 | 11 | 13 | 11 | 81.6 | 114 | target.market=Milan Night && sameDate.open.sutta=8 |
| 84.2 | 10.6 | 57 | 48 | 82 | 1430 | target.day=Sunday && sameDate.earlierDpCount=0 |
| 84.2 | 10.6 | 19 | 16 | 79.1 | 592 | sameDate.open.kind=SP && sameDate.open.firstLast=39 |

## Read This Before Changing The Predictor

The important score is validation lift, not training precision. A rule that looks strong in old data but has weak or negative lift in the final 90 days is probably curve-fit noise.
