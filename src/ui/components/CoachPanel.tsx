import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { potOdds } from '../../coach/advice'
import { displayRange } from '../../coach/displayRange'
import { GRADE_LABEL, type Feedback } from '../../coach/grade'
import { GRADE_CLS } from '../grades'
import { handClass } from '../../coach/ranges'
import { rankChar, suitChar, type Card } from '../../engine/cards'
import { useGame, type CoachState, type Mode } from '../../store/gameStore'
import { DUR, EASE, listItem, listStagger, panelVariants, sheetVariants, SPRING } from '../motion'
import { PixelSuit } from './PixelSuit'
import { RangeGrid } from './RangeGrid'

const pct = (x: number) => `${Math.round(x * 100)}%`

/* ------------------------------------------------------------------ pieces */

export function ModeToggle({ mode, onChange, small }: { mode: Mode; onChange: (m: Mode) => void; small?: boolean }) {
  return (
    <div className={clsx('relative flex rounded-pixel bg-night-900 p-0.5 ring-1 ring-haze-400/25', small ? 'text-[10px]' : 'text-xs')} role="radiogroup" aria-label="Coach mode">
      {(['coach', 'quiz'] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={clsx('relative z-10 px-2.5 py-1 font-display uppercase tracking-wider transition-colors', mode === m ? 'text-night-950' : 'text-haze-300 hover:text-haze-100')}
        >
          {mode === m && <motion.span layoutId={`mode-pill-${small ? 's' : 'l'}`} className="absolute inset-0 -z-10 rounded-[2px] bg-neon-lime" transition={SPRING.button} />}
          {m === 'coach' ? 'Coach' : 'Quiz'}
        </button>
      ))}
    </div>
  )
}

const TONE_CLS = {
  great: 'bg-neon-lime text-night-950',
  good: 'bg-neon-cyan text-night-950',
  ok: 'bg-neon-amber text-night-950',
  weak: 'bg-night-600 text-haze-200',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.2em] text-haze-400">{children}</div>
}

export function CardChip({ card }: { card: Card }) {
  const s = suitChar(card)
  const red = s === 'h' || s === 'd'
  return (
    <span className="num inline-flex items-center gap-0.5 rounded-[3px] bg-card-cream px-1 py-px text-[11px] leading-tight text-card-ink">
      <span className={red ? 'text-suit-red' : ''}>{rankChar(card) === 'T' ? '10' : rankChar(card)}</span>
      <PixelSuit suit={s} size={9} />
    </span>
  )
}

function Meter({ value, marker, label }: { value: number; marker?: number; label?: string }) {
  return (
    <div className="relative h-3 overflow-hidden rounded-[2px] bg-night-950 ring-1 ring-haze-400/20" aria-label={label}>
      <motion.div
        className="h-full bg-gradient-to-r from-neon-magenta to-neon-pink"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, value * 100)}%` }}
        transition={{ duration: DUR.number, ease: EASE.out }}
      />
      {marker !== undefined && marker > 0 && (
        <div className="absolute inset-y-0 w-0.5 bg-neon-cyan shadow-neon-cyan" style={{ left: `${marker * 100}%` }} />
      )}
    </div>
  )
}

export function FeedbackCard({ fb, compact }: { fb: Feedback; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DUR.panel, ease: EASE.out }}
      className="rounded-panel bg-night-800/90 p-3 ring-1 ring-haze-400/20"
    >
      <div className="flex items-center gap-2">
        <span className={clsx('rounded-pixel px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider', GRADE_CLS[fb.grade])}>{GRADE_LABEL[fb.grade]}</span>
        <span className="font-display text-sm text-haze-100">{fb.title}</span>
        <span className="num ml-auto text-xs text-haze-400">+{fb.points}</span>
      </div>
      {!compact && <p className="mt-2 text-sm leading-snug text-haze-200">{fb.message}</p>}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ main body */

function Analysis({ coach, mode }: { coach: CoachState; mode: Mode }) {
  const { situation: s, hand, outs, equity, advice } = coach
  const quiz = mode === 'quiz'
  const pre = s.street === 'preflop'
  const odds = potOdds(s.toCall, s.pot)
  const range = pre ? displayRange(s) : null

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="flex flex-col gap-3">
      <motion.section variants={listItem} className="rounded-panel bg-night-800/80 p-3 ring-1 ring-haze-400/15">
        <SectionLabel>Your hand</SectionLabel>
        <p className="text-[15px] font-medium leading-snug text-haze-100">{hand.sentence}.</p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className={clsx('rounded-pixel px-1.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider', TONE_CLS[hand.tierTone])}>{hand.tier}</span>
          <span className="text-xs text-haze-300">{hand.percentileLabel}</span>
        </div>
        <div className="mt-2">
          <Meter value={hand.percentile} label="Hand strength percentile" />
        </div>
      </motion.section>

      {quiz ? (
        <motion.section variants={listItem} className="rounded-panel border border-dashed border-neon-lime/40 bg-night-900/70 p-3">
          <div className="font-display text-sm text-neon-lime">QUIZ MODE</div>
          <p className="mt-1 text-sm leading-snug text-haze-200">
            Make your decision first. I&apos;ll grade it and explain the reasoning right after you act.
          </p>
          {s.toCall > 0 && (
            <p className="mt-2 text-xs text-haze-300">
              Hint: it costs <b className="text-haze-100">{s.toCall.toLocaleString()}</b> to call into a pot of{' '}
              <b className="text-haze-100">{s.pot.toLocaleString()}</b>.
            </p>
          )}
        </motion.section>
      ) : (
        <>
          <motion.section variants={listItem} className="relative overflow-hidden rounded-panel bg-gradient-to-br from-night-700 to-night-800 p-3 shadow-neon-pink">
            <SectionLabel>Coach recommends</SectionLabel>
            {advice ? (
              <>
                <div className="font-display text-2xl font-bold leading-tight text-haze-100 text-glow-pink">{advice.headline}</div>
                <p className="mt-1.5 text-sm leading-snug text-haze-200">{advice.why}</p>
                {advice.close && <p className="mt-1.5 text-xs text-neon-amber">Close spot — the alternative is reasonable too.</p>}
              </>
            ) : (
              <div className="py-1 text-sm text-haze-300">Crunching the numbers…</div>
            )}
          </motion.section>

          {pre && range && (
            <motion.section variants={listItem} className="rounded-panel bg-night-800/80 p-3 ring-1 ring-haze-400/15">
              <SectionLabel>{range.title}</SectionLabel>
              <RangeGrid raise={range.raise} call={range.call} hero={handClass(s.hero)} />
              <p className="mt-2 text-xs leading-snug text-haze-300">{range.caption}</p>
            </motion.section>
          )}

          {!pre && (
            <motion.section variants={listItem} className="rounded-panel bg-night-800/80 p-3 ring-1 ring-haze-400/15">
              <SectionLabel>Equity vs. estimated ranges</SectionLabel>
              {equity ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="num text-3xl leading-none text-neon-pink text-glow-pink">{pct(equity.equity)}</div>
                      <div className="mt-1 text-[11px] text-haze-400">{equity.iterations.toLocaleString()} simulated run-outs</div>
                    </div>
                    {s.toCall > 0 && (
                      <div className="text-right">
                        <div className="num text-xl leading-none text-neon-cyan">{pct(odds.required)}</div>
                        <div className="mt-1 text-[11px] text-haze-400">needed · pot odds {odds.ratio}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <Meter value={equity.equity} marker={s.toCall > 0 ? odds.required : undefined} label="Equity" />
                  </div>
                  {s.toCall > 0 && (
                    <p className="mt-2 text-xs leading-snug text-haze-300">
                      Calling {s.toCall.toLocaleString()} to win {s.pot.toLocaleString()} needs {s.toCall.toLocaleString()} ÷ {(s.pot + s.toCall).toLocaleString()} = <b className="text-haze-100">{pct(odds.required)}</b> equity to break even.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 py-2 text-sm text-haze-300">
                  <span className="h-2 w-2 animate-pulse-glow bg-neon-pink" />
                  Simulating thousands of run-outs…
                </div>
              )}
              <ul className="mt-2 space-y-0.5">
                {coach.rangeLabels.map((l) => (
                  <li key={l} className="text-[11px] leading-snug text-haze-400">
                    · {l}
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {!pre && outs && s.street !== 'river' && (outs.outs.length > 0 || outs.draws.length > 0) && (
            <motion.section variants={listItem} className="rounded-panel bg-night-800/80 p-3 ring-1 ring-haze-400/15">
              <SectionLabel>Draws &amp; outs</SectionLabel>
              {outs.draws.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {outs.draws.map((d) => (
                    <span key={d.kind} className="rounded-pixel bg-neon-teal/20 px-1.5 py-0.5 font-display text-[11px] text-neon-cyan ring-1 ring-neon-cyan/30">
                      {d.label}
                    </span>
                  ))}
                </div>
              )}
              {outs.groups.map((g) => (
                <div key={g.makes} className="mb-1.5">
                  <div className="text-xs text-haze-300">
                    <b className="text-haze-100">{g.count}</b> {g.count === 1 ? 'out' : 'outs'} to {g.makes.toLowerCase()}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {outs.outs
                      .filter((o) => o.makes === g.makes)
                      .map((o) => (
                        <CardChip key={o.card} card={o.card} />
                      ))}
                  </div>
                </div>
              ))}
              {outs.outs.length > 0 && (
                <p className="mt-2 rounded-pixel bg-night-900/80 p-2 text-xs leading-snug text-haze-200">
                  <b className="font-display text-neon-amber">Rule of 2 &amp; 4:</b>{' '}
                  {s.street === 'flop' ? (
                    <>
                      {outs.outs.length} outs × 4 ≈ <b>{outs.ruleOf4}%</b> to hit by the river (exact {pct(outs.byRiver ?? 0)}), or ×2 ≈ <b>{outs.ruleOf2}%</b> on the turn alone.
                    </>
                  ) : (
                    <>
                      {outs.outs.length} outs × 2 ≈ <b>{outs.ruleOf2}%</b> to hit on the river (exact {pct(outs.nextCard)}).
                    </>
                  )}
                </p>
              )}
            </motion.section>
          )}

        </>
      )}
    </motion.div>
  )
}

function SessionStats() {
  const stats = useGame((s) => s.stats)
  const acc = stats.decisions ? (stats.great + stats.good) / stats.decisions : 0
  const score = stats.decisions ? stats.points / stats.decisions : 0
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {[
        ['Hands', stats.handsPlayed.toLocaleString()],
        ['Accuracy', stats.decisions ? pct(acc) : '—'],
        ['Avg score', stats.decisions ? score.toFixed(1) : '—'],
      ].map(([k, v]) => (
        <div key={k} className="rounded-pixel bg-night-900/70 py-1.5 ring-1 ring-haze-400/10">
          <div className="num text-base leading-none text-haze-100">{v}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-haze-400">{k}</div>
        </div>
      ))}
    </div>
  )
}

export function CoachBody() {
  const coach = useGame((s) => s.coach)
  const feedback = useGame((s) => s.feedback)
  const mode = useGame((s) => s.settings.mode)
  const heroTurn = useGame((s) => s.heroTurn)
  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence mode="wait">
        {feedback && !heroTurn && (
          <motion.div key={`fb-${feedback.street}-${feedback.took}-${feedback.points}`} exit={{ opacity: 0 }}>
            <SectionLabel>Last decision</SectionLabel>
            <FeedbackCard fb={feedback} />
          </motion.div>
        )}
      </AnimatePresence>
      {heroTurn && coach ? (
        <Analysis key={coach.token} coach={coach} mode={mode} />
      ) : (
        !feedback && (
          <div className="rounded-panel border border-dashed border-haze-400/25 p-4 text-sm leading-snug text-haze-300">
            <div className="mb-1 font-display text-haze-200">Watching the table…</div>
            When it&apos;s your turn I&apos;ll break down your hand, the odds and the best play.
          </div>
        )
      )}
    </div>
  )
}

function Header() {
  const mode = useGame((s) => s.settings.mode)
  const setMode = useGame((s) => s.setMode)
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="font-display text-lg font-bold leading-none tracking-wider text-neon-lime">COACH</div>
        <div className="mt-1 text-[10px] uppercase tracking-wider text-haze-400">Heuristic advice · not solver-optimal</div>
      </div>
      <ModeToggle mode={mode} onChange={setMode} />
    </div>
  )
}

/** Desktop side panel. */
export function CoachPanel() {
  const heroTurn = useGame((s) => s.heroTurn)
  return (
    <motion.aside
      variants={panelVariants}
      initial="hidden"
      animate="show"
      className={clsx(
        'glass relative z-20 m-3 ml-0 flex w-[370px] shrink-0 flex-col overflow-hidden rounded-panel shadow-panel ring-1 transition-shadow duration-500 xl:w-[390px]',
        heroTurn ? 'ring-neon-lime/60' : 'ring-haze-400/15',
      )}
      aria-label="Coach panel"
    >
      <div className="border-b border-haze-400/15 p-4">
        <Header />
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <CoachBody />
      </div>
      <div className="border-t border-haze-400/15 p-3">
        <SessionStats />
      </div>
    </motion.aside>
  )
}

/** Mobile bottom sheet with a compact peek strip. */
export function CoachSheet() {
  const open = useGame((s) => s.coachSheetOpen)
  const setOpen = useGame((s) => s.setCoachSheetOpen)
  const coach = useGame((s) => s.coach)
  const heroTurn = useGame((s) => s.heroTurn)
  const feedback = useGame((s) => s.feedback)
  const mode = useGame((s) => s.settings.mode)

  const peek = heroTurn && coach
    ? mode === 'quiz'
      ? 'Quiz: make your move — graded after'
      : coach.advice
        ? `Coach: ${coach.advice.headline}`
        : 'Coach is thinking…'
    : feedback
      ? `${GRADE_LABEL[feedback.grade]} · ${feedback.title}`
      : null

  return (
    <>
      <AnimatePresence>
        {peek && !open && (
          <motion.button
            key="peek"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: DUR.fade, ease: EASE.out }}
            onClick={() => setOpen(true)}
            className={clsx(
              'glass absolute inset-x-3 bottom-2 z-30 flex items-center gap-2 rounded-panel px-3 py-2 text-left shadow-panel ring-1',
              heroTurn ? 'ring-neon-lime/60' : 'ring-haze-400/25',
            )}
          >
            {feedback && !heroTurn && <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-[2px]', GRADE_CLS[feedback.grade])} />}
            <span className="min-w-0 flex-1 truncate font-display text-sm text-haze-100">{peek}</span>
            <span className="shrink-0 font-display text-[11px] text-neon-lime">WHY ▲</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              className="fixed inset-0 z-40 bg-night-950/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="sheet"
              variants={sheetVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="glass fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col rounded-t-panel shadow-panel ring-1 ring-haze-400/20"
              role="dialog"
              aria-label="Coach"
            >
              <button onClick={() => setOpen(false)} className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-haze-400/40" aria-label="Close coach" />
              <div className="border-b border-haze-400/15 px-4 pb-3 pt-2">
                <Header />
              </div>
              <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
                <CoachBody />
                <div className="mt-4">
                  <SessionStats />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
