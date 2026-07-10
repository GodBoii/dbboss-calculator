/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const MARKET_URLS = {
  Sridevi: "https://dpbossss.boston/panel-chart-record/sridevi.php",
  "Time Bazar": "https://dpbossss.boston/panel-chart-record/time-bazar.php",
  "Madhur Day": "https://dpbossss.boston/panel-chart-record/madhur-day.php",
  "Milan Day": "https://dpbossss.boston/panel-chart-record/milan-day.php",
  "Rajdhani Day": "https://dpbossss.boston/panel-chart-record/rajdhani-day.php",
  Kalyan: "https://dpbossss.boston/panel-chart-record/kalyan.php",
  "Sridevi Night": "https://dpbossss.boston/panel-chart-record/sridevi-night.php",
  "Kalyan Night": "https://dpbossss.boston/panel-chart-record/kalyan-night.php",
  "Madhur Night": "https://dpbossss.boston/panel-chart-record/madhur-night.php",
  "Milan Night": "https://dpbossss.boston/panel-chart-record/milan-night.php",
  "Rajdhani Night": "https://dpbossss.boston/panel-chart-record/rajdhani-night.php",
  "Main Bazar": "https://dpbossss.boston/panel-chart-record/main-bazar.php",
};

const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };

function extractPanel(text) {
  const allNumbers = text.match(/\d+/g) ?? [];
  for (const num of allNumbers) if (num.length === 3) return num;
  const singles = allNumbers.filter((num) => num.length === 1);
  return singles.length >= 3 ? singles.slice(0, 3).join("") : null;
}

function extractJodi(text) {
  const allNumbers = text.match(/\d+/g) ?? [];
  for (const num of allNumbers) if (num.length === 2) return num;
  const singles = allNumbers.filter((num) => num.length === 1);
  return singles.length >= 2 ? singles.slice(0, 2).join("") : null;
}

function parseHtmlForPanels(html, market) {
  const results = [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = tableRowRegex.exec(html)) !== null) {
    const row = trMatch[1];
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, " ").trim());
    }
    if (cells.length < 4) continue;
    const dateCell = cells[0];
    if (!/\d/.test(dateCell)) continue;
    const dateParts = dateCell.includes("to")
      ? dateCell.split("to").map((part) => part.trim())
      : dateCell.includes("To")
        ? dateCell.split("To").map((part) => part.trim())
        : [dateCell.trim(), dateCell.trim()];
    const startDate = dateParts[0];
    const endDate = dateParts[1] || dateParts[0];
    const dataCells = cells.slice(1);
    const numDays = Math.floor(dataCells.length / 3);
    for (let dayIndex = 0; dayIndex < numDays; dayIndex++) {
      const openPanel = extractPanel(dataCells[dayIndex * 3] || "");
      const jodi = extractJodi(dataCells[dayIndex * 3 + 1] || "");
      const closePanel = extractPanel(dataCells[dayIndex * 3 + 2] || "");
      if (!openPanel && !closePanel) continue;
      const openSutta = openPanel ? (Number(openPanel[0]) + Number(openPanel[1]) + Number(openPanel[2])) % 10 : -1;
      const closeSutta = closePanel ? (Number(closePanel[0]) + Number(closePanel[1]) + Number(closePanel[2])) % 10 : -1;
      results.push({
        id: `${market}|${startDate}|${days[dayIndex]}`,
        market,
        dateRangeStart: startDate,
        dateRangeEnd: endDate,
        day: days[dayIndex] ?? `Day${dayIndex + 1}`,
        openPanel: openPanel || "",
        openSutta,
        jodi: jodi || "",
        closePanel: closePanel || "",
        closeSutta,
        savedAt: Date.now(),
      });
    }
  }
  return results;
}

function parsePanelDate(dateStr) {
  const parts = dateStr.replace(/-/g, "/").split("/").map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [day, month, rawYear] = parts;
  const year = rawYear < 100 ? rawYear + 2000 : rawYear;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(record) {
  const start = parsePanelDate(record.dateRangeStart);
  if (!start) return null;
  start.setUTCDate(start.getUTCDate() + (DAY_OFFSETS[record.day] ?? 0));
  return start.toISOString().slice(0, 10);
}

function newestISO(records) {
  return records
    .map((record) => isoDate(record))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}

async function fetchMarket(market, url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${market}: HTTP ${response.status}`);
  return parseHtmlForPanels(await response.text(), market);
}

async function main() {
  const cachePath = path.join(process.cwd(), "scratch", "open-sutta-records-cache.json");
  const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const report = [];
  const liveRecords = {};
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    try {
      const live = await fetchMarket(market, url);
      liveRecords[market] = live;
      const cachedNewest = newestISO(cached[market] ?? []);
      const liveNewest = newestISO(live);
      const freshRows = live.filter((record) => {
        const iso = isoDate(record);
        return iso && cachedNewest && iso > cachedNewest;
      });
      report.push({
        market,
        cachedNewest,
        liveNewest,
        liveCount: live.length,
        freshCount: freshRows.length,
        freshRows: freshRows.map((record) => ({
          isoDate: isoDate(record),
          day: record.day,
          openPanel: record.openPanel,
          jodi: record.jodi,
          closePanel: record.closePanel,
        })),
      });
      console.log(`${market}: cache ${cachedNewest}, live ${liveNewest}, fresh ${freshRows.length}`);
    } catch (error) {
      report.push({ market, error: error instanceof Error ? error.message : String(error) });
      console.log(`${market}: ERROR ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const output = { generatedAt: new Date().toISOString(), report, liveRecords };
  const outPath = path.join(process.cwd(), "scratch", "live-freshness-check-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
