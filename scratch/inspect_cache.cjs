const d = require('./open-sutta-records-cache.json');
const markets = Object.keys(d);
console.log('Markets:', markets.length);
console.log(markets);

for (const m of markets.slice(0, 3)) {
  const recs = d[m];
  console.log(`\n${m}: ${recs.length} records`);
  const last3 = recs.slice(-3);
  for (const r of last3) {
    console.log(`  ${r.day} ${r.dateRangeStart} openSutta=${r.openSutta} closeSutta=${r.closeSutta} openPanel=${r.openPanel} closePanel=${r.closePanel}`);
  }
}
