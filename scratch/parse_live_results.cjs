const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'scratch', 'homepage.html');
if (!fs.existsSync(htmlPath)) {
  console.log('homepage.html not found');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Regular expression to match results like 123-45-678 or 123-45 or similar
// Typically inside HTML tags, e.g. <h4>MILAN DAY</h4> ... <span>123-45-678</span>
// Let's write a regex that matches common market name structures and nearby result structures.
// A common structure is: 
// Market Name in uppercase, followed by some HTML, followed by 3 digits - 2 digits - 3 digits or similar.

console.log('--- Extracted Live Results ---');

// Let's search for lines containing 3-digit dashes
const lines = html.split('\n');
const resultsFound = [];

lines.forEach((line, idx) => {
  const cleanLine = line.replace(/<[^>]+>/g, ' ').trim();
  // Regex to look for patterns like 123-45-678 or 123-4 or 123-45 or similar
  const pattern = /\b\d{3}-\d{2}-\d{3}\b|\b\d{3}-\d{2}\b|\b\d{3}-\d\b|\b\d-\d{2}-\d{3}\b/g;
  if (pattern.test(cleanLine)) {
    // Print the line and the surrounding context
    resultsFound.push({
      lineIndex: idx,
      content: cleanLine,
      original: line.trim()
    });
  }
});

console.log(`Found ${resultsFound.length} lines with result-like patterns.`);

// Let's print the unique lines
const seen = new Set();
resultsFound.forEach(r => {
  const text = r.content.replace(/\s+/g, ' ');
  if (!seen.has(text) && text.length < 150) {
    seen.add(text);
    console.log(`[Line ${r.lineIndex}] ${text}`);
  }
});
