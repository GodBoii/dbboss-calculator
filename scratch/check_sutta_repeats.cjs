const data = require('./open-sutta-records-cache.json');
const milanNight = data['Milan Night'] || [];

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

// Add the latest live Thursday record: 178 (Sutta 6)
const allRecords = [...milanNight];
const lastInCache = allRecords[allRecords.length - 1];
if (lastInCache && lastInCache.openPanel !== '178') {
  allRecords.push({
    openPanel: '178'
  });
}

let repeatCount = 0;
let validPairs = 0;
const repeatBySutta = Array(10).fill(0);
const occurrences = Array(10).fill(0);

for (let i = 1; i < allRecords.length; i++) {
  const prevSutta = getSutta(allRecords[i-1].openPanel);
  const currSutta = getSutta(allRecords[i].openPanel);
  
  if (prevSutta >= 0 && currSutta >= 0) {
    validPairs++;
    occurrences[prevSutta]++;
    if (prevSutta === currSutta) {
      repeatCount++;
      repeatBySutta[prevSutta]++;
    }
  }
}

console.log(`Total valid transitions analyzed: ${validPairs}`);
console.log(`Total back-to-back repeats: ${repeatCount} (${(repeatCount / validPairs * 100).toFixed(2)}%)`);
console.log('Expected repeat rate if random: 10.00%');

console.log('\n--- Repeat rate by Sutta ---');
for (let s = 0; s < 10; s++) {
  const occ = occurrences[s];
  const rep = repeatBySutta[s];
  const rate = occ > 0 ? (rep / occ * 100).toFixed(2) : '0.00';
  console.log(`Sutta ${s}: Repeated ${rep}/${occ} times when it appeared (${rate}%)`);
}
