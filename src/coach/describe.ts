import { RANK_NAMES, RANK_PLURALS, rankOf, suitOf, type Card } from '../engine/cards'
import { HandCategory, evaluate, evaluateHand, tiebreak } from '../engine/evaluator'
import { handClass, preflopPercentile } from './ranges'

const article = (word: string) => (/^[AEIOU8]/i.test(word) ? 'an' : 'a')

export interface StrengthInfo {
  /** e.g. "You have a pair of Queens with an Ace kicker" */
  sentence: string
  /** Short hand name for badges, e.g. "Top pair" */
  short: string
  /** "Premium", "Strong", "Playable", "Speculative", "Weak" / "Monster", ... */
  tier: string
  tierTone: 'great' | 'good' | 'ok' | 'weak'
  /** 0..1, how much of the reference population this hand beats */
  percentile: number
  percentileLabel: string
}

export function describePreflop(hero: readonly Card[]): StrengthInfo {
  const [a, b] = hero
  const ra = rankOf(a)
  const rb = rankOf(b)
  const hi = Math.max(ra, rb)
  const lo = Math.min(ra, rb)
  const suited = suitOf(a) === suitOf(b)
  let sentence: string
  let short: string
  if (hi === lo) {
    sentence = `You have pocket ${RANK_PLURALS[hi]}`
    short = `Pocket ${RANK_PLURALS[hi]}`
  } else {
    const name = `${RANK_NAMES[hi]}-${RANK_NAMES[lo]} ${suited ? 'suited' : 'offsuit'}`
    sentence = `You have ${name}`
    short = name
    if (hi - lo === 1 && suited && hi < 12) sentence += ' (a suited connector)'
    else if (hi >= 9 && lo >= 8) sentence += ' (two Broadway cards)'
  }
  const top = preflopPercentile(handClass(hero))
  const pct = Math.max(1, Math.round(top * 100))
  const [tier, tone] =
    top <= 0.05
      ? (['Premium', 'great'] as const)
      : top <= 0.13
        ? (['Strong', 'good'] as const)
        : top <= 0.3
          ? (['Playable', 'ok'] as const)
          : top <= 0.5
            ? (['Speculative', 'ok'] as const)
            : (['Weak', 'weak'] as const)
  return {
    sentence,
    short,
    tier,
    tierTone: tone,
    percentile: 1 - top,
    percentileLabel: `Top ${pct}% of starting hands`,
  }
}

/** Fraction of possible opponent holdings the hero currently beats (ties count half). */
export function handStrengthNow(hero: readonly Card[], board: readonly Card[]): number {
  const dead = new Set([...hero, ...board])
  const live: Card[] = []
  for (let c = 0; c < 52; c++) if (!dead.has(c)) live.push(c)
  const heroScore = evaluate([...hero, ...board])
  let ahead = 0
  let tied = 0
  let total = 0
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const s = evaluate([live[i], live[j], ...board])
      if (heroScore > s) ahead++
      else if (heroScore === s) tied++
      total++
    }
  }
  return (ahead + tied / 2) / total
}

export function describePostflop(hero: readonly Card[], board: readonly Card[]): StrengthInfo {
  const res = evaluateHand([...hero, ...board])
  const [a, b] = tiebreak(res.score)
  const heroRanks = hero.map(rankOf)
  const boardRanks = board.map(rankOf).sort((x, y) => y - x)
  const usesHole = res.best.some((card) => hero.includes(card))
  const pocketPair = heroRanks[0] === heroRanks[1]
  let sentence = `You have ${res.name.toLowerCase()}`
  let short = res.name.split(',')[0]

  switch (res.category) {
    case HandCategory.HighCard: {
      sentence = `You have ${RANK_NAMES[a].toLowerCase()} high — no pair yet`
      short = `${RANK_NAMES[a]} high`
      break
    }
    case HandCategory.Pair: {
      const pr = a
      const kicker = heroRanks.filter((r) => r !== pr).sort((x, y) => y - x)[0]
      const uniqBoard = [...new Set(boardRanks)]
      if (pocketPair && heroRanks.includes(pr)) {
        if (pr > boardRanks[0]) {
          sentence = `You have an overpair: pocket ${RANK_PLURALS[pr]}, higher than every board card`
          short = 'Overpair'
        } else {
          sentence = `You have pocket ${RANK_PLURALS[pr]} — an underpair to the board`
          short = 'Underpair'
        }
      } else if (heroRanks.includes(pr)) {
        const idx = uniqBoard.indexOf(pr)
        const where = idx === 0 ? 'top pair' : idx === 1 ? 'second pair' : idx === uniqBoard.length - 1 ? 'bottom pair' : 'middle pair'
        sentence = `You have a pair of ${RANK_PLURALS[pr]} (${where})`
        if (kicker !== undefined) sentence += ` with ${article(RANK_NAMES[kicker])} ${RANK_NAMES[kicker]} kicker`
        short = where[0].toUpperCase() + where.slice(1)
      } else {
        sentence = `The board is paired (${RANK_PLURALS[pr]}); you're playing your ${RANK_NAMES[Math.max(...heroRanks)]} high`
        short = 'Board pair'
      }
      break
    }
    case HandCategory.TwoPair: {
      const fromHole = [a, b].filter((r) => heroRanks.includes(r)).length
      if (fromHole === 0) {
        sentence = `The board shows two pair (${RANK_PLURALS[a]} and ${RANK_PLURALS[b]}); your best card is the kicker`
        short = 'Board two pair'
      } else {
        sentence = `You have two pair, ${RANK_PLURALS[a]} and ${RANK_PLURALS[b]}`
        if (fromHole === 1 && pocketPair) sentence += ' (your pocket pair plus a pair on the board)'
        short = 'Two pair'
      }
      break
    }
    case HandCategory.Trips: {
      if (pocketPair && heroRanks[0] === a) {
        sentence = `You have a set of ${RANK_PLURALS[a]} — very strong and well disguised`
        short = 'Set'
      } else if (heroRanks.includes(a)) {
        const kicker = heroRanks.find((r) => r !== a)
        sentence = `You have trips: three ${RANK_PLURALS[a]}`
        if (kicker !== undefined) sentence += ` with ${article(RANK_NAMES[kicker])} ${RANK_NAMES[kicker]} kicker`
        short = 'Trips'
      } else {
        sentence = `Three ${RANK_PLURALS[a]} are on the board; everyone shares them`
        short = 'Board trips'
      }
      break
    }
    default: {
      sentence =
        res.category === HandCategory.Quads
          ? `You have four of a kind: four ${RANK_PLURALS[a]}`
          : `You have ${article(res.name)} ${res.name.replace(',', ' —')}`
      if (res.category === HandCategory.Straight && a === 3) sentence += ' (the wheel)'
      if (!usesHole) sentence += ' — but it is all on the board, so you are only playing the board'
    }
  }

  const strength = board.length >= 3 ? handStrengthNow(hero, board) : 0
  const [tier, tone] =
    strength >= 0.95
      ? (['Monster', 'great'] as const)
      : strength >= 0.82
        ? (['Strong', 'good'] as const)
        : strength >= 0.6
          ? (['Medium', 'ok'] as const)
          : strength >= 0.4
            ? (['Marginal', 'ok'] as const)
            : (['Weak', 'weak'] as const)

  return {
    sentence,
    short,
    tier,
    tierTone: tone,
    percentile: strength,
    percentileLabel: `Beats ${Math.round(strength * 100)}% of possible hands right now`,
  }
}

export function describeHand(hero: readonly Card[], board: readonly Card[]): StrengthInfo {
  return board.length >= 3 ? describePostflop(hero, board) : describePreflop(hero)
}
