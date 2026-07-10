/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const {
  MARKETS,
  PAIRS,
  dated,
  panelFor,
  maskFor,
  isAbsentPair,
  absentDigitCount,
  pct,
} = require("./two-digit-deep-research-runner.cjs");
const { loadCandidates, runConfig } = require("./two-digit-portfolio-selector-gate.cjs");

function rngFactory(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle(values, rng) {
  const output = values.slice();
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function portfolioConfigs() {
  const configs = [];
  for (const minValAccuracy of [0, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
    for (const minValN of [20, 30, 60, 90]) {
      for (const digitWeight of [0, 10, 25, 50]) configs.push({ minValAccuracy, minValN, digitWeight });
    }
  }
  return configs;
}

function actualMasksByKey() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const output = new Map();
  for (const market of MARKETS) {
    const rows = dated(raw[market] || []).slice(-30);
    for (const side of ["open", "close"]) {
      output.set(`${market}|${side}`, new Map(rows.map((row) => [row.isoDate, maskFor(panelFor(row, side))])));
    }
  }
  return output;
}

function permutedCandidates(source, actualMasks, rng) {
  const output = new Map();
  for (const [key, list] of source.entries()) {
    const actual = actualMasks.get(key);
    const dates = [...actual.keys()];
    const shuffledMasks = shuffle([...actual.values()], rng);
    const maskByDate = new Map(dates.map((date, index) => [date, shuffledMasks[index]]));
    output.set(key, list.map((item) => ({
      ...item,
      predictions: (item.predictions || []).map((prediction) => {
        const mask = maskByDate.get(prediction.date);
        const digits = String(prediction.pair || "").match(/\d/g)?.map(Number) || [];
        const pair = digits.length >= 2 ? PAIRS.find((candidate) => candidate.digits[0] === Math.min(digits[0], digits[1]) && candidate.digits[1] === Math.max(digits[0], digits[1])) : null;
        if (mask == null || !pair) return prediction;
        return { ...prediction, hit: isAbsentPair(pair, mask), absentDigits: absentDigitCount(pair, mask) };
      }),
    })));
  }
  return output;
}

function bestPortfolio(candidates, configs, minimum) {
  let best = null;
  for (const config of configs) {
    const result = runConfig(candidates, config);
    if (result.summary.total < minimum) continue;
    if (!best || result.summary.accuracy > best.accuracy || (result.summary.accuracy === best.accuracy && result.summary.total > best.total)) best = result.summary;
  }
  return best;
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function normal(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function binomial(n, p, rng) {
  if (n <= 120) {
    let correct = 0;
    for (let i = 0; i < n; i++) correct += rng() < p ? 1 : 0;
    return correct;
  }
  const mean = n * p;
  const std = Math.sqrt(n * p * (1 - p));
  return Math.max(0, Math.min(n, Math.round(mean + std * normal(rng))));
}

function searchBootstrap(name, file, observedField, rng, repetitions, baseRate) {
  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8"));
  const observed = artifact[observedField]?.summary;
  const totals = (artifact.results || []).map((item) => item.summary?.total || 0).filter((total) => total >= 30);
  if (!observed || !totals.length) return null;
  const maxima = [];
  let atLeastObserved = 0;
  for (let repetition = 0; repetition < repetitions; repetition++) {
    let best = 0;
    for (const total of totals) best = Math.max(best, binomial(total, baseRate, rng) / total);
    maxima.push(best);
    if (best >= observed.accuracy) atLeastObserved++;
  }
  maxima.sort((a, b) => a - b);
  return {
    name,
    configurations: totals.length,
    observedCorrect: observed.correct,
    observedTotal: observed.total,
    observedAccuracy: observed.accuracy,
    nullPValue: (atLeastObserved + 1) / (repetitions + 1),
    nullBestP90: quantile(maxima, 0.9),
    nullBestP95: quantile(maxima, 0.95),
    nullBestP99: quantile(maxima, 0.99),
    note: "Conservative independent-configuration bootstrap; real configurations overlap.",
  };
}

function run() {
  const rng = rngFactory(20260710);
  const repetitions = 2000;
  const candidates = loadCandidates();
  const configs = portfolioConfigs();
  const actualMasks = actualMasksByKey();
  const observed30 = bestPortfolio(candidates, configs, 30);
  const observed120 = bestPortfolio(candidates, configs, 120);
  const null30 = [];
  const null120 = [];
  let exceed30 = 0;
  let exceed120 = 0;
  for (let repetition = 0; repetition < repetitions; repetition++) {
    const permuted = permutedCandidates(candidates, actualMasks, rng);
    const best30 = bestPortfolio(permuted, configs, 30);
    const best120 = bestPortfolio(permuted, configs, 120);
    null30.push(best30?.accuracy || 0);
    null120.push(best120?.accuracy || 0);
    if ((best30?.accuracy || 0) >= observed30.accuracy) exceed30++;
    if ((best120?.accuracy || 0) >= observed120.accuracy) exceed120++;
  }
  null30.sort((a, b) => a - b);
  null120.sort((a, b) => a - b);
  const baseRate = 0.506181479956696;
  const bootstrapArtifacts = [
    ["Rolling portfolio", "two-digit-rolling-portfolio-selector-output.json", "bestMin30"],
    ["Regime/volatility", "two-digit-regime-volatility-selector-output.json", "bestMin30"],
    ["Latent regime", "two-digit-latent-regime-selector-output.json", "bestMin30"],
    ["Randomized forest", "two_digit_cross_market_forest_output.json", "bestMin30"],
    ["Temporal reservoir", "two_digit_temporal_reservoir_output.json", "bestMin30"],
  ].map(([name, file, field]) => searchBootstrap(name, file, field, rng, repetitions, baseRate)).filter(Boolean);

  const output = {
    generatedAt: new Date().toISOString(),
    repetitions,
    portfolioExactPermutation: {
      minimum30: {
        observed: observed30,
        nullPValue: (exceed30 + 1) / (repetitions + 1),
        nullBestP90: quantile(null30, 0.9),
        nullBestP95: quantile(null30, 0.95),
        nullBestP99: quantile(null30, 0.99),
      },
      minimum120: {
        observed: observed120,
        nullPValue: (exceed120 + 1) / (repetitions + 1),
        nullBestP90: quantile(null120, 0.9),
        nullBestP95: quantile(null120, 0.95),
        nullBestP99: quantile(null120, 0.99),
      },
    },
    configurationSearchBootstrap: bootstrapArtifacts,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-permutation-false-discovery-audit-output.json"), JSON.stringify(output, null, 2));
  const p30 = output.portfolioExactPermutation.minimum30;
  const p120 = output.portfolioExactPermutation.minimum120;
  const lines = [
    "# Two-Digit Permutation / False-Discovery Audit",
    "",
    `Generated: ${output.generatedAt}`,
    `Null repetitions: ${repetitions}`,
    "",
    "## Exact Portfolio Outcome Permutation",
    "",
    "| Coverage | Observed best | Null p-value | Null best p90 | p95 | p99 |",
    "|---|---:|---:|---:|---:|---:|",
    `| >=30 calls | ${pct(p30.observed.accuracy)} (${p30.observed.correct}/${p30.observed.total}) | ${p30.nullPValue.toFixed(4)} | ${pct(p30.nullBestP90)} | ${pct(p30.nullBestP95)} | ${pct(p30.nullBestP99)} |`,
    `| >=120 calls | ${pct(p120.observed.accuracy)} (${p120.observed.correct}/${p120.observed.total}) | ${p120.nullPValue.toFixed(4)} | ${pct(p120.nullBestP90)} | ${pct(p120.nullBestP95)} | ${pct(p120.nullBestP99)} |`,
    "",
    "## Configuration-Search Bootstrap",
    "",
    "| Family | Searched configs | Observed | Null p-value | Null best p95 | Null best p99 |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const item of bootstrapArtifacts) lines.push(`| ${item.name} | ${item.configurations} | ${pct(item.observedAccuracy)} (${item.observedCorrect}/${item.observedTotal}) | ${item.nullPValue.toFixed(4)} | ${pct(item.nullBestP95)} | ${pct(item.nullBestP99)} |`);
  lines.push(
    "",
    "## Interpretation",
    "",
    "- Exact permutation preserves every portfolio prediction, validation decision, market-side panel mix, and call count while breaking date-to-prediction alignment.",
    "- The bootstrap asks how often broad configuration search can produce an equally high best pocket from a 50.6% null process.",
    "- A large null p-value means the observed pocket is compatible with search luck and should not be promoted as an 80% model.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-permutation-false-discovery-audit.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
