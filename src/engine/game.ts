import { evaluateHand } from './evaluator'
import { shuffledDeck } from './rng'
import type {
  Action,
  GameState,
  HandOutcome,
  LegalActions,
  Player,
  Pot,
  PotResult,
  Street,
  TableConfig,
} from './types'

const clone = <T>(v: T): T => structuredClone(v)

export function createGame(config: TableConfig): GameState {
  if (config.seats.length < 2 || config.seats.length > 6) throw new Error('2–6 players supported')
  const players: Player[] = config.seats.map((s) => ({
    id: s.id,
    name: s.name,
    isHuman: !!s.isHuman,
    stack: s.stack,
    bet: 0,
    committed: 0,
    hole: [],
    folded: false,
    allIn: false,
    out: s.stack <= 0,
    hasActed: false,
    raiseLevelSeen: -1,
    lastAction: null,
  }))
  const n = players.length
  return {
    players,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    handNumber: 0,
    seed: 0,
    // Stored one seat "behind" so that the first startHand() moves it onto initialDealer.
    dealer: ((config.initialDealer ?? 0) - 1 + n) % n,
    sb: -1,
    bb: -1,
    dealOrder: [],
    deck: [],
    board: [],
    street: 'preflop',
    phase: 'idle',
    toAct: -1,
    currentBet: 0,
    minRaise: config.bigBlind,
    raiseLevel: 0,
    lastAggressor: -1,
    pot: 0,
    events: [],
    outcome: null,
  }
}

/** Next index clockwise from `from` (exclusive) satisfying pred, or -1. */
export function nextIndex(state: GameState, from: number, pred: (p: Player) => boolean): number {
  const n = state.players.length
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n
    if (pred(state.players[i])) return i
  }
  return -1
}

const inHand = (p: Player) => !p.out && !p.folded
const canAct = (p: Player) => !p.out && !p.folded && !p.allIn

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.out)
}

export function startHand(prev: GameState, seed: number): GameState {
  const s = clone(prev)
  for (const p of s.players) {
    p.out = p.stack <= 0
    p.bet = 0
    p.committed = 0
    p.hole = []
    p.folded = false
    p.allIn = false
    p.hasActed = false
    p.raiseLevelSeen = -1
    p.lastAction = null
  }
  const seated = s.players.filter((p) => !p.out)
  if (seated.length < 2) throw new Error('Need at least two players with chips')

  s.handNumber += 1
  s.seed = seed
  s.board = []
  s.street = 'preflop'
  s.pot = 0
  s.outcome = null
  s.events = []
  s.lastAggressor = -1
  s.raiseLevel = 0
  s.minRaise = s.bigBlind

  const notOut = (p: Player) => !p.out
  s.dealer = nextIndex(s, s.dealer, notOut)
  if (seated.length === 2) {
    // Heads-up: the button posts the small blind and acts first preflop.
    s.sb = s.dealer
    s.bb = nextIndex(s, s.sb, notOut)
  } else {
    s.sb = nextIndex(s, s.dealer, notOut)
    s.bb = nextIndex(s, s.sb, notOut)
  }

  s.events.push({ kind: 'start', handNumber: s.handNumber, dealerId: s.players[s.dealer].id, seed })
  postBlind(s, s.sb, s.smallBlind, 'SB')
  postBlind(s, s.bb, s.bigBlind, 'BB')
  s.currentBet = s.bigBlind

  // Deal two rounds, one card at a time, starting left of the button.
  s.deck = shuffledDeck(seed)
  s.dealOrder = []
  let i = s.dealer
  for (let k = 0; k < seated.length; k++) {
    i = nextIndex(s, i, notOut)
    s.dealOrder.push(i)
  }
  for (let round = 0; round < 2; round++)
    for (const idx of s.dealOrder) s.players[idx].hole.push(s.deck.shift()!)

  s.phase = 'betting'
  s.toAct = findNextToAct(s, s.bb)
  if (s.toAct === -1) endBettingRound(s)
  return s
}

function postBlind(s: GameState, idx: number, amount: number, blind: 'SB' | 'BB') {
  const p = s.players[idx]
  const pay = Math.min(amount, p.stack)
  p.stack -= pay
  p.bet += pay
  p.committed += pay
  if (p.stack === 0) p.allIn = true
  s.events.push({ kind: 'blind', playerId: p.id, blind, amount: pay })
}

function needsToAct(s: GameState, p: Player): boolean {
  return canAct(p) && (!p.hasActed || p.bet < s.currentBet)
}

/** Next player who must act after index `from`, or -1 when the betting round is over. */
function findNextToAct(s: GameState, from: number): number {
  const actors = s.players.filter(canAct)
  if (actors.length === 0) return -1
  if (actors.length === 1) {
    // Nobody left to bet against: only act if facing a bet.
    const p = actors[0]
    const maxOther = Math.max(0, ...s.players.filter((q) => q !== p && inHand(q)).map((q) => q.bet))
    if (p.bet >= maxOther) return -1
  }
  return nextIndex(s, from, (p) => needsToAct(s, p))
}

export function getLegalActions(state: GameState): LegalActions {
  const p = state.players[state.toAct]
  if (!p || state.phase !== 'betting') {
    return {
      canFold: false,
      canCheck: false,
      canCall: false,
      toCall: 0,
      canRaise: false,
      isOpen: false,
      minRaiseTo: 0,
      maxRaiseTo: 0,
    }
  }
  const toCall = Math.min(state.currentBet - p.bet, p.stack)
  const maxRaiseTo = p.bet + p.stack
  const othersCanRespond = state.players.some((q) => q !== p && canAct(q))
  const reopened = !p.hasActed || state.raiseLevel > p.raiseLevelSeen
  const canRaise = p.stack > toCall && reopened && othersCanRespond
  const isOpen = state.currentBet === 0
  const minRaiseTo = Math.min(
    maxRaiseTo,
    isOpen ? state.bigBlind : state.currentBet + Math.max(state.minRaise, state.bigBlind),
  )
  return {
    canFold: true,
    canCheck: toCall === 0,
    canCall: toCall > 0,
    toCall,
    canRaise,
    isOpen,
    minRaiseTo,
    maxRaiseTo,
  }
}

export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.phase !== 'betting') throw new Error(`Cannot act during phase ${prev.phase}`)
  const s = clone(prev)
  const idx = s.toAct
  const p = s.players[idx]
  const legal = getLegalActions(prev)
  let type = action.type
  let paid = 0

  if (type === 'fold') {
    p.folded = true
  } else if (type === 'check') {
    if (!legal.canCheck) throw new Error('Cannot check facing a bet')
  } else if (type === 'call') {
    if (!legal.canCall) throw new Error('Nothing to call')
    paid = legal.toCall
    commit(p, paid)
  } else {
    // bet / raise / allin all resolve to a "raise to" amount
    let to = type === 'allin' ? legal.maxRaiseTo : (action.amount ?? 0)
    if (to >= legal.maxRaiseTo) {
      to = legal.maxRaiseTo
      type = 'allin'
    }
    if (to <= s.currentBet) {
      // All-in for no more than the current bet is just a call.
      if (to < s.currentBet && to < legal.maxRaiseTo) throw new Error('Raise below current bet')
      paid = to - p.bet
      commit(p, paid)
      if (type !== 'allin') type = 'call'
    } else {
      if (!legal.canRaise) throw new Error('Raising is not allowed here; you may only call or fold')
      if (to < legal.minRaiseTo && type !== 'allin') {
        throw new Error(`Minimum raise is to ${legal.minRaiseTo}`)
      }
      const increment = to - s.currentBet
      // A full raise reopens the betting; a short all-in does not.
      if (increment >= s.minRaise) {
        s.minRaise = increment
        s.raiseLevel += 1
      }
      s.lastAggressor = idx
      paid = to - p.bet
      commit(p, paid)
      s.currentBet = to
      if (type !== 'allin') type = prev.currentBet === 0 ? 'bet' : 'raise'
    }
  }

  p.hasActed = true
  p.raiseLevelSeen = s.raiseLevel
  p.lastAction = { type, amount: p.bet }
  s.events.push({ kind: 'action', playerId: p.id, street: s.street, action: type, paid, to: p.bet })

  const remaining = s.players.filter(inHand)
  if (remaining.length === 1) {
    refundUncalled(s)
    collectBets(s)
    awardUncontested(s, remaining[0])
    return s
  }

  const next = findNextToAct(s, idx)
  if (next === -1) endBettingRound(s)
  else s.toAct = next
  return s
}

function commit(p: Player, amount: number) {
  if (amount > p.stack) throw new Error('Not enough chips')
  p.stack -= amount
  p.bet += amount
  p.committed += amount
  if (p.stack === 0) p.allIn = true
}

function endBettingRound(s: GameState) {
  refundUncalled(s)
  s.toAct = -1
  s.phase = 'streetComplete'
}

/** Return the part of the top bet that nobody matched. */
function refundUncalled(s: GameState) {
  const sorted = s.players.map((p, i) => ({ i, bet: p.bet })).sort((a, b) => b.bet - a.bet)
  if (sorted.length < 2) return
  const [top, second] = sorted
  const excess = top.bet - second.bet
  if (excess > 0) {
    const p = s.players[top.i]
    p.bet -= excess
    p.committed -= excess
    p.stack += excess
    if (p.stack > 0) p.allIn = false
    s.currentBet = p.bet
    s.events.push({ kind: 'refund', playerId: p.id, amount: excess })
  }
}

function collectBets(s: GameState) {
  for (const p of s.players) {
    s.pot += p.bet
    p.bet = 0
  }
}

const NEXT_STREET: Record<Street, Street> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: 'showdown',
  showdown: 'showdown',
}

/** Can more betting happen this hand? (false → just run out the board) */
export function bettingIsOver(state: GameState): boolean {
  return state.players.filter(canAct).length < 2
}

/** Collect bets, deal the next street (or resolve the showdown). */
export function advanceStreet(prev: GameState): GameState {
  if (prev.phase !== 'streetComplete') throw new Error(`Cannot advance during phase ${prev.phase}`)
  const s = clone(prev)
  collectBets(s)
  for (const p of s.players) {
    p.hasActed = false
    p.raiseLevelSeen = -1
    if (!p.folded && !p.allIn) p.lastAction = null
  }
  s.currentBet = 0
  s.minRaise = s.bigBlind
  s.raiseLevel = 0

  const next = NEXT_STREET[s.street]
  if (next === 'showdown') {
    resolveShowdown(s)
    return s
  }
  s.deck.shift() // burn
  const count = next === 'flop' ? 3 : 1
  const cards = s.deck.splice(0, count)
  s.board.push(...cards)
  s.street = next
  s.events.push({ kind: 'street', street: next, cards })

  s.phase = 'betting'
  s.toAct = findNextToAct(s, s.dealer)
  if (s.toAct === -1) {
    s.toAct = -1
    s.phase = 'streetComplete'
  }
  return s
}

/** Main pot + side pots from each player's total commitment. */
export function computePots(players: readonly Player[]): Pot[] {
  const contenders = players.filter((p) => !p.out && !p.folded && p.committed > 0)
  const levels = [...new Set(contenders.map((p) => p.committed))].sort((a, b) => a - b)
  const pots: Pot[] = []
  let prevLevel = 0
  for (const level of levels) {
    let amount = 0
    for (const p of players) amount += Math.max(0, Math.min(p.committed, level) - prevLevel)
    const eligible = contenders.filter((p) => p.committed >= level).map((p) => p.id)
    const last = pots[pots.length - 1]
    if (last && last.eligible.join() === eligible.join()) last.amount += amount
    else if (amount > 0) pots.push({ amount, eligible })
    prevLevel = level
  }
  // Dead money from folded players above the highest contender level
  const leftover = players.reduce((t, p) => t + Math.max(0, p.committed - prevLevel), 0)
  if (leftover > 0 && pots.length) pots[pots.length - 1].amount += leftover
  return pots
}

function seatOrderFromButton(s: GameState): string[] {
  const order: string[] = []
  let i = s.dealer
  for (let k = 0; k < s.players.length; k++) {
    i = (i + 1) % s.players.length
    order.push(s.players[i].id)
  }
  return order
}

function resolveShowdown(s: GameState) {
  s.street = 'showdown'
  const contenders = s.players.filter(inHand)
  const hands: HandOutcome['hands'] = {}
  for (const p of contenders) hands[p.id] = evaluateHand([...p.hole, ...s.board])

  const order = seatOrderFromButton(s)
  const winnings: Record<string, number> = {}
  const pots: PotResult[] = computePots(s.players).map((pot) => {
    const best = Math.max(...pot.eligible.map((id) => hands[id].score))
    const winners = pot.eligible
      .filter((id) => hands[id].score === best)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    const share = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - share * winners.length
    const payouts: Record<string, number> = {}
    for (const id of winners) {
      // Odd chips go to the first winner(s) left of the button.
      payouts[id] = share + (odd > 0 ? 1 : 0)
      if (odd > 0) odd--
      winnings[id] = (winnings[id] ?? 0) + payouts[id]
    }
    return { ...pot, winners, payouts, handName: hands[winners[0]].name }
  })

  for (const p of s.players) if (winnings[p.id]) p.stack += winnings[p.id]
  for (const [id, amount] of Object.entries(winnings)) {
    s.events.push({ kind: 'win', playerId: id, amount, handName: hands[id].name })
  }
  s.pot = 0
  s.outcome = { uncontested: false, pots, hands, winnings }
  s.phase = 'handComplete'
  s.toAct = -1
}

function awardUncontested(s: GameState, winner: Player) {
  const amount = s.pot
  winner.stack += amount
  s.events.push({ kind: 'win', playerId: winner.id, amount, handName: null })
  s.outcome = {
    uncontested: true,
    pots: [{ amount, eligible: [winner.id], winners: [winner.id], payouts: { [winner.id]: amount }, handName: null }],
    hands: {},
    winnings: { [winner.id]: amount },
  }
  s.pot = 0
  s.phase = 'handComplete'
  s.toAct = -1
}

/** Total chips in the middle, including bets on the current street. */
export function totalPot(state: GameState): number {
  return state.pot + state.players.reduce((t, p) => t + p.bet, 0)
}

/** Positional label for each player index (BTN, SB, BB, UTG, HJ, CO). */
export function positionLabels(state: GameState): Record<number, string> {
  const labels: Record<number, string> = {}
  const seated = state.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.out)
  const n = seated.length
  if (state.dealer < 0 || n < 2) return labels
  if (n === 2) {
    labels[state.dealer] = 'BTN'
    labels[state.bb] = 'BB'
    return labels
  }
  labels[state.dealer] = 'BTN'
  labels[state.sb] = 'SB'
  labels[state.bb] = 'BB'
  const middle: number[] = []
  let i = state.bb
  for (;;) {
    i = nextIndex(state, i, (p) => !p.out)
    if (i === state.dealer || i === -1) break
    middle.push(i)
  }
  const names = ['UTG', 'HJ', 'CO'].slice(3 - middle.length)
  middle.forEach((idx, k) => (labels[idx] = names[k]))
  return labels
}
