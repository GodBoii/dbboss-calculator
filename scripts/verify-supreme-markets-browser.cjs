/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright")
require("../research/dp_panel_v3/ts-loader.cjs")
const { normalizeRecords } = require("../src/lib/db.ts")

const fixture = JSON.parse(fs.readFileSync("scripts/fixtures/supreme-markets.json","utf8"))
const source = JSON.parse(fs.readFileSync("backtest_reports/2026-10-18/reliability/source.json","utf8")).markets
const baseURL = process.env.TEST_URL || "http://localhost:3000"
const now = "2026-11-03T04:30:00.000Z"
const panels = fixture.markets["Supreme Day"].map(([iso,openPanel,closePanel]) => {
  const date = new Date(`${iso}T00:00:00Z`)
  const day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getUTCDay()]
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay()+6)%7)
  return {market:"Supreme Day",day,openPanel,closePanel,dateRangeStart:`${String(date.getUTCDate()).padStart(2,"0")}/${String(date.getUTCMonth()+1).padStart(2,"0")}/${date.getUTCFullYear()}`}
})
source["Supreme Day"] = normalizeRecords(panels,"Supreme Day",Date.parse(now))

async function main() {
  const browser = await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL || "chrome"})
  try {
    for (const viewport of [{width:390,height:844},{width:1440,height:1000}]) {
      const context = await browser.newContext({viewport,timezoneId:"America/Los_Angeles",serviceWorkers:"block"})
      try {
        const page = await context.newPage()
        const errors = [], consoleErrors = [], requests = []
        let failDay = false
        page.on("pageerror",e=>errors.push(e.message))
        page.on("console",msg=>{if(msg.type()==="error" && /hydration|uncaught|runtime error/i.test(msg.text()))consoleErrors.push(msg.text())})
        await page.clock.install({time:new Date(now)})
        await page.route("**/api/scrape?**",async route=>{
          const market = new URL(route.request().url()).searchParams.get("market")
          requests.push(market)
          if (market === "Supreme Night" || (market === "Supreme Day" && failDay)) return route.fulfill({status:502,json:{error:"Source unavailable"}})
          assert(source[market],`Unexpected market ${market}`)
          return route.fulfill({json:{panels:source[market],scrapedAt:now}})
        })
        await page.goto(baseURL)
        await page.locator("#tab-analysis").click()
        await page.getByRole("button",{name:"☀️ Day",exact:true}).click()
        await page.locator("#market-supreme-day").click()
        await page.locator("#btn-analyze").click()
        await page.locator(".confidence-badge").first().waitFor({timeout:90000})
        assert.equal(requests.length,13)
        assert(!requests.includes("Supreme Night"))
        await page.getByText("Unrated",{exact:true}).waitFor()
        await page.locator("#analysis-v2").click()
        await page.getByText("V2 combined",{exact:true}).waitFor({timeout:90000})
        await page.getByRole("button",{name:"Copy Sutta / Jodi",exact:true}).click()
        await page.getByRole("button",{name:"Increase count"}).click()
        await page.waitForFunction(()=>document.querySelector(".copy-count-input")?.value==="7")
        await page.getByPlaceholder("e.g. 368").fill("000")
        await page.waitForFunction(()=>!document.body.textContent.includes("Updating V2"))
        assert.equal(await page.getByPlaceholder("e.g. 368").inputValue(),"000")
        assert.equal(await page.locator(".copy-count-input").inputValue(),"7")
        await page.locator("#analysis-v1").click()
        await page.locator(".confidence-badge").first().waitFor()
        assert.equal(await page.getByPlaceholder("e.g. 368").inputValue(),"000")
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
        if (process.env.VERIFY_SCREENSHOT_DIR) {
          await page.locator(".confidence-badge").first().scrollIntoViewIfNeeded()
          await page.screenshot({path:path.join(process.env.VERIFY_SCREENSHOT_DIR,`supreme-day-${viewport.width}.png`),animations:"disabled"})
        }

        const readCounts = () => page.evaluate(async()=>{
          const db=await new Promise((resolve,reject)=>{const r=indexedDB.open("dbboss_v2");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
          const counts=await new Promise((resolve,reject)=>{const r=db.transaction("panels").objectStore("panels").getAll();r.onsuccess=()=>{const totals={};for(const row of r.result)totals[row.market]=(totals[row.market]??0)+1;resolve(totals)};r.onerror=()=>reject(r.error)})
          db.close();return counts
        })
        const before = await readCounts()
        assert.equal(before["Supreme Day"],847)
        failDay = true
        await page.locator("#btn-refresh").click()
        await page.getByText("Analysis Failed",{exact:true}).waitFor({timeout:30000})
        assert.deepEqual(await readCounts(),before,"Failed selected-market refresh replaced the saved snapshot")

        // Quarantine is visible and keyboard operable, and makes no chart requests.
        await page.getByRole("button",{name:"🌙 Night",exact:true}).click()
        requests.length=0
        await page.locator("#market-supreme-night").focus()
        await page.keyboard.press("Enter")
        await page.getByText("History verification pending",{exact:true}).waitFor()
        assert(await page.locator("#btn-analyze").isDisabled())
        assert.equal(await page.locator("#btn-analyze").getAttribute("aria-describedby"),"market-history-issue")
        assert.equal(requests.length,0)
        assert.equal(await page.locator(".confidence-badge").count(),0)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false)
        if (process.env.VERIFY_SCREENSHOT_DIR) {
          await page.locator("#market-history-issue").scrollIntoViewIfNeeded()
          await page.screenshot({path:path.join(process.env.VERIFY_SCREENSHOT_DIR,`supreme-night-${viewport.width}.png`),animations:"disabled"})
        }

        // A failed Supreme feed cannot block an existing market or delete its cache.
        await page.getByRole("button",{name:"☀️ Day",exact:true}).click()
        await page.locator("#market-kalyan").click()
        await page.locator("#btn-analyze").click()
        await page.locator(".confidence-badge").first().waitFor({timeout:90000})
        assert.equal(await page.locator("#market-history-issue").count(),0)
        assert.equal(requests.length,12)
        assert(!requests.some(name=>name.startsWith("Supreme")))
        assert.equal((await readCounts())["Supreme Day"],847)
        await page.getByRole("button",{name:"Stats",exact:true}).click()
        await page.locator(".stat-row").filter({has:page.locator(".stat-label",{hasText:/^Market$/})}).getByText("Kalyan",{exact:true}).waitFor()
        assert.deepEqual(errors,[])
        assert.deepEqual(consoleErrors,[])
        console.log(`Supreme browser verification passed at ${viewport.width}px: V1/V2, count/input state, real IndexedDB rollback, quarantine and existing-market isolation.`)
      } finally {await context.close()}
    }
  } finally {await browser.close()}
}

main().catch(error=>{console.error(error);process.exitCode=1})
