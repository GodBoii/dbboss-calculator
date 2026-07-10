import type { getSuttaSignal } from "../predictor"

export interface SuttaPick {
  sutta: number
  rank: number
  score: number
  /** Normalized per-digit model rating. All ten ranked digits sum to 100%. */
  probabilityPct: number
  signalColor: string
  signalLabel: string
  signalState: ReturnType<typeof getSuttaSignal>["state"]
  isFresh: boolean
  isSnapback: boolean
}
