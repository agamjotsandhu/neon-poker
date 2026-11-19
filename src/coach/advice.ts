import { RANK_NAMES, RANK_PLURALS, rankOf, type Card } from '../engine/cards'
import type { OutsReport } from './outs'
import {
  BB_DEFEND,
  CALL_THREE_BET,
  FLAT_RANGE,
  FOUR_BET_VALUE,
  STACK_OFF,
  THREE_BET_LINEAR,
  THREE_BET_POLAR,
  handClass,
  isEarly,
  preflopPercentile,
  rangeFraction,
  rfiRange,
  topRange,
  type Position,
} from './ranges'
import type { Situation } from './situation'

export type AdviceAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
export type ActionFamily = 'fold' | 'passive' | 'aggressive'

export const familyOf = (a: AdviceAction): ActionFamily =>
  a === 'fold' ? 'fold' : a === 'check' || a === 'call' ? 'passive' : 'aggressive'

export interface Advice {
  action: AdviceAction
  /** Raise/bet "to" amount (street total). */
  amount?: number
  /** e.g. "2.5 BB", "⅔ pot" */
  sizeLabel?: string
  headline: string
  /** 2–3 sentences: why. */
  why: string
  /** Other actions that are reasonable here (graded as "good", not "great"). */
  acceptable: AdviceAction[]
  /** True when the decision is close (small edge either way). */
  close: boolean
  basis: 'chart' | 'equity' | 'push-fold'
  equity?: number
  required?: number
}

export interface EquityInfo {
  equity: number
  outs: OutsReport | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`
export const fmtBB = (chips: number, bb: number) => {
  const v = chips / bb
  return `${Number.isInteger(v) ? v : v.toFixed(1)} BB`
}

export function potOdds(toCall: number, pot: number): { required: number; ratio: string } {
  if (toCall <= 0) return { required: 0, ratio: '—' }
  const required = toCall / (pot + toCall)
  const r = pot / toCall
  return { required, ratio: `${r >= 10 ? Math.round(r) : r.toFixed(1)} : 1` }
}

function roundTo(x: number, unit: number) {
  return Math.max(unit, Math.round(x / unit) * unit)
}

function clampSize(s: Situation, to: number): { amount: number; allIn: boolean } {
  const unit = Math.max(1, s.bigBlind / 2)
  let amount = roundTo(to, unit)
  amount = Math.max(amount, s.minRaiseTo)
  if (amount >= s.maxRaiseTo * 0.85) return { amount: s.maxRaiseTo, allIn: true }
  return { amount: Math.min(amount, s.maxRaiseTo), allIn: false }
}

export const handName = (hero: readonly Card[]) => {
  const hc = handClass(hero)
  const hiRank = Math.max(rankOf(hero[0]), rankOf(hero[1]))
  const loRank = Math.min(rankOf(hero[0]), rankOf(hero[1]))
  if (hc.length === 2) return `pocket ${RANK_PLURALS[hiRank]}`
  return `${RANK_NAMES[hiRank]}-${RANK_NAMES[loRank]} ${hc[2] === 's' ? 'suited' : 'offsuit'}`
}

const POSITION_NAMES: Record<string, string> = {
  UTG: 'Under the Gun',
  HJ: 'the Hijack',
  CO: 'the Cutoff',
  BTN: 'the Button',
  SB: 'the Small Blind',
  BB: 'the Big Blind',
}

/* ------------------------------------------------------------------ preflop */

function preflopAdvice(s: Situation): Advice {
  const hc = handClass(s.hero)
  const name = handName(s.hero)
  const bb = s.bigBlind
  const top = preflopPercentile(hc)
  const posName = POSITION_NAMES[s.position] ?? s.position
  const { facing } = s.preflop

  // Short stacks: push or fold.
  if (s.effectiveStackBB <= 12 && facing !== '4bet+') {
    const pushWidth = facing === 'unopened' || facing === 'limped' ? (s.position === 'BTN' || s.position === 'SB' ? 0.35 : 0.2) : 0.1
    if (top <= pushWidth) {
      return {
        action: 'allin',
        amount: s.maxRaiseTo,
        sizeLabel: 'All-in',
        headline: 'Go all-in',
        why: `With only ${Math.round(s.effectiveStackBB)} big blinds, small raises commit you anyway, so the standard play is shove-or-fold. ${capital(name)} is in the top ${pct(top)} of hands — strong enough to shove here and pick up the blinds or flip with an edge.`,
        acceptable: [],
        close: top > pushWidth * 0.8,
        basis: 'push-fold',
      }
    }
    return fold(s, `At ${Math.round(s.effectiveStackBB)} big blinds you're in shove-or-fold territory, and ${name} (top ${pct(top)}) isn't strong enough to risk your stack from ${posName}. Wait for a better spot.`, top > pushWidth * 1.3 ? [] : ['allin'])
  }

  if (facing === 'unopened' || facing === 'limped') {
    if (s.position === 'BB' && s.canCheck) {
      if (top <= 0.12 && s.canRaise) {
        const sz = clampSize(s, bb * (3 + s.preflop.limpers))
        return {
          action: sz.allIn ? 'allin' : 'raise',
          amount: sz.amount,
          sizeLabel: fmtBB(sz.amount, bb),
          headline: `Raise to ${fmtBB(sz.amount, bb)}`,
          why: `Everyone just limped, and ${name} is a top-${pct(top)} hand. Raising punishes the weak limping range and builds a pot while you're likely ahead. Add about 1 BB per limper to your raise.`,
          acceptable: ['check'],
          close: false,
          basis: 'chart',
        }
      }
      return {
        action: 'check',
        headline: 'Check — see a free flop',
        why: `You're in the Big Blind and nobody raised, so you can see the flop for free. ${capital(name)} isn't strong enough to raise into several players, but there's never a reason to fold when checking costs nothing.`,
        acceptable: [],
        close: false,
        basis: 'chart',
      }
    }
    const pos = (s.playersDealt === 2 && s.position === 'BTN' ? 'BTN' : s.position) as Position
    const range = rfiRange(pos)
    const inRange = range.has(hc)
    if (inRange) {
      const base = s.position === 'SB' ? 3 : 2.5
      const sz = clampSize(s, bb * (base + s.preflop.limpers))
      return {
        action: sz.allIn ? 'allin' : 'raise',
        amount: sz.amount,
        sizeLabel: fmtBB(sz.amount, bb),
        headline: `Raise to ${fmtBB(sz.amount, bb)}`,
        why: `${capital(name)} is in the standard opening range from ${posName} (about the top ${pct(rangeFraction(range))} of hands). Raising first in gives you the initiative and two ways to win: everyone folds now, or you take a stronger range into the flop.${s.preflop.limpers ? ' Add 1 BB for each limper.' : ''}`,
        acceptable: [],
        close: false,
        basis: 'chart',
      }
    }
    return fold(
      s,
      `${capital(name)} is outside the opening range from ${posName}. ${isEarly(s.position) ? 'From early position many players still act behind you, so you need a stronger hand.' : 'It tends to make second-best hands that lose big pots.'} Folding here costs nothing extra.`,
      [],
    )
  }

  if (facing === 'raised') {
    const opener = s.preflop.openerPosition ?? 'UTG'
    const threeRange = isEarly(opener) ? THREE_BET_LINEAR : THREE_BET_POLAR
    const oop = s.position === 'SB' || s.position === 'BB'
    const odds = potOdds(s.toCall, s.pot)
    if (threeRange.has(hc) && s.canRaise) {
      const sz = clampSize(s, s.preflop.lastRaiseTo * (oop ? 3.5 : 3))
      const value = FOUR_BET_VALUE.has(hc) || topRange(0.06).has(hc)
      return {
        action: sz.allIn ? 'allin' : 'raise',
        amount: sz.amount,
        sizeLabel: fmtBB(sz.amount, bb),
        headline: `3-bet to ${fmtBB(sz.amount, bb)}`,
        why: value
          ? `${capital(name)} is well ahead of a ${opener} opening range. Re-raising (a "3-bet") builds the pot while you're the favourite. Size it about ${oop ? '3.5×' : '3×'} the open${oop ? ' because you will be out of position' : ''}.`
          : `${capital(name)} is a good 3-bet bluff: it has blockers or plays well when called, and a re-raise often wins the pot immediately. Against a ${opener} open, mixing a few of these with your value hands keeps you hard to read.`,
        acceptable: value ? [] : ['call', 'fold'],
        close: !value,
        basis: 'chart',
      }
    }
    const callable =
      (s.position === 'BB' && (BB_DEFEND.has(hc) || top <= 0.35) && (!isEarly(opener) || top <= 0.3)) ||
      (!oop && FLAT_RANGE.has(hc)) ||
      (s.position === 'SB' && FLAT_RANGE.has(hc) && top <= 0.12)
    if (callable && s.toCall <= s.heroStack) {
      return {
        action: 'call',
        headline: `Call ${fmtBB(s.toCall, bb)}`,
        why:
          s.position === 'BB'
            ? `You already have 1 BB in and you close the action, so you're getting ${odds.ratio} and need only about ${pct(odds.required)} equity. ${capital(name)} plays well enough to defend against a ${opener} open.`
            : `${capital(name)} plays well after the flop${s.inPosition ? ' and you will have position' : ''}, but it isn't strong enough to re-raise a ${opener} open. Calling keeps weaker hands in and the pot manageable.`,
        acceptable: [],
        close: top > 0.3,
        basis: 'chart',
      }
    }
    return fold(
      s,
      `Against a raise from ${POSITION_NAMES[opener] ?? opener}, ${name} is usually dominated or hard to play out of position. You'd need about ${pct(odds.required)} equity to call, and this hand often makes second-best pairs. Fold and wait for a better spot.`,
      top <= 0.4 ? ['call'] : [],
    )
  }

  // Facing a 3-bet or more
  const odds = potOdds(s.toCall, s.pot)
  if (facing === '3bet') {
    if (FOUR_BET_VALUE.has(hc) && s.canRaise) {
      const sz = clampSize(s, s.preflop.lastRaiseTo * 2.3)
      return {
        action: sz.allIn ? 'allin' : 'raise',
        amount: sz.amount,
        sizeLabel: sz.allIn ? 'All-in' : fmtBB(sz.amount, bb),
        headline: sz.allIn ? 'Go all-in' : `4-bet to ${fmtBB(sz.amount, bb)}`,
        why: `${capital(name)} is at the very top of your range. Against a re-raise you want to keep building the pot: a 4-bet of about 2.3× gets value from worse hands and makes it hard for them to continue.`,
        acceptable: ['call'],
        close: false,
        basis: 'chart',
      }
    }
    if (CALL_THREE_BET.has(hc) || (odds.required < 0.3 && top <= 0.15)) {
      return {
        action: 'call',
        headline: `Call ${fmtBB(s.toCall, bb)}`,
        why: `${capital(name)} is strong but not a hand you want to get all-in with against a 3-bet range. Calling keeps their bluffs in and lets you play a controlled pot after the flop.`,
        acceptable: ['fold'],
        close: true,
        basis: 'chart',
      }
    }
    return fold(s, `A 3-bet range is strong (roughly the top 7% of hands). ${capital(name)} is too far behind it to keep investing, even getting ${odds.ratio}.`, top <= 0.12 ? ['call'] : [])
  }

  // 4-bet or more
  if (STACK_OFF.has(hc)) {
    return {
      action: s.canRaise ? 'allin' : 'call',
      amount: s.canRaise ? s.maxRaiseTo : undefined,
      sizeLabel: s.canRaise ? 'All-in' : undefined,
      headline: s.canRaise ? 'Go all-in' : 'Call',
      why: `With ${name} you are happy to get all the chips in, even against a very strong range. This is exactly the hand you've been waiting for.`,
      acceptable: ['call'],
      close: false,
      basis: 'chart',
    }
  }
  if (FOUR_BET_VALUE.has(hc) && odds.required < 0.4) {
    return {
      action: 'call',
      headline: 'Call',
      why: `${capital(name)} is close to the top of the range and you're getting ${odds.ratio}, so you need about ${pct(odds.required)} equity. That's enough against a 4-bet range that includes some bluffs.`,
      acceptable: ['fold', 'allin'],
      close: true,
      basis: 'chart',
    }
  }
  return fold(s, `Multiple raises before the flop mean a very narrow range: mostly QQ+ and AK. ${capital(name)} is a big underdog, so fold.`, [])
}

function fold(s: Situation, why: string, acceptable: AdviceAction[]): Advice {
  if (s.canCheck) {
    return { action: 'check', headline: 'Check', why: why + ' Checking is free, so never fold here.', acceptable: [], close: false, basis: 'chart' }
  }
  return { action: 'fold', headline: 'Fold', why, acceptable, close: acceptable.length > 0, basis: 'chart' }
}

/* ----------------------------------------------------------------- postflop */

function postflopAdvice(s: Situation, eq: EquityInfo): Advice {
  const e = eq.equity
  const outs = eq.outs
  const nOuts = outs?.outs.length ?? 0
  const strongDraw = nOuts >= 8 && s.street !== 'river'
  const multiway = s.opponents.length >= 2
  const bump = multiway ? 0.06 * (s.opponents.length - 1) : 0
  const pot = s.pot
  const potLabel = (frac: number) => (frac <= 0.34 ? '⅓ pot' : frac <= 0.5 ? '½ pot' : frac <= 0.67 ? '⅔ pot' : frac <= 0.8 ? '¾ pot' : 'pot')

  const drawText = () => {
    if (!outs || nOuts === 0 || s.street === 'river') return ''
    const draws = outs.draws.filter((d) => d.outs > 0).map((d) => d.label.toLowerCase())
    const rule = s.street === 'flop' ? `${nOuts} × 4 ≈ ${Math.min(100, nOuts * 4)}% by the river` : `${nOuts} × 2 ≈ ${nOuts * 2}% on the river`
    return ` You have ${nOuts} outs${draws.length ? ` (${draws.join(', ')})` : ''}: ${rule}.`
  }

  // No bet to face
  if (s.toCall === 0) {
    const valueLine = 0.66 + bump
    const thinLine = 0.55 + bump
    if (e >= valueLine && s.canRaise) {
      const frac = s.street === 'river' ? 0.75 : 0.66
      const sz = clampSize(s, s.heroBet + pot * frac)
      return {
        action: sz.allIn ? 'allin' : 'bet',
        amount: sz.amount,
        sizeLabel: sz.allIn ? 'All-in' : potLabel(frac),
        headline: sz.allIn ? 'Go all-in' : `Bet ${potLabel(frac)}`,
        why: `You have about ${pct(e)} equity against their likely hands — you're well ahead. Bet for value: worse hands and draws will call, and checking gives free cards that could beat you.${drawText()}`,
        acceptable: [],
        close: e < valueLine + 0.05,
        basis: 'equity',
        equity: e,
      }
    }
    if (strongDraw && s.opponents.length <= 2 && s.canRaise) {
      const sz = clampSize(s, s.heroBet + pot * 0.5)
      return {
        action: sz.allIn ? 'allin' : 'bet',
        amount: sz.amount,
        sizeLabel: '½ pot',
        headline: 'Bet ½ pot (semi-bluff)',
        why: `You don't have a made hand yet, but you have a strong draw.${drawText()} Betting is a semi-bluff: you win now if they fold, and you can still hit if they call.`,
        acceptable: ['check'],
        close: true,
        basis: 'equity',
        equity: e,
      }
    }
    if (e >= thinLine && s.street !== 'river' && s.canRaise && !multiway) {
      const sz = clampSize(s, s.heroBet + pot * 0.33)
      return {
        action: sz.allIn ? 'allin' : 'bet',
        amount: sz.amount,
        sizeLabel: '⅓ pot',
        headline: 'Bet ⅓ pot',
        why: `At around ${pct(e)} equity you're slightly ahead, but your hand is vulnerable. A small bet charges draws and gets thin value without bloating the pot.${drawText()}`,
        acceptable: ['check'],
        close: true,
        basis: 'equity',
        equity: e,
      }
    }
    return {
      action: 'check',
      headline: 'Check',
      why:
        e >= 0.4
          ? `You have about ${pct(e)} equity: a medium-strength hand that does well at showdown but doesn't want a big pot. Checking controls the pot size and lets you see the next card cheaply.${drawText()}`
          : `With about ${pct(e)} equity you're behind most of their range. Betting here would mostly get called by better hands, so check and give up unless you improve.${drawText()}`,
      acceptable: e >= thinLine - 0.08 ? ['bet'] : [],
      close: false,
      basis: 'equity',
      equity: e,
    }
  }

  // Facing a bet
  const { required, ratio } = potOdds(s.toCall, s.pot)
  const impliedBonus = strongDraw && s.effectiveStackBB > 15 ? 0.05 : 0
  const raiseLine = Math.max(0.72 + bump, required + 0.3)

  if (e >= raiseLine && s.canRaise) {
    const sz = clampSize(s, s.currentBet * 3 + (s.pot - s.currentBet - s.heroBet) * 0.25)
    return {
      action: sz.allIn ? 'allin' : 'raise',
      amount: sz.amount,
      sizeLabel: sz.allIn ? 'All-in' : `to ${fmtBB(sz.amount, s.bigBlind)}`,
      headline: sz.allIn ? 'Go all-in' : `Raise to ${fmtBB(sz.amount, s.bigBlind)}`,
      why: `You have about ${pct(e)} equity — far more than the ${pct(required)} you need to call. Raising builds the pot while you're a big favourite, and it charges draws a high price.`,
      acceptable: ['call'],
      close: false,
      basis: 'equity',
      equity: e,
      required,
    }
  }
  if (e + impliedBonus >= required) {
    const close = e < required + 0.05
    return {
      action: 'call',
      headline: `Call ${fmtBB(s.toCall, s.bigBlind)}`,
      why:
        e >= required
          ? `The pot is laying you ${ratio}, so you need ${pct(required)} equity to break even. You have about ${pct(e)}, so calling is profitable over time.${drawText()}`
          : `Your raw equity (${pct(e)}) is just short of the ${pct(required)} you need, but when you hit you'll win more chips on later streets (implied odds).${drawText()}`,
      acceptable: close ? ['fold'] : e > raiseLine - 0.1 ? ['raise'] : [],
      close,
      basis: 'equity',
      equity: e,
      required,
    }
  }
  return {
    action: 'fold',
    headline: 'Fold',
    why: `You need ${pct(required)} equity to call (pot odds ${ratio}), but you only have about ${pct(e)} against their likely hands. Calling loses chips over time.${drawText()}`,
    acceptable: e >= required - 0.05 ? ['call'] : [],
    close: e >= required - 0.05,
    basis: 'equity',
    equity: e,
    required,
  }
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Main entry: what should the hero do? Postflop needs equity; returns null until it's available. */
export function getAdvice(s: Situation, eq: EquityInfo | null): Advice | null {
  if (s.street === 'preflop') return preflopAdvice(s)
  if (!eq) return null
  return postflopAdvice(s, eq)
}
