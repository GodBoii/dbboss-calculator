const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'scraper', 'data');
const files = fs.readdirSync(csvPath).filter(f => f.startsWith('panel_data_') && f.endsWith('.csv'));
files.sort();
const latestFile = path.join(csvPath, files[files.length - 1]);

const content = fs.readFileSync(latestFile, 'utf8');
const lines = content.split('\n');
const headers = lines[0].split(',');
const records = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const parts = lines[i].split(',');
  if (parts.length < headers.length) continue;
  const rec = {};
  headers.forEach((h, idx) => {
    rec[h] = parts[idx].trim();
  });
  records.push(rec);
}

function isDP(panelStr) {
  if (!panelStr || panelStr.length !== 3) return false;
  const chars = panelStr.split('');
  return (chars[0] === chars[1] && chars[1] !== chars[2]) || 
         (chars[1] === chars[2] && chars[0] !== chars[1]) ||
         (chars[0] === chars[2] && chars[0] !== chars[1]);
}

const dayPairs = [
  { name: 'Monday', open: 'Monday', close: 'Wednesday' },
  { name: 'Tuesday', open: 'Thursday', close: 'Saturday' },
  { name: 'Wednesday', open: 'Sunday', close: 'Day9' },
  { name: 'Thursday', open: 'Day10', close: 'Day12' },
  { name: 'Friday', open: 'Day13', close: 'Day15' },
  { name: 'Saturday', open: 'Day16', close: 'Day18' },
  { name: 'Sunday', open: 'Day19', close: 'Day21' }
];

function getFridaysForMarket(marketName) {
  const marketRecords = records.filter(r => r.market === marketName);
  const weeks = {};
  marketRecords.forEach(r => {
    const wKey = r.date_range_start;
    if (!weeks[wKey]) {
      weeks[wKey] = {};
    }
    weeks[wKey][r.day] = r.panel;
  });

  const fridays = [];
  Object.keys(weeks).forEach(wKey => {
    const weekData = weeks[wKey];
    const openPanel = weekData['Day13']; // Friday Open
    const closePanel = weekData['Day15']; // Friday Close
    if (openPanel || closePanel) {
      fridays.push({
        dateRangeStart: wKey,
        open: openPanel || null,
        close: closePanel || null
      });
    }
  });
  return fridays;
}

const dayFridays = getFridaysForMarket('Milan Day');
const nightFridays = getFridaysForMarket('Milan Night');

console.log('=== MILAN DAY LATEST FRIDAYS ===');
dayFridays.slice(-15).forEach(f => {
  const oSutta = f.open ? f.open.split('').map(Number).reduce((a, b) => a + b, 0) % 10 : '?';
  const cSutta = f.close ? f.close.split('').map(Number).reduce((a, b) => a + b, 0) % 10 : '?';
  console.log(`Week ${f.dateRangeStart} | Open: ${f.open} (Sutta: ${oSutta}, ${f.open && isDP(f.open) ? 'DP' : 'SP'}) | Close: ${f.close} (Sutta: ${cSutta}, ${f.close && isDP(f.close) ? 'DP' : 'SP'})`);
});

console.log('\n=== MILAN NIGHT LATEST FRIDAYS ===');
nightFridays.slice(-15).forEach(f => {
  const oSutta = f.open ? f.open.split('').map(Number).reduce((a, b) => a + b, 0) % 10 : '?';
  const cSutta = f.close ? f.close.split('').map(Number).reduce((a, b) => a + b, 0) % 10 : '?';
  console.log(`Week ${f.dateRangeStart} | Open: ${f.open} (Sutta: ${oSutta}, ${f.open && isDP(f.open) ? 'DP' : 'SP'}) | Close: ${f.close} (Sutta: ${cSutta}, ${f.close && isDP(f.close) ? 'DP' : 'SP'})`);
});
