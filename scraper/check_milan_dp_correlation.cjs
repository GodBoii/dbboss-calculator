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

// Group records by date_range_start and day to combine open and close
function getMarketDraws(marketName) {
  const marketRecords = records.filter(r => r.market === marketName);
  const draws = {};
  marketRecords.forEach(r => {
    const key = `${r.date_range_start}_${r.day}`;
    if (!draws[key]) {
      draws[key] = { open: null, close: null, date: r.date_range_start, day: r.day };
    }
    // We determine open vs close based on whether it is the first panel seen or second in that week/day.
    // Wait! The day column has Monday, Wednesday (which is Mon close), Thursday (Tue open), Saturday (Tue close), etc.
    // Let's map them to actual days:
    // Open: Monday, Thursday, Sunday, Day10, Day13, Day16, Day19
    // Close: Wednesday, Saturday, Day9, Day12, Day15, Day18, Day21
  });
  
  // Actually, we can just group by date_range_start and map columns:
  // Column mapping:
  // Open columns: 'Monday', 'Thursday', 'Sunday', 'Day10', 'Day13', 'Day16', 'Day19'
  // Close columns: 'Wednesday', 'Saturday', 'Day9', 'Day12', 'Day15', 'Day18', 'Day21'
  // Let's do this mapping:
  const dayPairs = [
    { name: 'Monday', open: 'Monday', close: 'Wednesday' },
    { name: 'Tuesday', open: 'Thursday', close: 'Saturday' },
    { name: 'Wednesday', open: 'Sunday', close: 'Day9' },
    { name: 'Thursday', open: 'Day10', close: 'Day12' },
    { name: 'Friday', open: 'Day13', close: 'Day15' },
    { name: 'Saturday', open: 'Day16', close: 'Day18' },
    { name: 'Sunday', open: 'Day19', close: 'Day21' }
  ];

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
const nightDraws = getMarketDraws('Milan Night');

// Align day and night draws by date and day of week
const aligned = [];
dayDraws.forEach(dDraw => {
  const nDraw = nightDraws.find(n => n.date === dDraw.date && n.day === dDraw.day);
  if (nDraw) {
    aligned.push({
      date: dDraw.date,
      day: dDraw.day,
      dayOpen: dDraw.open,
      dayClose: dDraw.close,
      dayIsOpenDP: dDraw.isOpenDP,
      dayIsCloseDP: dDraw.isCloseDP,
      nightOpen: nDraw.open,
      nightClose: nDraw.close,
      nightIsOpenDP: nDraw.isOpenDP,
      nightIsCloseDP: nDraw.isCloseDP
    });
  }
});

console.log(`Total aligned draws: ${aligned.length}`);

// Analysis 1: Base rates
const nightOpenDPCount = aligned.filter(a => a.nightIsOpenDP).length;
const baseNightOpenDPRate = (nightOpenDPCount / aligned.length) * 100;
console.log(`Base Milan Night Open DP rate: ${baseNightOpenDPRate.toFixed(2)}% (${nightOpenDPCount}/${aligned.length})`);

// Analysis 2: When Milan Day Open is DP
const dayOpenDP = aligned.filter(a => a.dayIsOpenDP);
const nightOpenDPWhenDayOpenDP = dayOpenDP.filter(a => a.nightIsOpenDP).length;
const rate1 = (nightOpenDPWhenDayOpenDP / dayOpenDP.length) * 100;
console.log(`Milan Night Open DP rate when Milan Day Open is DP: ${rate1.toFixed(2)}% (${nightOpenDPWhenDayOpenDP}/${dayOpenDP.length})`);

// Analysis 3: When Milan Day is Double DP (both Open and Close are DP)
const dayDoubleDP = aligned.filter(a => a.dayIsOpenDP && a.dayIsCloseDP);
const nightOpenDPWhenDayDoubleDP = dayDoubleDP.filter(a => a.nightIsOpenDP).length;
const rate2 = (nightOpenDPWhenDayDoubleDP / dayDoubleDP.length) * 100;
console.log(`Milan Night Open DP rate when Milan Day is Double DP: ${rate2.toFixed(2)}% (${nightOpenDPWhenDayDoubleDP}/${dayDoubleDP.length})`);

// Analysis 4: Friday specific base rate
const fridays = aligned.filter(a => a.day === 'Friday');
const fridayNightOpenDP = fridays.filter(a => a.nightIsOpenDP).length;
const rate3 = (fridayNightOpenDP / fridays.length) * 100;
console.log(`Milan Night Open DP rate on Fridays (Base): ${rate3.toFixed(2)}% (${fridayNightOpenDP}/${fridays.length})`);

// Analysis 5: Friday + Milan Day Double DP (specific to today!)
const fridayDayDoubleDP = fridays.filter(a => a.dayIsOpenDP && a.dayIsCloseDP);
const nightOpenDPFridayDoubleDP = fridayDayDoubleDP.filter(a => a.nightIsOpenDP).length;
const rate4 = (nightOpenDPFridayDoubleDP / fridayDayDoubleDP.length) * 100;
console.log(`Milan Night Open DP rate on Fridays when Milan Day is Double DP: ${rate4.toFixed(2)}% (${nightOpenDPFridayDoubleDP}/${fridayDayDoubleDP.length})`);
