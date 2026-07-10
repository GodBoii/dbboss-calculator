const fs = require("fs");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  analyzeMarket,
  computeJodiAnalysis,
  buildContextFromResult,
} = require("../src/lib/predictor.ts");

const TARGET_START = "2026-06-29";
const TARGET_END = "2026-07-02";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_OFFSETS = Object.fromEntries(DAYS.map((day, index) => [day, index]));
const ORDER = [
  "Sridevi",
  "Time Bazar",
  "Madhur Day",
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Kalyan Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
];

function parseDMY(value) {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function sutta(panel) {
  return String(panel).split("").reduce((sum, digit) => sum + Number(digit), 0) % 10;
}

function stripTags(value) {
  return value
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, "");
}

function extractTds(rowHtml) {
  const cells = [];
  const re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = re.exec(rowHtml))) cells.push(match[1]);
  return cells;
}

function panelFromCell(cell) {
  return stripTags(cell).replace(/\D/g, "");
}

async function scrapeMarket(market, url) {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${market}: ${res.status} ${res.statusText}`);
  const html = await res.text();
  const rows = [];
  const rowChunks = html.split(/<tr\b[^>]*>/i).slice(1).map((chunk) => {
    const end = chunk.indexOf("</tr>");
    return end >= 0 ? chunk.slice(0, end) : chunk;
  });
  for (const rowHtml of rowChunks) {
    const cells = extractTds(rowHtml);
    if (cells.length < 4) continue;
    const first = cells[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const dateMatch = first.match(/(\d{2}\/\d{2}\/\d{4})\s*to\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (!dateMatch) continue;
    const weekStart = parseDMY(dateMatch[1]);
    for (let i = 1; i + 2 < cells.length; i += 3) {
      const dayIndex = (i - 1) / 3;
      if (dayIndex >= DAYS.length) break;
      const openPanel = panelFromCell(cells[i]);
      const closePanel = panelFromCell(cells[i + 2]);
      if (openPanel.length !== 3 || closePanel.length !== 3) continue;
      const date = addDays(weekStart, dayIndex);
      const rowISO = iso(date);
      if (rowISO < TARGET_START || rowISO > TARGET_END) continue;
      rows.push({
        id: `${market}|${dateMatch[1]}|${DAYS[dayIndex]}`,
        market,
        dateRangeStart: dateMatch[1],
        dateRangeEnd: dateMatch[2],
        day: DAYS[dayIndex],
        openPanel,
        openSutta: sutta(openPanel),
        jodi: `${sutta(openPanel)}${sutta(closePanel)}`,
        closePanel,
        closeSutta: sutta(closePanel),
        savedAt: Date.now(),
        isoDate: rowISO,
      });
    }
  }
  return rows;
}

function recordISO(record) {
  return iso(addDays(parseDMY(record.dateRangeStart), DAY_OFFSETS[record.day] ?? 0));
}

function hit(picks, actualSutta, size) {
  return picks.slice(0, size).some((pick) => pick.sutta === actualSutta);
}

function empty() {
  return { n: 0, top3: 0, top10: 0, top30: 0 };
}

function addResult(bucket, picks, actualSutta) {
  bucket.n += 1;
  if (hit(picks, actualSutta, 3)) bucket.top3 += 1;
  if (hit(picks, actualSutta, 10)) bucket.top10 += 1;
  if (hit(picks, actualSutta, 30)) bucket.top30 += 1;
}

function fmtBucket(bucket) {
  return {
    n: bucket.n,
    top3Pass: bucket.top3,
    top3Fail: bucket.n - bucket.top3,
    top10Pass: bucket.top10,
    top10Fail: bucket.n - bucket.top10,
    top30Pass: bucket.top30,
    top30Fail: bucket.n - bucket.top30,
  };
}

async function main() {
  const urls = JSON.parse(fs.readFileSync("scraper/market_urls.json", "utf8")).markets;
  const historical = JSON.parse(fs.readFileSync("scratch/records_2years.json", "utf8"));
  const freshByMarket = {};
  for (const market of ORDER) {
    const info = urls[market];
    if (!info?.panel) continue;
    freshByMarket[market] = await scrapeMarket(market, info.panel);
  }

  const combined = {};
  for (const market of ORDER) {
    combined[market] = [...(historical[market] ?? []), ...(freshByMarket[market] ?? [])]
      .map((record) => ({ ...record, isoDate: record.isoDate ?? recordISO(record) }))
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  }

  const summaries = [];
  const details = [];
  for (const market of ORDER) {
    const open = empty();
    const close = empty();
    const jodi = empty();
    for (const record of freshByMarket[market] ?? []) {
      const prior = combined[market].filter((item) => item.isoDate < record.isoDate);
      const priorAllMarkets = {};
      for (const other of ORDER) {
        priorAllMarkets[other] = (combined[other] ?? []).filter((item) => item.isoDate < record.isoDate);
      }
      const prediction = analyzeMarket(market, prior, priorAllMarkets, new Date(`${record.isoDate}T12:00:00Z`));
      if (!prediction) continue;
      addResult(open, prediction.openPicks, record.openSutta);
      addResult(close, prediction.closePicks, record.closeSutta);
      const jodiResult = computeJodiAnalysis(
        record.openSutta,
        record.openPanel,
        prior,
        buildContextFromResult(prediction),
        prediction.closeDpKindContext,
      );
      addResult(jodi, jodiResult.adjustedClosePicks, record.closeSutta);
      details.push({
        market,
        date: record.isoDate,
        day: record.day,
        actualOpenSutta: record.openSutta,
        actualCloseSutta: record.closeSutta,
        openTop3: hit(prediction.openPicks, record.openSutta, 3),
        openTop10: hit(prediction.openPicks, record.openSutta, 10),
        openTop30: hit(prediction.openPicks, record.openSutta, 30),
        closeTop3: hit(prediction.closePicks, record.closeSutta, 3),
        closeTop10: hit(prediction.closePicks, record.closeSutta, 10),
        closeTop30: hit(prediction.closePicks, record.closeSutta, 30),
        jodiTop3: hit(jodiResult.adjustedClosePicks, record.closeSutta, 3),
        jodiTop10: hit(jodiResult.adjustedClosePicks, record.closeSutta, 10),
        jodiTop30: hit(jodiResult.adjustedClosePicks, record.closeSutta, 30),
      });
    }
    summaries.push({ market, open: fmtBucket(open), close: fmtBucket(close), jodiClose: fmtBucket(jodi) });
  }
  console.log(JSON.stringify({ targetStart: TARGET_START, targetEnd: TARGET_END, summaries, details }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
