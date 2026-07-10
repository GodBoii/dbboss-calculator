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
const { EVENT_TIME, availableEvents } = require("./two-digit-time-ordered-market-graph.cjs");

function popcount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) count += mask & (1 << digit) ? 1 : 0;
  return count;
}

function stateFor(row, side) {
  const panel = String(panelFor(row, side) || "");
  if (!/^\d{3}$/.test(panel)) return null;
  const mask = maskFor(panel);
  const sum = [...panel].reduce((total, digit) => total + Number(digit), 0);
  return { mask, root: sum % 10, kind: popcount(mask), sum: sum / 27 };
}

function eventScope(events, targetTime, scope) {
  if (scope === "latest2") return events.slice(-2);
  if (scope === "latest4") return events.slice(-4);
  if (scope === "latest8") return events.slice(-8);
  if (scope === "opens_only") return events.filter((event) => event.side === "open");
  if (scope === "same_session") return events.filter((event) => targetTime >= 1100 ? event.time >= 1100 : event.time < 1100);
  return events;
}

function contextFor(dateMaps, events, isoDate) {
  return events.map((event) => {
    const row = dateMaps[event.market]?.get(isoDate);
    return row ? stateFor(row, event.side) : null;
  });
}

function circularRootDistance(a, b) {
  const delta = Math.abs(a - b);
  return Math.min(delta, 10 - delta) / 5;
}

function contextDistance(a, b, featureMode, recencyMode) {
  let total = 0;
  let weightTotal = 0;
  for (let index = 0; index < a.length; index++) {
    const weight = recencyMode === "recent" ? (index + 1) / a.length : 1;
    weightTotal += weight;
    if (!a[index] && !b[index]) continue;
    if (!a[index] || !b[index]) {
      total += weight;
      continue;
    }
    const union = popcount(a[index].mask | b[index].mask);
    const digitDistance = union ? 1 - popcount(a[index].mask & b[index].mask) / union : 0;
    const rootDistance = circularRootDistance(a[index].root, b[index].root);
    const kindDistance = a[index].kind === b[index].kind ? 0 : 1;
    const sumDistance = Math.abs(a[index].sum - b[index].sum);
    let distance = digitDistance;
    if (featureMode === "root_kind") distance = rootDistance * 0.65 + kindDistance * 0.35;
    if (featureMode === "combined") distance = digitDistance * 0.5 + rootDistance * 0.25 + kindDistance * 0.15 + sumDistance * 0.1;
    total += weight * distance;
  }
  return weightTotal ? total / weightTotal : 1;
}

function sortedNeighbors(queryContext, pool, featureMode, recencyMode) {
  return pool
    .map((item) => ({ ...item, distance: contextDistance(queryContext, item.context, featureMode, recencyMode) }))
    .sort((a, b) => a.distance - b.distance || a.isoDate.localeCompare(b.isoDate));
}

function predict(neighbors, k, neighborWeight, scoreMode) {
  const digitPresent = Array(10).fill(0);
  const pairCorrect = Array(PAIRS.length).fill(0);
  let totalWeight = 0;
  for (const neighbor of neighbors.slice(0, k)) {
    const weight = neighborWeight === "inverse" ? 1 / Math.max(0.05, neighbor.distance + 0.05) : 1;
    totalWeight += weight;
    for (let digit = 0; digit <= 9; digit++) if (neighbor.mask & (1 << digit)) digitPresent[digit] += weight;
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) if (isAbsentPair(PAIRS[pairIndex], neighbor.mask)) pairCorrect[pairIndex] += weight;
  }
  if (!totalWeight) return -1;
  let best = null;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const pair = PAIRS[pairIndex];
    const joint = pairCorrect[pairIndex] / totalWeight;
    const riskA = digitPresent[pair.digits[0]] / totalWeight;
    const riskB = digitPresent[pair.digits[1]] / totalWeight;
    const score = scoreMode === "joint" ? joint : -Math.max(riskA, riskB) - (riskA + riskB) / 100;
    if (!best || score > best.score) best = { pairIndex, score };
  }
  return best.pairIndex;
}

function evaluateQueries(queries, config) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (const query of queries) {
    const neighbors = query.neighbors.get(config.baseKey);
    const pairIndex = predict(neighbors, config.k, config.neighborWeight, config.scoreMode);
    if (pairIndex < 0) continue;
    correct += isAbsentPair(PAIRS[pairIndex], query.mask) ? 1 : 0;
    digitCorrect += absentDigitCount(PAIRS[pairIndex], query.mask);
    total++;
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0 };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, folds: folds.length };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const dateMaps = Object.fromEntries(MARKETS.map((market) => [market, new Map(rowsByMarket[market].map((row) => [row.isoDate, row]))]));
  const baseConfigs = [];
  for (const scope of ["all", "latest2", "latest4", "latest8", "opens_only", "same_session"]) {
    for (const featureMode of ["digits", "root_kind", "combined"]) {
      for (const recencyMode of ["uniform", "recent"]) baseConfigs.push({ scope, featureMode, recencyMode, key: `${scope}|${featureMode}|${recencyMode}` });
    }
  }
  const configs = [];
  for (const base of baseConfigs) {
    for (const k of [5, 10, 20, 30, 50, 75]) {
      for (const neighborWeight of ["uniform", "inverse"]) {
        for (const scoreMode of ["joint", "minimax"]) configs.push({ baseKey: base.key, k, neighborWeight, scoreMode });
      }
    }
  }
  const gates = [0.55, 0.6, 0.65, 0.7, 0.8].map((minValAccuracy) => ({ minValCalls: 60, minValAccuracy }));
  const foldData = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const allEvents = availableEvents(market, side);
      if (!allEvents.length) continue;
      const targetTime = EVENT_TIME[`${market}|${side}`];
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= 360 && foldCount < 2; testStart -= 30, foldCount++) {
        const valStart = testStart - 90;
        const trainStart = Math.max(0, valStart - 365);
        const scopedContexts = new Map();
        for (const base of baseConfigs) {
          const events = eventScope(allEvents, targetTime, base.scope);
          const mapKey = base.scope;
          if (!scopedContexts.has(mapKey)) scopedContexts.set(mapKey, rows.map((row) => contextFor(dateMaps, events, row.isoDate)));
        }
        const makePool = (start, end, scope) => {
          const contexts = scopedContexts.get(scope);
          return rows.slice(start, end).map((row, offset) => ({ isoDate: row.isoDate, context: contexts[start + offset], mask: maskFor(panelFor(row, side)) }));
        };
        const validationQueries = rows.slice(valStart, testStart).map((row, offset) => ({ isoDate: row.isoDate, mask: maskFor(panelFor(row, side)), index: valStart + offset, neighbors: new Map() }));
        const testQueries = rows.slice(testStart, testStart + 30).map((row, offset) => ({ isoDate: row.isoDate, mask: maskFor(panelFor(row, side)), index: testStart + offset, neighbors: new Map() }));
        for (const base of baseConfigs) {
          const contexts = scopedContexts.get(base.scope);
          const trainPool = makePool(trainStart, valStart, base.scope);
          const refitPool = makePool(trainStart, testStart, base.scope);
          for (const query of validationQueries) query.neighbors.set(base.key, sortedNeighbors(contexts[query.index], trainPool, base.featureMode, base.recencyMode));
          for (const query of testQueries) query.neighbors.set(base.key, sortedNeighbors(contexts[query.index], refitPool, base.featureMode, base.recencyMode));
        }
        const candidates = configs.map((config) => ({ config, validation: evaluateQueries(validationQueries, config), test: evaluateQueries(testQueries, config) }));
        foldData.push({ market, side, testWindow: `${rows[testStart].isoDate}..${rows[testStart + 29].isoDate}`, candidates });
      }
    }
  }
  const results = gates.map((gate) => {
    const folds = [];
    for (const fold of foldData) {
      const best = fold.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.avgCorrectDigits - a.validation.avgCorrectDigits)[0];
      if (best) folds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, config: best.config, validation: best.validation, test: best.test });
    }
    return { gate, summary: summarize(folds), folds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = {
    generatedAt: new Date().toISOString(),
    baseRepresentations: baseConfigs.length,
    predictionConfigs: configs.length,
    forwardFolds: foldData.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-multivariate-market-knn-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Multivariate Market kNN",
    "",
    `Generated: ${output.generatedAt}`,
    `Base context representations: ${output.baseRepresentations}`,
    `Prediction configurations: ${output.predictionConfigs}`,
    `Forward folds: ${output.forwardFolds}`,
    `Viable >=80% gates with >=30 calls: ${output.viable80Count}`,
    `Viable >=85% gates with >=30 calls: ${output.viable85Count}`,
    "",
    "## Best Gates",
    "",
    "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    else lines.push(`| ${name}: validation calls>=${item.gate.minValCalls}, validation>=${pct(item.gate.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "- Each market-day context contains only same-day events published before the target event under the conservative schedule.",
    "- Historical neighbors combine digit-mask similarity, circular sutta/root distance, panel kind, sum, event scope, and recency weighting.",
    "- Configuration selection uses training-to-validation predictions; test neighbors are drawn only from dates completed before the test date.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-multivariate-market-knn.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
