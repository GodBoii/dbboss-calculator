/* eslint-disable no-console, @typescript-eslint/no-require-imports */
// Verifies the production v2 sutta engine reproduces the research rule exactly
// and reports its walk-forward Top 6 / Jodi Top 36 accuracy for 7, 30, 90 days.
// Usage: node scripts/verify-sutta-v2-parity.cjs
const fs = require("fs")
const Module = require("module")
const path = require("path")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) return originalResolve.call(this, path.join(ROOT, "src", request.slice(2)), parent, isMain, options)
  return originalResolve.call(this, request, parent, isMain, options)
}
for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = function registerTs(module, filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    module._compile(output, filename)
  }
}

const { getRecordISODate } = require(path.join(ROOT, "src", "lib", "db.ts"))
const { buildOpenSuttaSet, buildCloseSuttaSet, buildJodis, SUTTA_MODEL_ENGINE } = require(path.join(ROOT, "src", "lib", "sutta-model", "production.ts"))

const cachePath = [path.join(ROOT, "scratch", "sutta-research-records.json"), path.join(ROOT, "scratch", "open-sutta-records-cache.json")].find((p) => fs.existsSync(p))
if (!cachePath) throw new Error("Missing scratch/sutta-research-records.json")
if (SUTTA_MODEL_ENGINE !== "v2-recency") throw new Error(`SUTTA_MODEL_ENGINE is ${SUTTA_MODEL_ENGINE}, expected v2-recency`)
const all = JSON.parse(fs.readFileSync(cachePath, "utf8"))

// Independent re-implementation of the research rule (scratch/sutta-v2-final-eval.cjs).
function tieBreak(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const t = []
  for (let d = 0; d < 10; d++) { h ^= d + 1; h = Math.imul(h, 16777619); t[d] = ((h >>> 0) % 100000) / 1e12 }
  return t
}
const order = (s, tb) => s.map((v, d) => [v + tb[d], d]).sort((a, b) => b[0] - a[0]).map((x) => x[1])
function researchOpen(hist, tb) {
  const s = new Array(10).fill(-1e6)
  for (let i = hist.length - 1; i >= 0; i--) if (s[hist[i].o] === -1e6) s[hist[i].o] = -(hist.length - i)
  return order(s, tb)
}
function researchClose(hist, tb) {
  const p = hist.at(-1), c30 = new Array(10).fill(0)
  for (let i = Math.max(0, hist.length - 30); i < hist.length; i++) c30[hist[i].c]++
  return order(c30.map((c, d) => -c - (d === p.c ? 100 : 0) - (d === p.o ? 100 : 0)), tb)
}

const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const failures = []
const rows = []
for (const [market, records] of Object.entries(all)) {
  const dated = records
    .map((record) => ({ record, iso: getRecordISODate(record) }))
    .filter((r) => r.iso && /^\d{3}$/.test(r.record.openPanel) && /^\d{3}$/.test(r.record.closePanel) && /^\d{2}$/.test(r.record.jodi))
    .sort((a, b) => a.iso.localeCompare(b.iso))
  const dedup = dated.filter((r, i) => i === 0 || dated[i - 1].iso !== r.iso)
  const anchor = dedup.at(-1)?.iso
  if (!anchor) continue
  for (let i = 180; i < dedup.length; i++) {
    const { record, iso } = dedup[i]
    if (iso < addDays(anchor, -120)) continue
    // pass ALL records (including today's and later) to prove the engine ignores rows >= target date
    const targetDate = new Date(`${iso}T12:00:00Z`)
    const open = buildOpenSuttaSet([], {}, records, 6, market, targetDate, {}).map((p) => p.sutta)
    const close = buildCloseSuttaSet([], {}, records, 6, market, null, {}, targetDate).map((p) => p.sutta)
    const hist = dedup.slice(0, i).map((r) => ({ o: Number(r.record.jodi[0]), c: Number(r.record.jodi[1]) }))
    const tb = tieBreak(`${market}|${iso}`)
    const ro = researchOpen(hist, tb).slice(0, 6), rc = researchClose(hist, tb).slice(0, 6)
    if (open.join() !== ro.join()) failures.push(`${market} ${iso} open ${open} vs research ${ro}`)
    if (close.join() !== rc.join()) failures.push(`${market} ${iso} close ${close} vs research ${rc}`)
    const jodis = buildJodis(open.map((s) => ({ sutta: s })), close.map((s) => ({ sutta: s })))
    rows.push({ iso, anchor, o: Number(record.jodi[0]), c: Number(record.jodi[1]), jodi: record.jodi, open, close, jodis })
  }
}

const globalAnchor = rows.map((r) => r.anchor).sort().at(-1)
for (const days of [7, 30, 90]) {
  const sel = rows.filter((r) => r.iso >= addDays(globalAnchor, -(days - 1)))
  const n = sel.length
  const f = (h) => `${((100 * h) / n).toFixed(1)}% (${h}/${n})`
  console.log(`${days}d to ${globalAnchor}: open ${f(sel.filter((r) => r.open.includes(r.o)).length)} close ${f(sel.filter((r) => r.close.includes(r.c)).length)} jodi ${f(sel.filter((r) => r.jodis.includes(r.jodi)).length)}`)
}
if (failures.length) {
  console.error(`Parity FAILED (${failures.length}):`)
  for (const x of failures.slice(0, 20)) console.error(`- ${x}`)
  process.exit(1)
}
console.log(`v2 parity passed on ${rows.length} draws (cache: ${path.basename(cachePath)}).`)
