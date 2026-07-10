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

function popcount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) count += mask & (1 << digit) ? 1 : 0;
  return count;
}

function rootOf(panel) {
  return [...String(panel || "")].reduce((sum, digit) => sum + Number(digit), 0) % 10;
}

function symbolFor(rows, side, index, mode) {
  if (index < 0) return null;
  const panel = String(panelFor(rows[index], side) || "");
  if (!/^\d{3}$/.test(panel)) return null;
  const digits = [...panel].map(Number);
  const mask = maskFor(panel);
  const sum = digits.reduce((total, digit) => total + digit, 0);
  if (mode === "root") return String(sum % 10);
  if (mode === "kind") return popcount(mask) === 3 ? "SP" : popcount(mask) === 2 ? "DP" : "TP";
  if (mode === "root_kind") return `${sum % 10}:${popcount(mask)}`;
  if (mode === "mask") return String(mask);
  if (mode === "parity") return digits.map((digit) => digit % 2 ? "O" : "E").join("");
  if (mode === "house") return digits.map((digit) => digit <= 4 ? "L" : "H").join("");
  if (mode === "sum_band") return sum <= 10 ? "low" : sum >= 17 ? "high" : "mid";
  if (mode === "edge") return `${digits[0]}${digits[2]}`;
  if (mode === "delta_root") {
    if (index === 0) return null;
    return String((rootOf(panel) - rootOf(panelFor(rows[index - 1], side)) + 10) % 10);
  }
  return null;
}

function contextKey(rows, side, index, mode, length, backoff = 0) {
  const effectiveLength = Math.max(1, length - backoff);
  const symbols = [];
  for (let offset = effectiveLength; offset >= 1; offset--) {
    const symbol = symbolFor(rows, side, index - offset, mode);
    if (symbol == null) return null;
    symbols.push(symbol);
  }
  return symbols.join(">");
}

function trainBuckets(rows, side, start, end, base) {
  const buckets = new Map();
  for (let index = start; index < end; index++) {
    const key = contextKey(rows, side, index, base.mode, base.length, base.backoff);
    if (key == null) continue;
    if (!buckets.has(key)) buckets.set(key, { total: 0, digitPresent: Array(10).fill(0), pairCorrect: Array(PAIRS.length).fill(0) });
    const bucket = buckets.get(key);
    const mask = maskFor(panelFor(rows[index], side));
    bucket.total++;
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) bucket.digitPresent[digit]++;
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) if (isAbsentPair(PAIRS[pairIndex], mask)) bucket.pairCorrect[pairIndex]++;
  }
  return buckets;
}

function selectPair(bucket, scoreMode) {
  let best = null;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const pair = PAIRS[pairIndex];
    const joint = (bucket.pairCorrect[pairIndex] + 2) / (bucket.total + 4);
    const riskA = bucket.digitPresent[pair.digits[0]] / bucket.total;
    const riskB = bucket.digitPresent[pair.digits[1]] / bucket.total;
    const score = scoreMode === "joint" ? joint : -Math.max(riskA, riskB) - (riskA + riskB) / 100;
    if (!best || score > best.score) best = { pairIndex, score };
  }
  return PAIRS[best.pairIndex];
}

function evaluate(rows, side, start, end, base, buckets, variant) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const key = contextKey(rows, side, index, base.mode, base.length, base.backoff);
    const bucket = key == null ? null : buckets.get(key);
    if (!bucket || bucket.total < variant.minSupport) continue;
    const pair = selectPair(bucket, variant.scoreMode);
    const mask = maskFor(panelFor(rows[index], side));
    correct += isAbsentPair(pair, mask) ? 1 : 0;
    digitCorrect += absentDigitCount(pair, mask);
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
  const bases = [];
  for (const mode of ["root", "kind", "root_kind", "mask", "parity", "house", "sum_band", "edge", "delta_root"]) {
    for (const length of [1, 2, 3, 4, 5]) {
      for (const lookback of [180, 365]) {
        for (const backoff of [0, Math.max(0, length - 1)]) {
          const effective = Math.max(1, length - backoff);
          const key = `${mode}|${effective}|${lookback}`;
          if (!bases.some((base) => base.key === key)) bases.push({ mode, length, lookback, backoff, key });
        }
      }
    }
  }
  const variants = [];
  for (const minSupport of [3, 5, 10]) for (const scoreMode of ["joint", "minimax"]) variants.push({ minSupport, scoreMode });
  const gates = [];
  for (const minValCalls of [20, 60]) for (const minValAccuracy of [0.6, 0.7, 0.8]) gates.push({ minValCalls, minValAccuracy });
  const foldData = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= 360 && foldCount < 3; testStart -= 30, foldCount++) {
        const valStart = testStart - 90;
        const candidates = [];
        for (const base of bases) {
          const trainStart = Math.max(0, valStart - base.lookback);
          const buckets = trainBuckets(rows, side, trainStart, valStart, base);
          for (const variant of variants) candidates.push({ base, variant, validation: evaluate(rows, side, valStart, testStart, base, buckets, variant) });
        }
        foldData.push({ market, side, rows, testStart, valStart, candidates, testWindow: `${rows[testStart].isoDate}..${rows[testStart + 29].isoDate}` });
      }
    }
  }
  const results = gates.map((gate) => {
    const folds = [];
    for (const fold of foldData) {
      const best = fold.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best) continue;
      const trainStart = Math.max(0, fold.testStart - best.base.lookback);
      const buckets = trainBuckets(fold.rows, fold.side, trainStart, fold.testStart, best.base);
      const test = evaluate(fold.rows, fold.side, fold.testStart, fold.testStart + 30, best.base, buckets, best.variant);
      if (test.total) folds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, base: best.base, variant: best.variant, validation: best.validation, test });
    }
    return { gate, summary: summarize(folds), folds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = { generatedAt: new Date().toISOString(), baseSequenceModels: bases.length, modelVariants: bases.length * variants.length, forwardFolds: foldData.length, viable80Count: viable80.length, viable85Count: viable85.length, bestMin30, bestMin120, bestMin720, results };
  fs.writeFileSync(path.join(__dirname, "two-digit-symbolic-sequence-selector-output.json"), JSON.stringify(output, null, 2));
  const lines = ["# Two-Digit Symbolic Sequence Selector", "", `Generated: ${output.generatedAt}`, `Base sequence models: ${output.baseSequenceModels}`, `Model/support/risk variants: ${output.modelVariants}`, `Forward folds: ${output.forwardFolds}`, `Viable >=80% gates with >=30 calls: ${output.viable80Count}`, `Viable >=85% gates with >=30 calls: ${output.viable85Count}`, "", "## Best Gates", "", "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |", "|---|---:|---:|---:|---:|"];
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    else lines.push(`| ${name}: validation calls>=${item.gate.minValCalls}, validation>=${pct(item.gate.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
  }
  lines.push("", "## Interpretation", "", "- Exact and backoff sequence grammars span root, kind, root-kind, mask, parity, house, sum band, panel edge, and root-delta symbols.", "- Sequence length, lookback, support, and pair-risk rule are selected on validation before refitting through the cutoff and scoring later rows.", "- Every context key ends at the previous result; the target panel is never included in its own sequence.");
  fs.writeFileSync(path.join(__dirname, "two-digit-symbolic-sequence-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
