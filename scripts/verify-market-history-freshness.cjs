/* Focused behavior check for scheduled Open/Close cache invalidation. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

require.extensions['.ts'] = function registerTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  module._compile(output, filename)
}

const { isMarketHistoryFresh } = require(path.join(__dirname, '..', 'src', 'lib', 'market-history-freshness.ts'))

function record(date, market, openPanel, closePanel, savedAt) {
  const [year, month, day] = date.split('-')
  return {
    id: `${market}|${date}`, market, dateRangeStart: `${day}/${month}/${year}`,
    dateRangeEnd: `${day}/${month}/${year}`, day: 'Monday',
    openPanel, closePanel, openSutta: 0, closeSutta: 0, jodi: '', savedAt,
  }
}

function history(market, savedAt) {
  const dates = Array.from({ length: 59 }, (_, index) => {
    const day = new Date('2024-05-28T00:00:00Z')
    day.setUTCDate(day.getUTCDate() + index * 14)
    return day.toISOString().slice(0, 10)
  })
  return [...dates, '2026-09-27'].map((date) => record(date, market, '123', '124', savedAt))
}

const beforeOpen = new Date('2026-09-28T05:20:00Z') // 10:50 IST
const afterOpen = new Date('2026-09-28T06:20:00Z') // 11:50 IST
const afterClose = new Date('2026-09-28T07:20:00Z') // 12:50 IST
const savedAt = afterOpen.getTime() - 60 * 60 * 1000
const sridevi = history('Sridevi', savedAt)
assert.equal(isMarketHistoryFresh(sridevi, 'Sridevi', beforeOpen), true)
assert.equal(isMarketHistoryFresh(sridevi, 'Sridevi', afterOpen), false)

const todayOpen = [...sridevi, record('2026-09-28', 'Sridevi', '123', '', savedAt)]
assert.equal(isMarketHistoryFresh(todayOpen, 'Sridevi', afterOpen), true)
assert.equal(isMarketHistoryFresh(todayOpen, 'Sridevi', afterClose), false)
const todayComplete = [...sridevi, record('2026-09-28', 'Sridevi', '123', '124', savedAt)]
assert.equal(isMarketHistoryFresh(todayComplete, 'Sridevi', afterClose), true)

const sunday = new Date('2026-09-27T10:30:00Z') // 16:00 IST
const sundaySavedAt = sunday.getTime() - 60 * 60 * 1000
const closedHistory = history('Kalyan', sundaySavedAt).filter((item) => {
  const day = item.dateRangeStart.split('/').reverse().join('-')
  return day < '2026-07-05' || new Date(`${day}T00:00:00Z`).getUTCDay() !== 0
})
for (let offset = 0; offset < 84; offset++) {
  const date = new Date('2026-07-05T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + offset)
  if (date.getUTCDay() === 0) continue
  closedHistory.push(record(date.toISOString().slice(0, 10), 'Kalyan', '123', '124', sundaySavedAt))
}
assert.equal(isMarketHistoryFresh(closedHistory, 'Kalyan', sunday), true)
const activeSundayHistory = [...closedHistory, record('2026-09-20', 'Sridevi', '123', '124', sundaySavedAt)]
assert.equal(isMarketHistoryFresh(activeSundayHistory, 'Sridevi', sunday), false)

const midnight = new Date('2026-09-28T18:50:00Z') // Sep 29, 00:20 IST
const mainBazar = history('Main Bazar', midnight.getTime() - 60 * 60 * 1000)
mainBazar.push(record('2026-09-28', 'Main Bazar', '123', '', midnight.getTime() - 60 * 60 * 1000))
assert.equal(isMarketHistoryFresh(mainBazar, 'Main Bazar', midnight), false)
assert.equal(isMarketHistoryFresh(mainBazar, 'Main Bazar', new Date('2026-09-28T20:00:00Z')), false)
mainBazar[mainBazar.length - 1].closePanel = '124'
assert.equal(isMarketHistoryFresh(mainBazar, 'Main Bazar', midnight), true)
assert.equal(isMarketHistoryFresh(mainBazar, 'Main Bazar', new Date('2026-09-28T20:00:00Z')), true)

console.log('Scheduled cache freshness checks passed')
