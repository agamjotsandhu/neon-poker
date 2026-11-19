import { RANKS, makeCard, rankOf, suitOf, type Card, type Rank } from '../engine/cards'
import { PREFLOP_EQUITY } from './data/preflopEquity'
import rangesJson from './data/preflopRanges.json'

/** Canonical starting-hand class: "AA", "AKs", "AKo". */
export type HandClass = string

export function handClass(cards: readonly Card[]): HandClass {
  const [a, b] = cards
  const ra = rankOf(a)
  const rb = rankOf(b)
  const hi = Math.max(ra, rb)
  const lo = Math.min(ra, rb)
  if (hi === lo) return RANKS[hi] + RANKS[lo]
  return RANKS[hi] + RANKS[lo] + (suitOf(a) === suitOf(b) ? 's' : 'o')
}

/** 13×13 grid: row/col 0 = Ace. Upper-right = suited, lower-left = offsuit, diagonal = pairs. */
export function gridClass(row: number, col: number): HandClass {
  const r1 = 12 - row
  const r2 = 12 - col
  if (row === col) return RANKS[r1] + RANKS[r1]
  if (row < col) return RANKS[r1] + RANKS[r2] + 's'
  return RANKS[r2] + RANKS[r1] + 'o'
}

export function classGridPos(hc: HandClass): { row: number; col: number } {
  const r1 = RANKS.indexOf(hc[0] as Rank)
  const r2 = RANKS.indexOf(hc[1] as Rank)
  if (hc.length === 2) return { row: 12 - r1, col: 12 - r1 }
  if (hc[2] === 's') return { row: 12 - r1, col: 12 - r2 }
  return { row: 12 - r2, col: 12 - r1 }
}

export const ALL_CLASSES: HandClass[] = (() => {
  const out: HandClass[] = []
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(gridClass(r, c))
  return out
})()

export const classCombos = (hc: HandClass): number => (hc.length === 2 ? 6 : hc[2] === 's' ? 4 : 12)

const ri = (ch: string) => {
  const i = RANKS.indexOf(ch as Rank)
  if (i < 0) throw new Error(`Bad rank ${ch}`)
  return i
}

/**
 * Parse standard range notation into hand classes.
 * Supports: 22+  TT  77-JJ  A2s+  ATo+  KQs  KQ (both)  A2s-A5s
 */
export function parseRange(text: string): Set<HandClass> {
  const out = new Set<HandClass>()
  const addNonPair = (hi: number, lo: number, suffix: string) => {
    if (suffix === 's' || suffix === '') out.add(RANKS[hi] + RANKS[lo] + 's')
    if (suffix === 'o' || suffix === '') out.add(RANKS[hi] + RANKS[lo] + 'o')
  }
  for (const raw of text.split(',')) {
    const tok = raw.trim()
    if (!tok) continue
    if (tok.includes('-')) {
      const [a, b] = tok.split('-')
      if (a[0] === a[1]) {
        const [lo, hi] = [ri(a[0]), ri(b[0])].sort((x, y) => x - y)
        for (let r = lo; r <= hi; r++) out.add(RANKS[r] + RANKS[r])
      } else {
        const [lo, hi] = [ri(a[1]), ri(b[1])].sort((x, y) => x - y)
        for (let r = lo; r <= hi; r++) addNonPair(ri(a[0]), r, a.slice(2))
      }
    } else if (tok.endsWith('+')) {
      const t = tok.slice(0, -1)
      if (t[0] === t[1]) {
        for (let r = ri(t[0]); r <= 12; r++) out.add(RANKS[r] + RANKS[r])
      } else {
        const hi = ri(t[0])
        for (let r = ri(t[1]); r < hi; r++) addNonPair(hi, r, t.slice(2))
      }
    } else if (tok[0] === tok[1]) {
      out.add(tok.slice(0, 2))
    } else {
      addNonPair(ri(tok[0]), ri(tok[1]), tok.slice(2))
    }
  }
  return out
}

/** All specific two-card combos of a class, excluding dead cards. */
export function combosOf(hc: HandClass, dead: ReadonlySet<Card> = new Set()): [Card, Card][] {
  const r1 = ri(hc[0])
  const r2 = ri(hc[1])
  const out: [Card, Card][] = []
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (r1 === r2 && s2 <= s1) continue
      const suited = s1 === s2
      if (r1 !== r2 && hc[2] === 's' && !suited) continue
      if (r1 !== r2 && hc[2] === 'o' && suited) continue
      const a = makeCard(r1, s1)
      const b = makeCard(r2, s2)
      if (dead.has(a) || dead.has(b)) continue
      out.push([a, b])
    }
  }
  return out
}

export function rangeCombos(classes: Iterable<HandClass>, dead: ReadonlySet<Card> = new Set()): [Card, Card][] {
  const out: [Card, Card][] = []
  for (const hc of classes) out.push(...combosOf(hc, dead))
  return out
}

/** Classes ordered strongest → weakest (heads-up all-in equity rank). */
export const CLASSES_BY_STRENGTH: HandClass[] = Object.entries(PREFLOP_EQUITY)
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([hc]) => hc)

/** Fraction of all 1326 combos that are at least as strong as this class (0..1, smaller = better). */
export function preflopPercentile(hc: HandClass): number {
  let combos = 0
  for (const c of CLASSES_BY_STRENGTH) {
    combos += classCombos(c)
    if (c === hc) break
  }
  return combos / 1326
}

/** The strongest `fraction` of starting hands (by combos). */
export function topRange(fraction: number): Set<HandClass> {
  const out = new Set<HandClass>()
  let combos = 0
  const target = fraction * 1326
  for (const c of CLASSES_BY_STRENGTH) {
    if (combos >= target) break
    out.add(c)
    combos += classCombos(c)
  }
  return out
}

export function rangeFraction(classes: Iterable<HandClass>): number {
  let n = 0
  for (const c of classes) n += classCombos(c)
  return n / 1326
}

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'

const rfiCache = new Map<string, Set<HandClass>>()
/** Raise-first-in range for a position (heads-up button uses the BTN range). */
export function rfiRange(pos: Position): Set<HandClass> {
  const key = pos === 'BB' ? 'SB' : pos
  if (!rfiCache.has(key)) {
    const txt = (rangesJson.rfi as Record<string, string>)[key]
    rfiCache.set(key, parseRange(txt))
  }
  return rfiCache.get(key)!
}

export const THREE_BET_LINEAR = parseRange(rangesJson.three_bet_linear_vs_early.range)
export const THREE_BET_POLAR = parseRange(rangesJson.three_bet_polar_vs_late.range)
export const BB_DEFEND = parseRange(rangesJson.bb_defend_vs_btn_2_5x_call.range)
/** In-position flatting range vs a single open (hands that play well postflop). */
export const FLAT_RANGE = parseRange('22-JJ,ATs-AQs,A5s-A4s,KTs+,QTs+,J9s+,T9s,98s,87s,76s,AQo,KQo')
export const FOUR_BET_VALUE = parseRange('QQ+,AKs,AKo')
export const CALL_THREE_BET = parseRange('TT-JJ,AQs,AJs,KQs,AQo')
export const STACK_OFF = parseRange('KK+,AKs')

export const isEarly = (pos: string) => pos === 'UTG' || pos === 'HJ'
