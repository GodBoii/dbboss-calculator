# Production Source-Rule Ablation

Every source-hybrid rank promotion was disabled one at a time while the current production predictor and all other rules remained unchanged. Baseline and ablated rankings were recomputed together from the refreshed source cache.

Selection does not use the forward block. A removal must be non-regressive for its target side and Jodi in development, validation, chronological holdout, recent-30, and full history. Promotion additionally requires non-regression plus a gain in separately frozen forward evidence.

Rows evaluated: 6687. Rules audited: 48. Historical stored-ledger membership differences after the source refresh: 1707. Frozen-forward membership differences: 0.

## Recomputed production baseline

| Block | N | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: |
| development | 3966 | 2490/3966 (62.8%) | 2570/3966 (64.8%) | 1634/3966 (41.2%) |
| validation | 1323 | 861/1323 (65.1%) | 855/1323 (64.6%) | 565/1323 (42.7%) |
| holdout | 1326 | 926/1326 (69.8%) | 957/1326 (72.2%) | 678/1326 (51.1%) |
| recent30 | 360 | 305/360 (84.7%) | 315/360 (87.5%) | 267/360 (74.2%) |
| historical | 6615 | 4277/6615 (64.7%) | 4382/6615 (66.2%) | 2877/6615 (43.5%) |
| forward | 72 | 41/72 (56.9%) | 44/72 (61.1%) | 23/72 (31.9%) |

## Current recent-30 and frozen-forward by market

| Market | Recent-30 N | Open | Close | Jodi | Forward N | Open | Close | Jodi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Sridevi | 30 | 73.3% | 96.7% | 70.0% | 7 | 57.1% | 57.1% | 28.6% |
| Time Bazar | 30 | 83.3% | 86.7% | 73.3% | 6 | 66.7% | 83.3% | 50.0% |
| Madhur Day | 30 | 83.3% | 86.7% | 73.3% | 7 | 57.1% | 85.7% | 42.9% |
| Milan Day | 30 | 86.7% | 90.0% | 80.0% | 6 | 33.3% | 66.7% | 33.3% |
| Rajdhani Day | 30 | 93.3% | 80.0% | 76.7% | 6 | 66.7% | 66.7% | 50.0% |
| Kalyan | 30 | 76.7% | 83.3% | 63.3% | 6 | 50.0% | 66.7% | 16.7% |
| Sridevi Night | 30 | 93.3% | 93.3% | 86.7% | 7 | 57.1% | 42.9% | 28.6% |
| Kalyan Night | 30 | 80.0% | 83.3% | 63.3% | 5 | 60.0% | 60.0% | 40.0% |
| Madhur Night | 30 | 93.3% | 86.7% | 80.0% | 6 | 50.0% | 50.0% | 16.7% |
| Milan Night | 30 | 83.3% | 90.0% | 73.3% | 6 | 66.7% | 50.0% | 33.3% |
| Rajdhani Night | 30 | 83.3% | 83.3% | 70.0% | 5 | 80.0% | 60.0% | 40.0% |
| Main Bazar | 30 | 86.7% | 90.0% | 80.0% | 5 | 40.0% | 40.0% | 0.0% |

| Rule removed | Source | Dev side/Jodi | Validation | Holdout | Recent-30 | Forward | Decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| open:Sridevi:0 | previousDraw:Milan Night.closeSutta.mirrorOpposite | -10/-5 | +0/-3 | -3/-3 | -4/-3 | -1/+0 | keep_rule |
| open:Sridevi:1 | previousWeekday:Kalyan.openPanel.middle.sourceOpposite | -8/-5 | -2/-3 | +5/+3 | +2/+2 | +0/+0 | keep_rule |
| close:Sridevi:0 | previousDraw:Kalyan.openSutta.mirrorOpposite | +4/+0 | -5/-3 | -11/-5 | -5/-4 | -1/+0 | keep_rule |
| close:Sridevi:1 | previousDraw:Milan Night.openPanel.outerDiff.opposite | -6/-3 | -3/-5 | -6/-5 | -3/-2 | +1/+0 | keep_rule |
| close:Sridevi:2 | lag4:Time Bazar.closeSutta.source | -12/-2 | -3/-1 | -4/-3 | -3/-3 | +1/+0 | keep_rule |
| open:Time Bazar:0 | previousWeekday:Madhur Night.closePanel.middle.source | -3/-11 | +1/+0 | -2/+1 | -3/-2 | +0/+0 | keep_rule |
| close:Time Bazar:0 | sameDay:Sridevi.openSutta.oppositeNearTwo | -21/-13 | -4/-2 | -12/-13 | -4/-4 | +0/+0 | keep_rule |
| close:Time Bazar:1 | previousWeekday:Time Bazar.jodi.diff.opposite | -8/-6 | -6/-2 | -1/-3 | -3/-3 | -1/-1 | keep_rule |
| open:Madhur Day:0 | previousDraw:Milan Day.openSutta.sourceOpposite | -7/-5 | +2/-3 | -3/-2 | -5/-6 | +1/+1 | keep_rule |
| open:Madhur Day:1 | lag2:Time Bazar.closePanel.first.opposite | -5/+0 | -1/-2 | -4/+0 | -2/+0 | +1/+1 | keep_rule |
| close:Madhur Day:0 | previousDraw:Main Bazar.closePanel.first.mirrorOpposite | -13/-4 | +3/+3 | -11/-14 | -9/-9 | +0/+0 | keep_rule |
| close:Madhur Day:1 | lag5:Milan Night.jodi.diff.source | +0/+0 | -3/-2 | -1/-2 | -3/-3 | -1/+0 | keep_rule |
| open:Milan Day:0 | previousDraw:Rajdhani Night.openPanel.middle.addThreeCycle | -7/-5 | -3/-1 | -5/-7 | -3/-4 | +1/+1 | keep_rule |
| open:Milan Day:1 | previousDraw:Main Bazar.closePanel.first.source | -2/-2 | -3/-2 | -2/+0 | -1/-1 | +0/+0 | keep_rule |
| close:Milan Day:0 | sameDay:Madhur Day.closeSutta.oppositeNearTwo | -10/-12 | -6/-4 | -3/-6 | -4/-4 | +0/+0 | keep_rule |
| close:Milan Day:1 | previousMonthDay:Madhur Day.openPanel.last.opposite | -6/-2 | -1/-2 | -8/-6 | -3/-3 | +0/+0 | keep_rule |
| open:Rajdhani Day:0 | sameDay:Time Bazar.openPanel.outerSum.mirrorOpposite | -6/-6 | -1/+0 | -3/-5 | -4/-4 | +0/+0 | keep_rule |
| open:Rajdhani Day:1 | previousDraw:Sridevi.openPanel.outerDiff.source | -7/-2 | -2/-4 | -6/-2 | -1/+0 | +0/+0 | keep_rule |
| close:Rajdhani Day:0 | sameDay:Madhur Day.closePanel.product.source | -4/-3 | -2/-1 | -3/-4 | -4/-4 | +0/+0 | keep_rule |
| open:Kalyan:0 | sameDay:Sridevi.openPanel.last.addThreeCycle | -2/+0 | +4/+6 | +2/+5 | -3/-3 | +0/+0 | keep_rule |
| open:Kalyan:1 | sameDay:Time Bazar.openPanel.outerSum.opposite | -6/-4 | -9/-5 | -2/-1 | -1/-1 | +0/+0 | keep_rule |
| close:Kalyan:0 | sameDay:Time Bazar.openSutta.nearTwoOpposite | -15/-12 | -4/-2 | -4/-1 | -1/-1 | +0/+0 | keep_rule |
| close:Kalyan:1 | previousDraw:Main Bazar.jodi.sum.opposite | -4/-7 | -2/-2 | -3/-4 | -3/-3 | +0/+0 | keep_rule |
| open:Sridevi Night:0 | sameDay:Madhur Day.closeSutta.addThreeCycle | -5/-4 | -6/-2 | -6/-4 | -4/-4 | +0/+0 | keep_rule |
| open:Sridevi Night:1 | previousDraw:Main Bazar.openPanel.outerSum.source | -14/-9 | -1/-1 | -7/-3 | -2/-2 | +0/+0 | keep_rule |
| open:Sridevi Night:2 | previousDraw:Rajdhani Day.openPanel.first.opposite | -8/-5 | -4/-4 | +0/-1 | -1/-1 | +0/+0 | keep_rule |
| close:Sridevi Night:0 | previousDraw:Sridevi.closeSutta.mirrorOpposite | -5/-7 | -6/-7 | -5/-3 | -6/-5 | -1/+0 | keep_rule |
| close:Sridevi Night:1 | lag7:Madhur Day.openPanel.innerRightSum.opposite | -1/-2 | +0/+1 | -7/-7 | -3/-3 | +1/+0 | keep_rule |
| open:Kalyan Night:0 | sameDay:Madhur Day.closePanel.outerDiff.houseLowFirst | -2/-7 | +2/+3 | +3/-2 | -2/-2 | +0/+0 | keep_rule |
| open:Kalyan Night:1 | lag2:Kalyan Night.openSutta.source | -3/-4 | +0/-2 | -2/-1 | -3/-1 | +0/+0 | keep_rule |
| close:Kalyan Night:0 | sameDay:Sridevi Night.openSutta.sourceOpposite | -4/+0 | -3/+0 | -4/-2 | -5/-4 | -1/+0 | keep_rule |
| open:Madhur Night:0 | previousDraw:Kalyan Night.closePanel.outerSum.opposite | +10/+5 | -2/+0 | -5/-5 | -3/-3 | +0/+0 | keep_rule |
| open:Madhur Night:1 | lag3:Milan Night.openPanel.outerDiff.source | -8/-4 | -7/-5 | -2/-2 | -2/-2 | +0/+0 | keep_rule |
| open:Madhur Night:2 | sameDay:Kalyan.closePanel.innerLeftSum.opposite | +0/-3 | -6/-4 | -5/-1 | -1/+0 | -3/-1 | keep_rule |
| close:Madhur Night:0 | sameDay:Sridevi Night.openSutta.addThreeCycle | -7/-7 | -11/-6 | -8/-3 | -4/-2 | +0/+0 | keep_rule |
| close:Madhur Night:1 | lag7:Madhur Night.openPanel.span.opposite | -5/-5 | -1/-1 | -4/-3 | -3/-3 | +0/+0 | keep_rule |
| open:Milan Night:0 | sameDay:Madhur Night.openSutta.sourceOpposite | +6/+4 | +0/-1 | -7/-5 | -4/-3 | +0/+0 | keep_rule |
| close:Milan Night:0 | sameDay:Madhur Day.closeSutta.addThreeCycle | -8/-8 | -3/-4 | -12/-9 | -5/-4 | -1/+0 | keep_rule |
| close:Milan Night:1 | sameDay:Sridevi.closePanel.first.source | -2/-3 | +0/-2 | -7/-7 | -1/-1 | +2/+1 | keep_rule |
| close:Milan Night:2 | previousDraw:Madhur Day.closePanel.outerSum.source | -2/+1 | +1/+0 | -2/-2 | -1/-1 | +1/+0 | keep_rule |
| open:Rajdhani Night:0 | lag3:Main Bazar.openPanel.last.sourceOpposite | -2/-1 | -5/-6 | -4/-3 | -5/-3 | -1/-1 | keep_rule |
| close:Rajdhani Night:0 | lag2:Madhur Night.closePanel.middle.subtractThreeCycle | +4/+10 | -6/-8 | +0/-2 | -4/-3 | +2/+2 | keep_rule |
| close:Rajdhani Night:1 | lag4:Kalyan.closeSutta.source | -5/-4 | -3/-2 | -2/+1 | -1/+0 | -1/-1 | keep_rule |
| open:Main Bazar:0 | previousDraw:Madhur Day.openPanel.first.source | -3/-1 | -3/-2 | -6/-5 | -5/-5 | +0/+0 | keep_rule |
| open:Main Bazar:1 | previousWeekday:Milan Night.closeSutta.source | -8/-5 | -2/-2 | -4/-3 | -3/-3 | +0/+0 | keep_rule |
| close:Main Bazar:0 | sameDay:Time Bazar.openSutta.addThreeCycle | -7/-3 | -4/-2 | -8/-8 | -9/-8 | -1/+0 | keep_rule |
| close:Main Bazar:1 | sameDay:Milan Day.openPanel.outerSum.opposite | -3/-3 | -3/-4 | -5/-4 | -3/-3 | +0/+0 | keep_rule |
| close:Main Bazar:2 | lag4:Time Bazar.openPanel.innerRightSum.opposite | -3/-2 | -5/-3 | -6/-3 | -1/-1 | +0/+0 | keep_rule |

## Decision

Promotion candidates: 0. Monitor-only removals: 0.

Only promotion candidates may proceed to interaction testing. No removal is integrated from a development or historical improvement alone.
