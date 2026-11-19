import { rankOf, suitOf, type Card } from '../engine/cards'
import { HandCategory, categoryOf, evaluate } from '../engine/evaluator'
import { rangeCombos, rangeFraction, rfiRange, topRange, type HandClass, type Position } from './ranges'
import type { OpponentInfo } from './situation'

export interface EstimatedRange {
  combos: [Card, Card][]
  /** Approx. share of all starting hands before postflop narrowing (0..1). */
  width: number
  label: string
}

const RFI_POSITIONS = new Set(['UTG', 'HJ', 'CO', 'BTN', 'SB'])

function preflopClasses(o: OpponentInfo): { classes: Set<HandClass>; why: string } {
  switch (o.preflopRole) {
    case '3bettor':
      return { classes: topRange(0.07), why: 're-raised preflop' }
    case 'raiser':
      if (RFI_POSITIONS.has(o.position))
        return { classes: rfiRange(o.position as Position), why: `opened from ${o.position}` }
      return { classes: topRange(0.18), why: 'raised preflop' }
    case 'caller':
      return { classes: topRange(0.32), why: 'called a raise' }
    case 'limper':
      return { classes: topRange(0.55), why: 'limped in' }
    default:
      return { classes: topRange(1), why: 'checked the big blind' }
  }
}

/** Does this holding connect with the board enough to bet/raise? (pair+ with a hole card, or a real draw) */
export function connects(hole: readonly Card[], board: readonly Card[]): boolean {
  const all = [...hole, ...board]
  const cat = categoryOf(evaluate(all))
  const boardCat = categoryOf(evaluate(board))
  if (cat > boardCat && cat >= HandCategory.Pair) return true
  if (board.length < 5) {
    for (let s = 0; s < 4; s++) {
      if (all.filter((c) => suitOf(c) === s).length >= 4 && hole.some((c) => suitOf(c) === s)) return true
    }
    let mask = 0
    for (const c of all) mask |= 1 << rankOf(c)
    const m = (mask << 1) | ((mask >> 12) & 1)
    for (let hi = 13; hi >= 3; hi--) {
      const run = 0b1111 << (hi - 3)
      if ((m & run) === run) return true
    }
  }
  return false
}

/** Heuristic range for an opponent, from their preflop role and postflop aggression. */
export function estimateRange(o: OpponentInfo, dead: ReadonlySet<Card>, board: readonly Card[]): EstimatedRange {
  const { classes, why } = preflopClasses(o)
  const width = rangeFraction(classes)
  let combos = rangeCombos(classes, dead)
  let label = `${o.name}: ~${Math.round(width * 100)}% of hands (${why})`
  if (board.length >= 3 && (o.aggressivePostflop || o.aggressiveThisStreet)) {
    const narrowed = combos.filter((c) => connects(c, board))
    if (narrowed.length >= 6) {
      combos = narrowed
      label += ', weighted to pairs and draws after betting'
    }
  }
  return { combos, width, label }
}
