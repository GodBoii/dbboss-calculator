// A calibration state contains only outcomes from earlier completed dates.
// Ten percentage-point bins keep enough observations for shortlist outcomes.
function createCalibration() {
  return Array.from({ length: 10 }, () => ({ n: 0, hits: 0 }))
}

function bucket(probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('Probability must be between zero and one')
  return Math.min(9, Math.floor(probability * 10))
}

function calibrate(state, probability) {
  const bin = state[bucket(probability)]
  // Stay with raw confidence until this bin has enough prior outcomes.
  // The 20 pseudo-observations shrink back toward the supplied probability.
  return { probability: bin.n < 120 ? probability : (bin.hits + 20 * probability) / (bin.n + 20), priorPredictions: bin.n }
}

function observe(state, probability, hit) {
  if (hit !== 0 && hit !== 1) throw new Error('Outcome must be zero or one')
  const bin = state[bucket(probability)]
  bin.n++; bin.hits += hit
}

module.exports = { createCalibration, calibrate, observe }
