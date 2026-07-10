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

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

function digitCounts(rows, side, start, end, predicate = null) {
  const counts = Array(10).fill(0);
  let n = 0;
  for (let i = start; i < end; i++) {
    if (predicate && !predicate(rows[i], i)) continue;
    n++;
    const mask = maskFor(panelFor(rows[i], side));
    for (const digit of DIGITS) if (mask & (1 << digit)) counts[digit]++;
  }
  return { counts, n };
}

function gapSince(rows, side, end, digit, present) {
  for (let gap = 1; gap <= Math.min(180, end); gap++) {
    const mask = maskFor(panelFor(rows[end - gap], side));
    if (((mask & (1 << digit)) !== 0) === present) return gap;
  }
  return 180;
}

function riskScores(rows, side, index, config) {
  const short = digitCounts(rows, side, Math.max(0, index - config.shortLookback), index);
  const medium = digitCounts(rows, side, Math.max(0, index - config.mediumLookback), index);
  const long = digitCounts(rows, side, Math.max(0, index - config.longLookback), index);
  const weekday = rows[index].record.day;
  const sameDay = digitCounts(
    rows,
    side,
    Math.max(0, index - config.contextLookback),
    index,
    (row) => row.record.day === weekday,
  );
  return DIGITS.map((digit) => {
    const shortRisk = short.n ? short.counts[digit] / short.n : 0.3;
    const mediumRisk = medium.n ? medium.counts[digit] / medium.n : 0.3;
    const longRisk = long.n ? long.counts[digit] / long.n : 0.3;
    const sameDayRisk = sameDay.n >= config.minContext ? sameDay.counts[digit] / sameDay.n : longRisk;
    const presentGap = gapSince(rows, side, index, digit, true) / 180;
    const absentGap = gapSince(rows, side, index, digit, false) / 180;
    const risk =
      config.shortWeight * shortRisk +
      config.mediumWeight * mediumRisk +
      config.longWeight * longRisk +
      config.contextWeight * sameDayRisk +
      config.presentGapWeight * (1 - presentGap) +
      config.absentGapWeight * absentGap;
    return { digit, risk };
  });
}

function pickPair(rows, side, index, config) {
  const ranked = riskScores(rows, side, index, config).sort((a, b) => a.risk - b.risk || a.digit - b.digit);
  const pairDigits = ranked.slice(0, 2).map((item) => item.digit).sort((a, b) => a - b);
  const pair = PAIRS.find((item) => item.digits[0] === pairDigits[0] && item.digits[1] === pairDigits[1]);
  const risk = ranked[0].risk + ranked[1].risk;
  return { pair, risk };
}

function evalConfig(rows, side, start, end, config, maxRisk = Infinity) {
  const predictions = [];
  for (let index = start; index < end; index++) {
    const picked = pickPair(rows, side, index, config);
    if (!picked.pair || picked.risk > maxRisk) continue;
    const mask = maskFor(panelFor(rows[index], side));
    const hit = isAbsentPair(picked.pair, mask);
    const absentDigits = absentDigitCount(picked.pair, mask);
    predictions.push({
      date: rows[index].isoDate,
      pair: picked.pair.key,
      risk: picked.risk,
      hit,
      absentDigits,
    });
  }
  const total = predictions.length;
  const correct = predictions.filter((item) => item.hit).length;
  const digitCorrect = predictions.reduce((sum, item) => sum + item.absentDigits, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    predictions,
  };
}

function summarize(items) {
  const correct = items.reduce((sum, item) => sum + item.test.correct, 0);
  const digitCorrect = items.reduce((sum, item) => sum + item.test.digitCorrect, 0);
  const total = items.reduce((sum, item) => sum + item.test.total, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    folds: items.length,
  };
}

function makeConfigs() {
  const configs = [];
  for (const shortLookback of [5, 10]) {
    for (const mediumLookback of [30]) {
      for (const longLookback of [90, 180]) {
        for (const contextWeight of [0, 1]) {
          configs.push({
            shortLookback,
            mediumLookback,
            longLookback,
            contextLookback: 365,
            minContext: 5,
            shortWeight: 1.5,
            mediumWeight: 1,
            longWeight: 0.5,
            contextWeight,
            presentGapWeight: 0.2,
            absentGapWeight: 0.1,
          });
          configs.push({
            shortLookback,
            mediumLookback,
            longLookback,
            contextLookback: 365,
            minContext: 5,
            shortWeight: -0.5,
            mediumWeight: 1,
            longWeight: 1.5,
            contextWeight,
            presentGapWeight: -0.1,
            absentGapWeight: 0.2,
          });
        }
      }
    }
  }
  return configs;
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const baseConfigs = makeConfigs();
  const gateConfigs = [];
  for (const minValAccuracy of [0.65, 0.7, 0.75]) {
    for (const minValN of [10, 20, 30]) {
      for (const maxRiskQuantile of [0.25, 0.5, 1]) {
        gateConfigs.push({ minValAccuracy, minValN, maxRiskQuantile });
      }
    }
  }

  const folds = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
        if (foldCount >= 1) break;
        foldCount++;
        const testEnd = testStart + 30;
        const valEnd = testStart;
        const valStart = Math.max(180, valEnd - 90);
        let best = null;
        for (const config of baseConfigs) {
          const fullVal = evalConfig(rows, side, valStart, valEnd, config);
          const risks = fullVal.predictions.map((item) => item.risk).sort((a, b) => a - b);
          for (const gate of gateConfigs) {
            const riskIndex = Math.min(risks.length - 1, Math.max(0, Math.floor((risks.length - 1) * gate.maxRiskQuantile)));
            const maxRisk = risks[riskIndex] ?? Infinity;
            const val = evalConfig(rows, side, valStart, valEnd, config, maxRisk);
            if (val.total < gate.minValN || val.accuracy < gate.minValAccuracy) continue;
            const score = val.accuracy * 1000 + val.avgCorrectDigits * 30 + Math.min(val.total, 90) / 10;
            if (!best || score > best.score) best = { config, gate, val, maxRisk, score };
          }
        }
        if (!best) continue;
        const test = evalConfig(rows, side, testStart, testEnd, best.config, best.maxRisk);
        if (!test.total) continue;
        folds.push({ market, side, testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`, config: best.config, gate: best.gate, val: best.val, test });
      }
    }
  }

  const aggregate = summarize(folds);
  const foldsAt70 = folds.filter((fold) => fold.test.accuracy >= 0.7).length;
  const foldsAt80 = folds.filter((fold) => fold.test.accuracy >= 0.8).length;
  const output = {
    generatedAt: new Date().toISOString(),
    baseConfigs: baseConfigs.length,
    gateConfigs: gateConfigs.length,
    aggregate,
    foldsAt70,
    foldsAt80,
    folds,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-digit-risk-gate-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Digit Risk Gate");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Base digit-risk configs: ${output.baseConfigs}`);
  lines.push(`Validation gate configs: ${output.gateConfigs}`);
  lines.push("");
  lines.push("## Rolling Result");
  lines.push("");
  lines.push(`- Strict accuracy: ${pct(aggregate.accuracy)} (${aggregate.correct}/${aggregate.total})`);
  lines.push(`- Average correctly eliminated digits: ${aggregate.avgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`- Selected folds: ${aggregate.folds}`);
  lines.push(`- Folds >=70%: ${foldsAt70}/${aggregate.folds}`);
  lines.push(`- Folds >=80%: ${foldsAt80}/${aggregate.folds}`);
  lines.push("");
  lines.push("| Market | Side | Window | Val | Test | Calls | Avg Digits |");
  lines.push("|---|---|---|---:|---:|---:|---:|");
  for (const fold of folds) {
    lines.push(`| ${fold.market} | ${fold.side} | ${fold.testWindow} | ${pct(fold.val.accuracy)} (${fold.val.correct}/${fold.val.total}) | ${pct(fold.test.accuracy)} (${fold.test.correct}/${fold.test.total}) | ${fold.test.total} | ${fold.test.avgCorrectDigits.toFixed(2)} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This models digit appearance risk first, then forms a two-digit avoid pair from the lowest-risk digits.");
  lines.push("- It abstains using validation-calibrated risk thresholds rather than pair-history thresholds.");
  lines.push("- A live-safe version would require repeated >=80% strict test folds, not just high validation fit.");
  fs.writeFileSync(path.join(__dirname, "two-digit-digit-risk-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
