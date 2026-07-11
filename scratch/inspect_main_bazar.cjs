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

function getSutta(panelStr) {
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
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

function analyzeMarketDroughts(marketName) {
  const marketRecords = records.filter(r => r.market === marketName);
  
  // Flatten records into chronological draws (Open vs Close)
  const draws = [];
  const weeks = {};
  marketRecords.forEach(r => {
    const wKey = r.date_range_start;
    if (!weeks[wKey]) {
      weeks[wKey] = {};
    }
    weeks[wKey][r.day] = r.panel;
  });

  // Sort weeks chronologically (since we can't easily parse date strings in JS, let's sort by date_range_start)
  // Let's assume the CSV order is chronological (newest at the bottom).
  // So we sort by position in records.
  const weekKeys = Object.keys(weeks);
  
  const chronologicalDraws = [];
  weekKeys.forEach(wKey => {
    const weekData = weeks[wKey];
    dayPairs.forEach(dp => {
      const openPanel = weekData[dp.open];
      const closePanel = weekData[dp.close];
      if (openPanel) {
        chronologicalDraws.push({ position: 'Open', panel: openPanel, date: wKey, day: dp.name });
      }
      if (closePanel) {
        chronologicalDraws.push({ position: 'Close', panel: closePanel, date: wKey, day: dp.name });
      }
    });
  });

  console.log(`\n=== MARKET: ${marketName} (Chronological Draws: ${chronologicalDraws.length}) ===`);
  const last10 = chronologicalDraws.slice(-10);
  console.log('Last 10 Draws:');
  last10.forEach((d, idx) => {
    const sutta = getSutta(d.panel);
    console.log(`  ${idx+1}. ${d.date} (${d.day}) | ${d.position}: ${d.panel} (Sutta: ${sutta}, ${isDP(d.panel) ? 'DP' : 'SP'})`);
  });

  // Calculate Sutta droughts for Open and Close separately
  function getPositionDroughts(pos) {
    const posDraws = chronologicalDraws.filter(d => d.position === pos);
    const droughts = {};
    for (let i = 0; i < 10; i++) {
      droughts[i] = 999;
    }
    
    for (let i = 0; i < 10; i++) {
      for (let j = posDraws.length - 1; j >= 0; j--) {
        const sutta = getSutta(posDraws[j].panel);
        if (sutta === i) {
          droughts[i] = posDraws.length - 1 - j;
          break;
        }
      }
    }
    return droughts;
  }

  const openDroughts = getPositionDroughts('Open');
  const closeDroughts = getPositionDroughts('Close');
  console.log('Open Sutta Droughts:', openDroughts);
  console.log('Close Sutta Droughts:', closeDroughts);
}

analyzeMarketDroughts('Rajdhani Night');
analyzeMarketDroughts('Main Bazar');
