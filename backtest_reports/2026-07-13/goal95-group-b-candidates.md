# Next Hybrid Candidate Search

Generated: 2026-07-13T14:52:56.065Z

Baseline: latest same-day-pack production ledger.

Stable candidates: 41

| Target | Rule | 30 delta | 30 jodi delta | 30 hit | 730 delta | 730 jodi delta | 730 hit | Forward delta | Forward jodi delta | Forward hit | dev/val/holdout | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Milan Day.open | lag7:Kalyan Night.openPanel.innerRightSum.source | 2 | 2 | 24/26 (92.3%) | 12 | 10 | 369/554 (66.6%) | 0 | 0 | 2/6 (33.3%) | 6/1/5 | yes |
| Milan Day.open | lag6:Rajdhani Night.closePanel.middle.source | 2 | 2 | 24/26 (92.3%) | 5 | 0 | 362/554 (65.3%) | 1 | 1 | 3/6 (50.0%) | 1/3/1 | yes |
| Milan Day.open | sameDay:Madhur Day.closePanel.span.source | 2 | 1 | 24/26 (92.3%) | 8 | 3 | 365/554 (65.9%) | 1 | 0 | 3/6 (50.0%) | 3/5/0 | yes |
| Madhur Day.close | previousMonthDay:Rajdhani Night.openPanel.innerLeftSum.opposite | 2 | 1 | 28/30 (93.3%) | 5 | 8 | 438/654 (67.0%) | 0 | 0 | 6/7 (85.7%) | 1/0/4 | yes |
| Milan Day.open | lag6:Time Bazar.closePanel.product.opposite | 1 | 1 | 23/26 (88.5%) | 12 | 3 | 369/554 (66.6%) | 0 | 0 | 2/6 (33.3%) | 4/6/2 | yes |
| Milan Day.open | previousWeekday:Time Bazar.closePanel.product.opposite | 1 | 1 | 23/26 (88.5%) | 11 | 3 | 368/554 (66.4%) | 0 | 0 | 2/6 (33.3%) | 3/6/2 | yes |
| Milan Day.open | sameDay:Madhur Day.openPanel.product.opposite | 1 | 1 | 23/26 (88.5%) | 8 | 8 | 365/554 (65.9%) | 0 | 0 | 2/6 (33.3%) | 2/6/0 | yes |
| Madhur Day.close | lag4:Kalyan Night.closePanel.innerRightSum.opposite | 1 | 1 | 27/30 (90.0%) | 8 | 7 | 441/654 (67.4%) | -1 | -1 | 5/7 (71.4%) | 3/2/3 | yes |
| Madhur Day.close | lag2:Main Bazar.openPanel.outerDiff.opposite | 1 | 1 | 27/30 (90.0%) | 8 | 4 | 441/654 (67.4%) | -1 | -1 | 5/7 (71.4%) | 7/1/0 | yes |
| Madhur Day.open | sameDay:Sridevi.openPanel.innerLeftSum.opposite | 1 | 1 | 26/30 (86.7%) | 8 | 3 | 433/654 (66.2%) | 1 | 1 | 5/7 (71.4%) | 3/4/1 | yes |
| Milan Day.open | previousDraw:Madhur Night.openPanel.innerRightDiff.opposite | 1 | 1 | 23/26 (88.5%) | 8 | 0 | 365/554 (65.9%) | 0 | 0 | 2/6 (33.3%) | 2/3/3 | yes |
| Madhur Day.open | lag6:Milan Day.closePanel.product.opposite | 1 | 1 | 26/30 (86.7%) | 6 | 4 | 431/654 (65.9%) | 0 | 0 | 4/7 (57.1%) | 4/1/1 | yes |
| Madhur Day.open | lag4:Sridevi Night.openPanel.span.source | 1 | 1 | 26/30 (86.7%) | 6 | 3 | 431/654 (65.9%) | 1 | 1 | 5/7 (71.4%) | 5/0/1 | yes |
| Madhur Day.open | lag3:Sridevi.openPanel.last.opposite | 1 | 1 | 26/30 (86.7%) | 4 | 5 | 429/654 (65.6%) | 0 | 0 | 4/7 (57.1%) | 1/2/1 | yes |
| Madhur Day.open | lag5:Time Bazar.closePanel.middle.source | 1 | 1 | 26/30 (86.7%) | 4 | 3 | 429/654 (65.6%) | 0 | 0 | 4/7 (57.1%) | 2/0/2 | yes |
| Madhur Day.open | lag5:Rajdhani Day.closePanel.innerRightSum.source | 1 | 1 | 26/30 (86.7%) | 3 | 4 | 428/654 (65.4%) | 0 | 0 | 4/7 (57.1%) | 1/1/1 | yes |
| Madhur Day.open | previousDraw:Milan Day.openSutta.sourceOpposite | 1 | 1 | 26/30 (86.7%) | 2 | 2 | 427/654 (65.3%) | 0 | 0 | 4/7 (57.1%) | 0/0/2 | yes |
| Madhur Day.open | previousDraw:Milan Day.openPanel.sum.sourceOpposite | 1 | 1 | 26/30 (86.7%) | 2 | 2 | 427/654 (65.3%) | 0 | 0 | 4/7 (57.1%) | 0/0/2 | yes |
| Milan Day.close | lag6:Kalyan.openPanel.last.source | 1 | 1 | 25/26 (96.2%) | 2 | 0 | 354/554 (63.9%) | 1 | 0 | 5/6 (83.3%) | 2/0/0 | yes |
| Milan Day.close | previousWeekday:Kalyan.openPanel.last.source | 1 | 1 | 25/26 (96.2%) | 2 | 0 | 354/554 (63.9%) | 1 | 0 | 5/6 (83.3%) | 2/0/0 | yes |
| Madhur Day.open | sameDay:Sridevi.openPanel.innerRightDiff.opposite | 1 | 1 | 26/30 (86.7%) | 1 | 2 | 426/654 (65.1%) | 0 | 0 | 4/7 (57.1%) | 1/0/0 | yes |
| Madhur Day.open | previousMonthDay:Madhur Day.openSutta.source | 1 | 1 | 26/30 (86.7%) | 1 | 2 | 426/654 (65.1%) | 0 | 0 | 4/7 (57.1%) | 0/1/0 | yes |
| Madhur Day.open | previousMonthDay:Madhur Day.openPanel.sum.source | 1 | 1 | 26/30 (86.7%) | 1 | 2 | 426/654 (65.1%) | 0 | 0 | 4/7 (57.1%) | 0/1/0 | yes |
| Madhur Day.open | lag6:Rajdhani Day.closePanel.innerLeftSum.source | 1 | 0 | 26/30 (86.7%) | 14 | 7 | 439/654 (67.1%) | 0 | 0 | 4/7 (57.1%) | 12/0/2 | yes |
| Madhur Day.open | previousWeekday:Rajdhani Day.closePanel.innerLeftSum.source | 1 | 0 | 26/30 (86.7%) | 13 | 7 | 438/654 (67.0%) | 0 | 0 | 4/7 (57.1%) | 11/0/2 | yes |
| Milan Day.open | lag3:Kalyan.openPanel.innerLeftDiff.opposite | 1 | 0 | 23/26 (88.5%) | 12 | 4 | 369/554 (66.6%) | 0 | 0 | 2/6 (33.3%) | 4/4/4 | yes |
| Milan Day.open | previousMonthDay:Milan Night.closePanel.innerRightSum.source | 1 | 0 | 23/26 (88.5%) | 11 | 1 | 368/554 (66.4%) | 1 | 1 | 3/6 (50.0%) | 4/5/2 | yes |
| Milan Day.close | previousDraw:Milan Night.closePanel.innerRightDiff.source | 1 | 0 | 25/26 (96.2%) | 11 | 1 | 363/554 (65.5%) | 0 | 0 | 4/6 (66.7%) | 2/5/4 | yes |
| Milan Day.close | previousDraw:Sridevi.openPanel.innerRightDiff.source | 1 | 0 | 25/26 (96.2%) | 10 | 4 | 362/554 (65.3%) | 0 | 0 | 4/6 (66.7%) | 8/1/1 | yes |
| Milan Day.open | lag2:Milan Day.closePanel.span.source | 1 | 0 | 23/26 (88.5%) | 8 | 2 | 365/554 (65.9%) | 1 | 1 | 3/6 (50.0%) | 1/5/2 | yes |
