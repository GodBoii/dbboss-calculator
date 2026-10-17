# Combined prediction probability-shrinkage study

Research only, October 18, 2026. All new files are in this folder. Application code, settings, existing research, and unrelated working changes were left untouched.

## Finding

No reliable accuracy improvement was established. Keep the production model unchanged.

The clearest diagnostic is poor probability scoring for Close before the Open result is known. A completely uniform distribution beats its combined probabilities on log loss across every evaluation block. That suggests testing simpler probabilities in a future shadow study. It does not establish better panel prediction accuracy or prove probability calibration.

For Close after the Open result is known, removing the combination adjustments gives an interesting Top-10 candidate. It improves October 1-15 from 6/152 to 14/152 hits, or 3.95% to 9.21%. September falls from 18/237 to 16/237, and October 16-17 stays at 1/14. The uncorrected paired October p-value is 0.077. This candidate was selected by log loss, not by the hit-rate selector, and is not a confirmed replacement.

## Scope and method

The baseline reconstructs the real `combined-weighted-v1` policy, including its market overrides. It is checked against 48 panel lists produced by fresh calls to the current production `buildCombinedAnalysis`. Inputs reuse hash-checked V1, V2 and V3 feature replays. There are 1,066 market-date events from 12 markets, July 4 through October 17, 2026. These are not 3,198 independent outcomes simply because three channels are tested.

We tested 24 distributions for each of nine channel/endpoint combinations, 216 in total. The candidates include production, temperatures 0.5/2/4, and 25/50/75/100% mixtures with uniform probabilities, a causal global panel-frequency prior, a causal market prior, raw panel probabilities, and an equal average of the three production endpoint distributions. This is a narrower diagnostic of previously explored combination ideas, not a claim that all methods are new.

Global counts start with one observation per legal panel. Market counts have total prior mass 100 centered on the previous-day global distribution. Counts start July 4. They do not use the longer upstream model training history. Every prediction on a date is computed before any outcome from that date enters these priors, including for the known-Open channel.

Development is July 4-August 16, 435 events. Validation is August 17-September 7, 228 events. Two selections per endpoint are frozen and hashed before evaluation metrics are calculated. The accuracy selector rejects development hit regressions and maximizes validation hits. The probability selector rejects development log-loss regressions and minimizes validation log loss. Production wins equal-score ties. The script and protocol contain the remaining deterministic tie rules.

All evaluation dates were examined in previous research. September, October 1-15, and October 16-17 are reused historical comparisons, not fresh confirmation. The protocol documents the executed experiment; it was not prospectively preregistered.

## Accuracy-selected candidates

Each cell shows production hits to candidate hits on the same eligible events. SP and DP denominators condition on the actual panel kind. Top-10 uses every event. Pick counts remain 10, 30 SP, and 20 DP respectively.

| Channel / endpoint | Selected candidate | September | October 1-15 | October 16-17 |
|---|---|---|---|---|
| Open / Top-10 | production | 13 to 13 / 237 | 18 to 18 / 152 | 0 to 0 / 14 |
| Open / SP-30 | production | 43 to 43 / 170 | 36 to 36 / 115 | 0 to 0 / 10 |
| Open / DP-20 | production | 20 to 20 / 65 | 8 to 8 / 37 | 1 to 1 / 4 |
| Close before Open / Top-10 | production | 14 to 14 / 237 | 11 to 11 / 152 | 0 to 0 / 14 |
| Close before Open / SP-30 | global prior only | 47 to 53 / 186 | 28 to 25 / 111 | 3 to 2 / 12 |
| Close before Open / DP-20 | 50% global prior | 12 to 9 / 51 | 10 to 13 / 41 | 0 to 0 / 2 |
| Close after Open / Top-10 | production | 18 to 18 / 237 | 6 to 6 / 152 | 1 to 1 / 14 |
| Close after Open / SP-30 | production | 59 to 59 / 186 | 30 to 30 / 111 | 5 to 5 / 12 |
| Close after Open / DP-20 | 25% raw probabilities | 15 to 15 / 51 | 9 to 9 / 41 | 1 to 1 / 2 |

Six of nine accuracy selections retain production. Two changes reverse direction between September and October. The third changes probabilities without gaining panel hits on these blocks.

## Probability scoring

Lower multiclass log loss is better. These scores cover all 220 legal panels, even for the SP/DP endpoint distributions.

| Close before Open endpoint | Selected by log loss | September log loss | October 1-15 log loss | October 16-17 log loss |
|---|---|---|---|---|
| Top-10 | uniform | 6.019 to 5.394 | 6.068 to 5.394 | 6.228 to 5.394 |
| SP-30 | uniform | 5.988 to 5.394 | 5.999 to 5.394 | 6.058 to 5.394 |
| DP-20 | uniform | 5.842 to 5.394 | 5.844 to 5.394 | 5.828 to 5.394 |

Uniform log loss is exactly ln(220). Uniform distributions assign identical probabilities to every panel. Their apparent hit rates depend on fixed tie breaking and should not be treated as discovered predictive information. Likewise, uniform-derived Sutta and digit outputs can reflect panel-universe composition and numerical ties. They are diagnostic baselines only.

Positive temperature changes preserve every panel ranking, as checked across the entire replay. They can change probability scores and derived outputs, but cannot directly improve fixed-budget panel hit rates. The other probability selections and all Brier scores are in `results.json`.

The accuracy-selected global prior for Close-before-Open SP-30 gives Sutta-6 counts of 136 to 148 in September, 81 to 84 in October 1-15, and 8 to 8 on October 16-17. However, its SP hit rate regresses in October, and its present-pair hits fall from 12 to 7. This is a tradeoff, not an improvement to all combined outputs.

## Verification and reproducibility

Completed checks:

- 48 current-production panel-list comparisons across six market/date samples, including policy overrides and known-Open behavior.
- Future-label perturbation leaves prior predictions through the perturbation date exactly unchanged. This also tests exclusion of all same-day labels.
- Every candidate has finite, positive probabilities that sum to one.
- Temperature changes preserve all panel ranks.
- A separate verifier reconstructs all 18 selections and 108 block hit counts.
- SHA-256 checks cover source replays, selection integrity, current parity sources, and 1,218 existing files outside this folder. No covered external file changed.

Run from the repository root with the existing Python NumPy/SciPy and Node/TypeScript dependencies:

```powershell
node research/combined_prediction_v4/parity_check.cjs
python -B research/combined_prediction_v4/run_study.py
python -B research/combined_prediction_v4/verify_study.py
```

No dependencies were installed. No application build is needed because application files were not edited. `search.csv` includes every development/validation score. `selection.json` records the frozen choices. `results.json` includes endpoint and derived-output results, day-bootstrap intervals, and exploratory paired tests. Tests are uncorrected for multiple comparisons and prior historical reuse; their p-values do not support a promotion claim. Upstream models remain frozen and were not refitted for each historical date, so this study cannot remove their historical fitting or policy-selection bias.

## Next useful experiment

Freeze two shadow candidates before collecting any new outcomes: raw probabilities for Close-after-Open Top-10, and a simple probability baseline for Close-before-Open. Keep fixed pick budgets and evaluate panel hits, Sutta-6, digit-pair hits, and probability scores separately on the same future dates. Do not change the live combined model based on this retrospective study.

## Research sources

[Scikit-learn's probability calibration guide](https://scikit-learn.org/stable/modules/calibration.html) distinguishes probability quality from classification decisions. [Its chronological validation guidance](https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split) motivates preserving time order and excluding future outcomes. [Hyndman and Athanasopoulos on forecast combinations](https://otexts.com/fpp3/practical.html#forecast-combinations) motivates testing simple combination baselines. These sources guide the experiment; the measured results come from this repository's replays.
