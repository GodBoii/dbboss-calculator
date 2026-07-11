# Next Hybrid Candidate Search

Generated: 2026-07-11T15:54:19.141Z

Baseline: latest same-day-pack production ledger.

Stable candidates: 93

| Target | Rule | 30 delta | 30 jodi delta | 30 hit | 730 delta | 730 jodi delta | 730 hit | dev/val/holdout | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sridevi.close | lag4:Time Bazar.closeSutta.source | 3 | 3 | 29/30 (96.7%) | 16 | 6 | 420/674 (62.3%) | 9/3/4 | yes |
| Sridevi.close | lag4:Time Bazar.closePanel.sum.source | 3 | 3 | 29/30 (96.7%) | 16 | 6 | 420/674 (62.3%) | 9/3/4 | yes |
| Madhur Day.close | lag5:Milan Night.jodi.diff.source | 3 | 3 | 26/30 (86.7%) | 4 | 6 | 433/654 (66.2%) | 1/2/1 | yes |
| Time Bazar.close | previousWeekday:Time Bazar.jodi.diff.opposite | 2 | 2 | 24/26 (92.3%) | 14 | 8 | 371/554 (67.0%) | 7/6/1 | yes |
| Sridevi.close | lag2:Sridevi Night.openPanel.middle.source | 2 | 2 | 28/30 (93.3%) | 14 | 6 | 418/674 (62.0%) | 9/3/2 | yes |
| Sridevi.close | lag2:Main Bazar.openPanel.outerDiff.source | 2 | 2 | 28/30 (93.3%) | 12 | 9 | 416/674 (61.7%) | 10/1/1 | yes |
| Time Bazar.close | lag6:Time Bazar.jodi.diff.opposite | 2 | 2 | 24/26 (92.3%) | 12 | 7 | 369/554 (66.6%) | 6/5/1 | yes |
| Sridevi.close | lag3:Madhur Night.closeSutta.opposite | 2 | 2 | 28/30 (93.3%) | 11 | 6 | 415/674 (61.6%) | 9/1/1 | yes |
| Sridevi.close | lag3:Madhur Night.closePanel.sum.opposite | 2 | 2 | 28/30 (93.3%) | 11 | 6 | 415/674 (61.6%) | 9/1/1 | yes |
| Sridevi.close | lag7:Kalyan.openPanel.innerRightSum.source | 2 | 2 | 28/30 (93.3%) | 11 | 4 | 415/674 (61.6%) | 6/2/3 | yes |
| Sridevi.close | lag2:Kalyan.openPanel.innerLeftDiff.opposite | 2 | 2 | 28/30 (93.3%) | 8 | 2 | 412/674 (61.1%) | 4/3/1 | yes |
| Time Bazar.close | lag3:Kalyan.openPanel.last.opposite | 2 | 2 | 24/26 (92.3%) | 6 | 5 | 363/554 (65.5%) | 4/2/0 | yes |
| Time Bazar.close | lag3:Kalyan.closePanel.last.opposite | 2 | 2 | 24/26 (92.3%) | 6 | 2 | 363/554 (65.5%) | 3/1/2 | yes |
| Time Bazar.close | previousDraw:Sridevi Night.openPanel.innerRightDiff.opposite | 2 | 2 | 24/26 (92.3%) | 5 | 3 | 362/554 (65.3%) | 1/3/1 | yes |
| Sridevi.close | previousMonthDay:Rajdhani Day.closePanel.innerRightSum.source | 2 | 2 | 28/30 (93.3%) | 4 | 4 | 408/674 (60.5%) | 3/1/0 | yes |
| Madhur Day.close | previousWeekday:Milan Night.openSutta.opposite | 2 | 1 | 25/30 (83.3%) | 7 | 6 | 436/654 (66.7%) | 0/6/1 | yes |
| Madhur Day.close | previousWeekday:Milan Night.openPanel.sum.opposite | 2 | 1 | 25/30 (83.3%) | 7 | 6 | 436/654 (66.7%) | 0/6/1 | yes |
| Madhur Day.close | sameDay:Time Bazar.closePanel.innerLeftDiff.sourceOpposite | 2 | 1 | 25/30 (83.3%) | 4 | 3 | 433/654 (66.2%) | 3/0/1 | yes |
| Madhur Day.close | lag5:Madhur Day.openPanel.middle.sourceOpposite | 2 | 1 | 25/30 (83.3%) | 4 | 2 | 433/654 (66.2%) | 3/1/0 | yes |
| Madhur Day.close | lag4:Main Bazar.openPanel.first.source | 2 | 1 | 25/30 (83.3%) | 2 | 2 | 431/654 (65.9%) | 0/0/2 | yes |
| Time Bazar.close | previousDraw:Main Bazar.openPanel.innerRightDiff.houseLowFirst | 1 | 3 | 23/26 (88.5%) | 4 | 4 | 361/554 (65.2%) | 0/2/2 | yes |
| Time Bazar.close | lag7:Milan Night.openPanel.innerRightSum.opposite | 1 | 2 | 23/26 (88.5%) | 14 | 10 | 371/554 (67.0%) | 8/3/3 | yes |
| Time Bazar.close | lag3:Sridevi.openPanel.outerDiff.opposite | 1 | 2 | 23/26 (88.5%) | 11 | 9 | 368/554 (66.4%) | 2/8/1 | yes |
| Sridevi.close | lag3:Milan Day.jodi.diff.source | 1 | 2 | 27/30 (90.0%) | 9 | 11 | 413/674 (61.3%) | 8/1/0 | yes |
| Time Bazar.close | lag4:Rajdhani Day.closePanel.innerLeftSum.opposite | 1 | 2 | 23/26 (88.5%) | 6 | 0 | 363/554 (65.5%) | 0/3/3 | yes |
| Time Bazar.close | previousMonthDay:Milan Night.openPanel.innerRightDiff.opposite | 1 | 2 | 23/26 (88.5%) | 4 | 7 | 361/554 (65.2%) | 2/0/2 | yes |
| Time Bazar.close | lag4:Kalyan Night.closePanel.last.opposite | 1 | 2 | 23/26 (88.5%) | 3 | 2 | 360/554 (65.0%) | 0/1/2 | yes |
| Time Bazar.close | lag3:Madhur Day.closePanel.outerDiff.opposite | 1 | 1 | 23/26 (88.5%) | 16 | 7 | 373/554 (67.3%) | 8/5/3 | yes |
| Time Bazar.close | lag2:Kalyan Night.closePanel.first.source | 1 | 1 | 23/26 (88.5%) | 16 | 5 | 373/554 (67.3%) | 10/3/3 | yes |
| Time Bazar.close | lag6:Rajdhani Night.closePanel.outerDiff.source | 1 | 1 | 23/26 (88.5%) | 14 | 6 | 371/554 (67.0%) | 4/8/2 | yes |
