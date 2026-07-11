const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('advanced_predictions_') && f.endsWith('.json'));
if (files.length === 0) {
  console.log('No prediction files found');
  process.exit(1);
}

files.sort();
const latestFile = path.join(dataDir, files[files.length - 1]);
console.log('Loading latest predictions file:', latestFile);

const data = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
const milanNightPred = data.find(m => m.market === 'Milan Night');

if (!milanNightPred) {
  console.log('Milan Night predictions not found in the JSON file');
  process.exit(1);
}

console.log('=== MILAN NIGHT PREDICTIONS CONTEXT ===');
console.log('Market:', milanNightPred.market);
console.log('Volume Tier:', milanNightPred.volume_tier);
console.log('Temporal Multiplier:', milanNightPred.temporal_multiplier);
console.log('Liquidity Multiplier:', milanNightPred.liquidity_multiplier);
console.log('Honey-Pot Alert:', milanNightPred.honey_pot_alert);
console.log('Sutta Droughts:', JSON.stringify(milanNightPred.sutta_droughts, null, 2));
console.log('Saturated Suttas:', milanNightPred.saturated_suttas);

console.log('\n=== TOP 20 PICKS FOR MILAN NIGHT OPEN ===');
milanNightPred.top_picks.slice(0, 20).forEach((pick, idx) => {
  console.log(`${idx + 1}. Panel: ${pick.panel} | Sutta: ${pick.sutta} | Score: ${pick.score.toFixed(2)} | HoneyPot: ${pick.is_honey_pot_pick}`);
});
