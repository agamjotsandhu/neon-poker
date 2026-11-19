import { describe, expect, it } from 'vitest'
import { parseCards } from './cards'
import {
  advanceStreet,
  applyAction,
  computePots,
  createGame,
  getLegalActions,
  positionLabels,
  startHand,
  totalPot,
} from './game'
import { shuffledDeck } from './rng'
import type { Action, GameState } from './types'

function table(stacks: number[], dealer = 0, sb = 5, bb = 10): GameState {
  return createGame({
    seats: stacks.map((stack, i) => ({ id: `p${i}`, name: `P${i}`, stack, isHuman: i === 0 })),
    smallBlind: sb,
    bigBlind: bb,
    initialDealer: dealer,
  })
}

/** Force hole cards and the run-out (board order: flop×3, turn, river; burns inserted). */
function rig(s: GameState, holes: string[], board: string): GameState {
  const next = structuredClone(s)
  const used = new Set<number>()
  holes.forEach((h, i) => {
    if (!h) return
    next.players[i].hole = parseCards(h)
    next.players[i].hole.forEach((c) => used.add(c))
  })
  const b = parseCards(board)
  b.forEach((c) => used.add(c))
  const filler = shuffledDeck(99).filter((c) => !used.has(c))
  next.deck = [filler[0], b[0], b[1], b[2], filler[1], b[3], filler[2], b[4], ...filler.slice(3)]
  return next
}

const act = (s: GameState, ...actions: Action[]) => actions.reduce((st, a) => applyAction(st, a), s)
const run = (s: GameState) => {
  let st = s
  while (st.phase === 'streetComplete') st = advanceStreet(st)
  return st
}
const chips = (s: GameState) => s.players.reduce((t, p) => t + p.stack + p.bet, 0) + s.pot

describe('seeded shuffle', () => {
  it('is reproducible', () => {
    expect(shuffledDeck(42)).toEqual(shuffledDeck(42))
    expect(shuffledDeck(42)).not.toEqual(shuffledDeck(43))
  })
  it('is a permutation of 52 cards', () => {
    expect([...shuffledDeck(7)].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i))
  })
  it('deals the same hand for the same seed', () => {
    const a = startHand(table([1000, 1000, 1000]), 5)
    const b = startHand(table([1000, 1000, 1000]), 5)
    expect(a.players.map((p) => p.hole)).toEqual(b.players.map((p) => p.hole))
  })
})

describe('createGame / startHand', () => {
  it('rejects bad player counts', () => {
    expect(() => table([100])).toThrow()
    expect(() => table([1, 1, 1, 1, 1, 1, 1])).toThrow()
  })

  it('posts blinds, deals 2 cards each and sets first to act (6-max)', () => {
    const s = startHand(table([1000, 1000, 1000, 1000, 1000, 1000]), 1)
    expect(s.dealer).toBe(0)
    expect(s.sb).toBe(1)
    expect(s.bb).toBe(2)
    expect(s.players[1].bet).toBe(5)
    expect(s.players[2].bet).toBe(10)
    expect(s.toAct).toBe(3) // UTG
    expect(s.players.every((p) => p.hole.length === 2)).toBe(true)
    expect(s.deck).toHaveLength(52 - 12)
    expect(s.dealOrder).toEqual([1, 2, 3, 4, 5, 0])
    expect(positionLabels(s)).toEqual({ 0: 'BTN', 1: 'SB', 2: 'BB', 3: 'UTG', 4: 'HJ', 5: 'CO' })
  })

  it('heads-up: button is small blind and acts first preflop, last postflop', () => {
    let s = startHand(table([1000, 1000]), 1)
    expect(s.dealer).toBe(0)
    expect(s.sb).toBe(0)
    expect(s.bb).toBe(1)
    expect(s.toAct).toBe(0)
    expect(s.dealOrder).toEqual([1, 0])
    s = act(s, { type: 'call' }, { type: 'check' })
    expect(s.phase).toBe('streetComplete')
    s = advanceStreet(s)
    expect(s.street).toBe('flop')
    expect(s.toAct).toBe(1) // BB first postflop
    expect(positionLabels(s)).toEqual({ 0: 'BTN', 1: 'BB' })
  })

  it('moves the button and skips busted players', () => {
    let s = table([1000, 0, 1000, 1000])
    s = startHand(s, 1)
    expect(s.dealer).toBe(0)
    expect(s.sb).toBe(2)
    expect(s.players[1].hole).toHaveLength(0)
    s.phase = 'handComplete'
    s = startHand(s, 2)
    expect(s.dealer).toBe(2)
  })

  it('short blind posts all-in', () => {
    const s = startHand(table([1000, 3, 1000]), 0)
    expect(s.players[1].bet).toBe(3)
    expect(s.players[1].allIn).toBe(true)
    expect(s.currentBet).toBe(10)
  })

  it('positions for 4 and 5 handed', () => {
    expect(positionLabels(startHand(table([9, 9, 9, 9].map(() => 1000)), 1))).toEqual({
      0: 'BTN',
      1: 'SB',
      2: 'BB',
      3: 'CO',
    })
    expect(positionLabels(startHand(table([1, 1, 1, 1, 1].map(() => 1000)), 1))).toEqual({
      0: 'BTN',
      1: 'SB',
      2: 'BB',
      3: 'HJ',
      4: 'CO',
    })
  })
})

describe('betting', () => {
  it('BB gets the option when everyone limps', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    s = act(s, { type: 'call' }, { type: 'call' })
    expect(s.toAct).toBe(2)
    expect(getLegalActions(s).canCheck).toBe(true)
    expect(getLegalActions(s).canRaise).toBe(true)
    s = act(s, { type: 'check' })
    expect(s.phase).toBe('streetComplete')
  })

  it('preflop raise is a "raise"; postflop first chips are a "bet"', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    s = act(s, { type: 'raise', amount: 30 })
    expect(s.players[0].lastAction).toEqual({ type: 'raise', amount: 30 })
    s = act(s, { type: 'fold' }, { type: 'call' })
    s = advanceStreet(s)
    expect(getLegalActions(s).isOpen).toBe(true)
    s = act(s, { type: 'bet', amount: 40 })
    expect(s.players[2].lastAction?.type).toBe('bet')
  })

  it('enforces the minimum raise (last full raise size)', () => {
    let s = startHand(table([1000, 1000, 1000, 1000]), 1)
    // UTG raises to 30 (raise of 20). Next min raise is to 50.
    s = act(s, { type: 'raise', amount: 30 })
    expect(getLegalActions(s).minRaiseTo).toBe(50)
    expect(() => act(s, { type: 'raise', amount: 45 })).toThrow(/Minimum raise/)
    s = act(s, { type: 'raise', amount: 100 }) // raise of 70
    expect(getLegalActions(s).minRaiseTo).toBe(170)
  })

  it('cannot check facing a bet; cannot call with nothing to call', () => {
    const s = startHand(table([1000, 1000, 1000]), 1)
    expect(() => act(s, { type: 'check' })).toThrow()
    const s2 = act(s, { type: 'call' }, { type: 'call' })
    expect(() => act(s2, { type: 'call' })).toThrow()
  })

  it('min bet postflop is one big blind', () => {
    let s = startHand(table([1000, 1000]), 1)
    s = act(s, { type: 'call' }, { type: 'check' })
    s = advanceStreet(s)
    expect(getLegalActions(s).minRaiseTo).toBe(10)
  })

  it('a short all-in raise does not reopen betting for players who already acted', () => {
    // p0 BTN 1000, p1 SB 1000, p2 BB 1000, p3 UTG 45
    let s = startHand(table([1000, 1000, 1000, 45]), 1)
    // dealer=0, sb=1, bb=2, utg=3
    s = act(s, { type: 'raise', amount: 30 }) // p3 (UTG) opens
    expect(s.players[3].bet).toBe(30)
    s = act(s, { type: 'call' }) // p0 BTN calls 30
    s = act(s, { type: 'fold' }) // p1 SB folds
    s = act(s, { type: 'call' }) // p2 BB calls
    expect(s.phase).toBe('streetComplete')
    s = advanceStreet(s)
    // flop: first to act is p2 (BB) since SB folded
    expect(s.toAct).toBe(2)
    s = act(s, { type: 'bet', amount: 10 }) // p2 bets 10
    s = act(s, { type: 'allin' }) // p3 all-in for 15 (short raise of 5 < min 10)
    expect(s.players[3].allIn).toBe(true)
    expect(s.currentBet).toBe(15)
    // p0 has not acted yet this street → may raise
    expect(s.toAct).toBe(0)
    expect(getLegalActions(s).canRaise).toBe(true)
    s = act(s, { type: 'call' })
    // p2 already acted and faced only a short raise → call or fold only
    expect(s.toAct).toBe(2)
    const legal = getLegalActions(s)
    expect(legal.canRaise).toBe(false)
    expect(legal.toCall).toBe(5)
    expect(() => act(s, { type: 'raise', amount: 100 })).toThrow()
    s = act(s, { type: 'call' })
    expect(s.phase).toBe('streetComplete')
  })

  it('a full all-in raise does reopen betting', () => {
    let s = startHand(table([1000, 1000, 1000, 100]), 1)
    s = act(s, { type: 'raise', amount: 30 }) // UTG
    s = act(s, { type: 'call' }, { type: 'fold' }, { type: 'call' })
    s = advanceStreet(s)
    s = act(s, { type: 'bet', amount: 10 }) // p2
    s = act(s, { type: 'allin' }) // p3 all-in to 70: full raise
    s = act(s, { type: 'call' }) // p0
    expect(getLegalActions(s).canRaise).toBe(true)
  })

  it('folding to a bet awards the pot uncontested and refunds the uncalled bet', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    s = act(s, { type: 'raise', amount: 40 }, { type: 'fold' }, { type: 'fold' })
    expect(s.phase).toBe('handComplete')
    expect(s.outcome?.uncontested).toBe(true)
    // p0 wins blinds 15 net; refund of 30 above BB's 10
    expect(s.players[0].stack).toBe(1015)
    expect(s.events.some((e) => e.kind === 'refund' && e.amount === 30)).toBe(true)
    expect(chips(s)).toBe(3000)
  })

  it('cannot act after the hand is over', () => {
    let s = startHand(table([1000, 1000]), 1)
    s = act(s, { type: 'fold' })
    expect(() => act(s, { type: 'check' })).toThrow()
    expect(() => advanceStreet(s)).toThrow()
  })

  it('all-in call for less than the bet', () => {
    let s = startHand(table([1000, 1000, 50]), 1)
    // dealer 0, sb 1, bb 2(50 stack). UTG = p0 in 3-handed
    s = act(s, { type: 'raise', amount: 200 }, { type: 'fold' })
    s = act(s, { type: 'call' }) // p2 all-in for 50 total
    expect(s.players[2].allIn).toBe(true)
    expect(s.phase).toBe('streetComplete')
    // uncalled 150 back to p0
    expect(s.players[0].bet).toBe(50)
  })

  it('totalPot includes current street bets', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    expect(totalPot(s)).toBe(15)
    s = act(s, { type: 'raise', amount: 30 })
    expect(totalPot(s)).toBe(45)
  })

  it('a full hand to showdown conserves chips', () => {
    let s = startHand(table([500, 500, 500, 500]), 3)
    s = act(s, { type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'check' })
    for (let street = 0; street < 3; street++) {
      s = advanceStreet(s)
      s = act(s, { type: 'check' }, { type: 'check' }, { type: 'check' }, { type: 'check' })
    }
    s = advanceStreet(s)
    expect(s.phase).toBe('handComplete')
    expect(s.street).toBe('showdown')
    expect(s.board).toHaveLength(5)
    expect(chips(s)).toBe(2000)
  })
})

describe('showdown, split pots and side pots', () => {
  it('board plays: everyone splits', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    s = rig(s, ['2c3d', '2d3c', '4h2s'], 'AhKhQhJhTh')
    s = act(s, { type: 'call' }, { type: 'call' }, { type: 'check' })
    for (let i = 0; i < 3; i++) {
      s = advanceStreet(s)
      s = act(s, { type: 'check' }, { type: 'check' }, { type: 'check' })
    }
    s = advanceStreet(s)
    expect(s.outcome?.pots[0].winners).toHaveLength(3)
    expect(s.outcome?.pots[0].handName).toBe('Royal Flush')
    expect(s.players.map((p) => p.stack)).toEqual([1000, 1000, 1000])
  })

  it('kicker tie on the board splits; kicker in hand wins', () => {
    let s = startHand(table([1000, 1000]), 1)
    // Board pairs: AA 9 7 4 → p0 K kicker vs p1 Q kicker
    s = rig(s, ['Kc2d', 'Qh3s'], 'AcAd9h7s4c')
    s = act(s, { type: 'call' }, { type: 'check' })
    s = run(s)
    while (s.phase !== 'handComplete') {
      s = act(s, { type: 'check' }, { type: 'check' })
      s = run(s)
    }
    expect(s.outcome?.pots[0].winners).toEqual(['p0'])
    expect(s.players[0].stack).toBe(1010)
  })

  it('kickers that do not play produce a split', () => {
    let s = startHand(table([1000, 1000]), 1)
    // Board AKQJ9: best five for both is A K Q J + 9? p0 holds 8, p1 holds 7 → neither plays
    s = rig(s, ['8c2d', '7h3s'], 'AcKdQhJs9c')
    s = act(s, { type: 'call' }, { type: 'check' })
    s = run(s)
    while (s.phase !== 'handComplete') {
      s = act(s, { type: 'check' }, { type: 'check' })
      s = run(s)
    }
    expect(s.outcome?.pots[0].winners.sort()).toEqual(['p0', 'p1'])
    expect(s.players.map((p) => p.stack)).toEqual([1000, 1000])
  })

  it('odd chip goes to the first winner left of the button', () => {
    let s = startHand(table([1000, 1000, 1000], 0, 5, 10), 1)
    // dealer p0, sb p1, bb p2. p0 folds; p1 completes; pot 20 split... make it odd: SB=5 dead
    s = rig(s, ['2c3d', 'AsKd', 'AhKc'], 'QcJd8h4s2s')
    s = act(s, { type: 'call' }) // p0 calls 10
    s = act(s, { type: 'fold' }) // p1 SB folds (5 dead)
    s = act(s, { type: 'check' }) // p2
    // pot = 25 between p0 and p2... they don't tie. Rig a tie instead:
    expect(totalPot(s)).toBe(25)
    s = rig(s, ['AdKs', 'AsKd', 'AhKc'], 'QcJd8h4s2s')
    s = run(s)
    while (s.phase !== 'handComplete') {
      s = act(s, { type: 'check' }, { type: 'check' })
      s = run(s)
    }
    // p2 is first left of button among winners (order: p1, p2, p0)
    expect(s.outcome?.pots[0].payouts).toEqual({ p2: 13, p0: 12 })
  })

  it('multiple side pots with three all-ins of different sizes', () => {
    // p0 100, p1 300, p2 600, p3 1000
    let s = startHand(table([100, 300, 600, 1000]), 0)
    // dealer p0, sb p1, bb p2, utg p3
    s = rig(s, ['AsAd', 'KsKd', 'QsQd', 'JsJd'], '2c7h9dTc3h')
    s = act(s, { type: 'allin' }) // p3 shoves 1000
    s = act(s, { type: 'allin' }) // p0 100
    s = act(s, { type: 'allin' }) // p1 300
    s = act(s, { type: 'allin' }) // p2 600
    expect(s.phase).toBe('streetComplete')
    // p3's 400 above p2's 600 is uncalled
    expect(s.players[3].stack).toBe(400)
    const pots = computePots(s.players)
    expect(pots.map((p) => p.amount)).toEqual([400, 600, 600])
    expect(pots[0].eligible).toEqual(['p0', 'p1', 'p2', 'p3'])
    expect(pots[1].eligible).toEqual(['p1', 'p2', 'p3'])
    expect(pots[2].eligible).toEqual(['p2', 'p3'])
    s = run(s)
    expect(s.phase).toBe('handComplete')
    expect(s.board).toHaveLength(5)
    expect(s.players.map((p) => p.stack)).toEqual([400, 600, 600, 400])
    expect(chips(s)).toBe(2000)
  })

  it('side pot won by a different player than the main pot', () => {
    let s = startHand(table([100, 500, 500]), 0)
    // dealer p0, sb p1, bb p2; p0 is UTG(3-handed: first after BB = p0)
    s = rig(s, ['AsAd', 'KsKd', 'QsQd'], '2c7h9dTc3h')
    s = act(s, { type: 'allin' }) // p0 100
    s = act(s, { type: 'raise', amount: 300 }) // p1
    s = act(s, { type: 'call' }) // p2
    s = run(s)
    s = act(s, { type: 'bet', amount: 100 }, { type: 'call' })
    while (s.phase !== 'handComplete') {
      s = run(s)
      if (s.phase === 'betting') s = act(s, { type: 'check' }, { type: 'check' })
    }
    // main pot 300 → p0 (AA); side pot (200+200 pre + 200 flop) = 600 → p1 (KK)
    expect(s.outcome?.pots.map((p) => [p.amount, p.winners])).toEqual([
      [300, ['p0']],
      [600, ['p1']],
    ])
    expect(s.players.map((p) => p.stack)).toEqual([300, 700, 100])
  })

  it('split side pot while main pot goes to the short stack', () => {
    let s = startHand(table([50, 500, 500]), 0)
    s = rig(s, ['AsAd', 'KsQd', 'KdQs'], '2c7h9dTc3h')
    s = act(s, { type: 'allin' }, { type: 'call' }, { type: 'call' })
    // p1 SB called 50, p2 BB checks? BB already bet 10, call → 50
    while (s.phase !== 'handComplete') {
      s = run(s)
      if (s.phase === 'betting') s = act(s, { type: 'bet', amount: 100 }, { type: 'call' })
    }
    const [main, side] = s.outcome!.pots
    expect(main.winners).toEqual(['p0'])
    expect(main.amount).toBe(150)
    expect(side.winners.sort()).toEqual(['p1', 'p2'])
    expect(chips(s)).toBe(1050)
  })

  it('folded players money stays in the pot but they cannot win it', () => {
    let s = startHand(table([1000, 1000, 1000]), 1)
    s = rig(s, ['AsAd', '7c2d', 'KsKd'], '2c7h9dTc3h')
    s = act(s, { type: 'raise', amount: 100 }, { type: 'call' }, { type: 'call' })
    s = advanceStreet(s)
    s = act(s, { type: 'check' }) // p1
    s = act(s, { type: 'bet', amount: 200 }) // p2
    s = act(s, { type: 'call' }) // p0
    s = act(s, { type: 'fold' }) // p1 folds two pair!
    s = run(s)
    while (s.phase !== 'handComplete') {
      s = act(s, { type: 'check' }, { type: 'check' })
      s = run(s)
    }
    expect(s.outcome?.pots).toHaveLength(1)
    expect(s.outcome?.pots[0].amount).toBe(700)
    expect(s.outcome?.pots[0].winners).toEqual(['p0'])
    expect(s.outcome?.hands.p1).toBeUndefined()
  })

  it('all-in preflop runs the board out without further betting', () => {
    let s = startHand(table([200, 200]), 1)
    s = act(s, { type: 'allin' }, { type: 'call' })
    expect(s.phase).toBe('streetComplete')
    s = advanceStreet(s)
    expect(s.street).toBe('flop')
    expect(s.phase).toBe('streetComplete')
    s = run(s)
    expect(s.phase).toBe('handComplete')
    expect(s.board).toHaveLength(5)
    expect(chips(s)).toBe(400)
  })
})
