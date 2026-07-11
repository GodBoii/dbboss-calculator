const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'scratch', 'homepage.html');
if (!fs.existsSync(htmlPath)) {
  console.log('homepage.html not found');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split('\n');

console.log('--- Search Results for SRIDEVI NIGHT ---');
lines.forEach((line, idx) => {
  if (line.toUpperCase().includes('SRIDEVI NIGHT')) {
    console.log(`Line ${idx}: ${line.trim()}`);
    // Print 5 lines after
    for (let i = idx + 1; i <= idx + 6; i++) {
      if (lines[i]) {
        console.log(`  [${i}] ${lines[i].trim()}`);
      }
    }
    console.log('-----------------------------------');
  }
});
