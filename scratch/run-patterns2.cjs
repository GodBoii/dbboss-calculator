const fs = require('fs')

const rawData = fs.readFileSync('scratch/records_2years.json', 'utf8')
const allRecords = JSON.parse(rawData)
const MARKETS = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar'
]

function getPanelKind(panel) {
  if (!panel || typeof panel !== 'string' || panel.length !== 3) return 'SP'
  if (panel[0] === panel[1] && panel[1] === panel[2]) return 'TP'
  if (panel[0] === panel[1] || panel[1] === panel[2] || panel[0] === panel[2]) return 'DP'
  return 'SP'
}

function analyzeWeekdayDP() {
  console.log('\n--- C1. Weekday Patterns (Fixed) ---')
  const weekdayCounts = Array(7).fill(0)
  const weekdayDPs = Array(7).fill(0)
  
  for (const market of MARKETS) {
    const records = allRecords[market] || []
    for (const r of records) {
      // Find the day of the week from the isoDate
      if (!r.isoDate) {
        // Fallback or calculate if we have it? Wait, we filtered by isoDate but didn't save it in the object!
        // In the cache script, I only did `const iso = getRecordISODate(r)` but didn't attach it!
        // So I must parse dateRangeStart again.
      }
      const parts = r.dateRangeStart.split('To')[0].replace(/-/g, '/').split('/')
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10)
        let y = parseInt(parts[2], 10)
        if (y < 100) y += 2000
        const date = new Date(Date.UTC(y, m-1, d))
        
        let offset = 0
        const dayStr = String(r.day || '').toLowerCase()
        if (dayStr.includes('tue')) offset = 1
        else if (dayStr.includes('wed')) offset = 2
        else if (dayStr.includes('thu')) offset = 3
        else if (dayStr.includes('fri')) offset = 4
        else if (dayStr.includes('sat')) offset = 5
        else if (dayStr.includes('sun')) offset = 6
        
        date.setUTCDate(date.getUTCDate() + offset)
        const dayOfWeek = date.getUTCDay() // 0 is Sunday, 1 is Monday...
        
        weekdayCounts[dayOfWeek] += 2
        if (getPanelKind(r.openPanel) === 'DP') weekdayDPs[dayOfWeek]++
        if (getPanelKind(r.closePanel) === 'DP') weekdayDPs[dayOfWeek]++
      }
    }
  }
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (let i = 0; i < 7; i++) {
    const rate = (weekdayDPs[i] / weekdayCounts[i]) * 100
    console.log(`${days[i].padEnd(10)}: ${rate.toFixed(2)}% DP Rate (Base: 24.4%)`)
  }
}

analyzeWeekdayDP()
