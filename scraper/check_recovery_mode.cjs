const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data');
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
    rec[h] = parts[idx];
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

function getMarketDraws(marketName) {
  const marketRecords = records.filter(r => r.market === marketName);
  const weeks = {};
  marketRecords.forEach(r => {
    const wKey = r.date_range_start;
    if (!weeks[wKey]) {
      weeks[wKey] = {};
    }
    weeks[wKey][r.day] = r.panel;
  });

  const formattedDraws = [];
  Object.keys(weeks).forEach(wKey => {
    const weekData = weeks[wKey];
    dayPairs.forEach(dp => {
      const openPanel = weekData[dp.open];
      const closePanel = weekData[dp.close];
      if (openPanel || closePanel) {
        formattedDraws.push({
          date: wKey,
          day: dp.name,
          open: openPanel || null,
          close: closePanel || null,
          isOpenDP: openPanel ? isDP(openPanel) : false,
          isCloseDP: closePanel ? isDP(closePanel) : false
        });
      }
    });
  });
  return formattedDraws;
}

// Compare Day -> Night for 3 major day-night pairs:
// 1. Sridevi -> Sridevi Night
// 2. Madhur Day -> Madhur Night
// 3. Milan Day -> Milan Night
// 4. Kalyan -> Kalyan Night (if available)

const pairs = [
  { day: 'Sridevi', night: 'Sridevi Night' },
  { day: 'Madhur Day', night: 'Madhur Night' },
  { day: 'Milan Day', night: 'Milan Night' }
];

pairs.forEach(p => {
  const dDraws = getMarketDraws(p.day);
  const nDraws = getMarketDraws(p.night);
  
  const aligned = [];
  dDraws.forEach(dd => {
    const nd = nDraws.find(n => n.date === dd.date && n.day === dd.day);
    if (nd) {
      aligned.push({
        day: dd.day,
        dayDoubleDP: dd.isOpenDP && dd.isCloseDP,
        nightOpenDP: nd.isOpenDP
      });
    }
  });

  const doubleDPDays = aligned.filter(a => a.dayDoubleDP);
  const fridayDoubleDPDays = doubleDPDays.filter(a => a.day === 'Friday');
  
  const nightOpenDPCount = doubleDPDays.filter(a => a.nightOpenDP).length;
  const fridayNightOpenDPCount = fridayDoubleDPDays.filter(a => a.nightOpenDP).length;
  
  console.log(`\n=== PAIR: ${p.day} -> ${p.night} ===`);
  console.log(`Total Double DP days in Day market: ${doubleDPDays.length}`);
  console.log(`  Night Open DP rate when Day is Double DP: ${((nightOpenDPCount / doubleDPDays.length) * 100).toFixed(2)}% (${nightOpenDPCount}/${doubleDPDays.length})`);
  console.log(`Friday Double DP days in Day market: ${fridayDoubleDPDays.length}`);
  console.log(`  Friday Night Open DP rate when Day is Double DP: ${fridayDoubleDPDays.length > 0 ? ((fridayNightOpenDPCount / fridayDoubleDPDays.length) * 100).toFixed(2) : 0}% (${fridayNightOpenDPCount}/${fridayDoubleDPDays.length})`);
});
