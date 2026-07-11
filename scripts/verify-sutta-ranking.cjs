/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs")
const path = require("path")
const Module = require("module")
const ts = require("typescript")

const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(process.cwd(), "src", request.slice(2)), parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = function registerTs(module, filename) {
    const source = fs.readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    module._compile(output, filename)
  }
}

const {
  analyzeMarket,
  buildContextFromResult,
  computeJodiAnalysis,
} = require("../src/lib/predictor.ts")
const { getRecordISODate } = require("../src/lib/backtest.ts")
const {
  buildOpenSuttaSet,
  buildCloseSuttaSet,
  buildJodis,
} = require("../src/components/analysis/AnalysisTabs.tsx")

const marketOrder = [
  "Sridevi",
  "Time Bazar",
  "Madhur Day",
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Kalyan Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
]

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((row) => row.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function assertUniqueSuttas(label, picks, failures) {
  const seen = new Set()
  for (const pick of picks) {
    if (seen.has(pick.sutta)) failures.push(`${label}: duplicate sutta ${pick.sutta}`)
    seen.add(pick.sutta)
  }
}

function assertProbabilityOrder(label, picks, failures) {
  for (let index = 0; index < picks.length; index++) {
    const pick = picks[index]
    if (pick.rank !== index + 1) failures.push(`${label}: expected rank ${index + 1}, got ${pick.rank}`)
    if (!Number.isFinite(pick.probabilityPct) || pick.probabilityPct <= 0 || pick.probabilityPct >= 100) {
      failures.push(`${label}: invalid probability for sutta ${pick.sutta}: ${pick.probabilityPct}`)
    }
    if (index > 0 && picks[index - 1].probabilityPct < pick.probabilityPct) {
      failures.push(`${label}: probability increased from rank ${index} to ${index + 1}`)
    }
  }
  if (picks.length === 10) {
    const totalProbability = picks.reduce((sum, pick) => sum + pick.probabilityPct, 0)
    if (Math.abs(totalProbability - 100) > 0.001) {
      failures.push(`${label}: ten-digit probability total is ${totalProbability}, expected 100`)
    }
  }
}

function assertJodiOrder(label, openSuttas, closeSuttas, jodis, failures) {
  const expected = []
  for (const open of openSuttas) {
    for (const close of closeSuttas) expected.push(`${open.sutta}${close.sutta}`)
  }

  const actual = jodis.slice(0, expected.length)
  if (actual.join("|") !== expected.join("|")) {
    failures.push(`${label}: jodi order does not follow final open x close order`)
  }
  if (jodis.length !== openSuttas.length * closeSuttas.length) {
    failures.push(`${label}: expected ${openSuttas.length * closeSuttas.length} jodis, got ${jodis.length}`)
  }
  if (new Set(jodis).size !== jodis.length) failures.push(`${label}: duplicate jodis found`)
}

function verify() {
  const refreshedCache = path.join(process.cwd(), "scratch", "sutta-research-records.json")
  const cachePath = fs.existsSync(refreshedCache)
    ? refreshedCache
    : path.join(process.cwd(), "scratch", "open-sutta-records-cache.json")
  if (!fs.existsSync(cachePath)) {
    throw new Error(`Missing ${cachePath}`)
  }

  const allRecords = JSON.parse(fs.readFileSync(cachePath, "utf8"))
  const datedByMarket = Object.fromEntries(
    Object.entries(allRecords).map(([market, records]) => [market, dated(records)]),
  )
  const failures = []

  for (const market of marketOrder) {
    const rows = datedByMarket[market] ?? []
    const latest = rows[rows.length - 1]
    if (!latest) {
      failures.push(`${market}: no cached rows`)
      continue
    }

    const records = rows.slice(0, -1).map((row) => row.record)
    const allMarketsRecords = {}
    for (const otherMarket of marketOrder) {
      allMarketsRecords[otherMarket] = (datedByMarket[otherMarket] ?? [])
        .filter((row) => row.isoDate < latest.isoDate)
        .map((row) => row.record)
    }
    allMarketsRecords[market] = records

    const targetDate = new Date(`${latest.isoDate}T12:00:00Z`)
    const prediction = analyzeMarket(market, records, allMarketsRecords, targetDate)
    if (!prediction) {
      failures.push(`${market}: analyzeMarket returned no prediction`)
      continue
    }

    const jodiResult = computeJodiAnalysis(
      latest.record.openSutta,
      latest.record.openPanel || null,
      records,
      buildContextFromResult(prediction),
      prediction.closeDpKindContext,
    )

    for (let count = 1; count <= 10; count++) {
      const openSuttas = buildOpenSuttaSet(
        prediction.openPicks,
        prediction.openSuttaDroughts,
        records,
        count,
        market,
        targetDate,
        allMarketsRecords,
      )
      const closeSuttas = buildCloseSuttaSet(
        prediction.closePicks,
        prediction.closeSuttaDroughts,
        records,
        count,
        market,
        null,
        allMarketsRecords,
        targetDate,
      )
      const adjustedCloseSuttas = buildCloseSuttaSet(
        jodiResult.adjustedClosePicks,
        prediction.closeSuttaDroughts,
        records,
        count,
        market,
        latest.record.openSutta,
        allMarketsRecords,
        targetDate,
      )
      const jodis = buildJodis(openSuttas, closeSuttas)

      for (const [label, picks] of [
        ["open", openSuttas],
        ["close", closeSuttas],
        ["adjusted close", adjustedCloseSuttas],
      ]) {
        const fullLabel = `${market} top ${count} ${label}`
        if (picks.length !== count) failures.push(`${fullLabel}: expected ${count}, got ${picks.length}`)
        assertUniqueSuttas(fullLabel, picks, failures)
        assertProbabilityOrder(fullLabel, picks, failures)
      }

      assertJodiOrder(`${market} top ${count}`, openSuttas, closeSuttas, jodis, failures)
    }
  }

  if (failures.length > 0) {
    console.error("Sutta ranking verification failed:")
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log("Sutta ranking verification passed for all markets, top counts 1-10.")
}

verify()
