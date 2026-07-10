const fs = require('fs')

// Load the cached data
const rawData = fs.readFileSync('scratch/records_2years.json', 'utf8')
const allRecords = JSON.parse(rawData)

// We have 11 markets:
const MARKETS = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar'
] // Oh wait, that's 12 markets. The prompt said 11, but listed 12 in the text:
// Day: Sridevi, Time Bazar, Madhur Day, Milan Day, Rajdhani Day, Kalyan (6)
// Night: Sridevi Night, Kalyan Night, Madhur Night, Milan Night, Rajdhani Night, Main Bazar (6) -> Total 12

function getPanelKind(panel) {
  if (!panel || typeof panel !== 'string' || panel.length !== 3) return 'SP'
  if (panel[0] === panel[1] && panel[1] === panel[2]) return 'TP'
  if (panel[0] === panel[1] || panel[1] === panel[2] || panel[0] === panel[2]) return 'DP'
  return 'SP'
}

function analyzeDPFrequency(allRecords) {
  console.log('\n--- DP Frequency Analysis ---')
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    if (!records.length) continue
    
    // Split into last 30 days vs rest (since July 2024 is ~2 years = 730 days)
    // Actually, we can just sort by date.
    records.sort((a, b) => a.isoDate > b.isoDate ? 1 : -1)
    
    const last30 = records.slice(-30)
    
    let totalOpenDP = 0, totalCloseDP = 0
    records.forEach(r => {
      if (getPanelKind(r.openPanel) === 'DP') totalOpenDP++
      if (getPanelKind(r.closePanel) === 'DP') totalCloseDP++
    })
    
    let last30OpenDP = 0, last30CloseDP = 0
    last30.forEach(r => {
      if (getPanelKind(r.openPanel) === 'DP') last30OpenDP++
      if (getPanelKind(r.closePanel) === 'DP') last30CloseDP++
    })
    
    const overallRate = ((totalOpenDP + totalCloseDP) / (records.length * 2)) * 100
    const last30Rate = ((last30OpenDP + last30CloseDP) / (last30.length * 2)) * 100
    
    console.log(`${market.padEnd(15)} | 2yr DP rate: ${overallRate.toFixed(1)}% | Last 30d DP rate: ${last30Rate.toFixed(1)}%`)
  }
}

function analyzeDailyClustering(allRecords) {
  console.log('\n--- Daily DP Clustering (Last 30 Days) ---')
  // Group by date across all markets
  const byDate = {}
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    const last30 = records.slice(-30)
    for (const r of last30) {
      // Need isoDate. Wait, it's not saved. We need to calculate it or just use the index if they're strictly aligned.
      // We didn't save isoDate in the cache! We just saved the raw panel records.
      // Let's rely on dateRangeStart and day.
      const dateKey = `${r.dateRangeStart}|${r.day}`
      if (!byDate[dateKey]) byDate[dateKey] = 0
      if (getPanelKind(r.openPanel) === 'DP') byDate[dateKey]++
      if (getPanelKind(r.closePanel) === 'DP') byDate[dateKey]++
    }
  }
  
  let pureSPDays = 0
  let hotDays = 0 // 4+ DPs
  const counts = Object.values(byDate)
  for (const c of counts) {
    if (c === 0) pureSPDays++
    if (c >= 4) hotDays++
  }
  console.log(`Out of ${counts.length} days: Pure SP days (0 DPs) = ${pureSPDays}, Hot days (4+ DPs) = ${hotDays}`)
}

function markovChain(allRecords) {
  console.log('\n--- Sutta Markov Chain (All Markets, 2 years) ---')
  const transitions = Array(10).fill(0).map(() => Array(10).fill(0))
  const counts = Array(10).fill(0)
  
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      if (r.openSutta >= 0 && r.closeSutta >= 0) {
        transitions[r.openSutta][r.closeSutta]++
        counts[r.openSutta]++
      }
      if (i < records.length - 1) {
        const next = records[i+1]
        if (r.closeSutta >= 0 && next.openSutta >= 0) {
          transitions[r.closeSutta][next.openSutta]++
          counts[r.closeSutta]++
        }
      }
    }
  }
  
  // Calculate entropy per state
  let totalEntropy = 0
  for (let i = 0; i < 10; i++) {
    let entropy = 0
    if (counts[i] > 0) {
      for (let j = 0; j < 10; j++) {
        if (transitions[i][j] > 0) {
          const p = transitions[i][j] / counts[i]
          entropy -= p * Math.log2(p)
        }
      }
    }
    console.log(`Sutta ${i} -> Entropy: ${entropy.toFixed(3)}`)
    totalEntropy += entropy
  }
  console.log(`Average Sutta Entropy: ${(totalEntropy/10).toFixed(3)} (Max=3.32)`)
}

function calculateEntropyPerMarket(allRecords) {
  console.log('\n--- Shannon Entropy Per Market ---')
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    const counts = Array(10).fill(0)
    let total = 0
    for (const r of records) {
      if (r.openSutta >= 0) { counts[r.openSutta]++; total++; }
      if (r.closeSutta >= 0) { counts[r.closeSutta]++; total++; }
    }
    let entropy = 0
    for (let i = 0; i < 10; i++) {
      if (counts[i] > 0) {
        const p = counts[i] / total
        entropy -= p * Math.log2(p)
      }
    }
    console.log(`${market.padEnd(15)} | Entropy: ${entropy.toFixed(3)}`)
  }
}

analyzeDPFrequency(allRecords)
analyzeDailyClustering(allRecords)
markovChain(allRecords)
calculateEntropyPerMarket(allRecords)
