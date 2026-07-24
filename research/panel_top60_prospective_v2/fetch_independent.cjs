/* Fetch genuinely later panel rows from an independent timestamped source.
 *
 * Market identity is accepted only after exact overlap validation against the
 * frozen DPBoss history. Rajdhani Day is deliberately excluded because the
 * public source's same-named market does not match the target series.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const EXTENDED = path.join(ROOT, 'research', 'panel_top30_v2', 'extended_records.json')
const PRIMARY_FORWARD = path.join(ROOT, 'research', 'panel_top30_v2', 'forward_records.json')
const OUTPUT = path.join(__dirname, 'independent_forward_records.json')
const API = 'https://api.cloudsoft.one/portal/charts'
const HOST = 'sattamatka.ai'
const MIN_OVERLAP = 20

const SLUGS = {
  Sridevi: 'sridevi-bazar',
  'Time Bazar': 'time-bazar',
  'Madhur Day': 'madhur-day',
  'Milan Day': 'milan-day',
  Kalyan: 'kalyan',
  'Sridevi Night': 'sridevi-bazar-night',
  'Kalyan Night': 'kalyan-night',
  'Madhur Night': 'madhur-night',
  'Milan Night': 'milan-night',
  'Rajdhani Night': 'rajdhani-night',
  'Main Bazar': 'main-bazar',
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const OFFSETS = Object.fromEntries(DAYS.map((day, index) => [day, index]))

function isoDate(record) {
  if (record.isoDate) return record.isoDate
  const parts = String(record.dateRangeStart || '').replace(/-/g, '/').split('/').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [day, month, rawYear] = parts
  const value = new Date(Date.UTC(rawYear < 100 ? rawYear + 2000 : rawYear, month - 1, day))
  value.setUTCDate(value.getUTCDate() + (OFFSETS[record.day] ?? 0))
  return value.toISOString().slice(0, 10)
}

function shiftDate(iso, days) {
  const value = new Date(`${iso}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function weekday(iso) {
  const index = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return DAYS[(index + 6) % 7]
}

function sutta(panel) {
  return [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10
}

function legalPanel(panel) {
  if (!/^\d{3}$/.test(panel)) return false
  const digits = [...panel].map(Number)
  const order = (digit) => digit === 0 ? 10 : digit
  return order(digits[0]) <= order(digits[1]) && order(digits[1]) <= order(digits[2])
}

async function fetchChart(slug, fromDate, toDate) {
  const query = new URLSearchParams({
    urlSlug: slug,
    page: 'detailed',
    type: 'detailed',
    fromDate,
    toDate,
  })
  const response = await fetch(`${API}?${query}`, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36',
      'x-host': HOST,
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload.results)) throw new Error('Missing chart results')
  return payload.results
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const extended = JSON.parse(fs.readFileSync(EXTENDED, 'utf8'))
  const primary = JSON.parse(fs.readFileSync(PRIMARY_FORWARD, 'utf8'))
  const today = fetchedAt.slice(0, 10)
  const acceptedForward = {}
  const audit = {}

  for (const [market, slug] of Object.entries(SLUGS)) {
    const targetRows = extended.extended[market] || []
    const target = new Map(targetRows.map((record) => [
      isoDate(record),
      `${record.openPanel}-${record.closePanel}`,
    ]))
    const liveLatest = primary.audit[market]?.liveLatest
    if (!liveLatest) throw new Error(`Missing primary cutoff for ${market}`)
    const validationStart = shiftDate(liveLatest, -60)
    const sourceRows = await fetchChart(slug, validationStart, today)
    let overlap = 0
    let matches = 0
    const conflicts = []
    for (const row of sourceRows) {
      const expected = target.get(row.resultDate)
      if (!expected) continue
      overlap++
      const observed = `${row.panOpen}-${row.panClose}`
      if (observed === expected) matches++
      else if (conflicts.length < 5) conflicts.push({ date: row.resultDate, expected, observed })
    }
    const matchRate = overlap ? matches / overlap : 0
    const observedWeekdays = new Set(targetRows.slice(-90).map((record) => weekday(isoDate(record))))
    const identityAccepted = overlap >= MIN_OVERLAP && matchRate === 1
    const rows = []
    let invalidRows = 0
    let scheduleFilteredRows = 0
    for (const row of sourceRows) {
      if (row.resultDate <= liveLatest) continue
      if (!observedWeekdays.has(weekday(row.resultDate))) {
        scheduleFilteredRows++
        continue
      }
      const openPanel = String(row.panOpen || '')
      const closePanel = String(row.panClose || '')
      const jodi = String(row.bracket || '').padStart(2, '0')
      const internallyConsistent = (
        legalPanel(openPanel)
        && legalPanel(closePanel)
        && /^\d{2}$/.test(jodi)
        && jodi === `${sutta(openPanel)}${sutta(closePanel)}`
      )
      if (!internallyConsistent) {
        invalidRows++
        continue
      }
      rows.push({
        id: row._id,
        market,
        isoDate: row.resultDate,
        day: weekday(row.resultDate),
        openPanel,
        openSutta: sutta(openPanel),
        jodi,
        closePanel,
        closeSutta: sutta(closePanel),
        sourceUpdatedAt: row.updatedAt || null,
      })
    }
    acceptedForward[market] = identityAccepted ? rows : []
    audit[market] = {
      slug,
      primaryLiveLatest: liveLatest,
      validationStart,
      validationOverlap: overlap,
      validationMatches: matches,
      validationMatchRate: matchRate,
      identityAccepted,
      conflicts,
      targetWeekdays: [...observedWeekdays],
      scheduleFilteredRows,
      invalidRows,
      acceptedForwardRows: identityAccepted ? rows.length : 0,
      acceptedDates: identityAccepted ? rows.map((row) => row.isoDate) : [],
    }
    process.stdout.write(
      `${market}: identity ${matches}/${overlap}; ${acceptedForward[market].length} new rows\n`,
    )
  }

  audit['Rajdhani Day'] = {
    identityAccepted: false,
    reason: 'The independent source Rajdhani Day series had 0 exact matches in 42 overlapping rows.',
    acceptedForwardRows: 0,
  }
  acceptedForward['Rajdhani Day'] = []

  fs.writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: fetchedAt,
    source: {
      api: API,
      host: HOST,
      note: 'Timestamped result chart API discovered from the public site client bundle.',
    },
    policy: {
      minimumHistoricalOverlap: MIN_OVERLAP,
      requiredHistoricalMatchRate: 1,
      schedule: 'Only weekdays observed in the target market series are admitted.',
      unresolvedMarket: 'Rajdhani Day excluded.',
    },
    audit,
    forward: acceptedForward,
  }, null, 2))
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
