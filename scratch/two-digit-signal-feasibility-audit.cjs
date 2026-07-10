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
  pct,
} = require("./two-digit-deep-research-runner.cjs");

function popcount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) count += mask & (1 << digit) ? 1 : 0;
  return count;
}

function combination2(n) {
  return n * (n - 1) / 2;
}

function wilson(correct, total, z = 1.959963984540054) {
  if (!total) return { low: 0, high: 0 };
  const p = correct / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return { low: center - margin, high: center + margin };
}

function evaluatePair(rows, side, start, end, pair) {
  let correct = 0;
  for (let index = start; index < end; index++) correct += isAbsentPair(pair, maskFor(panelFor(rows[index], side))) ? 1 : 0;
  return { correct, total: end - start, accuracy: end > start ? correct / (end - start) : 0 };
}

function bestPair(rows, side, start, end) {
  return PAIRS
    .map((pair) => ({ pair, result: evaluatePair(rows, side, start, end, pair) }))
    .sort((a, b) => b.result.accuracy - a.result.accuracy || a.pair.key.localeCompare(b.pair.key))[0];
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const kindCounts = { SP: 0, DP: 0, TP: 0 };
  let randomCorrectPairs = 0;
  let randomTotalPairs = 0;
  let transitionBaseCorrect = 0;
  let transitionBaseTotal = 0;
  let afterSuccessCorrect = 0;
  let afterSuccessTotal = 0;
  let afterFailureCorrect = 0;
  let afterFailureTotal = 0;
  const splitRows = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      for (const row of rows) {
        const unique = popcount(maskFor(panelFor(row, side)));
        kindCounts[unique === 3 ? "SP" : unique === 2 ? "DP" : "TP"]++;
        randomCorrectPairs += combination2(10 - unique);
        randomTotalPairs += PAIRS.length;
      }
      for (const pair of PAIRS) {
        let previous = null;
        for (const row of rows) {
          const hit = isAbsentPair(pair, maskFor(panelFor(row, side)));
          transitionBaseCorrect += hit ? 1 : 0;
          transitionBaseTotal++;
          if (previous === true) {
            afterSuccessCorrect += hit ? 1 : 0;
            afterSuccessTotal++;
          } else if (previous === false) {
            afterFailureCorrect += hit ? 1 : 0;
            afterFailureTotal++;
          }
          previous = hit;
        }
      }
      const split = Math.floor(rows.length * 0.7);
      const selected = bestPair(rows, side, 0, split);
      const test = evaluatePair(rows, side, split, rows.length, selected.pair);
      splitRows.push({ market, side, pair: selected.pair.key, train: selected.result, test });
    }
  }

  const splitCorrect = splitRows.reduce((sum, row) => sum + row.test.correct, 0);
  const splitTotal = splitRows.reduce((sum, row) => sum + row.test.total, 0);
  const isolated = { correct: 23, total: 30, ...wilson(23, 30) };
  const rolling = { correct: 63, total: 95, ...wilson(63, 95) };
  const output = {
    generatedAt: new Date().toISOString(),
    kindCounts,
    theoreticalRandomPairByKind: { SP: combination2(7) / 45, DP: combination2(8) / 45, TP: combination2(9) / 45 },
    empiricalRandomPairAccuracy: randomCorrectPairs / randomTotalPairs,
    temporalFixedPairSplit: { correct: splitCorrect, total: splitTotal, accuracy: splitCorrect / splitTotal, rows: splitRows },
    pairPersistence: {
      base: transitionBaseCorrect / transitionBaseTotal,
      afterSuccess: afterSuccessCorrect / afterSuccessTotal,
      afterFailure: afterFailureCorrect / afterFailureTotal,
      liftAfterSuccess: afterSuccessCorrect / afterSuccessTotal - transitionBaseCorrect / transitionBaseTotal,
    },
    confidenceIntervals95: { isolated23of30: isolated, rolling63of95: rolling },
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-signal-feasibility-audit-output.json"), JSON.stringify(output, null, 2));
  const totalKinds = Object.values(kindCounts).reduce((sum, value) => sum + value, 0);
  const lines = [
    "# Two-Digit Signal Feasibility Audit",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "## Outcome Geometry",
    "",
    "| Panel kind | Rows | Share | Random pair strict accuracy |",
    "|---|---:|---:|---:|",
    `| SP (3 unique digits) | ${kindCounts.SP} | ${pct(kindCounts.SP / totalKinds)} | ${pct(output.theoreticalRandomPairByKind.SP)} |`,
    `| DP (2 unique digits) | ${kindCounts.DP} | ${pct(kindCounts.DP / totalKinds)} | ${pct(output.theoreticalRandomPairByKind.DP)} |`,
    `| TP (1 unique digit) | ${kindCounts.TP} | ${pct(kindCounts.TP / totalKinds)} | ${pct(output.theoreticalRandomPairByKind.TP)} |`,
    `| Empirical mixture | ${totalKinds} | 100.0% | ${pct(output.empiricalRandomPairAccuracy)} |`,
    "",
    "## Stable-Signal Checks",
    "",
    `- A fixed pair chosen on the first 70% of each market-side scored ${pct(output.temporalFixedPairSplit.accuracy)} (${splitCorrect}/${splitTotal}) on the later 30%.`,
    `- Across every pair and market-side, the base strict rate was ${pct(output.pairPersistence.base)}. After the same pair succeeded, its next-result rate was ${pct(output.pairPersistence.afterSuccess)}; after failure it was ${pct(output.pairPersistence.afterFailure)}.`,
    `- The 23/30 isolated result has a 95% Wilson interval of ${pct(isolated.low)} to ${pct(isolated.high)}.`,
    `- The 63/95 rolling result has a 95% Wilson interval of ${pct(rolling.low)} to ${pct(rolling.high)}.`,
    "",
    "## Interpretation",
    "",
    "- For an SP panel, 21 of the 45 possible avoid pairs are correct, so an uninformed pair starts at 46.7%, not near 80%.",
    "- Reaching 80% requires stable information about which specific digits will appear, not merely knowing general panel frequencies.",
    "- A confidence interval that includes values below the target cannot establish a production-safe 80% rate.",
  ];
  fs.writeFileSync(path.join(__dirname, "two-digit-signal-feasibility-audit.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
