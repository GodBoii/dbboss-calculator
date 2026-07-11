const { exec } = require('child_process');
const fs = require('fs');

console.log('Fetching Sridevi Night panel chart live...');
exec('curl -s https://dpbossss.boston/panel-chart-record/sridevi-night.php', (err, stdout, stderr) => {
  if (err) {
    console.error('Error fetching:', err);
    return;
  }
  
  // Let's find the last few rows of the table
  const lines = stdout.split('\n');
  const tableRows = [];
  lines.forEach(l => {
    if (l.includes('<tr>') || l.includes('</tr>') || l.includes('<td>')) {
      tableRows.push(l.trim());
    }
  });
  
  console.log('Table elements found: ' + tableRows.length);
  // Write to a temporary text file so we can view it
  fs.writeFileSync('scratch/sridevi_night_raw.txt', tableRows.join('\n'));
  console.log('Saved raw HTML elements to scratch/sridevi_night_raw.txt');
});
