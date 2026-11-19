import { prepareEquityJob } from '../coach/analysis'
import { monteCarloEquity } from '../coach/equity'
import { findOuts } from '../coach/outs'
import { handClass, preflopPercentile } from '../coach/ranges'
import { buildSituation } from '../coach/situation'
import { getLegalActions } from '../engine/game'
import type { Rng } from '../engine/rng'
import type { Action, GameState, LegalActions } from '../engine/types'
import type { Personality } from './personalities'

const POSITION_LOOSEN: Record<string, number> = {
  UTG: 0.7,
  HJ: 0.85,
  CO: 1.05,
  BTN: 1.35,
  SB: 0.95,
  BB: 1.15,
}

function sized(legal: LegalActions, to: number, unit: number): Action {
  let amount = Math.max(legal.minRaiseTo, Math.round(to / unit) * unit)
  if (amount >= legal.maxRaiseTo * 0.9) return { type: 'allin' }
  amount = Math.min(amount, legal.maxRaiseTo)
  return { type: legal.isOpen ? 'bet' : 'raise', amount }
}

const passive = (legal: LegalActions): Action => (legal.canCheck ? { type: 'check' } : { type: 'fold' })
const call = (legal: LegalActions): Action => (legal.canCall ? { type: 'call' } : { type: 'check' })

export interface BotDecision {
  action: Action
  /** Rough difficulty 0..1 used to scale "thinking" time. */
  difficulty: number
}

/** Rule-based decision: hand strength, position, pot odds, personality and a little randomness. */
export function decideBot(state: GameState, idx: number, me: Personality, rng: Rng): BotDecision {
  const legal = getLegalActions(state)
  const sit = buildSituation(state, idx)
  const bb = state.bigBlind
  const unit = Math.max(1, bb / 2)
  const roll = rng()

  if (sit.street === 'preflop') {
    const top = preflopPercentile(handClass(sit.hero)) // smaller = stronger
    const loosen = POSITION_LOOSEN[sit.position] ?? 1
    const playable = me.looseness * loosen
    const { facing } = sit.preflop

    if (facing === 'unopened' || facing === 'limped') {
      if (top <= playable) {
        const raiseIt = legal.canRaise && (roll < me.aggression + 0.2 || top < 0.06)
        if (raiseIt) return { action: sized(legal, bb * (2.5 + sit.preflop.limpers + (rng() < 0.3 ? 0.5 : 0)), unit), difficulty: 0.3 }
        return { action: call(legal), difficulty: 0.3 }
      }
      if (legal.canCheck) return { action: { type: 'check' }, difficulty: 0.1 }
      if (legal.canRaise && roll < me.bluff * 0.4 && (sit.position === 'BTN' || sit.position === 'CO'))
        return { action: sized(legal, bb * 2.5, unit), difficulty: 0.5 }
      if (sit.position === 'SB' && top <= playable * 1.4 && me.aggression < 0.3) return { action: call(legal), difficulty: 0.3 }
      return { action: { type: 'fold' }, difficulty: 0.1 }
    }

    const priceGood = legal.toCall <= sit.pot * 0.35
    if (facing === 'raised') {
      const threeBet = 0.035 + me.looseness * 0.12 * (me.aggression + 0.3)
      const cont = me.looseness * 0.6 + me.stickiness + (sit.position === 'BB' ? 0.12 : 0)
      if (top <= threeBet && legal.canRaise) return { action: sized(legal, sit.preflop.lastRaiseTo * 3, unit), difficulty: 0.6 }
      if (top <= cont || (priceGood && top <= cont * 1.5)) return { action: call(legal), difficulty: 0.5 }
      return { action: passive(legal), difficulty: 0.4 }
    }
    // 3-bet or more
    if (top <= 0.025 + me.aggression * 0.01 && legal.canRaise) return { action: sized(legal, sit.preflop.lastRaiseTo * 2.4, unit), difficulty: 0.8 }
    if (top <= 0.06 + me.stickiness + (priceGood ? 0.04 : 0)) return { action: call(legal), difficulty: 0.8 }
    return { action: passive(legal), difficulty: 0.6 }
  }

  // Postflop: equity vs estimated ranges (small, fast simulation)
  const job = prepareEquityJob(sit, 260, Math.floor(rng() * 1e9))
  const eq = monteCarloEquity(job.request).equity
  const outs = findOuts(sit.hero, sit.board).outs.length
  const drawy = outs >= 8 && sit.street !== 'river'
  const multi = sit.opponents.length >= 2 ? 0.06 * (sit.opponents.length - 1) : 0

  if (legal.toCall === 0) {
    if (eq > 0.64 + multi && legal.canRaise && roll < me.aggression + 0.25) {
      const frac = 0.45 + rng() * 0.35
      return { action: sized(legal, sit.pot * frac, unit), difficulty: 0.5 }
    }
    if (drawy && legal.canRaise && roll < me.aggression * 0.8) return { action: sized(legal, sit.pot * 0.5, unit), difficulty: 0.6 }
    const cbet = sit.heroHasInitiative && sit.opponents.length === 1 && roll < me.aggression * 0.6
    if ((cbet || roll < me.bluff) && legal.canRaise) return { action: sized(legal, sit.pot * (0.33 + rng() * 0.25), unit), difficulty: 0.7 }
    return { action: { type: 'check' }, difficulty: 0.3 }
  }

  const required = legal.toCall / (sit.pot + legal.toCall)
  const implied = drawy ? 0.05 : 0
  if (eq > 0.8 + multi && legal.canRaise && roll < me.aggression + 0.15) {
    return { action: sized(legal, state.currentBet * (2.5 + rng()), unit), difficulty: 0.7 }
  }
  if (eq + implied + me.stickiness >= required) return { action: call(legal), difficulty: 0.6 }
  if (legal.canRaise && roll < me.bluff * 0.35 && sit.street !== 'river') {
    return { action: sized(legal, state.currentBet * 2.5, unit), difficulty: 0.9 }
  }
  return { action: { type: 'fold' }, difficulty: 0.5 }
}

/** Human-feeling think time in ms (0.6–1.5s at normal speed). */
export function thinkTime(difficulty: number, rng: Rng, speed = 1): number {
  const base = 600 + difficulty * 600 + rng() * 300
  return Math.min(1500, base) / speed
}
