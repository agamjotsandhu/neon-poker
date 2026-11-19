import type { Card } from './cards'
import type { HandResult } from './evaluator'

export type { Card, Rank, Suit } from './cards'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'

/** For bet/raise, `amount` is the total the player's street bet goes TO (not the increment). */
export interface Action {
  type: ActionType
  amount?: number
}

export interface Player {
  id: string
  name: string
  isHuman: boolean
  stack: number
  /** Chips committed on the current street. */
  bet: number
  /** Chips committed over the whole hand (for side pots). */
  committed: number
  hole: Card[]
  folded: boolean
  allIn: boolean
  /** Busted / not dealt in this hand. */
  out: boolean
  hasActed: boolean
  /** The state's raiseLevel when this player last acted (controls re-raise rights). */
  raiseLevelSeen: number
  lastAction: { type: ActionType; amount: number } | null
}

/** 'betting': waiting on toAct. 'streetComplete': call advanceStreet(). 'handComplete': results ready. */
export type Phase = 'idle' | 'betting' | 'streetComplete' | 'handComplete'

export interface Pot {
  amount: number
  eligible: string[]
}

export interface PotResult extends Pot {
  winners: string[]
  /** Chips each winner received from this pot (odd chips already allocated). */
  payouts: Record<string, number>
  handName: string | null
}

export interface HandOutcome {
  uncontested: boolean
  pots: PotResult[]
  /** Final hand per non-folded player (showdown only). */
  hands: Record<string, HandResult>
  /** Net chips received from the pot per player. */
  winnings: Record<string, number>
}

export type HandEvent =
  | { kind: 'start'; handNumber: number; dealerId: string; seed: number }
  | { kind: 'blind'; playerId: string; blind: 'SB' | 'BB'; amount: number }
  | { kind: 'action'; playerId: string; street: Street; action: ActionType; paid: number; to: number }
  | { kind: 'street'; street: Street; cards: Card[] }
  | { kind: 'refund'; playerId: string; amount: number }
  | { kind: 'win'; playerId: string; amount: number; handName: string | null }

export interface GameState {
  players: Player[]
  smallBlind: number
  bigBlind: number
  handNumber: number
  seed: number
  dealer: number
  sb: number
  bb: number
  /** Player indices in the order the first round of hole cards was dealt. */
  dealOrder: number[]
  deck: Card[]
  board: Card[]
  street: Street
  phase: Phase
  toAct: number
  currentBet: number
  /** Size of the last full bet/raise increment (minimum legal raise increment). */
  minRaise: number
  /** Increments on every full bet/raise; a short all-in does not reopen betting. */
  raiseLevel: number
  lastAggressor: number
  /** Chips collected from previous streets (excludes current street bets). */
  pot: number
  events: HandEvent[]
  outcome: HandOutcome | null
}

export interface LegalActions {
  canFold: boolean
  canCheck: boolean
  canCall: boolean
  toCall: number
  canRaise: boolean
  /** True when no bet has been made this street (so it's a "bet", not a "raise"). */
  isOpen: boolean
  minRaiseTo: number
  maxRaiseTo: number
}

export interface SeatConfig {
  id: string
  name: string
  isHuman?: boolean
  stack: number
}

export interface TableConfig {
  seats: SeatConfig[]
  smallBlind: number
  bigBlind: number
  /** Index of the player holding the button for hand 1 (default 0). It moves before each hand. */
  initialDealer?: number
}
