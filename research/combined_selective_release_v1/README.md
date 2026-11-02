# Selective fixed endpoint release

These are new, retrospectively selected fixed presets, not a port of the V8 dynamic controller. All dates were previously examined. The later blocks are reused audits, not fresh confirmation or evidence of future accuracy.

Only five market/channel/output combinations change:

| Market | Channel | Output | V7 expert | Fixed parameters |
|---|---|---|---|---|
| Sridevi | open | Avoid2, SP30, DP20 | 255 | Recent digit presence, 90 preceding local draws, strength -0.5 |
| Sridevi | open | Panel10 | 244 | Recent digit presence, 7 preceding local draws, strength +0.25 |
| Rajdhani Night | close before open is known | SP30 | 266 | Recent Sutta frequency, 30 preceding local draws, strength -1 |

The source distribution is the dedicated baseline SP30 distribution over all 220 panels. For digit recipes, each panel's feature is the sum of its distinct digits' historical presence frequencies. For the Sutta recipe, use its Sutta's historical frequency. Population-standardize the features and clip to [-4, 4]. Apply the strength in log probability space and normalize with softmax. The Python catalogue stores intermediate history scores as float32; JavaScript computes the mathematical recipe using Number arithmetic. The independent golden tests check the exact resulting panel and digit choices against the Python catalogue. Sort after rounding scores to 12 decimals; preserve the original panel order for ties. Avoid2 maximizes the total probability of panels excluding both digits, with lexicographic pair tie order.

History starts on July 4, 2026 because the V6/V7 research history features begin with that replay's cold start. Include only complete market-local draws strictly before the target date. The dedicated upstream baseline model retains its existing longer history. The fixed recipes do not use current-day results or adapt their parameters to later outcomes.

Sutta lists, present digits, full panel rankings, Jodi, other markets, and other output endpoints remain baseline. Equal or worse endpoint candidates were not selected for release. Endpoint budgets remain 10 panels, 30 SP, 20 DP, and two absent digits.

| Released endpoint | Sep 8–30 | Oct 1–15 | Oct 16–22 | Oct 23–Nov 1 |
|---|---|---|---|---|
| Sridevi open Avoid2 | 13→13/23 | 6→9/15 | 3→4/7 | 7→9/10 |
| Sridevi open Panel10 | 4→4/23 | 1→1/15 | 0→0/7 | 0→2/10 |
| Sridevi open SP30 | 7→7/20 | 2→4/13 | 0→2/6 | 3→4/8 |
| Sridevi open DP20 | 1→1/3 | 1→1/2 | 0→1/1 | 0→1/2 |
| Rajdhani Night pre-close SP30 | 5→6/15 | 2→2/9 | 0→1/4 | 1→2/4 |

The analysis-date eligibility starts on September 8, 2026, the first supported comparison period. Earlier analyses retain the original outputs exactly. The formulas without that guard are not uniformly better over the full archive: Sridevi Avoid2, Panel10, and SP30 each lose hits in the earlier development and validation blocks. Their exact earlier counts remain in `evidence.json`. The fixed release is supported only by the stated four later retrospective comparisons, whose sample sizes are small.

Run `python research/combined_selective_release_v1/export_expected.py` from the repository root to regenerate `evidence.json` and `scripts/fixtures/combined-selective-endpoints.json`. The exporter reconstructs the exact selected V7 experts, verifies every reconstructed hit against the aligned V8 source archive, and rejects any released endpoint regressing in September 8–30, October 1–15, October 16–22, or October 23–November 1. It also requires a positive final-block gain for each released endpoint. Earlier development and validation results are reported without imposing those release assertions.

The golden fixture covers every available affected-market replay date from September 8 through November 1, including September 15 and 30. Each case contains only approved expected and dedicated baseline endpoint lists, the baseline SP30 probability vector, and strictly prior local history. Source hashes record lineage; evidence counts use each output's own eligible denominator and must not be summed as an overall accuracy.
