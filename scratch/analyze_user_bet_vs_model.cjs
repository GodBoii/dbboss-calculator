const fs = require('fs');
const path = require('path');

const userBet1 = [
  '112', '113', '117', '110', '122', '133', '177', '100', '224', '226', '229', '244', '266', '299', '334', '336', '339', '344', '366', '399', '447', '440', '477', '400', '667', '660', '677', '600', '779', '799', '990', '900'
]; // 32 panels

const userBet2 = [
  '112', '116', '117', '144', '166', '199', '224', '225', '229', '220', '233', '266', '288', '337', '338', '355', '388', '300', '445', '446', '440', '455', '477', '400', '558', '559', '577', '599', '667', '699', '779', '770', '788', '800', '990', '900'
]; // 36 panels

// Get the latest predictions file
const dataDir = path.join(process.cwd(), 'scraper', 'data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('advanced_predictions_') && f.endsWith('.json'));
files.sort();
const latestFile = path.join(dataDir, files[files.length - 1]);
const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
const milanNightPred = data.find(m => m.market === 'Milan Night');

if (!milanNightPred) {
  console.log('Milan Night predictions not found');
  process.exit(1);
}

// Map panel to its prediction info
const predMap = {};
milanNightPred.top_picks.forEach((pick, idx) => {
  predMap[pick.panel] = {
    rank: idx + 1,
    score: pick.score,
    sutta: pick.sutta,
    isHoneyPot: pick.is_honey_pot_pick
  };
});

console.log('=== USER BET 1 ANALYSIS (32 panels, avoids 5/8) ===');
let b1Picks = [];
userBet1.forEach(p => {
  const pred = predMap[p];
  if (pred) {
    b1Picks.push({ panel: p, ...pred });
  } else {
    b1Picks.push({ panel: p, rank: 999, score: 0, sutta: -1, isHoneyPot: false });
  }
});
b1Picks.sort((a, b) => a.rank - b.rank);
console.log('Top 10 highest-ranked panels in Bet 1:');
b1Picks.slice(0, 10).forEach(x => {
  console.log(`  Rank ${x.rank}: Panel ${x.panel} (Sutta ${x.sutta}) | Score: ${x.score.toFixed(2)}`);
});
console.log('Lowest-ranked/Suppressed panels in Bet 1:');
b1Picks.slice(-10).forEach(x => {
  console.log(`  Rank ${x.rank}: Panel ${x.panel} (Sutta ${x.sutta}) | Score: ${x.score.toFixed(2)}`);
});

console.log('\n=== USER BET 2 ANALYSIS (36 panels, 3,9 family) ===');
let b2Picks = [];
userBet2.forEach(p => {
  const pred = predMap[p];
  if (pred) {
    b2Picks.push({ panel: p, ...pred });
  } else {
    b2Picks.push({ panel: p, rank: 999, score: 0, sutta: -1, isHoneyPot: false });
  }
});
b2Picks.sort((a, b) => a.rank - b.rank);
console.log('Top 10 highest-ranked panels in Bet 2:');
b2Picks.slice(0, 10).forEach(x => {
  console.log(`  Rank ${x.rank}: Panel ${x.panel} (Sutta ${x.sutta}) | Score: ${x.score.toFixed(2)}`);
});
console.log('Lowest-ranked/Suppressed panels in Bet 2:');
b2Picks.slice(-10).forEach(x => {
  console.log(`  Rank ${x.rank}: Panel ${x.panel} (Sutta ${x.sutta}) | Score: ${x.score.toFixed(2)}`);
});

console.log('\n=== OVERLAPPED 12 PANELS ANALYSIS (Doubled-down) ===');
const overlap = userBet1.filter(p => userBet2.includes(p));
let overlapPicks = [];
overlap.forEach(p => {
  const pred = predMap[p];
  if (pred) {
    overlapPicks.push({ panel: p, ...pred });
  } else {
    overlapPicks.push({ panel: p, rank: 999, score: 0, sutta: -1, isHoneyPot: false });
  }
});
overlapPicks.sort((a, b) => a.rank - b.rank);
overlapPicks.forEach(x => {
  console.log(`  Rank ${x.rank}: Panel ${x.panel} (Sutta ${x.sutta}) | Score: ${x.score.toFixed(2)}`);
});
