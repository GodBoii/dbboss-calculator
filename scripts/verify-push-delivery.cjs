/* eslint-disable @typescript-eslint/no-require-imports */
// External push and Supabase are simulated. This test never contacts a device.
const assert=require('node:assert/strict')
const Module=require('node:module')
require('../research/dp_panel_v3/ts-loader.cjs')
const originalLoad=Module._load
Module._load=function(name,...args){return name==='server-only'?{}:originalLoad.call(this,name,...args)}
const event={id:1,payload:{rawValue:'123-61-128'},push_started_at:null,push_completed_at:null}
let transient=true, attempts=[], failWrite=false
const client={from(name){assert.equal(name,'result_events');let values,lease=false;return {
  update(value){values=value;return this},eq(){return this},is(){return this},select(){return this},or(){lease=true;return this},
  async maybeSingle(){if(event.push_completed_at || (event.push_started_at && Date.now()-Date.parse(event.push_started_at)<120000))return {data:null,error:null};Object.assign(event,values);return {data:{id:1,payload:structuredClone(event.payload)},error:null}},
  then(resolve,reject){return Promise.resolve().then(()=>{assert(!lease);if(failWrite)return {error:new Error('Simulated persistence failure')};Object.assign(event,structuredClone(values));return {error:null}}).then(resolve,reject)},
}}}
function stub(file,exports){const id=require.resolve(file);require.cache[id]={id,filename:id,loaded:true,exports}}
stub('../src/lib/live-results/supabase-server.ts',{getSupabaseAdmin:()=>client})
stub('../src/lib/live-results/push-server.ts',{async sendResultPush(market,name,phase,parsed,delivery){let failed=0,sent=0;for(const id of ['device-a','device-b']){if(delivery.alreadySent.has(id))continue;attempts.push(id);if(id==='device-b'&&transient){failed++;continue}await delivery.onDelivered(id);sent++}return {sent,failed,skipped:false}}})
const {deliverResultEvent}=require('../src/lib/live-results/push-delivery.ts')
const {normalizeSourceValue}=require('../src/lib/live-results/source-parser.ts')
async function main(){
  const market={id:'sridevi',display_name:'Sridevi'},parsed=normalizeSourceValue('123-61-128')
  assert(parsed)
  assert.equal(await deliverResultEvent(1,market,'close',parsed),false)
  assert.deepEqual(event.payload.deliveredSubscriptionIds,['device-a'])
  assert.equal(event.push_completed_at,null)
  assert.equal(await deliverResultEvent(1,market,'close',parsed),false,'An overlapping monitor must not take the delivery lease')
  assert.deepEqual(attempts,['device-a','device-b'])
  transient=false;event.push_started_at=new Date(Date.now()-180000).toISOString()
  assert.equal(await deliverResultEvent(1,market,'close',parsed),true)
  assert.deepEqual(attempts,['device-a','device-b','device-b'],'Retry only the failed recipient')
  assert.deepEqual(event.payload.deliveredSubscriptionIds,['device-a','device-b'])
  assert(event.push_completed_at)
  assert.equal(await deliverResultEvent(1,market,'close',parsed),false)
  event.push_completed_at=null;event.push_started_at=null;event.payload={};failWrite=true
  await assert.rejects(deliverResultEvent(1,market,'close',parsed),/persistence failure/)
  assert.equal(event.push_completed_at,null,'A failed acknowledgment cannot be marked delivered')
  console.log('Push delivery passed: leases, partial failure, recipient acknowledgments, retry, idempotency, and persistence failure. No notifications sent.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
