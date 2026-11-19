import {
  BB_DEFEND,
  CALL_THREE_BET,
  FLAT_RANGE,
  FOUR_BET_VALUE,
  THREE_BET_LINEAR,
  THREE_BET_POLAR,
  isEarly,
  rangeFraction,
  rfiRange,
  topRange,
  type HandClass,
  type Position,
} from './ranges'
import type { Situation } from './situation'

export interface DisplayRange {
  /** Primary range (e.g. raise) */
  raise: Set<HandClass>
  /** Secondary range (e.g. call) */
  call: Set<HandClass>
  title: string
  caption: string
}

const POS: Record<string, string> = {
  UTG: 'UTG',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
}

/** Which chart is relevant to the hero's current preflop decision (for the 13×13 grid). */
export function displayRange(s: Situation): DisplayRange {
  const { facing } = s.preflop
  if (facing === 'unopened' || facing === 'limped') {
    if (s.position === 'BB') {
      const r = topRange(0.12)
      return {
        raise: r,
        call: new Set(),
        title: 'Big Blind vs limpers',
        caption: `Raise the top ~12%; check everything else for free.`,
      }
    }
    const pos = (s.playersDealt === 2 && s.position === 'BTN' ? 'BTN' : s.position) as Position
    const r = rfiRange(pos)
    return {
      raise: r,
      call: new Set(),
      title: `${POS[s.position] ?? s.position} opening range`,
      caption: `Raise first in with ~${Math.round(rangeFraction(r) * 100)}% of hands from this seat; fold the rest.`,
    }
  }
  if (facing === 'raised') {
    const opener = s.preflop.openerPosition ?? 'UTG'
    const three = isEarly(opener) ? THREE_BET_LINEAR : THREE_BET_POLAR
    const call = s.position === 'BB' ? BB_DEFEND : FLAT_RANGE
    const callOnly = new Set([...call].filter((h) => !three.has(h)))
    return {
      raise: three,
      call: callOnly,
      title: `Facing a ${opener} open`,
      caption: `Pink = 3-bet, cyan = call${s.position === 'BB' ? ' (Big Blind defends wide: it closes the action at a discount)' : ''}.`,
    }
  }
  if (facing === '3bet') {
    return {
      raise: FOUR_BET_VALUE,
      call: CALL_THREE_BET,
      title: 'Facing a 3-bet',
      caption: 'Pink = 4-bet for value, cyan = call. Fold the rest of your opening range.',
    }
  }
  return {
    raise: topRange(0.025),
    call: FOUR_BET_VALUE,
    title: 'Facing a 4-bet+',
    caption: 'Only the very top of your range continues.',
  }
}
