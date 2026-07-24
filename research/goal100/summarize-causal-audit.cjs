/* eslint-disable no-console */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const RESEARCH_DIR = __dirname
const ARTIFACT_DIR = path.join(RESEARCH_DIR, 'artifacts')
const INPUT = path.join(ARTIFACT_DIR, 'causal-audit-all-blocks.json')
const SUMMARY = path.join(ARTIFACT_DIR, 'causal-baseline-summary.json')
const REPORT = path.join(RESEARCH_DIR, 'CAUSAL_BASELINE.md')
const TARGETS = ['open', 'close', 'jodi']
const REPLICATES = 10000
const BOOTSTRAP_REPLICATES = 2000
const DATE_BLOCK_LENGTH = 7
const MIN_SHIFT = 14

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * (sorted.length - 1))))
  return sorted[index]
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values, average = mean(values)) {
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / Math.max(1, values.length - 1))
}

function wilson(hits, n) {
  if (!n) return [null, null]
  const z = 1.96
  const p = hits / n
  const denominator = 1 + (z * z) / n
  const centre = p + (z * z) / (2 * n)
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)
  return [(centre - spread) / denominator, (centre + spread) / denominator]
}

function groupBy(rows, key) {
  const groups = new Map()
  for (const row of rows) {
    const value = row[key]
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(row)
  }
  return groups
}

function hitFor(row, actual, target) {
  if (target === 'open') return row.causal.open.includes(actual.open)
  if (target === 'close') return row.causal.close.includes(actual.close)
  return row.causal.jodi.includes(actual.jodi)
}

function shiftTables(rows) {
  const tables = []
  for (const [market, marketRowsUnsorted] of groupBy(rows, 'market')) {
    const marketRows = [...marketRowsUnsorted].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    const n = marketRows.length
    const offsets = []
    const start = n > MIN_SHIFT * 2 ? MIN_SHIFT : 1
    const end = n > MIN_SHIFT * 2 ? n - MIN_SHIFT : n
    for (let offset = start; offset < end; offset += 1) {
      const hits = Object.fromEntries(TARGETS.map((target) => [target, 0]))
      for (let index = 0; index < n; index += 1) {
        const actual = marketRows[(index + offset) % n].actual
        for (const target of TARGETS) if (hitFor(marketRows[index], actual, target)) hits[target] += 1
      }
      offsets.push(hits)
    }
    tables.push({ market, offsets })
  }
  return tables
}

function circularShiftNull(rows, seed) {
  const observed = Object.fromEntries(TARGETS.map((target) => [
    target,
    rows.filter((row) => row.causal.hits[target]).length,
  ]))
  const tables = shiftTables(rows)
  const random = mulberry32(seed)
  const distributions = Object.fromEntries(TARGETS.map((target) => [target, []]))
  for (let replicate = 0; replicate < REPLICATES; replicate += 1) {
    const totals = Object.fromEntries(TARGETS.map((target) => [target, 0]))
    for (const table of tables) {
      const selected = table.offsets[Math.floor(random() * table.offsets.length)]
      for (const target of TARGETS) totals[target] += selected[target]
    }
    for (const target of TARGETS) distributions[target].push(totals[target])
  }
  return Object.fromEntries(TARGETS.map((target) => {
    const values = distributions[target]
    const average = mean(values)
    return [target, {
      observedHits: observed[target],
      n: rows.length,
      nullMeanHits: average,
      nullSdHits: standardDeviation(values, average),
      null95Hits: [quantile(values, 0.025), quantile(values, 0.975)],
      oneSidedP: (1 + values.filter((value) => value >= observed[target]).length) / (REPLICATES + 1),
      method: `${REPLICATES} market-wise independent circular shifts; offsets within ${MIN_SHIFT - 1} rows excluded when support permits`,
    }]
  }))
}

function dateBlockBootstrap(rows, seed) {
  const byDate = groupBy(rows, 'isoDate')
  const dates = [...byDate.keys()].sort()
  const random = mulberry32(seed)
  const distributions = Object.fromEntries(TARGETS.map((target) => [target, []]))
  for (let replicate = 0; replicate < BOOTSTRAP_REPLICATES; replicate += 1) {
    const hits = Object.fromEntries(TARGETS.map((target) => [target, 0]))
    let n = 0
    let sampledDates = 0
    while (sampledDates < dates.length) {
      const start = Math.floor(random() * dates.length)
      for (let offset = 0; offset < DATE_BLOCK_LENGTH && sampledDates < dates.length; offset += 1) {
        const sampledRows = byDate.get(dates[(start + offset) % dates.length])
        for (const row of sampledRows) {
          n += 1
          for (const target of TARGETS) if (row.causal.hits[target]) hits[target] += 1
        }
        sampledDates += 1
      }
    }
    for (const target of TARGETS) distributions[target].push(hits[target] / n)
  }
  return Object.fromEntries(TARGETS.map((target) => [target, {
    interval95: [quantile(distributions[target], 0.025), quantile(distributions[target], 0.975)],
    replicates: BOOTSTRAP_REPLICATES,
    dateBlockLength: DATE_BLOCK_LENGTH,
  }]))
}

function pct(value, digits = 1) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(digits)}%`
}

function metricLabel(metric) {
  return `${metric.causalHits}/${metric.n} (${pct(metric.causalAccuracy)})`
}

function blockRows(audit, block) {
  return block === 'overall' ? audit.ledger : audit.ledger.filter((row) => row.block === block)
}

function buildSummary(audit, inputHash) {
  const blocks = [...Object.keys(audit.blocks), 'overall']
  const statistical = {}
  blocks.forEach((block, index) => {
    const rows = blockRows(audit, block)
    statistical[block] = {
      circularShift: circularShiftNull(rows, 0xA1000000 + index),
      dateBlockBootstrap: dateBlockBootstrap(rows, 0xB1000000 + index),
    }
  })

  const byMarket = {}
  for (const market of audit.markets) {
    byMarket[market] = {}
    for (const block of blocks) {
      const metrics = audit.metrics.byMarket[market][block]
      byMarket[market][block] = Object.fromEntries(TARGETS.map((target) => {
        const metric = metrics[target]
        return [target, {
          n: metric.n,
          hits: metric.causalHits,
          misses: metric.n - metric.causalHits,
          accuracy: metric.causalAccuracy,
          wilson95: wilson(metric.causalHits, metric.n),
        }]
      }))
    }
  }

  const aggregates = {}
  for (const block of blocks) {
    aggregates[block] = {}
    for (const target of TARGETS) {
      const metric = audit.metrics.aggregate[block][target]
      const marketRates = audit.markets.map((market) => byMarket[market][block][target].accuracy)
      const worstMarket = audit.markets.reduce((worst, market) => (
        byMarket[market][block][target].accuracy < byMarket[worst][block][target].accuracy ? market : worst
      ))
      aggregates[block][target] = {
        n: metric.n,
        hits: metric.causalHits,
        misses: metric.n - metric.causalHits,
        microAccuracy: metric.causalAccuracy,
        macroAccuracy: mean(marketRates),
        worstMarket,
        worstMarketAccuracy: byMarket[worstMarket][block][target].accuracy,
        wilson95: wilson(metric.causalHits, metric.n),
        dateBlockBootstrap95: statistical[block].dateBlockBootstrap[target].interval95,
        circularShift: statistical[block].circularShift[target],
      }
    }
  }
  const recentJodi = aggregates.recentFrozen.jodi.microAccuracy
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceArtifact: path.basename(INPUT),
    sourceArtifactSha256: inputHash,
    evaluationType: audit.evaluationType,
    exactVersusCausalChangedRankings: Object.fromEntries(TARGETS.map((target) => [
      target,
      audit.metrics.aggregate.overall[target].changedRanking,
    ])),
    statisticalCaveat: 'Circular-shift results diagnose alignment only. They do not correct for the extensive historical model selection already performed.',
    aggregates,
    byMarket,
    feasibilityDiagnostic: {
      recentFrozenJodiRate: recentJodi,
      empiricalGoalRowsAtThirtyPerMarket: audit.markets.length * 30,
      stationaryIndependentAllSuccessExtrapolation: recentJodi ** (audit.markets.length * 30),
      caveat: 'This extrapolation is descriptive, assumes stationarity and independence, and is not a formal probability forecast.',
    },
  }
}

function renderMarkdown(audit, summary) {
  const blocks = [...Object.keys(audit.blocks), 'overall']
  const lines = [
    '# Goal100 Causal Production Baseline',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Result',
    '',
    'The exact production replay and the nominal-schedule event-time-censored replay produced identical ordered Top-6 rankings on all 6,558 scored rows. The current selected production rules therefore show no same-day leakage under the registered schedule and ten-minute source embargo. This does not validate previously searched generic same-day candidates, and historical publication delays remain unavailable.',
    '',
    '| Block | Draws | Open | Close | Jodi |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]
  for (const block of blocks) {
    const metrics = audit.metrics.aggregate[block]
    lines.push(`| ${block} | ${metrics.open.n} | ${metricLabel(metrics.open)} | ${metricLabel(metrics.close)} | ${metricLabel(metrics.jodi)} |`)
  }
  lines.push('', '## All-history market table', '', '| Market | Draws | Open | Close | Jodi |', '| --- | ---: | ---: | ---: | ---: |')
  for (const market of audit.markets) {
    const metrics = audit.metrics.byMarket[market].overall
    lines.push(`| ${market} | ${metrics.open.n} | ${metricLabel(metrics.open)} | ${metricLabel(metrics.close)} | ${metricLabel(metrics.jodi)} |`)
  }
  lines.push('', '## Recent-frozen market table', '', '| Market | Draws | Open | Close | Jodi |', '| --- | ---: | ---: | ---: | ---: |')
  for (const market of audit.markets) {
    const metrics = audit.metrics.byMarket[market].recentFrozen
    lines.push(`| ${market} | ${metrics.open.n} | ${metricLabel(metrics.open)} | ${metricLabel(metrics.close)} | ${metricLabel(metrics.jodi)} |`)
  }
  lines.push(
    '',
    '## Statistical diagnostics',
    '',
    '| Block | Target | Coverage | Date-block bootstrap 95% | Circular-shift null mean | Shift p (one-sided) | Worst market |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
  )
  for (const block of blocks) {
    for (const target of TARGETS) {
      const metric = summary.aggregates[block][target]
      lines.push(`| ${block} | ${target} | ${pct(metric.microAccuracy)} | ${metric.dateBlockBootstrap95.map((value) => pct(value)).join(' - ')} | ${pct(metric.circularShift.nullMeanHits / metric.n)} | ${metric.circularShift.oneSidedP.toPrecision(3)} | ${metric.worstMarket} (${pct(metric.worstMarketAccuracy)}) |`)
    }
  }
  const recent = summary.aggregates.recentFrozen
  lines.push(
    '',
    "The circular-shift diagnostic preserves each market's observed Open/Close pairs and forecast-set frequencies while breaking their date alignment. It is not selection-adjusted, so low p-values cannot rehabilitate a model tuned on these same rows.",
    '',
    '## Goal100 feasibility verdict at this checkpoint',
    '',
    `The recent-frozen block still contains ${recent.open.misses} Open misses, ${recent.close.misses} Close misses, and ${recent.jodi.misses} Jodi misses. Its worst markets are ${recent.open.worstMarket} for Open (${pct(recent.open.worstMarketAccuracy)}), ${recent.close.worstMarket} for Close (${pct(recent.close.worstMarketAccuracy)}), and ${recent.jodi.worstMarket} for Jodi (${pct(recent.jodi.worstMarketAccuracy)}).`,
    '',
    `If the recent aggregate Jodi coverage (${pct(summary.feasibilityDiagnostic.recentFrozenJodiRate)}) were stationary and independent - a deliberately simplified diagnostic - the probability of 360 consecutive all-market hits would be approximately ${summary.feasibilityDiagnostic.stationaryIndependentAllSuccessExtrapolation.toExponential(2)}. This is not a formal forecast, but it shows how far the outcomes-only baseline is from empirical Goal100.`,
    '',
    'Conclusion: 100% is statistically unsupported by the current outcomes-only model and all inspected historical evidence. The production comparator remains useful, but it is not a Goal100 candidate. A challenger may enter sealed-forward testing only after nested chronological selection, full hash freezing, and non-regression in every retrospective gate.',
    '',
    '## Integrity',
    '',
    `- Source audit SHA-256: \`${summary.sourceArtifactSha256}\``,
    `- Frozen data SHA-256: \`${audit.dataSha256}\``,
    `- Production fingerprint: \`${audit.productionFingerprint}\``,
    '- Prediction sizes: six Open digits, six Close digits, and their 36-cell Jodi rectangle.',
    '- No production files were modified by this research cycle.',
    '',
  )
  return lines.join('\n')
}

function main() {
  const inputBytes = fs.readFileSync(INPUT)
  const inputHash = sha256(inputBytes)
  const audit = JSON.parse(inputBytes.toString('utf8'))
  const summary = buildSummary(audit, inputHash)
  fs.writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  fs.writeFileSync(REPORT, renderMarkdown(audit, summary), 'utf8')
  console.log(`Summary: ${SUMMARY}`)
  console.log(`Report: ${REPORT}`)
  console.log(`Audit SHA-256: ${inputHash}`)
  console.table(Object.entries(summary.aggregates).map(([block, metrics]) => ({
    block,
    n: metrics.open.n,
    open: pct(metrics.open.microAccuracy),
    close: pct(metrics.close.microAccuracy),
    jodi: pct(metrics.jodi.microAccuracy),
    worstJodi: `${metrics.jodi.worstMarket} ${pct(metrics.jodi.worstMarketAccuracy)}`,
  })))
}

try {
  main()
} catch (error) {
  console.error(error.stack || error)
  process.exit(1)
}
