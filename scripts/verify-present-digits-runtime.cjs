/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")
const ts = require("typescript")

require.extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText
  module._compile(output, filename)
}

const {
  PRESENT_DIGITS_MODEL_ID,
  PRESENT_DIGITS_TARGET_ACCURACY,
  buildPresentDigitsPredictionFromPanels,
} = require("../src/lib/present-digits.ts")

const ROOT = path.resolve(__dirname, "..")
const EXTENDED = path.join(ROOT, "research", "panel_top30_v2", "extended_records.json")
const INDEPENDENT = path.join(
  ROOT,
  "research",
  "panel_top60_prospective_v2",
  "independent_forward_records.json",
)
const DAY_OFFSETS = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}
const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]
const PAIRS = Array.from({ length: 10 }, (_, left) =>
  Array.from({ length: 10 - left - 1 }, (_, offset) => [left, left + offset + 1]),
).flat()

function recordISO(record) {
  const parts = String(record.dateRangeStart || "")
    .replace(/-/g, "/")
    .split("/")
    .map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [day, month, rawYear] = parts
  const value = new Date(Date.UTC(rawYear < 100 ? rawYear + 2000 : rawYear, month - 1, day))
  value.setUTCDate(value.getUTCDate() + (DAY_OFFSETS[record.day] ?? 0))
  return value.toISOString().slice(0, 10)
}

function loadRows() {
  const extended = JSON.parse(fs.readFileSync(EXTENDED, "utf8"))
  const independent = JSON.parse(fs.readFileSync(INDEPENDENT, "utf8"))
  const result = {}
  for (const market of Object.keys(extended.extended)) {
    const rows = new Map()
    for (const record of extended.extended[market] || []) {
      const isoDate = recordISO(record)
      if (isoDate && /^\d{3}$/.test(record.openPanel) && /^\d{3}$/.test(record.closePanel)) {
        rows.set(isoDate, record)
      }
    }
    if (independent.audit[market]?.identityAccepted) {
      for (const record of independent.forward[market] || []) {
        const isoDate = recordISO(record)
        if (isoDate && /^\d{3}$/.test(record.openPanel) && /^\d{3}$/.test(record.closePanel)) {
          rows.set(isoDate, record)
        }
      }
    }
    result[market] = [...rows.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, record]) => record)
  }
  return result
}

function addDay(isoDate) {
  const value = new Date(`${isoDate}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

function fakeRecord(market, isoDate, panel) {
  const value = new Date(`${isoDate}T00:00:00Z`)
  const day = DAY_NAMES[value.getUTCDay()]
  const formatted = `${String(value.getUTCDate()).padStart(2, "0")}/${String(
    value.getUTCMonth() + 1,
  ).padStart(2, "0")}/${value.getUTCFullYear()}`
  return {
    id: `${market}|${formatted}|${day}`,
    market,
    dateRangeStart: formatted,
    dateRangeEnd: formatted,
    day,
    openPanel: panel,
    openSutta: 0,
    jodi: "00",
    closePanel: panel,
    closeSutta: 0,
    savedAt: 0,
  }
}

function expectedPair(records, side) {
  const key = side === "open" ? "openPanel" : "closePanel"
  const window = records.slice(-180)
  const counts = PAIRS.map(([left, right]) =>
    window.reduce(
      (hits, record) =>
        hits + Number(record[key].includes(String(left)) && record[key].includes(String(right))),
      0,
    ),
  )
  return PAIRS[counts.reduce(
    (best, count, index) => count > counts[best] ? index : best,
    0,
  )]
}

function main() {
  const recordsByMarket = loadRows()
  const results = []
  for (const [market, records] of Object.entries(recordsByMarket)) {
    const latest = recordISO(records.at(-1))
    const targetISO = addDay(latest)
    const before = JSON.stringify(records)
    const prediction = buildPresentDigitsPredictionFromPanels(
      market,
      records,
      new Date(`${targetISO}T12:00:00Z`),
    )
    if (!prediction) throw new Error(`${market}: runtime returned no prediction`)
    if (prediction.modelId !== PRESENT_DIGITS_MODEL_ID) {
      throw new Error(`${market}: model ID mismatch`)
    }
    if (prediction.targetAccuracy !== PRESENT_DIGITS_TARGET_ACCURACY) {
      throw new Error(`${market}: target gate mismatch`)
    }
    if (JSON.stringify(records) !== before) {
      throw new Error(`${market}: runtime mutated source records`)
    }
    for (const side of ["open", "close"]) {
      const expected = expectedPair(records, side)
      if (prediction[side].predictedDigits.join("") !== expected.join("")) {
        throw new Error(`${market} ${side}: pair mismatch`)
      }
      if (prediction[side].status !== "RESEARCH_ONLY") {
        throw new Error(`${market} ${side}: unverified target gate passed`)
      }
      if (prediction[side].wilson95[0] >= PRESENT_DIGITS_TARGET_ACCURACY) {
        throw new Error(`${market} ${side}: status and Wilson gate disagree`)
      }
    }

    const contaminated = buildPresentDigitsPredictionFromPanels(
      market,
      [
        ...records,
        fakeRecord(market, targetISO, "999"),
        fakeRecord(market, "2099-01-01", "888"),
      ],
      new Date(`${targetISO}T12:00:00Z`),
    )
    if (JSON.stringify(contaminated) !== JSON.stringify(prediction)) {
      throw new Error(`${market}: target/future records changed causal output`)
    }
    results.push({
      market,
      targetDate: targetISO,
      open: prediction.open.predictedDigits.join(""),
      close: prediction.close.predictedDigits.join(""),
      status: `${prediction.open.status}/${prediction.close.status}`,
    })
  }

  const firstMarket = Object.keys(recordsByMarket)[0]
  const insufficient = buildPresentDigitsPredictionFromPanels(
    firstMarket,
    recordsByMarket[firstMarket].slice(-179),
    new Date("2099-01-02T12:00:00Z"),
  )
  if (insufficient !== null) {
    throw new Error("Runtime did not enforce the 180-row history minimum")
  }
  console.log(JSON.stringify({
    status: "verified",
    modelId: PRESENT_DIGITS_MODEL_ID,
    targetAccuracy: PRESENT_DIGITS_TARGET_ACCURACY,
    markets: results.length,
    results,
  }, null, 2))
}

main()
