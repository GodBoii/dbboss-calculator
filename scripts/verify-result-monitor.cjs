/* eslint-disable @typescript-eslint/no-require-imports */
// Exercise the real route and source parser; replace external Supabase and delivery.
const assert=require('node:assert/strict'),Module=require('node:module')
require('../research/dp_panel_v3/ts-loader.cjs')
const load=Module._load;Module._load=function(name,...args){return name==='server-only'?{}:load.call(this,name,...args)}
const tables={markets:[{id:'sridevi',display_name:'Sridevi',homepage_name:'SRIDEVI',is_active:true}],monitor_candidates:[],market_results:[],result_events:[],monitor_runs:[]}
let seq=0,pushes=0,phase='open',raw='123-6'
const client={from(table){let op='read',values,options={},filters=[],returning=false;const query={
  select(){returning=true;return this},eq(key,value){filters.push(row=>row[key]===value);return this},order(){return this},limit(){return this},
  insert(value){op='insert';values=value;return this},upsert(value,opts){op='upsert';values=value;options=opts;return this},update(value){op='update';values=value;return this},
  async execute(single){let result=[];if(op==='read')result=tables[table].filter(r=>filters.every(fn=>fn(r)));else if(op==='update'){result=tables[table].filter(r=>filters.every(fn=>fn(r)));result.forEach(r=>Object.assign(r,values));}else if(op==='upsert'){const keys=options.onConflict.split(',');const found=tables[table].find(r=>keys.every(k=>r[k]===values[k]));if(found){if(!options.ignoreDuplicates){Object.assign(found,values);result=[found]}}else{const row={id:++seq,...values};tables[table].push(row);result=[row]}}else{const row={id:++seq,...values};tables[table].push(row);result=[row]}return {data:single ? result[0]??null : returning ? structuredClone(result) : null,error:null}},
  maybeSingle(){return this.execute(true)},single(){return this.execute(true)},then(resolve,reject){return this.execute(false).then(resolve,reject)},
};return query}}
function stub(file,exports){const id=require.resolve(file);require.cache[id]={id,filename:id,loaded:true,exports}}
stub('../src/lib/live-results/supabase-server.ts',{getSupabaseAdmin:()=>client})
stub('../src/lib/live-results/time.ts',{activePhase:()=>phase,resultDateForMarket:()=> '2026-10-17'})
stub('../src/lib/live-results/push-delivery.ts',{retryPendingResultEvents:async()=>{},deliverResultEvent:async id=>{const event=tables.result_events.find(e=>e.id===id);if(event.push_completed_at)return false;event.push_completed_at='delivered';pushes++;return true}})
global.fetch=async()=>new Response(`<h2>SRIDEVI</h2><div>${raw}</div>`)
process.env.RESULT_MONITOR_SECRET='local-test-secret'
const {NextRequest}=require('next/server'),{POST}=require('../src/app/api/monitor-results/route.ts')
const request=()=>new NextRequest('https://localhost/api/monitor-results',{method:'POST',headers:{authorization:'Bearer local-test-secret'}})
async function run(){const response=await POST(request());assert.equal(response.status,200);return response.json()}
async function main(){
  assert.equal((await POST(new NextRequest('https://localhost/api/monitor-results',{method:'POST'}))).status,401)
  await run();assert.equal(tables.market_results.length,0,'A single observation cannot publish a result')
  await run();assert.equal(tables.market_results[0].status,'open');assert.equal(pushes,1)
  await run();assert.equal(pushes,1,'Identical observations cannot send duplicate completed events')
  tables.result_events=[];await run();assert.equal(tables.result_events.length,1,'Recover a crash between saving a result and creating its event')
  phase='close';raw='123-61-128'
  await run();assert.equal(tables.market_results[0].status,'open')
  await run();assert.equal(tables.market_results[0].status,'closed');assert.equal(tables.market_results[0].close_panel,'128')
  const before=pushes;await run();assert.equal(pushes,before)
  raw='123-62-129';await run();assert.equal(tables.market_results[0].close_panel,'128')
  await run();assert.equal(tables.market_results[0].status,'corrected');assert.equal(tables.market_results[0].close_panel,'129')
  phase='open';raw='123-6';await run();await run();assert.equal(tables.market_results[0].status,'corrected','Late Open observations cannot downgrade a completed result')
  console.log('Monitor route passed: authorization, two observations, Open/Close, crash recovery, idempotency, corrections, and downgrade prevention. No external requests or notifications.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
