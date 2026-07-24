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
  ABSENT_DIGITS_V2_CALIBRATION_ID,
  ABSENT_DIGITS_V2_MODEL_ID,
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
const REGISTRY = path.join(
  ROOT,
  "research",
  "absent_digits_v2",
  "FROZEN_FORWARD_REGISTRY.json",
)
const CALIBRATION_REGISTRY = path.join(
  ROOT,
  "research",
  "absent_digits_v2",
  "FROZEN_CALIBRATION_REGISTRY.json",
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
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function recordISO(record) {
  if (record.isoDate) return String(record.isoDate).slice(0, 10)
  const parts = String(record.dateRangeStart || "").replace(/-/g, "/").split("/").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [day, month, rawYear] = parts
  const date = new Date(Date.UTC(rawYear < 100 ? rawYear + 2000 : rawYear, month - 1, day))
  date.setUTCDate(date.getUTCDate() + (DAY_OFFSETS[record.day] ?? 0))
  return date.toISOString().slice(0, 10)
}

function loadRows() {
  const extended = JSON.parse(fs.readFileSync(EXTENDED, "utf8"))
  const independent = JSON.parse(fs.readFileSync(INDEPENDENT, "utf8"))
  const markets = {}
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
    markets[market] = [...rows.values()].sort((left, right) => left.isoDate.localeCompare(right.isoDate))
  }
  return markets
}

function closeEnough(actual, expected, label, tolerance = 1e-12) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: runtime=${actual} research=${expected}`)
  }
}

function compareSide(runtime, frozen, calibrated) {
  const prefix = `${frozen.market} ${frozen.side}`
  if (runtime.status !== frozen.status) throw new Error(`${prefix}: status mismatch`)
  if (runtime.candidateAvoidDigits.join("") !== frozen.candidateAvoidDigits.join("")) {
    throw new Error(`${prefix}: pair mismatch ${runtime.candidateAvoidDigits} != ${frozen.candidateAvoidDigits}`)
  }
  if (runtime.familyAgreement !== frozen.familyAgreement) {
    throw new Error(`${prefix}: family agreement mismatch`)
  }
  closeEnough(runtime.confidence, calibrated.confidence, `${prefix} confidence`)
  if (runtime.confidenceSample !== calibrated.calibrationSample) {
    throw new Error(`${prefix}: calibration sample mismatch`)
  }
  closeEnough(
    runtime.historicalReliability,
    frozen.historicalReliability,
    `${prefix} reliability`,
  )
  if (runtime.reliabilitySample !== frozen.reliabilitySample) {
    throw new Error(`${prefix}: reliability sample mismatch`)
  }
  runtime.wilson95.forEach((value, index) =>
    closeEnough(value, frozen.wilson95[index], `${prefix} Wilson ${index}`),
  )
  for (const item of runtime.digitProbabilities) {
    closeEnough(
      item.appearanceProbability,
      frozen.appearanceProbabilityByDigit[String(item.digit)],
      `${prefix} digit ${item.digit}`,
    )
  }
  if (runtime.mostLikelyDigits.join(",") !== frozen.mostLikelyDigits.join(",")) {
    throw new Error(`${prefix}: likely-digit ranking mismatch`)
  }
  runtime.supportingModels.forEach((model, index) => {
    const expected = frozen.supportingModels[index]
    if (model.name !== expected.name) {
      throw new Error(`${prefix}: contributor ${index} mismatch`)
    }
    closeEnough(model.weight, expected.weight, `${prefix} contributor ${index}`)
  })
}

function main() {
  const records = loadRows()
  const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"))
  const calibration = JSON.parse(fs.readFileSync(CALIBRATION_REGISTRY, "utf8"))
  if (registry.modelId !== ABSENT_DIGITS_V2_MODEL_ID) {
    throw new Error(`Model ID mismatch: ${ABSENT_DIGITS_V2_MODEL_ID} != ${registry.modelId}`)
  }
  if (calibration.calibrationId !== ABSENT_DIGITS_V2_CALIBRATION_ID) {
    throw new Error(
      `Calibration ID mismatch: ${ABSENT_DIGITS_V2_CALIBRATION_ID} != ${calibration.calibrationId}`,
    )
  }
  if (calibration.baseRegistryContentHash !== registry.contentHash) {
    throw new Error("Calibration addendum does not reference the frozen base registry")
  }
  const frozenByKey = new Map(
    registry.rows.map((row) => [`${row.market}|${row.side}`, row]),
  )
  const calibratedByKey = new Map(
    calibration.rows.map((row) => [`${row.market}|${row.side}`, row]),
  )
  const results = []
  for (const market of [...new Set(registry.rows.map((row) => row.market))]) {
    const openFrozen = frozenByKey.get(`${market}|open`)
    const closeFrozen = frozenByKey.get(`${market}|close`)
    if (openFrozen.targetDate !== closeFrozen.targetDate) {
      throw new Error(`${market}: Open/Close target date mismatch`)
    }
    const targetDate = openFrozen.targetDate
    const targetDay = DAY_NAMES[new Date(`${targetDate}T00:00:00Z`).getUTCDay()]
    const prediction = buildAbsentDigitsPredictionV2(
      market,
      records[market],
      targetDate,
      targetDay,
    )
    if (!prediction) throw new Error(`${market}: runtime returned no prediction`)
    const contaminated = buildAbsentDigitsPredictionV2(
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
    if (JSON.stringify(contaminated) !== JSON.stringify(prediction)) {
      throw new Error(`${market}: target/future rows changed the causal prediction`)
    }
    if (prediction.calibrationId !== ABSENT_DIGITS_V2_CALIBRATION_ID) {
      throw new Error(`${market}: runtime calibration ID mismatch`)
    }
    compareSide(
      prediction.open,
      openFrozen,
      calibratedByKey.get(`${market}|open`),
    )
    compareSide(
      prediction.close,
      closeFrozen,
      calibratedByKey.get(`${market}|close`),
    )
    results.push({
      market,
      targetDate,
      historyUsed: prediction.historyUsed,
      open: prediction.open.candidateAvoidDigits.join(""),
      close: prediction.close.candidateAvoidDigits.join(""),
      status: `${prediction.open.status}/${prediction.close.status}`,
    })
  }
  const firstMarket = registry.rows[0].market
  const insufficient = buildAbsentDigitsPredictionV2(
    firstMarket,
    records[firstMarket].slice(-179),
    "2099-01-02",
    "Friday",
  )
  if (insufficient !== null) {
    throw new Error("Runtime did not enforce the 180-row minimum history")
  }
  console.log(
    JSON.stringify(
      {
        status: "verified",
        modelId: ABSENT_DIGITS_V2_MODEL_ID,
        calibrationId: ABSENT_DIGITS_V2_CALIBRATION_ID,
        registryHash: registry.contentHash,
        calibrationRegistryHash: calibration.contentHash,
        marketSides: registry.rows.length,
        results,
      },
      null,
      2,
    ),
  )
}

main()
