# Ten-panel portfolio experiment

Exploratory retrospective test using the frozen two-year source. Panel weights were fitted through July 2. Selection is July 3 through August 31; later evaluation is September 1 through October 8. Earlier studies inspected overlapping dates, so the later block is not an untouched holdout. Every prediction returns ten distinct legal panels. Production panel and Sutta parity passed on every scored event.

Source SHA-256: `7592f4b19d1135f717911a770aab6c582a733c0cbf33b2804db26b73f0d9a63c`. Comparator SHA-256: `7299f731f91d18e85522cf01dadd32befde55e6b1ee4189708976f33915ba1d3`. Saved 984 market-days.

Close after Open receives only the target Open panel. Avoid-pair candidates use the ordinary prior-only Close avoid list, including no-safe-call rows. They are experiments, not approved avoidance calls.

| Side | Frozen choice | Selection production | Selection choice | Later production | Later choice | Gained / lost | 97.5% paired interval |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| open | sutta_penalty_5 | 7.13% (43/603) | 8.13% (49/603) | 6.82% (26/381) | 5.51% (21/381) | 1 / 6 | -2.84 pp to 0.00 pp |
| closeLive | sutta_6 | 5.64% (34/603) | 7.13% (43/603) | 6.04% (23/381) | 5.25% (20/381) | 7 / 10 | -2.91 pp to 1.29 pp |

The two 97.5% date-clustered bootstrap intervals use Bonferroni family coverage for two frozen task choices. They do not correct for reuse of previously inspected data or establish future accuracy. Production wins selection ties.

| Candidate | Open selection | Open later | Live Close selection | Live Close later |
| --- | ---: | ---: | ---: | ---: |
| production | 7.13% | 6.82% | 5.64% | 6.04% |
| dp_1 | 6.63% | 5.77% | 4.98% | 6.04% |
| dp_2 | 6.14% | 5.77% | 5.14% | 5.51% |
| dp_3 | 6.14% | 4.99% | 5.31% | 5.77% |
| sutta_6 | 6.97% | 6.82% | 7.13% | 5.25% |
| sutta_8 | 6.80% | 6.82% | 5.97% | 4.72% |
| sutta_penalty_2 | 7.63% | 5.77% | 6.30% | 6.56% |
| sutta_penalty_5 | 8.13% | 5.51% | 6.47% | 5.51% |
| sutta_penalty_10 | 7.96% | 5.51% | 6.63% | 6.56% |
| avoid_hard | 7.63% | 7.09% | 6.14% | 7.09% |
| avoid_penalty_10 | 7.96% | 6.30% | 5.80% | 7.61% |
| overlap_2 | 7.13% | 6.82% | 5.64% | 6.04% |
| overlap_1 | 8.13% | 7.61% | 5.97% | 5.51% |
| sutta_6_dp_1 | 6.80% | 5.77% | 6.30% | 4.99% |
| sutta_6_dp_2 | 5.97% | 5.77% | 6.47% | 4.99% |

| Side | Actual kind | Later outcomes | Production hits | Frozen-choice hits |
| --- | --- | ---: | ---: | ---: |
| open | SP | 280 | 26 | 21 |
| open | DP | 98 | 0 | 0 |
| open | TP | 3 | 0 | 0 |
| closeLive | SP | 288 | 23 | 20 |
| closeLive | DP | 92 | 0 | 0 |
| closeLive | TP | 1 | 0 | 0 |

| Market | Outcomes | Open production / choice | Live Close production / choice |
| --- | ---: | ---: | ---: |
| Kalyan | 33 | 12.12% / 12.12% | 3.03% / 3.03% |
| Kalyan Night | 28 | 10.71% / 7.14% | 3.57% / 0.00% |
| Madhur Day | 34 | 0.00% / 0.00% | 2.94% / 0.00% |
| Madhur Night | 29 | 0.00% / 0.00% | 3.45% / 6.90% |
| Main Bazar | 28 | 7.14% / 3.57% | 7.14% / 10.71% |
| Milan Day | 32 | 6.25% / 6.25% | 0.00% / 0.00% |
| Milan Night | 32 | 12.50% / 6.25% | 9.38% / 12.50% |
| Rajdhani Day | 29 | 10.34% / 10.34% | 10.34% / 10.34% |
| Rajdhani Night | 28 | 3.57% / 7.14% | 3.57% / 3.57% |
| Sridevi | 38 | 13.16% / 7.89% | 15.79% / 5.26% |
| Sridevi Night | 38 | 0.00% / 0.00% | 2.63% / 5.26% |
| Time Bazar | 32 | 6.25% / 6.25% | 9.38% / 6.25% |

Frozen selection result: open: sutta_penalty_5 lost 5 net hits on the later block; closeLive: sutta_6 lost 3 net hits on the later block.

Two ideas noticed after looking at the later results are worth future testing. Open diversification shares at most one distinct digit between greedy picks, then fills from the original order. It hit 29/381 versus production 26/381, with a descriptive 95% gain interval of -1.10 pp to 2.82 pp. The soft Close avoided-digit penalty hit 29/381 versus 23/381, with an interval of -0.27 pp to 3.36 pp. Both intervals include a loss. These are post-hoc leads, not substitute winners or evidence for promotion.

Reserving DP slots did produce some DP hits, but it displaced SP hits. None of the pure DP allocations beat production overall on the later block. The zero-DP-hit blind spot alone does not justify reserving slots.

Production is unchanged. Any apparent advantage needs a frozen prospective comparison before promotion. Source coverage is inherited from the saved snapshot; this report makes no claim about October 9 onward or missing market results.

Run `node scripts/panel-portfolio-research.cjs`. Verify with `node --test scripts/verify-panel-portfolio.cjs`.
