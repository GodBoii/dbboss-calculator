/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
require('../research/dp_panel_v3/ts-loader.cjs')

async function main() {
  const { parsePanelDate, getRecordISODate, normalizeRecords } = require('../src/lib/db.ts')
  const { indiaISODate, indiaWeekday, indiaDayOfMonth } = require('../src/lib/india-time.ts')
  const { findDeclaredOpenPanel } = require('../src/lib/predictor/panel-top10-model.ts')
  const { buildV2OpenRanking } = require('../src/lib/sutta-model/v2-recency.ts')
  const row = {market:'Madhur Day',dateRangeStart:'24/06/2024',dateRangeEnd:'30/06/2024',day:'Monday',openPanel:'478',openSutta:9,jodi:'90',closePanel:'569',closeSutta:0,id:'old-id',savedAt:1234}
  for(const invalid of ['31/02/2026','01/13/2026','x/02/2026','01/02/2026junk'])assert.equal(parsePanelDate(invalid),null)
  assert.equal(getRecordISODate({...row,day:'Day8'}),null)
  assert.equal(parsePanelDate('29-02-24').toISOString().slice(0,10),'2024-02-29')
  const normalized=normalizeRecords([row,{...row,dateRangeStart:'24-06-2024',id:'another'}],'Madhur Day')
  assert.equal(normalized.length,1)
  assert.equal(normalized[0].id,'Madhur Day|2024-06-24')
  assert.throws(()=>normalizeRecords([row,{...row,openPanel:'123'}],'Madhur Day'),/Conflicting Madhur Day history on 2024-06-24/)
  assert.throws(()=>normalizeRecords([{...row,market:'Kalyan'}],'Madhur Day'),/market/i)
  assert.throws(()=>normalizeRecords([{...row,openPanel:'874'}],'Madhur Day'),/panel/i)
  const corrected=normalizeRecords([{...row,jodi:'99',openSutta:0}],'Madhur Day')[0]
  assert.equal(corrected.jodi,'90');assert.equal(corrected.openSutta,9);assert.equal(corrected.sourceJodi,'99')
  const partial={...row,closePanel:'',closeSutta:-1,jodi:''}
  assert.equal(normalizeRecords([partial,row],'Madhur Day')[0].closePanel,'569')
  assert.equal(findDeclaredOpenPanel([partial],new Date('2026-10-18T12:00:00+05:30')),null)
  const instant=new Date('2026-10-17T19:00:00Z')
  for(const tz of ['Asia/Kolkata','America/Los_Angeles','Pacific/Kiritimati']){
    process.env.TZ=tz
    assert.equal(indiaISODate(instant),'2026-10-18');assert.equal(indiaWeekday(instant),'Sunday');assert.equal(indiaDayOfMonth(instant),18)
  }
  process.env.TZ='Asia/Kolkata'
  const source=JSON.parse(fs.readFileSync('backtest_reports/2026-10-18/reliability/source.json'))
  const records=source.markets.Sridevi
  const target=new Date('2026-10-18T12:00:00+05:30')
  const expected=buildV2OpenRanking(records,'Sridevi',target)
  const wrongJodi=records.map(r=>({...r,jodi:'99'}))
  assert.deepEqual(buildV2OpenRanking(wrongJodi,'Sridevi',target),expected,'Sutta must derive from panels, not a contradictory Jodi')
  const { buildCombinedAnalysis } = require('../src/lib/combined-prediction.ts')
  const forecast = tz => { process.env.TZ=tz;const a=buildCombinedAnalysis('Sridevi',records,source.markets,target,0);assert.equal(a.status,'ready');return [a.targetDate,a.prediction.analysisDayName,a.open.panelPicks,a.close.panelPicks,a.open.suttas,a.close.suttas,a.open.dpPicks,a.close.dpPicks] }
  const india=forecast('Asia/Kolkata')
  for(const tz of ['America/Los_Angeles','Pacific/Kiritimati','UTC'])assert.deepEqual(forecast(tz),india,`Full V2 forecast changed in ${tz}`)
  process.env.TZ='Asia/Kolkata'
  const completeToday={...records.at(-1),id:'today',dateRangeStart:'12/10/2026',day:'Sunday'}
  const withToday=[...records,completeToday]
  const { analyzeMarket } = require('../src/lib/predictor.ts')
  const advanced=analyzeMarket('Sridevi',withToday,{...source.markets,Sridevi:withToday},target)
  assert.equal(indiaISODate(new Date(advanced.analysisDateISO)),'2026-10-19')
  assert.equal(advanced.analysisAsOfISO,target.toISOString())
  assert.equal(buildCombinedAnalysis('Sridevi',withToday,source.markets,target).targetDate,'2026-10-19')
  assert.equal(buildCombinedAnalysis('Sridevi',withToday,source.markets,target,0).targetDate,'2026-10-18','A declared Open targets the requested date, not the advanced date')
  const handlers={}
  const sandbox={self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn},URL,Response,console,
    fetch:async()=>{throw new Error('Offline')},caches:{match:async()=>new Response('{"panels":[],"scrapedAt":"2020-01-01"}')}}
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync('public/sw.js','utf8'),sandbox)
  let response
  handlers.fetch({request:{method:'GET',url:'https://example.test/api/scrape?market=Sridevi',mode:'cors'},respondWith:p=>response=p})
  await assert.rejects(response,/Offline/,'A fresh scrape must never be replaced with cached API data')
  const before=JSON.parse(fs.readFileSync('backtest_reports/2026-10-18/reliability/before.json'))
  const after=JSON.parse(fs.readFileSync('backtest_reports/2026-10-18/reliability/after.json'))
  assert.equal(before.sourceSHA256,after.sourceSHA256)
  assert.equal(after.summaries.length,96)
  assert.deepEqual(after.summaries,before.summaries,'A hit count, accuracy, or denominator changed in the frozen replay')
  assert.deepEqual(after.events.map(e=>[e.market,e.date,e.actualOpen,e.actualClose]),before.events.map(e=>[e.market,e.date,e.actualOpen,e.actualClose]))
  assert.deepEqual(after.events.map(e=>e.v2),before.events.map(e=>e.v2),'V2 changed on identical frozen inputs')
  console.log('All 96 before/after accuracy combinations and all V2 forecast fingerprints match.')
  console.log('Reliability boundaries passed: dates, identity, duplicates, conflicts, partials, Jodi, stale Open, IST, and service-worker freshness.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
