/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const source = JSON.parse(fs.readFileSync('backtest_reports/2026-10-18/reliability/source.json'))
const baseURL = process.env.TEST_URL || 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL || 'chrome'})
  try {
    for(const viewport of [{width:390,height:844},{width:1440,height:1000}]) {
      const context = await browser.newContext({viewport,timezoneId:'America/Los_Angeles',serviceWorkers:'block'})
      const page = await context.newPage()
      const errors=[]
      page.on('pageerror',e=>errors.push(e.message))
      await page.clock.install({time:new Date('2026-10-18T05:00:00Z')})
      let failMarket=null, delay=0
      await page.route('**/api/scrape?**',async route=>{
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay))
        const market=new URL(route.request().url()).searchParams.get('market')
        if(market===failMarket)return route.fulfill({status:502,json:{error:'Deliberate source outage'}})
        return route.fulfill({json:{market,panels:source.markets[market],scrapedAt:'2026-10-18T05:00:00Z'}})
      })
      await page.goto(baseURL)
      // Inject the real legacy IndexedDB conflict, not a mocked storage API.
      await page.evaluate(async()=>{
        const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('dbboss_v2',1);req.onupgradeneeded=()=>{const store=req.result.createObjectStore('panels',{keyPath:'id'});store.createIndex('market','market');store.createIndex('savedAt','savedAt')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
        await new Promise((resolve,reject)=>{const tx=db.transaction('panels','readwrite');const store=tx.objectStore('panels');for(const [id,openPanel] of [['legacy-a','478'],['legacy-b','123']])store.put({id,market:'Madhur Day',dateRangeStart:'24/06/2024',dateRangeEnd:'30/06/2024',day:'Monday',openPanel,closePanel:'569',openSutta:9,closeSutta:0,jodi:'90',savedAt:0});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()
      })
      await page.locator('#tab-analysis').click()
      await page.locator('#analysis-v2').click()
      await page.locator('#market-sridevi').click()
      await page.locator('#btn-analyze').click()
      await page.getByText('V2 combined',{exact:true}).waitFor({timeout:90000})
      assert.equal(await page.getByText(/Conflicting Madhur Day/).count(),0)
      assert(await page.locator('.analysis-version-description').filter({hasText:'Target 2026-10-18'}).count())
      await page.getByRole('button',{name:'Copy Sutta / Jodi',exact:true}).click()
      await page.getByRole('button',{name:'Increase count'}).click()
      await page.waitForFunction(()=>document.querySelector('.copy-count-input')?.value==='7')
      await page.getByPlaceholder('e.g. 368').fill('000')
      await page.waitForFunction(()=>!document.body.textContent.includes('Updating V2'))
      await page.locator('#analysis-v1').click()
      await page.locator('.confidence-badge').first().waitFor()
      assert.equal(await page.getByText('Panel@30',{exact:false}).count(),0)
      // The old snapshot remains intact when a source fails during Fresh Data.
      const readCount=()=>page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('dbboss_v2');r.onsuccess=()=>resolve(r.result)});const count=await new Promise(resolve=>{const r=db.transaction('panels').objectStore('panels').count();r.onsuccess=()=>resolve(r.result)});db.close();return count})
      const before=await readCount()
      failMarket='Madhur Day'
      await page.locator('#btn-refresh').click()
      await page.getByText('Analysis Failed',{exact:true}).waitFor({timeout:30000})
      assert.equal(await readCount(),before)
      failMarket=null
      // Fail a write after other stores have started replacing their rows.
      await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let failed=false;IDBObjectStore.prototype.put=function(row,...rest){if(!failed&&row.market==='Kalyan'){failed=true;throw new DOMException('Simulated full storage','QuotaExceededError')}return original.call(this,row,...rest)}})
      await page.locator('#btn-analyze').click()
      await page.getByText('Analysis Failed',{exact:true}).waitFor({timeout:30000})
      assert.equal(await readCount(),before,'The entire snapshot must roll back after a mid-write failure')
      failMarket=null;delay=250
      await page.locator('#btn-analyze').click()
      await page.locator('#market-kalyan').click()
      await page.locator('#btn-analyze').click()
      await page.locator('.confidence-badge').first().waitFor({timeout:60000})
      await page.getByRole('button',{name:'Stats',exact:true}).click()
      await page.locator('.stat-row').filter({has:page.locator('.stat-label',{hasText:/^Market$/})}).getByText('Kalyan',{exact:true}).waitFor()
      assert.equal(await page.locator('.error-title').count(),0)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
      assert.deepEqual(errors,[])
      if(process.env.VERIFY_SCREENSHOT_DIR)await page.screenshot({path:require('node:path').join(process.env.VERIFY_SCREENSHOT_DIR,`dbboss-reliability-${viewport.width}.png`)})
      await context.close()
      console.log(`Browser reliability passed at ${viewport.width}px, non-India device timezone`)
    }
  } finally {await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
