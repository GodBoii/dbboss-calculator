import type { SuttaPick } from "./types"

/**
 * Jodi construction is intentionally isolated from Open/Close ranking code.
 * It accepts immutable digit sets and owns only the 36-combination contract.
 */
export function buildJodiSet(openSuttas: SuttaPick[], closeSuttas: SuttaPick[]): string[] {
  const orderedUnique = (picks: SuttaPick[]) => {
    const seen = new Set<number>()
    return [...picks]
      .sort((a, b) => a.rank - b.rank || b.probabilityPct - a.probabilityPct || a.sutta - b.sutta)
      .filter((pick) => {
        if (seen.has(pick.sutta)) return false
        seen.add(pick.sutta)
        return true
      })
  }
  const open = orderedUnique(openSuttas)
  const close = orderedUnique(closeSuttas)
  return open.flatMap((openPick) => close.map((closePick) => `${openPick.sutta}${closePick.sutta}`))
}
