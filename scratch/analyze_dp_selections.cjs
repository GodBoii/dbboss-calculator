const userBet1 = [
  '112', '113', '117', '110', '122', '133', '177', '100', '224', '226', '229', '244', '266', '299', '334', '336', '339', '344', '366', '399', '447', '440', '477', '400', '667', '660', '677', '600', '779', '799', '990', '900'
]; // 32 panels

const userBet2 = [
  '112', '116', '117', '144', '166', '199', '224', '225', '229', '220', '233', '266', '288', '337', '338', '355', '388', '300', '445', '446', '440', '455', '477', '400', '558', '559', '577', '599', '667', '699', '779', '770', '788', '800', '990', '900'
]; // 36 panels

const digits = [1,2,3,4,5,6,7,8,9,0];

function getSutta(panelStr) {
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

function isDP(panelStr) {
  const chars = panelStr.split('');
  return (chars[0] === chars[1] && chars[1] !== chars[2]) || 
         (chars[1] === chars[2] && chars[0] !== chars[1]) ||
         (chars[0] === chars[2] && chars[0] !== chars[1]);
}

const dpPanels = [];
for (let i = 0; i < 10; i++) {
  for (let j = i; j < 10; j++) {
    for (let k = j; k < 10; k++) {
      const p = `${digits[i]}${digits[j]}${digits[k]}`;
      if (isDP(p)) {
        dpPanels.push(p);
      }
    }
  }
}

// Favored suttas tonight based on transition & low liability: 5, 0, 4, 6
const favoredSuttas = [5, 0, 4, 6];

console.log('=== FAVORED DP PANELS TONIGHT & YOUR COVERAGE ===');
favoredSuttas.forEach(sutta => {
  console.log(`\n--- SUTTA ${sutta} DP PANELS ---`);
  const suttaDps = dpPanels.filter(p => getSutta(p) === sutta);
  suttaDps.forEach(p => {
    const inB1 = userBet1.includes(p) ? 'Bet 1 (₹50)' : '';
    const inB2 = userBet2.includes(p) ? 'Bet 2 (₹25)' : '';
    const overlap = (inB1 && inB2) ? 'OVERLAP (₹75)' : (inB1 || inB2);
    const has5 = p.includes('5') ? 'contains 5' : '';
    const has8 = p.includes('8') ? 'contains 8' : '';
    const flags = [overlap, has5, has8].filter(Boolean).join(' | ');
    console.log(`  Panel: ${p} | Sutta: ${sutta} | ${flags || 'uncovered'}`);
  });
});
