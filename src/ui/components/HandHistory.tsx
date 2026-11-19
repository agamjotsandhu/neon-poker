import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { GRADE_LABEL } from '../../coach/grade'
import { useGame } from '../../store/gameStore'
import { DUR, EASE } from '../motion'
import { describeEvent, prettyCards } from '../format'
import { GRADE_CLS } from '../grades'
import { NeonButton } from './Modal'
import { PixelIcon } from './PixelIcon'
import { Table } from './Table'

/** Slide-in drawer with the last hand's log and a replay button. */
export function HandHistory() {
  const open = useGame((s) => s.historyOpen)
  const setOpen = useGame((s) => s.setHistoryOpen)
  const record = useGame((s) => s.lastHand)
  const startReplay = useGame((s) => s.startReplay)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[55] bg-night-950/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: DUR.panel, ease: EASE.out }}
            className="glass fixed inset-y-0 left-0 z-[56] flex w-[min(380px,92vw)] flex-col shadow-panel ring-1 ring-haze-400/20"
            aria-label="Hand history"
          >
            <div className="flex items-center justify-between border-b border-haze-400/15 p-4">
              <div className="font-display text-lg font-bold tracking-wider text-neon-cyan">HAND HISTORY</div>
              <button onClick={() => setOpen(false)} className="rounded-pixel p-1.5 text-haze-300 hover:bg-night-700" aria-label="Close history">
                <PixelIcon name="close" size={14} />
              </button>
            </div>
            {!record ? (
              <p className="p-4 text-sm text-haze-300">Finish a hand to see its history and replay it here.</p>
            ) : (
              <>
                <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
                  <div className="mb-3 rounded-panel bg-night-900/70 p-3 text-sm ring-1 ring-haze-400/10">
                    <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.2em] text-haze-400">Hole cards (revealed)</div>
                    <ul className="space-y-0.5">
                      {record.final.players
                        .filter((p) => p.hole.length)
                        .map((p) => (
                          <li key={p.id} className={clsx('flex justify-between', p.folded && 'text-haze-400')}>
                            <span className="font-display">{p.isHuman ? 'You' : p.name}</span>
                            <span className="num tracking-wider">{prettyCards(p.hole)}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                  <ol className="space-y-1">
                    {record.final.events.map((e, i) => (
                      <li
                        key={i}
                        className={clsx(
                          'text-sm leading-snug',
                          e.kind === 'street' && 'mt-2 font-display text-neon-pink',
                          e.kind === 'win' && 'font-display text-neon-amber',
                          e.kind === 'start' && 'font-display text-haze-200',
                          (e.kind === 'action' || e.kind === 'blind' || e.kind === 'refund') && 'text-haze-300',
                        )}
                      >
                        {describeEvent(e, record.final)}
                      </li>
                    ))}
                  </ol>
                  {record.decisions.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="font-display text-[10px] uppercase tracking-[0.2em] text-haze-400">Your grades</div>
                      {record.decisions.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={clsx('rounded-pixel px-1.5 font-display text-[10px] font-bold uppercase', GRADE_CLS[d.grade])}>{GRADE_LABEL[d.grade]}</span>
                          <span className="truncate text-haze-200">{d.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-haze-400/15 p-4">
                  <NeonButton tone="cyan" onClick={startReplay} className="w-full">
                    ▶ REPLAY LAST HAND
                  </NeonButton>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/** Full-screen replay of the last hand, stepping through engine snapshots with all cards face up. */
export function ReplayOverlay() {
  const replay = useGame((s) => s.replay)
  const seatMeta = useGame((s) => s.seatMeta)
  const heroIndex = useGame((s) => s.heroIndex)
  const step = useGame((s) => s.stepReplay)
  const toggle = useGame((s) => s.toggleReplayPlay)
  const close = useGame((s) => s.closeReplay)

  useEffect(() => {
    if (!replay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [replay, close, step, toggle])

  return (
    <AnimatePresence>
      {replay && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col bg-night-950/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fade }}
          role="dialog"
          aria-label="Hand replay"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="font-display text-lg font-bold tracking-wider text-neon-cyan">
              REPLAY <span className="text-haze-300">· HAND #{replay.record.handNumber}</span>
            </div>
            <button onClick={close} className="rounded-pixel p-2 text-haze-300 hover:bg-night-700" aria-label="Close replay">
              <PixelIcon name="close" size={16} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Table
              state={replay.record.snapshots[replay.index]}
              heroIndex={heroIndex}
              seatMeta={seatMeta}
              handKey={`replay-${replay.record.handNumber}`}
              replay
            />
          </div>
          <ReplayCaption />
          <div className="flex items-center justify-center gap-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
            <button onClick={() => step(-1)} className="rounded-pixel bg-night-800 p-3 text-haze-200 ring-1 ring-haze-400/30 hover:bg-night-700" aria-label="Previous step">
              <PixelIcon name="prev" />
            </button>
            <button onClick={toggle} className="rounded-pixel bg-neon-pink p-3 text-night-950 ring-1 ring-neon-pink" aria-label={replay.playing ? 'Pause' : 'Play'}>
              <PixelIcon name={replay.playing ? 'pause' : 'play'} />
            </button>
            <button onClick={() => step(1)} className="rounded-pixel bg-night-800 p-3 text-haze-200 ring-1 ring-haze-400/30 hover:bg-night-700" aria-label="Next step">
              <PixelIcon name="next" />
            </button>
            <span className="num ml-2 text-sm text-haze-300">
              {replay.index + 1}/{replay.record.snapshots.length}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ReplayCaption() {
  const replay = useGame((s) => s.replay)
  if (!replay) return null
  const snap = replay.record.snapshots[replay.index]
  const prev = replay.index > 0 ? replay.record.snapshots[replay.index - 1] : null
  const newEvents = snap.events.slice(prev ? prev.events.length : 0)
  const text = newEvents.map((e) => describeEvent(e, snap)).filter(Boolean)
  return (
    <div className="mx-auto min-h-[44px] max-w-xl px-4 text-center">
      <AnimatePresence mode="wait">
        <motion.p
          key={replay.index}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fade }}
          className="font-display text-base text-haze-100"
        >
          {text.length ? text.slice(-3).join(' · ') : 'Dealing'}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
