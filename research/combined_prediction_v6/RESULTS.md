# What helped, what failed, and what was retained

The search found promising individual gains, but no supported replacement that improves every required output. Production V2 remains unchanged. The chosen settings and their lineage remain available as research presets in `selection.json`; failed settings are excluded from refinement and preserved in the audit ledger.

## Scope

- 418 parameterized candidates across 12 mechanism families, tested in Open, Close-before-Open, and Close-with-full-Open modes.
- 1,130 further mixtures of historical survivors across those modes, selected separately by market and objective.
- Nine objectives covering Top-5 Sutta, two absent digits, fixed panel budgets, and same-draw joint success.
- All 12 application markets in historical evaluation. The final period, October 23-November 1, has 88 complete records across 11 markets; Madhur Night has no final-period data.
- A separate posthoc check of 936 independent specialist-output combinations. Its design followed inspection of the main final-period scores, so it is exploratory.

## Concrete findings on the final period

Each row below uses a different objective-selected candidate. These rows cannot be assembled into a claim about one universal winning model. SP/DP denominators condition on the actual panel type.

| Selected objective | Production hits | Candidate hits | What else happened with that same candidate |
|---|---:|---:|---|
| Open DP-20 | 5/24 | 11/24 | SP-30 fell from 18 to 13 hits; avoid-two fell from 52 to 50. |
| Close-before-Open Top-5 Sutta | 45/88 | 53/88 | Avoid-two improved 43 to 49, Top-10 panels 5 to 7, and SP-30 14 to 16; DP-20 fell 5 to 3. |
| Close-before-Open joint SP-30 | 5/66 | 13/66 | SP-30 itself fell 14 to 13; Top-5 Sutta fell 45 to 44; avoid-two stayed 43/88. Alignment improved more than prediction accuracy. |
| Open avoid-two | 52/88 | 43/88 | This historically selected configuration failed on later outcomes and should not replace production. |

No positive objective result survived Holm correction across the 351 frozen market/channel/objective selectors. These samples are too small to establish stable market-specific superiority. Individual gains remain hypotheses, with all companion losses recorded.

## What the unusual ideas included

Soft and hard Sutta/avoid gates, joint likelihoods, repeated marginal-consistency adjustments, independent digit likelihoods, mirror/complement/rotation permutations, recency, overdue values, contrarian strengths, probability pooling, and temperature controls. The counts include parameter variants, not hundreds of independent scientific theories.

The second round retained historical winners and tested weaker/stronger mixtures plus combinations of winners for different objectives. `refinement_summary.csv` compares the original survivor with its final mixture on the same dates, so improvement from refinement can be separated from the original candidate's gain.

The independent-output check also found tradeoffs. Its historically selected pooled Open DP route raised joint hits from 1 to 8 out of 24, but its Top-5 component lost two hits. See `SPECIALISTS.md` and its full ledger, including all rejected combinations.

## Verification and limits

Independent checks reconstructed 2,390 historical distributions, checked 1,254 candidate causality comparisons and 108 live-production panel lists, and verified 18,954 summary cells. All selected historical predictions stayed unchanged when the final-period rows were appended.

One unselected uniform-Sutta control changed a tied Top-5 hit through floating-point rounding. The exact event, tied boundary and tiny probability differences are recorded in `verification.json`; this is an explicit exception, not a claim of perfect invariance for every control.

The final-period outcomes were fetched only after freezing the main candidates and selectors. They are retrospective observations, not prospectively registered forecasts. Earlier history was repeatedly examined, upstream fitted features retain historical selection bias, and five raw context records are missing from the added candidates' sparse count history. These limitations prevent a strong general accuracy claim.

## Detailed evidence

- `REPORT.md`: main results, every market/objective selection, companion losses, corrected tests and date-bootstrap intervals.
- `candidate_metrics.csv.gz` and `extension_metrics.csv.gz`: individual main-search trials.
- `market_summary.csv`: every selected candidate evaluated on all nine outputs.
- `specialist_combinations.csv` and `SPECIALISTS.md`: all independent-output combinations and their posthoc status.
- `selection_manifest.json`: frozen source and selection hashes.

Chronological separation follows the [forecast evaluation guidance](https://otexts.com/fpp3/tscv.html) and [data-leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html). The multiple-testing audit uses [Holm correction](https://www.statsmodels.org/dev/generated/statsmodels.stats.multitest.multipletests.html). The measured counts above come from the local experiment, not those references.
