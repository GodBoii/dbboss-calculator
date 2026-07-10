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

const SOURCE_MARKET = {
  "Time Bazar": "Sridevi",
  "Madhur Day": "Time Bazar",
  "Milan Day": "Madhur Day",
  "Rajdhani Day": "Milan Day",
  Kalyan: "Rajdhani Day",
  "Kalyan Night": "Sridevi Night",
  "Madhur Night": "Kalyan Night",
  "Milan Night": "Madhur Night",
  "Rajdhani Night": "Milan Night",
  "Main Bazar": "Rajdhani Night",
};

function indexBefore(rows, isoDate) {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (rows[mid].isoDate < isoDate) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pairAbsenceRate(rows, side, end, lookback, pair) {
  const start = Math.max(0, end - lookback);
  let correct = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const mask = maskFor(panelFor(rows[index], side));
    correct += isAbsentPair(pair, mask) ? 1 : 0;
    total++;
  }
  return { correct, total, accuracy: total ? correct / total : 0 };
}

function pickSourcePair(sourceRows, sourceSide, sourceEnd, lookback) {
  let best = null;
  for (const pair of PAIRS) {
    const stat = pairAbsenceRate(sourceRows, sourceSide, sourceEnd, lookback, pair);
    if (stat.total < Math.min(lookback, 10)) continue;
    const score = stat.accuracy * 1000 + stat.total / 100;
    if (!best || score > best.score) best = { pair, stat, score };
  }
  return best?.pair || null;
}

function evalConfig(rowsByMarket, market, side, start, end, config) {
  const targetRows = rowsByMarket[market];
  const sourceRows = rowsByMarket[config.sourceMarket];
  const calls = [];
  for (let index = start; index < end; index++) {
    const sourceEndBase = indexBefore(sourceRows, targetRows[index].isoDate);
    const sourceEnd = Math.max(0, sourceEndBase - config.lag);
    const pair = pickSourcePair(sourceRows, config.sourceSide, sourceEnd, config.lookback);
    if (!pair) continue;
    const mask = maskFor(panelFor(targetRows[index], side));
    const hit = isAbsentPair(pair, mask);
    const absentDigits = absentDigitCount(pair, mask);
    calls.push({ date: targetRows[index].isoDate, pair: pair.key, hit, absentDigits });
  }
  const total = calls.length;
  const correct = calls.filter((call) => call.hit).length;
  const digitCorrect = calls.reduce((sum, call) => sum + call.absentDigits, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    calls,
  };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    folds: folds.length,
  };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const gateConfigs = [];
  for (const lookback of [30, 60, 90]) {
    for (const lag of [0, 1, 2]) {
      for (const minValAccuracy of [0.65, 0.7, 0.75]) {
        gateConfigs.push({ lookback, lag, minValAccuracy });
      }
    }
  }

  const results = [];
  for (const gate of gateConfigs) {
    const folds = [];
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const targetRows = rowsByMarket[market];
        let foldCount = 0;
        for (let testStart = targetRows.length - 30; testStart >= 240 && testStart >= targetRows.length - 150; testStart -= 30) {
          if (foldCount >= 1) break;
          foldCount++;
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(180, valEnd - 90);
          let best = null;
          const sourceMarkets = [...new Set([SOURCE_MARKET[market], MARKETS[Math.max(0, MARKETS.indexOf(market) - 1)], MARKETS[Math.min(MARKETS.length - 1, MARKETS.indexOf(market) + 1)]].filter(Boolean))].filter((item) => item !== market);
          for (const sourceMarket of sourceMarkets) {
            for (const sourceSide of ["open", "close"]) {
              const config = { ...gate, sourceMarket, sourceSide };
              const val = evalConfig(rowsByMarket, market, side, valStart, valEnd, config);
              if (val.total < 20 || val.accuracy < gate.minValAccuracy) continue;
              const score = val.accuracy * 1000 + val.avgCorrectDigits * 20 + val.total / 100;
              if (!best || score > best.score) best = { config, val, score };
            }
          }
          if (!best) continue;
          const test = evalConfig(rowsByMarket, market, side, testStart, testEnd, best.config);
          if (!test.total) continue;
          folds.push({
            market,
            side,
            sourceMarket: best.config.sourceMarket,
            sourceSide: best.config.sourceSide,
            testWindow: `${targetRows[testStart].isoDate}..${targetRows[testEnd - 1].isoDate}`,
            val: best.val,
            test,
          });
        }
      }
    }
    results.push({ gate, selectedFolds: folds.length, summary: summarize(folds) });
  }

  const bestMin30 = results.filter((item) => item.summary.total >= 30).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results.filter((item) => item.summary.total >= 120).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin720 = results.filter((item) => item.summary.total >= 720).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const output = {
    generatedAt: new Date().toISOString(),
    gateConfigs: gateConfigs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-cross-market-leadlag-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Cross-Market Lead/Lag Selector");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Gate configs tested: ${output.gateConfigs}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|");
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a |`);
    else {
      const g = item.gate;
      lines.push(`| ${name}: lookback=${g.lookback}, lag=${g.lag}, val>=${pct(g.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests whether source-market avoid-pair behavior leads target-market avoid digits.");
  lines.push("- Source market/side and lag are selected only from validation windows before each forward test window.");
  lines.push("- If this fails, cross-market lead/lag is not strong enough for live two-digit avoid calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-cross-market-leadlag-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
