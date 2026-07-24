/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")

const ROOT = process.cwd()
const PANEL_LEDGER = path.join(ROOT, "research", "panel_top30_v2", "holdout_ledger.csv")
const SUTTA_LEDGER = path.join(ROOT, "scratch", "sutta-baseline-180d-top3-top4-20260715.json")
const OUTPUT_DIR = path.join(ROOT, "backtest_reports", "2026-07-16")
const OUTPUT_JSON = path.join(OUTPUT_DIR, "combined-bet-strategy-results.json")
const OUTPUT_REPORT = path.join(OUTPUT_DIR, "combined-bet-strategy-research.md")

const PANEL_PAYOUT = { SP: 140, DP: 280, TP: 900 }
const DIGITS = Array.from({ length: 10 }, (_, index) => index)

function combinations(values, size) {
  const result = []
  const visit = (start, picked) => {
    if (picked.length === size) {
      result.push([...picked])
      return
    }
    for (let index = start; index <= values.length - (size - picked.length); index += 1) {
      picked.push(values[index])
      visit(index + 1, picked)
      picked.pop()
    }
  }
  visit(0, [])
  return result
}

const SUBSETS = Object.fromEntries([2, 5, 6, 7, 8].map((size) => [size, combinations(DIGITS, size)]))
const DIGIT_PAIRS = combinations(DIGITS, 2)

function panelKind(panel) {
  const unique = new Set(panel.split(""))
  if (unique.size === 3) return "SP"
  if (unique.size === 2) return "DP"
  return "TP"
}

function panelDigits(panel) {
  return new Set(panel.split("").map(Number))
}

function isSubset(panel, allowedDigits) {
  const allowed = new Set(allowedDigits)
  return [...panelDigits(panel)].every((digit) => allowed.has(digit))
}

function pairKey(pair) {
  return [...pair].sort((a, b) => a - b).join("")
}

function actualDpPair(panel) {
  return pairKey([...panelDigits(panel)])
}

function reciprocalRankWeight(rankIndex) {
  return 1 / Math.log2(rankIndex + 2)
}

function readPanelLedger() {
  const lines = fs.readFileSync(PANEL_LEDGER, "utf8").trim().split(/\r?\n/)
  const header = lines.shift().split(",")
  return lines.map((line) => {
    const fields = line.split(",")
    const row = Object.fromEntries(header.map((name, index) => [name, fields[index]]))
    return {
      task: row.task,
      split: row.split,
      date: row.date,
      market: row.market,
      actual: row.actual,
      top30: row.top30.trim().split(/\s+/),
    }
  })
}

function pct(value, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`
}

function signedPct(value, digits = 1) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`
}

function chooseAllowedSubset(top30, kind, size) {
  let winner = SUBSETS[size][0]
  let winnerScore = -1
  for (const subset of SUBSETS[size]) {
    let score = 0
    top30.forEach((panel, rankIndex) => {
      if (panelKind(panel) === kind && isSubset(panel, subset)) {
        score += reciprocalRankWeight(rankIndex)
      }
    })
    if (score > winnerScore) {
      winner = subset
      winnerScore = score
    }
  }
  return winner
}

function chooseAvoidDigits(top30, count) {
  const exposure = Array(10).fill(0)
  top30.forEach((panel, rankIndex) => {
    for (const digit of panelDigits(panel)) exposure[digit] += reciprocalRankWeight(rankIndex)
  })
  return DIGITS.slice().sort((a, b) => exposure[a] - exposure[b] || a - b).slice(0, count)
}

function chooseDpPairs(top30, count) {
  const scores = new Map(DIGIT_PAIRS.map((pair) => [pairKey(pair), 0]))
  top30.forEach((panel, rankIndex) => {
    if (panelKind(panel) !== "DP") return
    const key = actualDpPair(panel)
    scores.set(key, scores.get(key) + reciprocalRankWeight(rankIndex))
  })
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, count)
    .map(([key]) => key)
}

function portfolioMetrics(rows, topN) {
  let hits = 0
  let gross = 0
  for (const row of rows) {
    if (row.top30.slice(0, topN).includes(row.actual)) {
      hits += 1
      gross += PANEL_PAYOUT[panelKind(row.actual)]
    }
  }
  const stake = rows.length * topN
  return {
    n: rows.length,
    topN,
    hits,
    hitRate: hits / rows.length,
    grossReturn: gross,
    stake,
    roi: gross / stake - 1,
  }
}

function motorMetrics(rows, kind, size) {
  const tickets = kind === "SP" ? (size * (size - 1) * (size - 2)) / 6 : size * (size - 1)
  let hits = 0
  let kindCount = 0
  for (const row of rows) {
    const actualKind = panelKind(row.actual)
    if (actualKind === kind) kindCount += 1
    const allowed = chooseAllowedSubset(row.top30, kind, size)
    if (actualKind === kind && isSubset(row.actual, allowed)) hits += 1
  }
  const kindUniverse = kind === "SP" ? 120 : 90
  const nominalCoverage = (kindCount / rows.length) * (tickets / kindUniverse)
  const gross = hits * PANEL_PAYOUT[kind]
  const stake = rows.length * tickets
  return {
    n: rows.length,
    kind,
    selectedDigits: size,
    tickets,
    hits,
    hitRate: hits / rows.length,
    nominalCoverage,
    lift: hits / rows.length - nominalCoverage,
    breakEvenHitRate: tickets / PANEL_PAYOUT[kind],
    roi: gross / stake - 1,
  }
}

function avoidMetrics(rows, count) {
  let strictHits = 0
  let correctDigits = 0
  let randomStrictTotal = 0
  for (const row of rows) {
    const avoided = chooseAvoidDigits(row.top30, count)
    const actualDigits = panelDigits(row.actual)
    const correct = avoided.filter((digit) => !actualDigits.has(digit)).length
    correctDigits += correct
    if (correct === count) strictHits += 1
    const absentCount = 10 - actualDigits.size
    const possibleCorrectSets = combinations(Array.from({ length: absentCount }, (_, index) => index), count).length
    const possibleSets = combinations(DIGITS, count).length
    randomStrictTotal += possibleCorrectSets / possibleSets
  }
  return {
    n: rows.length,
    avoidedDigits: count,
    strictHits,
    strictAccuracy: strictHits / rows.length,
    randomStrictAccuracy: randomStrictTotal / rows.length,
    perDigitAccuracy: correctDigits / (rows.length * count),
    averageCorrect: correctDigits / rows.length,
  }
}

function dpPairMetrics(rows, pairCount) {
  let hits = 0
  let dpCount = 0
  for (const row of rows) {
    if (panelKind(row.actual) === "DP") {
      dpCount += 1
      if (chooseDpPairs(row.top30, pairCount).includes(actualDpPair(row.actual))) hits += 1
    }
  }
  const tickets = pairCount * 2
  const nominalCoverage = (dpCount / rows.length) * (pairCount / 45)
  const gross = hits * PANEL_PAYOUT.DP
  const stake = rows.length * tickets
  return {
    n: rows.length,
    pairCount,
    tickets,
    hits,
    hitRate: hits / rows.length,
    conditionalDpRecall: dpCount ? hits / dpCount : 0,
    nominalCoverage,
    breakEvenHitRate: tickets / PANEL_PAYOUT.DP,
    roi: gross / stake - 1,
  }
}

function choukdaMetrics(panelRows, suttaRows, split, direction, panelN, suttaN, payout) {
  const suttaByKey = new Map(suttaRows.map((row) => [`${row.market}|${row.isoDate}`, row]))
  let n = 0
  let panelHits = 0
  let suttaHits = 0
  let jointHits = 0
  for (const row of panelRows) {
    const sutta = suttaByKey.get(`${row.market}|${row.date}`)
    if (!sutta) continue
    n += 1
    const panelHit = row.top30.slice(0, panelN).includes(row.actual)
    const ranking = direction === "openPanel_closeSutta" ? sutta.closeRanking : sutta.openRanking
    const actual = direction === "openPanel_closeSutta" ? sutta.actualClose : sutta.actualOpen
    const suttaHit = ranking.slice(0, suttaN).includes(actual)
    if (panelHit) panelHits += 1
    if (suttaHit) suttaHits += 1
    if (panelHit && suttaHit) jointHits += 1
  }
  const tickets = panelN * suttaN
  return {
    split,
    direction,
    n,
    panelN,
    suttaN,
    tickets,
    payout,
    panelHitRate: panelHits / n,
    suttaHitRate: suttaHits / n,
    jointHits,
    jointHitRate: jointHits / n,
    independenceReference: (panelHits / n) * (suttaHits / n),
    breakEvenHitRate: tickets / payout,
    roi: (jointHits * payout) / (n * tickets) - 1,
  }
}

function wilson95(hits, n) {
  if (!n) return [0, 0]
  const z = 1.959963984540054
  const p = hits / n
  const denominator = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denominator
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

function markdownTable(headers, rows) {
  const alignment = headers.map((_, index) => index < 2 ? "---" : "---:")
  return [
    `| ${headers.join(" | ")} |`,
    `| ${alignment.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n")
}

function main() {
  const panelLedger = readPanelLedger()
  const suttaPayload = JSON.parse(fs.readFileSync(SUTTA_LEDGER, "utf8"))
  const splits = ["terminal_holdout", "prospective_forward"]
  const panelTasks = ["open", "close_preopen"]
  const results = {
    generatedAt: new Date().toISOString(),
    assumptions: {
      panelPayoutGross: PANEL_PAYOUT,
      oneUnitPerGeneratedPanel: true,
      choukdaPayoutScenarios: [1200, 12],
      rankWeight: "1 / log2(rank + 1), with one-based rank",
    },
    panelPortfolio: [],
    motorPanel: [],
    avoidDigits: [],
    dpPairs: [],
    choukda: [],
  }

  for (const split of splits) {
    for (const task of panelTasks) {
      const rows = panelLedger.filter((row) => row.split === split && row.task === task)
      for (const topN of [1, 3, 10, 30]) {
        results.panelPortfolio.push({ split, task, ...portfolioMetrics(rows, topN) })
      }
      for (const kind of ["SP", "DP"]) {
        for (const size of [5, 6, 7, 8]) {
          results.motorPanel.push({ split, task, ...motorMetrics(rows, kind, size) })
        }
      }
      for (const count of [2, 4]) {
        results.avoidDigits.push({ split, task, ...avoidMetrics(rows, count) })
      }
      for (const pairCount of [1, 2, 3, 5]) {
        results.dpPairs.push({ split, task, ...dpPairMetrics(rows, pairCount) })
      }
    }
  }

  for (const payout of [1200, 12]) {
    for (const split of splits) {
      const openRows = panelLedger.filter((row) => row.split === split && row.task === "open")
      const closeRows = panelLedger.filter((row) => row.split === split && row.task === "close_preopen")
      for (const [direction, rows] of [["openPanel_closeSutta", openRows], ["openSutta_closePanel", closeRows]]) {
        for (const panelN of [1, 3, 10, 30]) {
          for (const suttaN of [1, 3, 4, 6]) {
            results.choukda.push(choukdaMetrics(rows, suttaPayload.ledger, split, direction, panelN, suttaN, payout))
          }
        }
      }
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(results, null, 2)}\n`)

  const terminalPanels = results.panelPortfolio.filter((row) => row.split === "terminal_holdout")
  const terminalMotor = results.motorPanel.filter((row) => row.split === "terminal_holdout")
  const terminalAvoid = results.avoidDigits.filter((row) => row.split === "terminal_holdout")
  const terminalPairs = results.dpPairs.filter((row) => row.split === "terminal_holdout")
  const forwardMotor = results.motorPanel.filter((row) => row.split === "prospective_forward")
  const choukda1200 = results.choukda.filter((row) => row.payout === 1200 && row.split === "terminal_holdout")
  const choukda12 = results.choukda.filter((row) => row.payout === 12 && row.split === "terminal_holdout")
  const bestChoukda1200 = [...choukda1200].sort((a, b) => b.roi - a.roi)[0]
  const bestChoukda12 = [...choukda12].sort((a, b) => b.roi - a.roi)[0]
  const matchingForwardChoukda1200 = results.choukda.find((row) =>
    row.payout === 1200
    && row.split === "prospective_forward"
    && row.direction === bestChoukda1200.direction
    && row.panelN === bestChoukda1200.panelN
    && row.suttaN === bestChoukda1200.suttaN
  )
  const matchingForwardChoukda12 = results.choukda.find((row) =>
    row.payout === 12
    && row.split === "prospective_forward"
    && row.direction === bestChoukda12.direction
    && row.panelN === bestChoukda12.panelN
    && row.suttaN === bestChoukda12.suttaN
  )
  const mpspClose5Terminal = terminalMotor.find((row) => row.task === "close_preopen" && row.kind === "SP" && row.selectedDigits === 5)
  const mpspClose5Forward = forwardMotor.find((row) => row.task === "close_preopen" && row.kind === "SP" && row.selectedDigits === 5)
  const mpspCombinedHits = mpspClose5Terminal.hits + mpspClose5Forward.hits
  const mpspCombinedN = mpspClose5Terminal.n + mpspClose5Forward.n
  const mpspCombinedRate = mpspCombinedHits / mpspCombinedN
  const mpspCombinedRoi = (mpspCombinedHits * PANEL_PAYOUT.SP) / (mpspCombinedN * mpspClose5Terminal.tickets) - 1
  const mpspCombinedWilson = wilson95(mpspCombinedHits, mpspCombinedN)
  const closeTop10Terminal = terminalPanels.find((row) => row.task === "close_preopen" && row.topN === 10)
  const closeTop10Forward = results.panelPortfolio.find((row) => row.split === "prospective_forward" && row.task === "close_preopen" && row.topN === 10)
  const closeTop10CombinedHits = closeTop10Terminal.hits + closeTop10Forward.hits
  const closeTop10CombinedN = closeTop10Terminal.n + closeTop10Forward.n
  const closeTop10CombinedRate = closeTop10CombinedHits / closeTop10CombinedN
  const closeTop10CombinedGross = closeTop10Terminal.grossReturn + closeTop10Forward.grossReturn
  const closeTop10CombinedRoi = closeTop10CombinedGross / (closeTop10CombinedN * closeTop10Terminal.topN) - 1
  const closeTop10CombinedWilson = wilson95(closeTop10CombinedHits, closeTop10CombinedN)

  const lines = []
  lines.push("# Combined prediction and bet-strategy audit")
  lines.push("")
  lines.push(`Generated: ${results.generatedAt}`)
  lines.push("")
  lines.push("## Executive decision")
  lines.push("")
  lines.push("The historical evidence does not support a no-loss betting strategy. A separate absence view is useful as a constraint and abstention signal, but it is not independent evidence when derived from the same panel ranking. The only credible next product is a calibrated probability-and-value engine that is allowed to output **NO BET**.")
  lines.push("")
  lines.push("Under the stated payout assumptions, none of the broad ticket families is promoted from this audit. Positive-looking small pockets must survive a frozen prospective ledger, confidence intervals, and corrected model-selection tests before any user-facing recommendation.")
  lines.push("")
  lines.push(`The strongest payout-aware research candidate is the pre-Open Close exact-panel Top-10 portfolio: ${closeTop10CombinedHits}/${closeTop10CombinedN} hits (${pct(closeTop10CombinedRate)}), ${signedPct(closeTop10CombinedRoi)} ROI, with a 95% Wilson hit-rate interval of ${pct(closeTop10CombinedWilson[0])}-${pct(closeTop10CombinedWilson[1])}. The ${pct(10 / PANEL_PAYOUT.SP)} SP break-even rate remains inside that interval, so the edge is unproven.`)
  lines.push("")
  lines.push(`The most temporally stable transformed candidate is five-digit pre-Open Close MPSP: ${mpspCombinedHits}/${mpspCombinedN} hits (${pct(mpspCombinedRate)}), ${signedPct(mpspCombinedRoi)} ROI, with a 95% Wilson hit-rate interval of ${pct(mpspCombinedWilson[0])}-${pct(mpspCombinedWilson[1])}. Its ${pct(mpspClose5Terminal.breakEvenHitRate)} break-even rate also remains inside the interval.`)
  lines.push("")
  lines.push("## Assumptions")
  lines.push("")
  lines.push("- Every generated panel or Choukda cross-product is charged one unit.")
  lines.push("- Gross panel payouts are SP 140, DP 280, TP 900 units. If these are net-profit quotes, returns change slightly.")
  lines.push("- Choukda is evaluated twice: 1200 units per winning exact combination, and 12x gross return. The user's phrase '1200%' is ambiguous, so the two interpretations are not mixed.")
  lines.push("- Rankings are frozen, chronological out-of-sample predictions from the existing research ledgers.")
  lines.push("")
  lines.push("## Exact-panel portfolio economics: terminal holdout")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Top N", "Hits", "Hit rate", "ROI"],
    terminalPanels.map((row) => [row.task, row.topN, `${row.hits}/${row.n}`, pct(row.hitRate), signedPct(row.roi)]),
  ))
  lines.push("")
  lines.push("ROI counts all selected panels as separate one-unit tickets. Coverage alone is not profit.")
  lines.push("")
  lines.push("## Exact-panel portfolio economics: prospective forward")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Top N", "Hits", "Hit rate", "ROI"],
    results.panelPortfolio.filter((row) => row.split === "prospective_forward").map((row) => [row.task, row.topN, `${row.hits}/${row.n}`, pct(row.hitRate), signedPct(row.roi)]),
  ))
  lines.push("")
  lines.push("## MPSP and MPDP: terminal holdout")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Bet", "Digits", "Tickets", "Hits", "Hit rate", "Random-set reference", "Break-even", "ROI"],
    terminalMotor.map((row) => [
      row.task,
      row.kind === "SP" ? "MPSP" : "MPDP",
      row.selectedDigits,
      row.tickets,
      `${row.hits}/${row.n}`,
      pct(row.hitRate),
      pct(row.nominalCoverage),
      pct(row.breakEvenHitRate),
      signedPct(row.roi),
    ]),
  ))
  lines.push("")
  lines.push("The selected digit set maximizes reciprocal-rank mass among the model's Top-30 panels of the requested kind. This is the direct implementation of 'likely present' plus its complementary avoided digits.")
  lines.push("")
  lines.push("## Forward MPSP and MPDP check")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Bet", "Digits", "Hits", "Hit rate", "Break-even", "ROI"],
    forwardMotor.map((row) => [row.task, row.kind === "SP" ? "MPSP" : "MPDP", row.selectedDigits, `${row.hits}/${row.n}`, pct(row.hitRate), pct(row.breakEvenHitRate), signedPct(row.roi)]),
  ))
  lines.push("")
  lines.push("The forward block has only 78 rows per side, so it can falsify large claims but cannot certify a narrow edge.")
  lines.push("")
  lines.push("## Avoid-digit reliability")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Avoid count", "All avoided digits absent", "Random strict reference", "Per-digit accuracy", "Average correct"],
    terminalAvoid.map((row) => [row.task, row.avoidedDigits, `${row.strictHits}/${row.n} (${pct(row.strictAccuracy)})`, pct(row.randomStrictAccuracy), pct(row.perDigitAccuracy), `${row.averageCorrect.toFixed(2)}/${row.avoidedDigits}`]),
  ))
  lines.push("")
  lines.push("Per-digit accuracy is a misleading headline because most digits are absent from every panel. The strict all-digits-absent event is the relevant test for using the output as a hard filter.")
  lines.push("")
  lines.push("## DP two-number pair predictions")
  lines.push("")
  lines.push(markdownTable(
    ["Side", "Pairs", "Tickets", "Hits", "Hit rate", "DP recall", "Random reference", "Break-even", "ROI"],
    terminalPairs.map((row) => [row.task, row.pairCount, row.tickets, `${row.hits}/${row.n}`, pct(row.hitRate), pct(row.conditionalDpRecall), pct(row.nominalCoverage), pct(row.breakEvenHitRate), signedPct(row.roi)]),
  ))
  lines.push("")
  lines.push("Each unordered DP digit pair expands to two exact DP panels, so ticket cost is two units per pair.")
  lines.push("")
  lines.push("## Choukda cross-product audit")
  lines.push("")
  lines.push("Best observed configuration under a 1200-unit gross payout:")
  lines.push("")
  lines.push(markdownTable(
    ["Direction", "Panel N", "Sutta N", "Tickets", "Hits", "Joint hit rate", "Break-even", "ROI"],
    [
      [`${bestChoukda1200.direction} (terminal)`, bestChoukda1200.panelN, bestChoukda1200.suttaN, bestChoukda1200.tickets, `${bestChoukda1200.jointHits}/${bestChoukda1200.n}`, pct(bestChoukda1200.jointHitRate), pct(bestChoukda1200.breakEvenHitRate), signedPct(bestChoukda1200.roi)],
      [`${matchingForwardChoukda1200.direction} (forward)`, matchingForwardChoukda1200.panelN, matchingForwardChoukda1200.suttaN, matchingForwardChoukda1200.tickets, `${matchingForwardChoukda1200.jointHits}/${matchingForwardChoukda1200.n}`, pct(matchingForwardChoukda1200.jointHitRate), pct(matchingForwardChoukda1200.breakEvenHitRate), signedPct(matchingForwardChoukda1200.roi)],
    ],
  ))
  lines.push("")
  lines.push("Best observed configuration if '1200%' means only 12x gross:")
  lines.push("")
  lines.push(markdownTable(
    ["Direction", "Panel N", "Sutta N", "Tickets", "Hits", "Joint hit rate", "Break-even", "ROI"],
    [
      [`${bestChoukda12.direction} (terminal)`, bestChoukda12.panelN, bestChoukda12.suttaN, bestChoukda12.tickets, `${bestChoukda12.jointHits}/${bestChoukda12.n}`, pct(bestChoukda12.jointHitRate), pct(bestChoukda12.breakEvenHitRate), signedPct(bestChoukda12.roi)],
      [`${matchingForwardChoukda12.direction} (forward)`, matchingForwardChoukda12.panelN, matchingForwardChoukda12.suttaN, matchingForwardChoukda12.tickets, `${matchingForwardChoukda12.jointHits}/${matchingForwardChoukda12.n}`, pct(matchingForwardChoukda12.jointHitRate), pct(matchingForwardChoukda12.breakEvenHitRate), signedPct(matchingForwardChoukda12.roi)],
    ],
  ))
  lines.push("")
  lines.push("These are maxima over 32 configurations per payout interpretation, so they are selection-biased research results, not deployable evidence. A fresh frozen test is required.")
  lines.push("")
  lines.push("## Recommended model architecture")
  lines.push("")
  lines.push("1. Train one calibrated 220-panel probability distribution per market and side, using only information available at prediction time.")
  lines.push("2. Derive coherent marginals from that distribution: sutta, SP/DP/TP, digit-present, digit-absent, DP pair, MPSP/MPDP set, and Choukda joint probabilities.")
  lines.push("3. Add a genuinely independent residual/absence model only if its out-of-fold predictions improve log loss, Brier score, calibration, and payout-aware utility after stacking.")
  lines.push("4. Price every possible ticket or ticket set: EV = calibrated win probability × gross payout − total stake.")
  lines.push("5. Output NO BET unless the lower confidence bound on EV is positive after bookmaker/source uncertainty and multiple-testing correction.")
  lines.push("6. Freeze model hashes and log prediction timestamp, data cutoff, full probability vector, offered payout, selected tickets, stake, and realized result.")
  lines.push("")
  lines.push("## Promotion gate")
  lines.push("")
  lines.push("A bet family should be user-facing only after at least three untouched forward blocks, positive aggregate ROI, no catastrophic market-side block, calibrated probabilities, and a predeclared false-discovery correction. Until then the app should label outputs as research ratings, not probabilities or safe bets.")
  lines.push("")
  lines.push("## Methodological references")
  lines.push("")
  lines.push("- Gneiting and Raftery, *Probabilistic Forecasts, Calibration and Sharpness* (2007): evaluate probability distributions with calibration, sharpness, and proper scoring rules.")
  lines.push("- van der Laan, Polley, and Hubbard, *Super Learner* (2007): learn ensemble weights from cross-validated predictions rather than combining model opinions by hand.")
  lines.push("- White, *A Reality Check for Data Snooping* (2000): adjust claims about the best strategy when many alternatives were searched.")
  lines.push("- Angelopoulos et al., *Conformal Risk Control* (2022): calibrate prediction-set or abstention rules against an explicit risk target.")

  fs.writeFileSync(OUTPUT_REPORT, `${lines.join("\n")}\n`)
  console.log(`Wrote ${OUTPUT_JSON}`)
  console.log(`Wrote ${OUTPUT_REPORT}`)
}

main()
