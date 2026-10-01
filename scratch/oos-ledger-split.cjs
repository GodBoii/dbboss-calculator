/* Split a production-model-window-report ledger into in-sample / out-of-sample segments. */
const fs = require("fs")
const file = process.argv[2]
const cutoff = process.argv[3] || "2026-08-08"
const report = JSON.parse(fs.readFileSync(file, "utf8"))
const seen = new Set()
const segs = { before: [], after: [] }
for (const row of report.ledger) {
  const key = `${row.market}|${row.isoDate}`
  if (seen.has(key)) continue
  seen.add(key)
  segs[row.isoDate >= cutoff ? "after" : "before"].push(row)
}
function z(h, n, p) {
  return ((h / n - p) / Math.sqrt((p * (1 - p)) / n)).toFixed(2)
}
for (const [name, rows] of Object.entries(segs)) {
  let o = [0, 0], c = [0, 0], j = [0, 0]
  for (const r of rows) {
    const a = r.actual
    if (Number.isInteger(a.openSutta) && a.openSutta >= 0) { o[1]++; if (r.prediction.openSuttas.includes(a.openSutta)) o[0]++ }
    if (Number.isInteger(a.closeSutta) && a.closeSutta >= 0) { c[1]++; if (r.prediction.closeSuttas.includes(a.closeSutta)) c[0]++ }
    if (/^\d{2}$/.test(a.jodi)) { j[1]++; if (r.prediction.jodis.includes(a.jodi)) j[0]++ }
  }
  console.log(`${name} ${cutoff}: open ${(o[0] / o[1] * 100).toFixed(1)}% (${o[0]}/${o[1]}, z=${z(o[0], o[1], 0.6)}) close ${(c[0] / c[1] * 100).toFixed(1)}% (${c[0]}/${c[1]}, z=${z(c[0], c[1], 0.6)}) jodi ${(j[0] / j[1] * 100).toFixed(1)}% (${j[0]}/${j[1]}, z=${z(j[0], j[1], 0.36)})`)
}
