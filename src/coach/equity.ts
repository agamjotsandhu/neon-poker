import type { Card } from '../engine/cards'
import { evaluate } from '../engine/evaluator'
import { createRng } from '../engine/rng'

export interface EquityRequest {
  hero: Card[]
  board: Card[]
  /** One list of candidate two-card combos per opponent (empty list = any two cards). */
  opponents: [Card, Card][][]
  iterations: number
  seed?: number
}

export interface EquityResult {
  /** Win + share of ties, 0..1 */
  equity: number
  win: number
  tie: number
  iterations: number
}

/**
 * Monte Carlo all-in equity vs one or more opponent ranges.
 * Opponent holdings are sampled from their range avoiding card conflicts,
 * then the board is completed randomly.
 */
export function monteCarloEquity(req: EquityRequest): EquityResult {
  const rng = createRng(req.seed ?? 12345)
  const { hero, board } = req
  const nOpp = req.opponents.length
  const used = new Uint8Array(52)
  const baseDead = [...hero, ...board]
  const need = 5 - board.length
  const cards7 = new Array<number>(7)
  const oppHands: number[][] = Array.from({ length: nOpp }, () => [0, 0])
  const deck = new Int32Array(52)

  let wins = 0
  let ties = 0
  let valid = 0

  for (let it = 0; it < req.iterations; it++) {
    used.fill(0)
    for (const c of baseDead) used[c] = 1
    let ok = true
    for (let o = 0; o < nOpp; o++) {
      const range = req.opponents[o]
      let picked = false
      if (range.length > 0) {
        for (let tries = 0; tries < 24; tries++) {
          const combo = range[Math.floor(rng() * range.length)]
          if (!used[combo[0]] && !used[combo[1]]) {
            oppHands[o][0] = combo[0]
            oppHands[o][1] = combo[1]
            used[combo[0]] = 1
            used[combo[1]] = 1
            picked = true
            break
          }
        }
      }
      if (!picked) {
        // Random hand fallback (range blocked or "any two")
        if (range.length > 0 && range.length < 4) {
          ok = false
          break
        }
        for (let k = 0; k < 2; k++) {
          let c: number
          do c = Math.floor(rng() * 52)
          while (used[c])
          used[c] = 1
          oppHands[o][k] = c
        }
      }
    }
    if (!ok) continue

    let n = 0
    for (let c = 0; c < 52; c++) if (!used[c]) deck[n++] = c
    // Partial Fisher–Yates for the remaining board cards
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (n - k))
      const t = deck[k]
      deck[k] = deck[j]
      deck[j] = t
    }

    for (let k = 0; k < board.length; k++) cards7[2 + k] = board[k]
    for (let k = 0; k < need; k++) cards7[2 + board.length + k] = deck[k]

    cards7[0] = hero[0]
    cards7[1] = hero[1]
    const heroScore = evaluate(cards7)
    let tiedWithHero = 0
    let heroBeaten = false
    for (let o = 0; o < nOpp; o++) {
      cards7[0] = oppHands[o][0]
      cards7[1] = oppHands[o][1]
      const s = evaluate(cards7)
      if (s > heroScore) {
        heroBeaten = true
        break
      }
      if (s === heroScore) tiedWithHero++
    }
    valid++
    if (heroBeaten) continue
    if (tiedWithHero === 0) wins++
    else ties += 1 / (tiedWithHero + 1)
  }

  const iters = Math.max(1, valid)
  return { equity: (wins + ties) / iters, win: wins / iters, tie: ties / iters, iterations: valid }
}
