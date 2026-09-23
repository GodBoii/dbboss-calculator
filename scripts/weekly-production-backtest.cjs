/* eslint-disable no-console, @typescript-eslint/no-require-imports */

const fs = require("fs")
const Module = require("module")
const path = require("path")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..")
const REPORT_DATE = process.argv[2] || new Date().toISOString().slice(0, 10)
const EXPLICIT_START = process.argv[3] || null
const EXPLICIT_END = process.argv[4] || null
if (Boolean(EXPLICIT_START) !== Boolean(EXPLICIT_END)) {
  throw new Error("Provide both explicit start and end dates, or neither")
}
const REPORT_SLUG = EXPLICIT_START
  ? `${EXPLICIT_START}-to-${EXPLICIT_END}-production-backtest`
  : "weekly-production-backtest"
const OUTPUT_DIR = path.join(ROOT, "backtest_reports", REPORT_DATE)
const OUTPUT_JSON = path.join(OUTPUT_DIR, `${REPORT_SLUG}.json`)
const OUTPUT_REPORT = path.join(OUTPUT_DIR, `${REPORT_SLUG}.md`)
const SUTTA_COUNT = 3
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

function completedWeeks(anchorISO, count) {
  const anchor = new Date(`${anchorISO}T00:00:00Z`)
  const day = anchor.getUTCDay()
  const lastSaturday = addDays(anchorISO, -(day + 1))
  return Array.from({ length: count }, (_, index) => {
    const end = addDays(lastSaturday, -7 * index)
    return { start: addDays(end, -6), end }
  }).reverse()
}

function emptyCounter() {
  return { hits: 0, n: 0 }
}

function emptyMetrics() {
  return {
    draws: 0,
    openSutta: emptyCounter(),
    closeSutta: emptyCounter(),
    jodi: emptyCounter(),
    openPanel30: emptyCounter(),
    openPanel40: emptyCounter(),
    closePanel30: emptyCounter(),
    closePanel40: emptyCounter(),
    openKind: emptyCounter(),
    closeKind: emptyCounter(),
    absentOpenAll: emptyCounter(),
    absentCloseAll: emptyCounter(),
    absentOpenGated: emptyCounter(),
    absentCloseGated: emptyCounter(),
    presentOpenAll: emptyCounter(),
    presentCloseAll: emptyCounter(),
    presentOpenGated: emptyCounter(),
    presentCloseGated: emptyCounter(),
  }
}

function score(counter, eligible, hit) {
  if (!eligible) return
  counter.n += 1
  if (hit) counter.hits += 1
}

function mergeMetrics(target, source) {
  target.draws += source.draws
  for (const [key, value] of Object.entries(source)) {
    if (key === "draws") continue
    target[key].hits += value.hits
    target[key].n += value.n
  }
}

function metricValue(counter) {
  return {
    ...counter,
    accuracy: counter.n ? counter.hits / counter.n : null,
  }
}

function finalizeMetrics(metrics) {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => [
      key,
      key === "draws" ? value : metricValue(value),
    ]),
  )
}

function pairAbsent(pair, panel) {
  return pair.every((digit) => !panel.includes(String(digit)))
}

function pairPresent(pair, panel) {
  return pair.every((digit) => panel.includes(String(digit)))
}

function markdownAccuracy(metric) {
  if (!metric || metric.n === 0) return "N/A"
  return `${(metric.accuracy * 100).toFixed(1)}% (${metric.hits}/${metric.n})`
}

function markdownTable(rows, columns) {
  const header = `| ${columns.join(" | ")} |`
  const separator = `| ${columns.map(() => "---").join(" | ")} |`
  return [
    header,
    separator,
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
  const weekSections = report.weeks.map((week) => {
    const rows = Object.entries(week.byMarket).map(([market, metrics]) => ({
      Market: market,
      Draws: metrics.draws,
      "Open sutta @3": markdownAccuracy(metrics.openSutta),
      "Close sutta @3": markdownAccuracy(metrics.closeSutta),
      "Jodi grid @9": markdownAccuracy(metrics.jodi),
      "Open panel @40": markdownAccuracy(metrics.openPanel40),
      "Close panel @40": markdownAccuracy(metrics.closePanel40),
      "Open SP/DP": markdownAccuracy(metrics.openKind),
      "Close SP/DP": markdownAccuracy(metrics.closeKind),
    }))
    rows.push({
      Market: "**ALL MARKETS**",
      Draws: week.total.draws,
      "Open sutta @3": markdownAccuracy(week.total.openSutta),
      "Close sutta @3": markdownAccuracy(week.total.closeSutta),
      "Jodi grid @9": markdownAccuracy(week.total.jodi),
      "Open panel @40": markdownAccuracy(week.total.openPanel40),
      "Close panel @40": markdownAccuracy(week.total.closePanel40),
      "Open SP/DP": markdownAccuracy(week.total.openKind),
      "Close SP/DP": markdownAccuracy(week.total.closeKind),
    })

    const digitRows = Object.entries(week.byMarket).map(([market, metrics]) => ({
      Market: market,
      "Avoid open": markdownAccuracy(metrics.absentOpenAll),
      "Avoid close": markdownAccuracy(metrics.absentCloseAll),
      "Avoid gated": `${markdownAccuracy(metrics.absentOpenGated)} / ${markdownAccuracy(metrics.absentCloseGated)}`,
      "Present open": markdownAccuracy(metrics.presentOpenAll),
      "Present close": markdownAccuracy(metrics.presentCloseAll),
      "Present gated": `${markdownAccuracy(metrics.presentOpenGated)} / ${markdownAccuracy(metrics.presentCloseGated)}`,
    }))
    digitRows.push({
      Market: "**ALL MARKETS**",
      "Avoid open": markdownAccuracy(week.total.absentOpenAll),
      "Avoid close": markdownAccuracy(week.total.absentCloseAll),
      "Avoid gated": `${markdownAccuracy(week.total.absentOpenGated)} / ${markdownAccuracy(week.total.absentCloseGated)}`,
      "Present open": markdownAccuracy(week.total.presentOpenAll),
      "Present close": markdownAccuracy(week.total.presentCloseAll),
      "Present gated": `${markdownAccuracy(week.total.presentOpenGated)} / ${markdownAccuracy(week.total.presentCloseGated)}`,
    })

    return `## Week ${week.start} to ${week.end}

${markdownTable(rows, [
  "Market",
  "Draws",
  "Open sutta @3",
  "Close sutta @3",
  "Jodi grid @9",
  "Open panel @40",
  "Close panel @40",
  "Open SP/DP",
  "Close SP/DP",
])}

### Two-digit models

"Avoid" is correct only when both predicted digits are absent from the actual panel. "Present" is correct only when both predicted digits appear in the actual panel. Gated columns show Open / Close and score only predictions whose production safety/target gate passed.

${markdownTable(digitRows, [
  "Market",
  "Avoid open",
  "Avoid close",
  "Avoid gated",
  "Present open",
  "Present close",
  "Present gated",
])}`
  }).join("\n\n")

  const combinedRows = Object.entries(report.combined.byMarket).map(([market, metrics]) => ({
    Market: market,
    Draws: metrics.draws,
    "Open sutta @3": markdownAccuracy(metrics.openSutta),
    "Close sutta @3": markdownAccuracy(metrics.closeSutta),
    "Jodi grid @9": markdownAccuracy(metrics.jodi),
    "Open panel @30": markdownAccuracy(metrics.openPanel30),
    "Open panel @40": markdownAccuracy(metrics.openPanel40),
    "Close panel @30": markdownAccuracy(metrics.closePanel30),
    "Close panel @40": markdownAccuracy(metrics.closePanel40),
    "Open SP/DP": markdownAccuracy(metrics.openKind),
    "Close SP/DP": markdownAccuracy(metrics.closeKind),
  }))
  combinedRows.push({
    Market: "**ALL MARKETS**",
    Draws: report.combined.total.draws,
    "Open sutta @3": markdownAccuracy(report.combined.total.openSutta),
    "Close sutta @3": markdownAccuracy(report.combined.total.closeSutta),
    "Jodi grid @9": markdownAccuracy(report.combined.total.jodi),
    "Open panel @30": markdownAccuracy(report.combined.total.openPanel30),
    "Open panel @40": markdownAccuracy(report.combined.total.openPanel40),
    "Close panel @30": markdownAccuracy(report.combined.total.closePanel30),
    "Close panel @40": markdownAccuracy(report.combined.total.closePanel40),
    "Open SP/DP": markdownAccuracy(report.combined.total.openKind),
    "Close SP/DP": markdownAccuracy(report.combined.total.closeKind),
  })

  const combinedDigitRows = Object.entries(report.combined.byMarket).map(([market, metrics]) => ({
    Market: market,
    "Avoid open": markdownAccuracy(metrics.absentOpenAll),
    "Avoid close": markdownAccuracy(metrics.absentCloseAll),
    "Avoid gated open": markdownAccuracy(metrics.absentOpenGated),
    "Avoid gated close": markdownAccuracy(metrics.absentCloseGated),
    "Present open": markdownAccuracy(metrics.presentOpenAll),
    "Present close": markdownAccuracy(metrics.presentCloseAll),
    "Present gated open": markdownAccuracy(metrics.presentOpenGated),
    "Present gated close": markdownAccuracy(metrics.presentCloseGated),
  }))
  combinedDigitRows.push({
    Market: "**ALL MARKETS**",
    "Avoid open": markdownAccuracy(report.combined.total.absentOpenAll),
    "Avoid close": markdownAccuracy(report.combined.total.absentCloseAll),
    "Avoid gated open": markdownAccuracy(report.combined.total.absentOpenGated),
    "Avoid gated close": markdownAccuracy(report.combined.total.absentCloseGated),
    "Present open": markdownAccuracy(report.combined.total.presentOpenAll),
    "Present close": markdownAccuracy(report.combined.total.presentCloseAll),
    "Present gated open": markdownAccuracy(report.combined.total.presentOpenGated),
    "Present gated close": markdownAccuracy(report.combined.total.presentCloseGated),
  })

  const freshnessRows = Object.entries(report.dataMaxDateByMarket).map(([market, date]) => ({
    Market: market,
    "Latest actual": date ?? "N/A",
    "Rows fetched": report.recordCountByMarket[market],
  }))

  const isStandardThreeWeekReport =
    report.weeks.length === 3 && !report.methodology.explicitDateWindow
  const title = isStandardThreeWeekReport
    ? "Three-week production prediction backtest"
    : `Production prediction backtest: ${report.weeks[0].start} to ${report.weeks.at(-1).end}`
  const windowDescription = isStandardThreeWeekReport
    ? `the three last completed Sunday-Saturday weeks before ${report.anchorDate}; the incomplete current week is excluded`
    : `the explicitly requested date window ${report.weeks[0].start} through ${report.weeks.at(-1).end}`

  return `# ${title}

Generated ${report.generatedAt}. Model version: ${report.modelVersion}. App version: ${report.appVersion}.

## Method

- Test window: ${windowDescription}.
- Walk-forward scoring: each draw is predicted using only records dated before that draw. No tested result or later result is included in its training history.
- Production contract: Top 6 Open suttas, Top 6 Close suttas, their explicitly labelled 6x6 36-Jodi grid, and Top 40 Open/Close panels. Top-30 panel accuracy is included as a comparison.
- SP/DP is an exact kind classification. The app treats triple panels as SP because only SP and DP are modeled.
- Digit candidates are scored even when their UI gate says "No safe call" or "Research only"; gated results are reported separately and may have zero coverage.
- Accuracy is a hit rate per eligible completed result, not a claim of profitability. Different prediction sets have very different coverage sizes.

## ${isStandardThreeWeekReport ? "Combined three-week results by market" : "Requested-window results by market"}

${markdownTable(combinedRows, [
  "Market",
  "Draws",
  "Open sutta @3",
  "Close sutta @3",
  "Jodi grid @9",
  "Open panel @30",
  "Open panel @40",
  "Close panel @30",
  "Close panel @40",
  "Open SP/DP",
  "Close SP/DP",
])}

## Combined two-digit results

${markdownTable(combinedDigitRows, [
  "Market",
  "Avoid open",
  "Avoid close",
  "Avoid gated open",
  "Avoid gated close",
  "Present open",
  "Present close",
  "Present gated open",
  "Present gated close",
])}

${weekSections}

## Actual-result data coverage

${markdownTable(freshnessRows, ["Market", "Latest actual", "Rows fetched"])}

Primary actual-result source: [dpbossss.boston](https://dpbossss.boston/). The application's configured independent supplement was also requested, fail-soft, and its audit is preserved in the JSON report.

The machine-readable ledger contains every prediction, actual result, gate status, and hit/miss used in these tables: \`${path.basename(OUTPUT_JSON)}\`.
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
    buildPresentDigitsPredictionFromPanels,
  } = require(path.join(ROOT, "src", "lib", "present-digits.ts"))
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

  const weeks = EXPLICIT_START
    ? [{ start: EXPLICIT_START, end: EXPLICIT_END }]
    : completedWeeks(REPORT_DATE, 3)
  const weekReports = weeks.map((week) => ({
    ...week,
    byMarket: Object.fromEntries(
      Object.keys(MARKET_URLS).map((market) => [market, emptyMetrics()]),
    ),
    total: emptyMetrics(),
  }))
  const ledger = []

  for (const market of Object.keys(MARKET_URLS)) {
    const marketRows = dated[market]
    for (let index = 0; index < marketRows.length; index += 1) {
      const { record, isoDate } = marketRows[index]
      const weekIndex = weeks.findIndex(
        (week) => isoDate >= week.start && isoDate <= week.end,
      )
      if (weekIndex < 0) continue

      const prior = marketRows.slice(0, index).map((row) => row.record)
      if (prior.length < MIN_TRAINING_RECORDS) continue

      const priorAllMarkets = Object.fromEntries(
        Object.entries(dated).map(([otherMarket, rows]) => [
          otherMarket,
          rows
            .filter((row) => row.isoDate < isoDate)
            .map((row) => row.record),
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
      const jodis = buildJodis(openSuttas, closeSuttas)
      const absent = buildAbsentDigitsPredictionFromPanels(market, prior, targetDate)
      const present = buildPresentDigitsPredictionFromPanels(market, prior, targetDate)
      const metrics = emptyMetrics()
      metrics.draws = 1

      const validOpenPanel = /^\d{3}$/.test(record.openPanel)
      const validClosePanel = /^\d{3}$/.test(record.closePanel)
      const validOpenSutta = Number.isInteger(record.openSutta) && record.openSutta >= 0
      const validCloseSutta = Number.isInteger(record.closeSutta) && record.closeSutta >= 0
      const validJodi = /^\d{2}$/.test(record.jodi)

      score(
        metrics.openSutta,
        validOpenSutta,
        openSuttas.some((pick) => pick.sutta === record.openSutta),
      )
      score(
        metrics.closeSutta,
        validCloseSutta,
        closeSuttas.some((pick) => pick.sutta === record.closeSutta),
      )
      score(metrics.jodi, validJodi, jodis.includes(record.jodi))
      score(
        metrics.openPanel30,
        validOpenPanel,
        prediction.openPanelPicks.slice(0, 30).some((pick) => pick.panel === record.openPanel),
      )
      score(
        metrics.openPanel40,
        validOpenPanel,
        prediction.openPanelPicks.slice(0, PANEL_COUNT).some((pick) => pick.panel === record.openPanel),
      )
      score(
        metrics.closePanel30,
        validClosePanel,
        prediction.closePanelPicks.slice(0, 30).some((pick) => pick.panel === record.closePanel),
      )
      score(
        metrics.closePanel40,
        validClosePanel,
        prediction.closePanelPicks.slice(0, PANEL_COUNT).some((pick) => pick.panel === record.closePanel),
      )
      score(
        metrics.openKind,
        validOpenPanel,
        prediction.openKindPrediction.predictedKind === getPanelKind(record.openPanel),
      )
      score(
        metrics.closeKind,
        validClosePanel,
        prediction.closeKindPrediction.predictedKind === getPanelKind(record.closePanel),
      )

      if (absent) {
        const openHit = validOpenPanel &&
          pairAbsent(absent.open.candidateAvoidDigits, record.openPanel)
        const closeHit = validClosePanel &&
          pairAbsent(absent.close.candidateAvoidDigits, record.closePanel)
        score(metrics.absentOpenAll, validOpenPanel, openHit)
        score(metrics.absentCloseAll, validClosePanel, closeHit)
        score(metrics.absentOpenGated, validOpenPanel && absent.open.status === "CALL", openHit)
        score(metrics.absentCloseGated, validClosePanel && absent.close.status === "CALL", closeHit)
      }

      if (present) {
        const openHit = validOpenPanel &&
          pairPresent(present.open.predictedDigits, record.openPanel)
        const closeHit = validClosePanel &&
          pairPresent(present.close.predictedDigits, record.closePanel)
        score(metrics.presentOpenAll, validOpenPanel, openHit)
        score(metrics.presentCloseAll, validClosePanel, closeHit)
        score(
          metrics.presentOpenGated,
          validOpenPanel && present.open.status === "TARGET_REACHED",
          openHit,
        )
        score(
          metrics.presentCloseGated,
          validClosePanel && present.close.status === "TARGET_REACHED",
          closeHit,
        )
      }

      mergeMetrics(weekReports[weekIndex].byMarket[market], metrics)
      mergeMetrics(weekReports[weekIndex].total, metrics)
      ledger.push({
        week: weeks[weekIndex],
        market,
        isoDate,
        actual: {
          openPanel: record.openPanel,
          openSutta: record.openSutta,
          jodi: record.jodi,
          closePanel: record.closePanel,
          closeSutta: record.closeSutta,
          openKind: validOpenPanel ? getPanelKind(record.openPanel) : null,
          closeKind: validClosePanel ? getPanelKind(record.closePanel) : null,
        },
        prediction: {
          openSuttas: openSuttas.map((pick) => pick.sutta),
          closeSuttas: closeSuttas.map((pick) => pick.sutta),
          jodis,
          openPanels30: prediction.openPanelPicks.slice(0, 30).map((pick) => pick.panel),
          openPanels40: prediction.openPanelPicks.slice(0, PANEL_COUNT).map((pick) => pick.panel),
          closePanels30: prediction.closePanelPicks.slice(0, 30).map((pick) => pick.panel),
          closePanels40: prediction.closePanelPicks.slice(0, PANEL_COUNT).map((pick) => pick.panel),
          openKind: prediction.openKindPrediction.predictedKind,
          closeKind: prediction.closeKindPrediction.predictedKind,
          absentOpen: absent?.open.candidateAvoidDigits ?? null,
          absentOpenStatus: absent?.open.status ?? null,
          absentClose: absent?.close.candidateAvoidDigits ?? null,
          absentCloseStatus: absent?.close.status ?? null,
          presentOpen: present?.open.predictedDigits ?? null,
          presentOpenStatus: present?.open.status ?? null,
          presentClose: present?.close.predictedDigits ?? null,
          presentCloseStatus: present?.close.status ?? null,
        },
        hits: finalizeMetrics(metrics),
      })
    }
  }

  const combinedByMarket = Object.fromEntries(
    Object.keys(MARKET_URLS).map((market) => [market, emptyMetrics()]),
  )
  const combinedTotal = emptyMetrics()
  for (const week of weekReports) {
    for (const [market, metrics] of Object.entries(week.byMarket)) {
      mergeMetrics(combinedByMarket[market], metrics)
    }
    mergeMetrics(combinedTotal, week.total)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    anchorDate: REPORT_DATE,
    timezone: "Asia/Calcutta",
    appVersion: APP_VERSION,
    modelVersion: SUTTA_MODEL_VERSION,
    methodology: {
      weekDefinition: "Sunday through Saturday",
      completedWeeksOnly: true,
      minimumTrainingRecords: MIN_TRAINING_RECORDS,
      suttaCount: SUTTA_COUNT,
      jodiCount: SUTTA_COUNT * SUTTA_COUNT,
      panelRanks: [30, PANEL_COUNT],
      strictPriorDateOnly: true,
      explicitDateWindow: Boolean(EXPLICIT_START),
    },
    sourceAudit,
    recordCountByMarket: Object.fromEntries(
      Object.entries(recordsByMarket).map(([market, rows]) => [market, rows.length]),
    ),
    dataMaxDateByMarket: Object.fromEntries(
      Object.entries(dated).map(([market, rows]) => [market, rows.at(-1)?.isoDate ?? null]),
    ),
    weeks: weekReports.map((week) => ({
      start: week.start,
      end: week.end,
      byMarket: Object.fromEntries(
        Object.entries(week.byMarket).map(([market, metrics]) => [
          market,
          finalizeMetrics(metrics),
        ]),
      ),
      total: finalizeMetrics(week.total),
    })),
    combined: {
      byMarket: Object.fromEntries(
        Object.entries(combinedByMarket).map(([market, metrics]) => [
          market,
          finalizeMetrics(metrics),
        ]),
      ),
      total: finalizeMetrics(combinedTotal),
    },
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
