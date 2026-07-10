const fs = require('fs')

// Load the cached data
const rawData = fs.readFileSync('scratch/records_2years.json', 'utf8')
const allRecords = JSON.parse(rawData)
const MARKETS = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar'
]
const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }

function getPanelKind(panel) {
  if (!panel || typeof panel !== 'string' || panel.length !== 3) return 'SP'
  if (panel[0] === panel[1] && panel[1] === panel[2]) return 'TP'
  if (panel[0] === panel[1] || panel[1] === panel[2] || panel[0] === panel[2]) return 'DP'
  return 'SP'
}

function analyzeWeekdayDP() {
  console.log('\n--- C1. Weekday Patterns ---')
  const weekdayCounts = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }
  const weekdayDPs = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }
  
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    for (const r of records) {
      if (!weekdayCounts[r.day]) continue
      weekdayCounts[r.day] += 2
      if (getPanelKind(r.openPanel) === 'DP') weekdayDPs[r.day]++
      if (getPanelKind(r.closePanel) === 'DP') weekdayDPs[r.day]++
    }
  }
  
  for (const day of Object.keys(weekdayCounts)) {
    const rate = (weekdayDPs[day] / weekdayCounts[day]) * 100
    console.log(`${day.padEnd(10)}: ${rate.toFixed(2)}% DP Rate (Base: 24.4%)`)
  }
}

function analyzeJodiDoubles() {
  console.log('\n--- C6. Jodi Doubles -> Next Day Open Sutta ---')
  const suttaAfterDouble = Array(10).fill(0)
  let doubleCount = 0
  
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    for (let i = 0; i < records.length - 1; i++) {
      const r = records[i]
      const next = records[i+1]
      if (r.jodi && r.jodi.length === 2 && r.jodi[0] === r.jodi[1] && next.openSutta >= 0) {
        suttaAfterDouble[next.openSutta]++
        doubleCount++
      }
    }
  }
  
  console.log(`Total Jodi Doubles observed: ${doubleCount}`)
  for (let i = 0; i < 10; i++) {
    const rate = (suttaAfterDouble[i] / doubleCount) * 100
    console.log(`Sutta ${i}: ${rate.toFixed(2)}% (Random: 10%)`)
  }
}

function analyzeDigitCleanClose() {
  console.log('\n--- C9. Open->Close Digit Carry (Clean Close) ---')
  let cleanCount = 0, cleanDP = 0
  let sharedCount = 0, sharedDP = 0
  
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    const last90 = records.slice(-90) // Test on last 90 days
    for (const r of last90) {
      if (!r.openPanel || !r.closePanel || r.openPanel.length !== 3 || r.closePanel.length !== 3) continue
      
      const openDigits = new Set(r.openPanel.split(''))
      const closeDigits = new Set(r.closePanel.split(''))
      const intersection = new Set([...openDigits].filter(x => closeDigits.has(x)))
      
      const isCloseDP = getPanelKind(r.closePanel) === 'DP'
      if (intersection.size === 0) {
        cleanCount++
        if (isCloseDP) cleanDP++
      } else {
        sharedCount++
        if (isCloseDP) sharedDP++
      }
    }
  }
  
  console.log(`Last 90 Days:`)
  console.log(`Clean Close (0 shared digits) DP Rate: ${((cleanDP / cleanCount) * 100).toFixed(2)}% (N=${cleanCount})`)
  console.log(`Shared Close (1+ shared digits) DP Rate: ${((sharedDP / sharedCount) * 100).toFixed(2)}% (N=${sharedCount})`)
}

function findTopAnomalies() {
  console.log('\n--- D5. Anomaly Detection (Extreme events) ---')
  // We'll look for TP (Triple Pannas) since they are super rare.
  const tps = []
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    const last30 = records.slice(-30)
    for (const r of last30) {
      if (getPanelKind(r.openPanel) === 'TP') tps.push({market, day: r.day, side: 'open', panel: r.openPanel})
      if (getPanelKind(r.closePanel) === 'TP') tps.push({market, day: r.day, side: 'close', panel: r.closePanel})
    }
  }
  console.log(`Found ${tps.length} Triples in the last 30 days:`)
  tps.forEach(t => console.log(`- ${t.market} ${t.day} ${t.side}: ${t.panel}`))
}

analyzeWeekdayDP()
analyzeJodiDoubles()
analyzeDigitCleanClose()
findTopAnomalies()
