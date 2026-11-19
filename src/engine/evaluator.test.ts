import { describe, expect, it } from 'vitest'
import { cardToString, fullDeck, parseCard, parseCards } from './cards'
import {
  CATEGORY_NAMES,
  HandCategory,
  categoryOf,
  compareHands,
  evaluate,
  evaluateHand,
} from './evaluator'

const ev = (s: string) => evaluate(parseCards(s))
const cat = (s: string) => categoryOf(ev(s))
const cmp = (a: string, b: string) => Math.sign(compareHands(parseCards(a), parseCards(b)))

describe('cards', () => {
  it('round-trips card strings', () => {
    for (const c of fullDeck()) expect(parseCard(cardToString(c))).toBe(c)
  })
  it('rejects bad cards', () => {
    expect(() => parseCard('1x')).toThrow()
  })
})

describe('evaluate: categories', () => {
  const cases: [string, HandCategory][] = [
    ['AhKhQhJhTh', HandCategory.StraightFlush],
    ['9c9d9h9s2c', HandCategory.Quads],
    ['KcKdKs7h7c', HandCategory.FullHouse],
    ['Ah9h7h4h2h', HandCategory.Flush],
    ['9c8d7h6s5c', HandCategory.Straight],
    ['QcQdQs8h2c', HandCategory.Trips],
    ['JcJd4s4h2c', HandCategory.TwoPair],
    ['TcTd8s4h2c', HandCategory.Pair],
    ['AcJd8s4h2c', HandCategory.HighCard],
  ]
  it.each(cases)('%s → %s', (hand, expected) => {
    expect(cat(hand)).toBe(expected)
  })

  it('orders all nine categories', () => {
    const scores = cases.map(([h]) => ev(h))
    for (let i = 1; i < scores.length; i++) expect(scores[i - 1]).toBeGreaterThan(scores[i])
  })

  it('names categories', () => {
    expect(CATEGORY_NAMES[HandCategory.FullHouse]).toBe('Full House')
  })
})

describe('evaluate: straights', () => {
  it('detects the wheel A-2-3-4-5 as a five-high straight', () => {
    expect(cat('Ac2d3h4s5c')).toBe(HandCategory.Straight)
    expect(evaluateHand(parseCards('Ac2d3h4s5c')).name).toBe('Straight, Five high')
  })
  it('wheel loses to a six-high straight', () => {
    expect(cmp('Ac2d3h4s5c', '2c3d4h5s6c')).toBe(-1)
  })
  it('detects the steel wheel (A-2-3-4-5 suited)', () => {
    expect(cat('Ah2h3h4h5h')).toBe(HandCategory.StraightFlush)
    expect(evaluateHand(parseCards('Ah2h3h4h5h')).name).toBe('Straight Flush, Five high')
  })
  it('steel wheel loses to a six-high straight flush but beats quads', () => {
    expect(cmp('Ah2h3h4h5h', '2s3s4s5s6s')).toBe(-1)
    expect(cmp('Ah2h3h4h5h', 'AcAdAsAhKc')).toBe(1)
  })
  it('does not wrap around (Q-K-A-2-3 is not a straight)', () => {
    expect(cat('QcKdAh2s3c')).toBe(HandCategory.HighCard)
  })
  it('finds the highest straight in 7 cards', () => {
    expect(evaluateHand(parseCards('4c5d6h7s8c9dTh')).name).toBe('Straight, Ten high')
  })
  it('names a royal flush', () => {
    expect(evaluateHand(parseCards('AsKsQsJsTs2c3d')).name).toBe('Royal Flush')
  })
  it('straight flush in 7 cards beats a higher plain flush/straight in the same cards', () => {
    // 5-9 of hearts plus Th (no) — 9h8h7h6h5h with As Ts
    const r = evaluateHand(parseCards('9h8h7h6h5hAsTs'))
    expect(r.category).toBe(HandCategory.StraightFlush)
  })
  it('wheel best five are ordered 5-4-3-2-A', () => {
    const r = evaluateHand(parseCards('Ac2d3h4s5cKdQh'))
    expect(r.best.map(cardToString)).toEqual(['5c', '4s', '3h', '2d', 'Ac'])
  })
})

describe('evaluate: flush vs straight', () => {
  it('flush beats straight', () => {
    expect(cmp('2h5h7h9hJh', 'Tc Jd Qh Ks Ac')).toBe(1)
  })
  it('with 7 cards containing both, the flush is chosen', () => {
    // Board 6h7h8c9d + hole Th2h + Jh? Straight 6-T and a heart flush
    const r = evaluateHand(parseCards('6h7h8c9dTh2hJh'))
    expect(r.category).toBe(HandCategory.Flush)
  })
  it('compares flushes card by card', () => {
    expect(cmp('AhJh9h6h3h', 'AdJd9d6d2d')).toBe(1)
    expect(cmp('AhJh9h6h3h', 'AdJd9d6d3d')).toBe(0)
  })
})

describe('evaluate: full houses', () => {
  it('higher trips wins regardless of pair', () => {
    expect(cmp('KcKdKs2h2c', 'QcQdQsAhAc')).toBe(1)
  })
  it('same trips: higher pair wins', () => {
    expect(cmp('KcKdKsAhAc', 'KhKdKsQhQc')).toBe(1)
  })
  it('two sets of trips in 7 cards makes the best full house', () => {
    const r = evaluateHand(parseCards('7c7d7h3s3c3dAs'))
    expect(r.name).toBe('Full House, Sevens full of Threes')
  })
  it('trips + two pairs picks the higher pair', () => {
    const r = evaluateHand(parseCards('5c5d5h9s9cKdKs'))
    expect(r.name).toBe('Full House, Fives full of Kings')
  })
  it('full house beats flush', () => {
    expect(cmp('2c2d2h3s3c', 'AhKhQhJh9h')).toBe(1)
  })
})

describe('evaluate: kickers', () => {
  it('pair: kicker decides', () => {
    expect(cmp('QcQdAs7h4c', 'QhQsKs7d4d')).toBe(1)
  })
  it('pair: third kicker decides', () => {
    expect(cmp('QcQdAs7h5c', 'QhQsAd7d4d')).toBe(1)
  })
  it('two pair: kicker decides', () => {
    expect(cmp('JcJd4s4hAc', 'JhJs4c4dKd')).toBe(1)
  })
  it('two pair: only the best kicker counts when there are 3 pairs', () => {
    // 7 cards: AA KK QQ 2 → AA KK with Q kicker
    const r = evaluateHand(parseCards('AcAdKhKsQcQd2s'))
    expect(r.name).toBe('Two Pair, Aces and Kings')
    expect(r.best.filter((c) => cardToString(c)[0] === 'Q')).toHaveLength(1)
  })
  it('quads: kicker decides', () => {
    expect(cmp('9c9d9h9sKc', '9c9d9h9sQc')).toBe(1)
  })
  it('trips: kickers decide', () => {
    expect(cmp('7c7d7hAsKc', '7c7d7hAsQc')).toBe(1)
  })
  it('high card: all five cards count, sixth does not', () => {
    expect(cmp('AcKdQh9s7c3d', 'AhKsQd9c7d2h')).toBe(0)
    expect(cmp('AcKdQh9s7c', 'AhKsQd9c6d')).toBe(1)
  })
  it('identical hands tie', () => {
    expect(cmp('AcKdQhJs9c', 'AdKhQsJc9d')).toBe(0)
  })
  it('describes a pair with its kicker', () => {
    expect(evaluateHand(parseCards('QcQdAs7h4c')).name).toBe('Pair of Queens, Ace kicker')
  })
})

describe('evaluateHand best five', () => {
  it('returns five cards that form the hand', () => {
    const r = evaluateHand(parseCards('AsAdKcKh2c7d9s'))
    expect(r.best).toHaveLength(5)
    expect(r.best.map(cardToString).slice(0, 4).sort()).toEqual(['Ad', 'As', 'Kc', 'Kh'])
  })
  it('throws on fewer than 5 cards', () => {
    expect(() => evaluateHand(parseCards('AsKs'))).toThrow()
  })
})
