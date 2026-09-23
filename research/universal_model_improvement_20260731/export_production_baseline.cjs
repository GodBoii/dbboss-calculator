/* eslint-disable no-console, @typescript-eslint/no-require-imports */

const fs = require("fs")
const Module = require("module")
const path = require("path")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..", "..")
const OUTPUT = path.join(__dirname, "production_baseline_ledger.json")
const START_DATE = process.argv[2] || "2025-10-01"
const END_DATE = process.argv[3] || "2026-07-30"
const MIN_TRAINING_RECORDS = 180
const SUTTA_COUNT = 6

const MARKET_URLS = {
  Sridevi: "https://dpbossss.boston/panel-chart-record/sridevi.php",
  "Time Bazar": "https://dpbossss.boston/panel-chart-record/time-bazar.php",
  "Madhur Day": "https://dpbossss.boston/panel-chart-record/madhur-day.php",
  "Milan Day": "https://dpbossss.boston/panel-chart-record/milan-day.php",
  "Rajdhani Day": "https://dpbossss.boston/panel-chart-record/rajdhani-day.php",
  Kalyan: "https://dpbossss.boston/panel-chart-record/kalyan.php",
  "Sridevi Night": "https://dpbossss.boston/panel-chart-record/sridevi-night.php",
  "Kalyan Night": "https://dpbossss.boston/panel-chart-record/kalyan-night.php",
  "Madhur Night": "https://dpbossss.boston/panel-chart-record/madhur-night.php",
  "Milan Night": "https://dpbossss.boston/panel-chart-record/milan-night.php",
  "Rajdhani Night": "https://dpbossss.boston/panel-chart-record/rajdhani-night.php",
  "Main Bazar": "https://dpbossss.boston/panel-chart-record/main-bazar.php",
}

function installTypeScriptLoader() {
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolve.call(
        this,
        path.join(ROOT, "src", request.slice(2)),
        parent,
        isMain,
        options,
      )
    }
    return originalResolve.call(this, request, parent, isMain, options)
  }
  for (const ext of [".ts", ".tsx"]) {
    require.extensions[ext] = function registerTypeScript(module, filename) {
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
}

async function fetchAll(GET) {
  const recordsByMarket = {}
  const sourceAudit = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    const request = {
      nextUrl: new URL(
        `http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`,
      ),
    }
    const response = await GET(request)
    const payload = await response.json()
    if (!response.ok) throw new Error(`${market}: ${payload.error}`)
    recordsByMarket[market] = payload.panels.map((panel) => ({
      id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
      ...panel,
      savedAt: Date.now(),
    }))
    sourceAudit[market] = payload.historySources
    console.error(`${market}: ${recordsByMarket[market].length} rows`)
  }
  return { recordsByMarket, sourceAudit }
}

async function main() {
  installTypeScriptLoader()
  const { GET } = require(path.join(ROOT, "src", "app", "api", "scrape", "route.ts"))
  const { getRecordISODate } = require(path.join(ROOT, "src", "lib", "backtest.ts"))
  const { analyzeMarket, getPanelKind } = require(path.join(ROOT, "src", "lib", "predictor.ts"))
  const {
    buildOpenSuttaSet,
    buildCloseSuttaSet,
    buildJodis,
  } = require(path.join(ROOT, "src", "lib", "sutta-model", "production.ts"))
  const {
    APP_VERSION,
    SUTTA_MODEL_VERSION,
  } = require(path.join(ROOT, "src", "lib", "app-version.ts"))

  const { recordsByMarket, sourceAudit } = await fetchAll(GET)
  const dated = Object.fromEntries(
    Object.entries(recordsByMarket).map(([market, records]) => [
      market,
      records
        .map((record) => ({ record, isoDate: getRecordISODate(record) }))
        .filter((row) => row.isoDate)
        .sort((left, right) => left.isoDate.localeCompare(right.isoDate)),
    ]),
  )
  const ledger = []

  for (const market of Object.keys(MARKET_URLS)) {
    const marketRows = dated[market]
    for (let index = 0; index < marketRows.length; index += 1) {
      const { record, isoDate } = marketRows[index]
      if (isoDate < START_DATE || isoDate > END_DATE) continue
      const prior = marketRows.slice(0, index).map((row) => row.record)
      if (prior.length < MIN_TRAINING_RECORDS) continue
      const priorAllMarkets = Object.fromEntries(
        Object.entries(dated).map(([otherMarket, rows]) => [
          otherMarket,
          rows.filter((row) => row.isoDate < isoDate).map((row) => row.record),
        ]),
      )
      priorAllMarkets[market] = prior
      const targetDate = new Date(`${isoDate}T12:00:00Z`)
      const prediction = analyzeMarket(
        market,
        prior,
        priorAllMarkets,
        targetDate,
      )
      if (!prediction) continue
      const openSuttas = buildOpenSuttaSet(
        prediction.openPicks,
        prediction.openSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        targetDate,
        priorAllMarkets,
      )
      const closeSuttas = buildCloseSuttaSet(
        prediction.closePicks,
        prediction.closeSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        null,
        priorAllMarkets,
        targetDate,
      )
      ledger.push({
        market,
        isoDate,
        day: record.day,
        actual: {
          openPanel: record.openPanel,
          openSutta: record.openSutta,
          closePanel: record.closePanel,
          closeSutta: record.closeSutta,
          jodi: record.jodi,
          openKind: getPanelKind(record.openPanel),
          closeKind: getPanelKind(record.closePanel),
        },
        production: {
          openSuttas: openSuttas.map((pick) => pick.sutta),
          closeSuttas: closeSuttas.map((pick) => pick.sutta),
          jodis: buildJodis(openSuttas, closeSuttas),
          openPanels30: prediction.openPanelPicks.slice(0, 30).map((pick) => pick.panel),
          openPanels60: prediction.openPanelPicks.map((pick) => pick.panel),
          closePanels30: prediction.closePanelPicks.slice(0, 30).map((pick) => pick.panel),
          closePanels60: prediction.closePanelPicks.map((pick) => pick.panel),
          openKind: prediction.openKindPrediction.predictedKind,
          closeKind: prediction.closeKindPrediction.predictedKind,
          openKindConfidence: prediction.openKindPrediction.confidence,
          closeKindConfidence: prediction.closeKindPrediction.confidence,
          openDpBias: prediction.openDpKindContext.dpBias,
          closeDpBias: prediction.closeDpKindContext.dpBias,
        },
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    startDate: START_DATE,
    endDate: END_DATE,
    minimumTrainingRecords: MIN_TRAINING_RECORDS,
    appVersion: APP_VERSION,
    suttaModelVersion: SUTTA_MODEL_VERSION,
    strictPriorDateOnly: true,
    sourceAudit,
    dataMaxDateByMarket: Object.fromEntries(
      Object.entries(dated).map(([market, rows]) => [market, rows.at(-1)?.isoDate ?? null]),
    ),
    recordCountByMarket: Object.fromEntries(
      Object.entries(recordsByMarket).map(([market, rows]) => [market, rows.length]),
    ),
    ledger,
  }
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Saved ${OUTPUT}`)
  console.log(`Rows: ${ledger.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
