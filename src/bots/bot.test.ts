import { describe, expect, it } from 'vitest'
import { advanceStreet, applyAction, createGame, startHand } from '../engine/game'
import { createRng } from '../engine/rng'
import type { GameState } from '../engine/types'
import { decideBot, thinkTime } from './bot'
import { PERSONALITIES } from './personalities'

function botTable(stack = 1000): GameState {
  return createGame({
    seats: PERSONALITIES.map((p) => ({ id: p.id, name: p.name, stack })),
    smallBlind: 5,
    bigBlind: 10,
  })
}

function playHand(state: GameState, seed: number, vpip: Map<string, number>) {
  const rng = createRng(seed)
  let s = startHand(state, seed)
  const voluntarily = new Set<string>()
  let guard = 0
  while (s.phase !== 'handComplete') {
    if (guard++ > 200) throw new Error('hand did not terminate')
    if (s.phase === 'streetComplete') {
      s = advanceStreet(s)
      continue
    }
    const p = s.players[s.toAct]
    const me = PERSONALITIES.find((x) => x.id === p.id)!
    const { action } = decideBot(s, s.toAct, me, rng)
    if (s.street === 'preflop' && action.type !== 'fold' && action.type !== 'check')
      voluntarily.add(p.id)
    s = applyAction(s, action)
  }
  for (const id of voluntarily) vpip.set(id, (vpip.get(id) ?? 0) + 1)
  return s
}

describe('bots', () => {
  it('always choose legal actions and chips are conserved over many hands', () => {
    let s = botTable()
    const vpip = new Map<string, number>()
    for (let h = 0; h < 120; h++) {
      // rebuy busted bots so the game keeps going
      for (const p of s.players) if (p.stack === 0) p.stack = 1000
      const total = s.players.reduce((t, p) => t + p.stack, 0)
      s = playHand(s, 1000 + h, vpip)
      expect(s.players.reduce((t, p) => t + p.stack, 0)).toBe(total)
    }
  })

  it('personalities differ: the maniac and station play far more hands than the rock', () => {
    let s = botTable(100000)
    const vpip = new Map<string, number>()
    for (let h = 0; h < 200; h++) s = playHand(s, 5000 + h, vpip)
    const v = (id: string) => vpip.get(id) ?? 0
    expect(v('jinx')).toBeGreaterThan(v('rook') * 1.8)
    expect(v('mochi')).toBeGreaterThan(v('rook') * 1.8)
  })

  it('think time stays within 0.6–1.5s at normal speed', () => {
    const rng = createRng(1)
    for (let i = 0; i < 100; i++) {
      const t = thinkTime(rng(), rng)
      expect(t).toBeGreaterThanOrEqual(600)
      expect(t).toBeLessThanOrEqual(1500)
    }
    expect(thinkTime(1, rng, 2)).toBeLessThanOrEqual(750)
  })
})
