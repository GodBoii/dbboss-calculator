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

const panels = [];
for (let i = 0; i < 10; i++) {
  for (let j = i; j < 10; j++) {
    for (let k = j; k < 10; k++) {
      const p = `${digits[i]}${digits[j]}${digits[k]}`;
      panels.push(p);
    }
  }
}

const dpPanels = panels.filter(isDP);

const familySuttas = [3, 8, 4, 9]; // 3 and 9 and their cuts 8 and 4
const selectedDp = dpPanels.filter(p => familySuttas.includes(getSutta(p)));

console.log('Total DP panels in system:', dpPanels.length);
console.log('DP panels for Suttas 3, 8, 4, 9:', selectedDp.length);
console.log('Panels:', selectedDp);
console.log('Bet value if ₹25 each:', selectedDp.length * 25);
