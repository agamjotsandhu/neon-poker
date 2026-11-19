import { RANK_NAMES, cardToString, rankOf, suitOf, type Card } from '../engine/cards'
import { HandCategory, categoryOf, evaluate, tiebreak } from '../engine/evaluator'

export type DrawKind =
  'flush-draw' | 'oesd' | 'double-gutshot' | 'gutshot' | 'backdoor-flush' | 'overcards'

export interface Draw {
  kind: DrawKind
  label: string
  outs: number
}

export interface Out {
  card: Card
  makes: string
}

export interface OutsReport {
  outs: Out[]
  /** Outs grouped by what they make, e.g. { "Flush": 9, "Top pair": 6 } */
  groups: { makes: string; count: number }[]
  draws: Draw[]
  /** Exact chance to hit at least one out on the next card / by the river. */
  nextCard: number
  byRiver: number | null
  /** Rule of 2 and 4 estimates (percent). */
  ruleOf2: number
  ruleOf4: number | null
}

const unseen = (hero: readonly Card[], board: readonly Card[]) => {
  const dead = new Set([...hero, ...board])
  const out: Card[] = []
  for (let c = 0; c < 52; c++) if (!dead.has(c)) out.push(c)
  return out
}

function straightRanksCompleting(cards: readonly Card[]): number[] {
  // Ranks r for which adding a card of rank r makes a straight from these cards
  let mask = 0
  for (const c of cards) mask |= 1 << rankOf(c)
  const out: number[] = []
  for (let r = 0; r < 13; r++) {
    if (mask & (1 << r)) continue
    if (hasStraight(mask | (1 << r))) out.push(r)
  }
  return out
}

function hasStraight(mask: number): boolean {
  const m = (mask << 1) | ((mask >> 12) & 1)
  for (let hi = 13; hi >= 4; hi--) {
    const run = 0b11111 << (hi - 4)
    if ((m & run) === run) return true
  }
  return false
}

export function findDraws(hero: readonly Card[], board: readonly Card[]): Draw[] {
  const draws: Draw[] = []
  if (board.length < 3 || board.length >= 5) return draws
  const all = [...hero, ...board]
  const cat = categoryOf(evaluate(all))

  if (cat < HandCategory.Flush) {
    for (let s = 0; s < 4; s++) {
      const n = all.filter((c) => suitOf(c) === s).length
      const heroHas = hero.some((c) => suitOf(c) === s)
      if (n === 4 && heroHas) draws.push({ kind: 'flush-draw', label: 'Flush draw', outs: 9 })
      else if (n === 3 && heroHas && board.length === 3)
        draws.push({ kind: 'backdoor-flush', label: 'Backdoor flush draw', outs: 0 })
    }
  }

  if (cat < HandCategory.Straight) {
    const mine = straightRanksCompleting(all)
    const boardOnly = new Set(straightRanksCompleting(board))
    const useful = mine.filter((r) => !boardOnly.has(r))
    if (useful.length >= 2) {
      // Distinguish open-ended (consecutive four) from double gutshot
      let mask = 0
      for (const c of all) mask |= 1 << rankOf(c)
      const m = (mask << 1) | ((mask >> 12) & 1)
      let fourInRow = false
      for (let hi = 13; hi >= 3; hi--) {
        const run = 0b1111 << (hi - 3)
        if ((m & run) === run) fourInRow = true
      }
      draws.push(
        fourInRow
          ? { kind: 'oesd', label: 'Open-ended straight draw', outs: 8 }
          : { kind: 'double-gutshot', label: 'Double gutshot', outs: 8 },
      )
    } else if (useful.length === 1) {
      draws.push({ kind: 'gutshot', label: `Gutshot (needs a ${RANK_NAMES[useful[0]]})`, outs: 4 })
    }
  }

  if (cat === HandCategory.HighCard) {
    const top = Math.max(...board.map(rankOf))
    const overs = hero.filter((c) => rankOf(c) > top).length
    if (overs === 2) draws.push({ kind: 'overcards', label: 'Two overcards', outs: 6 })
  }
  return draws
}

function labelFor(newScore: number, boardTop: number, heroRanks: number[]): string {
  const cat = categoryOf(newScore)
  const [a] = tiebreak(newScore)
  switch (cat) {
    case HandCategory.Pair:
      return a >= boardTop ? 'Top pair' : 'Pair'
    case HandCategory.TwoPair:
      return 'Two pair'
    case HandCategory.Trips:
      return heroRanks[0] === heroRanks[1] ? 'Set' : 'Trips'
    case HandCategory.Straight:
      return 'Straight'
    case HandCategory.Flush:
      return 'Flush'
    case HandCategory.FullHouse:
      return 'Full house'
    case HandCategory.Quads:
      return 'Quads'
    case HandCategory.StraightFlush:
      return 'Straight flush'
    default:
      return 'Improvement'
  }
}

/**
 * Outs: unseen cards that improve the hero's hand category in a way that
 * uses the hero's hole cards (so a card that only improves the board is not an out).
 */
export function findOuts(hero: readonly Card[], board: readonly Card[]): OutsReport {
  const empty: OutsReport = {
    outs: [],
    groups: [],
    draws: [],
    nextCard: 0,
    byRiver: null,
    ruleOf2: 0,
    ruleOf4: null,
  }
  if (board.length < 3 || board.length >= 5) return empty

  const cur = evaluate([...hero, ...board])
  const curCat = categoryOf(cur)
  const heroRanks = hero.map(rankOf)
  const boardTop = Math.max(...board.map(rankOf))
  const outs: Out[] = []

  for (const c of unseen(hero, board)) {
    const next = evaluate([...hero, ...board, c])
    const nextCat = categoryOf(next)
    if (nextCat <= curCat) continue
    const boardCat = categoryOf(evaluate([...board, c]))
    if (nextCat <= boardCat) continue // the board improved, not us
    const r = rankOf(c)
    if (nextCat <= HandCategory.Trips) {
      // Pair-type improvements must pair one of our hole cards
      if (!heroRanks.includes(r)) continue
      if (nextCat === HandCategory.Pair && r < boardTop) continue // weak pair: not a real out
    }
    outs.push({ card: c, makes: labelFor(next, boardTop, heroRanks) })
  }

  const groupMap = new Map<string, number>()
  for (const o of outs) groupMap.set(o.makes, (groupMap.get(o.makes) ?? 0) + 1)
  const groups = [...groupMap.entries()]
    .map(([makes, count]) => ({ makes, count }))
    .sort((a, b) => b.count - a.count)

  const n = outs.length
  const left = 52 - hero.length - board.length
  const nextCard = n / left
  const byRiver =
    board.length === 3 ? 1 - ((left - n) / left) * ((left - 1 - n) / (left - 1)) : null

  return {
    outs,
    groups,
    draws: findDraws(hero, board),
    nextCard,
    byRiver,
    ruleOf2: n * 2,
    ruleOf4: board.length === 3 ? Math.min(100, n * 4) : null,
  }
}

export const outsToString = (r: OutsReport) => r.outs.map((o) => cardToString(o.card)).join(' ')
