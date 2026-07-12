const fs = require('fs')
const path = require('path')
const ts = require('typescript')

require.extensions['.ts'] = function registerTs(module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  module._compile(output, filename)
}

const { analyzeMarket } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const { ALL_PANELS, calculateSutta, getPanelKind } = require('../src/lib/predictor/panel-utils.ts')

const CACHE = path.join(__dirname, '..', 'scratch', 'open-sutta-records-cache.json')
const OUTPUT = path.join(__dirname, '..', 'scratch', 'panel-ranking-research-output.json')
const MIN_TRAINING = 50
const HOLDOUT_DAYS = 30
const VALIDATION_DAYS = 183

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((row) => row.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function ageDays(isoDate, latestDate) {
  return Math.round((Date.parse(`${latestDate}T00:00:00Z`) - Date.parse(`${isoDate}T00:00:00Z`)) / 86400000)
}

function countBy(items, keyFn) {
  const counts = new Map()
  for (const item of items) {
    const key = keyFn(item)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return counts
}

function rankPanels(history, targetDay, targetDate) {
  const recent = (n) => history.slice(-n)
  const longCounts = countBy(history, (row) => row.panel)
  const r30 = countBy(recent(30), (row) => row.panel)
  const r60 = countBy(recent(60), (row) => row.panel)
  const r120 = countBy(recent(120), (row) => row.panel)
  const weekdayRows = history.filter((row) => row.day === targetDay)
  const weekday = countBy(weekdayRows, (row) => row.panel)
  const dom = Number(targetDate.slice(8, 10))
  const sameDateRows = history.filter((row) => Number(row.isoDate.slice(8, 10)) === dom)
  const sameDate = countBy(sameDateRows, (row) => row.panel)
  const positionCounts = [0, 1, 2].map((position) => countBy(history, (row) => row.panel[position]))
  const pairCounts = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => countBy(history, (row) => `${row.panel[a]}${row.panel[b]}`))
  const suttaCounts = countBy(history, (row) => row.sutta)
  const kindCounts = countBy(history, (row) => getPanelKind(row.panel))
  const last = history.at(-1)

  const features = ALL_PANELS.map((panel) => {
    const long = longCounts.get(panel) || 0
    const pos = positionCounts.reduce((sum, counts, i) => sum + Math.log((counts.get(panel[i]) || 0) + 2), 0)
    const pairs = pairCounts.reduce((sum, counts, i) => {
      const [a, b] = [[0, 1], [0, 2], [1, 2]][i]
      return sum + Math.log((counts.get(`${panel[a]}${panel[b]}`) || 0) + 1)
    }, 0)
    const sutta = calculateSutta(panel)
    const kind = getPanelKind(panel)
    const overlap = last ? new Set(panel.split('').filter((digit) => last.panel.includes(digit))).size : 0
    const oppositeOverlap = last
      ? new Set(panel.split('').filter((digit) => last.panel.includes(String((Number(digit) + 5) % 10)))).size
      : 0
    return {
      panel,
      long,
      recent30: r30.get(panel) || 0,
      recent60: r60.get(panel) || 0,
      recent120: r120.get(panel) || 0,
      weekday: weekday.get(panel) || 0,
      sameDate: sameDate.get(panel) || 0,
      profile: Math.log(long + 1.5) + 0.45 * pos + 0.25 * pairs + 0.25 * Math.log((suttaCounts.get(sutta) || 0) + 2) + 0.2 * Math.log((kindCounts.get(kind) || 0) + 2),
      overlap,
      oppositeOverlap,
    }
  })

  const formulas = {
    longHot: (f) => f.long,
    recent30Hot: (f) => f.recent30,
    recent60Hot: (f) => f.recent60,
    recent120Hot: (f) => f.recent120,
    frequencyBlend: (f) => f.long / Math.max(1, history.length) + 1.2 * f.recent60 / Math.min(60, history.length),
    weekdayHot: (f) => f.weekday + 0.2 * f.long / 7,
    sameDateHot: (f) => f.sameDate + 0.08 * f.long,
    panelProfile: (f) => f.profile,
    previousOverlap: (f) => f.profile + 0.35 * f.overlap,
    previousAvoid: (f) => f.profile - 0.35 * f.overlap,
    oppositeDigits015: (f) => f.profile + 0.15 * f.oppositeOverlap,
    oppositeDigits025: (f) => f.profile + 0.25 * f.oppositeOverlap,
    oppositeDigits035: (f) => f.profile + 0.35 * f.oppositeOverlap,
    oppositeDigits050: (f) => f.profile + 0.5 * f.oppositeOverlap,
    oppositeDigits075: (f) => f.profile + 0.75 * f.oppositeOverlap,
  }

  return Object.fromEntries(Object.entries(formulas).map(([name, score]) => [
    name,
    [...features].sort((a, b) => score(b) - score(a) || b.long - a.long || a.panel.localeCompare(b.panel)).map((row) => row.panel),
  ]))
}

function hybrid(baseline, challenger, frozen) {
  const prefix = baseline.slice(0, frozen)
  return [...prefix, ...challenger.filter((panel) => !prefix.includes(panel))].slice(0, 30)
}

function emptyMetrics() {
  return { n: 0, top3: 0, top10: 0, top30: 0, rankSum: 0 }
}

function add(metrics, picks, actual) {
  const rank = picks.indexOf(actual) + 1
  metrics.n++
  if (rank > 0) metrics.rankSum += rank
  if (rank > 0 && rank <= 3) metrics.top3++
  if (rank > 0 && rank <= 10) metrics.top10++
  if (rank > 0 && rank <= 30) metrics.top30++
}

function summarize(metrics) {
  return {
    ...metrics,
    top3Pct: metrics.n ? 100 * metrics.top3 / metrics.n : 0,
    top10Pct: metrics.n ? 100 * metrics.top10 / metrics.n : 0,
    top30Pct: metrics.n ? 100 * metrics.top30 / metrics.n : 0,
    averageRankWhenHit: metrics.top30 ? metrics.rankSum / metrics.top30 : null,
  }
}

function blockFor(age) {
  if (age < HOLDOUT_DAYS) return 'holdout'
  if (age < HOLDOUT_DAYS + VALIDATION_DAYS) return 'validation'
  return 'development'
}

async function main() {
  const all = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const datedByMarket = Object.fromEntries(Object.entries(all).map(([market, records]) => [market, dated(records)]))
  const metrics = {}
  const ledgers = []

  function bucket(block, market, side, model) {
    const keys = [block, market, side, model]
    let cursor = metrics
    for (const key of keys.slice(0, -1)) cursor = (cursor[key] ||= {})
    return (cursor[keys.at(-1)] ||= emptyMetrics())
  }

  for (const [market, rows] of Object.entries(datedByMarket)) {
    const latestDate = rows.at(-1).isoDate
    for (let index = MIN_TRAINING; index < rows.length; index++) {
      const target = rows[index]
      const priorRows = rows.slice(0, index)
      const priorRecords = priorRows.map((row) => row.record)
      const priorAll = {}
      for (const [otherMarket, otherRows] of Object.entries(datedByMarket)) {
        priorAll[otherMarket] = otherRows.filter((row) => row.isoDate < target.isoDate).map((row) => row.record)
      }
      priorAll[market] = priorRecords
      const prediction = analyzeMarket(
        market,
        priorRecords,
        priorAll,
        new Date(`${target.isoDate}T12:00:00Z`),
        { useOpenPanelProfile: false },
      )
      if (!prediction) continue
      const age = ageDays(target.isoDate, latestDate)
      const block = blockFor(age)

      for (const side of ['open', 'close']) {
        const actual = target.record[`${side}Panel`]
        if (!actual) continue
        const baseline = prediction[`${side}Picks`].map((pick) => pick.panel)
        const history = priorRows.map((row) => ({
          panel: row.record[`${side}Panel`],
          sutta: row.record[`${side}Sutta`],
          day: row.record.day,
          isoDate: row.isoDate,
        })).filter((row) => row.panel)
        const challengers = rankPanels(history, target.record.day, target.isoDate)
        const models = { baseline }
        for (const [name, challenger] of Object.entries(challengers)) {
          models[`${name}:0`] = challenger.slice(0, 30)
          models[`${name}:3`] = hybrid(baseline, challenger, 3)
          models[`${name}:10`] = hybrid(baseline, challenger, 10)
          models[`${name}:20`] = hybrid(baseline, challenger, 20)
        }
        for (const [model, picks] of Object.entries(models)) {
          add(bucket(block, market, side, model), picks, actual)
          add(bucket(block, 'ALL', side, model), picks, actual)
          if (age >= HOLDOUT_DAYS) {
            const rollingBlock = `rolling${Math.floor((age - HOLDOUT_DAYS) / 90)}`
            add(bucket(rollingBlock, market, side, model), picks, actual)
            add(bucket(rollingBlock, 'ALL', side, model), picks, actual)
          }
        }
        ledgers.push({
          market,
          side,
          isoDate: target.isoDate,
          block,
          actual,
          hits: {
            baseline: models.baseline.includes(actual),
            'oppositeDigits035:0': models['oppositeDigits035:0'].includes(actual),
          },
        })
      }
    }
    process.stdout.write(`completed ${market}\n`)
  }

  const compact = {}
  for (const [block, markets] of Object.entries(metrics)) {
    compact[block] = {}
    for (const [market, sides] of Object.entries(markets)) {
      compact[block][market] = {}
      for (const [side, models] of Object.entries(sides)) {
        compact[block][market][side] = Object.fromEntries(Object.entries(models).map(([name, value]) => [name, summarize(value)]))
      }
    }
  }

  const publishedMetrics = {}
  for (const [block, markets] of Object.entries(compact)) {
    publishedMetrics[block] = {}
    for (const [market, sides] of Object.entries(markets)) {
      if (block.startsWith('rolling') && market !== 'ALL') continue
      publishedMetrics[block][market] = {}
      for (const [side, models] of Object.entries(sides)) {
        publishedMetrics[block][market][side] = market === 'ALL' && !block.startsWith('rolling')
          ? models
          : Object.fromEntries(
            ['baseline', 'panelProfile:0', 'oppositeDigits035:0']
              .filter((model) => models[model])
              .map((model) => [model, models[model]]),
          )
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    design: { minTraining: MIN_TRAINING, holdoutDays: HOLDOUT_DAYS, validationDays: VALIDATION_DAYS },
    metrics: publishedMetrics,
    ledgerRows: ledgers.length,
    ledgers,
  }
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2))

  for (const side of ['open', 'close']) {
    console.log(`\n${side.toUpperCase()}`)
    for (const block of ['development', 'validation', 'holdout']) {
      const rows = Object.entries(compact[block].ALL[side]).sort((a, b) => b[1].top30Pct - a[1].top30Pct)
      const baseline = compact[block].ALL[side].baseline
      console.log(`${block} baseline ${baseline.top30}/${baseline.n} ${baseline.top30Pct.toFixed(2)}%`)
      for (const [name, result] of rows.slice(0, 8)) console.log(`  ${name.padEnd(22)} ${result.top30}/${result.n} ${result.top30Pct.toFixed(2)}%`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
