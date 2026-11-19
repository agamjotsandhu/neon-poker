import type { ActionType } from '../engine/types'
import { familyOf, type Advice, type AdviceAction } from './advice'

export type Grade = 'great' | 'good' | 'mistake' | 'blunder'

export interface Feedback {
  grade: Grade
  /** 0–10 */
  points: number
  title: string
  message: string
  took: ActionType
  advised: AdviceAction
  street: string
}

const VERB: Record<string, string> = {
  fold: 'folding',
  check: 'checking',
  call: 'calling',
  bet: 'betting',
  raise: 'raising',
  allin: 'going all-in',
}

const NOUN: Record<string, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
  allin: 'All-in',
}

/** Compare what the player did with the coach's advice. Heuristic, not solver-optimal. */
export function gradeDecision(
  advice: Advice,
  took: ActionType,
  street: string,
  opts: { canCheck: boolean; amount?: number; pot?: number } = { canCheck: false },
): Feedback {
  const tookFamily = familyOf(took)
  const advFamily = familyOf(advice.action)
  const base = { took, advised: advice.action, street }

  if (took === 'fold' && opts.canCheck) {
    return {
      ...base,
      grade: 'blunder',
      points: 0,
      title: 'Never fold when you can check',
      message:
        'Checking was free. Folding gave up your share of the pot for nothing — always check instead.',
    }
  }

  if (tookFamily === advFamily) {
    // Shoving a deep stack when a normal raise was the plan risks everything to win little.
    if (
      took === 'allin' &&
      advice.action !== 'allin' &&
      advice.amount &&
      opts.amount &&
      opts.amount > advice.amount * 4
    ) {
      return {
        ...base,
        grade: 'mistake',
        points: 4,
        title: `Right idea — far too big`,
        message: `Being aggressive is correct here, but going all-in risks your whole stack when ${advice.headline.toLowerCase()} does the same job. Weaker hands fold to a shove and only better hands call, so the big size wins less and loses more.`,
      }
    }
    // Sizing nudge for aggressive actions
    let sizing = ''
    if (
      advFamily === 'aggressive' &&
      advice.amount &&
      opts.amount &&
      advice.action !== 'allin' &&
      took !== 'allin'
    ) {
      const ratio = opts.amount / advice.amount
      if (ratio > 1.8)
        sizing = ' Your size was a lot bigger than needed — the same result for more risk.'
      else if (ratio < 0.55)
        sizing = ' Your size was quite small; a bigger bet gets more value and charges draws.'
    }
    return {
      ...base,
      grade: sizing ? 'good' : 'great',
      points: sizing ? 8 : 10,
      title: sizing ? 'Good play' : 'Great play',
      message: `${capital(VERB[took])} matches the plan. ${advice.why.split('. ')[0]}.${sizing}`,
    }
  }

  const acceptableFamilies = new Set(advice.acceptable.map(familyOf))
  // "Close" spots only excuse the neighbouring action (fold↔call, call↔raise), and never an
  // all-in the coach didn't suggest.
  const neighbour =
    (advFamily === 'fold' && tookFamily === 'passive') ||
    (advFamily === 'passive' && tookFamily !== 'passive') ||
    (advFamily === 'aggressive' && tookFamily === 'passive')
  const reckless = took === 'allin' && !advice.acceptable.includes('allin')
  if (!reckless && (acceptableFamilies.has(tookFamily) || (advice.close && neighbour))) {
    return {
      ...base,
      grade: 'good',
      points: 6,
      title: 'Reasonable — but consider ' + NOUN[advice.action].toLowerCase(),
      message: `This spot is close. ${capital(VERB[took])} is defensible, but ${VERB[advice.action]} is slightly better: ${lowerFirst(advice.why)}`,
    }
  }

  // Clear disagreement — how costly?
  const blunder =
    (advFamily === 'aggressive' && tookFamily === 'fold') ||
    (advFamily === 'fold' && took === 'allin') ||
    (advice.equity !== undefined &&
      advice.required !== undefined &&
      tookFamily !== 'fold' &&
      advice.equity < advice.required - 0.2)
  return {
    ...base,
    grade: blunder ? 'blunder' : 'mistake',
    points: blunder ? 0 : 3,
    title: `Consider ${VERB[advice.action]} instead`,
    message: advice.why,
  }
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

export const GRADE_LABEL: Record<Grade, string> = {
  great: 'Great',
  good: 'Good',
  mistake: 'Mistake',
  blunder: 'Blunder',
}
