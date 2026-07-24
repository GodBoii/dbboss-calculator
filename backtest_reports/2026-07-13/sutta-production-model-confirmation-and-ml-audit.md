# Production Sutta Model Confirmation and ML Audit

Generated: 2026-07-13

## Production-model confirmation

The application still uses the market-specific model reported in `sutta-above-90-model.md`. It was not replaced by a simpler or older predictor.

Production v1.0.10 contains the complete Above-90 rule pack:

- fixed draw lags and previous matching weekday/day-of-month;
- completed earlier same-day markets only;
- open/close panel digit, sum, difference, product, span, and Jodi arithmetic features;
- source, opposite, mirror, near-number, low-house, add-three, and subtract-three formula cycles;
- market-specific sequential rank promotions that preserve the established Top-4 prefix and select ranks 5-6.

It also contains the later Madhur Night Open and Rajdhani Night Close extensions. The live signal map, copy section, and in-app seven-day backtest all call the same production ranking builders.

Evidence on the original frozen 30-day rows:

| Model on identical 309 rows | Open | Close | Jodi |
| --- | ---: | ---: | ---: |
| Above-90 production model | 280/309 (90.6%) | 279/309 (90.3%) | 255/309 (82.5%) |
| Current v1.0.10 superset | 281/309 (90.9%) | 280/309 (90.6%) | 255/309 (82.5%) |

Therefore the model that produced the user-provided market table is present in the app, and current production is a conservative superset of it.

Those percentages describe the original researched historical window. They are not evidence of 90% future accuracy. The frozen next week scored 41/72 Open (56.9%), 44/72 Close (61.1%), and 23/72 Jodi (31.9%) under v1.0.10.

## Rolling and causal challenger audit

Three independent challenger families were implemented and evaluated. All features are causal: calendar state, production rankings, completed own lags, previous cross-market records, and only markets whose Close time precedes the target market's Open time.

### 1. Online expert ensemble

Trailing winner selection, accuracy-weighted digit voting, and joint Open-Close expert selection were evaluated with 20/40/80/160/all-history windows. Policy parameters were selected on development only.

| Block | Open delta | Close delta | Independent Jodi delta | Joint Jodi delta |
| --- | ---: | ---: | ---: | ---: |
| Development | +20 | +6 | +14 | +12 |
| Validation | -37 | -14 | -39 | -9 |
| Holdout | -31 | -15 | -37 | 0 |
| Forward | -2 | 0 | 0 | 0 |

Decision: reject. Development lift did not reproduce.

### 2. Shared causal categorical ML

Additive categorical and embedding-MLP classifiers were trained on the oldest 50%, selected on the next 20%, and checked on 15% validation, 15% chronological holdout, and the separate forward week.

| Block | Open delta | Close delta | Jodi delta |
| --- | ---: | ---: | ---: |
| Development | -27 | -52 | -61 |
| Validation | -45 | -26 | -49 |
| Holdout | -108 | -104 | -164 |
| Forward | +5 | -8 | -4 |

Decision: reject. Selecting the attractive forward Open result would be test-window leakage.

### 3. Block-retrained causal ML

Architecture, 90/180/360/all-history training window, and 5/10/20 epoch count were selected on development. The selected configuration was then retrained using only data available before validation, holdout, and forward blocks.

| Block | Open delta | Close delta | Jodi delta |
| --- | ---: | ---: | ---: |
| Development | -27 | -48 | -63 |
| Validation | -36 | -54 | -54 |
| Holdout | -94 | -93 | -142 |
| Forward | +4 | -3 | +2 |

Decision: reject. Forward gains were not supported by earlier blocks.

All three research programs were rerun and produced identical aggregate metrics. CUDA is unavailable in the installed PyTorch runtime, so the ML experiments used CPU; their runtimes were short enough that GPU acceleration would not change the research decision.

### Joint 6x6 rectangle challenger

A fourth family estimated the complete causal 10x10 Open-Close distribution and selected the highest-probability 6x6 rectangle, including conservative variants that preserved production ranks 1-4. Development selected candidates for Sridevi, Madhur Night, and Milan Night; all three failed the validation gate. No market candidate remained for holdout or forward promotion.

### Predictability and permutation audit

The frozen 72-row week was compared with nominal Top-6 coverage and 10,000 deterministic market-wise outcome permutations. Open scored 41/72 (56.9%) and Jodi 23/72 (31.9%), providing no evidence above their permutation nulls. Close scored 44/72 (61.1%) versus a permutation mean of 37.8/72 (52.4%), but the one-sided result was borderline at `p=0.054`, not below the pre-existing 5% evidence threshold. It is retained as a monitoring hypothesis, not a promotion.

On 72 rows, a 95% claim requires at least 69 hits. Under nominal coverage, the probability is approximately `2.01e-12` for Open or Close and `3.89e-27` for Jodi. Achieving 95% honestly therefore requires a large, repeatable conditional signal; formula count alone cannot supply it.

### Exact production source-rule ablation

All 48 source-hybrid promotions were disabled individually against the recomputed current production path. The audit used six parallel workers and evaluated 6,687 rows in approximately 82 seconds. A removal had to be non-regressive for its target side and Jodi in development, validation, chronological holdout, recent-30, and full history before forward evidence could qualify it.

No removal passed those historical gates: zero promotion candidates and zero monitor-only removals. Several deletions improved the frozen forward week, but every such deletion regressed at least one earlier block and was rejected. Normal app rankings remain unchanged.

The refreshed current-code recent-30-draw aggregate is 305/360 Open (84.7%), 315/360 Close (87.5%), and 267/360 Jodi (74.2%). The frozen week remains 41/72, 44/72, and 23/72 respectively. This contrast further confirms that the high recent historical percentage is not a valid estimate of future accuracy.

## Current decision

No ML or adaptive challenger is promoted. Production remains v1.0.10 with the full Above-90 pack. The 95% objective remains unachieved and active. Future improvements require genuinely new forward evidence or a challenger that passes development, validation, chronological holdout, per-market, and forward gates without selecting on the final test window.

## Sealed forward registry

An append-only forward registry was started at 2026-07-13 20:46 IST. It contains 12 SHA-256-sealed v1.0.10 production predictions whose results were absent when frozen:

- eight advance-batch predictions for 2026-07-14;
- four same-day predictions frozen before market Open for Milan Night, Rajdhani Night, Kalyan Night, and Main Bazar on 2026-07-13.

The registry stores the exact Top-6 Open and Close rankings, all 36 derived Jodis, generation timestamp, model version, target date, and every source-market data cutoff. Scoring can add actual outcomes but cannot alter the sealed prediction payload without failing the integrity check.

Commands:

- `node scripts/sutta-forward-registry.cjs snapshot`
- `node scripts/sutta-forward-registry.cjs score`
- `node scripts/sutta-forward-registry.cjs status`

At creation, all 12 seals validated and zero outcomes were available. These entries are the next genuinely untouched evidence for or against the model.

## Honest in-app reporting

App/PWA release 1.0.11 separates the application release from the frozen Sutta model version. The deployed rules remain prediction model v1.0.10; a reporting-only release can no longer imply that the model changed.

The Signal Map now labels its rolling seven-day result as retrospective and displays a separate, per-market sealed-forward status. The public status artifact contains only integrity-verified hit counts and accuracies; it does not expose prediction rankings or SHA-256 seals. While no outcome is available, accuracy is `null` and the UI says `Collecting` rather than presenting a misleading 0%.

At this release, the ledger has 12 valid seals, 0 scored draws, and 12 pending draws. Production build, TypeScript, PWA verification, and the all-market Top 1-10 ranking contract pass. ESLint reports zero errors and seven pre-existing warnings.

## Artifacts

- Production ranking model: `src/components/analysis/AnalysisTabs.tsx`
- Original Above-90 report: `backtest_reports/2026-07-11/sutta-above-90-model.md`
- Current frozen original-window ledger: `scratch/sutta-goal95-v1010-30-ledger.json`
- Online ensemble: `scripts/sutta-rolling-adaptive-research.py`
- Causal classifier: `scripts/sutta-causal-ml-research.py`
- Block-retrained classifier: `scripts/sutta-rolling-ml-research.py`
- Machine-readable results: `scratch/sutta-rolling-adaptive-output.json`, `scratch/sutta-causal-ml-output.json`, and `scratch/sutta-rolling-ml-output.json`
- Joint rectangle audit: `scripts/sutta-joint-rectangle-research.py`, `scratch/sutta-joint-rectangle-output.json`, and `backtest_reports/2026-07-13/sutta-joint-rectangle-research.md`
- Predictability audit: `scripts/sutta-predictability-audit.py`, `scratch/sutta-predictability-audit-output.json`, and `backtest_reports/2026-07-13/sutta-predictability-audit.md`
- Source-rule ablation: `scripts/sutta-rule-ablation.cjs`, `scratch/sutta-rule-ablation-output.json`, and `backtest_reports/2026-07-13/sutta-rule-ablation.md`
- Forward registry: `scripts/sutta-forward-registry.cjs` and `scratch/sutta-forward-registry-v1010.json`
- Sanitized app status: `public/sutta-forward-score.json`
