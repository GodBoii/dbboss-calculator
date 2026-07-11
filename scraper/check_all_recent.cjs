const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data');
const files = fs.readdirSync(csvPath).filter(f => f.startsWith('panel_data_') && f.endsWith('.csv'));
files.sort();
const latestFile = path.join(csvPath, files[files.length - 1]);

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

const nightMarkets = ['Sridevi Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar'];
const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Day9', 'Day10', 'Day12', 'Day13', 'Day15', 'Day16', 'Day18', 'Day19', 'Day21'];

console.log('--- RECENT NIGHT DRAW LATEST ENTRIES ---');
for (const market of nightMarkets) {
  const recs = records.filter(r => r.market === market);
  console.log(`\nMarket: ${market} (${recs.length} records)`);
  const last5 = recs.slice(-6);
  last5.forEach(r => {
    const sum = r.panel.split('').map(Number).reduce((a, b) => a + b, 0);
    const sutta = sum % 10;
    console.log(`  ${r.day} | ${r.date_range_start} | Panel: ${r.panel} (Sutta: ${sutta})`);
  });
}
