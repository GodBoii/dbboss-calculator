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
  ABSENT_DIGITS_MODEL_ID,
  ABSENT_DIGITS_V2_MODEL_ID,
  buildAbsentDigitsPrediction,
  buildAbsentDigitsPredictionV3,
  buildAbsentDigitsPredictionV2,
} = require("../src/lib/absent-digits.ts")

const ROOT = path.resolve(__dirname, "..")
const EXTENDED = path.join(ROOT, "research", "panel_top30_v2", "extended_records.json")
const INDEPENDENT = path.join(
  ROOT,
  "research",
  "panel_top60_prospective_v2",
  "independent_forward_records.json",
)
const V2_REGISTRY = path.join(
  ROOT,
  "research",
  "absent_digits_v2",
  "FROZEN_FORWARD_REGISTRY.json",
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
const ROUTES = {
  "Time Bazar|close": "lag_panel_repeat_15",
  "Milan Day|open": "frequency_saturation_w90",
  "Milan Day|close": "frequency_hot_w5",
  "Rajdhani Day|close": "lag_opposite_7",
  "Kalyan|close": "lag_jodi_transition_1",
  "Kalyan Night|open": "position_markov",
  "Kalyan Night|close": "frequency_saturation_w90",
  "Main Bazar|close": "frequency_hot_w90",
}

function recordISO(record) {
  if (record.isoDate) return String(record.isoDate).slice(0, 10)
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
        rows.set(isoDate, { ...record, isoDate })
      }
    }
    if (independent.audit[market]?.identityAccepted) {
      for (const record of independent.forward[market] || []) {
        const isoDate = recordISO(record)
        if (isoDate && /^\d{3}$/.test(record.openPanel) && /^\d{3}$/.test(record.closePanel)) {
          rows.set(isoDate, { ...record, isoDate })
        }
      }
    }
    result[market] = [...rows.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  }
  return result
}

function main() {
  const records = loadRows()
  const v2Registry = JSON.parse(fs.readFileSync(V2_REGISTRY, "utf8"))
  const frozenByKey = new Map(
    v2Registry.rows.map((row) => [`${row.market}|${row.side}`, row]),
  )
  const results = []
  let specialized = 0
  let applied = 0

  for (const market of [...new Set(v2Registry.rows.map((row) => row.market))]) {
    const targetDate = frozenByKey.get(`${market}|open`).targetDate
    const targetDay = DAY_NAMES[new Date(`${targetDate}T00:00:00Z`).getUTCDay()]
    const before = JSON.stringify(records[market])
    const v3 = buildAbsentDigitsPredictionV3(
      market, records[market], targetDate, targetDay,
    )
    const defaultPrediction = buildAbsentDigitsPrediction(
      market, records[market], targetDate, targetDay,
    )
    const v2 = buildAbsentDigitsPredictionV2(
      market, records[market], targetDate, targetDay,
    )
    if (!v3 || !v2) throw new Error(`${market}: missing prediction`)
    if (JSON.stringify(defaultPrediction) !== JSON.stringify(v3)) {
      throw new Error(`${market}: app default does not match guarded V3`)
    }
    if (v3.modelId !== ABSENT_DIGITS_MODEL_ID) {
      throw new Error(`${market}: V3 model ID mismatch`)
    }
    if (v2.modelId !== ABSENT_DIGITS_V2_MODEL_ID) {
      throw new Error(`${market}: V2 model ID mismatch`)
    }
    if (JSON.stringify(records[market]) !== before) {
      throw new Error(`${market}: prediction mutated source records`)
    }

    const contaminated = buildAbsentDigitsPredictionV3(
      market,
      [
        ...records[market],
        {
          isoDate: targetDate,
          day: targetDay,
          openPanel: "999",
          closePanel: "999",
        },
        {
          isoDate: "2099-01-01",
          day: "Thursday",
          openPanel: "888",
          closePanel: "888",
        },
      ],
      targetDate,
      targetDay,
    )
    if (JSON.stringify(contaminated) !== JSON.stringify(v3)) {
      throw new Error(`${market}: target/future rows changed V3 prediction`)
    }

    for (const side of ["open", "close"]) {
      const key = `${market}|${side}`
      const prediction = v3[side]
      const expectedRoute = ROUTES[key]
      if (expectedRoute) {
        specialized += 1
        if (prediction.routeModel !== expectedRoute) {
          throw new Error(`${key}: ${prediction.routeModel} != ${expectedRoute}`)
        }
        if (prediction.routeGuard.historySample !== 80) {
          throw new Error(`${key}: route guard must use 80 prior forecasts`)
        }
        if (prediction.routeModelApplied) applied += 1
      } else {
        if (prediction.routeModel !== "baseline_v2" || prediction.routeModelApplied) {
          throw new Error(`${key}: unexpected market specialization`)
        }
        if (
          prediction.candidateAvoidDigits.join("") !==
          v2[side].candidateAvoidDigits.join("")
        ) {
          throw new Error(`${key}: non-specialized route changed V2 pair`)
        }
      }
      if (prediction.status === "CALL" && prediction.wilson95[0] < 0.8) {
        throw new Error(`${key}: safety gate bypassed`)
      }
    }
    results.push({
      market,
      targetDate,
      open: v3.open.candidateAvoidDigits.join(""),
      close: v3.close.candidateAvoidDigits.join(""),
      openRoute: v3.open.routeModelApplied ? v3.open.routeModel : "baseline_v2",
      closeRoute: v3.close.routeModelApplied ? v3.close.routeModel : "baseline_v2",
      status: `${v3.open.status}/${v3.close.status}`,
    })
  }

  if (specialized !== Object.keys(ROUTES).length) {
    throw new Error(`Expected ${Object.keys(ROUTES).length} specialized routes, got ${specialized}`)
  }
  if (applied === 0) throw new Error("No specialized route passed its causal guard")

  console.log(JSON.stringify({
    status: "verified",
    modelId: ABSENT_DIGITS_MODEL_ID,
    preservedModelId: ABSENT_DIGITS_V2_MODEL_ID,
    specializedRoutes: specialized,
    appliedRoutes: applied,
    results,
  }, null, 2))
}

main()
