const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'scratch', 'homepage.html');
if (!fs.existsSync(htmlPath)) {
  console.log('homepage.html not found');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split('\n');

const start = 1220;
const end = 1320;

console.log(`--- Lines ${start} to ${end} ---`);
for (let i = start; i <= end; i++) {
  if (lines[i]) {
    console.log(`${i}: ${lines[i].trim()}`);
  }
}
