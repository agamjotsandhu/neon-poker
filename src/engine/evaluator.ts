import type { Card } from './cards'
import { RANK_NAMES, RANK_PLURALS, rankOf, suitOf } from './cards'

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  Trips: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  Quads: 7,
  StraightFlush: 8,
} as const
export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory]

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
}

/**
 * Score layout: category in bits 20..23, then up to five 4-bit rank
 * tie-breakers (most significant first). Higher score = better hand.
 * Straights store only the high card (wheel = Five high).
 */
const pack = (cat: number, k: readonly number[]): number => {
  let s = cat
  for (let i = 0; i < 5; i++) s = (s << 4) | (k[i] ?? 0)
  return s
}

export const categoryOf = (score: number): HandCategory => (score >> 20) as HandCategory

/** Highest straight in a 13-bit rank mask; returns high-card rank index or -1. Handles the wheel. */
function straightHigh(mask: number): number {
  // Shift up one and put the ace in bit 0 too, so A-2-3-4-5 is five consecutive bits.
  const m = (mask << 1) | ((mask >> 12) & 1)
  for (let hi = 13; hi >= 4; hi--) {
    const run = 0b11111 << (hi - 4)
    if ((m & run) === run) return hi - 1
  }
  return -1
}

function topBits(mask: number, n: number): number[] {
  const out: number[] = []
  for (let r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r)
  return out
}

const counts = new Int8Array(13)
const suitMasks = new Int32Array(4)
const suitCounts = new Int8Array(4)

/** Evaluate 5–7 cards and return a comparable score. Hot path for Monte Carlo. */
export function evaluate(cards: readonly Card[]): number {
  counts.fill(0)
  suitMasks.fill(0)
  suitCounts.fill(0)
  let rankMask = 0
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    const r = c >> 2
    const s = c & 3
    counts[r]++
    suitMasks[s] |= 1 << r
    suitCounts[s]++
    rankMask |= 1 << r
  }

  let flushSuit = -1
  for (let s = 0; s < 4; s++) if (suitCounts[s] >= 5) flushSuit = s

  if (flushSuit >= 0) {
    const sf = straightHigh(suitMasks[flushSuit])
    if (sf >= 0) return pack(HandCategory.StraightFlush, [sf])
  }

  let quad = -1
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 12; r >= 0; r--) {
    const n = counts[r]
    if (n === 4) quad = r
    else if (n === 3) trips.push(r)
    else if (n === 2) pairs.push(r)
  }

  if (quad >= 0) {
    const kicker = topBits(rankMask & ~(1 << quad), 1)
    return pack(HandCategory.Quads, [quad, ...kicker])
  }

  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    // Second trips can serve as the pair (e.g. 777 333 x → sevens full of threes)
    const pairRank = Math.max(trips[1] ?? -1, pairs[0] ?? -1)
    return pack(HandCategory.FullHouse, [trips[0], pairRank])
  }

  if (flushSuit >= 0) return pack(HandCategory.Flush, topBits(suitMasks[flushSuit], 5))

  const st = straightHigh(rankMask)
  if (st >= 0) return pack(HandCategory.Straight, [st])

  if (trips.length > 0) {
    const kick = topBits(rankMask & ~(1 << trips[0]), 2)
    return pack(HandCategory.Trips, [trips[0], ...kick])
  }

  if (pairs.length >= 2) {
    const kick = topBits(rankMask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1)
    return pack(HandCategory.TwoPair, [pairs[0], pairs[1], ...kick])
  }

  if (pairs.length === 1) {
    const kick = topBits(rankMask & ~(1 << pairs[0]), 3)
    return pack(HandCategory.Pair, [pairs[0], ...kick])
  }

  return pack(HandCategory.HighCard, topBits(rankMask, 5))
}

export interface HandResult {
  score: number
  category: HandCategory
  /** The five cards that make the hand (for highlighting). */
  best: Card[]
  /** e.g. "Full House, Kings full of Sevens" */
  name: string
}

function combinations5(cards: readonly Card[]): Card[][] {
  const out: Card[][] = []
  const n = cards.length
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) out.push([cards[a], cards[b], cards[c], cards[d], cards[e]])
  return out
}

/** Full evaluation with the best five cards and a human-readable name. Not for hot loops. */
export function evaluateHand(cards: readonly Card[]): HandResult {
  if (cards.length < 5) throw new Error('evaluateHand needs at least 5 cards')
  let bestScore = -1
  let best: Card[] = []
  for (const combo of combinations5(cards)) {
    const s = evaluate(combo)
    if (s > bestScore) {
      bestScore = s
      best = combo
    }
  }
  // Order the five cards for display: grouped by rank frequency, then rank.
  const freq = new Map<number, number>()
  for (const c of best) freq.set(rankOf(c), (freq.get(rankOf(c)) ?? 0) + 1)
  const cat = categoryOf(bestScore)
  const wheel = (cat === HandCategory.Straight || cat === HandCategory.StraightFlush) && tiebreak(bestScore)[0] === 3
  best = best.slice().sort((x, y) => {
    const fx = freq.get(rankOf(x))!
    const fy = freq.get(rankOf(y))!
    if (fx !== fy) return fy - fx
    const rx = wheel && rankOf(x) === 12 ? -1 : rankOf(x)
    const ry = wheel && rankOf(y) === 12 ? -1 : rankOf(y)
    return ry - rx || suitOf(y) - suitOf(x)
  })
  return { score: bestScore, category: cat, best, name: describeScore(bestScore) }
}

/** Tie-break ranks (most significant first) encoded in a score. */
export function tiebreak(score: number): number[] {
  return [16, 12, 8, 4, 0].map((sh) => (score >> sh) & 0xf)
}

export function describeScore(score: number): string {
  const cat = categoryOf(score)
  const [a, b] = tiebreak(score)
  switch (cat) {
    case HandCategory.StraightFlush:
      return a === 12 ? 'Royal Flush' : `Straight Flush, ${RANK_NAMES[a]} high`
    case HandCategory.Quads:
      return `Four of a Kind, ${RANK_PLURALS[a]}`
    case HandCategory.FullHouse:
      return `Full House, ${RANK_PLURALS[a]} full of ${RANK_PLURALS[b]}`
    case HandCategory.Flush:
      return `Flush, ${RANK_NAMES[a]} high`
    case HandCategory.Straight:
      return `Straight, ${RANK_NAMES[a]} high`
    case HandCategory.Trips:
      return `Three of a Kind, ${RANK_PLURALS[a]}`
    case HandCategory.TwoPair:
      return `Two Pair, ${RANK_PLURALS[a]} and ${RANK_PLURALS[b]}`
    case HandCategory.Pair:
      return `Pair of ${RANK_PLURALS[a]}, ${RANK_NAMES[b]} kicker`
    default:
      return `${RANK_NAMES[a]} high`
  }
}

/** Compare two hands: >0 if a wins, <0 if b wins, 0 for a split. */
export const compareHands = (a: readonly Card[], b: readonly Card[]): number =>
  evaluate(a) - evaluate(b)
