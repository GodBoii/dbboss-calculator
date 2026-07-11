const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'scratch', 'homepage.html');
if (!fs.existsSync(htmlPath)) {
  console.log('homepage.html not found');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const lines = html.split('\n');

console.log('--- Search Results for Milan ---');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('milan')) {
    console.log(`Line ${idx}: ${line.trim()}`);
    // Print 3 lines before and after
    for (let i = Math.max(0, idx - 3); i < Math.min(lines.length, idx + 4); i++) {
      console.log(`  [${i}] ${lines[i].trim()}`);
    }
    console.log('-----------------------------------');
  }
});
