/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const fs = require("node:fs")
require("../research/dp_panel_v3/ts-loader.cjs")

const db = require("../src/lib/db.ts")
const { DAY_MARKETS, NIGHT_MARKETS, POOLED_ANALYSIS_MARKETS, getAnalysisMarketIssue } = require("../src/lib/analysis-markets.ts")
const { loadAnalysisHistory, MARKET_URLS } = require("../src/lib/analysis-history.ts")
const { isMarketHistoryFresh } = require("../src/lib/market-history-freshness.ts")
const { marketEventMinutes } = require("../src/lib/market-schedule.ts")
const { NIGHT_MARKET_NAMES, HIGH_VOLUME_MARKETS, LIQUIDITY_FLOW_MAP } = require("../src/lib/predictor/market-config.ts")
const { analyzeMarket } = require("../src/lib/predictor.ts")
const { buildCombinedAnalysis } = require("../src/lib/combined-prediction.ts")
const { predictDpPanels } = require("../src/lib/predictor/dp-panel-model.ts")
const { historicalCutoffISO } = require("../src/lib/prediction-contract.ts")
const core = JSON.parse(fs.readFileSync("backtest_reports/2026-10-18/reliability/source.json", "utf8")).markets
const fixture = JSON.parse(fs.readFileSync("scripts/fixtures/supreme-markets.json", "utf8"))
const expectedPool = ["Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan", "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar"]

function record(market, iso, openPanel, closePanel, savedAt = 0) {
  const value = new Date(`${iso}T00:00:00Z`)
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][value.getUTCDay()]
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7)
  const dateRangeStart = `${String(value.getUTCDate()).padStart(2,"0")}/${String(value.getUTCMonth()+1).padStart(2,"0")}/${value.getUTCFullYear()}`
  return db.normalizeRecords([{market,dateRangeStart,day,openPanel,closePanel}], market, savedAt)[0]
}

const supreme = Object.fromEntries(Object.entries(fixture.markets).map(([market, rows]) => [market, rows.map(([iso,open,close]) => record(market,iso,open,close))]))

async function main() {
  assert.deepEqual(POOLED_ANALYSIS_MARKETS, expectedPool)
  assert(DAY_MARKETS.includes("Supreme Day"))
  assert(NIGHT_MARKETS.includes("Supreme Night"))
  assert.equal(Object.keys(MARKET_URLS).length,14)
  assert.equal(getAnalysisMarketIssue("Supreme Day"),null)
  assert.match(getAnalysisMarketIssue("Supreme Night"),/conflicting historical result dates/)
  assert(NIGHT_MARKET_NAMES.has("Supreme Night"))
  for (const name of ["Supreme Day","Supreme Night"]) {
    assert(!HIGH_VOLUME_MARKETS.includes(name))
    assert.equal(LIQUIDITY_FLOW_MAP[name],undefined)
  }
  assert.equal(marketEventMinutes("Supreme Day","open"),935)
  assert.equal(marketEventMinutes("Supreme Day","close"),1055)
  assert.equal(marketEventMinutes("Supreme Night","open"),1245)
  assert.equal(marketEventMinutes("Supreme Night","close"),1365)

  // Verify real model behavior before replacing browser-only storage/network.
  const target = new Date("2026-11-02T12:00:00+05:30")
  const prior = supreme["Supreme Day"].filter(row => db.getRecordISODate(row) < "2026-11-02" && db.getRecordISODate(row) >= historicalCutoffISO("2026-11-02"))
  const all = {...core,"Supreme Day":prior}
  const inputs = JSON.stringify(all)
  const v1 = analyzeMarket("Supreme Day",prior,all,target,{knownOpenPanel:null})
  assert.equal(v1.openPanelPicks.length,10)
  const v2 = buildCombinedAnalysis("Supreme Day",prior,all,target)
  assert.equal(v2.status,"ready")
  const zero = buildCombinedAnalysis("Supreme Day",prior,all,target,0,"000")
  assert.equal(zero.status,"ready")
  assert.equal(zero.knownOpenSutta,0)
  assert.deepEqual(zero.open,v2.open)
  for (const side of ["open","close"]) {
    assert.equal(new Set(v2[side].panelPicks.map(p=>p.panel)).size,10)
    assert.equal(v2[side].spPicks.length,30)
    assert.equal(v2[side].dpPicks.length,20)
    assert.equal(v2[side].suttas.length,10)
  }
  const future = record("Supreme Day","2030-01-01","111","222")
  assert.deepEqual(buildCombinedAnalysis("Supreme Day",[...prior,future],all,target),v2)
  assert.deepEqual(analyzeMarket("Supreme Day",[...prior,future],all,target,{knownOpenPanel:null}),v1)
  assert.equal(buildCombinedAnalysis("Supreme Day",prior.slice(-50),all,target).status,"unavailable")
  assert.equal(JSON.stringify(all),inputs)
  const oldTarget = new Date("2026-10-18T12:00:00+05:30")
  const extended = {...core,...supreme}
  assert.deepEqual(predictDpPanels("Sridevi",core.Sridevi,extended,oldTarget),predictDpPanels("Sridevi",core.Sridevi,core,oldTarget),"New histories changed the fitted DP pool")
  assert.deepEqual(analyzeMarket("Sridevi",core.Sridevi,extended,oldTarget),analyzeMarket("Sridevi",core.Sridevi,core,oldTarget))
  assert.deepEqual(buildCombinedAnalysis("Sridevi",core.Sridevi,extended,oldTarget),buildCombinedAnalysis("Sridevi",core.Sridevi,core,oldTarget))

  // Browser tests exercise real IndexedDB; only unavailable Node boundaries are replaced here.
  const RealDate = Date
  const instant = RealDate.parse("2026-11-03T10:00:00+05:30")
  const originals = {fetch:global.fetch,get:db.getRecordsByMarket,replace:db.replaceHistorySnapshot}
  let cache = {}, requested = [], writes = [], failMarket = null, stale = false
  const ready = Object.fromEntries(expectedPool.map(name => [name,supreme["Supreme Day"].map(row => ({...row,market:name,id:`${name}|${db.getRecordISODate(row)}`,savedAt:instant}))]))
  ready["Supreme Day"] = supreme["Supreme Day"].map(row => ({...row,savedAt:instant}))
  try {
    global.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [instant])) }
      static now() { return instant }
    }
    db.getRecordsByMarket = async name => cache[name] ?? []
    db.replaceHistorySnapshot = async histories => {writes.push(histories)}
    global.fetch = async (url, options) => {
      options.signal.throwIfAborted()
      const name = new URL(url,"https://test.invalid").searchParams.get("market")
      requested.push(name)
      if (name === failMarket || failMarket === "all") return new Response("Source unavailable",{status:502})
      const panels = stale && name === "Supreme Day" ? ready[name].filter(row => db.getRecordISODate(row) <= "2026-10-30") : ready[name]
      return Response.json({panels,scrapedAt:new Date().toISOString()})
    }
    const run = (market,force=false) => loadAnalysisHistory(force,new AbortController().signal,market)
    const reset = async () => {await new Promise(setImmediate);requested=[];writes=[];failMarket=null;cache={};stale=false}
    const original = await run("Kalyan")
    assert.deepEqual(Object.keys(original.histories).sort(),[...expectedPool].sort())
    assert.deepEqual([...requested].sort(),[...expectedPool].sort())
    assert.equal(writes.length,1)
    await reset()
    const added = await run("Supreme Day")
    assert.equal(added.histories["Supreme Day"].length,847)
    assert.equal(requested.length,13)
    assert(!requested.includes("Supreme Night"))
    assert.equal(Object.keys(writes[0]).length,13)
    await reset()
    await assert.rejects(run("Supreme Night"),/conflicting historical result dates/)
    await assert.rejects(run("Unknown"),/Unknown analysis market/)
    assert.equal(requested.length,0)
    assert.equal(writes.length,0)
    await reset()
    failMarket="Supreme Day"
    await assert.rejects(run("Supreme Day"),/Could not refresh Supreme Day/)
    assert.equal(writes.length,0)
    await reset()
    stale=true
    await assert.rejects(run("Supreme Day"),/history is not current.*2026-10-30/)
    assert.equal(writes.length,0)
    await reset()
    failMarket="all";cache=ready
    const saved = await run("Supreme Day")
    assert.match(saved.notice,/complete saved history snapshot/)
    assert.equal(writes.length,0)
    await assert.rejects(run("Supreme Day",true),/Could not refresh/)
    await reset()
    failMarket="all";cache={...ready,"Supreme Day":ready["Supreme Day"].filter(row=>db.getRecordISODate(row)<="2026-10-30")}
    await assert.rejects(run("Supreme Day"),/Could not refresh/)
    assert.equal(writes.length,0)
    const cancelled=new AbortController();cancelled.abort()
    await assert.rejects(loadAnalysisHistory(false,cancelled.signal,"Supreme Day"),{name:"AbortError"})

    // A Sunday is a real draw, and a declared zero Open only satisfies the Open deadline.
    assert(ready["Supreme Day"].some(row=>row.day==="Sunday"))
    const afterOpen=new Date("2026-11-03T15:46:00+05:30")
    const afterClose=new Date("2026-11-03T17:46:00+05:30")
    const rows=ready["Supreme Day"].map(row=>({...row,savedAt:afterOpen.getTime()}))
    assert.equal(isMarketHistoryFresh(rows,"Supreme Day",afterOpen),false)
    const partial=[...rows,record("Supreme Day","2026-11-03","000","",afterOpen.getTime())]
    assert.equal(isMarketHistoryFresh(partial,"Supreme Day",afterOpen),true)
    assert.equal(isMarketHistoryFresh(partial,"Supreme Day",afterClose),false)
  } finally {
    global.Date=RealDate;global.fetch=originals.fetch
    db.getRecordsByMarket=originals.get;db.replaceHistorySnapshot=originals.replace
  }
  console.log("Supreme integration passed: original pool/model parity, V1/V2 outputs, future exclusion, Sutta zero, selected-only fetch, quarantine, stale/cache/failure/abort boundaries and Sunday deadlines.")
}

main().catch(error=>{console.error(error);process.exitCode=1})
