import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './gameStore'

/** Drive the real store with fake timers: deals, bot turns, hero decisions, grading, stats. */
describe('game store integration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    try {
      localStorage.clear()
    } catch {
      /* ignore */
    }
    useGame.getState().updateSettings({ bots: 3, speed: 'fast', sound: false, mode: 'quiz' })
    useGame.getState().resetStats()
  })
  afterEach(() => {
    useGame.getState().leaveGame()
    vi.useRealTimers()
  })

  async function untilHeroTurnOrDone(maxMs = 60000) {
    for (let t = 0; t < maxMs; t += 100) {
      const s = useGame.getState()
      if (s.heroTurn && s.coach) return 'hero'
      if (s.game?.phase === 'handComplete') return 'done'
      await vi.advanceTimersByTimeAsync(100)
    }
    throw new Error('timed out')
  }

  it('plays several full hands, grading the hero and keeping chips constant', async () => {
    useGame.getState().startGame()
    const total = () =>
      useGame.getState().game!.players.reduce((t, p) => t + p.stack + p.bet, 0) +
      useGame.getState().game!.pot
    const start = total()
    expect(useGame.getState().screen).toBe('game')

    for (let hand = 0; hand < 4; hand++) {
      for (let guard = 0; guard < 20; guard++) {
        const r = await untilHeroTurnOrDone()
        if (r === 'done') break
        // Always call/check
        const g = useGame.getState().game!
        const p = g.players[g.toAct]
        useGame.getState().heroAct(g.currentBet > p.bet ? { type: 'call' } : { type: 'check' })
        expect(useGame.getState().feedback).not.toBeNull()
      }
      await vi.advanceTimersByTimeAsync(4000)
      const st = useGame.getState()
      expect(st.game!.phase).toBe('handComplete')
      expect(st.lastHand).not.toBeNull()
      expect(st.summaryOpen).toBe(true)
      expect(total()).toBe(start)
      st.dealNextHand()
    }
    const stats = useGame.getState().stats
    expect(stats.handsPlayed).toBe(4)
    expect(stats.decisions).toBeGreaterThan(0)
  })

  it('ignores hero input when it is not the hero’s turn', () => {
    useGame.getState().startGame()
    const before = useGame.getState().game
    useGame.getState().heroAct({ type: 'fold' })
    expect(useGame.getState().game).toBe(before)
  })

  it('replay steps through snapshots of the last hand', async () => {
    useGame.getState().startGame()
    for (let guard = 0; guard < 20; guard++) {
      const r = await untilHeroTurnOrDone()
      if (r === 'done') break
      useGame.getState().heroAct({ type: 'fold' })
    }
    await vi.advanceTimersByTimeAsync(4000)
    useGame.getState().startReplay()
    const r = useGame.getState().replay!
    expect(r.index).toBe(0)
    useGame.getState().stepReplay(1)
    expect(useGame.getState().replay!.index).toBe(1)
    useGame.getState().stepReplay(-5)
    expect(useGame.getState().replay!.index).toBe(0)
    useGame.getState().closeReplay()
    expect(useGame.getState().replay).toBeNull()
  })
})
