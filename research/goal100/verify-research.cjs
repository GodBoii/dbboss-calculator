/* eslint-disable no-console */

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const HERE = __dirname
const ROOT = path.resolve(HERE, '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function readArtifact(specification) {
  const absolute = path.resolve(ROOT, specification.path)
  const relative = path.relative(ROOT, absolute)
  assert(!relative.startsWith('..') && !path.isAbsolute(relative), `${specification.path}: path escapes workspace`)
  const bytes = fs.readFileSync(absolute)
  const expected = specification.sha256 || specification.fileSha256
  assert(sha256(bytes) === expected, `${specification.path}: SHA-256 mismatch`)
  return JSON.parse(bytes.toString('utf8'))
}

function fixedSet(values, size, label) {
  assert(Array.isArray(values), `${label}: expected array`)
  assert(values.length === size, `${label}: expected ${size}, got ${values.length}`)
  assert(new Set(values).size === size, `${label}: duplicate values`)
}

function expectedJodis(open, close) {
  return open.flatMap((openDigit) => close.map((closeDigit) => `${openDigit}${closeDigit}`))
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function verifyFrozenData() {
  const absolute = path.resolve(ROOT, manifest.baselineData.path)
  const bytes = fs.readFileSync(absolute)
  assert(bytes.length === manifest.baselineData.bytes, 'frozen data byte count mismatch')
  assert(sha256(bytes) === manifest.baselineData.sha256, 'frozen data SHA-256 mismatch')
  const data = JSON.parse(bytes.toString('utf8'))
  assert(Object.keys(data).length === manifest.baselineData.markets, 'frozen data market count mismatch')
  const rows = Object.values(data).reduce((sum, records) => sum + records.length, 0)
  assert(rows === manifest.baselineData.rows, 'frozen data row count mismatch')
  return { markets: Object.keys(data).length, rows }
}

function verifyCausalAudit() {
  const specification = manifest.researchArtifacts.causalAudit
  const audit = readArtifact(specification)
  assert(audit.ledger.length === specification.scoredRows, 'causal audit ledger count mismatch')
  let changedOpen = 0
  let changedClose = 0
  let changedJodi = 0
  for (const row of audit.ledger) {
    for (const variant of ['exact', 'causal']) {
      const prediction = row[variant]
      fixedSet(prediction.open, 6, `${row.market}:${row.isoDate}:${variant}:open`)
      fixedSet(prediction.close, 6, `${row.market}:${row.isoDate}:${variant}:close`)
      fixedSet(prediction.jodi, 36, `${row.market}:${row.isoDate}:${variant}:jodi`)
      assert(sameArray(prediction.jodi, expectedJodis(prediction.open, prediction.close)), `${row.market}:${row.isoDate}:${variant}: invalid Jodi rectangle`)
      assert(prediction.hits.open === prediction.open.includes(row.actual.open), `${row.market}:${row.isoDate}:${variant}: Open hit mismatch`)
      assert(prediction.hits.close === prediction.close.includes(row.actual.close), `${row.market}:${row.isoDate}:${variant}: Close hit mismatch`)
      assert(prediction.hits.jodi === prediction.jodi.includes(row.actual.jodi), `${row.market}:${row.isoDate}:${variant}: Jodi hit mismatch`)
      assert(prediction.hits.jodi === (prediction.hits.open && prediction.hits.close), `${row.market}:${row.isoDate}:${variant}: Jodi logic mismatch`)
    }
    changedOpen += Number(row.changed.open)
    changedClose += Number(row.changed.close)
    changedJodi += Number(row.changed.jodi)
    assert(sameArray(row.exact.open, row.causal.open), `${row.market}:${row.isoDate}: censored Open differs`)
    assert(sameArray(row.exact.close, row.causal.close), `${row.market}:${row.isoDate}: censored Close differs`)
    assert(sameArray(row.exact.jodi, row.causal.jodi), `${row.market}:${row.isoDate}: censored Jodi differs`)
  }
  assert(changedOpen === 0 && changedClose === 0 && changedJodi === 0, 'causal audit has changed rankings')
  const overall = audit.metrics.aggregate.overall
  assert(overall.open.n === 6558 && overall.open.causalHits === 4228, 'causal overall Open mismatch')
  assert(overall.close.n === 6558 && overall.close.causalHits === 4332, 'causal overall Close mismatch')
  assert(overall.jodi.n === 6558 && overall.jodi.causalHits === 2826, 'causal overall Jodi mismatch')
  return { rows: audit.ledger.length, open: 4228, close: 4332, jodi: 2826, changed: 0 }
}

function verifyNestedRidge() {
  const artifact = readArtifact(manifest.researchArtifacts.nestedCausalRidge)
  assert(artifact.evaluationType === 'retrospective-nested-development-selected-not-sealed-forward', 'ridge evaluation type mismatch')
  assert(artifact.ledger.length === 6558, 'ridge ledger count mismatch')
  for (const row of artifact.ledger) {
    fixedSet(row.candidate.open, 6, `${row.market}:${row.date}:ridge:open`)
    fixedSet(row.candidate.close, 6, `${row.market}:${row.date}:ridge:close`)
    fixedSet(row.candidate.adjustedClose, 6, `${row.market}:${row.date}:ridge:adjustedClose`)
    assert(row.candidate.hits.open === row.candidate.open.includes(row.actual.open), `${row.market}:${row.date}: ridge Open hit mismatch`)
    assert(row.candidate.hits.close === row.candidate.close.includes(row.actual.close), `${row.market}:${row.date}: ridge Close hit mismatch`)
    assert(row.candidate.hits.jodi === (row.candidate.hits.open && row.candidate.hits.close), `${row.market}:${row.date}: ridge Jodi mismatch`)
    assert(row.candidate.hits.adjustedClose === row.candidate.adjustedClose.includes(row.actual.close), `${row.market}:${row.date}: ridge adjusted Close mismatch`)
  }
  const recent = artifact.aggregate.recentFrozen
  assert(recent.open.candidateMinusBaselineHits === -127, 'ridge recent Open delta mismatch')
  assert(recent.close.candidateMinusBaselineHits === -132, 'ridge recent Close delta mismatch')
  assert(recent.jodi.candidateMinusBaselineHits === -191, 'ridge recent Jodi delta mismatch')
  assert(Object.values(artifact.markets).every((market) => market.blocks.recentFrozen.jodi.candidateMinusBaselineHits < 0), 'ridge did not regress recent Jodi in every market')
  return { rows: artifact.ledger.length, recentOpenDelta: -127, recentCloseDelta: -132, recentJodiDelta: -191 }
}

function verifyCoverageGate() {
  const artifact = readArtifact(manifest.researchArtifacts.coverageGate)
  assert(artifact.inputSha256 === manifest.researchArtifacts.causalAudit.sha256, 'coverage gate input hash mismatch')
  assert(artifact.selection.sideVariantCount === 25 && artifact.selection.pairCount === 625, 'coverage gate search size mismatch')
  assert(artifact.selection.qualifyingPairs === 1, 'coverage gate qualifying pair count mismatch')
  assert(artifact.selection.open === 'baseline-no-gate' && artifact.selection.close === 'baseline-no-gate', 'coverage gate selected an active model')
  assert(artifact.promotableToSealedForwardResearch === false, 'coverage gate incorrectly marked promotable')
  for (const metrics of Object.values(artifact.aggregate)) {
    for (const target of ['open', 'close', 'jodi']) {
      assert(metrics[target].delta === 0 && metrics[target].gateCount === 0, `coverage gate ${target} changed later evidence`)
    }
  }
  return { sideVariants: 25, pairs: 625, qualifyingPairs: 1, selected: 'baseline-no-gate' }
}

function verifyForwardComparator() {
  const specification = manifest.researchArtifacts.forwardComparator
  const registry = readArtifact(specification)
  assert(registry.registrySealSha256 === specification.registrySealSha256, 'forward registry seal differs from manifest')
  assert(registry.entries.length === specification.entries, 'forward registry entry count mismatch')
  assert(registry.entries.every((entry) => entry.evidenceType === 'local-pre-event-baseline-comparator'), 'forward registry contains non-comparator entry')
  return { entries: registry.entries.length, status: specification.status, seal: registry.registrySealSha256 }
}

function verifyReportsAndRegistry() {
  for (const name of [
    'README.md',
    'PROTOCOL.md',
    'JOURNAL.md',
    'CAUSAL_BASELINE.md',
    'NESTED_CAUSAL_RIDGE_V1_REPORT.md',
    'COVERAGE_GATE.md',
    'FEASIBILITY_VERDICT.md',
    'hypothesis-registry.json',
  ]) {
    assert(fs.statSync(path.join(HERE, name)).size > 0, `${name}: missing or empty`)
  }
  const hypotheses = JSON.parse(fs.readFileSync(path.join(HERE, 'hypothesis-registry.json'), 'utf8'))
  assert(hypotheses.families.some((family) => family.id === 'genuinely-new-predraw-information' && family.status === 'eligible-but-data-unavailable'), 'resumption condition missing')
  childProcess.execFileSync(process.execPath, [path.join(HERE, 'verify-registry.cjs')], { cwd: ROOT, stdio: 'inherit' })
  return { reports: 8, hypothesisFamilies: hypotheses.families.length }
}

function main() {
  childProcess.execFileSync(process.execPath, [path.join(HERE, 'production-guard.cjs')], { cwd: ROOT, stdio: 'inherit' })
  const result = {
    frozenData: verifyFrozenData(),
    causalAudit: verifyCausalAudit(),
    nestedRidge: verifyNestedRidge(),
    coverageGate: verifyCoverageGate(),
    forwardComparator: verifyForwardComparator(),
    documentation: verifyReportsAndRegistry(),
  }
  childProcess.execFileSync(process.execPath, [path.join(HERE, 'production-guard.cjs')], { cwd: ROOT, stdio: 'inherit' })
  console.log('Goal100 research verification passed.')
  console.log(JSON.stringify(result, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error.stack || error)
  process.exit(1)
}
