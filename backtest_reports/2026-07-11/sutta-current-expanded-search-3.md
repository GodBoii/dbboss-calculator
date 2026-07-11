# Next Hybrid Candidate Search

Generated: 2026-07-11T15:26:55.946Z

Baseline: latest same-day-pack production ledger.

Stable candidates: 161

| Target | Rule | 30 delta | 30 jodi delta | 30 hit | 730 delta | 730 jodi delta | 730 hit | dev/val/holdout | Stable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Main Bazar.open | previousWeekday:Milan Night.closeSutta.source | 3 | 3 | 21/22 (95.5%) | 13 | 10 | 298/454 (65.6%) | 6/3/4 | yes |
| Main Bazar.open | previousWeekday:Milan Night.closePanel.sum.source | 3 | 3 | 21/22 (95.5%) | 13 | 10 | 298/454 (65.6%) | 6/3/4 | yes |
| Rajdhani Night.open | lag7:Kalyan.openSutta.source | 3 | 3 | 20/22 (90.9%) | 8 | 3 | 297/455 (65.3%) | 6/0/2 | yes |
| Rajdhani Night.open | lag7:Kalyan.openPanel.sum.source | 3 | 3 | 20/22 (90.9%) | 8 | 3 | 297/455 (65.3%) | 6/0/2 | yes |
| Rajdhani Night.open | lag3:Main Bazar.openPanel.last.sourceOpposite | 3 | 2 | 20/22 (90.9%) | 12 | 12 | 301/455 (66.2%) | 5/4/3 | yes |
| Rajdhani Night.open | previousWeekday:Milan Day.openPanel.last.mirrorNear | 3 | 2 | 20/22 (90.9%) | 7 | 8 | 296/455 (65.1%) | 4/1/2 | yes |
| Main Bazar.open | lag7:Rajdhani Day.closeSutta.source | 2 | 2 | 20/22 (90.9%) | 14 | 11 | 299/454 (65.9%) | 10/0/4 | yes |
| Main Bazar.open | lag7:Rajdhani Day.closePanel.sum.source | 2 | 2 | 20/22 (90.9%) | 14 | 11 | 299/454 (65.9%) | 10/0/4 | yes |
| Main Bazar.open | previousDraw:Time Bazar.openPanel.first.opposite | 2 | 2 | 20/22 (90.9%) | 8 | 6 | 293/454 (64.5%) | 4/0/4 | yes |
| Rajdhani Night.open | lag2:Madhur Day.closePanel.middle.source | 2 | 2 | 19/22 (86.4%) | 8 | 5 | 297/455 (65.3%) | 3/1/4 | yes |
| Main Bazar.open | previousWeekday:Time Bazar.openSutta.sourceOpposite | 2 | 2 | 20/22 (90.9%) | 7 | 11 | 292/454 (64.3%) | 0/1/6 | yes |
| Main Bazar.open | previousWeekday:Time Bazar.openPanel.sum.sourceOpposite | 2 | 2 | 20/22 (90.9%) | 7 | 11 | 292/454 (64.3%) | 0/1/6 | yes |
| Main Bazar.open | lag2:Time Bazar.closePanel.middle.source | 2 | 2 | 20/22 (90.9%) | 7 | 9 | 292/454 (64.3%) | 6/0/1 | yes |
| Main Bazar.open | lag7:Time Bazar.openPanel.outerSum.source | 2 | 2 | 20/22 (90.9%) | 7 | 8 | 292/454 (64.3%) | 4/1/2 | yes |
| Main Bazar.open | previousWeekday:Time Bazar.openSutta.opposite | 2 | 2 | 20/22 (90.9%) | 7 | 8 | 292/454 (64.3%) | 3/0/4 | yes |
| Main Bazar.open | previousWeekday:Time Bazar.openPanel.sum.opposite | 2 | 2 | 20/22 (90.9%) | 7 | 8 | 292/454 (64.3%) | 3/0/4 | yes |
| Rajdhani Night.open | lag2:Milan Night.closePanel.first.sourceOpposite | 2 | 2 | 19/22 (86.4%) | 7 | 5 | 296/455 (65.1%) | 6/1/0 | yes |
| Main Bazar.open | lag3:Madhur Night.closeSutta.source | 2 | 2 | 20/22 (90.9%) | 6 | 7 | 291/454 (64.1%) | 3/3/0 | yes |
| Main Bazar.open | lag3:Madhur Night.closePanel.sum.source | 2 | 2 | 20/22 (90.9%) | 6 | 7 | 291/454 (64.1%) | 3/3/0 | yes |
| Main Bazar.open | sameDay:Madhur Night.closeSutta.opposite | 2 | 2 | 20/22 (90.9%) | 6 | 6 | 291/454 (64.1%) | 3/0/3 | yes |
| Main Bazar.open | sameDay:Madhur Night.closePanel.sum.opposite | 2 | 2 | 20/22 (90.9%) | 6 | 6 | 291/454 (64.1%) | 3/0/3 | yes |
| Rajdhani Night.open | lag7:Sridevi.openPanel.middle.source | 2 | 2 | 19/22 (86.4%) | 6 | 1 | 295/455 (64.8%) | 0/4/2 | yes |
| Rajdhani Night.open | previousWeekday:Sridevi.openPanel.middle.source | 2 | 2 | 19/22 (86.4%) | 6 | 1 | 295/455 (64.8%) | 0/4/2 | yes |
| Rajdhani Night.open | lag7:Time Bazar.closePanel.first.sourceOpposite | 2 | 2 | 19/22 (86.4%) | 5 | 4 | 294/455 (64.6%) | 4/0/1 | yes |
| Milan Night.close | previousDraw:Madhur Day.closePanel.outerSum.source | 2 | 2 | 25/26 (96.2%) | 3 | 4 | 359/551 (65.2%) | 1/0/2 | yes |
| Milan Night.close | lag2:Sridevi Night.openPanel.middle.source | 2 | 2 | 25/26 (96.2%) | 3 | 3 | 359/551 (65.2%) | 2/0/1 | yes |
| Main Bazar.open | sameDay:Rajdhani Day.closeSutta.source | 2 | 2 | 20/22 (90.9%) | 2 | 9 | 287/454 (63.2%) | 0/0/2 | yes |
| Main Bazar.open | sameDay:Rajdhani Day.closePanel.sum.source | 2 | 2 | 20/22 (90.9%) | 2 | 9 | 287/454 (63.2%) | 0/0/2 | yes |
| Rajdhani Night.close | previousWeekday:Rajdhani Day.closePanel.outerSum.opposite | 2 | 2 | 19/22 (86.4%) | 1 | 1 | 296/455 (65.1%) | 0/0/1 | yes |
| Rajdhani Night.open | previousDraw:Time Bazar.closePanel.last.sourceOpposite | 2 | 1 | 19/22 (86.4%) | 12 | 5 | 301/455 (66.2%) | 10/2/0 | yes |
