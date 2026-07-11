const data = require('./open-sutta-records-cache.json');
const milanNight = data['Milan Night'] || [];

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

const dps = milanNight.filter(r => isDP(r.openPanel));
console.log(`Total DP occurrences in Milan Night Open: ${dps.length}`);

let has5Or8Count = 0;
let in39FamilyCount = 0;
let overlapCount = 0;

dps.forEach(r => {
  const p = r.openPanel;
  const s = getSutta(p);
  const has5 = p.includes('5');
  const has8 = p.includes('8');
  const is39Family = [3, 8, 4, 9].includes(s);
  
  if (has5 || has8) has5Or8Count++;
  if (is39Family) in39FamilyCount++;
  if ((has5 || has8) && is39Family) overlapCount++;
});

console.log(`DPs containing 5 or 8: ${has5Or8Count} (${(has5Or8Count / dps.length * 100).toFixed(2)}%)`);
console.log(`DPs NOT containing 5 or 8: ${dps.length - has5Or8Count} (${((dps.length - has5Or8Count) / dps.length * 100).toFixed(2)}%)`);
console.log(`DPs in Sutta 3, 8, 4, 9 family: ${in39FamilyCount} (${(in39FamilyCount / dps.length * 100).toFixed(2)}%)`);
console.log(`DPs in 3,9 family AND containing 5 or 8: ${overlapCount} (${(overlapCount / dps.length * 100).toFixed(2)}%)`);
console.log(`DPs in 3,9 family and NOT containing 5 or 8 (overlapping 12 panels): ${in39FamilyCount - overlapCount} (${((in39FamilyCount - overlapCount) / dps.length * 100).toFixed(2)}%)`);
