/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

function readJson(name) {
  const file = path.join(__dirname, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function pct(value) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function ratio(correct, total) {
  return total ? `${pct(correct / total)} (${correct}/${total})` : "n/a";
}

function addFinding(findings, name, status, strictAccuracy, details, evidenceFile) {
  findings.push({ name, status, strictAccuracy, details, evidenceFile });
}

function main() {
  const findings = [];

  const strategy = readJson("two-digit-avoid-strategy-lab-output.json");
  if (strategy) {
    addFinding(
      findings,
      "Broad formula strategy lab",
      "failed_target",
      strategy.selectedOverall?.accuracy,
      `Tested ${strategy.strategiesTested ?? "many"} variants across ${strategy.foldsTested ?? "many"} folds; selected strict ${ratio(strategy.selectedOverall?.ok ?? 0, strategy.selectedOverall?.n ?? 0)}; 80% selected folds ${strategy.selectedOverall?.folds80 ?? 0}.`,
      "scratch/two-digit-avoid-strategy-lab-output.json",
    );
  }

  const rule = readJson("two-digit-avoid-rule-miner-output.json");
  if (rule) {
    addFinding(
      findings,
      "High-precision rule miner",
      "failed_validation",
      rule.aggregate?.accuracy ?? 0,
      `Accepted folds ${rule.selectedCount ?? rule.acceptedFolds ?? 0}; high training rules did not survive validation.`,
      "scratch/two-digit-avoid-rule-miner-output.json",
    );
  }

  const pocket = readJson("two-digit-context-pocket-miner-output.json");
  if (pocket) {
    addFinding(
      findings,
      "Context pocket miner",
      "insufficient",
      pocket.aggregate?.accuracy,
      `Selected folds ${pocket.selectedFolds ?? 0}; strict aggregate ${ratio(pocket.aggregate?.ok ?? 0, pocket.aggregate?.n ?? 0)}; 80% folds ${pocket.aggregate?.folds80 ?? 0}.`,
      "scratch/two-digit-context-pocket-miner-output.json",
    );
  }

  const durablePocket = readJson("two-digit-durable-pocket-miner-output.json");
  if (durablePocket) {
    addFinding(
      findings,
      "Durable context pocket miner",
      "failed_forward",
      durablePocket.aggregate?.accuracy,
      `Tested ${durablePocket.configs ?? "many"} context gate configs across ${durablePocket.folds ?? "many"} rolling folds; selected ${durablePocket.selectedCount ?? 0} folds; strict ${ratio(durablePocket.aggregate?.correct ?? 0, durablePocket.aggregate?.total ?? 0)}.`,
      "scratch/two-digit-durable-pocket-miner-output.json",
    );
  }

  const logistic = readJson("two_digit_pair_logistic_output.json");
  if (logistic) {
    addFinding(
      findings,
      "Custom logistic pair classifier",
      "overfit",
      logistic.aggregate?.accuracy,
      `Selected folds ${logistic.selectedFolds ?? 0}; strict aggregate ${ratio(logistic.aggregate?.ok ?? 0, logistic.aggregate?.n ?? 0)}; 80% folds ${logistic.aggregate?.folds80 ?? 0}.`,
      "scratch/two_digit_pair_logistic_output.json",
    );
  }

  const guardian = readJson("two-digit-abstention-guardian-output.json");
  if (guardian) {
    addFinding(
      findings,
      "Consensus abstention guardian",
      "failed_forward",
      guardian.aggregate?.accuracy,
      `Validation-gated folds ${guardian.selectedCount}; strict aggregate ${ratio(guardian.aggregate?.correct ?? 0, guardian.aggregate?.total ?? 0)}.`,
      "scratch/two-digit-abstention-guardian-output.json",
    );
  }

  const deep = readJson("two-digit-deep-research-output.json");
  if (deep) {
    addFinding(
      findings,
      "134-model deep research runner",
      "best_full_coverage_so_far",
      deep.aggregate?.finalAccuracy,
      `Baseline ${ratio(deep.aggregate?.baselineCorrect ?? 0, deep.aggregate?.baselineTotal ?? 0)}; guarded improved ${ratio(deep.aggregate?.finalCorrect ?? 0, deep.aggregate?.finalTotal ?? 0)}; market-sides >=80: ${deep.aggregate?.marketSidesAt80 ?? 0}.`,
      "scratch/two-digit-deep-research-output.json",
    );
  }

  const safeCall = readJson("two-digit-consensus-safe-call-output.json");
  if (safeCall) {
    addFinding(
      findings,
      "134-model consensus safe-call",
      "no_safe_region",
      safeCall.aggregate?.accuracy,
      `80% validation-gated selected folds ${safeCall.selectedCount}; strict test ${ratio(safeCall.aggregate?.correct ?? 0, safeCall.aggregate?.total ?? 0)}.`,
      "scratch/two-digit-consensus-safe-call-output.json",
    );
  }

  const hindsight = readJson("two-digit-hindsight-upper-bound-output.json");
  if (hindsight) {
    addFinding(
      findings,
      "Latest-30 fixed-pair hindsight upper bound",
      "ceiling_below_target",
      hindsight.avgBestFixedPairAccuracy,
      `Cheating best fixed pair average ${pct(hindsight.avgBestFixedPairAccuracy)}; market-sides >=80: ${hindsight.marketSidesAt80}/24.`,
      "scratch/two-digit-hindsight-upper-bound-output.json",
    );
  }

  const contextOracle = readJson("two-digit-context-oracle-upper-bound-output.json");
  if (contextOracle) {
    addFinding(
      findings,
      "Latest-30 context hindsight oracle",
      "hindsight_only",
      contextOracle.avgBestSupportedContextOracleAccuracy,
      `Supported context oracle ${pct(contextOracle.avgBestSupportedContextOracleAccuracy)} with ${contextOracle.supportedMarketSidesAt80}/24 market-sides >=80; not deployable because it sees test outcomes.`,
      "scratch/two-digit-context-oracle-upper-bound-output.json",
    );
  }

  const contextLearner = readJson("two-digit-context-learner-output.json");
  if (contextLearner) {
    addFinding(
      findings,
      "Walk-forward context learner latest window",
      "failed_forward",
      contextLearner.aggregate?.accuracy,
      `Strict ${ratio(contextLearner.aggregate?.correct ?? 0, contextLearner.aggregate?.total ?? 0)}; market-sides >=80: ${contextLearner.aggregate?.marketSidesAt80}/24.`,
      "scratch/two-digit-context-learner-output.json",
    );
  }

  const contextRolling = readJson("two-digit-context-learner-rolling-output.json");
  if (contextRolling) {
    addFinding(
      findings,
      "Walk-forward context learner rolling",
      "failed_stability",
      contextRolling.aggregate?.accuracy,
      `144 folds strict ${ratio(contextRolling.aggregate?.correct ?? 0, contextRolling.aggregate?.total ?? 0)}; folds >=80: ${contextRolling.aggregate?.foldsAt80}/144.`,
      "scratch/two-digit-context-learner-rolling-output.json",
    );
  }

  const frontier = readJson("two-digit-gate-frontier-output.json");
  if (frontier) {
    addFinding(
      findings,
      "Validation gate frontier",
      "no_gate_region",
      frontier.bestCoverageAt60?.accuracy,
      `Gate configs >=80 with >=3 folds: ${frontier.viable80Count}; >=70 with >=3 folds: ${frontier.viable70Count}; best >=60 coverage ${frontier.bestCoverageAt60 ? ratio(frontier.bestCoverageAt60.correct, frontier.bestCoverageAt60.total) : "n/a"}.`,
      "scratch/two-digit-gate-frontier-output.json",
    );
  }

  const bayes = readJson("two-digit-bayesian-gate-output.json");
  if (bayes) {
    addFinding(
      findings,
      "Bayesian lower-bound gate",
      "low_coverage_unstable",
      bayes.selected80Summary?.accuracy,
      `Val>=80,n>=5 strict ${ratio(bayes.selected80Summary?.correct ?? 0, bayes.selected80Summary?.total ?? 0)}; val>=70,n>=5 strict ${ratio(bayes.selected70Summary?.correct ?? 0, bayes.selected70Summary?.total ?? 0)}.`,
      "scratch/two-digit-bayesian-gate-output.json",
    );
  }

  const markov = readJson("two-digit-markov-transition-output.json");
  if (markov) {
    addFinding(
      findings,
      "Markov / transition models",
      "partial_signal_not_target",
      markov.val70?.accuracy,
      `All folds ${ratio(markov.all?.correct ?? 0, markov.all?.total ?? 0)}; val>=70 folds ${ratio(markov.val70?.correct ?? 0, markov.val70?.total ?? 0)}; val>=80 folds ${markov.val80?.folds ?? 0}.`,
      "scratch/two-digit-markov-transition-output.json",
    );
  }

  const markovPocket = readJson("two-digit-markov-pocket-gate-output.json");
  if (markovPocket) {
    const best = markovPocket.bestAccuracyMin30;
    addFinding(
      findings,
      "Markov high-confidence pocket gate",
      "failed_selective_gate",
      best?.aggregate?.accuracy,
      `Tested ${markovPocket.configsTested} validation-mined pocket gates; viable >=80 with >=30 calls: ${markovPocket.viable80Count}; viable >=85 with >=30 calls: ${markovPocket.viable85Count}; best min-30 calls ${best ? ratio(best.aggregate.correct, best.aggregate.total) : "n/a"}.`,
      "scratch/two-digit-markov-pocket-gate-output.json",
    );
  }

  const metaFormula = readJson("two-digit-meta-formula-search-output.json");
  if (metaFormula) {
    addFinding(
      findings,
      "Meta formula search",
      "failed_forward",
      metaFormula.rollingAggregate?.accuracy,
      `Tested ${metaFormula.formulaCount} weighted pair formulas; latest-30 ${ratio(metaFormula.aggregate?.correct ?? 0, metaFormula.aggregate?.total ?? 0)}; rolling folds ${ratio(metaFormula.rollingAggregate?.correct ?? 0, metaFormula.rollingAggregate?.total ?? 0)}; folds >=80: ${metaFormula.rollingAggregate?.foldsAt80 ?? 0}.`,
      "scratch/two-digit-meta-formula-search-output.json",
    );
  }

  const supervised = readJson("two_digit_supervised_ranker_output.json");
  if (supervised) {
    addFinding(
      findings,
      "Supervised pair ranker",
      "failed_latest_window",
      supervised.aggregate?.accuracy,
      `Compact ridge ranker tested ${supervised.methodsTested} learned models; latest-30 ${ratio(supervised.aggregate?.correct ?? 0, supervised.aggregate?.total ?? 0)}; market-sides >=80: ${supervised.aggregate?.at80 ?? 0}; rolling folds skipped due uncached runtime.`,
      "scratch/two_digit_supervised_ranker_output.json",
    );
  }

  const agentGate = readJson("two-digit-agent-arbitration-gate-output.json");
  if (agentGate) {
    const best = agentGate.bestMin30;
    addFinding(
      findings,
      "Agent-style multi-model arbitration gate",
      "failed_agent_gate",
      best?.summary?.accuracy,
      `Aligned ${agentGate.alignedRows} prediction rows across model families; viable >=80 with >=30 calls: ${agentGate.viable80Count}; viable >=85 with >=30 calls: ${agentGate.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-agent-arbitration-gate-output.json",
    );
  }

  const onlineExperts = readJson("two-digit-online-expert-ensemble-output.json");
  if (onlineExperts) {
    const best = onlineExperts.bestMin30;
    addFinding(
      findings,
      "Online adaptive expert ensemble",
      "failed_adaptive_agent",
      best?.summary?.accuracy,
      `Adaptively weighted ${onlineExperts.expertModels} model experts with ${onlineExperts.candidateConfigs} voting configs across ${onlineExperts.forwardFolds} forward folds; viable >=80 with >=30 calls: ${onlineExperts.viable80Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-online-expert-ensemble-output.json",
    );
  }

  const portfolio = readJson("two-digit-portfolio-selector-gate-output.json");
  if (portfolio) {
    const best = portfolio.bestMin30;
    addFinding(
      findings,
      "Validation-selected model portfolio gate",
      "failed_portfolio_gate",
      best?.summary?.accuracy,
      `Tested ${portfolio.configsTested} validation-only portfolio gates across ${portfolio.marketSides} market-sides; viable >=80 with >=30 calls: ${portfolio.viable80Count}; viable >=85 with >=30 calls: ${portfolio.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-portfolio-selector-gate-output.json",
    );
  }

  const rollingPortfolio = readJson("two-digit-rolling-portfolio-selector-output.json");
  if (rollingPortfolio) {
    const best = rollingPortfolio.bestMin30;
    addFinding(
      findings,
      "Rolling validation-selected portfolio stability",
      "failed_stability",
      best?.summary?.accuracy,
      `Tested ${rollingPortfolio.configsTested} rolling portfolio gates across ${rollingPortfolio.groups} grouped forward folds; viable >=80 with >=30 calls: ${rollingPortfolio.viable80Count}; viable >=85 with >=30 calls: ${rollingPortfolio.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-rolling-portfolio-selector-output.json",
    );
  }

  const digitRisk = readJson("two-digit-digit-risk-gate-output.json");
  if (digitRisk) {
    addFinding(
      findings,
      "Digit appearance risk gate",
      "failed_latest_window",
      digitRisk.aggregate?.accuracy,
      `Tested ${digitRisk.baseConfigs} digit-risk formulas with ${digitRisk.gateConfigs} validation gates on latest windows; strict ${ratio(digitRisk.aggregate?.correct ?? 0, digitRisk.aggregate?.total ?? 0)}; folds >=80: ${digitRisk.foldsAt80 ?? 0}/${digitRisk.aggregate?.folds ?? 0}.`,
      "scratch/two-digit-digit-risk-gate-output.json",
    );
  }

  const fixedPair = readJson("two-digit-fixed-pair-rolling-selector-output.json");
  if (fixedPair) {
    const best = fixedPair.bestMin30;
    addFinding(
      findings,
      "Fixed-pair rolling selector",
      "failed_stability",
      best?.summary?.accuracy,
      `Tested ${fixedPair.gateConfigs} rolling fixed-pair gates; viable >=80 with >=30 calls: ${fixedPair.viable80Count}; viable >=85 with >=30 calls: ${fixedPair.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-fixed-pair-rolling-selector-output.json",
    );
  }

  const weekdayPair = readJson("two-digit-weekday-pair-selector-output.json");
  if (weekdayPair) {
    const best = weekdayPair.bestMin30;
    addFinding(
      findings,
      "Weekday-conditioned pair selector",
      "failed_weekday_theory",
      best?.summary?.accuracy,
      `Tested ${weekdayPair.configsTested} market/side/weekday pair gates; viable >=80 with >=30 calls: ${weekdayPair.viable80Count}; viable >=85 with >=30 calls: ${weekdayPair.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-weekday-pair-selector-output.json",
    );
  }

  const calendarBucket = readJson("two-digit-calendar-bucket-selector-output.json");
  if (calendarBucket) {
    const best = calendarBucket.bestMin30;
    addFinding(
      findings,
      "Calendar bucket pair selector",
      "failed_calendar_theory",
      best?.summary?.accuracy,
      `Tested ${calendarBucket.configsTested} calendar bucket pair gates; viable >=80 with >=30 calls: ${calendarBucket.viable80Count}; viable >=85 with >=30 calls: ${calendarBucket.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-calendar-bucket-selector-output.json",
    );
  }

  const houseOpposite = readJson("two-digit-house-opposite-selector-output.json");
  if (houseOpposite) {
    const best = houseOpposite.bestMin30;
    addFinding(
      findings,
      "House/opposite constrained selector",
      "failed_house_opposite_theory",
      best?.summary?.accuracy,
      `Tested ${houseOpposite.configsTested} house/opposite/parity gates; viable >=80 with >=30 calls: ${houseOpposite.viable80Count}; viable >=85 with >=30 calls: ${houseOpposite.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-house-opposite-selector-output.json",
    );
  }

  const suttaBucket = readJson("two-digit-sutta-bucket-selector-output.json");
  if (suttaBucket) {
    const best = suttaBucket.bestMin30;
    addFinding(
      findings,
      "Sutta bucket pair selector",
      "failed_sutta_context",
      best?.summary?.accuracy,
      `Tested ${suttaBucket.configsTested} previous-sutta/jodi bucket gates; viable >=80 with >=30 calls: ${suttaBucket.viable80Count}; viable >=85 with >=30 calls: ${suttaBucket.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-sutta-bucket-selector-output.json",
    );
  }

  const panelShape = readJson("two-digit-panel-shape-selector-output.json");
  if (panelShape) {
    const best = panelShape.bestMin30;
    addFinding(
      findings,
      "Panel-shape bucket selector",
      "failed_panel_shape_context",
      best?.summary?.accuracy,
      `Tested ${panelShape.configsTested} previous-panel shape/kind/root gates; viable >=80 with >=30 calls: ${panelShape.viable80Count}; viable >=85 with >=30 calls: ${panelShape.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-panel-shape-selector-output.json",
    );
  }

  const crossMarket = readJson("two-digit-cross-market-leadlag-selector-output.json");
  if (crossMarket) {
    const best = crossMarket.bestMin30;
    addFinding(
      findings,
      "Cross-market lead/lag selector",
      "failed_cross_market",
      best?.summary?.accuracy,
      `Tested ${crossMarket.gateConfigs} constrained source-market lead/lag gates; viable >=80 with >=30 calls: ${crossMarket.viable80Count}; viable >=85 with >=30 calls: ${crossMarket.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-cross-market-leadlag-selector-output.json",
    );
  }

  const streakCycle = readJson("two-digit-streak-cycle-selector-output.json");
  if (streakCycle) {
    const best = streakCycle.bestMin30;
    addFinding(
      findings,
      "Streak/cycle selector",
      "failed_streak_cycle",
      best?.summary?.accuracy,
      `Tested ${streakCycle.modesTested} streak/cycle modes with ${streakCycle.configsTested} validation gates; viable >=80 with >=30 calls: ${streakCycle.viable80Count}; viable >=85 with >=30 calls: ${streakCycle.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-streak-cycle-selector-output.json",
    );
  }

  const transitionTransform = readJson("two-digit-transition-transform-selector-output.json");
  if (transitionTransform) {
    const best = transitionTransform.bestMin30;
    addFinding(
      findings,
      "Transition-transform selector",
      "failed_transition_transform",
      best?.summary?.accuracy,
      `Tested ${transitionTransform.modesTested} previous-result transform modes with ${transitionTransform.configsTested} validation gates; viable >=80 with >=30 calls: ${transitionTransform.viable80Count}; viable >=85 with >=30 calls: ${transitionTransform.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-transition-transform-selector-output.json",
    );
  }

  const regimeVolatility = readJson("two-digit-regime-volatility-selector-output.json");
  if (regimeVolatility) {
    const best = regimeVolatility.bestMin30;
    addFinding(
      findings,
      "Regime/volatility bucket selector",
      "failed_regime_volatility",
      best?.summary?.accuracy,
      `Tested ${regimeVolatility.configsTested} entropy/coverage/repeat/sum/persistence gates; viable >=80 with >=30 calls: ${regimeVolatility.viable80Count}; viable >=85 with >=30 calls: ${regimeVolatility.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-regime-volatility-selector-output.json",
    );
  }

  const latentRegime = readJson("two-digit-latent-regime-selector-output.json");
  if (latentRegime) {
    const best = latentRegime.bestMin30;
    addFinding(
      findings,
      "Latent-regime clustering selector",
      "failed_latent_regime",
      best?.summary?.accuracy,
      `Tested ${latentRegime.latentConfigs} deterministic latent-state configs across ${latentRegime.forwardFolds} forward folds; viable >=80 with >=30 calls: ${latentRegime.viable80Count}; viable >=85 with >=30 calls: ${latentRegime.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-latent-regime-selector-output.json",
    );
  }

  const changePoint = readJson("two-digit-change-point-selector-output.json");
  if (changePoint) {
    const best = changePoint.bestMin30;
    addFinding(
      findings,
      "Adaptive change-point selector",
      "failed_change_point",
      best?.summary?.accuracy,
      `Tested ${changePoint.predictionConfigs} fixed/EWMA/change-detection configs across ${changePoint.forwardFolds} forward folds; viable >=80 with >=30 calls: ${changePoint.viable80Count}; viable >=85 with >=30 calls: ${changePoint.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-change-point-selector-output.json",
    );
  }

  const forwardRegister = readJson("two-digit-forward-register.json");
  if (forwardRegister) {
    addFinding(
      findings,
      "Forward pre-registration ledger",
      "active_safety_control",
      null,
      `Current calls ${forwardRegister.calls}; no-safe-calls ${forwardRegister.noSafeCalls}; used for future non-hindsight scoring.`,
      "scratch/two-digit-forward-register.json",
    );
  }

  const feasibility = readJson("two-digit-signal-feasibility-audit-output.json");
  if (feasibility) {
    const split = feasibility.temporalFixedPairSplit;
    addFinding(
      findings,
      "Signal feasibility and temporal persistence audit",
      "diagnostic_low_stable_signal",
      split?.accuracy,
      `Empirical uninformed-pair base ${pct(feasibility.empiricalRandomPairAccuracy)}; early-period selected fixed pairs scored ${ratio(split?.correct ?? 0, split?.total ?? 0)} later; same-pair next-result rate after success ${pct(feasibility.pairPersistence?.afterSuccess)} versus ${pct(feasibility.pairPersistence?.afterFailure)} after failure.`,
      "scratch/two-digit-signal-feasibility-audit-output.json",
    );
  }

  const marketGraph = readJson("two-digit-time-ordered-market-graph-output.json");
  if (marketGraph) {
    const best = marketGraph.bestMin30;
    addFinding(
      findings,
      "Time-ordered all-market feature graph",
      "failed_cross_market_graph",
      best?.summary?.accuracy,
      `Tested ${marketGraph.baseModelsAcrossTargets} time-safe source/feature models with ${marketGraph.pairVariantsPerModel} pair variants across ${marketGraph.forwardFolds} forward folds; viable >=80 with >=30 calls: ${marketGraph.viable80Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-time-ordered-market-graph-output.json",
    );
  }

  const marketKnn = readJson("two-digit-multivariate-market-knn-output.json");
  if (marketKnn) {
    const best = marketKnn.bestMin30;
    addFinding(
      findings,
      "Multivariate time-ordered market kNN",
      "failed_multivariate_cross_market",
      best?.summary?.accuracy,
      `Tested ${marketKnn.predictionConfigs} multivariate context/neighbor/risk configs across ${marketKnn.forwardFolds} forward folds; viable >=80 with >=30 calls: ${marketKnn.viable80Count}; viable >=85 with >=30 calls: ${marketKnn.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-multivariate-market-knn-output.json",
    );
  }

  const nonlinearCrossMarket = readJson("two_digit_nonlinear_cross_market_output.json");
  if (nonlinearCrossMarket) {
    const best = nonlinearCrossMarket.bestMin30;
    addFinding(
      findings,
      "Nonlinear supervised cross-market classifier",
      "failed_nonlinear_cross_market",
      best?.summary?.accuracy,
      `Tested ${nonlinearCrossMarket.modelVariants} linear/ReLU/tanh/Fourier target-confidence variants across ${nonlinearCrossMarket.forwardFolds} forward folds; viable >=80 with >=30 calls: ${nonlinearCrossMarket.viable80Count}; viable >=85 with >=30 calls: ${nonlinearCrossMarket.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two_digit_nonlinear_cross_market_output.json",
    );
  }

  const crossMarketForest = readJson("two_digit_cross_market_forest_output.json");
  if (crossMarketForest) {
    const best = crossMarketForest.bestMin30;
    addFinding(
      findings,
      "Cross-market randomized forest",
      "failed_tree_cross_market",
      best?.summary?.accuracy,
      `Tested ${crossMarketForest.modelVariants} randomized-tree target-confidence variants across ${crossMarketForest.forwardFolds} forward folds; viable >=80 with >=30 calls: ${crossMarketForest.viable80Count}; viable >=85 with >=30 calls: ${crossMarketForest.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two_digit_cross_market_forest_output.json",
    );
  }

  const temporalReservoir = readJson("two_digit_temporal_reservoir_output.json");
  if (temporalReservoir) {
    const best = temporalReservoir.bestMin30;
    addFinding(
      findings,
      "Temporal echo-state reservoir",
      "failed_temporal_reservoir",
      best?.summary?.accuracy,
      `Tested ${temporalReservoir.modelVariants} recurrent-dynamics/readout/target-confidence variants across ${temporalReservoir.forwardFolds} forward folds; viable >=80 with >=30 calls: ${temporalReservoir.viable80Count}; viable >=85 with >=30 calls: ${temporalReservoir.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two_digit_temporal_reservoir_output.json",
    );
  }

  const symbolicSequence = readJson("two-digit-symbolic-sequence-selector-output.json");
  if (symbolicSequence) {
    const best = symbolicSequence.bestMin30;
    addFinding(
      findings,
      "Symbolic sequence grammar selector",
      "failed_symbolic_sequence",
      best?.summary?.accuracy,
      `Tested ${symbolicSequence.modelVariants} root/kind/mask/shape/delta sequence variants across ${symbolicSequence.forwardFolds} forward folds; viable >=80 with >=30 calls: ${symbolicSequence.viable80Count}; viable >=85 with >=30 calls: ${symbolicSequence.viable85Count}; best min-30 calls ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}.`,
      "scratch/two-digit-symbolic-sequence-selector-output.json",
    );
  }

  const falseDiscovery = readJson("two-digit-permutation-false-discovery-audit-output.json");
  if (falseDiscovery) {
    const exact = falseDiscovery.portfolioExactPermutation?.minimum30;
    const rolling = falseDiscovery.configurationSearchBootstrap?.find((item) => item.name === "Rolling portfolio");
    addFinding(
      findings,
      "Permutation and false-discovery audit",
      "isolated_significant_not_stable",
      exact?.observed?.accuracy,
      `Exact shuffled-panel p=${exact?.nullPValue?.toFixed(4) ?? "n/a"} for isolated ${ratio(exact?.observed?.correct ?? 0, exact?.observed?.total ?? 0)}; rolling portfolio search p=${rolling?.nullPValue?.toFixed(4) ?? "n/a"}, so the latest pocket is unusual but not temporally durable.`,
      "scratch/two-digit-permutation-false-discovery-audit-output.json",
    );
  }

  const contextWeekdayGuardian = readJson("two-digit-context-weekday-guardian-output.json");
  if (contextWeekdayGuardian) {
    const best = contextWeekdayGuardian.bestMin30;
    const pocket = contextWeekdayGuardian.latestMadhurNightCloseExploratory;
    addFinding(
      findings,
      "Context-weekday abstention guardian",
      "failed_rolling_posthoc_pocket",
      best?.summary?.accuracy,
      `Tested ${contextWeekdayGuardian.guardianConfigs} validation-learned guardian configs across ${contextWeekdayGuardian.forwardFolds} folds; rolling best ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}; exploratory inspected Madhur Night close pocket ${pocket ? ratio(pocket.test.correct, pocket.test.total) : "n/a"} and is not pristine holdout evidence.`,
      "scratch/two-digit-context-weekday-guardian-output.json",
    );
  }

  const exploratoryForward = readJson("two-digit-exploratory-pocket-forward-score-output.json");
  if (exploratoryForward) {
    addFinding(
      findings,
      "Exploratory Madhur Night pocket forward register",
      "active_research_control",
      exploratoryForward.summary?.accuracy,
      `Frozen after ${exploratoryForward.startAfter}; fresh calls ${exploratoryForward.summary?.total ?? 0}; newest source row ${exploratoryForward.newestAvailableDate ?? "n/a"}; promotion eligible: ${exploratoryForward.promotionEligible}.`,
      "scratch/two-digit-exploratory-pocket-forward-score-output.json",
    );
  }

  const contextDurability = readJson("two-digit-context-durability-gate-output.json");
  if (contextDurability) {
    const best = contextDurability.bestMin30;
    const profile = contextDurability.madhurNightLatestProfile;
    addFinding(
      findings,
      "Context multi-block durability gate",
      "isolated_durable_validation_not_target",
      best?.summary?.accuracy,
      `Tested ${contextDurability.configsTested} three-block stability gates across ${contextDurability.forwardFolds} folds; viable >=80 with >=30 calls: ${contextDurability.viable80Count}; best ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}; Madhur Night validation blocks ${profile ? profile.profile.blocks.map((block) => pct(block.accuracy)).join("/") : "n/a"}.`,
      "scratch/two-digit-context-durability-gate-output.json",
    );
  }

  const onlineStoploss = readJson("two-digit-online-regime-stoploss-output.json");
  if (onlineStoploss) {
    const best = onlineStoploss.bestMin30;
    const madhur = onlineStoploss.madhurNightLatest;
    addFinding(
      findings,
      "Online regime continuation / stop-loss gate",
      "failed_online_regime_gate",
      best?.summary?.accuracy,
      `Tested ${onlineStoploss.onlineConfigs} trailing/EWMA/Wilson/failure gates with ${onlineStoploss.selectorGates} validation selectors across ${onlineStoploss.forwardFolds} folds; viable >=80 with >=30 calls: ${onlineStoploss.viable80Count}; rolling best ${best ? ratio(best.summary.correct, best.summary.total) : "n/a"}; Madhur latest ${madhur ? ratio(madhur.test.correct, madhur.test.total) : "n/a"}.`,
      "scratch/two-digit-online-regime-stoploss-output.json",
    );
  }

  const achieved80 = findings.filter((item) => item.status !== "hindsight_only" && (item.strictAccuracy ?? 0) >= 0.8);
  const bestNonHindsight = findings
    .filter((item) => item.strictAccuracy != null && item.status !== "hindsight_only")
    .sort((a, b) => (b.strictAccuracy ?? 0) - (a.strictAccuracy ?? 0))[0] || null;

  const output = {
    generatedAt: new Date().toISOString(),
    findingCount: findings.length,
    achieved80Count: achieved80.length,
    bestNonHindsight,
    findings,
    conclusion: achieved80.length
      ? "At least one non-hindsight artifact reports >=80%; inspect support/coverage before deployment."
      : "No non-hindsight, forward-style experiment has proven a deployable 80-85% strict 2-digit avoid model.",
    nextDirections: [
      "Continue frozen forward registration and scoring on fresh future results.",
      "If more data is acquired, rerun rolling evaluations with larger train/validation/test windows.",
      "Use an AI agent as an auditor/risk controller, not a direct digit oracle.",
      "Do not lower live gates unless a historical forward frontier shows repeated >=80% regions.",
    ],
  };

  fs.writeFileSync(path.join(__dirname, "two-digit-research-master-audit-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Research Master Audit");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Artifacts audited: ${findings.length}`);
  lines.push(`Non-hindsight artifacts proving >=80% strict: ${achieved80.length}`);
  lines.push(`Highest isolated non-hindsight result: ${bestNonHindsight ? `${bestNonHindsight.name} - ${pct(bestNonHindsight.strictAccuracy)}` : "n/a"}`);
  lines.push("");
  lines.push("## Scoreboard");
  lines.push("");
  lines.push("| Experiment | Status | Strict Accuracy | Evidence |");
  lines.push("|---|---|---:|---|");
  for (const item of findings) {
    lines.push(`| ${item.name} | ${item.status} | ${item.strictAccuracy == null ? "n/a" : pct(item.strictAccuracy)} | ${item.details} |`);
  }
  lines.push("");
  lines.push("## Conclusion");
  lines.push("");
  lines.push(output.conclusion);
  lines.push("");
  lines.push("## Next Directions");
  lines.push("");
  for (const direction of output.nextDirections) lines.push(`- ${direction}`);
  lines.push("");
  lines.push("## AI Agent Role");
  lines.push("");
  lines.push("- A language-model agent should review the evidence bundle, reject overfit calls, explain no-call decisions, and enforce pre-registration.");
  lines.push("- It should not directly invent avoid digits from historical rows; that would bypass the statistical gates that protect the user.");
  lines.push("- The safest integration is an audit layer beside the numeric models: model proposes, agent checks evidence, gate decides call/no-call.");

  fs.writeFileSync(path.join(__dirname, "two-digit-research-master-audit.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
