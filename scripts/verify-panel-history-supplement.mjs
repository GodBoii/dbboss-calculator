import assert from 'node:assert/strict'
import {
  supplementPanelHistory,
} from '../src/lib/panel-history-supplement.ts'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function shift(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function displayDate(isoDate) {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function rowForDate(isoDate, openPanel = '123', closePanel = '145') {
  const openSutta = [...openPanel].reduce((sum, digit) => sum + Number(digit), 0) % 10
  const closeSutta = [...closePanel].reduce((sum, digit) => sum + Number(digit), 0) % 10
  return {
    resultDate: isoDate,
    panOpen: openPanel,
    bracket: `${openSutta}${closeSutta}`,
    panClose: closePanel,
  }
}

function primaryForDate(isoDate) {
  const source = rowForDate(isoDate)
  const date = new Date(`${isoDate}T00:00:00Z`)
  const weekday = date.getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const rangeStart = shift(isoDate, mondayOffset)
  return {
    market: 'Kalyan',
    dateRangeStart: displayDate(rangeStart),
    dateRangeEnd: displayDate(shift(rangeStart, 6)),
    day: DAY_NAMES[weekday],
    openPanel: source.panOpen,
    openSutta: Number(source.bracket[0]),
    jodi: source.bracket,
    closePanel: source.panClose,
    closeSutta: Number(source.bracket[1]),
  }
}

const start = '2026-06-01'
const primary = Array.from({ length: 24 }, (_, index) => primaryForDate(shift(start, index)))
const matchingRows = Array.from({ length: 24 }, (_, index) => rowForDate(shift(start, index)))
const newDate = shift(start, 24)
const validSupplement = supplementPanelHistory(
  primary,
  [...matchingRows, rowForDate(newDate)],
  'Kalyan',
)

assert.equal(validSupplement.audit.identityAccepted, true)
assert.equal(validSupplement.audit.validationOverlap, 24)
assert.equal(validSupplement.audit.addedRows, 1)
assert.equal(validSupplement.panels.length, primary.length + 1)
assert.equal(validSupplement.panels.at(-1)?.openPanel, '123')

const duplicatePrimaryWins = supplementPanelHistory(
  primary,
  [...matchingRows, matchingRows[0]],
  'Kalyan',
)
assert.equal(duplicatePrimaryWins.panels[0], primary[0])

const conflictingRows = matchingRows.map((row) => ({ ...row }))
conflictingRows[3] = rowForDate(conflictingRows[3].resultDate, '124', '145')
const rejectedConflict = supplementPanelHistory(
  primary,
  [...conflictingRows, rowForDate(newDate)],
  'Kalyan',
)
assert.equal(rejectedConflict.audit.identityAccepted, false)
assert.equal(rejectedConflict.audit.addedRows, 0)
assert.equal(rejectedConflict.panels, primary)

const invalidNewRow = {
  resultDate: newDate,
  panOpen: '987',
  bracket: '00',
  panClose: '654',
}
const rejectedMalformed = supplementPanelHistory(
  primary,
  [...matchingRows, invalidNewRow],
  'Kalyan',
)
assert.equal(rejectedMalformed.audit.identityAccepted, true)
assert.equal(rejectedMalformed.audit.addedRows, 0)

const excludedMarket = supplementPanelHistory(primary, matchingRows, 'Rajdhani Day')
assert.equal(excludedMarket.audit.supported, false)
assert.equal(excludedMarket.panels, primary)

console.log('Panel history supplement verification passed.')
