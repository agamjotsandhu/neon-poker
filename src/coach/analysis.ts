import type { Card } from '../engine/cards'
import type { EquityRequest } from './equity'
import { estimateRange } from './opponentRange'
import type { Situation } from './situation'

export interface EquityJob {
  request: EquityRequest
  rangeLabels: string[]
}

/** Build the Monte Carlo request: hero vs each live opponent's estimated range. */
export function prepareEquityJob(s: Situation, iterations = 6000, seed = 7): EquityJob {
  const dead = new Set<Card>([...s.hero, ...s.board])
  const ranges = s.opponents.map((o) => estimateRange(o, dead, s.board))
  return {
    request: {
      hero: s.hero,
      board: s.board,
      opponents: ranges.map((r) => r.combos),
      iterations,
      seed,
    },
    rangeLabels: ranges.map((r) => r.label),
  }
}
