import clsx from 'clsx'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { GRADE_LABEL } from '../../coach/grade'
import { useGame } from '../../store/gameStore'
import { listItem, listStagger } from '../motion'
import { STREET_LABEL } from '../format'
import { GRADE_CLS } from '../grades'
import { CardChip } from './CoachPanel'
import { Modal, NeonButton } from './Modal'

/** End-of-hand summary: result, showdown hands, graded decisions and score. */
export function HandSummary() {
  const open = useGame((s) => s.summaryOpen)
  const record = useGame((s) => s.lastHand)
  const game = useGame((s) => s.game)
  const heroIndex = useGame((s) => s.heroIndex)
  const deal = useGame((s) => s.dealNextHand)
  const startReplay = useGame((s) => s.startReplay)
  const rebuy = useGame((s) => s.rebuy)
  const leave = useGame((s) => s.leaveGame)
  const setOpen = useGame((s) => s.setSummaryOpen)

  const busted = !!game && game.players[heroIndex].stack <= 0
  useEffect(() => {
    if (!open || busted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        deal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busted, deal])

  if (!record) return null
  const final = record.final
  const outcome = final.outcome
  const heroId = final.players[heroIndex].id
  const name = (id: string) => (id === heroId ? 'You' : (final.players.find((p) => p.id === id)?.name ?? id))
  const winners = outcome ? [...new Set(outcome.pots.flatMap((p) => p.winners))] : []
  const heroWon = winners.includes(heroId)
  const split = (outcome?.pots[0]?.winners.length ?? 0) > 1
  const handName = outcome?.pots[0]?.handName

  const title = busted
    ? "You're out of chips"
    : heroWon && !split
      ? `You win ${(outcome?.winnings[heroId] ?? 0).toLocaleString()} chips!`
      : split && heroWon
        ? 'Split pot'
        : `${name(winners[0] ?? '')} ${winners.length > 1 ? 'split the pot' : 'takes it'}`

  const decisions = record.decisions
  const score = decisions.length ? decisions.reduce((t, d) => t + d.points, 0) / decisions.length : null
  const contenders = outcome && !outcome.uncontested ? final.players.filter((p) => !p.folded && !p.out) : []

  return (
    <Modal open={open} onClose={busted ? undefined : () => setOpen(false)} title={<span>{title}</span>}>
      <motion.div variants={listStagger} initial="hidden" animate="show" className="flex flex-col gap-4">
        <motion.div variants={listItem} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-haze-300">
          <span className="font-display text-haze-200">
            Hand <span className="num">#{record.handNumber}</span>
          </span>
          {outcome?.uncontested ? <span>Everyone else folded.</span> : handName && <span>Winning hand: <b className="text-neon-amber">{handName}</b></span>}
          <span className={clsx('num', record.heroNet > 0 ? 'text-neon-lime' : record.heroNet < 0 ? 'text-neon-red' : 'text-haze-300')}>
            {record.heroNet > 0 ? '+' : ''}
            {record.heroNet.toLocaleString()} chips
          </span>
        </motion.div>

        {contenders.length > 0 && (
          <motion.div variants={listItem} className="rounded-panel bg-night-900/70 p-3 ring-1 ring-haze-400/15">
            <div className="mb-2 font-display text-[10px] uppercase tracking-[0.2em] text-haze-400">Showdown</div>
            <ul className="space-y-1.5">
              {contenders.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={clsx('w-16 truncate font-display', winners.includes(p.id) ? 'text-neon-amber' : 'text-haze-200')}>{name(p.id)}</span>
                  <span className="flex gap-1">
                    {p.hole.map((c) => (
                      <CardChip key={c} card={c} />
                    ))}
                  </span>
                  <span className="ml-auto truncate text-xs text-haze-300">{outcome?.hands[p.id]?.name}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        <motion.div variants={listItem}>
          <div className="mb-2 flex items-end justify-between">
            <div className="font-display text-[10px] uppercase tracking-[0.2em] text-haze-400">Your key decisions</div>
            {score !== null && (
              <div className="font-display text-sm text-haze-200">
                Hand score <span className="num text-xl text-neon-lime text-glow-cyan">{score.toFixed(1)}</span>
                <span className="text-haze-400">/10</span>
              </div>
            )}
          </div>
          {decisions.length === 0 ? (
            <p className="rounded-panel bg-night-900/60 p-3 text-sm text-haze-300">No decisions this hand — you didn&apos;t have to act.</p>
          ) : (
            <ul className="space-y-2">
              {decisions.map((d, i) => (
                <li key={i} className="rounded-panel bg-night-900/70 p-2.5 ring-1 ring-haze-400/10">
                  <div className="flex items-center gap-2">
                    <span className="w-14 font-display text-[11px] uppercase tracking-wider text-haze-400">{STREET_LABEL[d.street as keyof typeof STREET_LABEL] ?? d.street}</span>
                    <span className={clsx('rounded-pixel px-1.5 py-0.5 font-display text-[10px] font-bold uppercase', GRADE_CLS[d.grade])}>{GRADE_LABEL[d.grade]}</span>
                    <span className="min-w-0 truncate text-sm text-haze-100">{d.title}</span>
                  </div>
                  {d.grade !== 'great' && <p className="mt-1.5 text-xs leading-snug text-haze-300">{d.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <motion.div variants={listItem} className="flex flex-wrap gap-2 pt-1">
          {busted ? (
            <>
              <NeonButton onClick={rebuy} autoFocus>
                REBUY &amp; CONTINUE
              </NeonButton>
              <NeonButton tone="ghost" onClick={leave}>
                LOBBY
              </NeonButton>
            </>
          ) : (
            <>
              <NeonButton onClick={deal} autoFocus className="flex-1 sm:flex-none">
                DEAL NEXT HAND <span className="ml-1 text-xs opacity-60">↵</span>
              </NeonButton>
              <NeonButton tone="ghost" onClick={startReplay}>
                REPLAY HAND
              </NeonButton>
            </>
          )}
        </motion.div>
      </motion.div>
    </Modal>
  )
}
