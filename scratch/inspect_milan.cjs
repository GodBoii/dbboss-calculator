const fs = require('fs');
const d = require('./open-sutta-records-cache.json');

const milanDay = d['Milan Day'] || [];
const milanNight = d['Milan Night'] || [];

console.log('--- MILAN DAY LAST 20 RECORDS ---');
milanDay.slice(-20).forEach(r => {
  console.log(`${r.day} | ${r.dateRangeStart} | Open: ${r.openPanel}-${r.openSutta} | Close: ${r.closePanel}-${r.closeSutta} | Jodi: ${r.jodi}`);
});

console.log('\n--- MILAN NIGHT LAST 20 RECORDS ---');
milanNight.slice(-20).forEach(r => {
  console.log(`${r.day} | ${r.dateRangeStart} | Open: ${r.openPanel}-${r.openSutta} | Close: ${r.closePanel}-${r.closeSutta} | Jodi: ${r.jodi}`);
});
