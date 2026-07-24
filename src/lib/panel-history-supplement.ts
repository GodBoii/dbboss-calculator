const INDEPENDENT_CHART_API = 'https://api.cloudsoft.one/portal/charts'
const INDEPENDENT_HOST = 'sattamatka.ai'
const VALIDATION_WINDOW_DAYS = 90
const MINIMUM_IDENTITY_OVERLAP = 20

export const INDEPENDENT_MARKET_SLUGS: Readonly<Record<string, string>> = {
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface PanelHistoryRecord {
  market: string
  dateRangeStart: string
  dateRangeEnd: string
  day: string
  openPanel: string
  openSutta: number
  jodi: string
  closePanel: string
  closeSutta: number
}

export interface IndependentChartRow {
  resultDate?: unknown
  panOpen?: unknown
  bracket?: unknown
  panClose?: unknown
}

export interface SupplementAudit {
  supported: boolean
  identityAccepted: boolean
  validationOverlap: number
  validationMatches: number
  addedRows: number
  reason?: string
}

function shiftISODate(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function formatPanelDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function panelISODate(panel: PanelHistoryRecord): string | null {
  const parts = panel.dateRangeStart.replace(/-/g, '/').split('/').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [day, month, rawYear] = parts
  const year = rawYear < 100 ? rawYear + 2000 : rawYear
  const start = new Date(Date.UTC(year, month - 1, day))
  const expectedDay = DAYS.indexOf(panel.day)
  if (expectedDay < 0) return null
  const offset = (expectedDay + 6) % 7
  start.setUTCDate(start.getUTCDate() + offset)
  return start.toISOString().slice(0, 10)
}

function sutta(panel: string): number {
  return [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10
}

function isLegalPanel(panel: string): boolean {
  if (!/^\d{3}$/.test(panel)) return false
  const order = (digit: string) => digit === '0' ? 10 : Number(digit)
  return order(panel[0]) <= order(panel[1]) && order(panel[1]) <= order(panel[2])
}

function normalizeIndependentRow(row: IndependentChartRow, market: string): {
  isoDate: string
  panel: PanelHistoryRecord
} | null {
  const isoDate = String(row.resultDate ?? '')
  const openPanel = String(row.panOpen ?? '')
  const closePanel = String(row.panClose ?? '')
  const jodi = String(row.bracket ?? '').padStart(2, '0')

  if (!isISODate(isoDate) || !isLegalPanel(openPanel) || !isLegalPanel(closePanel)) return null

  const openSutta = sutta(openPanel)
  const closeSutta = sutta(closePanel)
  if (!/^\d{2}$/.test(jodi) || jodi !== `${openSutta}${closeSutta}`) return null

  const date = new Date(`${isoDate}T00:00:00Z`)
  const weekday = date.getUTCDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  const rangeStart = shiftISODate(isoDate, mondayOffset)
  const rangeEnd = shiftISODate(rangeStart, 6)

  return {
    isoDate,
    panel: {
      market,
      dateRangeStart: formatPanelDate(rangeStart),
      dateRangeEnd: formatPanelDate(rangeEnd),
      day: DAYS[weekday],
      openPanel,
      openSutta,
      jodi,
      closePanel,
      closeSutta,
    },
  }
}

export async function fetchIndependentChartRows(
  market: string,
  throughDate = todayISO(),
): Promise<IndependentChartRow[] | null> {
  const slug = INDEPENDENT_MARKET_SLUGS[market]
  if (!slug) return null

  const query = new URLSearchParams({
    urlSlug: slug,
    page: 'detailed',
    type: 'detailed',
    fromDate: shiftISODate(throughDate, -(VALIDATION_WINDOW_DAYS - 1)),
    toDate: throughDate,
  })
  const response = await fetch(`${INDEPENDENT_CHART_API}?${query}`, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 Chrome/120 Safari/537.36',
      'x-host': INDEPENDENT_HOST,
    },
    signal: AbortSignal.timeout(7000),
  })
  if (!response.ok) throw new Error(`Independent chart returned ${response.status}`)

  const payload: unknown = await response.json()
  if (
    typeof payload !== 'object'
    || payload === null
    || !('results' in payload)
    || !Array.isArray(payload.results)
  ) {
    throw new Error('Independent chart response did not contain results')
  }
  return payload.results as IndependentChartRow[]
}

/**
 * Admit only rows from an independently fetched chart that proves its identity
 * against the primary chart on every overlapping complete draw.
 *
 * Primary rows always win on duplicate dates. Unsupported markets, source
 * failures, identity conflicts, and malformed rows leave primary history
 * untouched.
 */
export function supplementPanelHistory(
  primaryPanels: PanelHistoryRecord[],
  independentRows: IndependentChartRow[] | null,
  market: string,
): { panels: PanelHistoryRecord[]; audit: SupplementAudit } {
  const supported = Boolean(INDEPENDENT_MARKET_SLUGS[market])
  const reject = (reason: string, overlap = 0, matches = 0) => ({
    panels: primaryPanels,
    audit: {
      supported,
      identityAccepted: false,
      validationOverlap: overlap,
      validationMatches: matches,
      addedRows: 0,
      reason,
    },
  })

  if (!supported) return reject('Market is intentionally excluded from the independent source.')
  if (!independentRows) return reject('Independent source was unavailable.')

  const primaryByDate = new Map<string, PanelHistoryRecord>()
  const observedDays = new Set<string>()
  for (const panel of primaryPanels) {
    const isoDate = panelISODate(panel)
    if (!isoDate) continue
    primaryByDate.set(isoDate, panel)
    observedDays.add(panel.day)
  }

  const independentByDate = new Map<string, PanelHistoryRecord>()
  for (const row of independentRows) {
    const normalized = normalizeIndependentRow(row, market)
    if (normalized) independentByDate.set(normalized.isoDate, normalized.panel)
  }

  let overlap = 0
  let matches = 0
  for (const [isoDate, primary] of primaryByDate) {
    const independent = independentByDate.get(isoDate)
    if (!independent || !primary.openPanel || !primary.closePanel) continue
    overlap++
    if (
      independent.openPanel === primary.openPanel
      && independent.closePanel === primary.closePanel
      && independent.jodi === primary.jodi
    ) {
      matches++
    }
  }

  if (overlap < MINIMUM_IDENTITY_OVERLAP) {
    return reject(`Only ${overlap} overlapping draws were available; ${MINIMUM_IDENTITY_OVERLAP} are required.`, overlap, matches)
  }
  if (matches !== overlap) {
    return reject('Independent source conflicted with primary history.', overlap, matches)
  }

  const merged = new Map(primaryByDate)
  let addedRows = 0
  for (const [isoDate, panel] of independentByDate) {
    if (merged.has(isoDate) || !observedDays.has(panel.day)) continue
    merged.set(isoDate, panel)
    addedRows++
  }

  return {
    panels: [...merged.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([, panel]) => panel),
    audit: {
      supported: true,
      identityAccepted: true,
      validationOverlap: overlap,
      validationMatches: matches,
      addedRows,
    },
  }
}
