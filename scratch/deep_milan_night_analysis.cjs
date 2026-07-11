const fs = require('fs');
const path = require('path');

const data = require('./open-sutta-records-cache.json');
const milanNight = data['Milan Night'] || [];
const milanDay = data['Milan Day'] || [];

function isDP(panelStr) {
  if (!panelStr || panelStr.length !== 3) return false;
  const chars = panelStr.split('');
  return (chars[0] === chars[1] && chars[1] !== chars[2]) || 
         (chars[1] === chars[2] && chars[0] !== chars[1]) ||
         (chars[0] === chars[2] && chars[0] !== chars[1]);
}

function isSP(panelStr) {
  if (!panelStr || panelStr.length !== 3) return false;
  const chars = panelStr.split('');
  return chars[0] !== chars[1] && chars[1] !== chars[2] && chars[0] !== chars[2];
}

function isTP(panelStr) {
  if (!panelStr || panelStr.length !== 3) return false;
  return panelStr[0] === panelStr[1] && panelStr[1] === panelStr[2];
}

function getSutta(panelStr) {
  if (!panelStr) return -1;
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

// Check digit contents
function hasDigit(panelStr, digit) {
  if (!panelStr) return false;
  return panelStr.includes(digit.toString());
}

console.log(`Loaded ${milanNight.length} Milan Night records.`);
console.log(`Loaded ${milanDay.length} Milan Day records.`);

// 1. Overall DP rates for Milan Night Open
const totalMN = milanNight.length;
const openDPs = milanNight.filter(r => isDP(r.openPanel));
const openSPs = milanNight.filter(r => isSP(r.openPanel));
const openTPs = milanNight.filter(r => isTP(r.openPanel));

console.log('\n==================================================');
console.log('1. MILAN NIGHT OPEN - ALL-TIME PANEL TYPE DISTRIBUTION');
console.log('==================================================');
console.log(`Total records: ${totalMN}`);
console.log(`SP count: ${openSPs.length} (${(openSPs.length / totalMN * 100).toFixed(2)}%)`);
console.log(`DP count: ${openDPs.length} (${(openDPs.length / totalMN * 100).toFixed(2)}%)`);
console.log(`TP count: ${openTPs.length} (${(openTPs.length / totalMN * 100).toFixed(2)}%)`);

// Recent subsets
const recentWindows = [30, 90, 180, 365, 730];
console.log('\n--- Recent Window DP Rates (Milan Night Open) ---');
recentWindows.forEach(w => {
  const subset = milanNight.slice(-w);
  const dpCount = subset.filter(r => isDP(r.openPanel)).length;
  console.log(`Last ${w} draws: ${dpCount}/${subset.length} DP (${(dpCount / subset.length * 100).toFixed(2)}%)`);
});

// 2. Digit Frequencies in Milan Night Open
// How often do digits 5 and 8 appear in Milan Night Open panels?
console.log('\n==================================================');
console.log('2. DIGIT FREQUENCIES IN MILAN NIGHT OPEN PANELS (ALL-TIME)');
console.log('==================================================');
const digitCounts = Array(10).fill(0);
let totalDigits = 0;
milanNight.forEach(r => {
  if (r.openPanel && r.openPanel.length === 3) {
    r.openPanel.split('').forEach(d => {
      digitCounts[Number(d)]++;
      totalDigits++;
    });
  }
});

for (let d = 0; d < 10; d++) {
  const percentage = (digitCounts[d] / totalDigits * 100).toFixed(2);
  const panelPresence = (milanNight.filter(r => hasDigit(r.openPanel, d)).length / totalMN * 100).toFixed(2);
  console.log(`Digit ${d}: Count = ${digitCounts[d]} (${percentage}% of all digits) | Present in ${panelPresence}% of panels`);
}

// Let's specifically check the last 365 days for digit presence
console.log('\n--- Last 365 Draws Digit Presence ---');
const last365 = milanNight.slice(-365);
for (let d = 0; d < 10; d++) {
  const panelPresence = (last365.filter(r => hasDigit(r.openPanel, d)).length / 365 * 100).toFixed(2);
  console.log(`Digit ${d}: Present in ${panelPresence}% of panels`);
}

// 3. Sutta Distribution in Milan Night Open (All-Time vs Recent)
console.log('\n==================================================');
console.log('3. SUTTA DISTRIBUTION IN MILAN NIGHT OPEN');
console.log('==================================================');
const suttaCounts = Array(10).fill(0);
milanNight.forEach(r => {
  const s = getSutta(r.openPanel);
  if (s >= 0) suttaCounts[s]++;
});

console.log('All-Time Sutta Distribution:');
for (let s = 0; s < 10; s++) {
  console.log(`Sutta ${s}: ${suttaCounts[s]} times (${(suttaCounts[s] / totalMN * 100).toFixed(2)}%)`);
}

console.log('\nLast 180 Draws Sutta Distribution:');
const last180 = milanNight.slice(-180);
const sCounts180 = Array(10).fill(0);
last180.forEach(r => {
  const s = getSutta(r.openPanel);
  if (s >= 0) sCounts180[s]++;
});
for (let s = 0; s < 10; s++) {
  console.log(`Sutta ${s}: ${sCounts180[s]} times (${(sCounts180[s] / 180 * 100).toFixed(2)}%)`);
}

// 4. Analysis of the User's Bets Against History
console.log('\n==================================================');
console.log('4. VERIFYING USER BETS AGAINST HISTORICAL RESULTS');
console.log('==================================================');
const userBet1 = [
  '112', '113', '117', '110', '122', '133', '177', '100', '224', '226', '229', '244', '266', '299', '334', '336', '339', '344', '366', '399', '447', '440', '477', '400', '667', '660', '677', '600', '779', '799', '990', '900'
]; // 32 panels

const userBet2 = [
  '112', '116', '117', '144', '166', '199', '224', '225', '229', '220', '233', '266', '288', '337', '338', '355', '388', '300', '445', '446', '440', '455', '477', '400', '558', '559', '577', '599', '667', '699', '779', '770', '788', '800', '990', '900'
]; // 36 panels

// Hit rates historically
let hitCount1 = 0;
let hitCount2 = 0;
let hitBothCount = 0;
let hitEitherCount = 0;

milanNight.forEach(r => {
  const p = r.openPanel;
  const isB1 = userBet1.includes(p);
  const isB2 = userBet2.includes(p);
  if (isB1) hitCount1++;
  if (isB2) hitCount2++;
  if (isB1 && isB2) hitBothCount++;
  if (isB1 || isB2) hitEitherCount++;
});

console.log(`All-time hit rates (out of ${totalMN} draws):`);
console.log(`Bet 1 (32 panels, avoids 5,8): Hit ${hitCount1} times (${(hitCount1 / totalMN * 100).toFixed(2)}%)`);
console.log(`Bet 2 (36 panels, 3,9 family): Hit ${hitCount2} times (${(hitCount2 / totalMN * 100).toFixed(2)}%)`);
console.log(`Overlapping 12 panels (doubled-down): Hit ${hitBothCount} times (${(hitBothCount / totalMN * 100).toFixed(2)}%)`);
console.log(`Either Bet 1 or Bet 2 (56 unique panels): Hit ${hitEitherCount} times (${(hitEitherCount / totalMN * 100).toFixed(2)}%)`);

// Recent 180 draws hit rates
let hit180_1 = 0, hit180_2 = 0, hit180_both = 0, hit180_either = 0;
last180.forEach(r => {
  const p = r.openPanel;
  const isB1 = userBet1.includes(p);
  const isB2 = userBet2.includes(p);
  if (isB1) hit180_1++;
  if (isB2) hit180_2++;
  if (isB1 && isB2) hit180_both++;
  if (isB1 || isB2) hit180_either++;
});
console.log(`\nLast 180 draws hit rates:`);
console.log(`Bet 1: Hit ${hit180_1} times (${(hit180_1 / 180 * 100).toFixed(2)}%)`);
console.log(`Bet 2: Hit ${hit180_2} times (${(hit180_2 / 180 * 100).toFixed(2)}%)`);
console.log(`Overlapping 12 panels: Hit ${hit180_both} times (${(hit180_both / 180 * 100).toFixed(2)}%)`);
console.log(`Either Bet 1 or Bet 2 (56 panels): Hit ${hit180_either} times (${(hit180_either / 180 * 100).toFixed(2)}%)`);

// 5. Cross-market correlation (Milan Day -> Milan Night)
// Map dateRangeStart to line up Milan Day and Milan Night draws
console.log('\n==================================================');
console.log('5. CROSS-MARKET RELATIONSHIPS: MILAN DAY -> MILAN NIGHT');
console.log('==================================================');

const dayByDate = {};
milanDay.forEach(r => {
  dayByDate[r.dateRangeStart + '|' + r.day] = r;
});

let pairedCount = 0;
let dayDpNightDp = 0;
let daySpNightDp = 0;
let dayDpNightSp = 0;
let daySpNightSp = 0;

milanNight.forEach(mn => {
  const key = mn.dateRangeStart + '|' + mn.day;
  const md = dayByDate[key];
  if (md) {
    pairedCount++;
    const mdOpenDp = isDP(md.openPanel);
    const mnOpenDp = isDP(mn.openPanel);
    if (mdOpenDp && mnOpenDp) dayDpNightDp++;
    else if (!mdOpenDp && mnOpenDp) daySpNightDp++;
    else if (mdOpenDp && !mnOpenDp) dayDpNightSp++;
    else daySpNightSp++;
  }
});

console.log(`Paired draws found: ${pairedCount}`);
console.log(`Milan Day Open DP -> Milan Night Open DP: ${dayDpNightDp} (${(dayDpNightDp / pairedCount * 100).toFixed(2)}%)`);
console.log(`Milan Day Open SP -> Milan Night Open DP: ${daySpNightDp} (${(daySpNightDp / pairedCount * 100).toFixed(2)}%)`);
console.log(`Milan Day Open DP -> Milan Night Open SP: ${dayDpNightSp} (${(dayDpNightSp / pairedCount * 100).toFixed(2)}%)`);
console.log(`Milan Day Open SP -> Milan Night Open SP: ${daySpNightSp} (${(daySpNightSp / pairedCount * 100).toFixed(2)}%)`);

// Sutta relationships: does Milan Day Open Sutta predict Milan Night Open Sutta?
const dayOpenSuttaToNightOpenSutta = {};
milanNight.forEach(mn => {
  const key = mn.dateRangeStart + '|' + mn.day;
  const md = dayByDate[key];
  if (md) {
    const mdSutta = getSutta(md.openPanel);
    const mnSutta = getSutta(mn.openPanel);
    if (mdSutta >= 0 && mnSutta >= 0) {
      if (!dayOpenSuttaToNightOpenSutta[mdSutta]) {
        dayOpenSuttaToNightOpenSutta[mdSutta] = Array(10).fill(0);
      }
      dayOpenSuttaToNightOpenSutta[mdSutta][mnSutta]++;
    }
  }
});

console.log('\nMilan Day Open Sutta -> Milan Night Open Sutta Distribution:');
for (let mdS = 0; mdS < 10; mdS++) {
  const counts = dayOpenSuttaToNightOpenSutta[mdS] || Array(10).fill(0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total > 0) {
    const distributions = counts.map((c, i) => `${i}: ${(c / total * 100).toFixed(1)}%`).join(' | ');
    console.log(`Day Sutta ${mdS} (N=${total}) -> Night Sutta: ${distributions}`);
  }
}

// 6. Recent results detail for Milan Night Open (last 15)
console.log('\n==================================================');
console.log('6. RECENT MILAN NIGHT RESULTS DETAIL');
console.log('==================================================');
milanNight.slice(-20).forEach(r => {
  const p = r.openPanel;
  const sutta = getSutta(p);
  const type = isDP(p) ? 'DP' : (isSP(p) ? 'SP' : 'TP');
  const b1Hit = userBet1.includes(p) ? 'HIT B1' : 'miss';
  const b2Hit = userBet2.includes(p) ? 'HIT B2' : 'miss';
  const has5 = hasDigit(p, 5) ? 'has5' : 'no5';
  const has8 = hasDigit(p, 8) ? 'has8' : 'no8';
  console.log(`${r.day} | ${r.dateRangeStart} | Open: ${p} (${sutta}) [${type}] | B1: ${b1Hit} | B2: ${b2Hit} | ${has5} | ${has8}`);
});
