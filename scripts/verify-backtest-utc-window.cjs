/* eslint-disable no-console */

const fs = require("fs")
const ts = require("typescript")

require.extensions[".ts"] = function registerTypeScript(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  module._compile(output, filename)
}

const { getBacktestWindowStart } = require("../src/lib/backtest.ts")

const cases = [
  ["2026-07-23", 4, "2026-07-20"],
  ["2026-07-23", 30, "2026-06-24"],
  ["2026-01-01", 30, "2025-12-03"],
  ["2024-03-01", 2, "2024-02-29"],
]

for (const [endDate, days, expected] of cases) {
  const actual = getBacktestWindowStart(endDate, days)
  if (actual !== expected) {
    throw new Error(`${endDate}/${days}: expected ${expected}, received ${actual}`)
  }
}

console.log("Backtest UTC window boundaries verified.")
