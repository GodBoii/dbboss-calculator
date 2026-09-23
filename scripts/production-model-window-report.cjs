/* eslint-disable no-console, @typescript-eslint/no-require-imports */

const fs = require("fs")
const Module = require("module")
const path = require("path")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..")
const REPORT_DATE = process.argv[2] || new Date().toISOString().slice(0, 10)
const OUTPUT_DIR = path.join(ROOT, "backtest_reports", REPORT_DATE)
const OUTPUT_JSON = path.join(OUTPUT_DIR, "production-model-window-report.json")
const OUTPUT_REPORT = path.join(OUTPUT_DIR, "production-model-window-report.md")
const WINDOWS = [7, 30, 90]
const SUTTA_COUNT = 6
const PANEL_COUNT = 40
const MIN_TRAINING_RECORDS = 180

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

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function emptyCounter() {
  return { hits: 0, n: 0 }
}

function emptyMetrics() {
  return {
    draws: 0,
    openSuttaTop6: emptyCounter(),
    closeSuttaTop6: emptyCounter(),
    jodiGrid36: emptyCounter(),
    strictOpenSuttaTop6: emptyCounter(),
    strictCloseSuttaTop6: emptyCounter(),
    strictJodiGrid36: emptyCounter(),
    openPanelTop40: emptyCounter(),
    closePanelTop40: emptyCounter(),
    avoidOpen: emptyCounter(),
    avoidClose: emptyCounter(),
    avoidOpenGated: emptyCounter(),
    avoidCloseGated: emptyCounter(),
    openDp: { actual: 0, predicted: 0, correct: 0, n: 0 },
    closeDp: { actual: 0, predicted: 0, correct: 0, n: 0 },
  }
}

function score(counter, eligible, hit) {
  if (!eligible) return
  counter.n += 1
  if (hit) counter.hits += 1
}

function scoreDp(counter, validPanel, actualKind, predictedKind) {
  if (!validPanel) return
  counter.n += 1
  if (actualKind === "DP") counter.actual += 1
  if (predictedKind === "DP") counter.predicted += 1
  if (actualKind === "DP" && predictedKind === "DP") counter.correct += 1
}

function mergeMetrics(target, source) {
  target.draws += source.draws
  for (const key of [
    "openSuttaTop6",
    "closeSuttaTop6",
    "jodiGrid36",
    "strictOpenSuttaTop6",
    "strictCloseSuttaTop6",
    "strictJodiGrid36",
    "openPanelTop40",
    "closePanelTop40",
    "avoidOpen",
    "avoidClose",
    "avoidOpenGated",
    "avoidCloseGated",
  ]) {
    target[key].hits += source[key].hits
    target[key].n += source[key].n
  }
  for (const key of ["openDp", "closeDp"]) {
    target[key].actual += source[key].actual
    target[key].predicted += source[key].predicted
    target[key].correct += source[key].correct
    target[key].n += source[key].n
  }
}

function finalizeCounter(counter) {
  return { ...counter, accuracy: counter.n ? counter.hits / counter.n : null }
}

function finalizeDp(counter) {
  return {
    ...counter,
    actualRate: counter.n ? counter.actual / counter.n : null,
    predictedRate: counter.n ? counter.predicted / counter.n : null,
    recall: counter.actual ? counter.correct / counter.actual : null,
    precision: counter.predicted ? counter.correct / counter.predicted : null,
  }
}

function finalizeMetrics(metrics) {
  return {
    draws: metrics.draws,
    openSuttaTop6: finalizeCounter(metrics.openSuttaTop6),
    closeSuttaTop6: finalizeCounter(metrics.closeSuttaTop6),
    jodiGrid36: finalizeCounter(metrics.jodiGrid36),
    strictOpenSuttaTop6: finalizeCounter(metrics.strictOpenSuttaTop6),
    strictCloseSuttaTop6: finalizeCounter(metrics.strictCloseSuttaTop6),
    strictJodiGrid36: finalizeCounter(metrics.strictJodiGrid36),
    openPanelTop40: finalizeCounter(metrics.openPanelTop40),
    closePanelTop40: finalizeCounter(metrics.closePanelTop40),
    avoidOpen: finalizeCounter(metrics.avoidOpen),
    avoidClose: finalizeCounter(metrics.avoidClose),
    avoidOpenGated: finalizeCounter(metrics.avoidOpenGated),
    avoidCloseGated: finalizeCounter(metrics.avoidCloseGated),
    openDp: finalizeDp(metrics.openDp),
    closeDp: finalizeDp(metrics.closeDp),
  }
}

function pairAbsent(pair, panel) {
  return pair.every((digit) => !panel.includes(String(digit)))
}

function pct(value) {
  return value === null || value === undefined ? "N/A" : `${(value * 100).toFixed(1)}%`
}

function accuracy(metric) {
  if (!metric || metric.n === 0) return "N/A"
  return `${pct(metric.accuracy)} (${metric.hits}/${metric.n})`
}

function dpText(metric) {
  if (!metric || metric.n === 0) return "N/A"
  return `actual ${metric.actual}, predicted ${metric.predicted}, correct ${metric.correct}, recall ${pct(metric.recall)}, precision ${pct(metric.precision)}`
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => row[column] ?? "").join(" | ")} |`),
  ].join("\n")
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

function renderReport(report) {
  const sections = report.windows.map((windowReport) => {
    const suttaRows = Object.entries(windowReport.byMarket).map(([market, metrics]) => ({
      Market: market,
      Draws: metrics.draws,
      "Open sutta Top 6": accuracy(metrics.openSuttaTop6),
      "Close sutta Top 6": accuracy(metrics.closeSuttaTop6),
      "Jodi Top 36": accuracy(metrics.jodiGrid36),
      "Strict prior-only": [
        accuracy(metrics.strictOpenSuttaTop6),
        accuracy(metrics.strictCloseSuttaTop6),
        accuracy(metrics.strictJodiGrid36),
      ].join(" / "),
    }))
    suttaRows.push({
      Market: "**ALL MARKETS**",
      Draws: windowReport.total.draws,
      "Open sutta Top 6": accuracy(windowReport.total.openSuttaTop6),
      "Close sutta Top 6": accuracy(windowReport.total.closeSuttaTop6),
      "Jodi Top 36": accuracy(windowReport.total.jodiGrid36),
      "Strict prior-only": [
        accuracy(windowReport.total.strictOpenSuttaTop6),
        accuracy(windowReport.total.strictCloseSuttaTop6),
        accuracy(windowReport.total.strictJodiGrid36),
      ].join(" / "),
    })

    const panelRows = Object.entries(windowReport.byMarket).map(([market, metrics]) => ({
      Market: market,
      Draws: metrics.draws,
      "Open panel Top 40": accuracy(metrics.openPanelTop40),
      "Close panel Top 40": accuracy(metrics.closePanelTop40),
    }))
    panelRows.push({
      Market: "**ALL MARKETS**",
      Draws: windowReport.total.draws,
      "Open panel Top 40": accuracy(windowReport.total.openPanelTop40),
      "Close panel Top 40": accuracy(windowReport.total.closePanelTop40),
    })

    const avoidRows = Object.entries(windowReport.byMarket).map(([market, metrics]) => ({
      Market: market,
      Draws: metrics.draws,
      "Avoid open pair": accuracy(metrics.avoidOpen),
      "Avoid close pair": accuracy(metrics.avoidClose),
      "Gated open": accuracy(metrics.avoidOpenGated),
      "Gated close": accuracy(metrics.avoidCloseGated),
    }))
    avoidRows.push({
      Market: "**ALL MARKETS**",
      Draws: windowReport.total.draws,
      "Avoid open pair": accuracy(windowReport.total.avoidOpen),
      "Avoid close pair": accuracy(windowReport.total.avoidClose),
      "Gated open": accuracy(windowReport.total.avoidOpenGated),
      "Gated close": accuracy(windowReport.total.avoidCloseGated),
    })

    const dpRows = Object.entries(windowReport.byMarket).map(([market, metrics]) => ({
      Market: market,
      Draws: metrics.draws,
      "Open DP only": dpText(metrics.openDp),
      "Close DP only": dpText(metrics.closeDp),
    }))
    dpRows.push({
      Market: "**ALL MARKETS**",
      Draws: windowReport.total.draws,
      "Open DP only": dpText(windowReport.total.openDp),
      "Close DP only": dpText(windowReport.total.closeDp),
    })

    return `## Last ${windowReport.days} days (${windowReport.start} to ${windowReport.end})

### Open sutta, close sutta, and Jodi

Main columns use event-aware same-day source context: a source market can be used only when its open/close result is earlier than the target open/close time. The strict prior-only column shows open / close / jodi with all same-date source context removed.

${markdownTable(suttaRows, [
  "Market",
  "Draws",
  "Open sutta Top 6",
  "Close sutta Top 6",
  "Jodi Top 36",
  "Strict prior-only",
])}

### Open and close panels

${markdownTable(panelRows, [
  "Market",
  "Draws",
  "Open panel Top 40",
  "Close panel Top 40",
])}

### Two digits to avoid

Correct means both predicted avoided digits were absent from the actual panel.

${markdownTable(avoidRows, [
  "Market",
  "Draws",
  "Avoid open pair",
  "Avoid close pair",
  "Gated open",
  "Gated close",
])}

### DP only

SP rows are not counted as correct DP. The table reports actual DP count, predicted DP count, and actual-DP-and-predicted-DP correct count.

${markdownTable(dpRows, [
  "Market",
  "Draws",
  "Open DP only",
  "Close DP only",
])}`
  }).join("\n\n")

  const coverageRows = Object.entries(report.dataMaxDateByMarket).map(([market, date]) => ({
    Market: market,
    "Latest actual": date ?? "N/A",
    "Rows fetched": report.recordCountByMarket[market],
  }))

  return `# Production app model backtest: 7, 30, and 90 days

Generated ${report.generatedAt}. App version: ${report.appVersion}. Sutta model version: ${report.modelVersion}.

## Method

1. Fetched each production market through the app scrape route.
2. Used the latest fetched actual date, ${report.anchorDate}, as the shared window anchor.
3. Replayed every eligible draw walk-forward: panel, avoid, and DP predictions used only rows dated before the draw.
4. Scored production Top 6 Open suttas, Top 6 Close suttas, and the 6x6 Jodi grid. Sutta source-hybrid rules may use same-date source rows only when that source open/close event happens earlier by the market schedule.
5. Scored production Top 40 Open and Close panel lists.
6. Scored the production avoided two-digit model; gated columns include only CALL rows.
7. Scored DP as DP-only counts. SP is not included as a "correct" kind result.

${sections}

## Data coverage

${markdownTable(coverageRows, ["Market", "Latest actual", "Rows fetched"])}

The JSON ledger contains every prediction, actual result, gate status, and hit/miss used here: \`${path.basename(OUTPUT_JSON)}\`.
`
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
    buildAbsentDigitsPredictionFromPanels,
  } = require(path.join(ROOT, "src", "lib", "absent-digits.ts"))
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
  const anchorDate = Object.values(dated)
    .flat()
    .map((row) => row.isoDate)
    .sort()
    .at(-1)
  if (!anchorDate) throw new Error("No dated records fetched")

  const windows = WINDOWS.map((days) => ({
    days,
    start: addDays(anchorDate, -(days - 1)),
    end: anchorDate,
    byMarket: Object.fromEntries(Object.keys(MARKET_URLS).map((market) => [market, emptyMetrics()])),
    total: emptyMetrics(),
  }))
  const ledger = []

  for (const market of Object.keys(MARKET_URLS)) {
    const marketRows = dated[market]
    for (let index = 0; index < marketRows.length; index += 1) {
      const { record, isoDate } = marketRows[index]
      const matchingWindows = windows.filter((window) => isoDate >= window.start && isoDate <= window.end)
      if (matchingWindows.length === 0) continue

      const prior = marketRows.slice(0, index).map((row) => row.record)
      if (prior.length < MIN_TRAINING_RECORDS) continue

      const priorAllMarkets = Object.fromEntries(
        Object.entries(dated).map(([otherMarket, rows]) => [
          otherMarket,
          rows.filter((row) => row.isoDate < isoDate).map((row) => row.record),
        ]),
      )
      priorAllMarkets[market] = prior
      const eventAwareAllMarkets = Object.fromEntries(
        Object.entries(dated).map(([otherMarket, rows]) => [
          otherMarket,
          otherMarket === market
            ? prior
            : rows.filter((row) => row.isoDate <= isoDate).map((row) => row.record),
        ]),
      )
      const targetDate = new Date(`${isoDate}T12:00:00Z`)
      const prediction = analyzeMarket(market, prior, priorAllMarkets, targetDate)
      if (!prediction) continue

      const openSuttas = buildOpenSuttaSet(
        prediction.openPicks,
        prediction.openSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        targetDate,
        eventAwareAllMarkets,
      )
      const closeSuttas = buildCloseSuttaSet(
        prediction.closePicks,
        prediction.closeSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        null,
        eventAwareAllMarkets,
        targetDate,
      )
      const jodis = buildJodis(openSuttas, closeSuttas)
      const strictOpenSuttas = buildOpenSuttaSet(
        prediction.openPicks,
        prediction.openSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        targetDate,
        priorAllMarkets,
      )
      const strictCloseSuttas = buildCloseSuttaSet(
        prediction.closePicks,
        prediction.closeSuttaDroughts,
        prior,
        SUTTA_COUNT,
        market,
        null,
        priorAllMarkets,
        targetDate,
      )
      const strictJodis = buildJodis(strictOpenSuttas, strictCloseSuttas)
      const absent = buildAbsentDigitsPredictionFromPanels(market, prior, targetDate)
      const metrics = emptyMetrics()
      metrics.draws = 1

      const validOpenPanel = /^\d{3}$/.test(record.openPanel)
      const validClosePanel = /^\d{3}$/.test(record.closePanel)
      const validOpenSutta = Number.isInteger(record.openSutta) && record.openSutta >= 0
      const validCloseSutta = Number.isInteger(record.closeSutta) && record.closeSutta >= 0
      const validJodi = /^\d{2}$/.test(record.jodi)
      const actualOpenKind = validOpenPanel ? getPanelKind(record.openPanel) : null
      const actualCloseKind = validClosePanel ? getPanelKind(record.closePanel) : null

      score(metrics.openSuttaTop6, validOpenSutta, openSuttas.some((pick) => pick.sutta === record.openSutta))
      score(metrics.closeSuttaTop6, validCloseSutta, closeSuttas.some((pick) => pick.sutta === record.closeSutta))
      score(metrics.jodiGrid36, validJodi, jodis.includes(record.jodi))
      score(
        metrics.strictOpenSuttaTop6,
        validOpenSutta,
        strictOpenSuttas.some((pick) => pick.sutta === record.openSutta),
      )
      score(
        metrics.strictCloseSuttaTop6,
        validCloseSutta,
        strictCloseSuttas.some((pick) => pick.sutta === record.closeSutta),
      )
      score(metrics.strictJodiGrid36, validJodi, strictJodis.includes(record.jodi))
      score(
        metrics.openPanelTop40,
        validOpenPanel,
        prediction.openPanelPicks.slice(0, PANEL_COUNT).some((pick) => pick.panel === record.openPanel),
      )
      score(
        metrics.closePanelTop40,
        validClosePanel,
        prediction.closePanelPicks.slice(0, PANEL_COUNT).some((pick) => pick.panel === record.closePanel),
      )
      scoreDp(metrics.openDp, validOpenPanel, actualOpenKind, prediction.openKindPrediction.predictedKind)
      scoreDp(metrics.closeDp, validClosePanel, actualCloseKind, prediction.closeKindPrediction.predictedKind)

      if (absent) {
        const openHit = validOpenPanel && pairAbsent(absent.open.candidateAvoidDigits, record.openPanel)
        const closeHit = validClosePanel && pairAbsent(absent.close.candidateAvoidDigits, record.closePanel)
        score(metrics.avoidOpen, validOpenPanel, openHit)
        score(metrics.avoidClose, validClosePanel, closeHit)
        score(metrics.avoidOpenGated, validOpenPanel && absent.open.status === "CALL", openHit)
        score(metrics.avoidCloseGated, validClosePanel && absent.close.status === "CALL", closeHit)
      }

      for (const window of matchingWindows) {
        mergeMetrics(window.byMarket[market], metrics)
        mergeMetrics(window.total, metrics)
      }
      ledger.push({
        market,
        isoDate,
        actual: {
          openPanel: record.openPanel,
          openSutta: record.openSutta,
          jodi: record.jodi,
          closePanel: record.closePanel,
          closeSutta: record.closeSutta,
          openKind: actualOpenKind,
          closeKind: actualCloseKind,
        },
        prediction: {
          openSuttas: openSuttas.map((pick) => pick.sutta),
          closeSuttas: closeSuttas.map((pick) => pick.sutta),
          jodis,
          strictOpenSuttas: strictOpenSuttas.map((pick) => pick.sutta),
          strictCloseSuttas: strictCloseSuttas.map((pick) => pick.sutta),
          strictJodis,
          openPanels40: prediction.openPanelPicks.slice(0, PANEL_COUNT).map((pick) => pick.panel),
          closePanels40: prediction.closePanelPicks.slice(0, PANEL_COUNT).map((pick) => pick.panel),
          openKind: prediction.openKindPrediction.predictedKind,
          closeKind: prediction.closeKindPrediction.predictedKind,
          avoidOpen: absent?.open.candidateAvoidDigits ?? null,
          avoidOpenStatus: absent?.open.status ?? null,
          avoidClose: absent?.close.candidateAvoidDigits ?? null,
          avoidCloseStatus: absent?.close.status ?? null,
        },
        hits: finalizeMetrics(metrics),
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    anchorDate,
    timezone: "Asia/Calcutta",
    appVersion: APP_VERSION,
    modelVersion: SUTTA_MODEL_VERSION,
    methodology: {
      windows: WINDOWS,
      sharedAnchorDate: true,
      minimumTrainingRecords: MIN_TRAINING_RECORDS,
      suttaCount: SUTTA_COUNT,
      jodiCount: SUTTA_COUNT * SUTTA_COUNT,
      panelCount: PANEL_COUNT,
      panelAvoidDpStrictPriorDateOnly: true,
      suttaEventAwareSameDaySources: true,
      strictPriorOnlySuttaControlIncluded: true,
      dpOnlyKindScoring: true,
      spExcludedFromCorrectDp: true,
    },
    sourceAudit,
    recordCountByMarket: Object.fromEntries(
      Object.entries(recordsByMarket).map(([market, rows]) => [market, rows.length]),
    ),
    dataMaxDateByMarket: Object.fromEntries(
      Object.entries(dated).map(([market, rows]) => [market, rows.at(-1)?.isoDate ?? null]),
    ),
    windows: windows.map((window) => ({
      days: window.days,
      start: window.start,
      end: window.end,
      byMarket: Object.fromEntries(
        Object.entries(window.byMarket).map(([market, metrics]) => [market, finalizeMetrics(metrics)]),
      ),
      total: finalizeMetrics(window.total),
    })),
    ledger,
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(OUTPUT_REPORT, renderReport(report))
  console.log(`Saved ${OUTPUT_REPORT}`)
  console.log(`Saved ${OUTPUT_JSON}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
