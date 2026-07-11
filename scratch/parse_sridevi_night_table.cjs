const fs = require('fs');

const raw = fs.readFileSync('scratch/sridevi_night_raw.txt', 'utf8');
// Sridevi Night has table rows. Let's find rows containing 06/07/2026
const rows = raw.split('<tr>');
console.log(`Total rows in raw text: ${rows.length}`);

for (const row of rows) {
  if (row.includes('06/07/2026') || row.includes('06-07-2026')) {
    console.log('--- FOUND WEEK ROW ---');
    // Extract tds
    const tds = row.split('<td>').map(t => t.replace(/<\/td>/g, '').replace(/<\/tr>/g, '').trim());
    console.log('Columns count:', tds.length);
    tds.forEach((td, idx) => {
      console.log(`Col ${idx}: ${td}`);
    });
  }
}
