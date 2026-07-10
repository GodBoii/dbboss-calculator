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

function panelKind(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) count++;
  if (count === 1) return "TP";
  if (count === 2) return "DP";
  return "SP";
}

function digitsOf(mask) {
  const digits = [];
  for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) digits.push(digit);
  return digits.join("");
}

function suttaFor(row, side) {
  return side === "open" ? row.record.openSutta : row.record.closeSutta;
}

function stateFor(rows, side, index, mode) {
  if (index <= 0) return "START";
  const prev = rows[index - 1];
  const prev2 = rows[index - 2] || null;
  const oppositeSide = side === "open" ? "close" : "open";
  const sameMask = maskFor(panelFor(prev, side));
  const oppMask = maskFor(panelFor(prev, oppositeSide));
  if (mode === "prev_digits") return digitsOf(sameMask);
  if (mode === "prev_kind") return panelKind(sameMask);
  if (mode === "prev_sutta") return String(suttaFor(prev, side));
  if (mode === "prev_opp_digits") return digitsOf(oppMask);
  if (mode === "prev_opp_kind") return panelKind(oppMask);
  if (mode === "prev_opp_sutta") return String(suttaFor(prev, oppositeSide));
  if (mode === "prev_kind_sutta") return `${panelKind(sameMask)}:${suttaFor(prev, side)}`;
  if (mode === "prev_opp_kind_sutta") return `${panelKind(oppMask)}:${suttaFor(prev, oppositeSide)}`;
  if (mode === "two_step_kind") {
    const prev2Mask = prev2 ? maskFor(panelFor(prev2, side)) : 0;
    return `${panelKind(prev2Mask)}>${panelKind(sameMask)}`;
  }
  if (mode === "two_step_sutta") {
    return `${prev2 ? suttaFor(prev2, side) : "x"}>${suttaFor(prev, side)}`;
  }
  return "all";
}

function trainModel(rows, side, start, end, config) {
  const global = PAIRS.map((pair) => ({ pair, n: 0, ok: 0 }));
  const states = new Map();
  for (let index = start; index < end; index++) {
    const state = stateFor(rows, side, index, config.mode);
    if (!states.has(state)) states.set(state, PAIRS.map((pair) => ({ pair, n: 0, ok: 0 })));
    const stats = states.get(state);
    const actualMask = maskFor(panelFor(rows[index], side));
    for (let i = 0; i < PAIRS.length; i++) {
      const ok = isAbsentPair(PAIRS[i], actualMask) ? 1 : 0;
      stats[i].n++;
      stats[i].ok += ok;
      global[i].n++;
      global[i].ok += ok;
    }
  }
  return { ...config, states, global };
}

function bestPair(stats, minSupport, shrink, globalRateByPair) {
  return stats
    .filter((stat) => stat.n >= minSupport)
    .map((stat) => {
      const prior = globalRateByPair.get(stat.pair.key) ?? 0.55;
      return {
        ...stat,
        rate: (stat.ok + shrink * prior) / (stat.n + shrink),
        rawRate: stat.ok / stat.n,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.n - a.n)[0] || null;
}

function predict(rows, side, index, model) {
  const globalRateByPair = new Map(model.global.map((stat) => [stat.pair.key, stat.ok / Math.max(1, stat.n)]));
  const state = stateFor(rows, side, index, model.mode);
  const stateStats = model.states.get(state);
  const statePick = stateStats ? bestPair(stateStats, model.minSupport, model.shrink, globalRateByPair) : null;
  if (statePick) return { pair: statePick.pair, state, source: "state", rate: statePick.rate, n: statePick.n };
  if (!model.allowGlobal) return null;
  const globalPick = bestPair(model.global, model.minSupport, model.shrink, globalRateByPair);
  return globalPick ? { pair: globalPick.pair, state, source: "global", rate: globalPick.rate, n: globalPick.n } : null;
}

function evalModel(rows, side, start, end, model) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (let index = start; index < end; index++) {
    const pred = predict(rows, side, index, model);
    if (!pred) continue;
    const actualMask = maskFor(panelFor(rows[index], side));
    const hit = isAbsentPair(pred.pair, actualMask);
    const absentDigits = absentDigitCount(pred.pair, actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({ date: rows[index].isoDate, pair: pred.pair.key, hit, absentDigits, state: pred.state, source: pred.source });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const modes = [
    "prev_kind",
    "prev_sutta",
    "prev_opp_kind",
    "prev_opp_sutta",
    "prev_opp_kind_sutta",
    "two_step_sutta",
  ];
  const configs = [];
  for (const mode of modes) {
    for (const trainLookback of [240, 365]) {
      for (const minSupport of [5, 8]) {
        for (const shrink of [0, 5]) {
          for (const allowGlobal of [false, true]) configs.push({ mode, trainLookback, minSupport, shrink, allowGlobal });
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
          const model = trainModel(rows, side, trainStart, valStart, config);
          const val = evalModel(rows, side, valStart, valEnd, model);
          if (val.total < 10) continue;
          const score = val.accuracy * 1000 + val.avgCorrectDigits * 20 + Math.min(val.total, 30);
          if (!best || score > best.score) best = { config, model, val, score };
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
      foldsAt70: items.filter((fold) => fold.test.accuracy >= 0.7).length,
      foldsAt80: items.filter((fold) => fold.test.accuracy >= 0.8).length,
    };
  };
  const all = summarize(folds);
  const val70 = summarize(folds.filter((fold) => fold.val.accuracy >= 0.7));
  const val80 = summarize(folds.filter((fold) => fold.val.accuracy >= 0.8));
  const output = { generatedAt: new Date().toISOString(), configs: configs.length, folds: folds.length, all, val70, val80, folds };
  fs.writeFileSync(path.join(__dirname, "two-digit-markov-transition-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Markov Transition Models");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Configs tested: ${configs.length}`);
  lines.push(`Forward folds: ${folds.length}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- All validation-selected folds: ${pct(all.accuracy)} (${all.correct}/${all.total}), folds=${all.folds}, >=80 folds=${all.foldsAt80}`);
  lines.push(`- Val >=70% folds: ${val70.total ? pct(val70.accuracy) : "n/a"} (${val70.correct}/${val70.total}), folds=${val70.folds}, >=80 folds=${val70.foldsAt80}`);
  lines.push(`- Val >=80% folds: ${val80.total ? pct(val80.accuracy) : "n/a"} (${val80.correct}/${val80.total}), folds=${val80.folds}, >=80 folds=${val80.foldsAt80}`);
  lines.push("");
  lines.push("## Top Test Folds");
  lines.push("");
  lines.push("| Market | Side | Window | Val | Test | Coverage | Config |");
  lines.push("|---|---|---|---:|---:|---:|---|");
  for (const fold of [...folds].sort((a, b) => b.test.accuracy - a.test.accuracy || b.val.accuracy - a.val.accuracy).slice(0, 30)) {
    const c = fold.config;
    lines.push(`| ${fold.market} | ${fold.side} | ${fold.testWindow} | ${pct(fold.val.accuracy)} (${fold.val.correct}/${fold.val.total}) | ${fold.test.total ? pct(fold.test.accuracy) : "n/a"} (${fold.test.correct}/${fold.test.total}) | ${fold.test.total}/30 | ${c.mode}; train=${c.trainLookback}; support=${c.minSupport}; shrink=${c.shrink}; global=${c.allowGlobal} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- These models learn previous-state to avoid-pair transition tables.");
  lines.push("- A useful transition model should keep high validation folds high on the following test window.");
  lines.push("- Low coverage high scores are not enough unless they repeat across folds.");
  fs.writeFileSync(path.join(__dirname, "two-digit-markov-transition.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
