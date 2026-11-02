# V7 component-first and weighted fusion study

Production is unchanged. Every outcome through November 1 was available to earlier research. This study has no fresh confirmation period; all reported gains are retrospective and exploratory.

Each channel first selects specialists separately for Top-5 Sutta, two absent digits, panel Top-10, SP-30 and DP-20. Stage-one training ends August 16; validation is August 17–September 7. Weighted fusion is then selected using September 8–30 training and October 1–15 validation. October 16–22 is reused diagnostic history; October 23–November 1 is reused audit history. No audit outcome is used by the declared selectors, but this chronological separation cannot undo earlier outcome reuse.

A nonfallback balanced candidate must preserve all five component hit counts in both fusion-selection blocks against production and independently routed specialists, with a strict validation gain in at least one component. Every component is checked separately on its own eligible events; a gain in one cannot offset a loss in another. Later regressions remain visible. A coherent fused distribution may erase gains from independent output routing.

34 of 39 channel/scope selectors fall back to production because no qualifying fusion improves on both references. A production fallback can lose specialist gains and does not prove production beats those specialists. 0 selectors retain an independently routed output bundle rather than one coherent fused distribution.

The market-specific minimum of 15 eligible training and eight eligible validation observations can force sparse SP/DP component selectors to production. Pooled specialist selections are recorded but are not substituted into these market-routed bundles. A retained production component is not evidence that all alternatives fail. Added historical count features omit five raw-only context records available to upstream production features, limiting attribution.

Budgets are exactly five Sutta digits, two distinct absent digits, 10 of 220 panels, 30 of 120 SP panels and 20 of 90 DP panels. SP and DP rates condition on the actual panel kind; their denominators differ. Counts are pooled directly over eligible rows and rates are never averaged across endpoints or markets. Ranking rounds scores to 12 decimal places before stable universe-order tie breaking.

Cells show production → independent specialists → selected weighted output / eligible events, followed by weighted net hits versus production and versus specialists. Every fusion uses the market-routed source specialists. Pooled and market selectors can choose different fusion weights. Pooled results sum eligible events directly.

## Pooled component endpoints

| Channel | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |
|---|---|---|---|---|
| open | top5 | 81 → 73 → 81 / 152 (+0; +8) | 32 → 28 → 32 / 61 (+0; +4) | 42 → 44 → 42 / 88 (+0; -2) |
| open | avoid2 | 74 → 81 → 74 / 152 (+0; -7) | 32 → 35 → 32 / 61 (+0; -3) | 52 → 52 → 52 / 88 (+0; +0) |
| open | panel10 | 18 → 12 → 18 / 152 (+0; +6) | 3 → 3 → 3 / 61 (+0; +0) | 3 → 5 → 3 / 88 (+0; -2) |
| open | sp30 | 36 → 32 → 36 / 115 (+0; +4) | 6 → 11 → 6 / 46 (+0; -5) | 18 → 16 → 18 / 64 (+0; +2) |
| open | dp20 | 8 → 8 → 8 / 37 (+0; +0) | 4 → 4 → 4 / 15 (+0; +0) | 5 → 5 → 5 / 24 (+0; +0) |
| close_pre | top5 | 69 → 68 → 69 / 152 (+0; +1) | 29 → 31 → 29 / 61 (+0; -2) | 45 → 41 → 45 / 88 (+0; +4) |
| close_pre | avoid2 | 77 → 77 → 77 / 152 (+0; +0) | 37 → 35 → 37 / 61 (+0; +2) | 43 → 52 → 43 / 88 (+0; -9) |
| close_pre | panel10 | 11 → 6 → 11 / 152 (+0; +5) | 4 → 5 → 4 / 61 (+0; -1) | 5 → 5 → 5 / 88 (+0; +0) |
| close_pre | sp30 | 28 → 26 → 28 / 111 (+0; +2) | 13 → 11 → 13 / 46 (+0; +2) | 14 → 23 → 14 / 66 (+0; -9) |
| close_pre | dp20 | 10 → 10 → 10 / 41 (+0; +0) | 4 → 4 → 4 / 14 (+0; +0) | 5 → 5 → 5 / 21 (+0; +0) |
| close_known | top5 | 80 → 79 → 80 / 152 (+0; +1) | 36 → 30 → 36 / 61 (+0; +6) | 44 → 47 → 44 / 88 (+0; -3) |
| close_known | avoid2 | 83 → 79 → 83 / 152 (+0; +4) | 35 → 33 → 35 / 61 (+0; +2) | 49 → 46 → 49 / 88 (+0; +3) |
| close_known | panel10 | 6 → 11 → 6 / 152 (+0; -5) | 7 → 9 → 7 / 61 (+0; -2) | 10 → 5 → 10 / 88 (+0; +5) |
| close_known | sp30 | 30 → 26 → 30 / 111 (+0; +4) | 15 → 10 → 15 / 46 (+0; +5) | 18 → 18 → 18 / 66 (+0; +0) |
| close_known | dp20 | 9 → 9 → 9 / 41 (+0; +0) | 3 → 3 → 3 / 14 (+0; +0) | 3 → 3 → 3 / 21 (+0; +0) |

## Applying the market-specific fusion overrides

This applies each market’s own frozen fusion choice, then sums its hit counts and eligible events. It differs from the ALL selector above, which chooses one fusion setting globally. These are pooled event counts, never averages of market rates. `aggregate_routed.csv` preserves all six blocks.

| Channel | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |
|---|---|---|---|---|
| open | top5 | 81 → 73 → 81 / 152 (+0; +8) | 32 → 28 → 30 / 61 (-2; +2) | 42 → 44 → 42 / 88 (+0; -2) |
| open | avoid2 | 74 → 81 → 80 / 152 (+6; -1) | 32 → 35 → 34 / 61 (+2; -1) | 52 → 52 → 53 / 88 (+1; +1) |
| open | panel10 | 18 → 12 → 21 / 152 (+3; +9) | 3 → 3 → 4 / 61 (+1; +1) | 3 → 5 → 2 / 88 (-1; -3) |
| open | sp30 | 36 → 32 → 40 / 115 (+4; +8) | 6 → 11 → 7 / 46 (+1; -4) | 18 → 16 → 18 / 64 (+0; +2) |
| open | dp20 | 8 → 8 → 8 / 37 (+0; +0) | 4 → 4 → 4 / 15 (+0; +0) | 5 → 5 → 6 / 24 (+1; +1) |
| close_pre | top5 | 69 → 68 → 73 / 152 (+4; +5) | 29 → 31 → 30 / 61 (+1; -1) | 45 → 41 → 43 / 88 (-2; +2) |
| close_pre | avoid2 | 77 → 77 → 85 / 152 (+8; +8) | 37 → 35 → 33 / 61 (-4; -2) | 43 → 52 → 43 / 88 (+0; -9) |
| close_pre | panel10 | 11 → 6 → 12 / 152 (+1; +6) | 4 → 5 → 4 / 61 (+0; -1) | 5 → 5 → 5 / 88 (+0; +0) |
| close_pre | sp30 | 28 → 26 → 29 / 111 (+1; +3) | 13 → 11 → 13 / 46 (+0; +2) | 14 → 23 → 15 / 66 (+1; -8) |
| close_pre | dp20 | 10 → 10 → 10 / 41 (+0; +0) | 4 → 4 → 4 / 14 (+0; +0) | 5 → 5 → 5 / 21 (+0; +0) |
| close_known | top5 | 80 → 79 → 80 / 152 (+0; +1) | 36 → 30 → 36 / 61 (+0; +6) | 44 → 47 → 44 / 88 (+0; -3) |
| close_known | avoid2 | 83 → 79 → 83 / 152 (+0; +4) | 35 → 33 → 35 / 61 (+0; +2) | 49 → 46 → 49 / 88 (+0; +3) |
| close_known | panel10 | 6 → 11 → 9 / 152 (+3; -2) | 7 → 9 → 5 / 61 (-2; -4) | 10 → 5 → 10 / 88 (+0; +5) |
| close_known | sp30 | 30 → 26 → 30 / 111 (+0; +4) | 15 → 10 → 15 / 46 (+0; +5) | 18 → 18 → 18 / 66 (+0; +0) |
| close_known | dp20 | 9 → 9 → 9 / 41 (+0; +0) | 3 → 3 → 3 / 14 (+0; +0) | 3 → 3 → 3 / 21 (+0; +0) |

## Specialists before fusion

The following training and validation results belong to component selection, before any fusion weights are chosen. The complete CSV retains these blocks and every later block for each market. Cells show production → routed component specialist / eligible events (specialist net hits).

| Channel | Endpoint | Early training | Early validation | October 23–November 1 reused |
|---|---|---|---|---|
| open | top5 | 210 → 247 / 435 (+37) | 116 → 172 / 228 (+56) | 42 → 44 / 88 (+2) |
| open | avoid2 | 228 → 260 / 435 (+32) | 135 → 173 / 228 (+38) | 52 → 52 / 88 (+0) |
| open | panel10 | 37 → 49 / 435 (+12) | 23 → 43 / 228 (+20) | 3 → 5 / 88 (+2) |
| open | sp30 | 119 → 135 / 331 (+16) | 57 → 81 / 169 (+24) | 18 → 16 / 64 (-2) |
| open | dp20 | 33 → 33 / 103 (+0) | 16 → 16 / 58 (+0) | 5 → 5 / 24 (+0) |
| close_pre | top5 | 209 → 242 / 435 (+33) | 119 → 171 / 228 (+52) | 45 → 41 / 88 (-4) |
| close_pre | avoid2 | 216 → 265 / 435 (+49) | 108 → 171 / 228 (+63) | 43 → 52 / 88 (+9) |
| close_pre | panel10 | 31 → 50 / 435 (+19) | 17 → 42 / 228 (+25) | 5 → 5 / 88 (+0) |
| close_pre | sp30 | 87 → 115 / 331 (+28) | 40 → 76 / 164 (+36) | 14 → 23 / 66 (+9) |
| close_pre | dp20 | 21 → 21 / 103 (+0) | 17 → 17 / 63 (+0) | 5 → 5 / 21 (+0) |
| close_known | top5 | 215 → 229 / 435 (+14) | 119 → 175 / 228 (+56) | 44 → 47 / 88 (+3) |
| close_known | avoid2 | 211 → 259 / 435 (+48) | 131 → 173 / 228 (+42) | 49 → 46 / 88 (-3) |
| close_known | panel10 | 39 → 55 / 435 (+16) | 21 → 43 / 228 (+22) | 10 → 5 / 88 (-5) |
| close_known | sp30 | 99 → 119 / 331 (+20) | 52 → 86 / 164 (+34) | 18 → 18 / 66 (+0) |
| close_known | dp20 | 24 → 24 / 103 (+0) | 22 → 22 / 63 (+0) | 3 → 3 / 21 (+0) |

## Pre-Open Jodi25

Jodi25 is the Cartesian product of five predicted Open digits and five predicted Close-before-Open digits: exactly 25 distinct ordered pairs. It is evaluated before observing Open and never uses Close-with-known-Open forecasts. A uniform random actual pair gives this set a 25% chance hit rate. Jodi25 is a separate endpoint; its gain does not establish improvement in every component.

Each cell shows production → component Top-5 specialist pair → dedicated early Jodi specialist pair → final weighted pair / events. Dedicated Jodi sources were selected jointly in the early blocks; they differ from independently maximizing each side's Top-5 accuracy.

Final Jodi search requires both nonproduction sides to qualify on all five components and improves joint validation hits against production and independent Top-5 specialists. It searches up to 12 qualified candidates per side, plus a production-pair fallback. It does not exhaust arbitrary one-sided reroutes; native source controls remain in the candidate catalogue.

| Scope | Early validation | Weight validation | October 16–22 reused | October 23–November 1 reused |
|---|---|---|---|---|
| ALL | 68 → 129 → 135 → 68 / 228 | 38 → 36 → 37 → 38 / 152 | 13 → 16 → 15 → 13 / 61 | 22 → 22 → 16 → 22 / 88 |
| Kalyan | 6 → 9 → 11 → 6 / 19 | 4 → 4 → 6 → 4 / 13 | 1 → 3 → 3 → 1 / 5 | 3 → 2 → 2 → 3 / 8 |
| Kalyan Night | 5 → 10 → 10 → 5 / 16 | 3 → 4 → 4 → 3 / 11 | 1 → 1 → 1 → 1 / 5 | 3 → 2 → 1 → 3 / 6 |
| Madhur Day | 6 → 14 → 14 → 6 / 22 | 3 → 6 → 6 → 3 / 15 | 1 → 1 → 1 → 1 / 7 | 2 → 2 → 2 → 2 / 10 |
| Madhur Night | 5 → 10 → 10 → 5 / 19 | 2 → 3 → 3 → 2 / 9 | 0 → 0 → 0 → 0 / 0 | 0 → 0 → 0 → 0 / 0 |
| Main Bazar | 5 → 10 → 11 → 5 / 16 | 2 → 2 → 4 → 2 / 11 | 3 → 1 → 1 → 3 / 5 | 1 → 2 → 1 → 1 / 6 |
| Milan Day | 6 → 11 → 12 → 6 / 19 | 6 → 3 → 1 → 6 / 13 | 1 → 2 → 1 → 1 / 5 | 3 → 3 → 3 → 3 / 8 |
| Milan Night | 2 → 9 → 9 → 2 / 19 | 4 → 1 → 1 → 4 / 13 | 1 → 0 → 1 → 1 / 5 | 3 → 4 → 2 → 3 / 8 |
| Rajdhani Day | 5 → 10 → 10 → 5 / 19 | 3 → 3 → 2 → 3 / 13 | 1 → 1 → 1 → 1 / 5 | 1 → 2 → 2 → 1 / 8 |
| Rajdhani Night | 7 → 12 → 12 → 7 / 16 | 0 → 1 → 3 → 0 / 11 | 1 → 2 → 3 → 1 / 5 | 2 → 1 → 0 → 2 / 6 |
| Sridevi | 10 → 11 → 12 → 10 / 22 | 2 → 0 → 0 → 2 / 15 | 2 → 3 → 2 → 2 / 7 | 2 → 3 → 3 → 2 / 10 |
| Sridevi Night | 6 → 11 → 12 → 6 / 22 | 6 → 6 → 4 → 6 / 15 | 1 → 2 → 1 → 1 / 6 | 1 → 1 → 0 → 1 / 10 |
| Time Bazar | 5 → 12 → 12 → 5 / 19 | 3 → 3 → 3 → 3 / 13 | 0 → 0 → 0 → 0 / 6 | 1 → 0 → 0 → 1 / 8 |
| Market-specific pair choices, pooled | 68 → 129 → 135 → 68 / 228 | 38 → 36 → 37 → 38 / 152 | 13 → 16 → 15 → 13 / 61 | 22 → 22 → 16 → 22 / 88 |

## Individual markets

| Channel | Market | Endpoint | Weight validation | October 16–22 reused | October 23–November 1 reused |
|---|---|---|---|---|---|
| open | Kalyan | top5 | 7 → 9 → 7 / 13 (+0; -2) | 3 → 5 → 3 / 5 (+0; -2) | 5 → 3 → 5 / 8 (+0; +2) |
| open | Kalyan | avoid2 | 4 → 5 → 4 / 13 (+0; -1) | 2 → 0 → 2 / 5 (+0; +2) | 2 → 4 → 2 / 8 (+0; -2) |
| open | Kalyan | panel10 | 1 → 0 → 1 / 13 (+0; +1) | 0 → 0 → 0 / 5 (+0; +0) | 0 → 0 → 0 / 8 (+0; +0) |
| open | Kalyan | sp30 | 2 → 3 → 2 / 12 (+0; -1) | 0 → 1 → 0 / 3 (+0; -1) | 3 → 0 → 3 / 7 (+0; +3) |
| open | Kalyan | dp20 | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| open | Kalyan Night | top5 | 6 → 7 → 6 / 11 (+0; -1) | 3 → 3 → 3 / 5 (+0; +0) | 5 → 5 → 5 / 6 (+0; +0) |
| open | Kalyan Night | avoid2 | 5 → 4 → 5 / 11 (+0; +1) | 4 → 3 → 4 / 5 (+0; +1) | 5 → 5 → 5 / 6 (+0; +0) |
| open | Kalyan Night | panel10 | 1 → 1 → 1 / 11 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) | 1 → 3 → 1 / 6 (+0; -2) |
| open | Kalyan Night | sp30 | 4 → 3 → 4 / 9 (+0; +1) | 0 → 1 → 0 / 2 (+0; -1) | 4 → 3 → 4 / 6 (+0; +1) |
| open | Kalyan Night | dp20 | 1 → 1 → 1 / 2 (+0; +0) | 1 → 1 → 1 / 3 (+0; +0) | — (n=0) |
| open | Madhur Day | top5 | 7 → 8 → 7 / 15 (+0; -1) | 3 → 2 → 3 / 7 (+0; +1) | 4 → 6 → 4 / 10 (+0; -2) |
| open | Madhur Day | avoid2 | 5 → 5 → 5 / 15 (+0; +0) | 5 → 5 → 5 / 7 (+0; +0) | 8 → 7 → 8 / 10 (+0; +1) |
| open | Madhur Day | panel10 | 0 → 0 → 0 / 15 (+0; +0) | 0 → 0 → 0 / 7 (+0; +0) | 0 → 0 → 0 / 10 (+0; +0) |
| open | Madhur Day | sp30 | 2 → 2 → 2 / 11 (+0; +0) | 0 → 1 → 0 / 6 (+0; -1) | 3 → 4 → 3 / 6 (+0; -1) |
| open | Madhur Day | dp20 | 1 → 1 → 1 / 4 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 2 → 2 → 2 / 4 (+0; +0) |
| open | Madhur Night | top5 | 5 → 3 → 5 / 9 (+0; +2) | — (n=0) | — (n=0) |
| open | Madhur Night | avoid2 | 7 → 8 → 7 / 9 (+0; -1) | — (n=0) | — (n=0) |
| open | Madhur Night | panel10 | 2 → 1 → 2 / 9 (+0; +1) | — (n=0) | — (n=0) |
| open | Madhur Night | sp30 | 3 → 3 → 3 / 5 (+0; +0) | — (n=0) | — (n=0) |
| open | Madhur Night | dp20 | 0 → 0 → 0 / 4 (+0; +0) | — (n=0) | — (n=0) |
| open | Main Bazar | top5 | 7 → 6 → 7 / 11 (+0; +1) | 4 → 1 → 3 / 5 (-1; +2) | 2 → 3 → 1 / 6 (-1; -2) |
| open | Main Bazar | avoid2 | 2 → 7 → 7 / 11 (+5; +0) | 2 → 4 → 4 / 5 (+2; +0) | 3 → 4 → 4 / 6 (+1; +0) |
| open | Main Bazar | panel10 | 0 → 0 → 2 / 11 (+2; +2) | 1 → 1 → 1 / 5 (+0; +0) | 0 → 0 → 0 / 6 (+0; +0) |
| open | Main Bazar | sp30 | 0 → 2 → 4 / 9 (+4; +2) | 1 → 2 → 2 / 5 (+1; +0) | 0 → 0 → 0 / 4 (+0; +0) |
| open | Main Bazar | dp20 | 1 → 1 → 1 / 2 (+0; +0) | — (n=0) | 1 → 1 → 0 / 2 (-1; -1) |
| open | Milan Day | top5 | 8 → 4 → 8 / 13 (+0; +4) | 2 → 2 → 2 / 5 (+0; +0) | 3 → 4 → 3 / 8 (+0; -1) |
| open | Milan Day | avoid2 | 9 → 7 → 9 / 13 (+0; +2) | 3 → 1 → 3 / 5 (+0; +2) | 5 → 2 → 5 / 8 (+0; +3) |
| open | Milan Day | panel10 | 2 → 1 → 2 / 13 (+0; +1) | 0 → 0 → 0 / 5 (+0; +0) | 0 → 1 → 0 / 8 (+0; -1) |
| open | Milan Day | sp30 | 3 → 2 → 3 / 9 (+0; +1) | 0 → 0 → 0 / 2 (+0; +0) | 1 → 3 → 1 / 7 (+0; -2) |
| open | Milan Day | dp20 | 0 → 0 → 0 / 4 (+0; +0) | 2 → 2 → 2 / 3 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| open | Milan Night | top5 | 8 → 2 → 8 / 13 (+0; +6) | 3 → 3 → 3 / 5 (+0; +0) | 3 → 6 → 3 / 8 (+0; -3) |
| open | Milan Night | avoid2 | 8 → 9 → 8 / 13 (+0; -1) | 3 → 3 → 3 / 5 (+0; +0) | 2 → 4 → 2 / 8 (+0; -2) |
| open | Milan Night | panel10 | 3 → 0 → 3 / 13 (+0; +3) | 0 → 0 → 0 / 5 (+0; +0) | 1 → 0 → 1 / 8 (+0; +1) |
| open | Milan Night | sp30 | 6 → 1 → 6 / 12 (+0; +5) | 0 → 1 → 0 / 5 (+0; -1) | 2 → 1 → 2 / 6 (+0; +1) |
| open | Milan Night | dp20 | 0 → 0 → 0 / 1 (+0; +0) | — (n=0) | 1 → 1 → 1 / 2 (+0; +0) |
| open | Rajdhani Day | top5 | 7 → 7 → 7 / 13 (+0; +0) | 2 → 1 → 2 / 5 (+0; +1) | 3 → 4 → 3 / 8 (+0; -1) |
| open | Rajdhani Day | avoid2 | 5 → 6 → 5 / 13 (+0; -1) | 2 → 3 → 2 / 5 (+0; -1) | 6 → 5 → 6 / 8 (+0; +1) |
| open | Rajdhani Day | panel10 | 2 → 2 → 2 / 13 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) | 0 → 0 → 0 / 8 (+0; +0) |
| open | Rajdhani Day | sp30 | 1 → 1 → 1 / 8 (+0; +0) | 1 → 1 → 1 / 5 (+0; +0) | 1 → 2 → 1 / 6 (+0; -1) |
| open | Rajdhani Day | dp20 | 0 → 0 → 0 / 5 (+0; +0) | — (n=0) | 1 → 1 → 1 / 2 (+0; +0) |
| open | Rajdhani Night | top5 | 3 → 6 → 3 / 11 (+0; -3) | 3 → 2 → 3 / 5 (+0; +1) | 2 → 3 → 2 / 6 (+0; -1) |
| open | Rajdhani Night | avoid2 | 7 → 6 → 7 / 11 (+0; +1) | 3 → 4 → 3 / 5 (+0; -1) | 2 → 4 → 2 / 6 (+0; -2) |
| open | Rajdhani Night | panel10 | 1 → 1 → 1 / 11 (+0; +0) | 2 → 2 → 2 / 5 (+0; +0) | 0 → 0 → 0 / 6 (+0; +0) |
| open | Rajdhani Night | sp30 | 4 → 5 → 4 / 8 (+0; -1) | 2 → 2 → 2 / 5 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) |
| open | Rajdhani Night | dp20 | 1 → 1 → 1 / 3 (+0; +0) | — (n=0) | 0 → 0 → 0 / 1 (+0; +0) |
| open | Sridevi | top5 | 7 → 6 → 7 / 15 (+0; +1) | 3 → 6 → 3 / 7 (+0; -3) | 5 → 6 → 5 / 10 (+0; -1) |
| open | Sridevi | avoid2 | 6 → 6 → 6 / 15 (+0; +0) | 3 → 3 → 3 / 7 (+0; +0) | 7 → 6 → 7 / 10 (+0; +1) |
| open | Sridevi | panel10 | 1 → 1 → 1 / 15 (+0; +0) | 0 → 0 → 0 / 7 (+0; +0) | 0 → 0 → 0 / 10 (+0; +0) |
| open | Sridevi | sp30 | 2 → 2 → 2 / 13 (+0; +0) | 0 → 0 → 0 / 6 (+0; +0) | 3 → 2 → 3 / 8 (+0; +1) |
| open | Sridevi | dp20 | 1 → 1 → 1 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| open | Sridevi Night | top5 | 10 → 9 → 10 / 15 (+0; +1) | 4 → 2 → 3 / 6 (-1; +1) | 6 → 2 → 7 / 10 (+1; +5) |
| open | Sridevi Night | avoid2 | 9 → 10 → 10 / 15 (+1; +0) | 4 → 5 → 4 / 6 (+0; -1) | 7 → 4 → 7 / 10 (+0; +3) |
| open | Sridevi Night | panel10 | 4 → 4 → 5 / 15 (+1; +1) | 0 → 0 → 1 / 6 (+1; +1) | 1 → 1 → 0 / 10 (-1; -1) |
| open | Sridevi Night | sp30 | 7 → 6 → 7 / 12 (+0; +1) | 1 → 1 → 1 / 4 (+0; +0) | 1 → 1 → 1 / 6 (+0; +0) |
| open | Sridevi Night | dp20 | 1 → 1 → 1 / 3 (+0; +0) | 1 → 1 → 1 / 2 (+0; +0) | 0 → 0 → 2 / 4 (+2; +2) |
| open | Time Bazar | top5 | 6 → 6 → 6 / 13 (+0; +0) | 2 → 1 → 2 / 6 (+0; +1) | 4 → 2 → 4 / 8 (+0; +2) |
| open | Time Bazar | avoid2 | 7 → 8 → 7 / 13 (+0; -1) | 1 → 4 → 1 / 6 (+0; -3) | 5 → 7 → 5 / 8 (+0; -2) |
| open | Time Bazar | panel10 | 1 → 1 → 1 / 13 (+0; +0) | 0 → 0 → 0 / 6 (+0; +0) | 0 → 0 → 0 / 8 (+0; +0) |
| open | Time Bazar | sp30 | 2 → 2 → 2 / 7 (+0; +0) | 1 → 1 → 1 / 3 (+0; +0) | 0 → 0 → 0 / 3 (+0; +0) |
| open | Time Bazar | dp20 | 2 → 2 → 2 / 6 (+0; +0) | 0 → 0 → 0 / 3 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) |
| close_pre | Kalyan | top5 | 5 → 6 → 8 / 13 (+3; +2) | 2 → 3 → 4 / 5 (+2; +1) | 5 → 5 → 3 / 8 (-2; -2) |
| close_pre | Kalyan | avoid2 | 3 → 4 → 10 / 13 (+7; +6) | 5 → 5 → 3 / 5 (-2; -2) | 4 → 4 → 5 / 8 (+1; +1) |
| close_pre | Kalyan | panel10 | 0 → 0 → 1 / 13 (+1; +1) | 0 → 1 → 0 / 5 (+0; -1) | 1 → 0 → 1 / 8 (+0; +1) |
| close_pre | Kalyan | sp30 | 1 → 1 → 1 / 9 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) | 2 → 2 → 2 / 7 (+0; +0) |
| close_pre | Kalyan | dp20 | 1 → 1 → 1 / 4 (+0; +0) | 1 → 1 → 1 / 1 (+0; +0) | 1 → 1 → 1 / 1 (+0; +0) |
| close_pre | Kalyan Night | top5 | 5 → 7 → 5 / 11 (+0; -2) | 3 → 3 → 3 / 5 (+0; +0) | 3 → 3 → 3 / 6 (+0; +0) |
| close_pre | Kalyan Night | avoid2 | 3 → 4 → 3 / 11 (+0; -1) | 4 → 3 → 4 / 5 (+0; +1) | 2 → 4 → 2 / 6 (+0; -2) |
| close_pre | Kalyan Night | panel10 | 1 → 0 → 1 / 11 (+0; +1) | 1 → 0 → 1 / 5 (+0; +1) | 1 → 0 → 1 / 6 (+0; +1) |
| close_pre | Kalyan Night | sp30 | 2 → 3 → 2 / 9 (+0; -1) | 1 → 0 → 1 / 4 (+0; +1) | 1 → 2 → 1 / 5 (+0; -1) |
| close_pre | Kalyan Night | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| close_pre | Madhur Day | top5 | 8 → 10 → 8 / 15 (+0; -2) | 2 → 2 → 2 / 7 (+0; +0) | 6 → 2 → 6 / 10 (+0; +4) |
| close_pre | Madhur Day | avoid2 | 6 → 8 → 6 / 15 (+0; -2) | 4 → 4 → 4 / 7 (+0; +0) | 6 → 8 → 6 / 10 (+0; -2) |
| close_pre | Madhur Day | panel10 | 0 → 0 → 0 / 15 (+0; +0) | 1 → 0 → 1 / 7 (+0; +1) | 2 → 2 → 2 / 10 (+0; +0) |
| close_pre | Madhur Day | sp30 | 0 → 0 → 0 / 11 (+0; +0) | 2 → 1 → 2 / 5 (+0; +1) | 4 → 3 → 4 / 8 (+0; +1) |
| close_pre | Madhur Day | dp20 | 1 → 1 → 1 / 4 (+0; +0) | 1 → 1 → 1 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| close_pre | Madhur Night | top5 | 3 → 4 → 3 / 9 (+0; -1) | — (n=0) | — (n=0) |
| close_pre | Madhur Night | avoid2 | 4 → 4 → 4 / 9 (+0; +0) | — (n=0) | — (n=0) |
| close_pre | Madhur Night | panel10 | 0 → 4 → 0 / 9 (+0; -4) | — (n=0) | — (n=0) |
| close_pre | Madhur Night | sp30 | 1 → 2 → 1 / 8 (+0; -1) | — (n=0) | — (n=0) |
| close_pre | Madhur Night | dp20 | 0 → 0 → 0 / 1 (+0; +0) | — (n=0) | — (n=0) |
| close_pre | Main Bazar | top5 | 5 → 6 → 6 / 11 (+1; +0) | 4 → 3 → 3 / 5 (-1; +0) | 4 → 3 → 4 / 6 (+0; +1) |
| close_pre | Main Bazar | avoid2 | 7 → 5 → 8 / 11 (+1; +3) | 4 → 2 → 2 / 5 (-2; +0) | 2 → 2 → 1 / 6 (-1; -1) |
| close_pre | Main Bazar | panel10 | 2 → 0 → 2 / 11 (+0; +2) | 0 → 0 → 0 / 5 (+0; +0) | 0 → 1 → 0 / 6 (+0; -1) |
| close_pre | Main Bazar | sp30 | 4 → 2 → 5 / 7 (+1; +3) | 1 → 1 → 1 / 4 (+0; +0) | 1 → 3 → 2 / 6 (+1; -1) |
| close_pre | Main Bazar | dp20 | 0 → 0 → 0 / 4 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | — (n=0) |
| close_pre | Milan Day | top5 | 7 → 3 → 7 / 13 (+0; +4) | 3 → 3 → 3 / 5 (+0; +0) | 6 → 4 → 6 / 8 (+0; +2) |
| close_pre | Milan Day | avoid2 | 9 → 10 → 9 / 13 (+0; -1) | 3 → 4 → 3 / 5 (+0; -1) | 4 → 5 → 4 / 8 (+0; -1) |
| close_pre | Milan Day | panel10 | 0 → 0 → 0 / 13 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) | 1 → 0 → 1 / 8 (+0; +1) |
| close_pre | Milan Day | sp30 | 1 → 1 → 1 / 5 (+0; +0) | — (n=0) | 1 → 1 → 1 / 4 (+0; +0) |
| close_pre | Milan Day | dp20 | 1 → 1 → 1 / 8 (+0; +0) | 1 → 1 → 1 / 5 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) |
| close_pre | Milan Night | top5 | 7 → 4 → 7 / 13 (+0; +3) | 2 → 0 → 2 / 5 (+0; +2) | 4 → 5 → 4 / 8 (+0; -1) |
| close_pre | Milan Night | avoid2 | 7 → 4 → 7 / 13 (+0; +3) | 3 → 3 → 3 / 5 (+0; +0) | 4 → 6 → 4 / 8 (+0; -2) |
| close_pre | Milan Night | panel10 | 0 → 1 → 0 / 13 (+0; -1) | 0 → 1 → 0 / 5 (+0; -1) | 0 → 0 → 0 / 8 (+0; +0) |
| close_pre | Milan Night | sp30 | 1 → 2 → 1 / 8 (+0; -1) | 1 → 2 → 1 / 4 (+0; -1) | 1 → 4 → 1 / 6 (+0; -3) |
| close_pre | Milan Night | dp20 | 1 → 1 → 1 / 5 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 1 → 1 → 1 / 2 (+0; +0) |
| close_pre | Rajdhani Day | top5 | 7 → 5 → 7 / 13 (+0; +2) | 3 → 3 → 3 / 5 (+0; +0) | 4 → 3 → 4 / 8 (+0; +1) |
| close_pre | Rajdhani Day | avoid2 | 7 → 7 → 7 / 13 (+0; +0) | 3 → 3 → 3 / 5 (+0; +0) | 5 → 5 → 5 / 8 (+0; +0) |
| close_pre | Rajdhani Day | panel10 | 3 → 1 → 3 / 13 (+0; +2) | 0 → 1 → 0 / 5 (+0; -1) | 0 → 1 → 0 / 8 (+0; -1) |
| close_pre | Rajdhani Day | sp30 | 5 → 4 → 5 / 11 (+0; +1) | 2 → 0 → 2 / 4 (+0; +2) | 0 → 4 → 0 / 6 (+0; -4) |
| close_pre | Rajdhani Day | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_pre | Rajdhani Night | top5 | 2 → 3 → 2 / 11 (+0; -1) | 2 → 3 → 2 / 5 (+0; -1) | 2 → 1 → 2 / 6 (+0; +1) |
| close_pre | Rajdhani Night | avoid2 | 8 → 6 → 8 / 11 (+0; +2) | 3 → 3 → 3 / 5 (+0; +0) | 0 → 2 → 0 / 6 (+0; -2) |
| close_pre | Rajdhani Night | panel10 | 1 → 0 → 1 / 11 (+0; +1) | 0 → 1 → 0 / 5 (+0; -1) | 0 → 0 → 0 / 6 (+0; +0) |
| close_pre | Rajdhani Night | sp30 | 2 → 1 → 2 / 9 (+0; +1) | 0 → 1 → 0 / 4 (+0; -1) | 1 → 0 → 1 / 4 (+0; +1) |
| close_pre | Rajdhani Night | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_pre | Sridevi | top5 | 6 → 3 → 6 / 15 (+0; +3) | 3 → 4 → 3 / 7 (+0; -1) | 4 → 5 → 4 / 10 (+0; -1) |
| close_pre | Sridevi | avoid2 | 6 → 9 → 6 / 15 (+0; -3) | 5 → 2 → 5 / 7 (+0; +3) | 4 → 5 → 4 / 10 (+0; -1) |
| close_pre | Sridevi | panel10 | 2 → 0 → 2 / 15 (+0; +2) | 1 → 0 → 1 / 7 (+0; +1) | 0 → 1 → 0 / 10 (+0; -1) |
| close_pre | Sridevi | sp30 | 3 → 3 → 3 / 12 (+0; +0) | 2 → 3 → 2 / 6 (+0; -1) | 2 → 1 → 2 / 8 (+0; +1) |
| close_pre | Sridevi | dp20 | 2 → 2 → 2 / 3 (+0; +0) | — (n=0) | 1 → 1 → 1 / 2 (+0; +0) |
| close_pre | Sridevi Night | top5 | 7 → 10 → 7 / 15 (+0; -3) | 3 → 5 → 3 / 6 (+0; -2) | 3 → 6 → 3 / 10 (+0; -3) |
| close_pre | Sridevi Night | avoid2 | 11 → 9 → 11 / 15 (+0; +2) | 3 → 4 → 3 / 6 (+0; -1) | 6 → 6 → 6 / 10 (+0; +0) |
| close_pre | Sridevi Night | panel10 | 0 → 0 → 0 / 15 (+0; +0) | 1 → 1 → 1 / 6 (+0; +0) | 0 → 0 → 0 / 10 (+0; +0) |
| close_pre | Sridevi Night | sp30 | 3 → 2 → 3 / 10 (+0; +1) | 1 → 1 → 1 / 6 (+0; +0) | 1 → 3 → 1 / 8 (+0; -2) |
| close_pre | Sridevi Night | dp20 | 3 → 3 → 3 / 5 (+0; +0) | — (n=0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_pre | Time Bazar | top5 | 7 → 7 → 7 / 13 (+0; +0) | 2 → 2 → 2 / 6 (+0; +0) | 4 → 4 → 4 / 8 (+0; +0) |
| close_pre | Time Bazar | avoid2 | 6 → 7 → 6 / 13 (+0; -1) | 0 → 2 → 0 / 6 (+0; -2) | 6 → 5 → 6 / 8 (+0; +1) |
| close_pre | Time Bazar | panel10 | 2 → 0 → 2 / 13 (+0; +2) | 0 → 0 → 0 / 6 (+0; +0) | 0 → 0 → 0 / 8 (+0; +0) |
| close_pre | Time Bazar | sp30 | 5 → 5 → 5 / 12 (+0; +0) | 2 → 1 → 2 / 5 (+0; +1) | 0 → 0 → 0 / 4 (+0; +0) |
| close_pre | Time Bazar | dp20 | 1 → 1 → 1 / 1 (+0; +0) | 1 → 1 → 1 / 1 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) |
| close_known | Kalyan | top5 | 6 → 5 → 6 / 13 (+0; +1) | 2 → 2 → 2 / 5 (+0; +0) | 5 → 5 → 5 / 8 (+0; +0) |
| close_known | Kalyan | avoid2 | 10 → 9 → 10 / 13 (+0; +1) | 3 → 1 → 3 / 5 (+0; +2) | 3 → 4 → 3 / 8 (+0; -1) |
| close_known | Kalyan | panel10 | 0 → 1 → 0 / 13 (+0; -1) | 0 → 0 → 0 / 5 (+0; +0) | 2 → 1 → 2 / 8 (+0; +1) |
| close_known | Kalyan | sp30 | 3 → 1 → 3 / 9 (+0; +2) | 0 → 1 → 0 / 4 (+0; -1) | 1 → 3 → 1 / 7 (+0; -2) |
| close_known | Kalyan | dp20 | 1 → 1 → 1 / 4 (+0; +0) | 1 → 1 → 1 / 1 (+0; +0) | 1 → 1 → 1 / 1 (+0; +0) |
| close_known | Kalyan Night | top5 | 7 → 7 → 7 / 11 (+0; +0) | 3 → 3 → 3 / 5 (+0; +0) | 1 → 3 → 1 / 6 (+0; -2) |
| close_known | Kalyan Night | avoid2 | 4 → 6 → 4 / 11 (+0; -2) | 3 → 5 → 3 / 5 (+0; -2) | 3 → 3 → 3 / 6 (+0; +0) |
| close_known | Kalyan Night | panel10 | 0 → 1 → 0 / 11 (+0; -1) | 0 → 1 → 0 / 5 (+0; -1) | 0 → 1 → 0 / 6 (+0; -1) |
| close_known | Kalyan Night | sp30 | 5 → 2 → 5 / 9 (+0; +3) | 2 → 1 → 2 / 4 (+0; +1) | 3 → 0 → 3 / 5 (+0; +3) |
| close_known | Kalyan Night | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| close_known | Madhur Day | top5 | 9 → 11 → 9 / 15 (+0; -2) | 3 → 3 → 3 / 7 (+0; +0) | 5 → 6 → 5 / 10 (+0; -1) |
| close_known | Madhur Day | avoid2 | 8 → 8 → 8 / 15 (+0; +0) | 4 → 4 → 4 / 7 (+0; +0) | 6 → 8 → 6 / 10 (+0; -2) |
| close_known | Madhur Day | panel10 | 1 → 1 → 1 / 15 (+0; +0) | 0 → 1 → 0 / 7 (+0; -1) | 1 → 0 → 1 / 10 (+0; +1) |
| close_known | Madhur Day | sp30 | 3 → 3 → 3 / 11 (+0; +0) | 2 → 3 → 2 / 5 (+0; -1) | 1 → 0 → 1 / 8 (+0; +1) |
| close_known | Madhur Day | dp20 | 1 → 1 → 1 / 4 (+0; +0) | 1 → 1 → 1 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) |
| close_known | Madhur Night | top5 | 4 → 5 → 4 / 9 (+0; -1) | — (n=0) | — (n=0) |
| close_known | Madhur Night | avoid2 | 5 → 2 → 5 / 9 (+0; +3) | — (n=0) | — (n=0) |
| close_known | Madhur Night | panel10 | 0 → 0 → 0 / 9 (+0; +0) | — (n=0) | — (n=0) |
| close_known | Madhur Night | sp30 | 1 → 3 → 1 / 8 (+0; -2) | — (n=0) | — (n=0) |
| close_known | Madhur Night | dp20 | 1 → 1 → 1 / 1 (+0; +0) | — (n=0) | — (n=0) |
| close_known | Main Bazar | top5 | 6 → 3 → 6 / 11 (+0; +3) | 1 → 2 → 1 / 5 (+0; -1) | 3 → 3 → 3 / 6 (+0; +0) |
| close_known | Main Bazar | avoid2 | 5 → 6 → 5 / 11 (+0; -1) | 3 → 3 → 3 / 5 (+0; +0) | 3 → 3 → 3 / 6 (+0; +0) |
| close_known | Main Bazar | panel10 | 1 → 1 → 1 / 11 (+0; +0) | 1 → 1 → 1 / 5 (+0; +0) | 1 → 1 → 1 / 6 (+0; +0) |
| close_known | Main Bazar | sp30 | 1 → 1 → 1 / 7 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) | 2 → 2 → 2 / 6 (+0; +0) |
| close_known | Main Bazar | dp20 | 0 → 0 → 0 / 4 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | — (n=0) |
| close_known | Milan Day | top5 | 4 → 5 → 4 / 13 (+0; -1) | 4 → 4 → 4 / 5 (+0; +0) | 6 → 6 → 6 / 8 (+0; +0) |
| close_known | Milan Day | avoid2 | 8 → 10 → 8 / 13 (+0; -2) | 3 → 3 → 3 / 5 (+0; +0) | 4 → 3 → 4 / 8 (+0; +1) |
| close_known | Milan Day | panel10 | 0 → 0 → 0 / 13 (+0; +0) | 0 → 0 → 0 / 5 (+0; +0) | 1 → 0 → 1 / 8 (+0; +1) |
| close_known | Milan Day | sp30 | 0 → 0 → 0 / 5 (+0; +0) | — (n=0) | 1 → 1 → 1 / 4 (+0; +0) |
| close_known | Milan Day | dp20 | 1 → 1 → 1 / 8 (+0; +0) | 1 → 1 → 1 / 5 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) |
| close_known | Milan Night | top5 | 8 → 8 → 8 / 13 (+0; +0) | 3 → 3 → 3 / 5 (+0; +0) | 7 → 7 → 7 / 8 (+0; +0) |
| close_known | Milan Night | avoid2 | 6 → 6 → 6 / 13 (+0; +0) | 4 → 2 → 4 / 5 (+0; +2) | 4 → 4 → 4 / 8 (+0; +0) |
| close_known | Milan Night | panel10 | 2 → 1 → 2 / 13 (+0; +1) | 0 → 0 → 0 / 5 (+0; +0) | 1 → 0 → 1 / 8 (+0; +1) |
| close_known | Milan Night | sp30 | 3 → 1 → 3 / 8 (+0; +2) | 1 → 0 → 1 / 4 (+0; +1) | 0 → 1 → 0 / 6 (+0; -1) |
| close_known | Milan Night | dp20 | 0 → 0 → 0 / 5 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_known | Rajdhani Day | top5 | 8 → 6 → 8 / 13 (+0; +2) | 5 → 0 → 5 / 5 (+0; +5) | 1 → 5 → 1 / 8 (+0; -4) |
| close_known | Rajdhani Day | avoid2 | 7 → 7 → 7 / 13 (+0; +0) | 3 → 2 → 3 / 5 (+0; +1) | 2 → 2 → 2 / 8 (+0; +0) |
| close_known | Rajdhani Day | panel10 | 0 → 0 → 0 / 13 (+0; +0) | 2 → 1 → 2 / 5 (+0; +1) | 1 → 0 → 1 / 8 (+0; +1) |
| close_known | Rajdhani Day | sp30 | 4 → 3 → 4 / 11 (+0; +1) | 2 → 1 → 2 / 4 (+0; +1) | 1 → 3 → 1 / 6 (+0; -2) |
| close_known | Rajdhani Day | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_known | Rajdhani Night | top5 | 7 → 7 → 7 / 11 (+0; +0) | 5 → 4 → 5 / 5 (+0; +1) | 2 → 2 → 2 / 6 (+0; +0) |
| close_known | Rajdhani Night | avoid2 | 5 → 6 → 5 / 11 (+0; -1) | 2 → 3 → 2 / 5 (+0; -1) | 5 → 4 → 5 / 6 (+0; +1) |
| close_known | Rajdhani Night | panel10 | 0 → 0 → 0 / 11 (+0; +0) | 1 → 1 → 1 / 5 (+0; +0) | 0 → 0 → 0 / 6 (+0; +0) |
| close_known | Rajdhani Night | sp30 | 3 → 3 → 3 / 9 (+0; +0) | 2 → 1 → 2 / 4 (+0; +1) | 2 → 1 → 2 / 4 (+0; +1) |
| close_known | Rajdhani Night | dp20 | 0 → 0 → 0 / 2 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_known | Sridevi | top5 | 9 → 8 → 9 / 15 (+0; +1) | 3 → 2 → 3 / 7 (+0; +1) | 5 → 4 → 5 / 10 (+0; +1) |
| close_known | Sridevi | avoid2 | 8 → 6 → 8 / 15 (+0; +2) | 4 → 1 → 4 / 7 (+0; +3) | 5 → 4 → 5 / 10 (+0; +1) |
| close_known | Sridevi | panel10 | 0 → 0 → 3 / 15 (+3; +3) | 2 → 2 → 0 / 7 (-2; -2) | 0 → 0 → 0 / 10 (+0; +0) |
| close_known | Sridevi | sp30 | 4 → 4 → 4 / 12 (+0; +0) | 1 → 2 → 1 / 6 (+0; -1) | 1 → 1 → 1 / 8 (+0; +0) |
| close_known | Sridevi | dp20 | 2 → 2 → 2 / 3 (+0; +0) | — (n=0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_known | Sridevi Night | top5 | 6 → 7 → 6 / 15 (+0; -1) | 3 → 2 → 3 / 6 (+0; +1) | 5 → 4 → 5 / 10 (+0; +1) |
| close_known | Sridevi Night | avoid2 | 10 → 9 → 10 / 15 (+0; +1) | 1 → 3 → 1 / 6 (+0; -2) | 7 → 5 → 7 / 10 (+0; +2) |
| close_known | Sridevi Night | panel10 | 0 → 3 → 0 / 15 (+0; -3) | 1 → 2 → 1 / 6 (+0; -1) | 3 → 2 → 3 / 10 (+0; +1) |
| close_known | Sridevi Night | sp30 | 0 → 1 → 0 / 10 (+0; -1) | 2 → 0 → 2 / 6 (+0; +2) | 3 → 4 → 3 / 8 (+0; -1) |
| close_known | Sridevi Night | dp20 | 3 → 3 → 3 / 5 (+0; +0) | — (n=0) | 0 → 0 → 0 / 2 (+0; +0) |
| close_known | Time Bazar | top5 | 6 → 7 → 6 / 13 (+0; -1) | 4 → 5 → 4 / 6 (+0; -1) | 4 → 2 → 4 / 8 (+0; +2) |
| close_known | Time Bazar | avoid2 | 7 → 4 → 7 / 13 (+0; +3) | 5 → 6 → 5 / 6 (+0; -1) | 7 → 6 → 7 / 8 (+0; +1) |
| close_known | Time Bazar | panel10 | 2 → 3 → 2 / 13 (+0; -1) | 0 → 0 → 0 / 6 (+0; +0) | 0 → 0 → 0 / 8 (+0; +0) |
| close_known | Time Bazar | sp30 | 3 → 4 → 3 / 12 (+0; -1) | 2 → 0 → 2 / 5 (+0; +2) | 3 → 2 → 3 / 4 (+0; +1) |
| close_known | Time Bazar | dp20 | 0 → 0 → 0 / 1 (+0; +0) | 0 → 0 → 0 / 1 (+0; +0) | 1 → 1 → 1 / 4 (+0; +0) |

## Which component weights helped or hurt

This matched diagnostic compares the fixed ablation reference (`omitted=none`) with removal of every use of one specialist, including its panel-mixture contribution. These are fixed reference weights, not independently optimized winners. Positive net hits mean retaining that component helped this reference; negative values mean removal helped. This does not establish a causal or durable benefit of the component, and interactions can change the result under other weights.

Endpoint tuples are Top-5 / avoid-two / panel10 / SP30 / DP20 net hits. Different denominators remain separate and these numbers must not be summed into overall accuracy. `ablation_summary.csv` contains each market, endpoint and denominator, including paired Open/Close-pre Jodi ablations.

| Channel | Removed specialist | Weight validation | October 16–22 reused | October 23–November 1 reused |
|---|---|---|---|---|
| open | top5 | +1 / +1 / -2 / -3 / -1 | -3 / +0 / -1 / +0 / +5 | +1 / +0 / -1 / +3 / +5 |
| open | avoid2 | -2 / +5 / +1 / +1 / -1 | +0 / +5 / +1 / +1 / -1 | +0 / -1 / -1 / +1 / +1 |
| open | panel10 | -1 / +0 / +1 / +0 / +1 | +1 / +1 / +0 / +2 / +2 | +1 / +2 / -1 / +1 / +0 |
| open | sp30 | +2 / -5 / -1 / -2 / +0 | -4 / +1 / +0 / +1 / +2 | +1 / +8 / -1 / +3 / +0 |
| open | dp20 | -3 / +0 / +0 / -3 / +4 | +0 / +1 / -1 / +0 / +4 | +3 / +0 / -3 / +0 / +4 |
| close_pre | top5 | -2 / -5 / -2 / +0 / -2 | +4 / +2 / +1 / -3 / +1 | -8 / +0 / +0 / -1 / +3 |
| close_pre | avoid2 | +5 / -5 / +0 / +3 / -2 | -2 / -1 / +0 / -2 / +0 | -3 / +8 / -1 / -2 / +0 |
| close_pre | panel10 | +3 / -7 / -1 / -1 / +1 | -1 / +0 / +1 / +0 / -1 | -6 / +3 / -1 / +0 / +0 |
| close_pre | sp30 | -4 / -11 / +5 / +2 / +0 | -1 / +6 / +1 / -4 / +0 | -3 / +6 / +2 / +2 / +1 |
| close_pre | dp20 | +8 / -1 / +0 / -1 / -2 | +1 / +1 / +1 / -3 / +1 | -3 / -1 / +0 / -3 / +3 |
| close_known | top5 | +8 / +0 / +2 / +4 / +0 | -2 / -2 / -1 / +1 / +0 | -2 / +1 / +1 / -3 / +0 |
| close_known | avoid2 | -2 / +3 / +0 / -3 / -2 | +0 / -2 / +0 / -1 / -1 | -1 / +3 / +0 / -1 / +1 |
| close_known | panel10 | -1 / +1 / +1 / +5 / -2 | -3 / -4 / +0 / -1 / +1 | -2 / -5 / +1 / -1 / +1 |
| close_known | sp30 | -2 / +13 / -4 / -1 / +0 | +1 / -2 / +0 / -2 / +1 | -1 / +4 / +1 / +0 / +3 |
| close_known | dp20 | +4 / -2 / +0 / -1 / +0 | +0 / +1 / +0 / -1 / +1 | -3 / +2 / -2 / +1 / +0 |
| preopen_jodi | top5 | -2 | +1 | +1 |
| preopen_jodi | avoid2 | +2 | +0 | -1 |
| preopen_jodi | panel10 | +3 | +0 | -3 |
| preopen_jodi | sp30 | +1 | -1 | +1 |
| preopen_jodi | dp20 | +5 | +1 | +1 |

## Retained nonproduction fusion settings

These settings were selected from fusion-fit blocks, then kept fixed for both reused audit blocks. The individual-market endpoint table above records every gain and regression. Full IDs and parameters remain in `selection.json` and `catalogues.json`.

| Channel | Market | Family | Parameters |
|---|---|---|---|
| open | Main Bazar | five_component_fusion | `{"avoid2_weight": 1.0, "dp20_conditional_weight": 0.5, "dp20_mixture_weight": 0.0, "panel10_weight": 1.0, "sp30_conditional_weight": 1.0, "sp30_mixture_weight": 0.0, "top5_weight": 0.25}` |
| open | Sridevi Night | five_component_fusion | `{"avoid2_weight": 0.25, "dp20_conditional_weight": 0.5, "dp20_mixture_weight": 0.6, "panel10_weight": 0.2, "sp30_conditional_weight": 1.0, "sp30_mixture_weight": 0.2, "top5_weight": 0.0}` |
| close_pre | Kalyan | five_component_fusion | `{"avoid2_weight": 1.0, "dp20_conditional_weight": 1.0, "dp20_mixture_weight": 0.0, "panel10_weight": 1.0, "sp30_conditional_weight": 1.0, "sp30_mixture_weight": 0.0, "top5_weight": 2.0}` |
| close_pre | Main Bazar | specialist_control | `{"source": "dp20"}` |
| close_known | Sridevi | specialist_control | `{"source": "baseline"}` |

## Interpretation and reproduction

The complete endpoint ledger is `market_summary.csv`. All channels and metrics reuse observations, and pooled rows overlap market rows. Candidate search, repeated historical analysis, upstream fitted-feature selection and short late samples prevent a durable accuracy claim. No candidate is authorized for production by this report.

Run `python -B research/combined_prediction_v7/verify_study.py` for the independent audit and `python -B research/combined_prediction_v7/report_study.py` to regenerate these tables without reselection or network access.
