const fs = require('fs');

async function main() {
  const url = 'https://dpbossss.boston/';
  console.log('Fetching homepage:', url);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      console.log('Failed to fetch:', response.status);
      return;
    }
    const html = await response.text();
    fs.writeFileSync('scratch/homepage.html', html);
    console.log('Saved homepage to scratch/homepage.html');
    
    // Look for Milan Day in the html
    const lines = html.split('\n');
    console.log('\n--- Lines containing Milan ---');
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes('milan')) {
        console.log(`Line ${idx}: ${line.trim()}`);
      }
    });
  } catch (error) {
    console.error('Error fetching homepage:', error);
  }
}

main();
