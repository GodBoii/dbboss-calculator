const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'scratch', 'live-freshness-check-output.json');
const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const milanNightLive = reportData.liveRecords['Milan Night'] || [];
const milanDayLive = reportData.liveRecords['Milan Day'] || [];

console.log('--- Last 10 scraped live records for Milan Night ---');
milanNightLive.slice(-10).forEach(r => {
  console.log(`${r.day} | DateRange: ${r.dateRangeStart} to ${r.dateRangeEnd} | Open: ${r.openPanel} (${r.openSutta}) | Close: ${r.closePanel} (${r.closeSutta}) | Jodi: ${r.jodi}`);
});

console.log('\n--- Last 10 scraped live records for Milan Day ---');
milanDayLive.slice(-10).forEach(r => {
  console.log(`${r.day} | DateRange: ${r.dateRangeStart} to ${r.dateRangeEnd} | Open: ${r.openPanel} (${r.openSutta}) | Close: ${r.closePanel} (${r.closeSutta}) | Jodi: ${r.jodi}`);
});
