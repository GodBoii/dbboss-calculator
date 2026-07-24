/* eslint-disable no-console */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const RESEARCH_DIR = __dirname
const ROOT = path.resolve(RESEARCH_DIR, '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, 'manifest.json'), 'utf8'))

function walk(relativePath) {
  const absolutePath = path.join(ROOT, relativePath)
  const stat = fs.statSync(absolutePath)
  if (stat.isFile()) return [relativePath.replace(/\\/g, '/')]
  return fs.readdirSync(absolutePath)
    .flatMap((name) => walk(path.join(relativePath, name)))
}

function fingerprint() {
  const files = manifest.productionBoundary.roots
    .flatMap((entry) => walk(entry))
    .sort()
  const hash = crypto.createHash('sha256')
  for (const relativePath of files) {
    hash.update(relativePath)
    hash.update('\0')
    hash.update(fs.readFileSync(path.join(ROOT, relativePath)))
    hash.update('\0')
  }
  return { digest: hash.digest('hex'), fileCount: files.length }
}

const actual = fingerprint()
const expected = manifest.productionBoundary
if (actual.digest !== expected.digest || actual.fileCount !== expected.fileCount) {
  console.error('PRODUCTION BOUNDARY CHANGED')
  console.error({ expected, actual })
  process.exit(1)
}

console.log(`Production guard passed: ${actual.fileCount} files, SHA-256 ${actual.digest}`)

