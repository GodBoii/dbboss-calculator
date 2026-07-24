# Next Hybrid Candidate Search

Generated: 2026-07-13T14:52:44.984Z

Baseline: latest same-day-pack production ledger.

Stable candidates: 50

| Target | Rule | 30 delta | 30 jodi delta | 30 hit | 730 delta | 730 jodi delta | 730 hit | Forward delta | Forward jodi delta | Forward hit | dev/val/holdout | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rajdhani Day.close | lag5:Madhur Night.openPanel.span.opposite | 2 | 2 | 24/26 (92.3%) | 7 | 5 | 389/556 (70.0%) | -2 | -2 | 2/6 (33.3%) | 5/1/1 | yes |
| Rajdhani Day.close | lag2:Kalyan Night.openPanel.outerSum.source | 2 | 2 | 24/26 (92.3%) | 5 | 1 | 387/556 (69.6%) | -3 | -3 | 1/6 (16.7%) | 1/1/3 | yes |
| Rajdhani Day.close | lag7:Madhur Night.closePanel.innerLeftDiff.opposite | 2 | 1 | 24/26 (92.3%) | 6 | 7 | 388/556 (69.8%) | -3 | -3 | 1/6 (16.7%) | 3/0/3 | yes |
| Rajdhani Day.close | lag2:Madhur Day.openPanel.outerSum.opposite | 2 | 1 | 24/26 (92.3%) | 6 | 1 | 388/556 (69.8%) | -1 | -1 | 3/6 (50.0%) | 2/1/3 | yes |
| Rajdhani Day.open | lag4:Kalyan Night.closePanel.last.source | 1 | 1 | 25/26 (96.2%) | 16 | 1 | 368/556 (66.2%) | 0 | 0 | 4/6 (66.7%) | 4/8/4 | yes |
| Rajdhani Day.close | lag7:Rajdhani Day.openPanel.outerDiff.opposite | 1 | 1 | 23/26 (88.5%) | 10 | 2 | 392/556 (70.5%) | -2 | -2 | 2/6 (33.3%) | 1/6/3 | yes |
| Rajdhani Day.close | previousMonthDay:Rajdhani Night.closePanel.span.opposite | 1 | 1 | 23/26 (88.5%) | 9 | 4 | 391/556 (70.3%) | -3 | -3 | 1/6 (16.7%) | 3/2/4 | yes |
| Rajdhani Day.close | previousDraw:Milan Night.openPanel.outerSum.source | 1 | 1 | 23/26 (88.5%) | 8 | 4 | 390/556 (70.1%) | 0 | -1 | 4/6 (66.7%) | 4/4/0 | yes |
| Rajdhani Day.close | lag7:Sridevi.closePanel.outerDiff.sourceOpposite | 1 | 1 | 23/26 (88.5%) | 8 | 0 | 390/556 (70.1%) | -1 | -1 | 3/6 (50.0%) | 2/5/1 | yes |
| Rajdhani Day.close | previousMonthDay:Rajdhani Day.closePanel.innerLeftSum.opposite | 1 | 1 | 23/26 (88.5%) | 7 | 4 | 389/556 (70.0%) | 0 | 0 | 4/6 (66.7%) | 4/1/2 | yes |
| Rajdhani Day.close | lag2:Sridevi Night.openPanel.first.source | 1 | 1 | 23/26 (88.5%) | 6 | 7 | 388/556 (69.8%) | 0 | 0 | 4/6 (66.7%) | 1/1/4 | yes |
| Rajdhani Day.close | previousWeekday:Main Bazar.jodi.diff.source | 1 | 1 | 23/26 (88.5%) | 6 | 3 | 388/556 (69.8%) | -1 | -1 | 3/6 (50.0%) | 1/5/0 | yes |
| Rajdhani Day.close | lag5:Rajdhani Day.openPanel.innerLeftDiff.opposite | 1 | 1 | 23/26 (88.5%) | 6 | 2 | 388/556 (69.8%) | -1 | -1 | 3/6 (50.0%) | 3/1/2 | yes |
| Rajdhani Day.open | previousDraw:Milan Night.closePanel.last.source | 1 | 1 | 25/26 (96.2%) | 5 | 4 | 357/556 (64.2%) | -1 | 0 | 3/6 (50.0%) | 2/1/2 | yes |
| Rajdhani Day.close | previousWeekday:Time Bazar.openPanel.outerSum.source | 1 | 1 | 23/26 (88.5%) | 5 | 3 | 387/556 (69.6%) | 0 | 0 | 4/6 (66.7%) | 2/0/3 | yes |
| Kalyan.open | lag5:Rajdhani Day.closePanel.innerRightSum.source | 1 | 1 | 26/26 (100.0%) | 5 | 3 | 371/556 (66.7%) | 0 | 1 | 3/6 (50.0%) | 5/0/0 | yes |
| Rajdhani Day.close | lag6:Time Bazar.openPanel.outerSum.source | 1 | 1 | 23/26 (88.5%) | 5 | 2 | 387/556 (69.6%) | 0 | 0 | 4/6 (66.7%) | 1/3/1 | yes |
| Rajdhani Day.close | previousMonthDay:Madhur Night.openPanel.first.source | 1 | 1 | 23/26 (88.5%) | 5 | 0 | 387/556 (69.6%) | -3 | -3 | 1/6 (16.7%) | 4/0/1 | yes |
| Kalyan.open | lag7:Rajdhani Day.openPanel.innerRightDiff.opposite | 1 | 1 | 26/26 (100.0%) | 4 | 3 | 370/556 (66.5%) | 0 | 0 | 3/6 (50.0%) | 1/1/2 | yes |
| Rajdhani Day.close | lag5:Milan Night.closePanel.outerDiff.opposite | 1 | 1 | 23/26 (88.5%) | 4 | 1 | 386/556 (69.4%) | -2 | -2 | 2/6 (33.3%) | 3/0/1 | yes |
| Rajdhani Day.close | previousDraw:Time Bazar.openPanel.outerDiff.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 4 | 385/556 (69.2%) | -2 | -2 | 2/6 (33.3%) | 2/0/1 | yes |
| Rajdhani Day.close | lag5:Sridevi Night.openPanel.middle.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 3 | 385/556 (69.2%) | -2 | -2 | 2/6 (33.3%) | 3/0/0 | yes |
| Rajdhani Day.close | previousWeekday:Sridevi Night.closeSutta.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 3 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 1/1/1 | yes |
| Rajdhani Day.close | previousWeekday:Sridevi Night.closePanel.sum.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 3 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 1/1/1 | yes |
| Rajdhani Day.close | lag7:Sridevi Night.closeSutta.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 2 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 2/1/0 | yes |
| Rajdhani Day.close | lag7:Sridevi Night.closePanel.sum.opposite | 1 | 1 | 23/26 (88.5%) | 3 | 2 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 2/1/0 | yes |
| Rajdhani Day.close | lag2:Sridevi.closeSutta.source | 1 | 1 | 23/26 (88.5%) | 3 | 0 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 0/2/1 | yes |
| Rajdhani Day.close | lag2:Sridevi.closePanel.sum.source | 1 | 1 | 23/26 (88.5%) | 3 | 0 | 385/556 (69.2%) | -1 | -1 | 3/6 (50.0%) | 0/2/1 | yes |
| Rajdhani Day.close | previousDraw:Rajdhani Day.openPanel.product.sourceOpposite | 1 | 1 | 23/26 (88.5%) | 2 | 2 | 384/556 (69.1%) | -2 | -2 | 2/6 (33.3%) | 1/1/0 | yes |
| Kalyan.open | previousDraw:Milan Night.openPanel.middle.opposite | 1 | 1 | 26/26 (100.0%) | 2 | 2 | 368/556 (66.2%) | -1 | 0 | 2/6 (33.3%) | 0/1/1 | yes |
