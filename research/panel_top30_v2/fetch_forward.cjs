/* Fetch post-cache records into the isolated research directory. */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const CACHE = path.join(ROOT, 'scratch', 'open-sutta-records-cache.json')
const OUTPUT = path.join(__dirname, 'forward_records.json')
const EXTENDED_OUTPUT = path.join(__dirname, 'extended_records.json')
const URLS = {
  Sridevi: 'https://dpbossss.boston/panel-chart-record/sridevi.php',
  'Time Bazar': 'https://dpbossss.boston/panel-chart-record/time-bazar.php',
  'Madhur Day': 'https://dpbossss.boston/panel-chart-record/madhur-day.php',
  'Milan Day': 'https://dpbossss.boston/panel-chart-record/milan-day.php',
  'Rajdhani Day': 'https://dpbossss.boston/panel-chart-record/rajdhani-day.php',
  Kalyan: 'https://dpbossss.boston/panel-chart-record/kalyan.php',
  'Sridevi Night': 'https://dpbossss.boston/panel-chart-record/sridevi-night.php',
  'Kalyan Night': 'https://dpbossss.boston/panel-chart-record/kalyan-night.php',
  'Madhur Night': 'https://dpbossss.boston/panel-chart-record/madhur-night.php',
  'Milan Night': 'https://dpbossss.boston/panel-chart-record/milan-night.php',
  'Rajdhani Night': 'https://dpbossss.boston/panel-chart-record/rajdhani-night.php',
  'Main Bazar': 'https://dpbossss.boston/panel-chart-record/main-bazar.php',
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const OFFSETS = Object.fromEntries(DAYS.map((day, index) => [day, index]))

function extractPanel(text) {
  const numbers = text.match(/\d+/g) ?? []
  const exact = numbers.find((number) => number.length === 3)
  if (exact) return exact
  const singles = numbers.filter((number) => number.length === 1)
  return singles.length >= 3 ? singles.slice(0, 3).join('') : null
}

function extractJodi(text) {
  const numbers = text.match(/\d+/g) ?? []
  const exact = numbers.find((number) => number.length === 2)
  if (exact) return exact
  const singles = numbers.filter((number) => number.length === 1)
  return singles.length >= 2 ? singles.slice(0, 2).join('') : null
}

function parseHtml(html, market) {
  const results = []
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const cells = []
    const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch
    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, ' ').trim())
    }
    if (cells.length < 4 || !/\d/.test(cells[0])) continue
    const dateParts = cells[0].split(/\bto\b/i).map((part) => part.trim())
    const data = cells.slice(1)
    const dayCount = Math.min(7, Math.floor(data.length / 3))
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
      const openPanel = extractPanel(data[dayIndex * 3] || '')
      const jodi = extractJodi(data[dayIndex * 3 + 1] || '')
      const closePanel = extractPanel(data[dayIndex * 3 + 2] || '')
      if (!openPanel && !closePanel) continue
      results.push({
        id: `${market}|${dateParts[0]}|${DAYS[dayIndex]}`,
        market,
        dateRangeStart: dateParts[0],
        dateRangeEnd: dateParts[1] || dateParts[0],
        day: DAYS[dayIndex],
        openPanel: openPanel || '',
        openSutta: openPanel ? [...openPanel].reduce((sum, digit) => sum + Number(digit), 0) % 10 : -1,
        jodi: jodi || '',
        closePanel: closePanel || '',
        closeSutta: closePanel ? [...closePanel].reduce((sum, digit) => sum + Number(digit), 0) % 10 : -1,
      })
    }
  }
  return results
}

function isoDate(record) {
  const parts = record.dateRangeStart.replace(/-/g, '/').split('/').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [day, month, rawYear] = parts
  const value = new Date(Date.UTC(rawYear < 100 ? rawYear + 2000 : rawYear, month - 1, day))
  value.setUTCDate(value.getUTCDate() + (OFFSETS[record.day] ?? 0))
  return value.toISOString().slice(0, 10)
}

async function fetchMarket(market, url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36' },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return parseHtml(await response.text(), market)
}

async function main() {
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const forward = {}
  const extended = {}
  const audit = {}
  for (const [market, url] of Object.entries(URLS)) {
    try {
      const live = await fetchMarket(market, url)
      const cutoff = cache[market].map(isoDate).filter(Boolean).sort().at(-1)
      const deduplicated = new Map()
      let incompleteOrInvalid = 0
      for (const record of live) {
        const iso = isoDate(record)
        if (!iso || record.openPanel.length !== 3 || record.closePanel.length !== 3) {
          incompleteOrInvalid++
          continue
        }
        deduplicated.set(iso, record)
      }
      const completedHistory = [...deduplicated.values()].sort((a, b) => isoDate(a).localeCompare(isoDate(b)))
      const completed = live.filter((record) => {
        const iso = isoDate(record)
        return iso && iso > cutoff && record.openPanel.length === 3 && record.closePanel.length === 3
      })
      forward[market] = completed
      extended[market] = completedHistory
      audit[market] = {
        cutoff,
        liveLatest: live.map(isoDate).filter(Boolean).sort().at(-1) ?? null,
        liveParsedRows: live.length,
        completedHistoryRows: completedHistory.length,
        completedHistoryFirst: completedHistory.length ? isoDate(completedHistory[0]) : null,
        completedHistoryLast: completedHistory.length ? isoDate(completedHistory.at(-1)) : null,
        incompleteOrInvalid,
        completedForwardRows: completed.length,
        dates: completed.map(isoDate),
      }
      process.stdout.write(`${market}: ${completedHistory.length} history, ${completed.length} forward\n`)
    } catch (error) {
      forward[market] = []
      audit[market] = { error: error instanceof Error ? error.message : String(error) }
      process.stdout.write(`${market}: ERROR ${audit[market].error}\n`)
    }
  }
  fs.writeFileSync(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), audit, forward }, null, 2))
  fs.writeFileSync(EXTENDED_OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), urls: URLS, audit, extended }, null, 2))
  process.stdout.write(`wrote ${path.relative(ROOT, OUTPUT)}\n`)
  process.stdout.write(`wrote ${path.relative(ROOT, EXTENDED_OUTPUT)}\n`)
}

main().catch((error) => { console.error(error); process.exit(1) })
