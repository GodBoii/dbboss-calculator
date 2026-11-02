# Component improvement first, combination weights second

No tested model improved every requested output. Some individual specialists gained hits; other specialists regressed, and fusion often removed the gains. Production remains unchanged. The research retains the component presets, weight configurations and failed trials for inspection.

The sequence was the one requested: select specialists separately for Open/Close avoid-two, Top-5 Sutta, panels, SP and DP; separately optimize a pre-Open Jodi25 pair; freeze those source choices; then test how much weight each component receives in the combined model. Every market was scored separately.

## Scope

- 672 component experts per channel, covering native models, probability mixtures, causal history, digit/pair absence and prior-study methods.
- 795 fusion configurations per channel after component selection, including independent Sutta/avoid/SP/DP weights, panel mixture weights, Jodi sources and matched component-removal controls.
- 195 component selections, 39 balanced fusion selections, and 13 Jodi selections, including pooled diagnostic scopes.
- 1,201 market-date records through November 1. The final comparison below uses 88 records across 11 markets on October 23-November 1. Madhur Night has no records in that block.

All those dates were examined in prior research. This is a retrospective comparison, not fresh confirmation. Nothing was selected from the declared final audit block in this run, but that cannot remove prior research or upstream fitting bias.

## What the independent specialists changed

Each cell is production to specialist hits, on the same events. These are separately chosen output specialists, not one coherent winning probability model. Close-before-Open is the Close regime relevant to Jodi25.

| Output | Open | Close before Open | Close after full Open known |
|---|---:|---:|---:|
| Top-5 Sutta | 42 to 44 / 88 | 45 to 41 / 88 | 44 to 47 / 88 |
| Both avoid digits absent | 52 to 52 / 88 | 43 to 52 / 88 | 49 to 46 / 88 |
| Panel Top-10 | 3 to 5 / 88 | 5 to 5 / 88 | 10 to 5 / 88 |
| SP-30 | 18 to 16 / 64 | 14 to 23 / 66 | 18 to 18 / 66 |
| DP-20 | 5 to 5 / 24 | 5 to 5 / 21 | 3 to 3 / 21 |

The useful specialist leads are Close-before-Open avoid-two and SP, Open Top-5 and panels, and Close-after-Open Top-5. The losses in other rows are failures, not improvements hidden inside an average. SP and DP denominators condition on the actual panel kind.

All local DP specialists retained production because the early per-market DP samples did not satisfy the minimum support rule. The earlier Open DP improvement from a different experiment was not reproduced by this selection procedure. This does not prove no DP formula helps. A separate pooled-DP diagnostic checks the available global alternative rather than treating insufficient local data as a failed formula; see `POOLED_DP.md`.

That pooled Close DP expert improved fitting-period counts but went from 4 to 3 hits on October 16-22 and stayed at 5/21 on October 23-November 1. Its reweighted market pipeline raised Close avoid-two from 43 to 46 but lowered SP from 15 to 14 relative to the original selected fusion, with DP still 5/21. It did not solve the all-output tradeoff. This additional diagnostic was conceived after reading the main results and is explicitly posthoc.

## What the combined weights changed

These are the actual results after applying the selected market-specific weight overrides. They differ from selecting one global weight configuration. Cells show production to specialists to combined hits.

| Output | Open | Close before Open |
|---|---:|---:|
| Top-5 Sutta | 42 to 44 to 42 / 88 | 45 to 41 to 43 / 88 |
| Both avoid digits absent | 52 to 52 to 53 / 88 | 43 to 52 to 43 / 88 |
| Panel Top-10 | 3 to 5 to 2 / 88 | 5 to 5 to 5 / 88 |
| SP-30 | 18 to 16 to 18 / 64 | 14 to 23 to 15 / 66 |
| DP-20 | 5 to 5 to 6 / 24 | 5 to 5 to 5 / 21 |

Close-after-Open combined results equal production on all five outputs in this block. The Open avoid and DP gains above come with a lost panel hit; Close fusion removes much of the avoid-two and SP specialist gains. There is no universal weight setting that fixes all these rows.

Fusion candidates must preserve all five component counts against both production and the specialists in both weight-fitting blocks. Five market/channel weight overrides qualified there; the other 34 scopes fell back to production. Passing those historical guards did not guarantee that every gain survived later. A fallback also does not mean the independent specialists were inferior on every output.

## Jodi25

Every pre-Open Jodi prediction contains exactly 25 pairs, made from five predicted Open Suttas and five predicted Close Suttas. It never uses the actual target Open result.

On the final reused block, production hit 22/88. The independently selected Top-5 specialists also hit 22/88. The separately optimized early Jodi specialists hit 16/88. The guarded final weighted Jodi model retained production and hit 22/88. The Jodi-specific early gains did not persist.

## Which weights helped and which hurt

`ablation_summary.csv` compares a fixed five-component fusion with matched versions that remove one component at a time. It records all five outputs and Jodi25, by market and period. Positive retaining-component counts mean that keeping the component helped that particular output under that reference setting; negative counts mean it hurt. This is a controlled diagnostic, not proof that the component always helps or that the reference weights are optimal.

`REPORT.md` includes the full weight parameters for every retained market override, the ablation table, and the production/specialist/fusion comparisons. `candidate_metrics.csv.gz` preserves every trial instead of deleting evidence of failure.

## Verification

The independent audit passed 4,401 distribution reconstructions, all component/fusion/Jodi selectors, 142 prefix checks and 137 future-label perturbation checks. An additional source-matched check passed 144 production Top-5/panel/SP/DP list comparisons. Production reference hits match the earlier study across all 15 component endpoints. No application source was changed.

The next defensible promotion decision requires outcomes that have not already influenced research. These saved settings are research candidates, not confirmed accuracy improvements.
