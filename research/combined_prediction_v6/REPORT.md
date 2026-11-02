# Combined prediction V6: joint fixed-budget study

Production remains unchanged. These results are retrospective research and do not establish a durable accuracy improvement.

No frozen objective selector has positive extension lift after Holm correction across all 351 objective comparisons.

The study selects separately for Top-5 Sutta, two absent digits, panel Top-10, SP-30, DP-20, Sutta plus absent digits, and each corresponding three-component joint hit. Every selected candidate is also evaluated on all nine metrics. A joint hit requires all declared components to hit on the same event.

Panel budgets are exactly 10 from 220 legal panels, 30 from 120 SP panels, and 20 from 90 DP panels. Sutta uses exactly five digits; avoid uses exactly two distinct digits absent from the actual panel. Ties use stable universe order. SP/DP and their joint metrics are conditional on the actual panel kind. CSV all-event rates additionally count other panel kinds as misses. Rates with different denominators are never averaged.

Stage 1 uses development through August 16 and validation August 17–September 7. Stage 2 uses September 8–30 for refinement training and October 1–15 for refinement validation. October 16–22 is diagnostic history. October 23–November 1 is the final extension. Candidate definitions and selectors are frozen before extension retrieval, but earlier research already reused source outcomes; neither chronological retrieval nor frozen hashes makes this a genuinely untouched or pre-event test.

The extension contains 88 complete market-date records across 11 markets; Madhur Night has no eligible extension records. Missing events are not invented. Five complete raw context records are absent from the sparse replay history used by added historical candidates, while upstream production features use the available raw history. This uneven history support limits attribution and the interpretation of comparisons.

Selection across many variants, objectives, channels and markets creates substantial selection bias. Channels and metrics reuse outcomes; their counts are not independent observations. New historical features can be checked for strictly earlier-date updates, while upstream fitted features retain their historical selection bias. Close after Open receives the full declared Open panel.

The largest observed pooled three-component gain is close_pre/joint_sp30: 5→13/66 (+8); paired p=0.05737, Holm p=1. For this same selector, companion net hits are top5 -1, avoid2 +0, panel10 -1, sp30 -1, dp20 -1, sutta_avoid -6. This is an observed joint gain with output tradeoffs, not a uniform accuracy gain. It is highlighted descriptively after evaluation, not chosen as a new deployment rule.

## Pooled objective results

Cells show baseline hits → selected hits / eligible events (net hits). Each row concerns its selected objective only; companion regressions appear below and in the CSV.

| Channel | Objective | Candidate | Refinement validation | October 16–22 reused | October 23–November 1 extension | Extension Holm p | Extension day-bootstrap 95% lift pp |
|---|---|---|---|---|---|---|---|
| open | top5 | `cross:causal_history/mechanism=overdue_digits_7/strength=0.25:joint_likelihood/sutta=panel/digits=blend/strength=1.5:0.75` | 81→89/152 (+8) | 32→30/61 (-2) | 42→40/88 (-2) | 1 | [-11.76, 6.25] |
| open | avoid2 | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:0.5` | 74→91/152 (+17) | 32→31/61 (-1) | 52→43/88 (-9) | 1 | [-23.61, 5.38] |
| open | panel10 | `production` | 18→18/152 (+0) | 3→3/61 (+0) | 3→3/88 (+0) | 1 | [0.00, 0.00] |
| open | sp30 | `refine:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:base=1.0` | 36→40/115 (+4) | 6→8/46 (+2) | 18→20/64 (+2) | 1 | [-5.77, 13.21] |
| open | dp20 | `refine:joint_ipf/sutta=panel/digits=present/damping=0.75/passes=3:base=0.75` | 8→13/37 (+5) | 4→3/15 (-1) | 5→11/24 (+6) | 1 | [7.14, 50.00] |
| open | sutta_avoid | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:digit_symmetry/transform=mirror5/alpha=0.25:0.5` | 39→53/152 (+14) | 16→15/61 (-1) | 23→24/88 (+1) | 1 | [-6.86, 9.47] |
| open | joint10 | `production` | 14→14/152 (+0) | 2→2/61 (+0) | 2→2/88 (+0) | 1 | [0.00, 0.00] |
| open | joint_sp30 | `refine:joint_gates/sutta=panel/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:base=0.25` | 21→24/115 (+3) | 4→5/46 (+1) | 7→9/64 (+2) | 1 | [-3.70, 11.77] |
| open | joint_dp20 | `production` | 3→3/37 (+0) | 0→0/15 (+0) | 1→1/24 (+0) | 1 | [0.00, 0.00] |
| close_pre | top5 | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 69→91/152 (+22) | 29→31/61 (+2) | 45→53/88 (+8) | 1 | [-11.37, 32.90] |
| close_pre | avoid2 | `refine:causal_history/mechanism=recent_digits_7/strength=2.0:base=1.0` | 77→89/152 (+12) | 37→31/61 (-6) | 43→45/88 (+2) | 1 | [-10.10, 19.32] |
| close_pre | panel10 | `cross:causal_history/mechanism=last_digits/strength=1.0:causal_history/mechanism=last_sutta/strength=2.0:0.75` | 11→18/152 (+7) | 4→6/61 (+2) | 5→7/88 (+2) | 1 | [-2.97, 8.24] |
| close_pre | sp30 | `refine:causal_history/mechanism=recent_digits_7/strength=2.0:base=1.0` | 28→34/111 (+6) | 13→14/46 (+1) | 14→20/66 (+6) | 1 | [-8.75, 28.99] |
| close_pre | dp20 | `refine:causal_history/mechanism=overdue_sutta_30/strength=2.0:base=0.75` | 10→18/41 (+8) | 4→4/14 (+0) | 5→5/21 (+0) | 1 | [-35.30, 20.83] |
| close_pre | sutta_avoid | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.75` | 42→53/152 (+11) | 19→21/61 (+2) | 25→19/88 (-6) | 1 | [-16.16, 5.56] |
| close_pre | joint10 | `refine:causal_history/mechanism=recent_digits_7/strength=1.0:base=0.5` | 7→12/152 (+5) | 2→2/61 (+0) | 3→4/88 (+1) | 1 | [-2.53, 5.56] |
| close_pre | joint_sp30 | `refine:joint_gates/sutta=native/avoid=panel_avoid/sutta_penalty=12.0/avoid_penalty=12.0:base=1.0` | 15→24/111 (+9) | 6→16/46 (+10) | 5→13/66 (+8) | 1 | [0.00, 24.59] |
| close_pre | joint_dp20 | `refine:joint_gates/sutta=native/avoid=panel_avoid/sutta_penalty=12.0/avoid_penalty=12.0:base=1.0` | 2→11/41 (+9) | 1→2/14 (+1) | 2→4/21 (+2) | 1 | [-23.53, 28.57] |
| close_known | top5 | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 80→85/152 (+5) | 36→36/61 (+0) | 44→45/88 (+1) | 1 | [-3.30, 6.95] |
| close_known | avoid2 | `cross:causal_history/mechanism=overdue_sutta_30/strength=0.25:digit_symmetry/transform=multiply3/alpha=0.25:0.5` | 83→86/152 (+3) | 35→33/61 (-2) | 49→48/88 (-1) | 1 | [-8.14, 5.72] |
| close_known | panel10 | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.75` | 6→12/152 (+6) | 7→8/61 (+1) | 10→9/88 (-1) | 1 | [-6.82, 3.30] |
| close_known | sp30 | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.25` | 30→34/111 (+4) | 15→16/46 (+1) | 18→17/66 (-1) | 1 | [-11.11, 9.68] |
| close_known | dp20 | `refine:sutta_marginal/source=conditional/strength=-1.0:base=1.0` | 9→16/41 (+7) | 3→3/14 (+0) | 3→7/21 (+4) | 1 | [0.00, 35.48] |
| close_known | sutta_avoid | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.5` | 40→44/152 (+4) | 21→24/61 (+3) | 25→27/88 (+2) | 1 | [-2.33, 8.33] |
| close_known | joint10 | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.5` | 2→10/152 (+8) | 0→6/61 (+6) | 2→3/88 (+1) | 1 | [-4.48, 5.32] |
| close_known | joint_sp30 | `refine:avoid2_gate/source=panel_avoid/penalty=0.15:base=0.25` | 18→20/111 (+2) | 11→11/46 (+0) | 8→10/66 (+2) | 1 | [0.00, 8.00] |
| close_known | joint_dp20 | `refine:avoid2_gate/source=panel_avoid/penalty=0.15:base=0.5` | 4→11/41 (+7) | 2→2/14 (+0) | 0→1/21 (+1) | 1 | [0.00, 15.79] |

## Candidate families and retained hypotheses

Counts describe parameter variants, not independent theories. A stage-one variant absent from the retained column won no objective/market shortlist; it may still have positive cells. Refined counts include mixtures of the retained parents.

| Channel | Family | Coarse variants | Distinct retained stage-one variants |
|---|---|---:|---:|
| open | baseline | 1 | 1 |
| open | source_fusion | 24 | 3 |
| open | sutta_marginal | 18 | 1 |
| open | bernoulli_digits | 18 | 4 |
| open | avoid2_gate | 16 | 1 |
| open | top5_sutta_gate | 24 | 0 |
| open | joint_gates | 102 | 3 |
| open | joint_likelihood | 27 | 1 |
| open | causal_history | 84 | 22 |
| open | digit_symmetry | 25 | 10 |
| open | joint_ipf | 36 | 1 |
| open | probability_mixture | 36 | 3 |
| open | temperature_control | 8 | 0 |

open: 346 refinement variants; 65/117 objective/market selectors retained an experimental refinement.

| close_pre | baseline | 1 | 1 |
| close_pre | source_fusion | 24 | 1 |
| close_pre | sutta_marginal | 18 | 2 |
| close_pre | bernoulli_digits | 18 | 2 |
| close_pre | avoid2_gate | 16 | 3 |
| close_pre | top5_sutta_gate | 24 | 1 |
| close_pre | joint_gates | 102 | 13 |
| close_pre | joint_likelihood | 27 | 1 |
| close_pre | causal_history | 84 | 20 |
| close_pre | digit_symmetry | 25 | 13 |
| close_pre | joint_ipf | 36 | 4 |
| close_pre | probability_mixture | 36 | 1 |
| close_pre | temperature_control | 8 | 3 |

close_pre: 403 refinement variants; 72/117 objective/market selectors retained an experimental refinement.

| close_known | baseline | 1 | 1 |
| close_known | source_fusion | 24 | 1 |
| close_known | sutta_marginal | 18 | 3 |
| close_known | bernoulli_digits | 18 | 6 |
| close_known | avoid2_gate | 16 | 4 |
| close_known | top5_sutta_gate | 24 | 4 |
| close_known | joint_gates | 102 | 3 |
| close_known | joint_likelihood | 27 | 6 |
| close_known | causal_history | 84 | 17 |
| close_known | digit_symmetry | 25 | 8 |
| close_known | joint_ipf | 36 | 6 |
| close_known | probability_mixture | 36 | 1 |
| close_known | temperature_control | 8 | 1 |

close_known: 381 refinement variants; 74/117 objective/market selectors retained an experimental refinement.

## Refinement added value

This comparison uses each scope's own stage-one winner and final refinement on the same objective and events. Refinement validation influenced final selection, so apparent gains there are selected gains. October 16–22 was diagnostic history. This table measures added refinement value rather than conflating it with improvement over production.

| Channel | Objective | Refinement validation: stage 1→final | October 16–22: stage 1→final |
|---|---|---|---|
| open | top5 | 88→89/152 (+1) | 28→30/61 (+2) |
| open | avoid2 | 77→91/152 (+14) | 35→31/61 (-4) |
| open | panel10 | 14→18/152 (+4) | 5→3/61 (-2) |
| open | sp30 | 36→40/115 (+4) | 6→8/46 (+2) |
| open | dp20 | 8→13/37 (+5) | 4→3/15 (-1) |
| open | sutta_avoid | 39→53/152 (+14) | 15→15/61 (+0) |
| open | joint10 | 14→14/152 (+0) | 2→2/61 (+0) |
| open | joint_sp30 | 21→24/115 (+3) | 4→5/46 (+1) |
| open | joint_dp20 | 3→3/37 (+0) | 0→0/15 (+0) |
| close_pre | top5 | 77→91/152 (+14) | 25→31/61 (+6) |
| close_pre | avoid2 | 83→89/152 (+6) | 37→31/61 (-6) |
| close_pre | panel10 | 11→18/152 (+7) | 4→6/61 (+2) |
| close_pre | sp30 | 31→34/111 (+3) | 11→14/46 (+3) |
| close_pre | dp20 | 13→18/41 (+5) | 3→4/14 (+1) |
| close_pre | sutta_avoid | 38→53/152 (+15) | 18→21/61 (+3) |
| close_pre | joint10 | 7→12/152 (+5) | 2→2/61 (+0) |
| close_pre | joint_sp30 | 14→24/111 (+10) | 5→16/46 (+11) |
| close_pre | joint_dp20 | 7→11/41 (+4) | 0→2/14 (+2) |
| close_known | top5 | 70→85/152 (+15) | 31→36/61 (+5) |
| close_known | avoid2 | 84→86/152 (+2) | 36→33/61 (-3) |
| close_known | panel10 | 6→12/152 (+6) | 7→8/61 (+1) |
| close_known | sp30 | 30→34/111 (+4) | 13→16/46 (+3) |
| close_known | dp20 | 9→16/41 (+7) | 3→3/14 (+0) |
| close_known | sutta_avoid | 42→44/152 (+2) | 19→24/61 (+5) |
| close_known | joint10 | 2→10/152 (+8) | 0→6/61 (+6) |
| close_known | joint_sp30 | 18→20/111 (+2) | 11→11/46 (+0) |
| close_known | joint_dp20 | 4→11/41 (+7) | 2→2/14 (+0) |

## Companion-metric guardrails

Every row counts market selectors separately, excluding pooled selectors. Improvements in one metric never cancel regressions in another. Zero-event cells are listed separately. All companion results, including regressions for the selected objective itself, remain in the CSV.

| Block | Metric | More hits | Fewer hits | Same hits | No eligible events |
|---|---|---:|---:|---:|---:|
| refine_validation | top5 | 106 | 23 | 195 | 0 |
| refine_validation | avoid2 | 112 | 19 | 193 | 0 |
| refine_validation | panel10 | 85 | 42 | 197 | 0 |
| refine_validation | sp30 | 94 | 35 | 195 | 0 |
| refine_validation | dp20 | 59 | 50 | 215 | 0 |
| refine_validation | sutta_avoid | 136 | 16 | 172 | 0 |
| refine_validation | joint10 | 97 | 33 | 194 | 0 |
| refine_validation | joint_sp30 | 102 | 29 | 193 | 0 |
| refine_validation | joint_dp20 | 66 | 17 | 241 | 0 |
| late_reused | top5 | 43 | 38 | 216 | 27 |
| late_reused | avoid2 | 52 | 62 | 183 | 27 |
| late_reused | panel10 | 25 | 26 | 246 | 27 |
| late_reused | sp30 | 46 | 38 | 195 | 45 |
| late_reused | dp20 | 27 | 40 | 158 | 99 |
| late_reused | sutta_avoid | 48 | 62 | 187 | 27 |
| late_reused | joint10 | 38 | 9 | 250 | 27 |
| late_reused | joint_sp30 | 43 | 42 | 194 | 45 |
| late_reused | joint_dp20 | 12 | 11 | 202 | 99 |
| extension | top5 | 60 | 46 | 191 | 27 |
| extension | avoid2 | 37 | 67 | 193 | 27 |
| extension | panel10 | 34 | 52 | 211 | 27 |
| extension | sp30 | 47 | 52 | 198 | 27 |
| extension | dp20 | 38 | 35 | 197 | 54 |
| extension | sutta_avoid | 44 | 71 | 182 | 27 |
| extension | joint10 | 26 | 19 | 252 | 27 |
| extension | joint_sp30 | 47 | 37 | 213 | 27 |
| extension | joint_dp20 | 43 | 13 | 214 | 54 |

## Individual market objective results

| Channel | Objective | Market | Candidate | Refinement validation | October 16–22 reused | Extension |
|---|---|---|---|---|---|---|
| open | top5 | Kalyan | `refine:bernoulli_digits/source=blend/strength=1.0:base=0.5` | 7→9/13 (+2) | 3→3/5 (+0) | 5→5/8 (+0) |
| open | top5 | Kalyan Night | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=0.75` | 6→9/11 (+3) | 3→2/5 (-1) | 5→1/6 (-4) |
| open | top5 | Madhur Day | `cross:bernoulli_digits/source=blend/strength=-0.5:causal_history/mechanism=recent_sutta_30/strength=-0.5:0.75` | 7→12/15 (+5) | 3→4/7 (+1) | 4→7/10 (+3) |
| open | top5 | Madhur Night | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.5` | 5→8/9 (+3) | — | — |
| open | top5 | Main Bazar | `production` | 7→7/11 (+0) | 4→4/5 (+0) | 2→2/6 (+0) |
| open | top5 | Milan Day | `cross:causal_history/mechanism=overdue_digits_7/strength=0.25:digit_symmetry/transform=rotate1/alpha=0.25:0.25` | 8→10/13 (+2) | 2→2/5 (+0) | 3→2/8 (-1) |
| open | top5 | Milan Night | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=0.75` | 8→9/13 (+1) | 3→1/5 (-2) | 3→5/8 (+2) |
| open | top5 | Rajdhani Day | `cross:causal_history/mechanism=recent_digits_7/strength=1.0:causal_history/mechanism=recent_sutta_30/strength=-0.5:0.75` | 7→11/13 (+4) | 2→2/5 (+0) | 3→5/8 (+2) |
| open | top5 | Rajdhani Night | `refine:digit_symmetry/transform=multiply3/alpha=0.5:base=0.75` | 3→6/11 (+3) | 3→4/5 (+1) | 2→2/6 (+0) |
| open | top5 | Sridevi | `refine:causal_history/mechanism=recent_sutta_30/strength=0.25:base=0.5` | 7→9/15 (+2) | 3→2/7 (-1) | 5→6/10 (+1) |
| open | top5 | Sridevi Night | `refine:probability_mixture/source=joint_evidence/alpha=0.3:base=0.25` | 10→13/15 (+3) | 4→3/6 (-1) | 6→6/10 (+0) |
| open | top5 | Time Bazar | `cross:causal_history/mechanism=overdue_sutta_90/strength=2.0:causal_history/mechanism=recent_sutta_30/strength=-0.5:0.25` | 6→9/13 (+3) | 2→2/6 (+0) | 4→1/8 (-3) |
| open | avoid2 | Kalyan | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:digit_symmetry/transform=mirror5/alpha=0.25:0.75` | 4→9/13 (+5) | 2→3/5 (+1) | 2→3/8 (+1) |
| open | avoid2 | Kalyan Night | `cross:bernoulli_digits/source=blend/strength=-0.5:causal_history/mechanism=recent_digits_30/strength=1.0:0.25` | 5→8/11 (+3) | 4→3/5 (-1) | 5→5/6 (+0) |
| open | avoid2 | Madhur Day | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 5→10/15 (+5) | 5→1/7 (-4) | 8→3/10 (-5) |
| open | avoid2 | Madhur Night | `cross:causal_history/mechanism=overdue_sutta_30/strength=1.0:digit_symmetry/transform=rotate3/alpha=0.5:0.25` | 7→9/9 (+2) | — | — |
| open | avoid2 | Main Bazar | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 2→9/11 (+7) | 2→1/5 (-1) | 3→4/6 (+1) |
| open | avoid2 | Milan Day | `refine:causal_history/mechanism=recent_digits_7/strength=-0.5:base=0.75` | 9→11/13 (+2) | 3→1/5 (-2) | 5→1/8 (-4) |
| open | avoid2 | Milan Night | `refine:digit_symmetry/transform=rotate3/alpha=1.0:base=1.0` | 8→11/13 (+3) | 3→3/5 (+0) | 2→3/8 (+1) |
| open | avoid2 | Rajdhani Day | `refine:causal_history/mechanism=overdue_digits_7/strength=0.5:base=0.75` | 5→10/13 (+5) | 2→3/5 (+1) | 6→4/8 (-2) |
| open | avoid2 | Rajdhani Night | `refine:causal_history/mechanism=recent_digits_30/strength=-1.0:base=0.25` | 7→10/11 (+3) | 3→3/5 (+0) | 2→3/6 (+1) |
| open | avoid2 | Sridevi | `refine:causal_history/mechanism=recent_digits_7/strength=1.0:base=1.0` | 6→9/15 (+3) | 3→1/7 (-2) | 7→8/10 (+1) |
| open | avoid2 | Sridevi Night | `refine:causal_history/mechanism=recent_digits_30/strength=-0.5:base=1.0` | 9→12/15 (+3) | 4→2/6 (-2) | 7→4/10 (-3) |
| open | avoid2 | Time Bazar | `refine:causal_history/mechanism=recent_digits_30/strength=-1.0:base=1.0` | 7→12/13 (+5) | 1→3/6 (+2) | 5→3/8 (-2) |
| open | panel10 | Kalyan | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:0.75` | 1→3/13 (+2) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | panel10 | Kalyan Night | `refine:causal_history/mechanism=overdue_digits_7/strength=0.25:base=1.0` | 1→3/11 (+2) | 0→0/5 (+0) | 1→0/6 (-1) |
| open | panel10 | Madhur Day | `refine:digit_symmetry/transform=rotate3/alpha=0.5:base=1.0` | 0→1/15 (+1) | 0→0/7 (+0) | 0→1/10 (+1) |
| open | panel10 | Madhur Night | `production` | 2→2/9 (+0) | — | — |
| open | panel10 | Main Bazar | `refine:causal_history/mechanism=overdue_digits_7/strength=0.5:base=1.0` | 0→2/11 (+2) | 1→1/5 (+0) | 0→0/6 (+0) |
| open | panel10 | Milan Day | `cross:digit_symmetry/transform=multiply3/alpha=0.5:digit_symmetry/transform=rotate3/alpha=0.25:0.5` | 2→3/13 (+1) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | panel10 | Milan Night | `refine:digit_symmetry/transform=rotate1/alpha=0.25:base=0.75` | 3→5/13 (+2) | 0→0/5 (+0) | 1→0/8 (-1) |
| open | panel10 | Rajdhani Day | `cross:causal_history/mechanism=recent_digits_90/strength=0.5:causal_history/mechanism=recent_sutta_90/strength=-0.5:0.5` | 2→3/13 (+1) | 0→0/5 (+0) | 0→1/8 (+1) |
| open | panel10 | Rajdhani Night | `refine:causal_history/mechanism=overdue_digits_7/strength=0.25:base=0.5` | 1→3/11 (+2) | 2→2/5 (+0) | 0→0/6 (+0) |
| open | panel10 | Sridevi | `production` | 1→1/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) |
| open | panel10 | Sridevi Night | `refine:causal_history/mechanism=recent_sutta_30/strength=0.25:base=0.25` | 4→5/15 (+1) | 0→0/6 (+0) | 1→1/10 (+0) |
| open | panel10 | Time Bazar | `refine:causal_history/mechanism=recent_digits_7/strength=1.0:base=0.25` | 1→2/13 (+1) | 0→0/6 (+0) | 0→0/8 (+0) |
| open | sp30 | Kalyan | `refine:causal_history/mechanism=recent_digits_30/strength=-1.0:base=0.5` | 2→5/12 (+3) | 0→0/3 (+0) | 3→3/7 (+0) |
| open | sp30 | Kalyan Night | `production` | 4→4/9 (+0) | 0→0/2 (+0) | 4→4/6 (+0) |
| open | sp30 | Madhur Day | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=1.0` | 2→7/11 (+5) | 0→1/6 (+1) | 3→0/6 (-3) |
| open | sp30 | Madhur Night | `production` | 3→3/5 (+0) | — | — |
| open | sp30 | Main Bazar | `production` | 0→0/9 (+0) | 1→1/5 (+0) | 0→0/4 (+0) |
| open | sp30 | Milan Day | `production` | 3→3/9 (+0) | 0→0/2 (+0) | 1→1/7 (+0) |
| open | sp30 | Milan Night | `refine:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:base=1.0` | 6→8/12 (+2) | 0→0/5 (+0) | 2→2/6 (+0) |
| open | sp30 | Rajdhani Day | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.5` | 1→4/8 (+3) | 1→1/5 (+0) | 1→2/6 (+1) |
| open | sp30 | Rajdhani Night | `production` | 4→4/8 (+0) | 2→2/5 (+0) | 0→0/5 (+0) |
| open | sp30 | Sridevi | `refine:causal_history/mechanism=overdue_sutta_90/strength=2.0:base=0.5` | 2→5/13 (+3) | 0→1/6 (+1) | 3→2/8 (-1) |
| open | sp30 | Sridevi Night | `production` | 7→7/12 (+0) | 1→1/4 (+0) | 1→1/6 (+0) |
| open | sp30 | Time Bazar | `production` | 2→2/7 (+0) | 1→1/3 (+0) | 0→0/3 (+0) |
| open | dp20 | Kalyan | `production` | 0→0/1 (+0) | 0→0/2 (+0) | 0→0/1 (+0) |
| open | dp20 | Kalyan Night | `production` | 1→1/2 (+0) | 1→1/3 (+0) | — |
| open | dp20 | Madhur Day | `production` | 1→1/4 (+0) | 0→0/1 (+0) | 2→2/4 (+0) |
| open | dp20 | Madhur Night | `production` | 0→0/4 (+0) | — | — |
| open | dp20 | Main Bazar | `production` | 1→1/2 (+0) | — | 1→1/2 (+0) |
| open | dp20 | Milan Day | `production` | 0→0/4 (+0) | 2→2/3 (+0) | 0→0/1 (+0) |
| open | dp20 | Milan Night | `production` | 0→0/1 (+0) | — | 1→1/2 (+0) |
| open | dp20 | Rajdhani Day | `production` | 0→0/5 (+0) | — | 1→1/2 (+0) |
| open | dp20 | Rajdhani Night | `production` | 1→1/3 (+0) | — | 0→0/1 (+0) |
| open | dp20 | Sridevi | `production` | 1→1/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| open | dp20 | Sridevi Night | `production` | 1→1/3 (+0) | 1→1/2 (+0) | 0→0/4 (+0) |
| open | dp20 | Time Bazar | `production` | 2→2/6 (+0) | 0→0/3 (+0) | 0→0/5 (+0) |
| open | sutta_avoid | Kalyan | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:0.25` | 3→8/13 (+5) | 1→1/5 (+0) | 0→1/8 (+1) |
| open | sutta_avoid | Kalyan Night | `refine:causal_history/mechanism=recent_digits_30/strength=1.0:base=1.0` | 2→5/11 (+3) | 2→2/5 (+0) | 4→3/6 (-1) |
| open | sutta_avoid | Madhur Day | `refine:causal_history/mechanism=recent_digits_30/strength=-0.5:base=1.0` | 2→5/15 (+3) | 2→1/7 (-1) | 3→1/10 (-2) |
| open | sutta_avoid | Madhur Night | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.5` | 4→6/9 (+2) | — | — |
| open | sutta_avoid | Main Bazar | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=0.75` | 2→5/11 (+3) | 2→2/5 (+0) | 1→1/6 (+0) |
| open | sutta_avoid | Milan Day | `production` | 6→6/13 (+0) | 1→1/5 (+0) | 2→2/8 (+0) |
| open | sutta_avoid | Milan Night | `refine:bernoulli_digits/source=blend/strength=1.0:base=0.25` | 5→7/13 (+2) | 1→1/5 (+0) | 0→1/8 (+1) |
| open | sutta_avoid | Rajdhani Day | `cross:bernoulli_digits/source=blend/strength=1.0:sutta_marginal/source=native/strength=-0.5:0.25` | 2→7/13 (+5) | 1→1/5 (+0) | 2→3/8 (+1) |
| open | sutta_avoid | Rajdhani Night | `cross:digit_symmetry/transform=multiply3/alpha=0.5:digit_symmetry/transform=rotate3/alpha=0.25:0.5` | 1→4/11 (+3) | 1→2/5 (+1) | 1→0/6 (-1) |
| open | sutta_avoid | Sridevi | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=0.5` | 3→5/15 (+2) | 2→1/7 (-1) | 3→2/10 (-1) |
| open | sutta_avoid | Sridevi Night | `cross:causal_history/mechanism=overdue_digits_7/strength=0.25:joint_likelihood/sutta=panel/digits=blend/strength=1.5:0.5` | 7→8/15 (+1) | 3→1/6 (-2) | 4→3/10 (-1) |
| open | sutta_avoid | Time Bazar | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:digit_symmetry/transform=mirror5/alpha=0.25:0.25` | 2→7/13 (+5) | 0→1/6 (+1) | 3→4/8 (+1) |
| open | joint10 | Kalyan | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:source_fusion/source=dp20/alpha=0.65/mode=arithmetic:0.75` | 1→3/13 (+2) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | joint10 | Kalyan Night | `cross:causal_history/mechanism=overdue_digits_7/strength=0.25:joint_likelihood/sutta=panel/digits=blend/strength=1.5:0.75` | 1→3/11 (+2) | 0→0/5 (+0) | 1→0/6 (-1) |
| open | joint10 | Madhur Day | `refine:avoid2_gate/source=native_avoid/penalty=0.65:base=0.25` | 0→1/15 (+1) | 0→0/7 (+0) | 0→1/10 (+1) |
| open | joint10 | Madhur Night | `production` | 2→2/9 (+0) | — | — |
| open | joint10 | Main Bazar | `refine:causal_history/mechanism=recent_digits_30/strength=-0.5:base=1.0` | 0→2/11 (+2) | 1→0/5 (-1) | 0→0/6 (+0) |
| open | joint10 | Milan Day | `production` | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | joint10 | Milan Night | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=0.25` | 3→4/13 (+1) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | joint10 | Rajdhani Day | `production` | 0→0/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) |
| open | joint10 | Rajdhani Night | `refine:causal_history/mechanism=overdue_digits_7/strength=-0.5:base=0.75` | 0→1/11 (+1) | 1→0/5 (-1) | 0→0/6 (+0) |
| open | joint10 | Sridevi | `production` | 1→1/15 (+0) | 0→0/7 (+0) | 0→0/10 (+0) |
| open | joint10 | Sridevi Night | `production` | 4→4/15 (+0) | 0→0/6 (+0) | 1→1/10 (+0) |
| open | joint10 | Time Bazar | `production` | 0→0/13 (+0) | 0→0/6 (+0) | 0→0/8 (+0) |
| open | joint_sp30 | Kalyan | `cross:causal_history/mechanism=recent_digits_30/strength=-0.5:digit_symmetry/transform=mirror5/alpha=0.25:0.75` | 1→4/12 (+3) | 0→0/3 (+0) | 0→2/7 (+2) |
| open | joint_sp30 | Kalyan Night | `production` | 2→2/9 (+0) | 0→0/2 (+0) | 3→3/6 (+0) |
| open | joint_sp30 | Madhur Day | `refine:causal_history/mechanism=recent_digits_30/strength=-0.5:base=1.0` | 2→3/11 (+1) | 0→1/6 (+1) | 1→0/6 (-1) |
| open | joint_sp30 | Madhur Night | `production` | 3→3/5 (+0) | — | — |
| open | joint_sp30 | Main Bazar | `production` | 0→0/9 (+0) | 1→1/5 (+0) | 0→0/4 (+0) |
| open | joint_sp30 | Milan Day | `production` | 3→3/9 (+0) | 0→0/2 (+0) | 0→0/7 (+0) |
| open | joint_sp30 | Milan Night | `production` | 5→5/12 (+0) | 0→0/5 (+0) | 0→0/6 (+0) |
| open | joint_sp30 | Rajdhani Day | `cross:causal_history/mechanism=recent_digits_7/strength=1.0:causal_history/mechanism=recent_sutta_30/strength=-0.5:0.5` | 0→2/8 (+2) | 1→0/5 (-1) | 1→2/6 (+1) |
| open | joint_sp30 | Rajdhani Night | `production` | 0→0/8 (+0) | 1→1/5 (+0) | 0→0/5 (+0) |
| open | joint_sp30 | Sridevi | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=0.5` | 1→3/13 (+2) | 0→0/6 (+0) | 1→0/8 (-1) |
| open | joint_sp30 | Sridevi Night | `production` | 4→4/12 (+0) | 1→1/4 (+0) | 1→1/6 (+0) |
| open | joint_sp30 | Time Bazar | `production` | 0→0/7 (+0) | 0→0/3 (+0) | 0→0/3 (+0) |
| open | joint_dp20 | Kalyan | `production` | 0→0/1 (+0) | 0→0/2 (+0) | 0→0/1 (+0) |
| open | joint_dp20 | Kalyan Night | `production` | 0→0/2 (+0) | 0→0/3 (+0) | — |
| open | joint_dp20 | Madhur Day | `production` | 0→0/4 (+0) | 0→0/1 (+0) | 0→0/4 (+0) |
| open | joint_dp20 | Madhur Night | `production` | 0→0/4 (+0) | — | — |
| open | joint_dp20 | Main Bazar | `production` | 1→1/2 (+0) | — | 1→1/2 (+0) |
| open | joint_dp20 | Milan Day | `production` | 0→0/4 (+0) | 0→0/3 (+0) | 0→0/1 (+0) |
| open | joint_dp20 | Milan Night | `production` | 0→0/1 (+0) | — | 0→0/2 (+0) |
| open | joint_dp20 | Rajdhani Day | `production` | 0→0/5 (+0) | — | 0→0/2 (+0) |
| open | joint_dp20 | Rajdhani Night | `production` | 0→0/3 (+0) | — | 0→0/1 (+0) |
| open | joint_dp20 | Sridevi | `production` | 1→1/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| open | joint_dp20 | Sridevi Night | `production` | 1→1/3 (+0) | 0→0/2 (+0) | 0→0/4 (+0) |
| open | joint_dp20 | Time Bazar | `production` | 0→0/6 (+0) | 0→0/3 (+0) | 0→0/5 (+0) |
| close_pre | top5 | Kalyan | `cross:digit_symmetry/transform=rotate1/alpha=1.0:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:0.75` | 5→11/13 (+6) | 2→3/5 (+1) | 5→5/8 (+0) |
| close_pre | top5 | Kalyan Night | `cross:avoid2_gate/source=native_avoid/penalty=12.0:causal_history/mechanism=last_sutta/strength=0.5:0.75` | 5→8/11 (+3) | 3→4/5 (+1) | 3→2/6 (-1) |
| close_pre | top5 | Madhur Day | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 8→10/15 (+2) | 2→2/7 (+0) | 6→7/10 (+1) |
| close_pre | top5 | Madhur Night | `refine:sutta_marginal/source=panel/strength=2.0:base=1.0` | 3→7/9 (+4) | — | — |
| close_pre | top5 | Main Bazar | `refine:sutta_marginal/source=panel/strength=2.0:base=1.0` | 5→10/11 (+5) | 4→4/5 (+0) | 4→6/6 (+2) |
| close_pre | top5 | Milan Day | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 7→10/13 (+3) | 3→2/5 (-1) | 6→6/8 (+0) |
| close_pre | top5 | Milan Night | `refine:causal_history/mechanism=last_digits/strength=2.0:base=1.0` | 7→9/13 (+2) | 2→3/5 (+1) | 4→4/8 (+0) |
| close_pre | top5 | Rajdhani Day | `cross:causal_history/mechanism=overdue_digits_7/strength=0.5:digit_symmetry/transform=rotate1/alpha=1.0:0.5` | 7→10/13 (+3) | 3→2/5 (-1) | 4→4/8 (+0) |
| close_pre | top5 | Rajdhani Night | `refine:causal_history/mechanism=recent_digits_7/strength=2.0:base=0.5` | 2→7/11 (+5) | 2→4/5 (+2) | 2→1/6 (-1) |
| close_pre | top5 | Sridevi | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.5` | 6→11/15 (+5) | 3→3/7 (+0) | 4→3/10 (-1) |
| close_pre | top5 | Sridevi Night | `cross:causal_history/mechanism=last_digits/strength=1.0:joint_ipf/sutta=native/digits=appearance/damping=1.0/passes=1:0.5` | 7→9/15 (+2) | 3→6/6 (+3) | 3→5/10 (+2) |
| close_pre | top5 | Time Bazar | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.75` | 7→10/13 (+3) | 2→3/6 (+1) | 4→5/8 (+1) |
| close_pre | avoid2 | Kalyan | `refine:digit_symmetry/transform=mirror5/alpha=1.0:base=1.0` | 3→10/13 (+7) | 5→1/5 (-4) | 4→2/8 (-2) |
| close_pre | avoid2 | Kalyan Night | `refine:causal_history/mechanism=recent_digits_7/strength=1.0:base=0.75` | 3→7/11 (+4) | 4→4/5 (+0) | 2→2/6 (+0) |
| close_pre | avoid2 | Madhur Day | `refine:digit_symmetry/transform=multiply3/alpha=1.0:base=1.0` | 6→10/15 (+4) | 4→5/7 (+1) | 6→5/10 (-1) |
| close_pre | avoid2 | Madhur Night | `cross:causal_history/mechanism=last_digits/strength=-0.5:digit_symmetry/transform=multiply3/alpha=1.0:0.25` | 4→8/9 (+4) | — | — |
| close_pre | avoid2 | Main Bazar | `cross:causal_history/mechanism=overdue_sutta_30/strength=2.0:joint_ipf/sutta=native/digits=appearance/damping=0.75/passes=1:0.25` | 7→8/11 (+1) | 4→4/5 (+0) | 2→2/6 (+0) |
| close_pre | avoid2 | Milan Day | `refine:joint_ipf/sutta=native/digits=appearance/damping=0.75/passes=1:base=1.0` | 9→11/13 (+2) | 3→3/5 (+0) | 4→4/8 (+0) |
| close_pre | avoid2 | Milan Night | `cross:digit_symmetry/transform=complement9/alpha=0.75:source_fusion/source=all10/alpha=0.35/mode=arithmetic:0.75` | 7→10/13 (+3) | 3→2/5 (-1) | 4→4/8 (+0) |
| close_pre | avoid2 | Rajdhani Day | `cross:causal_history/mechanism=last_digits/strength=1.0:joint_ipf/sutta=native/digits=appearance/damping=1.0/passes=1:0.75` | 7→10/13 (+3) | 3→4/5 (+1) | 5→4/8 (-1) |
| close_pre | avoid2 | Rajdhani Night | `refine:causal_history/mechanism=recent_digits_90/strength=-0.5:base=0.75` | 8→11/11 (+3) | 3→3/5 (+0) | 0→1/6 (+1) |
| close_pre | avoid2 | Sridevi | `refine:digit_symmetry/transform=complement9/alpha=0.75:base=1.0` | 6→14/15 (+8) | 5→3/7 (-2) | 4→6/10 (+2) |
| close_pre | avoid2 | Sridevi Night | `cross:causal_history/mechanism=last_sutta/strength=2.0:probability_mixture/source=uniform_sutta/alpha=1.0:0.25` | 11→12/15 (+1) | 3→4/6 (+1) | 6→6/10 (+0) |
| close_pre | avoid2 | Time Bazar | `refine:joint_likelihood/sutta=native/digits=present/strength=1.5:base=1.0` | 6→10/13 (+4) | 0→4/6 (+4) | 6→4/8 (-2) |
| close_pre | panel10 | Kalyan | `refine:digit_symmetry/transform=mirror5/alpha=1.0:base=1.0` | 0→2/13 (+2) | 0→0/5 (+0) | 1→2/8 (+1) |
| close_pre | panel10 | Kalyan Night | `production` | 1→1/11 (+0) | 1→1/5 (+0) | 1→1/6 (+0) |
| close_pre | panel10 | Madhur Day | `production` | 0→0/15 (+0) | 1→1/7 (+0) | 2→2/10 (+0) |
| close_pre | panel10 | Madhur Night | `refine:joint_gates/sutta=native/avoid=native_avoid/sutta_penalty=3.0/avoid_penalty=3.0:base=0.5` | 0→2/9 (+2) | — | — |
| close_pre | panel10 | Main Bazar | `refine:causal_history/mechanism=last_digits/strength=1.0:base=0.5` | 2→3/11 (+1) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_pre | panel10 | Milan Day | `cross:bernoulli_digits/source=appearance/strength=2.0:digit_symmetry/transform=mirror5/alpha=1.0:0.5` | 0→2/13 (+2) | 0→1/5 (+1) | 1→0/8 (-1) |
| close_pre | panel10 | Milan Night | `cross:causal_history/mechanism=overdue_sutta_30/strength=2.0:causal_history/mechanism=recent_digits_30/strength=-1.0:0.5` | 0→2/13 (+2) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_pre | panel10 | Rajdhani Day | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.75` | 3→4/13 (+1) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_pre | panel10 | Rajdhani Night | `refine:causal_history/mechanism=last_digits/strength=-0.5:base=0.25` | 1→2/11 (+1) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_pre | panel10 | Sridevi | `refine:causal_history/mechanism=last_digits/strength=0.25:base=0.75` | 2→3/15 (+1) | 1→0/7 (-1) | 0→0/10 (+0) |
| close_pre | panel10 | Sridevi Night | `cross:avoid2_gate/source=native_avoid/penalty=12.0:causal_history/mechanism=last_sutta/strength=0.5:0.25` | 0→3/15 (+3) | 1→2/6 (+1) | 0→0/10 (+0) |
| close_pre | panel10 | Time Bazar | `refine:causal_history/mechanism=recent_digits_7/strength=1.0:base=0.75` | 2→5/13 (+3) | 0→1/6 (+1) | 0→0/8 (+0) |
| close_pre | sp30 | Kalyan | `production` | 1→1/9 (+0) | 1→1/4 (+0) | 2→2/7 (+0) |
| close_pre | sp30 | Kalyan Night | `production` | 2→2/9 (+0) | 1→1/4 (+0) | 1→1/5 (+0) |
| close_pre | sp30 | Madhur Day | `cross:causal_history/mechanism=last_digits/strength=1.0:digit_symmetry/transform=multiply3/alpha=1.0:0.25` | 0→5/11 (+5) | 2→1/5 (-1) | 4→3/8 (-1) |
| close_pre | sp30 | Madhur Night | `production` | 1→1/8 (+0) | — | — |
| close_pre | sp30 | Main Bazar | `production` | 4→4/7 (+0) | 1→1/4 (+0) | 1→1/6 (+0) |
| close_pre | sp30 | Milan Day | `production` | 1→1/5 (+0) | — | 1→1/4 (+0) |
| close_pre | sp30 | Milan Night | `refine:digit_symmetry/transform=rotate3/alpha=1.0:base=1.0` | 1→3/8 (+2) | 1→1/4 (+0) | 1→2/6 (+1) |
| close_pre | sp30 | Rajdhani Day | `production` | 5→5/11 (+0) | 2→2/4 (+0) | 0→0/6 (+0) |
| close_pre | sp30 | Rajdhani Night | `refine:digit_symmetry/transform=rotate1/alpha=0.5:base=1.0` | 2→4/9 (+2) | 0→1/4 (+1) | 1→0/4 (-1) |
| close_pre | sp30 | Sridevi | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 3→7/12 (+4) | 2→3/6 (+1) | 2→2/8 (+0) |
| close_pre | sp30 | Sridevi Night | `cross:causal_history/mechanism=last_digits/strength=1.0:joint_ipf/sutta=native/digits=appearance/damping=1.0/passes=1:0.5` | 3→5/10 (+2) | 1→2/6 (+1) | 1→2/8 (+1) |
| close_pre | sp30 | Time Bazar | `refine:causal_history/mechanism=last_digits/strength=0.25:base=0.25` | 5→6/12 (+1) | 2→2/5 (+0) | 0→0/4 (+0) |
| close_pre | dp20 | Kalyan | `production` | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) |
| close_pre | dp20 | Kalyan Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) |
| close_pre | dp20 | Madhur Day | `production` | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) |
| close_pre | dp20 | Madhur Night | `production` | 0→0/1 (+0) | — | — |
| close_pre | dp20 | Main Bazar | `production` | 0→0/4 (+0) | 0→0/1 (+0) | — |
| close_pre | dp20 | Milan Day | `production` | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) |
| close_pre | dp20 | Milan Night | `production` | 1→1/5 (+0) | 0→0/1 (+0) | 1→1/2 (+0) |
| close_pre | dp20 | Rajdhani Day | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_pre | dp20 | Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_pre | dp20 | Sridevi | `production` | 2→2/3 (+0) | — | 1→1/2 (+0) |
| close_pre | dp20 | Sridevi Night | `production` | 3→3/5 (+0) | — | 0→0/2 (+0) |
| close_pre | dp20 | Time Bazar | `production` | 1→1/1 (+0) | 1→1/1 (+0) | 1→1/4 (+0) |
| close_pre | sutta_avoid | Kalyan | `refine:digit_symmetry/transform=rotate1/alpha=1.0:base=1.0` | 2→7/13 (+5) | 2→2/5 (+0) | 2→2/8 (+0) |
| close_pre | sutta_avoid | Kalyan Night | `refine:digit_symmetry/transform=complement9/alpha=0.75:base=0.75` | 2→5/11 (+3) | 3→1/5 (-2) | 1→1/6 (+0) |
| close_pre | sutta_avoid | Madhur Day | `refine:causal_history/mechanism=last_sutta/strength=0.25:base=0.25` | 5→6/15 (+1) | 1→0/7 (-1) | 4→3/10 (-1) |
| close_pre | sutta_avoid | Madhur Night | `cross:digit_symmetry/transform=rotate3/alpha=0.75:joint_gates/sutta=native/avoid=panel_avoid/sutta_penalty=0.35/avoid_penalty=3.0:0.75` | 1→5/9 (+4) | — | — |
| close_pre | sutta_avoid | Main Bazar | `cross:causal_history/mechanism=overdue_sutta_30/strength=2.0:joint_ipf/sutta=native/digits=appearance/damping=0.75/passes=1:0.25` | 3→7/11 (+4) | 3→2/5 (-1) | 2→1/6 (-1) |
| close_pre | sutta_avoid | Milan Day | `refine:digit_symmetry/transform=mirror5/alpha=0.75:base=0.75` | 5→7/13 (+2) | 2→0/5 (-2) | 4→3/8 (-1) |
| close_pre | sutta_avoid | Milan Night | `refine:causal_history/mechanism=last_digits/strength=0.5:base=1.0` | 5→6/13 (+1) | 2→1/5 (-1) | 2→0/8 (-2) |
| close_pre | sutta_avoid | Rajdhani Day | `cross:causal_history/mechanism=last_digits/strength=-0.5:digit_symmetry/transform=multiply3/alpha=1.0:0.5` | 6→7/13 (+1) | 1→1/5 (+0) | 3→2/8 (-1) |
| close_pre | sutta_avoid | Rajdhani Night | `cross:causal_history/mechanism=recent_digits_90/strength=-0.5:joint_ipf/sutta=conditional/digits=present/damping=0.75/passes=1:0.5` | 1→4/11 (+3) | 1→1/5 (+0) | 0→0/6 (+0) |
| close_pre | sutta_avoid | Sridevi | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=0.75` | 1→7/15 (+6) | 2→4/7 (+2) | 2→1/10 (-1) |
| close_pre | sutta_avoid | Sridevi Night | `cross:causal_history/mechanism=overdue_sutta_7/strength=-0.5:joint_gates/sutta=native/avoid=panel_avoid/sutta_penalty=0.35/avoid_penalty=3.0:0.25` | 6→7/15 (+1) | 2→2/6 (+0) | 2→3/10 (+1) |
| close_pre | sutta_avoid | Time Bazar | `refine:causal_history/mechanism=recent_sutta_90/strength=-0.5:base=1.0` | 5→7/13 (+2) | 0→2/6 (+2) | 3→3/8 (+0) |
| close_pre | joint10 | Kalyan | `refine:digit_symmetry/transform=mirror5/alpha=1.0:base=1.0` | 0→2/13 (+2) | 0→0/5 (+0) | 1→2/8 (+1) |
| close_pre | joint10 | Kalyan Night | `production` | 1→1/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) |
| close_pre | joint10 | Madhur Day | `production` | 0→0/15 (+0) | 0→0/7 (+0) | 1→1/10 (+0) |
| close_pre | joint10 | Madhur Night | `production` | 0→0/9 (+0) | — | — |
| close_pre | joint10 | Main Bazar | `refine:causal_history/mechanism=last_sutta/strength=0.5:base=0.25` | 1→3/11 (+2) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_pre | joint10 | Milan Day | `production` | 0→0/13 (+0) | 0→0/5 (+0) | 1→1/8 (+0) |
| close_pre | joint10 | Milan Night | `refine:digit_symmetry/transform=complement9/alpha=0.75:base=0.5` | 0→1/13 (+1) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_pre | joint10 | Rajdhani Day | `production` | 2→2/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_pre | joint10 | Rajdhani Night | `production` | 1→1/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_pre | joint10 | Sridevi | `refine:causal_history/mechanism=last_digits/strength=2.0:base=0.25` | 0→2/15 (+2) | 0→0/7 (+0) | 0→0/10 (+0) |
| close_pre | joint10 | Sridevi Night | `refine:avoid2_gate/source=panel_avoid/penalty=12.0:base=0.5` | 0→2/15 (+2) | 1→0/6 (-1) | 0→1/10 (+1) |
| close_pre | joint10 | Time Bazar | `refine:causal_history/mechanism=last_digits/strength=2.0:base=1.0` | 2→4/13 (+2) | 0→0/6 (+0) | 0→0/8 (+0) |
| close_pre | joint_sp30 | Kalyan | `production` | 0→0/9 (+0) | 1→1/4 (+0) | 1→1/7 (+0) |
| close_pre | joint_sp30 | Kalyan Night | `production` | 1→1/9 (+0) | 1→1/4 (+0) | 0→0/5 (+0) |
| close_pre | joint_sp30 | Madhur Day | `refine:joint_gates/sutta=panel/avoid=panel_avoid/sutta_penalty=12.0/avoid_penalty=12.0:base=1.0` | 0→4/11 (+4) | 1→1/5 (+0) | 1→3/8 (+2) |
| close_pre | joint_sp30 | Madhur Night | `production` | 1→1/8 (+0) | — | — |
| close_pre | joint_sp30 | Main Bazar | `production` | 1→1/7 (+0) | 1→1/4 (+0) | 0→0/6 (+0) |
| close_pre | joint_sp30 | Milan Day | `production` | 1→1/5 (+0) | — | 1→1/4 (+0) |
| close_pre | joint_sp30 | Milan Night | `refine:joint_gates/sutta=panel/avoid=panel_avoid/sutta_penalty=12.0/avoid_penalty=12.0:base=1.0` | 1→3/8 (+2) | 0→2/4 (+2) | 0→2/6 (+2) |
| close_pre | joint_sp30 | Rajdhani Day | `production` | 3→3/11 (+0) | 0→0/4 (+0) | 0→0/6 (+0) |
| close_pre | joint_sp30 | Rajdhani Night | `refine:digit_symmetry/transform=rotate1/alpha=0.5:base=1.0` | 1→2/9 (+1) | 0→1/4 (+1) | 0→0/4 (+0) |
| close_pre | joint_sp30 | Sridevi | `refine:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=3.0/avoid_penalty=12.0:base=1.0` | 0→3/12 (+3) | 1→2/6 (+1) | 2→1/8 (-1) |
| close_pre | joint_sp30 | Sridevi Night | `production` | 2→2/10 (+0) | 1→1/6 (+0) | 0→0/8 (+0) |
| close_pre | joint_sp30 | Time Bazar | `refine:causal_history/mechanism=last_digits/strength=2.0:base=1.0` | 4→5/12 (+1) | 0→0/5 (+0) | 0→0/4 (+0) |
| close_pre | joint_dp20 | Kalyan | `production` | 0→0/4 (+0) | 0→0/1 (+0) | 1→1/1 (+0) |
| close_pre | joint_dp20 | Kalyan Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) |
| close_pre | joint_dp20 | Madhur Day | `production` | 1→1/4 (+0) | 0→0/2 (+0) | 0→0/1 (+0) |
| close_pre | joint_dp20 | Madhur Night | `production` | 0→0/1 (+0) | — | — |
| close_pre | joint_dp20 | Main Bazar | `production` | 0→0/4 (+0) | 0→0/1 (+0) | — |
| close_pre | joint_dp20 | Milan Day | `production` | 1→1/8 (+0) | 1→1/5 (+0) | 0→0/4 (+0) |
| close_pre | joint_dp20 | Milan Night | `production` | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_pre | joint_dp20 | Rajdhani Day | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_pre | joint_dp20 | Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_pre | joint_dp20 | Sridevi | `production` | 0→0/3 (+0) | — | 0→0/2 (+0) |
| close_pre | joint_dp20 | Sridevi Night | `production` | 0→0/5 (+0) | — | 0→0/2 (+0) |
| close_pre | joint_dp20 | Time Bazar | `production` | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) |
| close_known | top5 | Kalyan | `refine:joint_likelihood/sutta=panel/digits=present/strength=1.5:base=1.0` | 6→10/13 (+4) | 2→3/5 (+1) | 5→5/8 (+0) |
| close_known | top5 | Kalyan Night | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=1.0` | 7→8/11 (+1) | 3→2/5 (-1) | 1→3/6 (+2) |
| close_known | top5 | Madhur Day | `refine:causal_history/mechanism=recent_digits_90/strength=-1.0:base=1.0` | 9→11/15 (+2) | 3→3/7 (+0) | 5→6/10 (+1) |
| close_known | top5 | Madhur Night | `refine:digit_symmetry/transform=rotate3/alpha=0.75:base=1.0` | 4→8/9 (+4) | — | — |
| close_known | top5 | Main Bazar | `refine:avoid2_gate/source=native_avoid/penalty=3.0:base=0.75` | 6→8/11 (+2) | 1→1/5 (+0) | 3→3/6 (+0) |
| close_known | top5 | Milan Day | `refine:digit_symmetry/transform=multiply3/alpha=1.0:base=1.0` | 4→9/13 (+5) | 4→3/5 (-1) | 6→5/8 (-1) |
| close_known | top5 | Milan Night | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 8→10/13 (+2) | 3→3/5 (+0) | 7→7/8 (+0) |
| close_known | top5 | Rajdhani Day | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 8→9/13 (+1) | 5→5/5 (+0) | 1→1/8 (+0) |
| close_known | top5 | Rajdhani Night | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=1.0` | 7→9/11 (+2) | 5→5/5 (+0) | 2→2/6 (+0) |
| close_known | top5 | Sridevi | `refine:digit_symmetry/transform=multiply3/alpha=1.0:base=0.75` | 9→11/15 (+2) | 3→4/7 (+1) | 5→3/10 (-2) |
| close_known | top5 | Sridevi Night | `refine:digit_symmetry/transform=rotate3/alpha=0.75:base=0.75` | 6→9/15 (+3) | 3→6/6 (+3) | 5→5/10 (+0) |
| close_known | top5 | Time Bazar | `cross:causal_history/mechanism=overdue_sutta_7/strength=0.5:joint_ipf/sutta=conditional/digits=present/damping=0.75/passes=1:0.25` | 6→9/13 (+3) | 4→5/6 (+1) | 4→2/8 (-2) |
| close_known | avoid2 | Kalyan | `refine:digit_symmetry/transform=multiply3/alpha=1.0:base=1.0` | 10→12/13 (+2) | 3→1/5 (-2) | 3→3/8 (+0) |
| close_known | avoid2 | Kalyan Night | `refine:causal_history/mechanism=overdue_digits_7/strength=-1.0:base=0.25` | 4→8/11 (+4) | 3→3/5 (+0) | 3→2/6 (-1) |
| close_known | avoid2 | Madhur Day | `refine:causal_history/mechanism=overdue_sutta_30/strength=0.25:base=0.5` | 8→9/15 (+1) | 4→4/7 (+0) | 6→5/10 (-1) |
| close_known | avoid2 | Madhur Night | `refine:joint_likelihood/sutta=conditional/digits=blend/strength=0.75:base=1.0` | 5→8/9 (+3) | — | — |
| close_known | avoid2 | Main Bazar | `cross:bernoulli_digits/source=present/strength=-1.0:causal_history/mechanism=overdue_digits_7/strength=0.5:0.5` | 5→8/11 (+3) | 3→2/5 (-1) | 3→3/6 (+0) |
| close_known | avoid2 | Milan Day | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.5` | 8→11/13 (+3) | 3→3/5 (+0) | 4→2/8 (-2) |
| close_known | avoid2 | Milan Night | `refine:joint_likelihood/sutta=panel/digits=appearance/strength=1.5:base=0.5` | 6→10/13 (+4) | 4→4/5 (+0) | 4→3/8 (-1) |
| close_known | avoid2 | Rajdhani Day | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.5` | 7→11/13 (+4) | 3→3/5 (+0) | 2→3/8 (+1) |
| close_known | avoid2 | Rajdhani Night | `cross:causal_history/mechanism=recent_digits_90/strength=-1.0:joint_ipf/sutta=conditional/digits=present/damping=0.35/passes=1:0.25` | 5→8/11 (+3) | 2→3/5 (+1) | 5→5/6 (+0) |
| close_known | avoid2 | Sridevi | `refine:causal_history/mechanism=overdue_digits_7/strength=-1.0:base=0.5` | 8→12/15 (+4) | 4→5/7 (+1) | 5→5/10 (+0) |
| close_known | avoid2 | Sridevi Night | `refine:causal_history/mechanism=recent_digits_90/strength=0.5:base=0.75` | 10→11/15 (+1) | 1→4/6 (+3) | 7→4/10 (-3) |
| close_known | avoid2 | Time Bazar | `cross:digit_symmetry/transform=multiply3/alpha=1.0:source_fusion/source=all10/alpha=0.65/mode=arithmetic:0.25` | 7→10/13 (+3) | 5→2/6 (-3) | 7→5/8 (-2) |
| close_known | panel10 | Kalyan | `refine:bernoulli_digits/source=appearance/strength=-1.0:base=0.25` | 0→2/13 (+2) | 0→0/5 (+0) | 2→1/8 (-1) |
| close_known | panel10 | Kalyan Night | `cross:digit_symmetry/transform=multiply3/alpha=0.25:top5_sutta_gate/source=sutta_conditional/penalty=0.15:0.25` | 0→2/11 (+2) | 0→1/5 (+1) | 0→0/6 (+0) |
| close_known | panel10 | Madhur Day | `refine:digit_symmetry/transform=rotate1/alpha=0.75:base=0.5` | 1→3/15 (+2) | 0→0/7 (+0) | 1→0/10 (-1) |
| close_known | panel10 | Madhur Night | `refine:causal_history/mechanism=last_digits/strength=0.5:base=0.25` | 0→1/9 (+1) | — | — |
| close_known | panel10 | Main Bazar | `refine:bernoulli_digits/source=present/strength=1.0:base=0.75` | 1→3/11 (+2) | 1→0/5 (-1) | 1→0/6 (-1) |
| close_known | panel10 | Milan Day | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.75` | 0→1/13 (+1) | 0→0/5 (+0) | 1→1/8 (+0) |
| close_known | panel10 | Milan Night | `refine:avoid2_gate/source=native_avoid/penalty=0.15:base=0.75` | 2→3/13 (+1) | 0→1/5 (+1) | 1→0/8 (-1) |
| close_known | panel10 | Rajdhani Day | `production` | 0→0/13 (+0) | 2→2/5 (+0) | 1→1/8 (+0) |
| close_known | panel10 | Rajdhani Night | `production` | 0→0/11 (+0) | 1→1/5 (+0) | 0→0/6 (+0) |
| close_known | panel10 | Sridevi | `refine:joint_likelihood/sutta=conditional/digits=blend/strength=0.25:base=0.5` | 0→5/15 (+5) | 2→1/7 (-1) | 0→0/10 (+0) |
| close_known | panel10 | Sridevi Night | `cross:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:joint_ipf/sutta=conditional/digits=present/damping=0.75/passes=1:0.25` | 0→4/15 (+4) | 1→1/6 (+0) | 3→1/10 (-2) |
| close_known | panel10 | Time Bazar | `cross:digit_symmetry/transform=multiply3/alpha=1.0:top5_sutta_gate/source=sutta_conditional/penalty=1.5:0.75` | 2→5/13 (+3) | 0→1/6 (+1) | 0→0/8 (+0) |
| close_known | sp30 | Kalyan | `production` | 3→3/9 (+0) | 0→0/4 (+0) | 1→1/7 (+0) |
| close_known | sp30 | Kalyan Night | `production` | 5→5/9 (+0) | 2→2/4 (+0) | 3→3/5 (+0) |
| close_known | sp30 | Madhur Day | `refine:avoid2_gate/source=panel_avoid/penalty=0.15:base=1.0` | 3→5/11 (+2) | 2→2/5 (+0) | 1→2/8 (+1) |
| close_known | sp30 | Madhur Night | `production` | 1→1/8 (+0) | — | — |
| close_known | sp30 | Main Bazar | `production` | 1→1/7 (+0) | 1→1/4 (+0) | 2→2/6 (+0) |
| close_known | sp30 | Milan Day | `production` | 0→0/5 (+0) | — | 1→1/4 (+0) |
| close_known | sp30 | Milan Night | `refine:avoid2_gate/source=native_avoid/penalty=0.15:base=0.5` | 3→4/8 (+1) | 1→2/4 (+1) | 0→0/6 (+0) |
| close_known | sp30 | Rajdhani Day | `production` | 4→4/11 (+0) | 2→2/4 (+0) | 1→1/6 (+0) |
| close_known | sp30 | Rajdhani Night | `refine:digit_symmetry/transform=rotate1/alpha=0.75:base=0.75` | 3→5/9 (+2) | 2→2/4 (+0) | 2→1/4 (-1) |
| close_known | sp30 | Sridevi | `refine:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=1.0/avoid_penalty=0.35:base=0.25` | 4→8/12 (+4) | 1→1/6 (+0) | 1→0/8 (-1) |
| close_known | sp30 | Sridevi Night | `refine:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:base=1.0` | 0→6/10 (+6) | 2→2/6 (+0) | 3→3/8 (+0) |
| close_known | sp30 | Time Bazar | `cross:causal_history/mechanism=recent_digits_30/strength=0.5:digit_symmetry/transform=rotate1/alpha=1.0:0.5` | 3→8/12 (+5) | 2→0/5 (-2) | 3→0/4 (-3) |
| close_known | dp20 | Kalyan | `production` | 1→1/4 (+0) | 1→1/1 (+0) | 1→1/1 (+0) |
| close_known | dp20 | Kalyan Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) |
| close_known | dp20 | Madhur Day | `production` | 1→1/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) |
| close_known | dp20 | Madhur Night | `production` | 1→1/1 (+0) | — | — |
| close_known | dp20 | Main Bazar | `production` | 0→0/4 (+0) | 0→0/1 (+0) | — |
| close_known | dp20 | Milan Day | `production` | 1→1/8 (+0) | 1→1/5 (+0) | 1→1/4 (+0) |
| close_known | dp20 | Milan Night | `production` | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | dp20 | Rajdhani Day | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | dp20 | Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | dp20 | Sridevi | `production` | 2→2/3 (+0) | — | 0→0/2 (+0) |
| close_known | dp20 | Sridevi Night | `production` | 3→3/5 (+0) | — | 0→0/2 (+0) |
| close_known | dp20 | Time Bazar | `production` | 0→0/1 (+0) | 0→0/1 (+0) | 1→1/4 (+0) |
| close_known | sutta_avoid | Kalyan | `refine:digit_symmetry/transform=multiply3/alpha=1.0:base=1.0` | 4→8/13 (+4) | 1→0/5 (-1) | 2→1/8 (-1) |
| close_known | sutta_avoid | Kalyan Night | `refine:joint_ipf/sutta=conditional/digits=present/damping=0.35/passes=1:base=0.5` | 3→5/11 (+2) | 2→2/5 (+0) | 1→1/6 (+0) |
| close_known | sutta_avoid | Madhur Day | `refine:causal_history/mechanism=overdue_sutta_30/strength=0.25:base=1.0` | 4→6/15 (+2) | 2→0/7 (-2) | 4→3/10 (-1) |
| close_known | sutta_avoid | Madhur Night | `refine:causal_history/mechanism=overdue_sutta_7/strength=0.5:base=1.0` | 2→3/9 (+1) | — | — |
| close_known | sutta_avoid | Main Bazar | `refine:joint_likelihood/sutta=native/digits=appearance/strength=0.25:base=0.25` | 2→5/11 (+3) | 0→1/5 (+1) | 1→1/6 (+0) |
| close_known | sutta_avoid | Milan Day | `refine:probability_mixture/source=bernoulli/alpha=0.5:base=1.0` | 2→6/13 (+4) | 3→3/5 (+0) | 3→3/8 (+0) |
| close_known | sutta_avoid | Milan Night | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 4→6/13 (+2) | 3→3/5 (+0) | 3→3/8 (+0) |
| close_known | sutta_avoid | Rajdhani Day | `refine:joint_ipf/sutta=panel/digits=appearance/damping=0.35/passes=3:base=0.75` | 3→6/13 (+3) | 3→4/5 (+1) | 0→0/8 (+0) |
| close_known | sutta_avoid | Rajdhani Night | `cross:causal_history/mechanism=recent_digits_90/strength=-1.0:joint_ipf/sutta=conditional/digits=present/damping=0.35/passes=1:0.25` | 3→5/11 (+2) | 2→2/5 (+0) | 2→1/6 (-1) |
| close_known | sutta_avoid | Sridevi | `refine:causal_history/mechanism=overdue_digits_7/strength=-1.0:base=0.75` | 6→8/15 (+2) | 2→2/7 (+0) | 2→3/10 (+1) |
| close_known | sutta_avoid | Sridevi Night | `refine:top5_sutta_gate/source=sutta_conditional/penalty=0.15:base=0.75` | 4→6/15 (+2) | 0→1/6 (+1) | 3→3/10 (+0) |
| close_known | sutta_avoid | Time Bazar | `cross:causal_history/mechanism=recent_digits_30/strength=0.5:digit_symmetry/transform=rotate1/alpha=1.0:0.5` | 3→7/13 (+4) | 3→1/6 (-2) | 4→3/8 (-1) |
| close_known | joint10 | Kalyan | `refine:causal_history/mechanism=overdue_sutta_7/strength=0.5:base=0.25` | 0→1/13 (+1) | 0→0/5 (+0) | 1→0/8 (-1) |
| close_known | joint10 | Kalyan Night | `refine:joint_ipf/sutta=conditional/digits=present/damping=0.35/passes=1:base=0.5` | 0→2/11 (+2) | 0→1/5 (+1) | 0→0/6 (+0) |
| close_known | joint10 | Madhur Day | `refine:causal_history/mechanism=overdue_sutta_30/strength=0.25:base=0.75` | 1→2/15 (+1) | 0→0/7 (+0) | 0→0/10 (+0) |
| close_known | joint10 | Madhur Night | `production` | 0→0/9 (+0) | — | — |
| close_known | joint10 | Main Bazar | `refine:causal_history/mechanism=overdue_digits_7/strength=-1.0:base=0.25` | 0→1/11 (+1) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_known | joint10 | Milan Day | `production` | 0→0/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_known | joint10 | Milan Night | `refine:joint_gates/sutta=panel/avoid=panel_avoid/sutta_penalty=0.35/avoid_penalty=0.35:base=0.25` | 0→2/13 (+2) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_known | joint10 | Rajdhani Day | `production` | 0→0/13 (+0) | 0→0/5 (+0) | 0→0/8 (+0) |
| close_known | joint10 | Rajdhani Night | `production` | 0→0/11 (+0) | 0→0/5 (+0) | 0→0/6 (+0) |
| close_known | joint10 | Sridevi | `cross:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:top5_sutta_gate/source=sutta_conditional/penalty=0.15:0.25` | 0→4/15 (+4) | 0→1/7 (+1) | 0→0/10 (+0) |
| close_known | joint10 | Sridevi Night | `production` | 0→0/15 (+0) | 0→0/6 (+0) | 1→1/10 (+0) |
| close_known | joint10 | Time Bazar | `refine:joint_ipf/sutta=native/digits=present/damping=0.75/passes=1:base=1.0` | 1→2/13 (+1) | 0→0/6 (+0) | 0→0/8 (+0) |
| close_known | joint_sp30 | Kalyan | `production` | 2→2/9 (+0) | 0→0/4 (+0) | 1→1/7 (+0) |
| close_known | joint_sp30 | Kalyan Night | `production` | 2→2/9 (+0) | 2→2/4 (+0) | 1→1/5 (+0) |
| close_known | joint_sp30 | Madhur Day | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.25` | 2→4/11 (+2) | 1→1/5 (+0) | 1→1/8 (+0) |
| close_known | joint_sp30 | Madhur Night | `production` | 0→0/8 (+0) | — | — |
| close_known | joint_sp30 | Main Bazar | `production` | 0→0/7 (+0) | 0→0/4 (+0) | 1→1/6 (+0) |
| close_known | joint_sp30 | Milan Day | `production` | 0→0/5 (+0) | — | 1→1/4 (+0) |
| close_known | joint_sp30 | Milan Night | `refine:avoid2_gate/source=panel_avoid/penalty=3.0:base=0.75` | 2→3/8 (+1) | 1→1/4 (+0) | 0→0/6 (+0) |
| close_known | joint_sp30 | Rajdhani Day | `production` | 2→2/11 (+0) | 2→2/4 (+0) | 0→0/6 (+0) |
| close_known | joint_sp30 | Rajdhani Night | `refine:probability_mixture/source=bernoulli/alpha=0.5:base=0.5` | 1→3/9 (+2) | 2→2/4 (+0) | 0→1/4 (+1) |
| close_known | joint_sp30 | Sridevi | `refine:joint_gates/sutta=conditional/avoid=native_avoid/sutta_penalty=0.35/avoid_penalty=0.35:base=0.5` | 4→6/12 (+2) | 1→1/6 (+0) | 0→0/8 (+0) |
| close_known | joint_sp30 | Sridevi Night | `refine:joint_gates/sutta=panel/avoid=panel_avoid/sutta_penalty=0.35/avoid_penalty=0.35:base=0.5` | 0→1/10 (+1) | 0→0/6 (+0) | 2→3/8 (+1) |
| close_known | joint_sp30 | Time Bazar | `cross:causal_history/mechanism=recent_digits_30/strength=0.5:digit_symmetry/transform=rotate1/alpha=1.0:0.5` | 3→7/12 (+4) | 2→0/5 (-2) | 1→0/4 (-1) |
| close_known | joint_dp20 | Kalyan | `production` | 0→0/4 (+0) | 0→0/1 (+0) | 0→0/1 (+0) |
| close_known | joint_dp20 | Kalyan Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/1 (+0) |
| close_known | joint_dp20 | Madhur Day | `production` | 0→0/4 (+0) | 1→1/2 (+0) | 0→0/1 (+0) |
| close_known | joint_dp20 | Madhur Night | `production` | 0→0/1 (+0) | — | — |
| close_known | joint_dp20 | Main Bazar | `production` | 0→0/4 (+0) | 0→0/1 (+0) | — |
| close_known | joint_dp20 | Milan Day | `production` | 0→0/8 (+0) | 1→1/5 (+0) | 0→0/4 (+0) |
| close_known | joint_dp20 | Milan Night | `production` | 0→0/5 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | joint_dp20 | Rajdhani Day | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | joint_dp20 | Rajdhani Night | `production` | 0→0/2 (+0) | 0→0/1 (+0) | 0→0/2 (+0) |
| close_known | joint_dp20 | Sridevi | `production` | 2→2/3 (+0) | — | 0→0/2 (+0) |
| close_known | joint_dp20 | Sridevi Night | `production` | 2→2/5 (+0) | — | 0→0/2 (+0) |
| close_known | joint_dp20 | Time Bazar | `production` | 0→0/1 (+0) | 0→0/1 (+0) | 0→0/4 (+0) |

## Audit and reproduction

`market_summary.csv` contains every objective selector, companion metric, market and block, preserving eligible and all-event denominators. Holm correction covers all 351 frozen objective-specific extension comparisons, including production-retaining selectors. Companion metrics are guardrail diagnostics outside this formal family. Paired p-values are exploratory: Holm handles dependence between comparisons but cannot repair same-date dependence within event-level tests or prior outcome reuse.

Day-bootstrap intervals resample whole dates with 2,000 replicates and a fixed seed, preserving within-date market dependence. They are unadjusted diagnostic intervals; few extension dates, serial dependence and reused history limit their interpretation. Positive significance alone never authorizes production promotion.

The extension audit found exactly one historical hit change in an unselected numerical control: close_pre Top-5 Sutta, Time Bazar, October 22, refined uniform-Sutta alpha=1. Its panel probabilities differ by at most 1.74×10⁻¹⁷ and Sutta masses tie at the fifth-pick boundary within 10⁻¹². The batch-size arithmetic changes that control's tie ordering. No objective or market selected this control, every selected historical prediction remains identical, and no frozen definition or selector was changed. The audit records this explicit limitation rather than asserting universal historical stability.

Run `python -B research/combined_prediction_v6/verify_study.py` to reconstruct frozen selections, hit archives, summaries, budgets and added-feature causality. Run `python -B research/combined_prediction_v6/report_study.py` to regenerate this report without selection or network requests.


