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

/**
 * Parse raw HTML from dpbosss.net.in panel chart pages.
 * The site has <table> elements where each row = one week date-range,
 * and each cell = one day's result (a 3-digit panel number).
 *
 * We extract every 3-digit number from every table cell, compute the sutta
 * (digit sum mod 10), and classify the panel type.
 */
function parseHtmlForPanels(html: string, market: string): ParsedPanel[] {
  const results: ParsedPanel[] = []
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

    if (cells.length < 2) continue

    // First cell is usually the date range (e.g. "12/06/2023 to 16/06/2023")
    const dateCell = cells[0]
    const dateParts = dateCell.includes('to')
      ? dateCell.split('to').map((s) => s.trim())
      : [dateCell.trim(), dateCell.trim()]
    const startDate = dateParts[0]
    const endDate = dateParts[1] || dateParts[0]

    // Remaining cells = Mon through Sun
    for (let i = 1; i < cells.length; i++) {
      const cellText = cells[i]
      // Find ALL sequences of digits in the cell
      const allNumbers = cellText.match(/\d+/g) ?? []

      let panel: string | null = null
      // Prefer 3-digit numbers; if not present, try to assemble from individual digits
      for (const num of allNumbers) {
        if (num.length === 3) {
          panel = num
          break
        }
      }

      // Some cells have digits spaced out like "1 2 3" - concatenate single digits
      if (!panel) {
        const singles = allNumbers.filter((n) => n.length === 1)
        if (singles.length === 3) {
          panel = singles.join('')
        }
      }

      if (!panel) continue

      const d1 = parseInt(panel[0])
      const d2 = parseInt(panel[1])
      const d3 = parseInt(panel[2])
      const sutta = (d1 + d2 + d3) % 10

      const dayIndex = i - 1
      const dayName = dayIndex < days.length ? days[dayIndex] : `Day${i}`

      results.push({
        market,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        day: dayName,
        panel,
        sutta,
        d1,
        d2,
        d3,
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
  panel: string
  sutta: number
  d1: number
  d2: number
  d3: number
}
