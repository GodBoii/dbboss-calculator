const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'scratch', 'live-freshness-check-output.json');
const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

console.log('Generated At:', reportData.generatedAt);
console.log('\n--- Market Freshness Report ---');
reportData.report.forEach(m => {
  if (m.error) {
    console.log(`${m.market}: ERROR - ${m.error}`);
  } else {
    console.log(`${m.market}: Cache Newest = ${m.cachedNewest} | Live Newest = ${m.liveNewest} | Fresh Rows = ${m.freshCount}`);
    if (m.freshCount > 0) {
      console.log('  Fresh Rows:');
      m.freshRows.forEach(r => {
        console.log(`    ${r.isoDate} (${r.day}) Open: ${r.openPanel} | Close: ${r.closePanel} | Jodi: ${r.jodi}`);
      });
    }
  }
});
