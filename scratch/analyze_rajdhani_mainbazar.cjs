const fs = require('fs');
const path = require('path');

const data = require('./open-sutta-records-cache.json');
const rajdhaniNight = data['Rajdhani Night'] || [];
const mainBazar = data['Main Bazar'] || [];

function isDP(panelStr) {
  if (!panelStr || panelStr.length !== 3) return false;
  const chars = panelStr.split('');
  return (chars[0] === chars[1] && chars[1] !== chars[2]) || 
         (chars[1] === chars[2] && chars[0] !== chars[1]) ||
         (chars[0] === chars[2] && chars[0] !== chars[1]);
}

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

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

console.log(`Rajdhani Night records: ${rajdhaniNight.length}`);
console.log(`Main Bazar records: ${mainBazar.length}`);

// 1. Rajdhani Night DP Rates
const rnOpenDp = rajdhaniNight.filter(r => isDP(r.openPanel)).length;
const rnCloseDp = rajdhaniNight.filter(r => isDP(r.closePanel)).length;
console.log('\n==================================================');
console.log('RAJDHANI NIGHT - HISTORICAL DP RATES');
console.log('==================================================');
console.log(`Open DP rate: ${rnOpenDp}/${rajdhaniNight.length} (${(rnOpenDp / rajdhaniNight.length * 100).toFixed(2)}%)`);
console.log(`Close DP rate: ${rnCloseDp}/${rajdhaniNight.length} (${(rnCloseDp / rajdhaniNight.length * 100).toFixed(2)}%)`);

// Recent 180 draws for Rajdhani Night
const rnRecent = rajdhaniNight.slice(-180);
const rnRecOpen = rnRecent.filter(r => isDP(r.openPanel)).length;
const rnRecClose = rnRecent.filter(r => isDP(r.closePanel)).length;
console.log(`Recent 180 draws Open DP rate: ${(rnRecOpen / 180 * 100).toFixed(2)}%`);
console.log(`Recent 180 draws Close DP rate: ${(rnRecClose / 180 * 100).toFixed(2)}%`);

// 2. Main Bazar DP Rates
const mbOpenDp = mainBazar.filter(r => isDP(r.openPanel)).length;
const mbCloseDp = mainBazar.filter(r => isDP(r.closePanel)).length;
console.log('\n==================================================');
console.log('MAIN BAZAR - HISTORICAL DP RATES');
console.log('==================================================');
console.log(`Open DP rate: ${mbOpenDp}/${mainBazar.length} (${(mbOpenDp / mainBazar.length * 100).toFixed(2)}%)`);
console.log(`Close DP rate: ${mbCloseDp}/${mainBazar.length} (${(mbCloseDp / mainBazar.length * 100).toFixed(2)}%)`);

// Recent 180 draws for Main Bazar
const mbRecent = mainBazar.slice(-180);
const mbRecOpen = mbRecent.filter(r => isDP(r.openPanel)).length;
const mbRecClose = mbRecent.filter(r => isDP(r.closePanel)).length;
console.log(`Recent 180 draws Open DP rate: ${(mbRecOpen / 180 * 100).toFixed(2)}%`);
console.log(`Recent 180 draws Close DP rate: ${(mbRecClose / 180 * 100).toFixed(2)}%`);

// 3. Sutta droughts
const rnOpenDroughts = calculateDroughts(rajdhaniNight, 'open');
const rnCloseDroughts = calculateDroughts(rajdhaniNight, 'close');
const mbOpenDroughts = calculateDroughts(mainBazar, 'open');
const mbCloseDroughts = calculateDroughts(mainBazar, 'close');

console.log('\n==================================================');
console.log('CURRENT SUTTA DROUGHTS');
console.log('==================================================');
console.log('Sutta | Rajdhani Open | Rajdhani Close | Main Bazar Open | Main Bazar Close');
for (let s = 0; s < 10; s++) {
  console.log(`  ${s}   |      ${rnOpenDroughts[s].toString().padEnd(8)} |      ${rnCloseDroughts[s].toString().padEnd(9)} |      ${mbOpenDroughts[s].toString().padEnd(9)} |      ${mbCloseDroughts[s]}`);
}

// 4. Last 5 draws detail for Rajdhani Night and Main Bazar
console.log('\n==================================================');
console.log('LAST 5 DRAWS DETAIL');
console.log('==================================================');
console.log('Rajdhani Night:');
rajdhaniNight.slice(-5).forEach(r => {
  console.log(`  ${r.day} | Open: ${r.openPanel} (${getSutta(r.openPanel)}) [${isDP(r.openPanel)?'DP':'SP'}] | Close: ${r.closePanel} (${getSutta(r.closePanel)}) [${isDP(r.closePanel)?'DP':'SP'}]`);
});
console.log('\nMain Bazar:');
mainBazar.slice(-5).forEach(r => {
  console.log(`  ${r.day} | Open: ${r.openPanel} (${getSutta(r.openPanel)}) [${isDP(r.openPanel)?'DP':'SP'}] | Close: ${r.closePanel} (${getSutta(r.closePanel)}) [${isDP(r.closePanel)?'DP':'SP'}]`);
});
