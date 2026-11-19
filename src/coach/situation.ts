import type { Card } from '../engine/cards'
import { getLegalActions, positionLabels, totalPot } from '../engine/game'
import type { GameState, Street } from '../engine/types'

export type PreflopFacing = 'unopened' | 'limped' | 'raised' | '3bet' | '4bet+'
export type PreflopRole = '3bettor' | 'raiser' | 'caller' | 'limper' | 'blind'

export interface OpponentInfo {
  id: string
  name: string
  index: number
  position: string
  stack: number
  allIn: boolean
  preflopRole: PreflopRole
  /** Bet or raised on any postflop street. */
  aggressivePostflop: boolean
  /** Bet or raised on the current street. */
  aggressiveThisStreet: boolean
}

/** Everything the coach (and bots) need to reason about a decision. Pure data. */
export interface Situation {
  heroIndex: number
  hero: Card[]
  board: Card[]
  street: Street
  position: string
  bigBlind: number
  /** Total chips in the middle, including current bets. */
  pot: number
  toCall: number
  heroBet: number
  heroStack: number
  currentBet: number
  canCheck: boolean
  canRaise: boolean
  isOpen: boolean
  minRaiseTo: number
  maxRaiseTo: number
  opponents: OpponentInfo[]
  /** Players dealt into the hand. */
  playersDealt: number
  preflop: {
    facing: PreflopFacing
    raises: number
    limpers: number
    openerPosition: string | null
    lastRaiseTo: number
    heroRaised: boolean
  }
  /** Hero acts after every remaining opponent postflop. */
  inPosition: boolean
  /** Hero made the last bet/raise on the previous street (has the initiative). */
  heroHasInitiative: boolean
  effectiveStackBB: number
}

export function buildSituation(state: GameState, heroIndex: number): Situation {
  const hero = state.players[heroIndex]
  const legal = getLegalActions(state)
  const labels = positionLabels(state)
  const posOf = (id: string) => labels[state.players.findIndex((p) => p.id === id)] ?? '?'

  // Replay preflop actions
  let raises = 0
  let limpers = 0
  let openerPosition: string | null = null
  let lastRaiseTo = state.bigBlind
  let heroRaised = false
  const roles = new Map<string, PreflopRole>()
  const aggPost = new Set<string>()
  const aggStreet = new Set<string>()
  let lastAggressorByStreet: Record<string, string> = {}

  for (const e of state.events) {
    if (e.kind !== 'action') continue
    const aggressive =
      e.action === 'raise' ||
      e.action === 'bet' ||
      (e.action === 'allin' && e.to > lastRaiseTo && e.street === 'preflop')
    if (e.street === 'preflop') {
      if (aggressive) {
        raises++
        lastRaiseTo = e.to
        if (raises === 1) openerPosition = posOf(e.playerId)
        roles.set(e.playerId, raises >= 2 ? '3bettor' : 'raiser')
        if (e.playerId === hero.id) heroRaised = true
      } else if (e.action === 'call' || (e.action === 'allin' && !aggressive)) {
        if (!roles.has(e.playerId)) roles.set(e.playerId, raises === 0 ? 'limper' : 'caller')
        else if (raises > 0 && roles.get(e.playerId) === 'limper') roles.set(e.playerId, 'caller')
        if (raises === 0) limpers++
      }
    } else if (e.action === 'bet' || e.action === 'raise' || e.action === 'allin') {
      aggPost.add(e.playerId)
      if (e.street === state.street) aggStreet.add(e.playerId)
    }
    if (e.action === 'bet' || e.action === 'raise' || e.action === 'allin') {
      lastAggressorByStreet = { ...lastAggressorByStreet, [e.street]: e.playerId }
    }
  }

  const facing: PreflopFacing =
    raises === 0
      ? limpers > 0
        ? 'limped'
        : 'unopened'
      : raises === 1
        ? 'raised'
        : raises === 2
          ? '3bet'
          : '4bet+'

  const opponents: OpponentInfo[] = state.players
    .map((p, index) => ({ p, index }))
    .filter(({ p, index }) => index !== heroIndex && !p.out && !p.folded)
    .map(({ p, index }) => ({
      id: p.id,
      name: p.name,
      index,
      position: labels[index] ?? '?',
      stack: p.stack,
      allIn: p.allIn,
      preflopRole: roles.get(p.id) ?? 'blind',
      aggressivePostflop: aggPost.has(p.id),
      aggressiveThisStreet: aggStreet.has(p.id),
    }))

  // Postflop order: first to act is left of the button; hero is in position if it acts last.
  const n = state.players.length
  const distFromButton = (i: number) => (i - state.dealer + n) % n || n
  const heroDist = distFromButton(heroIndex)
  const inPosition = opponents.every((o) => distFromButton(o.index) < heroDist)

  const prevStreet: Record<Street, Street | null> = {
    preflop: null,
    flop: 'preflop',
    turn: 'flop',
    river: 'turn',
    showdown: 'river',
  }
  const prev = prevStreet[state.street]
  const heroHasInitiative = prev ? lastAggressorByStreet[prev] === hero.id : false

  const maxOpp = Math.max(0, ...opponents.map((o) => o.stack + state.players[o.index].bet))
  const effective = Math.min(hero.stack + hero.bet, maxOpp)

  return {
    heroIndex,
    hero: hero.hole,
    board: state.board,
    street: state.street,
    position: labels[heroIndex] ?? '?',
    bigBlind: state.bigBlind,
    pot: totalPot(state),
    toCall: legal.toCall,
    heroBet: hero.bet,
    heroStack: hero.stack,
    currentBet: state.currentBet,
    canCheck: legal.canCheck,
    canRaise: legal.canRaise,
    isOpen: legal.isOpen,
    minRaiseTo: legal.minRaiseTo,
    maxRaiseTo: legal.maxRaiseTo,
    opponents,
    playersDealt: state.players.filter((p) => !p.out).length,
    preflop: { facing, raises, limpers, openerPosition, lastRaiseTo, heroRaised },
    inPosition,
    heroHasInitiative,
    effectiveStackBB: effective / state.bigBlind,
  }
}
