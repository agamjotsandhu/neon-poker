import { describe, expect, it } from 'vitest'
import { parseCards } from '../engine/cards'
import { applyAction, createGame, startHand, advanceStreet } from '../engine/game'
import type { GameState } from '../engine/types'
import { getAdvice, potOdds, type Advice } from './advice'
import { prepareEquityJob } from './analysis'
import { describePostflop, describePreflop, handStrengthNow } from './describe'
import { monteCarloEquity } from './equity'
import { gradeDecision } from './grade'
import { connects, estimateRange } from './opponentRange'
import { findDraws, findOuts } from './outs'
import {
  ALL_CLASSES,
  CLASSES_BY_STRENGTH,
  classGridPos,
  combosOf,
  gridClass,
  handClass,
  parseRange,
  preflopPercentile,
  rangeFraction,
  rfiRange,
  topRange,
} from './ranges'
import { buildSituation, type Situation } from './situation'

const c = parseCards

describe('ranges', () => {
  it('classifies hands', () => {
    expect(handClass(c('AsKs'))).toBe('AKs')
    expect(handClass(c('Kd As'))).toBe('AKo')
    expect(handClass(c('7c7h'))).toBe('77')
    expect(handClass(c('2c7c'))).toBe('72s')
  })

  it('lays out a 13×13 grid with suited top-right and offsuit bottom-left', () => {
    expect(gridClass(0, 0)).toBe('AA')
    expect(gridClass(0, 1)).toBe('AKs')
    expect(gridClass(1, 0)).toBe('AKo')
    expect(gridClass(12, 12)).toBe('22')
    expect(ALL_CLASSES).toHaveLength(169)
    expect(new Set(ALL_CLASSES).size).toBe(169)
    for (const hc of ALL_CLASSES) {
      const { row, col } = classGridPos(hc)
      expect(gridClass(row, col)).toBe(hc)
    }
  })

  it('parses range notation', () => {
    expect([...parseRange('TT+')].sort()).toEqual(['AA', 'JJ', 'KK', 'QQ', 'TT'])
    expect([...parseRange('A2s+')]).toHaveLength(12)
    expect(parseRange('ATo+')).toEqual(new Set(['ATo', 'AJo', 'AQo', 'AKo']))
    expect(parseRange('77-99')).toEqual(new Set(['77', '88', '99']))
    expect(parseRange('A2s-A5s')).toEqual(new Set(['A2s', 'A3s', 'A4s', 'A5s']))
    expect(parseRange('KQ')).toEqual(new Set(['KQs', 'KQo']))
  })

  it('counts combos', () => {
    expect(combosOf('AA')).toHaveLength(6)
    expect(combosOf('AKs')).toHaveLength(4)
    expect(combosOf('AKo')).toHaveLength(12)
    expect(combosOf('AA', new Set(c('As')))).toHaveLength(3)
    const all = ALL_CLASSES.reduce((t, hc) => t + combosOf(hc).length, 0)
    expect(all).toBe(1326)
  })

  it('RFI ranges widen from UTG to BTN', () => {
    const w = (p: 'UTG' | 'HJ' | 'CO' | 'BTN') => rangeFraction(rfiRange(p))
    expect(w('UTG')).toBeLessThan(w('HJ'))
    expect(w('HJ')).toBeLessThan(w('CO'))
    expect(w('CO')).toBeLessThan(w('BTN'))
    expect(w('UTG')).toBeGreaterThan(0.14)
    expect(w('BTN')).toBeLessThan(0.5)
  })

  it('orders hands by strength', () => {
    expect(CLASSES_BY_STRENGTH[0]).toBe('AA')
    expect(CLASSES_BY_STRENGTH).toHaveLength(169)
    expect(preflopPercentile('AA')).toBeCloseTo(6 / 1326)
    expect(preflopPercentile('32o')).toBeCloseTo(1)
    expect(rangeFraction(topRange(0.1))).toBeGreaterThanOrEqual(0.1)
    expect(rangeFraction(topRange(0.1))).toBeLessThan(0.12)
  })
})

describe('Monte Carlo equity', () => {
  it('AA vs KK preflop ≈ 82%', () => {
    const r = monteCarloEquity({ hero: c('AsAh'), board: [], opponents: [combosOf('KK', new Set(c('AsAh')))], iterations: 6000 })
    expect(r.equity).toBeGreaterThan(0.78)
    expect(r.equity).toBeLessThan(0.86)
  })
  it('AKo vs random ≈ 65%', () => {
    const r = monteCarloEquity({ hero: c('AsKd'), board: [], opponents: [[]], iterations: 6000 })
    expect(r.equity).toBeGreaterThan(0.61)
    expect(r.equity).toBeLessThan(0.69)
  })
  it('equity drops multiway', () => {
    const one = monteCarloEquity({ hero: c('AsKd'), board: [], opponents: [[]], iterations: 3000 })
    const three = monteCarloEquity({ hero: c('AsKd'), board: [], opponents: [[], [], []], iterations: 3000 })
    expect(three.equity).toBeLessThan(one.equity - 0.15)
  })
  it('the nuts on the river is 100%; a dead hand is 0%', () => {
    const nuts = monteCarloEquity({ hero: c('AsKs'), board: c('QsJsTs2d3c'), opponents: [[]], iterations: 500 })
    expect(nuts.equity).toBe(1)
    const dead = monteCarloEquity({
      hero: c('2c3d'),
      board: c('AsKsQsJs9d'),
      opponents: [[[parseCards('Ts')[0], parseCards('8h')[0]]]],
      iterations: 200,
    })
    expect(dead.equity).toBe(0)
  })
  it('board-plays ties are counted as half', () => {
    const r = monteCarloEquity({
      hero: c('2c3d'),
      board: c('AhKhQhJhTh'),
      opponents: [[[parseCards('4c')[0], parseCards('5d')[0]]]],
      iterations: 100,
    })
    expect(r.tie).toBeCloseTo(0.5)
    expect(r.equity).toBeCloseTo(0.5)
  })
  it('is reproducible with a seed', () => {
    const a = monteCarloEquity({ hero: c('9s8s'), board: c('7s6d2c'), opponents: [[]], iterations: 1000, seed: 3 })
    const b = monteCarloEquity({ hero: c('9s8s'), board: c('7s6d2c'), opponents: [[]], iterations: 1000, seed: 3 })
    expect(a).toEqual(b)
  })
})

describe('outs and draws', () => {
  it('flush draw has 9 outs', () => {
    const r = findOuts(c('AhKh'), c('7h2h9c'))
    expect(r.draws.map((d) => d.kind)).toContain('flush-draw')
    expect(r.groups.find((g) => g.makes === 'Flush')?.count).toBe(9)
  })
  it('open-ended straight draw has 8 outs', () => {
    const r = findOuts(c('9c8d'), c('7h6s2c'))
    expect(r.draws.map((d) => d.kind)).toContain('oesd')
    expect(r.groups.find((g) => g.makes === 'Straight')?.count).toBe(8)
  })
  it('gutshot has 4 outs', () => {
    const r = findOuts(c('9c8d'), c('6h5s2c'))
    expect(r.draws.map((d) => d.kind)).toContain('gutshot')
    expect(r.groups.find((g) => g.makes === 'Straight')?.count).toBe(4)
  })
  it('double gutshot is recognised', () => {
    // 9-7-6-5-3: an 8 or a 4 completes
    const d = findDraws(c('9c3d'), c('7h6s5c'))
    expect(d.map((x) => x.kind)).toContain('double-gutshot')
  })
  it('two overcards', () => {
    const r = findOuts(c('AcKd'), c('7h6s2c'))
    expect(r.draws.map((d) => d.kind)).toContain('overcards')
    expect(r.groups.find((g) => g.makes === 'Top pair')?.count).toBe(6)
  })
  it('combo draw: flush + straight draw outs are not double counted', () => {
    const r = findOuts(c('9h8h'), c('7h6c2h'))
    // 9 flush + 6 non-heart straight cards (5,T × 3 suits) + 6 overcard pair outs (9s, 8s)
    expect(r.groups.find((g) => g.makes === 'Flush')?.count).toBe(9)
    expect(r.groups.find((g) => g.makes === 'Straight')?.count).toBe(6)
    expect(r.outs.length).toBe(21)
    expect(new Set(r.outs.map((o) => o.card)).size).toBe(21)
  })
  it('rule of 2 and 4 vs exact odds', () => {
    const r = findOuts(c('AhKh'), c('7h2h9c'))
    expect(r.ruleOf4).toBe(Math.min(100, r.outs.length * 4))
    expect(r.ruleOf2).toBe(r.outs.length * 2)
    expect(r.byRiver).toBeGreaterThan(0.5)
    expect(findOuts(c('AhKh'), c('7h2h9cTd')).byRiver).toBeNull()
  })
  it('board-only improvements are not outs', () => {
    const r = findOuts(c('2c3d'), c('AhAsKh'))
    // A third ace improves only the board → not an out for us
    expect(r.outs.some((o) => o.card === parseCards('Ad')[0])).toBe(false)
  })
  it('no outs report preflop or on the river', () => {
    expect(findOuts(c('AhKh'), []).outs).toHaveLength(0)
    expect(findOuts(c('AhKh'), c('2c3d4h5s9c')).outs).toHaveLength(0)
  })
})

describe('describe', () => {
  it('preflop sentences and percentile', () => {
    expect(describePreflop(c('QsQh')).sentence).toBe('You have pocket Queens')
    expect(describePreflop(c('AsKs')).sentence).toContain('Ace-King suited')
    expect(describePreflop(c('AsAh')).tier).toBe('Premium')
    expect(describePreflop(c('7c2d')).tier).toBe('Weak')
    expect(describePreflop(c('AsAh')).percentileLabel).toBe('Top 1% of starting hands')
  })
  it('top pair with kicker', () => {
    expect(describePostflop(c('QsAd'), c('Qh7c2d')).sentence).toBe('You have a pair of Queens (top pair) with an Ace kicker')
  })
  it('overpair, set, board pair', () => {
    expect(describePostflop(c('KsKd'), c('Qh7c2d')).short).toBe('Overpair')
    expect(describePostflop(c('7s7d'), c('Qh7c2d')).short).toBe('Set')
    expect(describePostflop(c('As3d'), c('QhQc2d')).short).toBe('Board pair')
  })
  it('playing the board', () => {
    expect(describePostflop(c('2s3d'), c('AhKhQhJhTh')).sentence).toContain('playing the board')
  })
  it('hand strength is near 1 for the nuts and low for air', () => {
    expect(handStrengthNow(c('AsKs'), c('QsJsTs'))).toBeGreaterThan(0.99)
    expect(handStrengthNow(c('3c2d'), c('AsKhQd'))).toBeLessThan(0.1)
  })
})

describe('opponent ranges', () => {
  it('connects() recognises pairs and draws', () => {
    expect(connects(c('Ah5c'), c('As9d2c'))).toBe(true)
    expect(connects(c('Th9h'), c('2h5h8c'))).toBe(true)
    expect(connects(c('3c4d'), c('AsKdQh'))).toBe(false)
  })
  it('narrows the range of a postflop bettor', () => {
    const base = {
      id: 'b',
      name: 'Bot',
      index: 1,
      position: 'CO',
      stack: 1000,
      allIn: false,
      preflopRole: 'raiser' as const,
      aggressivePostflop: false,
      aggressiveThisStreet: false,
    }
    const board = c('Kh7c2d')
    const dead = new Set([...board, ...c('AsAd')])
    const passive = estimateRange(base, dead, board)
    const aggro = estimateRange({ ...base, aggressivePostflop: true }, dead, board)
    expect(aggro.combos.length).toBeLessThan(passive.combos.length)
    expect(aggro.label).toContain('weighted')
  })
})

const situation = (over: Partial<Situation>): Situation => ({
  heroIndex: 0,
  hero: c('AsAh'),
  board: [],
  street: 'preflop',
  position: 'UTG',
  bigBlind: 10,
  pot: 15,
  toCall: 10,
  heroBet: 0,
  heroStack: 1000,
  currentBet: 10,
  canCheck: false,
  canRaise: true,
  isOpen: false,
  minRaiseTo: 20,
  maxRaiseTo: 1000,
  opponents: [
    {
      id: 'b',
      name: 'Bot',
      index: 1,
      position: 'BB',
      stack: 1000,
      allIn: false,
      preflopRole: 'blind',
      aggressivePostflop: false,
      aggressiveThisStreet: false,
    },
  ],
  playersDealt: 6,
  preflop: { facing: 'unopened', raises: 0, limpers: 0, openerPosition: null, lastRaiseTo: 10, heroRaised: false },
  inPosition: false,
  heroHasInitiative: false,
  effectiveStackBB: 100,
  ...over,
})

describe('advice: preflop', () => {
  it('opens premium hands', () => {
    const a = getAdvice(situation({}), null)!
    expect(a.action).toBe('raise')
    expect(a.amount).toBe(25)
    expect(a.headline).toBe('Raise to 2.5 BB')
  })
  it('folds trash under the gun', () => {
    expect(getAdvice(situation({ hero: c('7c2d') }), null)!.action).toBe('fold')
  })
  it('opens wider on the button', () => {
    expect(getAdvice(situation({ hero: c('Kc8d'), position: 'UTG' }), null)!.action).toBe('fold')
    expect(getAdvice(situation({ hero: c('Kc8d'), position: 'BTN' }), null)!.action).toBe('raise')
  })
  it('checks the big blind for free instead of folding', () => {
    const a = getAdvice(situation({ hero: c('7c2d'), position: 'BB', toCall: 0, canCheck: true, preflop: { facing: 'limped', raises: 0, limpers: 2, openerPosition: null, lastRaiseTo: 10, heroRaised: false } }), null)!
    expect(a.action).toBe('check')
  })
  it('3-bets value vs a raise and folds junk', () => {
    const facing = { facing: 'raised' as const, raises: 1, limpers: 0, openerPosition: 'CO', lastRaiseTo: 25, heroRaised: false }
    const val = getAdvice(situation({ position: 'BTN', toCall: 25, preflop: facing }), null)!
    expect(val.action).toBe('raise')
    expect(val.amount).toBe(75)
    expect(getAdvice(situation({ hero: c('Jc4d'), position: 'BTN', toCall: 25, preflop: facing }), null)!.action).toBe('fold')
  })
  it('defends the big blind wide', () => {
    const facing = { facing: 'raised' as const, raises: 1, limpers: 0, openerPosition: 'BTN', lastRaiseTo: 25, heroRaised: false }
    const a = getAdvice(situation({ hero: c('Qs8s'), position: 'BB', toCall: 15, pot: 40, preflop: facing }), null)!
    expect(a.action).toBe('call')
  })
  it('pushes short stacks', () => {
    const a = getAdvice(situation({ hero: c('AsTd'), position: 'BTN', effectiveStackBB: 9, maxRaiseTo: 90 }), null)!
    expect(a.action).toBe('allin')
  })
  it('stacks off with aces vs a 4-bet', () => {
    const facing = { facing: '4bet+' as const, raises: 3, limpers: 0, openerPosition: 'CO', lastRaiseTo: 200, heroRaised: true }
    expect(getAdvice(situation({ position: 'CO', toCall: 125, preflop: facing }), null)!.action).toBe('allin')
  })
})

describe('advice: postflop', () => {
  const flop = { street: 'flop' as const, board: c('Kh7c2d') }
  it('returns null until equity is known', () => {
    expect(getAdvice(situation(flop), null)).toBeNull()
  })
  it('value bets a big favourite when checked to', () => {
    const a = getAdvice(situation({ ...flop, toCall: 0, canCheck: true, pot: 60, currentBet: 0, minRaiseTo: 10 }), { equity: 0.85, outs: null })!
    expect(a.action).toBe('bet')
    expect(a.amount).toBe(40)
  })
  it('checks a weak hand', () => {
    const a = getAdvice(situation({ ...flop, toCall: 0, canCheck: true, pot: 60, currentBet: 0 }), { equity: 0.25, outs: null })!
    expect(a.action).toBe('check')
  })
  it('folds without the odds and calls with them', () => {
    const facing = { ...flop, toCall: 50, pot: 110, currentBet: 50, minRaiseTo: 100 }
    // need 50 / 160 = 31%
    expect(getAdvice(situation(facing), { equity: 0.2, outs: null })!.action).toBe('fold')
    expect(getAdvice(situation(facing), { equity: 0.4, outs: null })!.action).toBe('call')
    expect(getAdvice(situation(facing), { equity: 0.9, outs: null })!.action).toBe('raise')
  })
  it('explains pot odds', () => {
    const facing = { ...flop, toCall: 50, pot: 110, currentBet: 50 }
    const a = getAdvice(situation(facing), { equity: 0.2, outs: null })!
    expect(a.why).toMatch(/31%/)
    expect(a.required).toBeCloseTo(50 / 160)
  })
  it('semi-bluffs strong draws', () => {
    const outs = findOuts(c('Ah5h'), c('Kh7h2d'))
    const a = getAdvice(situation({ ...flop, hero: c('Ah5h'), board: c('Kh7h2d'), toCall: 0, canCheck: true, pot: 60, currentBet: 0 }), { equity: 0.45, outs })!
    expect(a.action).toBe('bet')
    expect(a.headline).toContain('semi-bluff')
    expect(a.why).toMatch(/outs/)
  })
})

describe('potOdds', () => {
  it('computes required equity and ratio', () => {
    expect(potOdds(50, 100).required).toBeCloseTo(1 / 3)
    expect(potOdds(50, 100).ratio).toBe('2.0 : 1')
    expect(potOdds(0, 100).required).toBe(0)
  })
})

describe('grading', () => {
  const adv: Advice = { action: 'raise', amount: 25, headline: 'Raise', why: 'Because it is strong. More.', acceptable: [], close: false, basis: 'chart' }
  it('matching action is great', () => {
    expect(gradeDecision(adv, 'raise', 'preflop', { canCheck: false, amount: 25 }).grade).toBe('great')
  })
  it('oversized raise is only good', () => {
    expect(gradeDecision(adv, 'raise', 'preflop', { canCheck: false, amount: 100 }).grade).toBe('good')
  })
  it('folding a raise-hand is a blunder', () => {
    expect(gradeDecision(adv, 'fold', 'preflop').grade).toBe('blunder')
  })
  it('calling instead of raising is a mistake', () => {
    const f = gradeDecision(adv, 'call', 'preflop')
    expect(f.grade).toBe('mistake')
    expect(f.title).toBe('Consider raising instead')
  })
  it('acceptable alternative is good', () => {
    expect(gradeDecision({ ...adv, acceptable: ['call'] }, 'call', 'preflop').grade).toBe('good')
  })
  it('folding when you could check is always a blunder', () => {
    const chk: Advice = { ...adv, action: 'check' }
    expect(gradeDecision(chk, 'fold', 'flop', { canCheck: true }).grade).toBe('blunder')
  })
})

describe('buildSituation from a live game', () => {
  const game = (): GameState =>
    createGame({
      seats: ['You', 'A', 'B', 'C', 'D', 'E'].map((n, i) => ({ id: `p${i}`, name: n, stack: 1000, isHuman: i === 0 })),
      smallBlind: 5,
      bigBlind: 10,
      initialDealer: 3,
    })

  it('detects an unopened pot for UTG', () => {
    // dealer 3 → sb 4, bb 5, UTG = p0 (hero)
    const s = startHand(game(), 11)
    expect(s.toAct).toBe(0)
    const sit = buildSituation(s, 0)
    expect(sit.position).toBe('UTG')
    expect(sit.preflop.facing).toBe('unopened')
    expect(sit.toCall).toBe(10)
    expect(sit.pot).toBe(15)
    expect(sit.opponents).toHaveLength(5)
  })

  it('tracks raises, callers and initiative', () => {
    let s = startHand(game(), 11)
    s = applyAction(s, { type: 'raise', amount: 30 }) // hero UTG
    s = applyAction(s, { type: 'fold' }) // p1
    s = applyAction(s, { type: 'fold' }) // p2
    s = applyAction(s, { type: 'raise', amount: 90 }) // p3 BTN 3-bets
    s = applyAction(s, { type: 'fold' }) // p4
    s = applyAction(s, { type: 'fold' }) // p5
    const sit = buildSituation(s, 0)
    expect(sit.preflop.facing).toBe('3bet')
    expect(sit.preflop.heroRaised).toBe(true)
    expect(sit.opponents[0].preflopRole).toBe('3bettor')
    s = applyAction(s, { type: 'call' })
    s = advanceStreet(s)
    const post = buildSituation(s, 0)
    expect(post.street).toBe('flop')
    expect(post.inPosition).toBe(false)
    expect(post.heroHasInitiative).toBe(false)
    const job = prepareEquityJob(post, 500)
    expect(job.request.opponents).toHaveLength(1)
    expect(job.rangeLabels[0]).toContain('re-raised')
    const r = monteCarloEquity(job.request)
    expect(r.equity).toBeGreaterThan(0)
    expect(r.equity).toBeLessThan(1)
  })
})
