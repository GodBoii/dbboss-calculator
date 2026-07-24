# Top-3 Open, Close, Adjusted Close, and Jodi Research Cycle

Generated: 2026-07-15  
Scope: research only; no production app or model files modified.

## Outcome

The available two-year chart history does not support a defensible 90% Top-3 prediction claim.

The strongest reproducible Top-3 digit results remain near the nominal 30% coverage expected when three of ten digits are selected. A small Open-ranking improvement was found, while ordinary Close had no durable challenger. Known Open adds a modest exploratory signal for adjusted Close. Exact three-pair Jodi accuracy remains near 3%-4%; the 3x3 nine-pair Jodi grid remains near 9%-12%.

No result in this report changes production.

## Prediction contracts

| Target | Research output | Nominal coverage |
| --- | ---: | ---: |
| Open Sutta | exactly 3 of 10 digits | 30% |
| Close Sutta | exactly 3 of 10 digits, before today's Open is known | 30% |
| Adjusted Close Sutta | exactly 3 of 10 digits, after today's Open is known | 30% |
| Exact Jodi | exactly 3 of 100 pairs | 3% |
| Jodi grid | 3 Open x 3 Close = 9 of 100 pairs | 9% |

Exact Jodi and the Jodi grid are deliberately reported separately. Calling a 3x3 grid “Top 3 Jodi” would hide that it actually contains nine bets.

## Data and validation design

- 12 tracked markets.
- 6,687 historical replay rows from 2024-08-26 through 2026-07-05.
- 72 separately frozen forward rows from 2026-07-06 through 2026-07-12.
- Every replay uses records dated strictly before the target row.
- Formula and neural hyperparameters are selected on development only.
- Validation, chronological holdout, and frozen forward rows do not select the development winner.
- Source chart history is mutable external data; cache-backed results should be content-addressed before future forward registries are frozen.

## Current production ranking sliced to Top 3

These numbers evaluate the current ranking as-is; they do not imply that it was designed or calibrated for Top 3.

| Window | N | Open | Close | Adjusted Close | 3x3 Jodi grid |
| --- | ---: | ---: | ---: | ---: | ---: |
| Last 7 calendar days | 72 | 19/72 (26.4%) | 18/72 (25.0%) | 24/72 (33.3%) | 5/72 (6.9%) |
| Last 30 calendar days | 309 | 95/309 (30.7%) | 100/309 (32.4%) | 116/309 (37.5%) | 34/309 (11.0%) |
| Last 180 calendar days | 1,831 | 575/1,831 (31.4%) | 575/1,831 (31.4%) | 602/1,831 (32.9%) | 188/1,831 (10.3%) |

The longer windows sit close to nominal coverage. The recent Top-6 results that previously appeared very high do not transfer to Top 3 and do not reproduce on the separately frozen forward week.

## Development-selected statistical formulas

189 target-specific statistical candidates were tested: hot/cold rolling frequency, weekday, calendar date, Markov transitions, previous Open/Close/Jodi contexts, deltas, lag echoes, opposite/house mappings, gaps, entropy regimes, known-Open conditionals, direct Jodi frequencies, and Jodi-grid combinations.

| Target | Development winner | Development | Validation | Holdout | Frozen forward | Decision |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Open | recent-7 hot | 29.4%→30.8% | 30.4%→32.0% | 31.6%→31.7% | 23.6%→30.6% | Monitor; small, non-significant gain |
| Close | lag-7 opposite | 31.3%→32.7% | 30.1%→28.8% | 32.9%→29.7% | 25.0%→25.0% | Reject |
| Adjusted Close | lag-7 opposite | 31.3%→32.7% | 30.1%→28.8% | 32.9%→29.7% | 25.0%→25.0% | Reject |
| Exact Jodi | recent-30 hot pair | 3.0%→4.0% | 2.8%→2.4% | 3.1%→2.8% | 0.0%→4.2% | Reject |
| 3x3 Jodi grid | Open delta + Close calendar date | 8.3%→10.4% | 8.9%→10.3% | 11.4%→9.7% | 5.6%→12.5% | Reject |

Recent-7 hot Open passed the mechanical non-regression gate, but the paired exact tests are not significant: validation p=0.461, holdout p=1.000, frozen forward p=0.405. It is a monitor candidate, not proof of predictability.

## Exploratory formulas that passed non-regression filters

These were not all the development-selected winner, so later-block filtering makes them exploratory rather than clean confirmations.

| Target | Formula | Validation | Holdout | Frozen forward | Interpretation |
| --- | --- | ---: | ---: | ---: | --- |
| Open | calendar date | 30.4%→30.7% | 31.6%→32.4% | 23.6%→27.8% | Small, unstable gain |
| Adjusted Close | known-Open empirical frequency | 30.1%→30.1% | 32.9%→33.2% | 25.0%→40.3% | Plausible post-Open signal; requires more sealed rows |
| Exact Jodi | calendar Open x recent-30 cold Close | 2.8%→3.8% | 3.1%→4.2% | 0.0%→4.2% | Small exact-pair lift; multiple-testing risk |
| Exact Jodi | recent-7 Open x recent-30 cold Close | 2.8%→3.9% | 3.1%→3.1% | 0.0%→1.4% | Too small for use |

For context, known-Open adjusted Close has a 95% Wilson interval of 30.4%-36.2% on holdout and 29.7%-51.8% on the 72-row forward block. Exact calendar/cold Jodi has a 3.2%-5.7% holdout interval and a 1.4%-11.5% forward interval. These intervals are nowhere near 90%.

## Causal neural candidates

The causal feature matrix contains calendar fields, frozen production ranks, completed own-market lags, previous cross-market draws, and only earlier same-day markets. Four additive/MLP configurations were selected on development.

| Target | Development | Validation | Holdout | Frozen forward | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Open | 29.4%→31.0% | 30.3%→31.3% | 31.7%→27.4% | 23.6%→31.9% | Reject: holdout regression |
| Close | 31.7%→32.6% | 30.1%→29.8% | 32.8%→30.5% | 25.0%→22.2% | Reject |
| Adjusted Close | 31.7%→32.3% | 30.1%→30.2% | 32.8%→32.1% | 25.0%→23.6% | Reject |
| Exact Jodi | 2.8%→3.6% | 2.9%→3.3% | 3.0%→3.3% | 0.0%→4.2% | Relative gate passes; practical accuracy only 4.2% |

The exact-Jodi neural result is not recommended for deployment. A tiny relative gain over a weak baseline does not justify a client-side neural artifact and does not meet the requested accuracy objective.

## Whole-panel categorical and interaction models

The original causal matrix already contained individual digits from completed prior panels. A separate research cycle added representations that had not been tested: each full panel as an exact categorical token, its sorted identity, structural sum/unique-count/span fields, and regularized factorization-machine interactions. Ordinary predictions use only prior or earlier-same-day completed draws. The adjusted-Close contract may additionally use the current published Open panel.

| Target | Development | Validation | Holdout | Frozen forward | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Open | 29.4%→31.6% | 30.3%→26.5% | 31.7%→28.4% | 23.6%→31.9% | Reject: validation and holdout regression |
| Close | 31.7%→31.5% | 30.1%→30.3% | 32.8%→28.7% | 25.0%→33.3% | Reject: development and holdout regression |
| Adjusted Close + Open panel | 31.7%→32.9% | 30.1%→31.4% | 32.8%→30.2% | 25.0%→23.6% | Reject: holdout and forward regression |
| Exact Jodi | 2.8%→3.8% | 2.9%→2.6% | 3.0%→3.6% | 0.0%→6.9% | Reject: validation regression; practical accuracy remains tiny |

Every panel-aware candidate fails the non-regression promotion rule and the requested 90% gate. Whole-panel information does not reveal the missing predictive signal.

## Cross-market event-sequence model

A multitask GRU was given the latest 64 completed market events in their actual publication order. Each event contains market, Open/Close digits, full Open/Close panels, weekday, and age. The target market and calendar context are separate inputs. The shared Open, Close, and exact-Jodi heads never receive the target event; only adjusted Close receives the current published Open panel. Architecture and stopping epoch were selected by mean development Top-3 accuracy across all four contracts.

| Target | Development | Validation | Holdout | Frozen forward | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Open | 29.4%→31.1% | 30.3%→29.9% | 31.7%→28.4% | 23.6%→31.9% | Reject |
| Close | 31.7%→30.3% | 30.1%→30.0% | 32.8%→28.0% | 25.0%→20.8% | Reject |
| Adjusted Close + Open panel | 31.7%→33.2% | 30.1%→30.3% | 32.8%→30.1% | 25.0%→33.3% | Reject: holdout regression |
| Exact Jodi | 2.8%→3.2% | 2.9%→2.5% | 3.0%→2.4% | 0.0%→2.8% | Reject |

The causal cutoff audit passed for all 6,687 samples: the latest encoded event was strictly earlier than the target Open time. Temporal ordering and shared multitask learning therefore do not reveal a durable high-accuracy signal.

## Independent-source fixed-formula replication

The previously selected formulas were replayed unchanged on an independently parsed eight-market history. No row from this source selected a formula, threshold, or window. The independent source contains 952 rows beyond the original cache and agrees exactly on Jodi and both panels for all 3,381 overlapping rows.

| Block | Open | Close | Adjusted Close | Exact 3 Jodis | 3x3 grid |
| --- | ---: | ---: | ---: | ---: | ---: |
| All 3,613 replay rows | 31.6% | 28.2% | 30.3% | 3.6% | 9.2% |
| Last 90 calendar days (557 rows) | 31.6% | 27.8% | 29.6% | 3.6% | 9.5% |
| Per-market final 20% (725 rows) | 30.3% | 27.7% | 31.2% | 3.3% | 9.7% |

The small full-history Open and exact-Jodi deviations are not stable in the later blocks. Every fixed formula remains near its nominal contract coverage and fails the 90% gate.

## Market-specific optimization audit

Choosing a different formula per market on development produced large apparent gains and then failed on later data.

| Target | Development | Validation | Holdout | Frozen forward | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Open | 29.4%→37.1% | 30.4%→28.0% | 31.6%→28.5% | 23.6%→25.0% | Reject |
| Close | 31.3%→38.3% | 30.1%→29.6% | 32.9%→31.6% | 25.0%→23.6% | Reject |
| Adjusted Close | 31.3%→38.7% | 30.1%→30.6% | 32.9%→31.3% | 25.0%→18.1% | Reject |
| Exact Jodi | 3.0%→5.6% | 2.8%→2.7% | 3.1%→3.1% | 0.0%→4.2% | Reject |
| 3x3 Jodi grid | 8.3%→13.9% | 8.9%→9.1% | 11.4%→9.1% | 5.6%→5.6% | Reject |

This is the clearest demonstration of overfitting in the cycle. Market-specific logic should not be accepted merely because it looks strong in the window that chose it.

## Market stability of the recent-7 Open candidate

Combined validation, holdout, and forward deltas versus the frozen production Top-3 ranking:

| Market | Delta | Market | Delta |
| --- | ---: | --- | ---: |
| Sridevi | +21 | Time Bazar | +1 |
| Madhur Day | -18 | Milan Day | +1 |
| Rajdhani Day | +1 | Kalyan | 0 |
| Sridevi Night | 0 | Kalyan Night | +5 |
| Madhur Night | +7 | Milan Night | -2 |
| Rajdhani Night | -1 | Main Bazar | +7 |

The large Madhur Day regression and Sridevi gain show that the formula is not universally stable. Further forward registration should track markets separately without selecting winners from the same forward results.

## Successful and rejected hypothesis ranking

### Retain for sealed forward monitoring

1. Known-Open empirical Close frequency: strongest plausible adjusted-Close effect, but exploratory.
2. Recent-7 hot Open: clean development selection and no aggregate later-block regression, but no significant paired advantage.
3. Calendar Open x recent cold Close exact-Jodi score: small, multiple-testing-sensitive lift.
4. Calendar-date Open: small consistent relative improvement, low practical impact.

### Reject in this cycle

1. Per-market best-formula selection: severe validation/holdout overfit.
2. Lag-7 opposite for Close/adjusted Close: development gain reversed later.
3. Delta/calendar 3x3 Jodi grid: holdout regression.
4. Causal MLP for Open, Close, and adjusted Close: later-block regressions.
5. Recent-30 hot exact Jodi: validation and holdout regressions.
6. Treating the 3x3 nine-pair rectangle as “three Jodis”: invalid output accounting.
7. Inferring Top-3 quality from Top-6 recent-window coverage: unsupported.

Prior causal ML, rolling adaptive, joint rectangle, source-rule ablation, and predictability audits also found no challenger that reproduced a large signal on untouched data.

## Confidence and calibration

The app's normalized rank scores are relative ratings, not calibrated probabilities of a hit. The research formulas likewise output rankings, not reliable event probabilities. Therefore:

- Do not display a 90% confidence label for these Top-3 predictions.
- Use observed chronological coverage and Wilson intervals.
- Require substantially more sealed forward rows before fitting confidence bins.
- Exact Jodi and the nine-pair Jodi grid must have separate calibration tracks.

## Why 90% is not currently attainable

On the 72-row frozen forward block, 90% requires at least 65 correct rows.

| Contract | Nominal probability | Chance of at least 65/72 under nominal coverage |
| --- | ---: | ---: |
| Three digits | 30% | 1.31e-26 |
| Three exact Jodis | 3% | 1.23e-90 |
| 3x3 nine-Jodi grid | 9% | 8.16e-60 |

Those tiny probabilities do not prove prediction is impossible; they quantify how large and unmistakable a genuine 90% signal would be. None appears in the data. The tested models cluster around nominal coverage, and development gains repeatedly disappear later. Claiming 90% would require leakage, hindsight selection, an expanding candidate set, abstaining from most rows while hiding coverage, or fabricating results.

## Failure analysis

- The old Top-6 objective allowed six digits and 36 Jodis, so high recent coverage did not imply precise ordering in the first three ranks.
- Many hand-built cross-market formulas were chosen from the same history later used to describe their accuracy.
- Per-market samples are small enough that searching many rules produces attractive false positives.
- The external result chart can revise historical values, weakening old fixtures that lack a source-cache hash.
- Known Open is genuinely additional information, but it only raises adjusted Close modestly.
- Exact Jodi has 100 classes and roughly 600 observations per market; most contexts are sparse.
- Current relative score normalization is not probability calibration.

## Selective prediction and abstention audit

Expert agreement was converted into six causal confidence measures: Top-3 vote mass, third-versus-fourth margin, top vote, entropy concentration, exact-set agreement, and a composite. The confidence metric and threshold were selected on development only. The 90% gate required at least 30 calls in validation, 30 in holdout, and 10 in the sealed forward block.

| Target | Selected coverage pattern | Development accuracy | Validation | Holdout | Forward | Decision |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Open | 100% coverage | 27.3% | 28.0% | 31.1% | 26.4% | Reject |
| Close | approximately 100% coverage | 30.7% | 30.3% | 28.6% | 21.1% | Reject |
| Adjusted Close | 22%-32% coverage | 33.9% | 29.2% | 28.6% | 31.2% | Reject |
| Exact Jodi | 28%-37% coverage | 2.9% | 2.1% | 2.9% | 0.0% | Reject |
| 3x3 Jodi grid | 6%-10% coverage | 12.4% | 7.5% | 9.2% | 0/4 | Reject |

No confidence policy reached 90% even in development with the predeclared 50-call minimum. Abstention therefore does not rescue the objective.

## Context-pocket false-discovery audit

Calendar, lag, previous-result, previous-Jodi, market, weekday, and known-Open context keys were mined on development only. Tiny pockets did generate apparent 100% results:

- Open: 3/3 in one previous-Jodi pocket, later 1/2 on holdout with no validation or forward calls.
- Close: 14/14 across four previous-Jodi pockets, later 0/3 on validation and 0/3 on holdout.
- Adjusted Close: 7/7 in one known-Open/previous-Close pocket, later 4/9 validation, 2/4 holdout, and 0/1 forward.
- With minimum pocket support of 10 or 20, no 90% digit pocket existed.
- No 90% exact-Jodi or nine-pair-grid development pocket existed even at support three.

These results demonstrate how a nominal “100% rule” can be manufactured from tiny searched groups and why coverage and untouched tests are mandatory.

## Research registry and cross-source audit

The isolated source refresh on 2026-07-15 returned no rows after 2026-07-12. A content-addressed research registry records the next row for all 12 markets instead of inventing a score:

- Input cache SHA-256 and feature-script SHA-256 are stored.
- Exactly three Open digits, three Close digits, three exact Jodis, and the separately labelled nine-pair grid are frozen.
- Adjusted Close rankings for all ten possible known-Open digits are frozen before any result is available.
- The original-source scorer currently reports 0 scored and 12 pending registrations.
- Repeating the isolated refresh produces the stable input-cache SHA-256 `30c990661dfad6f1a7efdb40144a49c45543a3acef5627af50f8a5a144701332`.

The registry was generated after the July 13 target date, so it is not a sealed pre-event forward test. Eight July 13 rows were recovered from an independent chart source and scored strictly as a retrospective cross-source audit:

| Target | Hits | Calls | Accuracy |
| --- | ---: | ---: | ---: |
| Open | 0 | 8 | 0.0% |
| Close | 2 | 8 | 25.0% |
| Adjusted Close using actual Open | 3 | 8 | 37.5% |
| Exact Jodi | 0 | 8 | 0.0% |
| 3x3 Jodi grid | 0 | 8 | 0.0% |

This small check is not sufficient to estimate long-run accuracy, but it reinforces rejection and provides no evidence toward 90%. The detailed report preserves every source URL and every row-level hit.

A future registry can provide genuinely new evidence only when its predictions and input hash are saved before the results are published. None of this work alters production.

## July 15 pre-event registry

At 04:01 IST on July 15—before the earliest scheduled market opening—eight accessible independent-source markets were sealed into a write-once local registry using source data through July 14.

- Source-cache SHA-256: `70c50faa1feb1220e7f7d7b06129772346f0f62bb9b7a1f34fc012b8feb7dac7`.
- Registry content SHA-256: `913432a06679c2be7f25a49604c43d1ce81a981280f37d2e69dcc594fcc64267`.
- Exactly three Open digits, three pre-Open Close digits, and three exact Jodis are frozen.
- The separately labelled grid contains nine Jodis, not three.
- Adjusted-Close picks for all ten possible Open digits are frozen before results.
- Integrity verification passes; 0 rows are currently scored and 8 are pending.

This is the first clean pre-event ledger in the cycle. Its timestamp is local evidence rather than an independent trusted timestamp authority, which is disclosed in the registry.

## Research journal

| Experiment | Result | Decision |
| --- | --- | --- |
| Current Top-3 replay: 7/30/180 days | Near nominal coverage; recent adjusted Close somewhat higher | Baseline only |
| Exact Top-3 causal MLP | Exact Jodi small lift; digit targets regress later | Reject for use |
| 189 statistical candidates | Recent-7 Open clears non-regression; other development winners fail | Monitor Open only |
| Known-Open adjusted Close | Exploratory later-block lift | Forward-register |
| Exact Jodi cold-pair formulas | 3%-4% coverage | Forward-register, low priority |
| Market-specific selection | Large development gains vanish later | Reject |
| Paired exact tests | No significant advantage for development-selected Open winner | No accuracy claim |
| Expert-agreement abstention | Confidence was not predictive; no development 90% policy | Reject |
| Context-pocket mining | Tiny 100% pockets collapsed later | Reject |
| Isolated source refresh | No rows newer than July 12; stable cache hash after timestamp removal | Original-source evidence pending |
| Content-addressed research registry | 12 markets recorded with all known-Open states | Retrospective only because it was generated after target date |
| Independent-source July 13 audit | Open 0/8; Close 2/8; adjusted 3/8; exact/grid 0/8 | Reinforces rejection; not sealed forward evidence |
| Whole-panel embeddings and factor interactions | Development lifts reverse on validation/holdout; exact Jodi reaches only 6.9% forward | Reject |
| Cross-market 64-event multitask GRU | Development gains reverse on validation/holdout; cutoff audit passes | Reject |
| Independent-source deterministic refresh | Eight markets parsed through July 14; source cache content-addressed | Use for clean future scoring |
| Independent-source fixed-formula replay | 3,613 rows reproduce nominal-like 30%/3%/9% coverage | Confirms rejection |
| July 15 local pre-event registry | Eight markets sealed at 04:01 IST with all Top-3 contracts | Pending actual results |

## Prioritized next research

1. Score the sealed July 15 registry without modifying its predictions, then continue write-once daily registration.
2. Accumulate at least 300 untouched rows before reconsidering the monitor candidates; do not retune during that collection period.
3. Obtain actual pre-draw betting/liability features if legally and ethically available. Historical outcomes alone do not expose the operator's current ledger.
4. Re-test recent-7 Open, known-Open adjusted Close, and calendar/cold exact Jodi as three pre-registered hypotheses with multiplicity correction.
5. Add abstention only if coverage is reported prominently; accuracy without coverage is misleading.
6. Retire any research fixture that cannot identify the exact input cache used to generate it.

## Goal completion audit

The requirement-by-requirement audit is recorded in `backtest_reports/2026-07-15/top3-goal-completion-audit.md`. The fixed Top-3 contracts are implemented in research, but the defining 90% accuracy requirement is contradicted by validation, holdout, frozen-forward, and independent-source evidence. Continuation now depends on publication of sealed future rows or genuinely new pre-draw causal features.

## Reproducibility

```powershell
node scripts\sutta-research-baseline.cjs 7 --label=top3-current-20260715
python scripts\sutta-top3-statistical-research.py
python scripts\sutta-top3-ml-research.py
python scripts\sutta-top3-selective-research.py
python scripts\sutta-top3-context-pocket-research.py
python scripts\sutta-top3-panel-aware-research.py
python scripts\sutta-top3-event-sequence-research.py
python scripts\sutta-top3-independent-replication.py
node scripts\sutta-top3-forward-refresh.cjs
python scripts\sutta-top3-forward-register.py
python scripts\sutta-top3-forward-score.py
python scripts\sutta-top3-cross-source-score.py
python scripts\sutta-independent-source-refresh.py
python scripts\sutta-top3-pre-event-register.py
python scripts\sutta-top3-pre-event-score.py
```

Primary machine-readable outputs:

- `scratch/sutta-baseline-7d-top3-current-20260715.json`
- `scratch/sutta-baseline-30d-top3-top4-20260715.json`
- `scratch/sutta-baseline-180d-top3-top4-20260715.json`
- `scratch/sutta-top3-statistical-output.json`
- `scratch/sutta-top3-ml-output.json`
- `scratch/sutta-top3-selective-output.json`
- `scratch/sutta-top3-context-pocket-output.json`
- `scratch/sutta-top3-panel-aware-output.json`
- `scratch/sutta-top3-event-sequence-output.json`
- `scratch/sutta-top3-independent-replication-output.json`
- `scratch/sutta-top3-forward-registry-20260715.json`
- `scratch/sutta-top3-forward-score-20260715.json`
- `scratch/sutta-top3-cross-source-20260713.json`
- `scratch/sutta-top3-cross-source-score-20260713.json`
- `scratch/sutta-independent-source-records.json`
- `scratch/sutta-independent-source-meta.json`
- `scratch/sutta-top3-pre-event-registry-20260715.json`
- `scratch/sutta-top3-pre-event-score-20260715.json`
