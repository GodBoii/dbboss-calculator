const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data');
const files = fs.readdirSync(csvPath).filter(f => f.startsWith('panel_data_') && f.endsWith('.csv'));
if (files.length === 0) {
  console.log('No panel data CSV files found in scraper/data/');
  process.exit(1);
}

// Get the latest file
files.sort();
const latestFile = path.join(csvPath, files[files.length - 1]);
console.log('Loading latest scraped file:', latestFile);

const content = fs.readFileSync(latestFile, 'utf8');
const lines = content.split('\n');
const headers = lines[0].split(',');

const records = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const parts = lines[i].split(',');
  if (parts.length < headers.length) continue;
  const rec = {};
  headers.forEach((h, idx) => {
    rec[h] = parts[idx];
  });
  records.push(rec);
}

const milanDay = records.filter(r => r.market === 'Milan Day');
const milanNight = records.filter(r => r.market === 'Milan Night');

console.log('\n--- MILAN DAY LATEST RECORDS IN SCRAPED CSV ---');
milanDay.slice(-10).forEach(r => {
  console.log(`${r.day} | ${r.date_range_start} | Panel: ${r.panel} | Sutta: ${r.sutta}`);
});

console.log('\n--- MILAN NIGHT LATEST RECORDS IN SCRAPED CSV ---');
milanNight.slice(-10).forEach(r => {
  console.log(`${r.day} | ${r.date_range_start} | Panel: ${r.panel} | Sutta: ${r.sutta}`);
});
