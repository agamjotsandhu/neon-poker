import { motion, useReducedMotion } from 'motion/react'
import { parseCards } from '../../engine/cards'
import { useGame } from '../../store/gameStore'
import { Card } from '../components/Card'
import { NeonButton } from '../components/Modal'
import { SettingsDialog } from '../components/SettingsDialog'
import { fanIn, floatLoop, listItem, listStagger } from '../motion'
import { Logo } from './Logo'

const FAN = parseCards('AsKsQsJsTs')

export function LandingScreen() {
  const start = useGame((s) => s.startGame)
  const setScreen = useGame((s) => s.setScreen)
  const setSettingsOpen = useGame((s) => s.setSettingsOpen)
  const stats = useGame((s) => s.stats)
  const reduce = useReducedMotion()
  const acc = stats.decisions ? Math.round(((stats.great + stats.good) / stats.decisions) * 100) : null

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_55%,var(--color-night-950)_0%,transparent_100%)] opacity-80" aria-hidden />
      <motion.div variants={listStagger} initial="hidden" animate="show" className="relative flex w-full max-w-3xl flex-col items-center text-center">
        {/* fanned royal flush */}
        <motion.div variants={listItem} className="relative mb-4 h-[120px] w-[260px] sm:mb-6 sm:h-[150px] sm:w-[320px]" aria-hidden>
          {FAN.map((c, i) => {
            const offset = i - 2
            return (
              <motion.div
                key={c}
                className="absolute bottom-0"
                style={{ left: `calc(50% + ${offset * 22 - 32}px)`, originX: 0.5, originY: 1.4 }}
                initial={{ rotate: 0, y: 40, opacity: 0 }}
                animate={{ rotate: offset * 11, y: Math.abs(offset) * 6, opacity: 1 }}
                transition={fanIn(i)}
              >
                <motion.div {...(reduce ? {} : floatLoop(i))}>
                  <Card card={c} faceUp width={64} flipDelay={0.6 + i * 0.09} highlight={i === 2 ? 'win' : null} />
                </motion.div>
              </motion.div>
            )
          })}
        </motion.div>

        <motion.div variants={listItem}>
          <Logo size="xl" />
        </motion.div>

        <motion.p variants={listItem} className="mt-5 max-w-xl text-balance text-base leading-relaxed text-haze-200 sm:text-lg">
          Learn No-Limit Texas Hold&apos;em at a rain-soaked neon table. Five bots with real personalities, and a coach
          that explains the odds and the right play on every decision.
        </motion.p>

        <motion.div variants={listItem} className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <NeonButton size="lg" onClick={start} autoFocus className="sm:min-w-[200px]">
            ▶ PLAY
          </NeonButton>
          <NeonButton size="lg" tone="ghost" onClick={() => setScreen('howto')}>
            HOW TO PLAY
          </NeonButton>
          <NeonButton size="lg" tone="ghost" onClick={() => setSettingsOpen(true)}>
            SETTINGS
          </NeonButton>
        </motion.div>

        <motion.div variants={listItem} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 font-display text-xs uppercase tracking-[0.18em] text-haze-400">
          <span>
            <b className="num text-haze-200">{stats.handsPlayed}</b> hands played
          </span>
          <span>
            <b className="num text-haze-200">{stats.decisions}</b> decisions graded
          </span>
          <span>
            accuracy <b className="num text-neon-lime">{acc === null ? '—' : `${acc}%`}</b>
          </span>
        </motion.div>
      </motion.div>
      <SettingsDialog />
    </div>
  )
}
