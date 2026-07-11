const fs = require('fs');
const path = require('path');

const data = require('./open-sutta-records-cache.json');
const milanNight = data['Milan Night'] || [];
const milanDay = data['Milan Day'] || [];

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

// Map day by date
const dayByDate = {};
milanDay.forEach(r => {
  dayByDate[r.dateRangeStart + '|' + r.day] = r;
});

// Incorporate the latest known results from this week:
// Thursday July 9: Milan Night Open = 178 (Sutta 6)
// Friday July 10: Milan Day Open = 448 (Sutta 6)
// We want to see how historical matches behaved.

let pairedCount = 0;
let sameSuttaCount = 0;
let daySutta6Count = 0;
let daySutta6NightSutta6Count = 0;

milanNight.forEach(mn => {
  const key = mn.dateRangeStart + '|' + mn.day;
  const md = dayByDate[key];
  if (md) {
    pairedCount++;
    const mdSutta = getSutta(md.openPanel);
    const mnSutta = getSutta(mn.openPanel);
    if (mdSutta >= 0 && mnSutta >= 0) {
      if (mdSutta === mnSutta) {
        sameSuttaCount++;
      }
      if (mdSutta === 6) {
        daySutta6Count++;
        if (mnSutta === 6) {
          daySutta6NightSutta6Count++;
        }
      }
    }
  }
});

console.log(`Total paired Day-Night draws analyzed: ${pairedCount}`);
console.log(`Same Sutta on same day (Open): ${sameSuttaCount} times (${(sameSuttaCount / pairedCount * 100).toFixed(2)}%)`);
console.log(`Expected if completely random: 10.00%`);

console.log(`\nWhen Milan Day Open Sutta is 6 (N=${daySutta6Count} draws):`);
console.log(`  Milan Night Open Sutta is 6: ${daySutta6NightSutta6Count} times (${(daySutta6NightSutta6Count / daySutta6Count * 100).toFixed(2)}%)`);
console.log(`  Other Suttas (not 6): ${daySutta6Count - daySutta6NightSutta6Count} times (${((daySutta6Count - daySutta6NightSutta6Count) / daySutta6Count * 100).toFixed(2)}%)`);
