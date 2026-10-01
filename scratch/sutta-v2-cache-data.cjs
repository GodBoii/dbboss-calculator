/* eslint-disable no-console, @typescript-eslint/no-require-imports */
// Fetches every production market through the app scrape route once and caches
// a compact, date-sorted history for offline research.
const fs = require("fs")
const Module = require("module")
const path = require("path")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "scratch", "sutta-v2-history.json")
const BASE = "https://dpbossss.boston/panel-chart-record/"
const MARKETS = {
  Sridevi: "sridevi", "Time Bazar": "time-bazar", "Madhur Day": "madhur-day", "Milan Day": "milan-day",
  "Rajdhani Day": "rajdhani-day", Kalyan: "kalyan", "Sridevi Night": "sridevi-night",
  "Kalyan Night": "kalyan-night", "Madhur Night": "madhur-night", "Milan Night": "milan-night",
  "Rajdhani Night": "rajdhani-night", "Main Bazar": "main-bazar",
}

function installTypeScriptLoader() {
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      return originalResolve.call(this, path.join(ROOT, "src", request.slice(2)), parent, isMain, options)
    }
    return originalResolve.call(this, request, parent, isMain, options)
  }
  for (const ext of [".ts", ".tsx"]) {
    require.extensions[ext] = function registerTypeScript(module, filename) {
      const source = fs.readFileSync(filename, "utf8")
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      }).outputText
      module._compile(output, filename)
    }
  }
}

async function main() {
  installTypeScriptLoader()
  const { GET } = require(path.join(ROOT, "src", "app", "api", "scrape", "route.ts"))
  const { getRecordISODate } = require(path.join(ROOT, "src", "lib", "backtest.ts"))
  const out = {}
  for (const [market, slug] of Object.entries(MARKETS)) {
    const url = `${BASE}${slug}.php`
    const response = await GET({ nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`) })
    const payload = await response.json()
    if (!response.ok) throw new Error(`${market}: ${payload.error}`)
    const rows = payload.panels
      .map((p) => ({ ...p, isoDate: getRecordISODate(p) }))
      .filter((p) => p.isoDate && /^\d{3}$/.test(p.openPanel) && /^\d{3}$/.test(p.closePanel) && /^\d{2}$/.test(p.jodi))
      .map((p) => ({ d: p.isoDate, op: p.openPanel, cp: p.closePanel, o: Number(p.jodi[0]), c: Number(p.jodi[1]) }))
      .sort((a, b) => a.d.localeCompare(b.d))
    const dedup = []
    for (const r of rows) if (!dedup.length || dedup.at(-1).d !== r.d) dedup.push(r)
    out[market] = dedup
    console.log(`${market}: ${dedup.length} rows ${dedup[0]?.d} -> ${dedup.at(-1)?.d}`)
  }
  fs.writeFileSync(OUT, JSON.stringify(out))
  console.log(`Saved ${OUT}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
