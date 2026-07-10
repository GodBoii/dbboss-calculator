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
const OPPOSITE = { 0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4 };

function suttaFor(row, side) {
  return side === "open" ? row.record.openSutta : row.record.closeSutta;
}

function pairFromDigits(digits) {
  const unique = [...new Set(digits.map(Number).filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9))]
    .slice(0, 10)
    .sort((a, b) => a - b);
  if (unique.length < 2) return null;
  return PAIRS.find((pair) => pair.digits[0] === unique[0] && pair.digits[1] === unique[1]) || null;
}

function panelDigits(row, side) {
  return String(panelFor(row, side) || "").split("").map(Number).filter(Number.isInteger);
}

function panelSum(row, side) {
  return panelDigits(row, side).reduce((sum, digit) => sum + digit, 0);
}

function pickByMode(rows, side, index, mode) {
  if (index <= 0) return null;
  const prev = rows[index - 1];
  const otherSide = side === "open" ? "close" : "open";
  const sameDigits = panelDigits(prev, side);
  const otherDigits = panelDigits(prev, otherSide);
  const sameMask = maskFor(panelFor(prev, side));
  const otherMask = maskFor(panelFor(prev, otherSide));
  const sameMissing = DIGITS.filter((digit) => (sameMask & (1 << digit)) === 0);
  const otherMissing = DIGITS.filter((digit) => (otherMask & (1 << digit)) === 0);
  const openSutta = Number(suttaFor(prev, "open"));
  const closeSutta = Number(suttaFor(prev, "close"));
  const root = panelSum(prev, side) % 10;
  const otherRoot = panelSum(prev, otherSide) % 10;

  if (mode === "prev_same_present") return pairFromDigits(sameDigits);
  if (mode === "prev_other_present") return pairFromDigits(otherDigits);
  if (mode === "prev_same_missing_low") return pairFromDigits(sameMissing);
  if (mode === "prev_same_missing_high") return pairFromDigits([...sameMissing].reverse());
  if (mode === "prev_other_missing_low") return pairFromDigits(otherMissing);
  if (mode === "prev_other_missing_high") return pairFromDigits([...otherMissing].reverse());
  if (mode === "opp_prev_same_present") return pairFromDigits(sameDigits.map((digit) => OPPOSITE[digit]));
  if (mode === "opp_prev_other_present") return pairFromDigits(otherDigits.map((digit) => OPPOSITE[digit]));
  if (mode === "opp_prev_same_missing") return pairFromDigits(sameMissing.map((digit) => OPPOSITE[digit]));
  if (mode === "same_sutta_neighbors") return pairFromDigits([openSutta, closeSutta, (openSutta + 1) % 10, (closeSutta + 9) % 10]);
  if (mode === "sutta_opposites") return pairFromDigits([OPPOSITE[openSutta], OPPOSITE[closeSutta]]);
  if (mode === "root_neighbors") return pairFromDigits([root, (root + 1) % 10, (root + 9) % 10]);
  if (mode === "other_root_neighbors") return pairFromDigits([otherRoot, (otherRoot + 1) % 10, (otherRoot + 9) % 10]);
  if (mode === "root_opposite") return pairFromDigits([root, OPPOSITE[root], otherRoot, OPPOSITE[otherRoot]]);
  if (mode === "prev_panel_edges") return pairFromDigits([sameDigits[0], sameDigits[sameDigits.length - 1], otherDigits[0], otherDigits[otherDigits.length - 1]]);
  return null;
}

function evalMode(rows, side, start, end, mode) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const pair = pickByMode(rows, side, index, mode);
    if (!pair) continue;
    const mask = maskFor(panelFor(rows[index], side));
    correct += isAbsentPair(pair, mask) ? 1 : 0;
    digitCorrect += absentDigitCount(pair, mask);
    total++;
  }
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
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
  const modes = [
    "prev_same_present",
    "prev_other_present",
    "prev_same_missing_low",
    "prev_same_missing_high",
    "prev_other_missing_low",
    "prev_other_missing_high",
    "opp_prev_same_present",
    "opp_prev_other_present",
    "opp_prev_same_missing",
    "same_sutta_neighbors",
    "sutta_opposites",
    "root_neighbors",
    "other_root_neighbors",
    "root_opposite",
    "prev_panel_edges",
  ];
  const configs = [];
  for (const valLookback of [30, 60, 90, 180]) {
    for (const minValAccuracy of [0.55, 0.6, 0.65, 0.7, 0.75]) configs.push({ valLookback, minValAccuracy });
  }

  const results = [];
  for (const config of configs) {
    const folds = [];
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const rows = rowsByMarket[market];
        let foldCount = 0;
        for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
          if (foldCount >= 3) break;
          foldCount++;
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(1, valEnd - config.valLookback);
          let best = null;
          for (const mode of modes) {
            const val = evalMode(rows, side, valStart, valEnd, mode);
            if (val.total < Math.min(20, config.valLookback) || val.accuracy < config.minValAccuracy) continue;
            const score = val.accuracy * 1000 + val.avgCorrectDigits * 25 + val.total / 100;
            if (!best || score > best.score) best = { mode, val, score };
          }
          if (!best) continue;
          const test = evalMode(rows, side, testStart, testEnd, best.mode);
          folds.push({ market, side, mode: best.mode, testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`, val: best.val, test });
        }
      }
    }
    results.push({ config, selectedFolds: folds.length, summary: summarize(folds) });
  }

  const bestMin30 = results.filter((item) => item.summary.total >= 30).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results.filter((item) => item.summary.total >= 120).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin720 = results.filter((item) => item.summary.total >= 720).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const output = { generatedAt: new Date().toISOString(), modesTested: modes.length, configsTested: configs.length, viable80Count: viable80.length, viable85Count: viable85.length, bestMin30, bestMin120, bestMin720, results };
  fs.writeFileSync(path.join(__dirname, "two-digit-transition-transform-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Transition Transform Selector", "", `Generated: ${output.generatedAt}`, `Modes tested: ${output.modesTested}`, `Gate configs tested: ${output.configsTested}`, `Viable >=80% configs with >=30 calls: ${output.viable80Count}`, `Viable >=85% configs with >=30 calls: ${output.viable85Count}`, "", "## Best Gates", "", "| Gate | Calls | Strict Accuracy | Avg Digits |", "|---|---:|---:|---:|");
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a |`);
    else {
      const c = item.config;
      lines.push(`| ${name}: lookback=${c.valLookback}, val>=${pct(c.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("", "## Interpretation", "", "- This tests direct transition-transform rules from previous panels, missing digits, opposite mappings, roots, and suttas.", "- Rule choice is selected only from validation windows before each forward test window.", "- If these fail, simple previous-result transforms are not strong enough for safe two-digit avoid calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-transition-transform-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
