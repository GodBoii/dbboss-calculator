import { type NextRequest } from 'next/server'

export const runtime = 'nodejs'
// No caching - always fetch fresh data
export const dynamic = 'force-dynamic'

/**
 * Thin CORS-bypass proxy for Matka panel data.
 * The browser cannot directly fetch from dpbosss.net.in due to CORS.
 * This serverless function (free on Vercel Hobby tier) acts as a middleman.
 *
 * GET /api/scrape?url=<encoded_market_url>&market=<market_name>
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const targetUrl = searchParams.get('url')
  const marketName = searchParams.get('market') ?? 'Unknown'

  if (!targetUrl) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Security: Only allow fetching from dpbosss.net.in domain
  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!parsedUrl.hostname.includes('dpbosss.net.in')) {
    return Response.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Connection: 'keep-alive',
      },
      // Vercel serverless timeout is 10s on free tier
      signal: AbortSignal.timeout(9000),
    })

    if (!response.ok) {
      return Response.json(
        { error: `Target site returned ${response.status}` },
        { status: 502 }
      )
    }

    const html = await response.text()
    const panels = parseHtmlForPanels(html, marketName)

    return Response.json(
      { market: marketName, panels, count: panels.length, scrapedAt: new Date().toISOString() },
      {
        headers: {
          // Cache for 30 minutes on the CDN edge so repeated user fetches are instant
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Fetch failed: ${message}` }, { status: 502 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a 3-digit panel from cell text (handles "1 2 3", "123", "<br>"-separated etc.) */
function extractPanel(text: string): string | null {
  const allNumbers = text.match(/\d+/g) ?? []
  // Prefer a single 3-digit number
  for (const num of allNumbers) {
    if (num.length === 3) return num
  }
  // Try assembling from individual single digits (cells use <br> between digits)
  const singles = allNumbers.filter((n) => n.length === 1)
  if (singles.length >= 3) {
    return singles.slice(0, 3).join('')
  }
  return null
}

/** Extract a 2-digit jodi from cell text */
function extractJodi(text: string): string | null {
  const allNumbers = text.match(/\d+/g) ?? []
  for (const num of allNumbers) {
    if (num.length === 2) return num
  }
  // Two single digits
  const singles = allNumbers.filter((n) => n.length === 1)
  if (singles.length >= 2) {
    return singles.slice(0, 2).join('')
  }
  return null
}

/**
 * Parse raw HTML from dpbosss.net.in panel chart pages.
 *
 * CRITICAL STRUCTURE (confirmed by live page inspection):
 * Each table row = one week. The cells are:
 *   Cell 0:  Date range ("02/01/2023 to 07/01/2023")
 *   Cell 1:  Day-1 Open Panel (3 digits, <br> separated)
 *   Cell 2:  Day-1 Jodi (2-digit number)
 *   Cell 3:  Day-1 Close Panel (3 digits, <br> separated)
 *   Cell 4:  Day-2 Open Panel
 *   Cell 5:  Day-2 Jodi
 *   Cell 6:  Day-2 Close Panel
 *   ... (repeats for 6 days: Mon-Sat)
 *
 * So: 1 date cell + 6 days × 3 cells = 19 total cells per row.
 */
function parseHtmlForPanels(html: string, market: string): ParsedPanel[] {
  const results: ParsedPanel[] = []
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Extract all <tr>...</tr> blocks
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null

  while ((trMatch = tableRowRegex.exec(html)) !== null) {
    const row = trMatch[1]

    // Extract all <td>...</td> cells within this row
    const cells: string[] = []
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Strip all HTML tags from cell content to get raw text
      const text = cellMatch[1].replace(/<[^>]+>/g, ' ').trim()
      cells.push(text)
    }

    // Need at least date cell + 1 day (3 data cells) = 4 cells minimum
    if (cells.length < 4) continue

    // First cell is the date range (e.g. "12/06/2023 to 16/06/2023")
    const dateCell = cells[0]
    // Skip header rows (no digits in the date cell)
    if (!/\d/.test(dateCell)) continue

    const dateParts = dateCell.includes('to')
      ? dateCell.split('to').map((s) => s.trim())
      : dateCell.includes('To')
      ? dateCell.split('To').map((s) => s.trim())
      : [dateCell.trim(), dateCell.trim()]
    const startDate = dateParts[0]
    const endDate = dateParts[1] || dateParts[0]

    // Remaining cells grouped in triplets: [Open, Jodi, Close]
    const dataCells = cells.slice(1)
    const numDays = Math.floor(dataCells.length / 3)

    for (let d = 0; d < numDays; d++) {
      const openText = dataCells[d * 3] || ''
      const jodiText = dataCells[d * 3 + 1] || ''
      const closeText = dataCells[d * 3 + 2] || ''

      const openPanel = extractPanel(openText)
      const jodi = extractJodi(jodiText)
      const closePanel = extractPanel(closeText)

      // Skip completely empty days (holidays, future dates)
      if (!openPanel && !closePanel) continue

      const dayName = d < days.length ? days[d] : `Day${d + 1}`

      const openSutta = openPanel
        ? (parseInt(openPanel[0]) + parseInt(openPanel[1]) + parseInt(openPanel[2])) % 10
        : -1
      const closeSutta = closePanel
        ? (parseInt(closePanel[0]) + parseInt(closePanel[1]) + parseInt(closePanel[2])) % 10
        : -1

      results.push({
        market,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        day: dayName,
        openPanel: openPanel || '',
        openSutta,
        jodi: jodi || '',
        closePanel: closePanel || '',
        closeSutta,
      })
    }
  }

  return results
}

export interface ParsedPanel {
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
