/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Module = require('module')
const { spawn } = require('child_process')
const ts = require('typescript')

const ROOT = process.cwd()
const CACHE = path.join(ROOT, 'scratch', 'sutta-research-records.json')
const HISTORICAL_LEDGER = path.join(ROOT, 'scratch', 'sutta-goal95-v1010-730-ledger.json')
const FORWARD_LEDGER = path.join(ROOT, 'scratch', 'sutta-baseline-7d-goal95-v1010.json')
const OUTPUT = path.join(ROOT, 'scratch', 'sutta-rule-ablation-output.json')
const REPORT = path.join(ROOT, 'backtest_reports', '2026-07-13', 'sutta-rule-ablation.md')
const MARKET_ORDER = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar',
]
const CONCURRENCY = Math.min(6, Math.max(1, Number.parseInt(process.env.SUTTA_ABLATION_WORKERS || '6', 10)))

const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolve.call(this, path.join(ROOT, 'src', request.slice(2)), parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = function registerTypeScript(module, filename) {
    const source = fs.readFileSync(filename, 'utf8')
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

const { analyzeMarket } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const {
  buildCloseSuttaSet,
  buildOpenSuttaSet,
  getSuttaSourceHybridRuleDescriptors,
} = require('../src/lib/sutta-model/production.ts')

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function ranking(picks) {
  return picks.map((pick) => Number(pick.sutta))
}

function sameTopSet(left, right) {
  return left.length === right.length && left.every((value) => right.map(Number).includes(value))
}

function splitIndices(cases) {
  const historical = cases.map((row, index) => row.forward ? null : index).filter((index) => index !== null)
  const forward = cases.map((row, index) => row.forward ? index : null).filter((index) => index !== null)
  const developmentEnd = Math.floor(historical.length * 0.6)
  const validationEnd = Math.floor(historical.length * 0.8)
  return {
    development: historical.slice(0, developmentEnd),
    validation: historical.slice(developmentEnd, validationEnd),
    holdout: historical.slice(validationEnd),
    recent30: historical.slice(-Math.min(30, historical.length)),
    historical,
    forward,
  }
}

function metric(cases, indices) {
  let baselineSide = 0
  let candidateSide = 0
  let baselineJodi = 0
  let candidateJodi = 0
  for (const index of indices) {
    const row = cases[index]
    baselineSide += Number(row.baselineSide)
    candidateSide += Number(row.candidateSide)
    baselineJodi += Number(row.baselineJodi)
    candidateJodi += Number(row.candidateJodi)
  }
  return {
    n: indices.length,
    side: { baseline: baselineSide, candidate: candidateSide, delta: candidateSide - baselineSide },
    jodi: { baseline: baselineJodi, candidate: candidateJodi, delta: candidateJodi - baselineJodi },
  }
}

function baselineMetric(cases, indices) {
  const hits = { open: 0, close: 0, jodi: 0 }
  for (const index of indices) {
    for (const target of ['open', 'close', 'jodi']) hits[target] += Number(cases[index][target])
  }
  return { n: indices.length, ...Object.fromEntries(Object.entries(hits).map(([target, hit]) => [target, { hit }])) }
}

function ruleDecision(metrics) {
  const historicalBlocks = ['development', 'validation', 'holdout', 'recent30', 'historical']
  const historicalStable = historicalBlocks.every((block) =>
    metrics[block].side.delta >= 0 && metrics[block].jodi.delta >= 0)
    && historicalBlocks.some((block) => metrics[block].side.delta > 0 || metrics[block].jodi.delta > 0)
  const forwardStable = metrics.forward.side.delta >= 0 && metrics.forward.jodi.delta >= 0
  const forwardPositive = metrics.forward.side.delta > 0 || metrics.forward.jodi.delta > 0
  if (historicalStable && forwardStable && forwardPositive) return 'promotion_candidate'
  if (historicalStable && forwardStable) return 'monitor'
  return 'keep_rule'
}

async function runWorker(market) {
  const allRecords = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([name, records]) => [name, dated(records)]))
  const historical = JSON.parse(fs.readFileSync(HISTORICAL_LEDGER, 'utf8')).ledger
    .filter((row) => row.market === market)
    .map((row) => ({ ...row, forward: false }))
  const forward = JSON.parse(fs.readFileSync(FORWARD_LEDGER, 'utf8')).ledger
    .filter((row) => row.market === market)
    .map((row) => ({ ...row, forward: true }))
  const ledger = [...historical, ...forward].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const descriptors = [
    ...getSuttaSourceHybridRuleDescriptors(market, 'open').map((rule) => ({ ...rule, side: 'open' })),
    ...getSuttaSourceHybridRuleDescriptors(market, 'close').map((rule) => ({ ...rule, side: 'close' })),
  ]
  const ablationCases = Object.fromEntries(descriptors.map((rule) => [rule.id, []]))
  const baselineCases = []
  let evaluatedRows = 0
  const membershipMismatches = { historical: 0, forward: 0 }

  for (const ledgerRow of ledger) {
    const ownRows = allDated[market]
    const prior = ownRows.filter((item) => item.isoDate < ledgerRow.isoDate).map((item) => item.record)
    if (prior.length < 50) continue
    const priorAll = Object.fromEntries(MARKET_ORDER.map((sourceMarket) => [
      sourceMarket,
      allDated[sourceMarket].filter((item) => item.isoDate < ledgerRow.isoDate).map((item) => item.record),
    ]))
    priorAll[market] = prior
    const targetDate = new Date(`${ledgerRow.isoDate}T12:00:00`)
    const prediction = analyzeMarket(market, prior, priorAll, targetDate)
    if (!prediction) throw new Error(`${market} ${ledgerRow.isoDate}: predictor returned no result`)
    const baselineOpen = ranking(buildOpenSuttaSet(
      prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
      market, targetDate, allRecords,
    ))
    const baselineClose = ranking(buildCloseSuttaSet(
      prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
      market, null, allRecords, targetDate,
    ))
    if (!sameTopSet(baselineOpen, ledgerRow.openRanking) || !sameTopSet(baselineClose, ledgerRow.closeRanking)) {
      membershipMismatches[ledgerRow.forward ? 'forward' : 'historical']++
    }
    evaluatedRows++
    const actualOpen = Number(ledgerRow.actualOpen)
    const actualClose = Number(ledgerRow.actualClose)
    const baselineOpenHit = baselineOpen.includes(actualOpen)
    const baselineCloseHit = baselineClose.includes(actualClose)
    baselineCases.push({
      date: ledgerRow.isoDate,
      forward: ledgerRow.forward,
      open: baselineOpenHit,
      close: baselineCloseHit,
      jodi: baselineOpenHit && baselineCloseHit,
    })

    for (const rule of descriptors) {
      const options = { disabledSourceRuleIds: new Set([rule.id]) }
      const candidate = rule.side === 'open'
        ? ranking(buildOpenSuttaSet(
            prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
            market, targetDate, allRecords, options,
          ))
        : ranking(buildCloseSuttaSet(
            prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
            market, null, allRecords, targetDate, options,
          ))
      const candidateSide = candidate.includes(rule.side === 'open' ? actualOpen : actualClose)
      const baselineSide = rule.side === 'open' ? baselineOpenHit : baselineCloseHit
      const otherSideHit = rule.side === 'open' ? baselineCloseHit : baselineOpenHit
      ablationCases[rule.id].push({
        date: ledgerRow.isoDate,
        forward: ledgerRow.forward,
        baselineSide,
        candidateSide,
        baselineJodi: baselineSide && otherSideHit,
        candidateJodi: candidateSide && otherSideHit,
      })
    }
  }

  const rules = descriptors.map((descriptor) => {
    const cases = ablationCases[descriptor.id]
    const blocks = splitIndices(cases)
    const metrics = Object.fromEntries(Object.entries(blocks).map(([name, indices]) => [name, metric(cases, indices)]))
    return { ...descriptor, metrics, decision: ruleDecision(metrics) }
  })
  const baselineBlocks = splitIndices(baselineCases)
  const baselineMetrics = Object.fromEntries(
    Object.entries(baselineBlocks).map(([name, indices]) => [name, baselineMetric(baselineCases, indices)]),
  )
  if (membershipMismatches.forward > 0) {
    throw new Error(`${market}: ${membershipMismatches.forward} frozen forward Top-6 membership mismatches`)
  }
  return { market, evaluatedRows, membershipMismatches, baselineMetrics, rules }
}

function spawnWorker(market) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [__filename, `--worker=${market}`], {
      cwd: ROOT,
      env: process.env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${market} worker failed (${code}): ${stderr || stdout}`))
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(new Error(`${market} worker emitted invalid JSON: ${stdout}\n${stderr}\n${error.message}`))
      }
    })
  })
}

async function runPool() {
  const results = new Array(MARKET_ORDER.length)
  let nextIndex = 0
  async function consume() {
    while (nextIndex < MARKET_ORDER.length) {
      const index = nextIndex++
      const market = MARKET_ORDER[index]
      console.error(`Ablating ${market}...`)
      results[index] = await spawnWorker(market)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, MARKET_ORDER.length) }, () => consume()))
  return results
}

function deltaText(metric) {
  return `${metric.side.delta >= 0 ? '+' : ''}${metric.side.delta}/${metric.jodi.delta >= 0 ? '+' : ''}${metric.jodi.delta}`
}

function aggregateBaseline(markets) {
  const blocks = ['development', 'validation', 'holdout', 'recent30', 'historical', 'forward']
  return Object.fromEntries(blocks.map((block) => {
    const n = markets.reduce((sum, market) => sum + market.baselineMetrics[block].n, 0)
    return [block, {
      n,
      ...Object.fromEntries(['open', 'close', 'jodi'].map((target) => {
        const hit = markets.reduce((sum, market) => sum + market.baselineMetrics[block][target].hit, 0)
        return [target, { hit, accuracy: n ? 100 * hit / n : 0 }]
      })),
    }]
  }))
}

function deriveByMarketBaseline(rules) {
  const blocks = ['development', 'validation', 'holdout', 'recent30', 'historical', 'forward']
  return Object.fromEntries(MARKET_ORDER.map((market) => {
    const openRule = rules.find((rule) => rule.id.startsWith(`open:${market}:`))
    const closeRule = rules.find((rule) => rule.id.startsWith(`close:${market}:`))
    if (!openRule || !closeRule) throw new Error(`${market}: missing side rule for baseline derivation`)
    return [market, Object.fromEntries(blocks.map((block) => {
      const n = openRule.metrics[block].n
      const open = openRule.metrics[block].side.baseline
      const close = closeRule.metrics[block].side.baseline
      const jodi = openRule.metrics[block].jodi.baseline
      return [block, { n, open, close, jodi }]
    }))]
  }))
}

function writeReport(payload) {
  const lines = [
    '# Production Source-Rule Ablation',
    '',
    'Every source-hybrid rank promotion was disabled one at a time while the current production predictor and all other rules remained unchanged. Baseline and ablated rankings were recomputed together from the refreshed source cache.',
    '',
    'Selection does not use the forward block. A removal must be non-regressive for its target side and Jodi in development, validation, chronological holdout, recent-30, and full history. Promotion additionally requires non-regression plus a gain in separately frozen forward evidence.',
    '',
    `Rows evaluated: ${payload.evaluatedRows}. Rules audited: ${payload.rules.length}. Historical stored-ledger membership differences after the source refresh: ${payload.membershipMismatches.historical}. Frozen-forward membership differences: ${payload.membershipMismatches.forward}.`,
    '',
    '## Recomputed production baseline',
    '',
    '| Block | N | Open | Close | Jodi |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...['development', 'validation', 'holdout', 'recent30', 'historical', 'forward'].map((block) => {
      const value = payload.baseline[block]
      return `| ${block} | ${value.n} | ${value.open.hit}/${value.n} (${value.open.accuracy.toFixed(1)}%) | ${value.close.hit}/${value.n} (${value.close.accuracy.toFixed(1)}%) | ${value.jodi.hit}/${value.n} (${value.jodi.accuracy.toFixed(1)}%) |`
    }),
    '',
    '## Current recent-30 and frozen-forward by market',
    '',
    '| Market | Recent-30 N | Open | Close | Jodi | Forward N | Open | Close | Jodi |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...MARKET_ORDER.map((market) => {
      const recent = payload.byMarket[market].recent30
      const forward = payload.byMarket[market].forward
      const pct = (hit, n) => n ? `${(100 * hit / n).toFixed(1)}%` : 'n/a'
      return `| ${market} | ${recent.n} | ${pct(recent.open, recent.n)} | ${pct(recent.close, recent.n)} | ${pct(recent.jodi, recent.n)} | ${forward.n} | ${pct(forward.open, forward.n)} | ${pct(forward.close, forward.n)} | ${pct(forward.jodi, forward.n)} |`
    }),
    '',
    '| Rule removed | Source | Dev side/Jodi | Validation | Holdout | Recent-30 | Forward | Decision |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const rule of payload.rules) {
    lines.push(
      `| ${rule.id} | ${rule.origin}:${rule.sourceMarket}.${rule.sourceFeature}.${rule.formula} | `
      + `${deltaText(rule.metrics.development)} | ${deltaText(rule.metrics.validation)} | `
      + `${deltaText(rule.metrics.holdout)} | ${deltaText(rule.metrics.recent30)} | `
      + `${deltaText(rule.metrics.forward)} | ${rule.decision} |`,
    )
  }
  const candidates = payload.rules.filter((rule) => rule.decision === 'promotion_candidate')
  const monitors = payload.rules.filter((rule) => rule.decision === 'monitor')
  lines.push('', '## Decision', '')
  lines.push(`Promotion candidates: ${candidates.length}. Monitor-only removals: ${monitors.length}.`)
  lines.push('')
  lines.push('Only promotion candidates may proceed to interaction testing. No removal is integrated from a development or historical improvement alone.')
  lines.push('')
  fs.writeFileSync(REPORT, lines.join('\n'))
}

async function main() {
  if (process.argv.includes('--report-only')) {
    const payload = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'))
    payload.byMarket = deriveByMarketBaseline(payload.rules)
    fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2))
    writeReport(payload)
    console.log(`Refreshed ${OUTPUT} and ${REPORT} from existing audit results.`)
    return
  }
  const workerArg = process.argv.find((value) => value.startsWith('--worker='))
  if (workerArg) {
    const market = workerArg.slice('--worker='.length)
    if (!MARKET_ORDER.includes(market)) throw new Error(`Unknown market ${market}`)
    process.stdout.write(JSON.stringify(await runWorker(market)))
    return
  }
  const markets = await runPool()
  const payload = {
    schemaVersion: 1,
    modelVersion: '1.0.10',
    method: 'one-at-a-time exact production source-rule ablation',
    workers: CONCURRENCY,
    evaluatedRows: markets.reduce((sum, market) => sum + market.evaluatedRows, 0),
    membershipMismatches: {
      historical: markets.reduce((sum, market) => sum + market.membershipMismatches.historical, 0),
      forward: markets.reduce((sum, market) => sum + market.membershipMismatches.forward, 0),
    },
    baseline: aggregateBaseline(markets),
    rules: markets.flatMap((market) => market.rules),
  }
  payload.byMarket = deriveByMarketBaseline(payload.rules)
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2))
  writeReport(payload)
  console.log(`Evaluated ${payload.evaluatedRows} rows and audited ${payload.rules.length} rules.`)
  console.log(`Promotion candidates: ${payload.rules.filter((rule) => rule.decision === 'promotion_candidate').length}`)
  console.log(`Monitor removals: ${payload.rules.filter((rule) => rule.decision === 'monitor').length}`)
  console.log(`Saved ${OUTPUT}`)
  console.log(`Saved ${REPORT}`)
}

main().catch((error) => {
  console.error(error.stack || error.message)
  process.exitCode = 1
})
