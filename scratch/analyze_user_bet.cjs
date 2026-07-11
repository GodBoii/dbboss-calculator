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

// Generate all 220 panels
const panels = [];
for (let i = 0; i < 10; i++) {
  for (let j = i; j < 10; j++) {
    for (let k = j; k < 10; k++) {
      const p = `${digits[i]}${digits[j]}${digits[k]}`;
      panels.push(p);
    }
  }
}

const dp3 = [];
const dp9 = [];

panels.forEach(p => {
  if (isDP(p)) {
    const sutta = getSutta(p);
    if (sutta === 3) dp3.push(p);
    if (sutta === 9) dp9.push(p);
  }
});

console.log('Sutta 3 DP panels:', dp3.length, dp3);
console.log('Sutta 9 DP panels:', dp9.length, dp9);
const combined = [...dp3, ...dp9];
console.log('Combined DP panels (3 and 9):', combined.length, combined);
