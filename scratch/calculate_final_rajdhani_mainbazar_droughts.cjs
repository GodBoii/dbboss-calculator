const fs = require('fs');
const path = require('path');

const data = require('./open-sutta-records-cache.json');
const rajdhaniNight = [...(data['Rajdhani Night'] || [])];
const mainBazar = [...(data['Main Bazar'] || [])];

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

// Add Thursday live records if not in cache
// Rajdhani Night: 150-60-136
const latestRN = {
  day: 'Thursday',
  dateRangeStart: '06/07/2026',
  openPanel: '150',
  closePanel: '136',
  jodi: '60'
};
if (rajdhaniNight[rajdhaniNight.length - 1].openPanel !== '150') {
  rajdhaniNight.push(latestRN);
}

// Main Bazar: 279-84-400
const latestMB = {
  day: 'Thursday',
  dateRangeStart: '06/07/2026',
  openPanel: '279',
  closePanel: '400',
  jodi: '84'
};
if (mainBazar[mainBazar.length - 1].openPanel !== '279') {
  mainBazar.push(latestMB);
}

console.log(`Updated Rajdhani Night: ${rajdhaniNight.length} records`);
console.log(`Updated Main Bazar: ${mainBazar.length} records`);

// Droughts calculators
function calculateDroughts(records, position) {
  const droughts = Array(10).fill(0);
  const seen = Array(10).fill(false);
  
  for (let i = records.length - 1; i >= 0; i--) {
    const p = position === 'open' ? records[i].openPanel : records[i].closePanel;
    const s = getSutta(p);
    if (s >= 0) {
      for (let d = 0; d < 10; d++) {
        if (!seen[d]) {
          if (s === d) {
            seen[d] = true;
          } else {
            droughts[d]++;
          }
        }
      }
    }
  }
  return droughts;
}

const rnOpen = calculateDroughts(rajdhaniNight, 'open');
const rnClose = calculateDroughts(rajdhaniNight, 'close');
const mbOpen = calculateDroughts(mainBazar, 'open');
const mbClose = calculateDroughts(mainBazar, 'close');

console.log('\n=== UPDATED SUTTA DROUGHTS FOR TONIGHT ===');
console.log('Sutta | Rajdhani Open | Rajdhani Close | Main Bazar Open | Main Bazar Close');
for (let s = 0; s < 10; s++) {
  console.log(`  ${s}   |      ${rnOpen[s].toString().padEnd(8)} |      ${rnClose[s].toString().padEnd(9)} |      ${mbOpen[s].toString().padEnd(9)} |      ${mbClose[s]}`);
}

// Check recent results
console.log('\n--- Recent Rajdhani Night Open results ---');
rajdhaniNight.slice(-6).forEach(r => console.log(`  ${r.day} Open: ${r.openPanel} (Sutta: ${getSutta(r.openPanel)})`));

console.log('\n--- Recent Main Bazar Open results ---');
mainBazar.slice(-6).forEach(r => console.log(`  ${r.day} Open: ${r.openPanel} (Sutta: ${getSutta(r.openPanel)})`));
