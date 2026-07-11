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

const dayDraws = getMarketDraws('Milan Day');
const srideviNightDraws = getMarketDraws('Sridevi Night');
const nightDraws = getMarketDraws('Milan Night');
const rajdhaniNightDraws = getMarketDraws('Rajdhani Night');
const mainBazarDraws = getMarketDraws('Main Bazar');

// Align
const aligned = [];
dayDraws.forEach(dDraw => {
  const sDraw = srideviNightDraws.find(s => s.date === dDraw.date && s.day === dDraw.day);
  const nDraw = nightDraws.find(n => n.date === dDraw.date && n.day === dDraw.day);
  const rDraw = rajdhaniNightDraws.find(r => r.date === dDraw.date && r.day === dDraw.day);
  const mDraw = mainBazarDraws.find(m => m.date === dDraw.date && m.day === dDraw.day);
  
  if (sDraw && nDraw) {
    aligned.push({
      date: dDraw.date,
      day: dDraw.day,
      dayIsDoubleDP: dDraw.isOpenDP && dDraw.isCloseDP,
      sNightIsDoubleDP: sDraw.isOpenDP && sDraw.isCloseDP,
      nightOpenDP: nDraw.isOpenDP,
      nightCloseDP: nDraw.isCloseDP,
      rajdhaniOpenDP: rDraw ? rDraw.isOpenDP : false,
      rajdhaniCloseDP: rDraw ? rDraw.isCloseDP : false,
      mainBazarOpenDP: mDraw ? mDraw.isOpenDP : false,
      mainBazarCloseDP: mDraw ? mDraw.isCloseDP : false
    });
  }
});

console.log(`Total aligned draws: ${aligned.length}`);

// Filter for Milan Day Double DP AND Sridevi Night Double DP
const floodDays = aligned.filter(a => a.dayIsDoubleDP && a.sNightIsDoubleDP);
console.log(`\n=== FLOOD DAYS FOUND (Milan Day Double DP + Sridevi Night Double DP) ===`);
console.log(`Total: ${floodDays.length} days`);

if (floodDays.length > 0) {
  const mnOpenDP = floodDays.filter(a => a.nightOpenDP).length;
  const mnCloseDP = floodDays.filter(a => a.nightCloseDP).length;
  const rnOpenDP = floodDays.filter(a => a.rajdhaniOpenDP).length;
  const rnCloseDP = floodDays.filter(a => a.rajdhaniCloseDP).length;
  const mbOpenDP = floodDays.filter(a => a.mainBazarOpenDP).length;
  const mbCloseDP = floodDays.filter(a => a.mainBazarCloseDP).length;

  console.log(`\n1. Milan Night Open DP: ${((mnOpenDP / floodDays.length) * 100).toFixed(2)}% (${mnOpenDP}/${floodDays.length})`);
  console.log(`2. Milan Night Close DP: ${((mnCloseDP / floodDays.length) * 100).toFixed(2)}% (${mnCloseDP}/${floodDays.length})`);
  console.log(`3. Rajdhani Night Open DP: ${((rnOpenDP / floodDays.length) * 100).toFixed(2)}% (${rnOpenDP}/${floodDays.length})`);
  console.log(`4. Rajdhani Night Close DP: ${((rnCloseDP / floodDays.length) * 100).toFixed(2)}% (${rnCloseDP}/${floodDays.length})`);
  console.log(`5. Main Bazar Open DP: ${((mbOpenDP / floodDays.length) * 100).toFixed(2)}% (${mbOpenDP}/${floodDays.length})`);
  console.log(`6. Main Bazar Close DP: ${((mbCloseDP / floodDays.length) * 100).toFixed(2)}% (${mbCloseDP}/${floodDays.length})`);

  console.log('\nFriday specific flood days:');
  const fridayFlood = floodDays.filter(a => a.day === 'Friday');
  console.log(`Total Friday flood days: ${fridayFlood.length}`);
  if (fridayFlood.length > 0) {
    const mnOpenDPFri = fridayFlood.filter(a => a.nightOpenDP).length;
    const rnOpenDPFri = fridayFlood.filter(a => a.rajdhaniOpenDP).length;
    const mbOpenDPFri = fridayFlood.filter(a => a.mainBazarOpenDP).length;
    console.log(`  Milan Night Open DP on Friday Flood: ${((mnOpenDPFri / fridayFlood.length) * 100).toFixed(2)}% (${mnOpenDPFri}/${fridayFlood.length})`);
    console.log(`  Rajdhani Night Open DP on Friday Flood: ${((rnOpenDPFri / fridayFlood.length) * 100).toFixed(2)}% (${rnOpenDPFri}/${fridayFlood.length})`);
    console.log(`  Main Bazar Open DP on Friday Flood: ${((mbOpenDPFri / fridayFlood.length) * 100).toFixed(2)}% (${mbOpenDPFri}/${fridayFlood.length})`);
  }
}
