# Combined prediction V2: 500-variant market study

No frozen selector establishes a positive accuracy improvement after Holm correction across all 117 fresh comparisons. Keep production unchanged.

## What was tested

Exactly 100 patterns, 100 methods, 100 theories, 100 formulas and 100 combinations were evaluated, 500 parameterized variants plus the unchanged production baseline. The category names describe hypothesis groups. They do not mean 500 independent algorithms or scientific theories.

Every variant was scored separately for three forecast channels and three fixed pick budgets, nine channel/endpoint settings, on all 12 markets. Selection used development and validation only. One pooled selector and 12 separate market selectors were frozen for each setting, 117 selectors in total. A market winner is never chosen from the fresh results.

Top-10 is evaluated on every legal panel outcome. SP-30 is conditional on the actual panel having three distinct digits. DP-20 is conditional on the actual panel having exactly two distinct digits. These denominators and budgets differ, so their accuracy percentages are not added or averaged.

Historical input: 1066 market-date events, 2026-07-04 through 2026-10-17. Each market-date has Open and Close outcomes; repeating channels, endpoints or candidates does not create independent observations.

Combined replay after fresh collection: 1113 market-date events through 2026-10-22. The requested fresh window is October 18-22, 2026. Missing market dates are not invented. Each table reports its own eligible count.

Fresh upstream model features include 5 newly collected October 16-17 context draws that were absent from the sealed historical replay. The added V5 pattern counts and online method updates use the sealed replay plus fresh target rows, so they omit those context draws. This preserves the frozen historical predictions but gives those candidates a sparser history than the upstream baseline. Fresh results describe this exact replay procedure; they do not establish performance with complete online history.

Development is July 4-August 16. Validation is August 17-September 7, split at August 27. A candidate must avoid development regression and gain hits in both validation halves. Otherwise production is retained. September 8-October 17 is reused diagnostic history. Selection and candidate definitions were frozen and hashed before requesting the October 18-22 outcomes. This is a retrospective collection after selection freeze, not a pre-event forecast registry.

Added historical features and online weights use only outcomes from strictly earlier dates. Online rules predict every market for a date before updating with any labels from that date. Added count histories begin at the first replay date. Frozen upstream models retain historical fitting and policy-selection bias. The Close-after-Open channel receives the full declared Open panel, matching this replay contract.

## Pooled selectors

Cells show production hits → selected hits / eligible events, followed by net hits. Every row keeps the same pick budget.

| Channel / budget | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Open / Top-10 | `production` | 13→13/237 (+0) | 18→18/152 (+0) | 0→0/14 (+0) | 3→3/47 (+0) | 1 |
| Open / SP-30 | `production` | 43→43/170 (+0) | 36→36/115 (+0) | 0→0/10 (+0) | 6→6/36 (+0) | 1 |
| Open / DP-20 | `pattern/weekday_panel_frequency/window=14` | 20→20/65 (+0) | 8→8/37 (+0) | 1→1/4 (+0) | 3→3/11 (+0) | 1 |
| Close before Open / Top-10 | `theory/opposite_panel/strength=0.25` | 14→13/237 (-1) | 11→11/152 (+0) | 0→0/14 (+0) | 4→4/47 (+0) | 1 |
| Close before Open / SP-30 | `method_recent30_01` | 47→39/186 (-8) | 28→26/111 (-2) | 3→1/12 (-2) | 10→9/34 (-1) | 1 |
| Close before Open / DP-20 | `production` | 12→12/51 (+0) | 10→10/41 (+0) | 0→0/2 (+0) | 4→4/12 (+0) | 1 |
| Close after full Open / Top-10 | `production` | 18→18/237 (+0) | 6→6/152 (+0) | 1→1/14 (+0) | 6→6/47 (+0) | 1 |
| Close after full Open / SP-30 | `production` | 59→59/186 (+0) | 30→30/111 (+0) | 5→5/12 (+0) | 10→10/34 (+0) | 1 |
| Close after full Open / DP-20 | `formula_00_01` | 15→15/51 (+0) | 9→9/41 (+0) | 1→1/2 (+0) | 2→2/12 (+0) | 1 |

## Market results

Market selection is independent for every channel and budget. A positive validation result followed by negative evaluation net hits is a reversal. These comparisons are retained even when a different market improves.

Fresh market counts compare selected hits with production separately in each of the 12 markets. Ties include selectors that retained production. Markets with zero eligible outcomes are counted separately. Counts across settings share outcomes and are not independent evidence.

| Channel / budget | More hits | Fewer hits | Same hits | No eligible outcomes |
|---|---:|---:|---:|---:|
| Open / Top-10 | 0 | 0 | 11 | 1 |
| Open / SP-30 | 0 | 0 | 11 | 1 |
| Open / DP-20 | 0 | 0 | 6 | 6 |
| Close before Open / Top-10 | 1 | 0 | 10 | 1 |
| Close before Open / SP-30 | 3 | 2 | 5 | 2 |
| Close before Open / DP-20 | 0 | 0 | 9 | 3 |
| Close after full Open / Top-10 | 0 | 1 | 10 | 1 |
| Close after full Open / SP-30 | 1 | 3 | 6 | 2 |
| Close after full Open / DP-20 | 0 | 0 | 9 | 3 |

### Open / Top-10

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `theory/digit_persistence/strength=-2` | 1→1/20 (+0) | 1→2/13 (+1) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Kalyan Night | `production` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Madhur Day | `production` | 1→1/23 (+0) | 0→0/15 (+0) | 0→0/2 (+0) | 0→0/5 (+0) | 1 |
| Madhur Night | `pattern/digit_pair_frequency/window=21` | 0→0/20 (+0) | 2→1/9 (-1) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/17 (+0) | 0→0/11 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Milan Day | `formula_05_05` | 0→0/19 (+0) | 2→2/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Milan Night | `theory/digit_persistence/strength=-2` | 1→3/19 (+2) | 3→1/13 (-2) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Day | `production` | 1→1/20 (+0) | 2→2/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Night | `production` | 1→1/17 (+0) | 1→1/11 (+0) | 0→0/1 (+0) | 2→2/4 (+0) | 1 |
| Sridevi | `production` | 4→4/23 (+0) | 1→1/15 (+0) | 0→0/2 (+0) | 0→0/5 (+0) | 1 |
| Sridevi Night | `production` | 0→0/23 (+0) | 4→4/15 (+0) | 0→0/1 (+0) | 0→0/5 (+0) | 1 |
| Time Bazar | `production` | 3→3/19 (+0) | 1→1/13 (+0) | 0→0/2 (+0) | 0→0/4 (+0) | 1 |

### Open / SP-30

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `pattern/panel_overdue/window=14` | 8→6/15 (-2) | 2→3/12 (+1) | no eligible events | 0→0/3 (+0) | 1 |
| Kalyan Night | `production` | 3→3/11 (+0) | 4→4/9 (+0) | no eligible events | 0→0/2 (+0) | 1 |
| Madhur Day | `production` | 2→2/15 (+0) | 2→2/11 (+0) | 0→0/2 (+0) | 0→0/4 (+0) | 1 |
| Madhur Night | `method_digit_bernoulli_05` | 2→4/12 (+2) | 3→3/5 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 1→1/13 (+0) | 0→0/9 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Milan Day | `theory/opposite_digits/strength=0.25` | 2→2/14 (+0) | 3→2/9 (-1) | 0→0/1 (+0) | 0→0/1 (+0) | 1 |
| Milan Night | `pattern/panel_overdue/window=30` | 2→3/16 (+1) | 6→5/12 (-1) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Day | `production` | 5→5/16 (+0) | 1→1/8 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Rajdhani Night | `method_sutta_hierarchy_06` | 4→3/9 (-1) | 4→3/8 (-1) | 0→1/1 (+1) | 2→2/4 (+0) | 1 |
| Sridevi | `pattern/sutta_transition/window=10` | 7→8/20 (+1) | 2→1/13 (-1) | 0→0/1 (+0) | 0→0/5 (+0) | 1 |
| Sridevi Night | `production` | 4→4/14 (+0) | 7→7/12 (+0) | 0→0/1 (+0) | 1→1/3 (+0) | 1 |
| Time Bazar | `production` | 3→3/15 (+0) | 2→2/7 (+0) | 0→0/1 (+0) | 1→1/2 (+0) | 1 |

### Open / DP-20

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 2→2/5 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 0→0/1 (+0) | 1 |
| Kalyan Night | `production` | 3→3/6 (+0) | 1→1/2 (+0) | 1→1/1 (+0) | 0→0/2 (+0) | 1 |
| Madhur Day | `production` | 3→3/7 (+0) | 1→1/4 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Madhur Night | `production` | 3→3/8 (+0) | 0→0/4 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/4 (+0) | 1→1/2 (+0) | no eligible events | no eligible events | 1 |
| Milan Day | `production` | 1→1/4 (+0) | 0→0/4 (+0) | no eligible events | 2→2/3 (+0) | 1 |
| Milan Night | `production` | 1→1/3 (+0) | 0→0/1 (+0) | no eligible events | no eligible events | 1 |
| Rajdhani Day | `production` | 1→1/4 (+0) | 0→0/5 (+0) | no eligible events | no eligible events | 1 |
| Rajdhani Night | `production` | 3→3/8 (+0) | 1→1/3 (+0) | no eligible events | no eligible events | 1 |
| Sridevi | `production` | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/1 (+0) | no eligible events | 1 |
| Sridevi Night | `production` | 0→0/9 (+0) | 1→1/3 (+0) | no eligible events | 1→1/2 (+0) | 1 |
| Time Bazar | `production` | 2→2/4 (+0) | 2→2/6 (+0) | 0→0/1 (+0) | 0→0/2 (+0) | 1 |

### Close before Open / Top-10

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Kalyan Night | `production` | 2→2/17 (+0) | 1→1/11 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Madhur Day | `production` | 1→1/23 (+0) | 0→0/15 (+0) | 0→0/2 (+0) | 1→1/5 (+0) | 1 |
| Madhur Night | `production` | 1→1/20 (+0) | 0→0/9 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/17 (+0) | 2→2/11 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Milan Day | `production` | 2→2/19 (+0) | 0→0/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Milan Night | `method_decay30_05` | 0→0/19 (+0) | 0→0/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Day | `production` | 2→2/20 (+0) | 3→3/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Night | `method_panel_transition_01` | 1→2/17 (+1) | 1→0/11 (-1) | 0→0/1 (+0) | 0→1/4 (+1) | 1 |
| Sridevi | `production` | 2→2/23 (+0) | 2→2/15 (+0) | 0→0/2 (+0) | 1→1/5 (+0) | 1 |
| Sridevi Night | `pattern/sutta_transition/window=30` | 2→2/23 (+0) | 0→1/15 (+1) | 0→0/1 (+0) | 1→1/5 (+0) | 1 |
| Time Bazar | `production` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/2 (+0) | 0→0/4 (+0) | 1 |

### Close before Open / SP-30

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 2→2/12 (+0) | 1→1/9 (+0) | 0→0/1 (+0) | 1→1/3 (+0) | 1 |
| Kalyan Night | `theory/opposite_digits/strength=2` | 5→2/13 (-3) | 2→5/9 (+3) | 0→0/1 (+0) | 1→1/3 (+0) | 1 |
| Madhur Day | `production` | 4→4/19 (+0) | 0→0/11 (+0) | 0→0/1 (+0) | 2→2/4 (+0) | 1 |
| Madhur Night | `theory/digit_persistence/strength=1` | 4→5/11 (+1) | 1→2/8 (+1) | no eligible events | no eligible events | 1 |
| Main Bazar | `theory/previous_opposite_side_digits/strength=1.5` | 1→5/14 (+4) | 4→3/7 (-1) | 0→1/1 (+1) | 1→2/3 (+1) | 1 |
| Milan Day | `production` | 2→2/17 (+0) | 1→1/5 (+0) | no eligible events | no eligible events | 1 |
| Milan Night | `theory/previous_opposite_side_digits/strength=2` | 3→6/19 (+3) | 1→1/8 (+0) | 1→0/1 (-1) | 0→1/3 (+1) | 1 |
| Rajdhani Day | `theory/digit_persistence/strength=2` | 6→5/13 (-1) | 5→3/11 (-2) | 0→0/1 (+0) | 2→1/3 (-1) | 1 |
| Rajdhani Night | `method_recent30_09` | 5→3/15 (-2) | 2→1/9 (-1) | 0→0/1 (+0) | 0→1/3 (+1) | 1 |
| Sridevi | `theory/parity_persistence/strength=1` | 3→4/19 (+1) | 3→5/12 (+2) | 1→1/2 (+0) | 1→0/4 (-1) | 1 |
| Sridevi Night | `production` | 7→7/18 (+0) | 3→3/10 (+0) | 0→0/1 (+0) | 1→1/5 (+0) | 1 |
| Time Bazar | `production` | 5→5/16 (+0) | 5→5/12 (+0) | 1→1/2 (+0) | 1→1/3 (+0) | 1 |

### Close before Open / DP-20

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 1→1/8 (+0) | 1→1/4 (+0) | no eligible events | 1→1/1 (+0) | 1 |
| Kalyan Night | `production` | 1→1/4 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Madhur Day | `production` | 1→1/4 (+0) | 1→1/4 (+0) | 0→0/1 (+0) | 1→1/1 (+0) | 1 |
| Madhur Night | `production` | 4→4/9 (+0) | 0→0/1 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/3 (+0) | 0→0/4 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Milan Day | `production` | 0→0/2 (+0) | 1→1/8 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Milan Night | `production` | no eligible events | 1→1/5 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Rajdhani Day | `production` | 3→3/7 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Sridevi | `production` | 0→0/4 (+0) | 2→2/3 (+0) | no eligible events | no eligible events | 1 |
| Sridevi Night | `production` | 1→1/5 (+0) | 3→3/5 (+0) | no eligible events | no eligible events | 1 |
| Time Bazar | `production` | 1→1/3 (+0) | 1→1/1 (+0) | no eligible events | 1→1/1 (+0) | 1 |

### Close after full Open / Top-10

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 0→0/20 (+0) | 0→0/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Kalyan Night | `production` | 0→0/17 (+0) | 0→0/11 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Madhur Day | `production` | 1→1/23 (+0) | 1→1/15 (+0) | 0→0/2 (+0) | 0→0/5 (+0) | 1 |
| Madhur Night | `theory/panel_persistence/strength=0.25` | 2→2/20 (+0) | 0→1/9 (+1) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/17 (+0) | 1→1/11 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Milan Day | `production` | 3→3/19 (+0) | 0→0/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Milan Night | `production` | 1→1/19 (+0) | 2→2/13 (+0) | 0→0/1 (+0) | 0→0/4 (+0) | 1 |
| Rajdhani Day | `theory/digit_persistence/strength=0.25` | 5→2/20 (-3) | 0→1/13 (+1) | 0→0/1 (+0) | 2→1/4 (-1) | 1 |
| Rajdhani Night | `method_panel_transition_01` | 3→2/17 (-1) | 0→0/11 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Sridevi | `production` | 2→2/23 (+0) | 0→0/15 (+0) | 1→1/2 (+0) | 1→1/5 (+0) | 1 |
| Sridevi Night | `production` | 0→0/23 (+0) | 0→0/15 (+0) | 0→0/1 (+0) | 1→1/5 (+0) | 1 |
| Time Bazar | `pattern/weekday_panel_frequency/window=30` | 1→2/19 (+1) | 2→1/13 (-1) | 0→0/2 (+0) | 0→0/4 (+0) | 1 |

### Close after full Open / SP-30

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 3→3/12 (+0) | 3→3/9 (+0) | 0→0/1 (+0) | 0→0/3 (+0) | 1 |
| Kalyan Night | `production` | 4→4/13 (+0) | 5→5/9 (+0) | 0→0/1 (+0) | 2→2/3 (+0) | 1 |
| Madhur Day | `pattern/digit_frequency/window=60` | 9→6/19 (-3) | 3→2/11 (-1) | 1→1/1 (+0) | 1→1/4 (+0) | 1 |
| Madhur Night | `production` | 2→2/11 (+0) | 1→1/8 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 5→5/14 (+0) | 1→1/7 (+0) | 0→0/1 (+0) | 1→1/3 (+0) | 1 |
| Milan Day | `pattern/sutta_transition/window=21` | 7→4/17 (-3) | 0→2/5 (+2) | no eligible events | no eligible events | 1 |
| Milan Night | `production` | 7→7/19 (+0) | 3→3/8 (+0) | 0→0/1 (+0) | 1→1/3 (+0) | 1 |
| Rajdhani Day | `method_pooled_dirichlet_01` | 1→3/13 (+2) | 4→3/11 (-1) | 1→0/1 (-1) | 1→0/3 (-1) | 1 |
| Rajdhani Night | `theory/digit_persistence/strength=0.25` | 2→2/15 (+0) | 3→1/9 (-2) | 1→0/1 (-1) | 1→0/3 (-1) | 1 |
| Sridevi | `pattern/panel_frequency/window=5` | 10→7/19 (-3) | 4→4/12 (+0) | 1→1/2 (+0) | 0→1/4 (+1) | 1 |
| Sridevi Night | `production` | 4→4/18 (+0) | 0→0/10 (+0) | 0→0/1 (+0) | 2→2/5 (+0) | 1 |
| Time Bazar | `combination_01_07` | 5→2/16 (-3) | 3→2/12 (-1) | 1→0/2 (-1) | 1→0/3 (-1) | 1 |

### Close after full Open / DP-20

| Market | Selected candidate | September reused | October 1-15 reused | October 16-17 reused | Fresh | Fresh Holm p |
|---|---|---|---|---|---|---|
| Kalyan | `production` | 2→2/8 (+0) | 1→1/4 (+0) | no eligible events | 1→1/1 (+0) | 1 |
| Kalyan Night | `production` | 1→1/4 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Madhur Day | `production` | 1→1/4 (+0) | 1→1/4 (+0) | 1→1/1 (+0) | 0→0/1 (+0) | 1 |
| Madhur Night | `production` | 3→3/9 (+0) | 1→1/1 (+0) | no eligible events | no eligible events | 1 |
| Main Bazar | `production` | 0→0/3 (+0) | 0→0/4 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Milan Day | `production` | 0→0/2 (+0) | 1→1/8 (+0) | 0→0/1 (+0) | 1→1/4 (+0) | 1 |
| Milan Night | `production` | no eligible events | 0→0/5 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Rajdhani Day | `production` | 4→4/7 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/2 (+0) | no eligible events | 0→0/1 (+0) | 1 |
| Sridevi | `production` | 1→1/4 (+0) | 2→2/3 (+0) | no eligible events | no eligible events | 1 |
| Sridevi Night | `production` | 2→2/5 (+0) | 3→3/5 (+0) | no eligible events | no eligible events | 1 |
| Time Bazar | `production` | 1→1/3 (+0) | 0→0/1 (+0) | no eligible events | 0→0/1 (+0) | 1 |

## Duplicate candidates and uncertainty

Candidate IDs are unique. Probability-distribution fingerprints round to 12 decimal places. Equal fingerprints identify numerical duplicates across the full replay. Different distributions can still produce identical panel rankings and hit vectors; distribution counts alone do not establish distinct ranking rules or independent tests.

| Channel / budget | Distinct historical probability distributions, including production |
|---|---:|
| Open / Top-10 | 461 / 501 |
| Open / SP-30 | 462 / 501 |
| Open / DP-20 | 461 / 501 |
| Close before Open / Top-10 | 495 / 501 |
| Close before Open / SP-30 | 494 / 501 |
| Close before Open / DP-20 | 500 / 501 |
| Close after full Open / Top-10 | 492 / 501 |
| Close after full Open / SP-30 | 491 / 501 |
| Close after full Open / DP-20 | 492 / 501 |

Fresh paired p-values compare discordant hits with an exact two-sided binomial test. Holm correction covers all 117 pooled and market selectors, including selectors that retain production. Holm handles dependence between comparisons, but the underlying event-level tests still assume independent discordances. Same-date market dependence is not removed by this correction. Five days are too few to establish stable market-specific superiority.

Probability improvements alone do not imply better fixed-budget accuracy. Log loss, Brier score and the Sutta-6/present-pair/absent-pair diagnostics are recorded in candidate_metrics.csv.gz and fresh_candidate_metrics.csv.gz. Those derived outputs are scored from SP-30 probabilities and are not additional independent panel observations.

Promotion requires positive fresh lift after correction, adequate market support and checks that other required outputs do not suffer unacceptable regression. This report does not change production, and a short-window statistical signal alone does not satisfy all those conditions.

## Reproduce and inspect

`python -B research/combined_prediction_v5/report_study.py` rebuilds this report and market_summary.csv from existing result files. It does not fit models, change selectors or request new outcomes. catalogue.json gives every candidate definition. selection.json and selection_manifest.json record the frozen routing decisions and hashes. The compressed candidate metric ledgers include every variant on every market and evaluation block.

Run these commands from the repository root with Python, NumPy and SciPy available. Existing sealed replay files and the frozen V5 files must be present. The fresh scoring command reads the already collected fresh replay and verifies frozen hashes before scoring. It does not fetch new outcomes.

```text
python -B research/combined_prediction_v5/run_study.py --fresh
python -B research/combined_prediction_v5/verify_study.py --fresh-only
python -B research/combined_prediction_v5/report_study.py
```

For a full candidate-distribution and label-perturbation reconstruction, run `python -B research/combined_prediction_v5/verify_study.py` instead of the shorter fresh-only audit. Historical selection is sealed; run_study.py deliberately refuses to refit it in this folder. The fresh-only audit requires the recorded successful historical reconstruction.

The CSV contains separate rows for all 117 selectors and every available block, including validation gains, historical reversals, fresh exact paired tests and fresh Holm-adjusted p-values.

## Research references

- [Scikit-learn guidance on data leakage](https://scikit-learn.org/stable/common_pitfalls.html)
- [Forecasting: rolling-origin evaluation](https://otexts.com/fpp3/tscv.html)
- [Forecasting: forecast combinations](https://otexts.com/fpp3/combinations.html)

These sources inform the protocol. The measured results come from this repository's historical and fresh replay files.
