# Two-Digit Research Master Audit

Generated: 2026-07-10T13:14:23.799Z
Artifacts audited: 48
Non-hindsight artifacts proving >=80% strict: 0
Highest isolated non-hindsight result: Validation-selected model portfolio gate - 76.7%

## Scoreboard

| Experiment | Status | Strict Accuracy | Evidence |
|---|---|---:|---|
| Broad formula strategy lab | failed_target | 50.8% | Tested 324 variants across 192 folds; selected strict 50.8% (2878/5665); 80% selected folds 0. |
| High-precision rule miner | failed_validation | 0.0% | Accepted folds 0; high training rules did not survive validation. |
| Context pocket miner | insufficient | 54.4% | Selected folds 5; strict aggregate 54.4% (81/149); 80% folds 0. |
| Durable context pocket miner | failed_forward | 47.7% | Tested 324 context gate configs across 120 rolling folds; selected 86 folds; strict 47.7% (197/413). |
| Custom logistic pair classifier | overfit | 49.2% | Selected folds 6; strict aggregate 49.2% (30/61); 80% folds 0. |
| Consensus abstention guardian | failed_forward | 37.5% | Validation-gated folds 7; strict aggregate 37.5% (15/40). |
| 134-model deep research runner | best_full_coverage_so_far | 57.1% | Baseline 51.2% (369/720); guarded improved 57.1% (411/720); market-sides >=80: 0. |
| 134-model consensus safe-call | no_safe_region | 0.0% | 80% validation-gated selected folds 0; strict test n/a. |
| Latest-30 fixed-pair hindsight upper bound | ceiling_below_target | 70.1% | Cheating best fixed pair average 70.1%; market-sides >=80: 0/24. |
| Latest-30 context hindsight oracle | hindsight_only | 93.9% | Supported context oracle 93.9% with 24/24 market-sides >=80; not deployable because it sees test outcomes. |
| Walk-forward context learner latest window | failed_forward | 51.0% | Strict 51.0% (367/720); market-sides >=80: 0/24. |
| Walk-forward context learner rolling | failed_stability | 51.0% | 144 folds strict 51.0% (2204/4320); folds >=80: 0/144. |
| Validation gate frontier | no_gate_region | 61.7% | Gate configs >=80 with >=3 folds: 0; >=70 with >=3 folds: 0; best >=60 coverage 61.7% (74/120). |
| Bayesian lower-bound gate | low_coverage_unstable | 53.7% | Val>=80,n>=5 strict 53.7% (138/257); val>=70,n>=5 strict 53.5% (250/467). |
| Markov / transition models | partial_signal_not_target | 75.7% | All folds 51.9% (932/1797); val>=70 folds 75.7% (28/37); val>=80 folds 0. |
| Markov high-confidence pocket gate | failed_selective_gate | 56.3% | Tested 125 validation-mined pocket gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 56.3% (18/32). |
| Meta formula search | failed_forward | 54.5% | Tested 167 weighted pair formulas; latest-30 53.5% (385/720); rolling folds 54.5% (1177/2160); folds >=80: 0. |
| Supervised pair ranker | failed_latest_window | 53.3% | Compact ridge ranker tested 2 learned models; latest-30 53.3% (384/720); market-sides >=80: 0; rolling folds skipped due uncached runtime. |
| Agent-style multi-model arbitration gate | failed_agent_gate | 59.1% | Aligned 720 prediction rows across model families; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 59.1% (97/164). |
| Online adaptive expert ensemble | failed_adaptive_agent | 48.3% | Adaptively weighted 133 model experts with 36 voting configs across 72 forward folds; viable >=80 with >=30 calls: 0; best min-30 calls 48.3% (87/180). |
| Validation-selected model portfolio gate | failed_portfolio_gate | 76.7% | Tested 112 validation-only portfolio gates across 24 market-sides; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 76.7% (23/30). |
| Rolling validation-selected portfolio stability | failed_stability | 66.3% | Tested 630 rolling portfolio gates across 216 grouped forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 66.3% (63/95). |
| Digit appearance risk gate | failed_latest_window | 55.5% | Tested 16 digit-risk formulas with 27 validation gates on latest windows; strict 55.5% (106/191); folds >=80: 0/14. |
| Fixed-pair rolling selector | failed_stability | 57.8% | Tested 100 rolling fixed-pair gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 57.8% (52/90). |
| Weekday-conditioned pair selector | failed_weekday_theory | 52.3% | Tested 80 market/side/weekday pair gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 52.3% (661/1264). |
| Calendar bucket pair selector | failed_calendar_theory | 58.1% | Tested 32 calendar bucket pair gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 58.1% (61/105). |
| House/opposite constrained selector | failed_house_opposite_theory | 70.0% | Tested 140 house/opposite/parity gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 70.0% (21/30). |
| Sutta bucket pair selector | failed_sutta_context | 56.8% | Tested 24 previous-sutta/jodi bucket gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 56.8% (71/125). |
| Panel-shape bucket selector | failed_panel_shape_context | 54.7% | Tested 36 previous-panel shape/kind/root gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 54.7% (204/373). |
| Cross-market lead/lag selector | failed_cross_market | 53.3% | Tested 27 constrained source-market lead/lag gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 53.3% (16/30). |
| Streak/cycle selector | failed_streak_cycle | 60.0% | Tested 7 streak/cycle modes with 24 validation gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 60.0% (18/30). |
| Transition-transform selector | failed_transition_transform | 55.0% | Tested 15 previous-result transform modes with 20 validation gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 55.0% (99/180). |
| Regime/volatility bucket selector | failed_regime_volatility | 65.0% | Tested 120 entropy/coverage/repeat/sum/persistence gates; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 65.0% (26/40). |
| Latent-regime clustering selector | failed_latent_regime | 66.7% | Tested 128 deterministic latent-state configs across 72 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 66.7% (20/30). |
| Adaptive change-point selector | failed_change_point | 52.7% | Tested 404 fixed/EWMA/change-detection configs across 72 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 52.7% (743/1410). |
| Forward pre-registration ledger | active_safety_control | n/a | Current calls 0; no-safe-calls 24; used for future non-hindsight scoring. |
| Signal feasibility and temporal persistence audit | diagnostic_low_stable_signal | 51.6% | Empirical uninformed-pair base 50.6%; early-period selected fixed pairs scored 51.6% (2263/4386) later; same-pair next-result rate after success 50.8% versus 50.5% after failure. |
| Time-ordered all-market feature graph | failed_cross_market_graph | 51.7% | Tested 3414 time-safe source/feature models with 8 pair variants across 69 forward folds; viable >=80 with >=30 calls: 0; best min-30 calls 51.7% (31/60). |
| Multivariate time-ordered market kNN | failed_multivariate_cross_market | 49.7% | Tested 864 multivariate context/neighbor/risk configs across 46 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 49.7% (686/1380). |
| Nonlinear supervised cross-market classifier | failed_nonlinear_cross_market | 51.2% | Tested 456 linear/ReLU/tanh/Fourier target-confidence variants across 48 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 51.2% (569/1112). |
| Cross-market randomized forest | failed_tree_cross_market | 63.5% | Tested 96 randomized-tree target-confidence variants across 48 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 63.5% (40/63). |
| Temporal echo-state reservoir | failed_temporal_reservoir | 60.6% | Tested 576 recurrent-dynamics/readout/target-confidence variants across 48 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 60.6% (43/71). |
| Symbolic sequence grammar selector | failed_symbolic_sequence | 54.5% | Tested 540 root/kind/mask/shape/delta sequence variants across 72 forward folds; viable >=80 with >=30 calls: 0; viable >=85 with >=30 calls: 0; best min-30 calls 54.5% (42/77). |
| Permutation and false-discovery audit | isolated_significant_not_stable | 76.7% | Exact shuffled-panel p=0.0060 for isolated 76.7% (23/30); rolling portfolio search p=0.4628, so the latest pocket is unusual but not temporally durable. |
| Context-weekday abstention guardian | failed_rolling_posthoc_pocket | 50.2% | Tested 42 validation-learned guardian configs across 144 folds; rolling best 50.2% (345/687); exploratory inspected Madhur Night close pocket 80.0% (20/25) and is not pristine holdout evidence. |
| Exploratory Madhur Night pocket forward register | active_research_control | n/a | Frozen after 2026-07-04; fresh calls 0; newest source row 2026-07-04; promotion eligible: false. |
| Context multi-block durability gate | isolated_durable_validation_not_target | 76.7% | Tested 840 three-block stability gates across 144 folds; viable >=80 with >=30 calls: 0; best 76.7% (23/30); Madhur Night validation blocks 66.7%/73.3%/70.0%. |
| Online regime continuation / stop-loss gate | failed_online_regime_gate | 53.5% | Tested 134 trailing/EWMA/Wilson/failure gates with 12 validation selectors across 144 folds; viable >=80 with >=30 calls: 0; rolling best 53.5% (554/1036); Madhur latest 76.0% (19/25). |

## Conclusion

No non-hindsight, forward-style experiment has proven a deployable 80-85% strict 2-digit avoid model.

## Next Directions

- Continue frozen forward registration and scoring on fresh future results.
- If more data is acquired, rerun rolling evaluations with larger train/validation/test windows.
- Use an AI agent as an auditor/risk controller, not a direct digit oracle.
- Do not lower live gates unless a historical forward frontier shows repeated >=80% regions.

## AI Agent Role

- A language-model agent should review the evidence bundle, reject overfit calls, explain no-call decisions, and enforce pre-registration.
- It should not directly invent avoid digits from historical rows; that would bypass the statistical gates that protect the user.
- The safest integration is an audit layer beside the numeric models: model proposes, agent checks evidence, gate decides call/no-call.