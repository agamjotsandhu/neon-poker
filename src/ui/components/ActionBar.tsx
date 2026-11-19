import clsx from 'clsx'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { familyOf } from '../../coach/advice'
import { getLegalActions, totalPot } from '../../engine/game'
import type { Action } from '../../engine/types'
import { useGame } from '../../store/gameStore'
import { SPRING } from '../motion'

type Fam = 'fold' | 'passive' | 'aggressive'

export function ActionBar() {
  const game = useGame((s) => s.game)
  const heroTurn = useGame((s) => s.heroTurn)
  const heroAct = useGame((s) => s.heroAct)
  const coach = useGame((s) => s.coach)
  const mode = useGame((s) => s.settings.mode)
  const thinkingId = useGame((s) => s.thinkingId)
  const heroIndex = useGame((s) => s.heroIndex)

  const legal = useMemo(() => (game && heroTurn ? getLegalActions(game) : null), [game, heroTurn])
  const hero = game?.players[heroIndex]
  const unit = game ? Math.max(1, game.bigBlind / 2) : 1
  const pot = game ? totalPot(game) : 0

  const advice = coach?.advice ?? null
  const recommended: Fam | null = mode === 'coach' && advice ? familyOf(advice.action) : null

  const [amount, setAmount] = useState(0)
  const token = coach?.token ?? 0
  useEffect(() => {
    if (!legal) return
    const suggested = advice && familyOf(advice.action) === 'aggressive' && advice.amount && mode === 'coach' ? advice.amount : legal.minRaiseTo
    const id = requestAnimationFrame(() => setAmount(Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, suggested))))
    return () => cancelAnimationFrame(id)
  }, [token, legal, advice, mode])

  const clampAmt = (v: number) => (legal ? Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(v / unit) * unit)) : v)

  const sizeTo = (frac: number) => {
    if (!legal || !hero) return 0
    return clampAmt(hero.bet + legal.toCall + frac * (pot + legal.toCall))
  }

  const act = (a: Action) => heroAct(a)
  const doFold = () => legal && act({ type: 'fold' })
  const doCall = () => legal && act(legal.canCheck ? { type: 'check' } : { type: 'call' })
  const doRaise = () => {
    if (!legal || !legal.canRaise) return
    if (amount >= legal.maxRaiseTo) act({ type: 'allin' })
    else act({ type: legal.isOpen ? 'bet' : 'raise', amount })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'f') doFold()
      else if (k === 'c') doCall()
      else if (k === 'r') doRaise()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const thinkingName = thinkingId ? game?.players.find((p) => p.id === thinkingId)?.name : null
  const disabled = !legal
  const allInAmount = legal?.maxRaiseTo ?? 0
  const isAllIn = legal ? amount >= legal.maxRaiseTo : false
  const fill = legal && legal.maxRaiseTo > legal.minRaiseTo ? ((amount - legal.minRaiseTo) / (legal.maxRaiseTo - legal.minRaiseTo)) * 100 : 100
  const raiseLabel = legal ? (isAllIn ? 'ALL-IN' : legal.isOpen ? 'BET' : 'RAISE TO') : 'RAISE'
  const fmt = (v: number) => v.toLocaleString()

  return (
    <div className="relative z-30 border-t border-haze-400/15 bg-night-950/85 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md sm:px-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-5">
        {/* sizing */}
        <div className={clsx('flex flex-1 items-center gap-2 transition-opacity', (disabled || !legal?.canRaise) && 'pointer-events-none opacity-35')}>
          <div className="flex gap-1">
            {[
              ['½', 0.5],
              ['¾', 0.75],
              ['POT', 1],
            ].map(([label, f]) => (
              <button
                key={label}
                onClick={() => setAmount(sizeTo(f as number))}
                className="rounded-pixel bg-night-700 px-2.5 py-1.5 font-display text-xs text-haze-200 ring-1 ring-haze-400/25 transition hover:bg-night-600 hover:text-haze-100"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setAmount(allInAmount)}
              className="rounded-pixel bg-night-700 px-2.5 py-1.5 font-display text-xs text-neon-amber ring-1 ring-neon-amber/40 transition hover:bg-night-600"
            >
              MAX
            </button>
          </div>
          <input
            type="range"
            aria-label="Bet size"
            className="neon-range min-w-0 flex-1"
            min={legal?.minRaiseTo ?? 0}
            max={legal?.maxRaiseTo ?? 1}
            step={unit}
            value={amount}
            style={{ ['--fill' as string]: `${fill}%` }}
            onChange={(e) => setAmount(clampAmt(Number(e.target.value)))}
          />
          <span className="num w-16 text-right text-sm text-haze-100">{fmt(amount)}</span>
        </div>

        {/* actions */}
        <div className="grid grid-cols-3 gap-2 lg:w-[440px]">
          <ActionButton
            label="FOLD"
            hotkey="F"
            tone="fold"
            disabled={disabled}
            recommended={recommended === 'fold'}
            onClick={doFold}
          />
          <ActionButton
            label={legal?.canCheck ? 'CHECK' : 'CALL'}
            sub={legal && !legal.canCheck ? fmt(legal.toCall) : undefined}
            hotkey="C"
            tone="call"
            disabled={disabled}
            recommended={recommended === 'passive'}
            onClick={doCall}
          />
          <ActionButton
            label={raiseLabel}
            sub={legal?.canRaise ? fmt(amount) : undefined}
            hotkey="R"
            tone={isAllIn ? 'allin' : 'raise'}
            disabled={disabled || !legal?.canRaise}
            recommended={recommended === 'aggressive'}
            onClick={doRaise}
          />
        </div>
      </div>
      {disabled && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-night-950/55">
          <span className="rounded-pixel bg-night-900/90 px-3 py-1.5 font-display text-sm text-haze-200 ring-1 ring-haze-400/25">
            {thinkingName ? (
              <>
                <span className="text-neon-cyan">{thinkingName}</span> is thinking<span className="animate-blink">…</span>
              </>
            ) : game?.phase === 'handComplete' ? (
              'Hand complete'
            ) : hero?.folded ? (
              'You folded — watch how it plays out'
            ) : (
              'Dealing…'
            )}
          </span>
        </div>
      )}
    </div>
  )
}

const TONES = {
  fold: 'bg-night-700 text-haze-200 ring-haze-400/40 hover:bg-night-600',
  call: 'bg-neon-teal text-night-950 ring-neon-cyan hover:brightness-110',
  raise: 'bg-neon-pink text-night-950 ring-neon-pink hover:brightness-110',
  allin: 'bg-neon-amber text-night-950 ring-neon-amber hover:brightness-110',
}

function ActionButton({
  label,
  sub,
  hotkey,
  tone,
  disabled,
  recommended,
  onClick,
}: {
  label: string
  sub?: string
  hotkey: string
  tone: keyof typeof TONES
  disabled: boolean
  recommended: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={SPRING.button}
      disabled={disabled}
      onClick={onClick}
      aria-keyshortcuts={hotkey}
      className={clsx(
        'pixel-corners relative flex h-14 flex-col items-center justify-center font-display font-bold ring-2 ring-inset transition',
        TONES[tone],
        disabled && 'opacity-30',
        recommended && !disabled && 'outline-2 outline-offset-2 outline-haze-100',
      )}
    >
      {recommended && !disabled && (
        <span className="absolute right-1.5 top-1 rounded-[2px] bg-night-950/85 px-1 text-[9px] font-semibold tracking-wider text-neon-lime">COACH</span>
      )}
      <span className="text-base leading-none tracking-wide sm:text-lg">{label}</span>
      {sub && <span className="num mt-0.5 text-sm leading-none opacity-80">{sub}</span>}
      <span className="absolute bottom-1 left-1.5 hidden text-[9px] font-medium opacity-60 sm:block">{hotkey}</span>
    </motion.button>
  )
}
