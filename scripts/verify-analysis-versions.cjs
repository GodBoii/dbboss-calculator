/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const fs = require("node:fs")
const crypto = require("node:crypto")
const path = require("node:path")
require("../research/dp_panel_v3/ts-loader.cjs")
const { analyzeMarket, computeJodiAnalysis, buildContextFromResult, ALL_PANELS, calculateSutta } = require("../src/lib/predictor.ts")
const { buildOpenSuttaRanking, buildCloseSuttaRanking, buildJodis } = require("../src/lib/sutta-model/production.ts")
const { historicalCutoffISO } = require("../src/lib/prediction-contract.ts")
const { buildCombinedAnalysis } = require("../src/lib/combined-prediction.ts")
const { runMarketBacktest } = require("../src/lib/backtest.ts")

const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/analysis-v1-baseline.json"))).cases
const reference = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/analysis-combined-baseline.json")))
const source = fs.readFileSync(path.join(__dirname, "..", reference.source), "utf8").replace(/\r\n/g, "\n")
assert.equal(crypto.createHash("sha256").update(source).digest("hex"), reference.sourceLF_SHA256, "Frozen source data changed")
const legal = new Set(ALL_PANELS)
const byKey = new Map()
for (const line of source.trim().split("\n").slice(1)) {
  const [date, market, open, close] = line.split(",")
  if (!legal.has(open) || !legal.has(close)) continue
  const monday = new Date(`${date}T00:00:00Z`)
  const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][monday.getUTCDay()]
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
  const start = `${String(monday.getUTCDate()).padStart(2,"0")}/${String(monday.getUTCMonth()+1).padStart(2,"0")}/${monday.getUTCFullYear()}`
  const record = {id:`${market}|${start}|${day}`,market,dateRangeStart:start,dateRangeEnd:date,day,openPanel:open,closePanel:close,openSutta:calculateSutta(open),closeSutta:calculateSutta(close),jodi:`${calculateSutta(open)}${calculateSutta(close)}`,savedAt:0}
  const key = `${market}|${date}`
  if (byKey.has(key)) assert.deepEqual(byKey.get(key).record,record)
  byKey.set(key,{date,market,open,close,record})
}
const events = [...byKey.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.market.localeCompare(b.market))

function histories(date) {
  const out = {}
  for (const event of events) if (event.date < date && event.date >= historicalCutoffISO(date)) (out[event.market] ??= []).push(event.record)
  return out
}

function expected(row, channel, task) {
  const match = reference.cases.find(c=>c.market===row.market&&c.date===row.date)
  assert(match, "Missing frozen combined case")
  return match.channels[channel][task]
}

let parity = 0
for (const fixture of fixtures) {
  const all = histories(fixture.date), prior = all[fixture.market]
  const actual = events.find(e=>e.market===fixture.market&&e.date===fixture.date)
  const date = new Date(`${fixture.date}T12:00:00+05:30`)
  const prediction = analyzeMarket(fixture.market,prior,all,date)
  const adjusted = computeJodiAnalysis(actual.record.openSutta,actual.open,prior,buildContextFromResult(prediction),prediction.closeDpKindContext)
  const payload = {prediction,adjusted,open:buildOpenSuttaRanking(prediction.openPicks,prediction.openSuttaDroughts,prior,fixture.market,date,all),close:buildCloseSuttaRanking(prediction.closePicks,prediction.closeSuttaDroughts,prior,fixture.market,null,all,date)}
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),fixture.sha256,`V1 changed: ${fixture.market}/${fixture.date}`)
  const before = JSON.stringify({ prior, all })
  const row = fixture
  const pre = buildCombinedAnalysis(fixture.market,prior,all,date)
  const known = buildCombinedAnalysis(fixture.market,prior,all,date,actual.record.openSutta,actual.open)
  assert.equal(pre.status,'ready'); assert.equal(known.status,'ready')
  for (const [side,channel,analysis] of [['open','open',pre],['close','close_pre',pre],['close','close_known',known]]) {
    for(const [field,task] of [['panelPicks','all10'],['spPicks','sp30'],['dpPicks','dp20']]) {
      assert.deepEqual(analysis[side][field].map(p=>p.panel),expected(row,channel,task),`${fixture.market}/${channel}/${task} differs from frozen research`)
      assert.equal(new Set(analysis[side][field].map(p=>p.panel)).size,analysis[side][field].length)
      parity++
    }
    assert.equal(new Set(analysis[side].suttas.map(p=>p.sutta)).size,10)
    assert(Math.abs(analysis[side].suttas.reduce((s,p)=>s+p.probabilityPct,0)-100)<1e-8)
  }
  assert.deepEqual(pre.open,known.open,'Known Open affected the Open prediction')
  for(const count of [1,4,6,10])assert.equal(buildJodis(pre.open.suttas.slice(0,count),pre.close.suttas.slice(0,count)).length,count*count)
  assert.equal(JSON.stringify({prior,all}),before,'V2 mutated shared V1 inputs')
}
const sample=fixtures.find(f=>f.market==='Kalyan')
const all=histories(sample.date), prior=all.Kalyan, date=new Date(`${sample.date}T12:00:00+05:30`)
assert.equal(buildCombinedAnalysis('Kalyan',prior.slice(-50),all,date).status,'unavailable')
assert.equal(buildCombinedAnalysis('Kalyan',prior,all,date,12).status,'unavailable')
const poisoned=[...prior,{...prior[0],dateRangeStart:'01/01/2030',openPanel:'111',closePanel:'222',jodi:'36'}]
assert.deepEqual(buildCombinedAnalysis('Kalyan',prior,all,date),buildCombinedAnalysis('Kalyan',poisoned,all,date),'Future row changed V2')
const zero=buildCombinedAnalysis('Kalyan',prior,all,date,0)
assert.equal(zero.status,'ready');assert.equal(zero.knownOpenSutta,0)

// These hashes came from the exact pre-integration backtest implementation.
for(const fixture of JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/analysis-v1-baseline.json'))).backtests) {
  const history=histories(fixture.date)
  const report=runMarketBacktest(fixture.market,history[fixture.market],history,{days:fixture.days})
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(report)).digest('hex'),fixture.sha256,'V1 backtest changed')
}
console.log(`Passed: ${fixtures.length} unchanged V1 cases, ${parity} frozen V2 list comparisons, input immutability, future exclusion, Sutta 0, all copy counts, and original backtests.`)
