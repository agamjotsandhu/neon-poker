import { create } from 'zustand'
import { decideBot, thinkTime } from '../bots/bot'
import { HUMAN_AVATAR, PERSONALITIES, type AvatarSpec, type Personality } from '../bots/personalities'
import { getAdvice, type Advice } from '../coach/advice'
import { prepareEquityJob } from '../coach/analysis'
import { monteCarloEquity, type EquityResult } from '../coach/equity'
import { computeEquity } from '../coach/equityClient'
import { describeHand, type StrengthInfo } from '../coach/describe'
import { gradeDecision, type Feedback } from '../coach/grade'
import { findOuts, type OutsReport } from '../coach/outs'
import { buildSituation, type Situation } from '../coach/situation'
import {
  advanceStreet,
  applyAction,
  createGame,
  getLegalActions,
  startHand,
} from '../engine/game'
import { createRng, freshSeed } from '../engine/rng'
import type { Action, ActionType, GameState } from '../engine/types'
import { PACE } from '../ui/motion'
import { play, setSoundEnabled } from '../ui/sound'
import { load, save } from './persist'

export type Screen = 'landing' | 'howto' | 'game'
export type Mode = 'coach' | 'quiz'
export type Speed = 'relaxed' | 'normal' | 'fast'

export interface Settings {
  bots: number
  startingStackBB: number
  blindsIndex: number
  speed: Speed
  sound: boolean
  mode: Mode
}

export const BLIND_LEVELS = [
  { sb: 1, bb: 2 },
  { sb: 5, bb: 10 },
  { sb: 25, bb: 50 },
] as const

export const SPEED_FACTOR: Record<Speed, number> = { relaxed: 0.75, normal: 1, fast: 1.8 }

export interface Stats {
  handsPlayed: number
  handsWon: number
  decisions: number
  points: number
  great: number
  good: number
  mistakes: number
  biggestPot: number
  net: number
}

const DEFAULT_SETTINGS: Settings = {
  bots: 5,
  startingStackBB: 100,
  blindsIndex: 1,
  speed: 'normal',
  sound: true,
  mode: 'coach',
}

const EMPTY_STATS: Stats = {
  handsPlayed: 0,
  handsWon: 0,
  decisions: 0,
  points: 0,
  great: 0,
  good: 0,
  mistakes: 0,
  biggestPot: 0,
  net: 0,
}

export interface CoachState {
  /** Decision id — guards async equity results. */
  token: number
  situation: Situation
  hand: StrengthInfo
  outs: OutsReport | null
  equity: EquityResult | null
  rangeLabels: string[]
  advice: Advice | null
}

export interface HandRecord {
  handNumber: number
  snapshots: GameState[]
  decisions: Feedback[]
  heroNet: number
  final: GameState
}

export interface SeatMeta {
  avatar: AvatarSpec
  tag: string
  style: string
}

interface Store {
  screen: Screen
  settings: Settings
  stats: Stats
  game: GameState | null
  heroIndex: number
  seatMeta: Record<string, SeatMeta>
  personalities: Record<string, Personality>
  thinkingId: string | null
  /** Input is accepted only when true. */
  heroTurn: boolean
  coach: CoachState | null
  feedback: Feedback | null
  handDecisions: Feedback[]
  snapshots: GameState[]
  lastHand: HandRecord | null
  summaryOpen: boolean
  historyOpen: boolean
  settingsOpen: boolean
  coachSheetOpen: boolean
  replay: { record: HandRecord; index: number; playing: boolean } | null
  /** Incremented on every new hand → resets deal animations. */
  handKey: number

  setScreen: (s: Screen) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMode: (m: Mode) => void
  toggleSound: () => void
  startGame: () => void
  leaveGame: () => void
  dealNextHand: () => void
  heroAct: (action: Action) => void
  rebuy: () => void
  setSummaryOpen: (v: boolean) => void
  setHistoryOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setCoachSheetOpen: (v: boolean) => void
  startReplay: () => void
  stepReplay: (delta: number) => void
  toggleReplayPlay: () => void
  closeReplay: () => void
  resetStats: () => void
}

const SETTINGS_KEY = 'neon-holdem:settings'
const STATS_KEY = 'neon-holdem:stats'

/* ---------- timers: every scheduled step is cancellable on leave/new game ---------- */
const timers = new Set<ReturnType<typeof setTimeout>>()
function schedule(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}
function clearTimers() {
  for (const t of timers) clearTimeout(t)
  timers.clear()
}

let replayTimer: ReturnType<typeof setInterval> | null = null
let coachToken = 0

/** `?seed=123` makes deals and bot decisions reproducible (used by visual QA). */
function urlSeed(): number | null {
  try {
    const v = new URLSearchParams(window.location.search).get('seed')
    return v && /^\d+$/.test(v) ? Number(v) : null
  } catch {
    return null
  }
}
const fixedSeed = urlSeed()
const seedRng = fixedSeed === null ? null : createRng(fixedSeed)
const nextSeed = () => (seedRng ? Math.floor(seedRng() * 0xffffffff) >>> 0 : freshSeed())
const botRng = createRng(fixedSeed === null ? freshSeed() : fixedSeed + 1)

const initialSettings = load(SETTINGS_KEY, DEFAULT_SETTINGS)
setSoundEnabled(initialSettings.sound)

export const useGame = create<Store>((set, get) => {
  const speed = () => SPEED_FACTOR[get().settings.speed]

  function pushSnapshot(g: GameState) {
    set((st) => ({ game: g, snapshots: [...st.snapshots, g] }))
  }

  function soundForAction(type: ActionType) {
    if (type === 'fold') play('fold')
    else if (type === 'check') play('tick')
    else play('chip')
  }

  /** Main loop: look at the engine phase and schedule the next step. */
  function proceed() {
    const g = get().game
    if (!g) return
    if (g.phase === 'betting') {
      const p = g.players[g.toAct]
      if (p.isHuman) beginHeroTurn(g)
      else botTurn(g)
    } else if (g.phase === 'streetComplete') {
      schedule(() => {
        const cur = get().game
        if (!cur || cur.phase !== 'streetComplete') return
        const next = advanceStreet(cur)
        pushSnapshot(next)
        if (next.phase === 'handComplete') {
          finishHand(next)
          return
        }
        play('deal')
        play('flip', 0.45)
        const wait = next.street === 'flop' ? PACE.flop : PACE.turnRiver
        const runout = next.phase === 'streetComplete' ? PACE.runoutPause : 0
        schedule(proceed, (wait + runout) / Math.min(speed(), 1.3))
      }, PACE.collect)
    } else if (g.phase === 'handComplete') {
      finishHand(g)
    }
  }

  function botTurn(g: GameState) {
    const p = g.players[g.toAct]
    const me = get().personalities[p.id]
    const decision = decideBot(g, g.toAct, me, botRng)
    set({ thinkingId: p.id })
    schedule(() => {
      const cur = get().game
      if (!cur || cur.phase !== 'betting' || cur.players[cur.toAct]?.id !== p.id) return
      let next: GameState
      try {
        next = applyAction(cur, decision.action)
      } catch {
        const legal = getLegalActions(cur)
        next = applyAction(cur, legal.canCheck ? { type: 'check' } : { type: 'fold' })
      }
      soundForAction(next.players[cur.toAct].lastAction?.type ?? 'check')
      set({ thinkingId: null })
      pushSnapshot(next)
      schedule(proceed, PACE.afterAction / speed())
    }, thinkTime(decision.difficulty, botRng, speed()))
  }

  function beginHeroTurn(g: GameState) {
    const heroIndex = g.toAct
    const situation = buildSituation(g, heroIndex)
    const hand = describeHand(situation.hero, situation.board)
    const outs = situation.board.length >= 3 ? findOuts(situation.hero, situation.board) : null
    const token = ++coachToken
    const preflopAdvice = situation.street === 'preflop' ? getAdvice(situation, null) : null
    const job = prepareEquityJob(situation, situation.street === 'preflop' ? 3000 : 8000, token)
    set({
      heroTurn: true,
      coach: {
        token,
        situation,
        hand,
        outs,
        equity: null,
        rangeLabels: job.rangeLabels,
        advice: preflopAdvice,
      },
      coachSheetOpen: get().settings.mode === 'coach' ? get().coachSheetOpen : false,
    })
    play('alert')
    void computeEquity(job.request).then((equity) => {
      const c = get().coach
      if (!c || c.token !== token) return
      const advice = c.advice ?? getAdvice(c.situation, { equity: equity.equity, outs: c.outs })
      set({ coach: { ...c, equity, advice } })
    })
  }

  function finishHand(g: GameState) {
    const st = get()
    const hero = g.players[st.heroIndex]
    const startStack = st.snapshots[0]?.players[st.heroIndex]
    const startChips = startStack ? startStack.stack + startStack.bet : hero.stack
    const heroNet = hero.stack - startChips
    const won = (g.outcome?.winnings[hero.id] ?? 0) > 0
    const potSize = g.outcome?.pots.reduce((t, p) => t + p.amount, 0) ?? 0
    const decisions = st.handDecisions
    const stats: Stats = {
      ...st.stats,
      handsPlayed: st.stats.handsPlayed + 1,
      handsWon: st.stats.handsWon + (won ? 1 : 0),
      biggestPot: won ? Math.max(st.stats.biggestPot, potSize) : st.stats.biggestPot,
      net: st.stats.net + heroNet,
    }
    save(STATS_KEY, stats)
    const record: HandRecord = {
      handNumber: g.handNumber,
      snapshots: st.snapshots,
      decisions,
      heroNet,
      final: g,
    }
    set({ stats, lastHand: record, heroTurn: false, thinkingId: null })
    if (won) play('win', g.outcome?.uncontested ? 0.4 : 1.1)
    const delay = g.outcome?.uncontested ? PACE.uncontestedSummaryDelay : PACE.summaryDelay
    schedule(() => set({ summaryOpen: true }), delay)
  }

  function newTable(): GameState {
    const { settings } = get()
    const blinds = BLIND_LEVELS[settings.blindsIndex] ?? BLIND_LEVELS[1]
    const stack = settings.startingStackBB * blinds.bb
    const bots = PERSONALITIES.slice(0, Math.max(1, Math.min(5, settings.bots)))
    const seats = [
      { id: 'hero', name: 'You', isHuman: true, stack },
      ...bots.map((b) => ({ id: b.id, name: b.name, stack })),
    ]
    const personalities: Record<string, Personality> = {}
    const seatMeta: Record<string, SeatMeta> = {
      hero: { avatar: HUMAN_AVATAR, tag: 'YOU', style: 'That’s you. The coach is in your corner.' },
    }
    for (const b of bots) {
      personalities[b.id] = b
      seatMeta[b.id] = { avatar: b.avatar, tag: b.tag, style: b.style }
    }
    const initialDealer = seedRng ? 0 : Math.floor(Math.random() * seats.length)
    set({ personalities, seatMeta, heroIndex: 0 })
    return createGame({ seats, smallBlind: blinds.sb, bigBlind: blinds.bb, initialDealer })
  }

  return {
    screen: 'landing',
    settings: initialSettings,
    stats: load(STATS_KEY, EMPTY_STATS),
    game: null,
    heroIndex: 0,
    seatMeta: {},
    personalities: {},
    thinkingId: null,
    heroTurn: false,
    coach: null,
    feedback: null,
    handDecisions: [],
    snapshots: [],
    lastHand: null,
    summaryOpen: false,
    historyOpen: false,
    settingsOpen: false,
    coachSheetOpen: false,
    replay: null,
    handKey: 0,

    setScreen: (screen) => set({ screen }),

    updateSettings: (patch) => {
      const settings = { ...get().settings, ...patch }
      save(SETTINGS_KEY, settings)
      if (patch.sound !== undefined) setSoundEnabled(patch.sound)
      set({ settings })
    },

    setMode: (mode) => get().updateSettings({ mode }),

    toggleSound: () => get().updateSettings({ sound: !get().settings.sound }),

    startGame: () => {
      clearTimers()
      const game = newTable()
      set({ game, screen: 'game', lastHand: null, feedback: null, summaryOpen: false, replay: null })
      get().dealNextHand()
    },

    leaveGame: () => {
      clearTimers()
      if (replayTimer) clearInterval(replayTimer)
      set({ screen: 'landing', game: null, heroTurn: false, thinkingId: null, coach: null, summaryOpen: false, replay: null, historyOpen: false })
    },

    rebuy: () => {
      const g = get().game
      if (!g) return
      const next = structuredClone(g)
      const blinds = BLIND_LEVELS[get().settings.blindsIndex] ?? BLIND_LEVELS[1]
      next.players[get().heroIndex].stack = get().settings.startingStackBB * blinds.bb
      next.players[get().heroIndex].out = false
      set({ game: next })
      get().dealNextHand()
    },

    dealNextHand: () => {
      clearTimers()
      const prev = get().game
      if (!prev) return
      const g0 = structuredClone(prev)
      const blinds = BLIND_LEVELS[get().settings.blindsIndex] ?? BLIND_LEVELS[1]
      // Bots that bust rebuy so the table stays full.
      for (const p of g0.players) {
        if (!p.isHuman && p.stack <= 0) {
          p.stack = get().settings.startingStackBB * blinds.bb
          p.out = false
        }
      }
      if (g0.players[get().heroIndex].stack <= 0) {
        set({ summaryOpen: true })
        return
      }
      const g = startHand(g0, nextSeed())
      set({
        game: g,
        snapshots: [g],
        handDecisions: [],
        summaryOpen: false,
        heroTurn: false,
        thinkingId: null,
        coach: null,
        feedback: null,
        replay: null,
        handKey: get().handKey + 1,
      })
      play('shuffle')
      const cards = g.dealOrder.length * 2
      for (let k = 0; k < cards; k++) play('deal', 0.95 + k * 0.1)
      play('chip', 0.2)
      schedule(proceed, PACE.dealBase + cards * PACE.dealPerCard)
    },

    heroAct: (action) => {
      const st = get()
      const g = st.game
      if (!g || !st.heroTurn || g.phase !== 'betting' || g.toAct !== st.heroIndex) return
      let next: GameState
      try {
        next = applyAction(g, action)
      } catch {
        return
      }
      const took = next.players[st.heroIndex].lastAction?.type ?? action.type
      soundForAction(took)

      // Grade the decision (compute advice synchronously if equity hasn't arrived yet)
      let feedback: Feedback | null = null
      const c = st.coach
      if (c) {
        let advice = c.advice
        if (!advice) {
          const job = prepareEquityJob(c.situation, 2000, c.token)
          const eq = monteCarloEquity(job.request)
          advice = getAdvice(c.situation, { equity: eq.equity, outs: c.outs })
        }
        if (advice) {
          feedback = gradeDecision(advice, took, c.situation.street, {
            canCheck: c.situation.canCheck,
            amount: next.players[st.heroIndex].lastAction?.amount,
            pot: c.situation.pot,
          })
        }
      }
      const stats = { ...st.stats }
      if (feedback) {
        stats.decisions += 1
        stats.points += feedback.points
        if (feedback.grade === 'great') stats.great += 1
        else if (feedback.grade === 'good') stats.good += 1
        else stats.mistakes += 1
        save(STATS_KEY, stats)
      }
      set({
        heroTurn: false,
        coach: null,
        feedback,
        stats,
        handDecisions: feedback ? [...st.handDecisions, feedback] : st.handDecisions,
      })
      pushSnapshot(next)
      schedule(proceed, PACE.afterAction / speed())
    },

    setSummaryOpen: (summaryOpen) => set({ summaryOpen }),
    setHistoryOpen: (historyOpen) => set({ historyOpen }),
    setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    setCoachSheetOpen: (coachSheetOpen) => set({ coachSheetOpen }),

    startReplay: () => {
      const record = get().lastHand
      if (!record) return
      if (replayTimer) clearInterval(replayTimer)
      set({ replay: { record, index: 0, playing: true }, summaryOpen: false, historyOpen: false })
      replayTimer = setInterval(() => {
        const r = get().replay
        if (!r || !r.playing) return
        if (r.index >= r.record.snapshots.length - 1) {
          set({ replay: { ...r, playing: false } })
          return
        }
        set({ replay: { ...r, index: r.index + 1 } })
      }, PACE.replayStep)
    },

    stepReplay: (delta) => {
      const r = get().replay
      if (!r) return
      const index = Math.max(0, Math.min(r.record.snapshots.length - 1, r.index + delta))
      set({ replay: { ...r, index, playing: false } })
    },

    toggleReplayPlay: () => {
      const r = get().replay
      if (!r) return
      const atEnd = r.index >= r.record.snapshots.length - 1
      set({ replay: { ...r, index: atEnd ? 0 : r.index, playing: !r.playing } })
    },

    closeReplay: () => {
      if (replayTimer) clearInterval(replayTimer)
      replayTimer = null
      const g = get().game
      set({ replay: null, summaryOpen: g?.phase === 'handComplete' })
    },

    resetStats: () => {
      save(STATS_KEY, EMPTY_STATS)
      set({ stats: EMPTY_STATS })
    },
  }
})
