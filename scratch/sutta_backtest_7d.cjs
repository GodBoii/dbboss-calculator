const fs = require("fs")
const path = require("path")
const Module = require("module")
const ts = require("typescript")

// Setup TS require hook
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

function runBacktest() {
  const cachePath = path.join(process.cwd(), "scratch", "open-sutta-records-cache.json")
  if (!fs.existsSync(cachePath)) {
    throw new Error(`Missing ${cachePath}`)
  }

  const allRecords = JSON.parse(fs.readFileSync(cachePath, "utf8"))
  const datedByMarket = Object.fromEntries(
    Object.entries(allRecords).map(([market, records]) => [market, dated(records)]),
  )

  console.log("Starting Sutta Backtest for the last 7 days of available data...\n")

  const marketResults = []

  let totalDraws = 0
  let overallOpenHits = 0
  let overallCloseIndHits = 0
  let overallCloseJodiHits = 0
  let overallJodiIndHits = 0
  let overallJodiJodiHits = 0

  for (const market of marketOrder) {
    const rows = datedByMarket[market] ?? []
    if (rows.length < 50) {
      console.log(`Skipping market ${market} due to insufficient records (${rows.length})`)
      continue
    }

    // Get the last 7 draws
    const last7Rows = rows.slice(-7)
    const marketDraws = []

    for (let i = 0; i < last7Rows.length; i++) {
      const targetRow = last7Rows[i]
      const isoDate = targetRow.isoDate
      const actualOpenSutta = targetRow.record.openSutta
      const actualCloseSutta = targetRow.record.closeSutta
      const actualJodi = targetRow.record.jodi // e.g. "78"

      // Records prior to the target day
      const priorRecords = rows
        .filter((row) => row.isoDate < isoDate)
        .map((row) => row.record)

      if (priorRecords.length < 50) {
        continue
      }

      // Build allMarketsRecords prior to target day
      const priorAllMarkets = {}
      for (const otherMarket of marketOrder) {
        priorAllMarkets[otherMarket] = (datedByMarket[otherMarket] ?? [])
          .filter((row) => row.isoDate < isoDate)
          .map((row) => row.record)
      }
      priorAllMarkets[market] = priorRecords

      const targetDate = new Date(`${isoDate}T12:00:00Z`)
      const prediction = analyzeMarket(market, priorRecords, priorAllMarkets, targetDate)
      if (!prediction) {
        continue
      }

      // 1. Get Top 6 Open Sutta picks
      const openSuttas = buildOpenSuttaSet(
        prediction.openPicks,
        prediction.openSuttaDroughts,
        priorRecords,
        6,
        market,
        targetDate,
      )

      // 2. Get Top 6 Close Sutta picks (Independent Model)
      const closeSuttasInd = buildCloseSuttaSet(
        prediction.closePicks,
        prediction.closeSuttaDroughts,
        priorRecords,
        6,
        market,
        null,
        priorAllMarkets,
        targetDate,
      )

      // 3. Get Top 6 Close Sutta picks (Jodi-Adjusted Model)
      const jodiResult = computeJodiAnalysis(
        actualOpenSutta,
        targetRow.record.openPanel || null,
        priorRecords,
        buildContextFromResult(prediction),
        prediction.closeDpKindContext,
      )
      const closeSuttasJodi = buildCloseSuttaSet(
        jodiResult.adjustedClosePicks,
        prediction.closeSuttaDroughts,
        priorRecords,
        6,
        market,
        actualOpenSutta,
        priorAllMarkets,
        targetDate,
      )

      const openSuttaList = openSuttas.map(p => p.sutta)
      const closeSuttaIndList = closeSuttasInd.map(p => p.sutta)
      const closeSuttaJodiList = closeSuttasJodi.map(p => p.sutta)

      // Jodis
      const predictedJodisInd = buildJodis(openSuttas, closeSuttasInd)
      const predictedJodisJodi = buildJodis(openSuttas, closeSuttasJodi)

      const openHit = openSuttaList.includes(actualOpenSutta)
      const closeIndHit = closeSuttaIndList.includes(actualCloseSutta)
      const closeJodiHit = closeSuttaJodiList.includes(actualCloseSutta)

      const jodiIndHit = predictedJodisInd.includes(actualJodi)
      const jodiJodiHit = predictedJodisJodi.includes(actualJodi)

      totalDraws++
      if (openHit) overallOpenHits++
      if (closeIndHit) overallCloseIndHits++
      if (closeJodiHit) overallCloseJodiHits++
      if (jodiIndHit) overallJodiIndHits++
      if (jodiJodiHit) overallJodiJodiHits++

      marketDraws.push({
        date: isoDate,
        day: targetRow.record.day,
        actual: `${actualOpenSutta}-${actualCloseSutta}`,
        actualJodi,
        predictedOpen: openSuttaList.join(","),
        predictedCloseInd: closeSuttaIndList.join(","),
        predictedCloseJodi: closeSuttaJodiList.join(","),
        openHit,
        closeIndHit,
        closeJodiHit,
        jodiIndHit,
        jodiJodiHit,
      })
    }

    marketResults.push({
      market,
      draws: marketDraws,
    })
  }

  // Generate Report
  console.log("=== SUTTA & JODI BACKTEST REPORT (LAST 7 DAYS) ===\n")

  let mdReport = "# Sutta & Jodi Backtest Report (Last 7 Days)\n\n"
  mdReport += `**Total Draws Evaluated**: ${totalDraws}\n\n`

  mdReport += "## Summary of Accuracies per Market\n\n"
  mdReport += "| Market | Open Sutta Accuracy | Close Sutta (Ind) | Close Sutta (Jodi) | Jodi (Ind) Accuracy | Jodi (Jodi-Adjusted) |\n"
  mdReport += "| --- | --- | --- | --- | --- | --- |\n"

  for (const mRes of marketResults) {
    const draws = mRes.draws
    const openHits = draws.filter(d => d.openHit).length
    const closeIndHits = draws.filter(d => d.closeIndHit).length
    const closeJodiHits = draws.filter(d => d.closeJodiHit).length
    const jodiIndHits = draws.filter(d => d.jodiIndHit).length
    const jodiJodiHits = draws.filter(d => d.jodiJodiHit).length

    const openAcc = ((openHits / draws.length) * 100).toFixed(2) + "%"
    const closeIndAcc = ((closeIndHits / draws.length) * 100).toFixed(2) + "%"
    const closeJodiAcc = ((closeJodiHits / draws.length) * 100).toFixed(2) + "%"
    const jodiIndAcc = ((jodiIndHits / draws.length) * 100).toFixed(2) + "%"
    const jodiJodiAcc = ((jodiJodiHits / draws.length) * 100).toFixed(2) + "%"

    mdReport += `| **${mRes.market}** | ${openAcc} (${openHits}/${draws.length}) | ${closeIndAcc} (${closeIndHits}/${draws.length}) | ${closeJodiAcc} (${closeJodiHits}/${draws.length}) | ${jodiIndAcc} (${jodiIndHits}/${draws.length}) | ${jodiJodiAcc} (${jodiJodiHits}/${draws.length}) |\n`
  }

  const overallOpenPct = ((overallOpenHits / totalDraws) * 100).toFixed(2) + "%"
  const overallCloseIndPct = ((overallCloseIndHits / totalDraws) * 100).toFixed(2) + "%"
  const overallCloseJodiPct = ((overallCloseJodiHits / totalDraws) * 100).toFixed(2) + "%"
  const overallJodiIndPct = ((overallJodiIndHits / totalDraws) * 100).toFixed(2) + "%"
  const overallJodiJodiPct = ((overallJodiJodiHits / totalDraws) * 100).toFixed(2) + "%"

  mdReport += `| **OVERALL** | **${overallOpenPct} (${overallOpenHits}/${totalDraws})** | **${overallCloseIndPct} (${overallCloseIndHits}/${totalDraws})** | **${overallCloseJodiPct} (${overallCloseJodiHits}/${totalDraws})** | **${overallJodiIndPct} (${overallJodiIndHits}/${totalDraws})** | **${overallJodiJodiPct} (${overallJodiJodiHits}/${totalDraws})** |\n\n`

  mdReport += "## Detailed Breakdown per Market\n\n"

  for (const mRes of marketResults) {
    mdReport += `### ${mRes.market}\n\n`
    mdReport += "| Date | Day | Actual Jodi | Top 6 Open | Top 6 Close (Ind) | Top 6 Close (Jodi) | Open Hit | Close (Ind) Hit | Close (Jodi) Hit | Jodi (Ind) Hit | Jodi (Jodi) Hit |\n"
    mdReport += "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"

    for (const draw of mRes.draws) {
      mdReport += `| ${draw.date} | ${draw.day} | \`${draw.actualJodi}\` | \`[${draw.predictedOpen}]\` | \`[${draw.predictedCloseInd}]\` | \`[${draw.predictedCloseJodi}]\` | ${draw.openHit ? "✅" : "❌"} | ${draw.closeIndHit ? "✅" : "❌"} | ${draw.closeJodiHit ? "✅" : "❌"} | ${draw.jodiIndHit ? "🏆" : "❌"} | ${draw.jodiJodiHit ? "🏆" : "❌"} |\n`
    }
    mdReport += "\n"
  }

  fs.writeFileSync(path.join(process.cwd(), "scratch", "sutta_backtest_report_7d.md"), mdReport)
  console.log("Report generated at scratch/sutta_backtest_report_7d.md")

  // Console output log
  console.log("\nSUTTA & JODI ACCURACY BY MARKET (LAST 7 DAYS):")
  console.log("=====================================================================================")
  for (const mRes of marketResults) {
    const draws = mRes.draws
    const openHits = draws.filter(d => d.openHit).length
    const closeJodiHits = draws.filter(d => d.closeJodiHit).length
    const jodiJodiHits = draws.filter(d => d.jodiJodiHit).length

    const openAcc = ((openHits / draws.length) * 100).toFixed(2) + "%"
    const closeJodiAcc = ((closeJodiHits / draws.length) * 100).toFixed(2) + "%"
    const jodiJodiAcc = ((jodiJodiHits / draws.length) * 100).toFixed(2) + "%"

    console.log(`${mRes.market.padEnd(16)} | Open Sutta: ${openAcc.padEnd(8)} | Close Sutta (Jodi): ${closeJodiAcc.padEnd(8)} | Jodi Accuracy: ${jodiJodiAcc}`)
  }
  console.log("-------------------------------------------------------------------------------------")
  console.log(`OVERALL          | Open Sutta: ${overallOpenPct.padEnd(8)} | Close Sutta (Jodi): ${overallCloseJodiPct.padEnd(8)} | Jodi Accuracy: ${overallJodiJodiPct}`)
}

runBacktest()
