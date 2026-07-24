/* eslint-disable no-console */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const RESEARCH_DIR = __dirname
const FORWARD_DIR = path.join(RESEARCH_DIR, 'forward')

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function scheduledOpenUtc(entry) {
  const hours = Math.floor(entry.scheduledOpenMinuteIst / 60).toString().padStart(2, '0')
  const minutes = (entry.scheduledOpenMinuteIst % 60).toString().padStart(2, '0')
  return new Date(`${entry.targetDate}T${hours}:${minutes}:00+05:30`)
}

function main() {
  const arg = process.argv[2]
  const files = arg
    ? [path.resolve(arg)]
    : fs.readdirSync(FORWARD_DIR)
      .filter((name) => /^registry-.*\.json$/.test(name))
      .map((name) => path.join(FORWARD_DIR, name))
  if (!files.length) throw new Error('no registry files found')

  for (const file of files) {
    const registry = JSON.parse(fs.readFileSync(file, 'utf8'))
    const { registrySealSha256, ...core } = registry
    const actualSeal = sha256(Buffer.from(canonical(core)))
    if (actualSeal !== registrySealSha256) throw new Error(`${file}: registry seal mismatch`)
    const inputPath = path.resolve(path.dirname(file), registry.inputFile)
    const relative = path.relative(FORWARD_DIR, inputPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${file}: input path escapes forward directory`)
    if (sha256(fs.readFileSync(inputPath)) !== registry.inputSha256) throw new Error(`${file}: input hash mismatch`)

    for (const entry of registry.entries) {
      const open = entry.openRanking
      const close = entry.closeRanking
      const expectedJodis = open.flatMap((openDigit) => close.map((closeDigit) => `${openDigit}${closeDigit}`))
      if (open.length !== 6 || new Set(open).size !== 6) throw new Error(`${file}: invalid Open set for ${entry.market}`)
      if (close.length !== 6 || new Set(close).size !== 6) throw new Error(`${file}: invalid Close set for ${entry.market}`)
      if (entry.jodiRanking.length !== 36 || JSON.stringify(entry.jodiRanking) !== JSON.stringify(expectedJodis)) {
        throw new Error(`${file}: invalid Jodi rectangle for ${entry.market}`)
      }
      if (new Date(entry.generatedAtUtc) >= scheduledOpenUtc(entry)) {
        throw new Error(`${file}: late prediction for ${entry.market} ${entry.targetDate}`)
      }
      if (entry.ownDataCutoff >= entry.targetDate) throw new Error(`${file}: own-data leakage for ${entry.market}`)
      for (const [sourceMarket, cutoff] of Object.entries(entry.sourceDataCutoffs)) {
        if (cutoff >= entry.targetDate) throw new Error(`${file}: source leakage from ${sourceMarket} into ${entry.market}`)
      }
    }
    console.log(`Registry verified: ${path.basename(file)} (${registry.entries.length} entries, seal ${registrySealSha256})`)
  }
}

try {
  main()
} catch (error) {
  console.error(error.stack || error)
  process.exit(1)
}

