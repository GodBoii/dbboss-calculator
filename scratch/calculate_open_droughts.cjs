const data = require('./open-sutta-records-cache.json');
const milanNight = data['Milan Night'] || [];

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

// Incorporate the newest live record from the homepage: 178-64-356
const latestLiveRecord = {
  day: 'Thursday',
  dateRangeStart: '06/07/2026',
  openPanel: '178',
  closePanel: '356',
  jodi: '64'
};

const allRecords = [...milanNight];
// Check if the latest homepage record is already in the cache
const lastInCache = allRecords[allRecords.length - 1];
if (lastInCache && lastInCache.openPanel !== '178') {
  allRecords.push(latestLiveRecord);
}

console.log(`Total records analyzed (including latest live): ${allRecords.length}`);

// Print the last 15 open results
console.log('\n--- LAST 15 MILAN NIGHT OPEN RESULTS ---');
const last15 = allRecords.slice(-15);
last15.forEach((r, idx) => {
  const p = r.openPanel;
  const s = getSutta(p);
  console.log(`Draw -${15 - idx}: ${r.day} | Open: ${p} (Sutta: ${s})`);
});

// Calculate current droughts for each sutta (0-9) in the Open position
const droughts = Array(10).fill(0);
const seen = Array(10).fill(false);

for (let i = allRecords.length - 1; i >= 0; i--) {
  const p = allRecords[i].openPanel;
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

console.log('\n--- CURRENT SUTTA DROUGHTS FOR MILAN NIGHT OPEN ---');
for (let s = 0; s < 10; s++) {
  console.log(`Sutta ${s}: Drought of ${droughts[s]} draws`);
}

// Calculate digit presence droughts in the last draws
const digitDroughts = Array(10).fill(0);
const digitSeen = Array(10).fill(false);

for (let i = allRecords.length - 1; i >= 0; i--) {
  const p = allRecords[i].openPanel;
  if (p && p.length === 3) {
    for (let d = 0; d < 10; d++) {
      if (!digitSeen[d]) {
        if (p.includes(d.toString())) {
          digitSeen[d] = true;
        } else {
          digitDroughts[d]++;
        }
      }
    }
  }
}

console.log('\n--- CURRENT DIGIT DROUGHTS IN MILAN NIGHT OPEN PANELS ---');
for (let d = 0; d < 10; d++) {
  console.log(`Digit ${d}: Drought of ${digitDroughts[d]} draws`);
}
