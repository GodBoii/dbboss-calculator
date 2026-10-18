/* eslint-disable @typescript-eslint/no-require-imports */
// Frozen, chronological before/after replay. Never refits or selects models.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { fork } = require('node:child_process')
process.env.TZ = 'Asia/Kolkata'
require('../research/dp_panel_v3/ts-loader.cjs')
const { getRecordISODate } = require('../src/lib/db.ts')
const { historicalCutoffISO } = require('../src/lib/prediction-contract.ts')
const { HIGH_VOLUME_MARKETS, analyzeMarket, calculateSutta } = require('../src/lib/predictor.ts')
const { buildOpenSuttaRanking, buildCloseSuttaRanking } = require('../src/lib/sutta-model/production.ts')
const { buildCombinedAnalysis } = require('../src/lib/combined-prediction.ts')
const dir = path.resolve(__dirname, '../backtest_reports/2026-10-18/reliability')
const snapshotPath = path.join(dir, 'source.json')
const through = '2026-10-17'
const start = '2026-04-21' // 180 calendar days inclusive, shared by all markets.
const windows = [7, 30, 90, 180]
const shift = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

async function freeze() {
  if (fs.existsSync(snapshotPath)) throw new Error('Frozen source already exists; refusing to overwrite it')
  const { GET } = require('../src/app/api/scrape/route.ts')
  const { NextRequest } = require('next/server')
  const markets = {}, audits = {}
  for (const market of HIGH_VOLUME_MARKETS) {
    const slug = market.toLowerCase().replaceAll(' ', '-')
    const url = `https://dpboss.tax/panel-chart-record/${slug}.php`
    const response = await GET(new NextRequest(`https://localhost/api/scrape?market=${encodeURIComponent(market)}&url=${encodeURIComponent(url)}`))
    const body = await response.json()
    if (!response.ok || !body.panels?.length) throw new Error(`${market}: ${body.error || 'empty source'}`)
    markets[market] = body.panels.map(p => ({...p, id: `${p.market}|${p.dateRangeStart}|${p.day}`, savedAt: Date.parse(body.scrapedAt)}))
      .filter(p => { const iso = getRecordISODate(p); return iso && iso <= through })
      .sort((a,b) => getRecordISODate(a).localeCompare(getRecordISODate(b)))
    audits[market] = body.historySources
    console.log(`Frozen ${market}: ${markets[market].length} rows`)
  }
  fs.mkdirSync(dir, {recursive:true})
  fs.writeFileSync(snapshotPath, JSON.stringify({through, fetchedAt: new Date().toISOString(), markets, audits}))
}

function replay(market) {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath))
  const records = snapshot.markets[market]
  const events = []
  for (const actual of records) {
    const iso = getRecordISODate(actual)
    if (iso < start || !actual.openPanel || !actual.closePanel) continue
    const cutoff = historicalCutoffISO(iso)
    const all = Object.fromEntries(Object.entries(snapshot.markets).map(([name,rows]) => [name, rows.filter(r => {
      const d = getRecordISODate(r); return d >= cutoff && d < iso
    })]))
    const prior = all[market]
    if (prior.length < 180) throw new Error(`${market}/${iso}: insufficient training history`)
    const date = new Date(`${iso}T12:00:00+05:30`)
    const v1 = analyzeMarket(market, prior, all, date, {knownOpenPanel:null})
    const v1Known = analyzeMarket(market, prior, all, date, {knownOpenPanel:actual.openPanel})
    const pre = buildCombinedAnalysis(market, prior, all, date)
    const known = buildCombinedAnalysis(market, prior, all, date, calculateSutta(actual.openPanel), actual.openPanel)
    if (!v1 || !v1Known || pre.status !== 'ready' || known.status !== 'ready') throw new Error(`${market}/${iso}: unavailable prediction`)
    const suttaOpen = buildOpenSuttaRanking(v1.openPicks,v1.openSuttaDroughts,prior,market,date,all)
    const suttaClose = buildCloseSuttaRanking(v1.closePicks,v1.closeSuttaDroughts,prior,market,null,all,date)
    const os = calculateSutta(actual.openPanel), cs = calculateSutta(actual.closePanel)
    function score(open, close, liveClose, op, cl, adj, dpOpen, dpClose) {
      const open6 = op.slice(0,6).map(p=>p.sutta), close6 = cl.slice(0,6).map(p=>p.sutta), adj6 = adj.slice(0,6).map(p=>p.sutta)
      return {open10:open.slice(0,10).some(p=>p.panel===actual.openPanel),close10:close.slice(0,10).some(p=>p.panel===actual.closePanel),
        liveClose10:liveClose.slice(0,10).some(p=>p.panel===actual.closePanel),open6:open6.includes(os),close6:close6.includes(cs),
        liveClose6:adj6.includes(cs),jodi36:open6.includes(os)&&close6.includes(cs),liveJodi36:open6.includes(os)&&adj6.includes(cs),
        dpOpen20:dpOpen.slice(0,20).some(p=>p.panel===actual.openPanel),dpClose20:dpClose.slice(0,20).some(p=>p.panel===actual.closePanel),
        listsHash:hash(JSON.stringify([open.map(p=>p.panel),close.map(p=>p.panel),liveClose.map(p=>p.panel),open6,close6,adj6,dpOpen.map(p=>p.panel),dpClose.map(p=>p.panel)]))}
    }
    events.push({market,date:iso,actualOpen:actual.openPanel,actualClose:actual.closePanel,
      v1:score(v1.openPanelPicks,v1.closePanelPicks,v1Known.closePanelPicks,suttaOpen,suttaClose,suttaClose,v1.openDpPicks,v1.closeDpPicks),
      v2:score(pre.open.panelPicks,pre.close.panelPicks,known.close.panelPicks,pre.open.suttas,pre.close.suttas,known.close.suttas,pre.open.dpPicks,pre.close.dpPicks)})
  }
  return events
}

async function run(label) {
  const allEvents = []
  let next = 0
  async function consume() {
    while (next < HIGH_VOLUME_MARKETS.length) {
      const market = HIGH_VOLUME_MARKETS[next++]
      const events = await new Promise((resolve,reject) => {
        const child = fork(__filename, ['worker',market], {stdio:['ignore','inherit','inherit','ipc']})
        let result
        child.on('message',value => result = value)
        child.on('error',reject)
        child.on('exit',code => code === 0 && result ? resolve(result) : reject(new Error(`${market} replay failed: ${code}`)))
      })
      allEvents.push(...events)
      console.log(`${label}: ${market}, ${events.length} evaluated draws`)
    }
  }
  await Promise.all(Array.from({length:3},consume))
  allEvents.sort((a,b)=>a.market.localeCompare(b.market)||a.date.localeCompare(b.date))
  const summaries=[]
  for(const market of HIGH_VOLUME_MARKETS)for(const version of ['v1','v2'])for(const days of windows){
    const rows=allEvents.filter(e=>e.market===market&&e.date>=shift(through,1-days))
    const hits=Object.fromEntries(Object.keys(rows[0]?.[version]??{}).filter(k=>k!=='listsHash').map(k=>[k,rows.reduce((sum,r)=>sum+Number(r[version][k]),0)]))
    summaries.push({market,version,days,n:rows.length,hits,rates:Object.fromEntries(Object.entries(hits).map(([k,n])=>[k,rows.length?100*n/rows.length:0]))})
  }
  const result={label,through,start,sourceSHA256:hash(fs.readFileSync(snapshotPath)),timezone:'Asia/Kolkata',panelCount:10,suttaCount:6,
    notes:'Retrospective replay of existing fitted models; live Close receives only its own declared Open. Same frozen raw source and outcomes before/after. Windows use calendar days, not number of draws.',summaries,events:allEvents}
  fs.writeFileSync(path.join(dir,`${label}.json`),JSON.stringify(result))
  if(label==='after')writeComparison(result)
}

function writeComparison(result) {
    const {summaries,events:allEvents} = result
    const before=JSON.parse(fs.readFileSync(path.join(dir,'before.json')))
    if(before.sourceSHA256!==result.sourceSHA256)throw new Error('Source changed between replays')
    const changes=summaries.map((row,i)=>({...row,deltaHits:Object.fromEntries(Object.keys(row.hits).map(k=>[k,row.hits[k]-before.summaries[i].hits[k]]))}))
    const changedLists=allEvents.filter((row,i)=>row.v1.listsHash!==before.events[i].v1.listsHash||row.v2.listsHash!==before.events[i].v2.listsHash).length
    fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify({sourceSHA256:result.sourceSHA256,changedLists,changes},null,2))
    const lines=['# Reliability repair accuracy comparison','',result.notes,'',`Through ${through} IST. Changed forecast sets: ${changedLists}. N/A means no completed source outcomes were available in that calendar window; it is not zero accuracy.`,'','| Market | Model | Days | Draws | Open 10 | Close 10 | Live Close 10 | Open 6 | Close 6 | Jodi 36 |','|---|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    for(const row of changes)lines.push(`| ${row.market} | ${row.version} | ${row.days} | ${row.n} | ${['open10','close10','liveClose10','open6','close6','jodi36'].map(k=>row.n ? `${row.hits[k]}/${row.n} (${row.deltaHits[k]>=0?'+':''}${row.deltaHits[k]})` : 'N/A').join(' | ')} |`)
    fs.writeFileSync(path.join(dir,'comparison.md'),lines.join('\n')+'\n')
    console.log(`Comparison written: ${changedLists} changed forecast sets`)
}

const mode=process.argv[2]
if(mode==='worker'){process.send(replay(process.argv[3]));process.disconnect()}
else (mode==='report'?Promise.resolve().then(()=>writeComparison(JSON.parse(fs.readFileSync(path.join(dir,'after.json'))))):mode==='freeze'?freeze():run(mode||'before')).catch(error=>{console.error(error);process.exitCode=1})
