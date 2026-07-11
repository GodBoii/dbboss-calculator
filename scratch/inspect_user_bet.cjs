const userBetPanels = [
  '112', '113', '117', '110', '122', '133', '177', '100', '224', '226', '229', '244', '266', '299', '334', '336', '339', '344', '366', '399', '447', '440', '477', '400', '667', '660', '677', '600', '779', '799', '990', '900'
];

function getSutta(panelStr) {
  const sum = panelStr.split('').map(Number).reduce((a, b) => a + b, 0);
  return sum % 10;
}

function getRepeatedDigit(panelStr) {
  const chars = panelStr.split('');
  if (chars[0] === chars[1]) return chars[0];
  if (chars[1] === chars[2]) return chars[1];
  if (chars[0] === chars[2]) return chars[0];
  return null;
}

function getOtherDigit(panelStr) {
  const chars = panelStr.split('');
  const rep = getRepeatedDigit(panelStr);
  if (rep === null) return null;
  return chars.find(c => c !== rep) || rep;
}

console.log('Total panels count:', userBetPanels.length);

const suttasCount = {};
const repeatedDigitsCount = {};
const otherDigitsCount = {};

const panelInfo = userBetPanels.map(p => {
  const sutta = getSutta(p);
  const rep = getRepeatedDigit(p);
  const other = getOtherDigit(p);
  
  suttasCount[sutta] = (suttasCount[sutta] || 0) + 1;
  repeatedDigitsCount[rep] = (repeatedDigitsCount[rep] || 0) + 1;
  otherDigitsCount[other] = (otherDigitsCount[other] || 0) + 1;
  
  return {
    panel: p,
    sutta,
    repeated: rep,
    other
  };
});

console.log('\n--- Panel details ---');
panelInfo.forEach(info => {
  console.log(`Panel: ${info.panel} | Sutta: ${info.sutta} | Repeated Digit: ${info.repeated} | Other Digit: ${info.other}`);
});

console.log('\n--- Sutta Frequencies ---');
console.log(suttasCount);

console.log('\n--- Repeated Digit Frequencies ---');
console.log(repeatedDigitsCount);

console.log('\n--- Other Digit Frequencies ---');
console.log(otherDigitsCount);
