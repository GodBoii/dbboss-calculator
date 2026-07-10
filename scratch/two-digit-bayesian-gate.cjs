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
const { contextValue } = require("./two-digit-context-learner.cjs");

const MODES = [
  "weekday",
  "prev_opp_sutta",
  "prev_opp_kind",
  "prev_opp_house_shape",
];

function wilsonLower(ok, n, z) {
  if (n <= 0) return 0;
  const phat = ok / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = phat + z2 / (2 * n);
  const margin = z * Math.sqrt((phat * (1 - phat) + z2 / (4 * n)) / n);
  return (center - margin) / denom;
}

function trainStats(rows, side, start, end, mode) {
  const byContext = new Map();
  const global = PAIRS.map((pair) => ({ pair, n: 0, ok: 0 }));
  for (let index = start; index < end; index++) {
    const key = contextValue(rows, side, index, mode);
    if (!byContext.has(key)) byContext.set(key, PAIRS.map((pair) => ({ pair, n: 0, ok: 0 })));
    const stats = byContext.get(key);
    const mask = maskFor(panelFor(rows[index], side));
    for (let i = 0; i < PAIRS.length; i++) {
      const ok = isAbsentPair(PAIRS[i], mask) ? 1 : 0;
      stats[i].n++;
      stats[i].ok += ok;
      global[i].n++;
      global[i].ok += ok;
    }
  }
  return { byContext, global };
}

function bestByLower(stats, minSupport, z, minLower) {
  const ranked = stats
    .filter((item) => item.n >= minSupport)
    .map((item) => ({
      ...item,
      rate: item.ok / item.n,
      lower: wilsonLower(item.ok, item.n, z),
    }))
    .sort((a, b) => b.lower - a.lower || b.rate - a.rate || b.n - a.n);
  const best = ranked[0];
  if (!best || best.lower < minLower) return null;
  return best;
}

function predictForIndex(rows, side, index, model) {
  const key = contextValue(rows, side, index, model.mode);
  const contextStats = model.stats.byContext.get(key);
  const contextPick = contextStats ? bestByLower(contextStats, model.minSupport, model.z, model.minLower) : null;
  if (contextPick) return { pair: contextPick.pair, source: "context", lower: contextPick.lower, n: contextPick.n, key };
  if (!model.allowGlobal) return null;
  const globalPick = bestByLower(model.stats.global, model.minSupport, model.z, model.minLower);
  if (!globalPick) return null;
  return { pair: globalPick.pair, source: "global", lower: globalPick.lower, n: globalPick.n, key };
}

function evalModel(rows, side, start, end, model) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (let index = start; index < end; index++) {
    const pred = predictForIndex(rows, side, index, model);
    if (!pred) continue;
    const actualMask = maskFor(panelFor(rows[index], side));
    const hit = isAbsentPair(pred.pair, actualMask);
    const absentDigits = absentDigitCount(pred.pair, actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({ date: rows[index].isoDate, pair: pred.pair.key, hit, absentDigits, source: pred.source, lower: pred.lower, n: pred.n, key: pred.key });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function makeModel(rows, side, trainStart, trainEnd, config) {
  return {
    ...config,
    stats: trainStats(rows, side, trainStart, trainEnd, config.mode),
  };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const configs = [];
  for (const mode of MODES) {
    for (const trainLookback of [365]) {
      for (const minSupport of [8, 16]) {
        for (const z of [1.28]) {
          for (const minLower of [0.6, 0.65]) {
            for (const allowGlobal of [false, true]) configs.push({ mode, trainLookback, minSupport, z, minLower, allowGlobal });
          }
        }
      }
    }
  }

  const folds = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      for (const testEnd of [rows.length, rows.length - 30, rows.length - 60]) {
        const testStart = testEnd - 30;
        const valEnd = testStart;
        const valStart = valEnd - 90;
        if (testStart < 0 || valStart < 180) continue;
        let best = null;
        for (const config of configs) {
          const trainStart = Math.max(0, valStart - config.trainLookback);
          if (valStart - trainStart < 120) continue;
          const model = makeModel(rows, side, trainStart, valStart, config);
          const val = evalModel(rows, side, valStart, valEnd, model);
          if (val.total < 3) continue;
          const score = val.accuracy * 1000 + Math.min(val.total, 20) + val.avgCorrectDigits * 10 - Math.max(0, 8 - val.total) * 10;
          if (!best || score > best.score) best = { config, trainStart, model, val, score };
        }
        if (!best) continue;
        const test = evalModel(rows, side, testStart, testEnd, best.model);
        folds.push({
          market,
          side,
          testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`,
          config: best.config,
          val: best.val,
          test,
        });
      }
    }
  }

  const selected80 = folds.filter((fold) => fold.val.accuracy >= 0.8 && fold.val.total >= 5);
  const selected70 = folds.filter((fold) => fold.val.accuracy >= 0.7 && fold.val.total >= 5);
  const summarize = (items) => {
    const total = items.reduce((sum, fold) => sum + fold.test.total, 0);
    const correct = items.reduce((sum, fold) => sum + fold.test.correct, 0);
    const digitCorrect = items.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
    return {
      folds: items.length,
      total,
      correct,
      accuracy: total ? correct / total : 0,
      avgCorrectDigits: total ? digitCorrect / total : 0,
      foldsAt80: items.filter((fold) => fold.test.total && fold.test.accuracy >= 0.8).length,
    };
  };
  const allSummary = summarize(folds);
  const selected80Summary = summarize(selected80);
  const selected70Summary = summarize(selected70);

  const output = {
    generatedAt: new Date().toISOString(),
    configs: configs.length,
    folds: folds.length,
    allSummary,
    selected80Summary,
    selected70Summary,
    folds,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-bayesian-gate-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Bayesian Lower-Bound Gate");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Configs tested: ${configs.length}`);
  lines.push(`Forward folds: ${folds.length}`);
  lines.push("");
  lines.push("## Validation-Gated Results");
  lines.push("");
  lines.push(`- All selected best folds: ${pct(allSummary.accuracy)} (${allSummary.correct}/${allSummary.total}), folds=${allSummary.folds}, >=80 test folds=${allSummary.foldsAt80}`);
  lines.push(`- Val >=80% and n>=5: ${selected80Summary.total ? pct(selected80Summary.accuracy) : "n/a"} (${selected80Summary.correct}/${selected80Summary.total}), folds=${selected80Summary.folds}, >=80 test folds=${selected80Summary.foldsAt80}`);
  lines.push(`- Val >=70% and n>=5: ${selected70Summary.total ? pct(selected70Summary.accuracy) : "n/a"} (${selected70Summary.correct}/${selected70Summary.total}), folds=${selected70Summary.folds}, >=80 test folds=${selected70Summary.foldsAt80}`);
  lines.push("");
  lines.push("## Top Test Folds");
  lines.push("");
  lines.push("| Market | Side | Window | Val | Test | Coverage | Config |");
  lines.push("|---|---|---|---:|---:|---:|---|");
  for (const fold of [...folds].sort((a, b) => b.test.accuracy - a.test.accuracy || b.val.accuracy - a.val.accuracy).slice(0, 30)) {
    const c = fold.config;
    lines.push(`| ${fold.market} | ${fold.side} | ${fold.testWindow} | ${pct(fold.val.accuracy)} (${fold.val.correct}/${fold.val.total}) | ${fold.test.total ? pct(fold.test.accuracy) : "n/a"} (${fold.test.correct}/${fold.test.total}) | ${fold.test.total}/30 | ${c.mode}; train=${c.trainLookback}; support=${c.minSupport}; lower>=${c.minLower}; z=${c.z}; global=${c.allowGlobal} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This model only predicts when a context/pair has enough support and a high lower-confidence bound.");
  lines.push("- If high validation folds do not retain high test accuracy, the lower-bound evidence is still unstable.");
  lines.push("- Rows with low coverage are safe-call candidates only if their forward test accuracy is repeatedly high.");
  fs.writeFileSync(path.join(__dirname, "two-digit-bayesian-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
