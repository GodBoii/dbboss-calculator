const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'scratch', 'homepage.html');
if (!fs.existsSync(htmlPath)) {
  console.log('homepage.html not found');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Regex to capture: <h4>MARKET NAME</h4>\s*<span>RESULT</span>
// We need to account for multi-line spacing or classes on h4/span.
const regex = /<h4>([\s\S]*?)<\/h4>[\s\S]*?<span>([\s\S]*?)<\/span>/gi;

console.log('=== TODAY\'S LIVE RESULTS FROM HOMEPAGE ===');
let match;
const results = [];
while ((match = regex.exec(html)) !== null) {
  const market = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const result = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (market && result && result.includes('-')) {
    results.push({ market, result });
  }
}

// Print results in a nice table
results.forEach(r => {
  console.log(`${r.market.padEnd(30)} | ${r.result}`);
});
