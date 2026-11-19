import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import type { Card as CardT } from '../../engine/cards'
import { bettingIsOver, positionLabels, totalPot } from '../../engine/game'
import type { GameState } from '../../engine/types'
import type { SeatMeta } from '../../store/gameStore'
import { computeGeometry, SEAT_MAP, type Geometry, type Pt } from '../geometry'
import { useElementSize } from '../hooks/useElementSize'
import { DUR, EASE, PACE, SPRING, dealDelay, hoverLift, riffle } from '../motion'
import { AnimatedNumber } from './AnimatedNumber'
import { Card, CARD_RATIO } from './Card'
import { CardBack } from './CardBack'
import { ChipStack } from './ChipStack'
import { Pot } from './Pot'
import { Seat } from './Seat'

interface Props {
  state: GameState
  heroIndex: number
  seatMeta: Record<string, SeatMeta>
  thinkingId?: string | null
  heroTurn?: boolean
  handKey: number | string
  /** Replay mode: show every hand face up, no deal choreography. */
  replay?: boolean
}

const Abs = ({ at, children, className, z = 0 }: { at: Pt; children: ReactNode; className?: string; z?: number }) => (
  <div className={clsx('absolute -translate-x-1/2 -translate-y-1/2', className)} style={{ left: at.x, top: at.y, zIndex: z }}>
    {children}
  </div>
)

export function Table(props: Props) {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="absolute inset-0">
      {size.w > 0 && size.h > 0 && <TableInner {...props} g={computeGeometry(size.w, size.h)} />}
    </div>
  )
}

function TableInner({ state, heroIndex, seatMeta, thinkingId, heroTurn, handKey, replay, g }: Props & { g: Geometry }) {
  const n = state.players.length
  const seatOf = (i: number) => SEAT_MAP[n][(i - heroIndex + n) % n]
  const labels = positionLabels(state)
  const outcome = state.outcome
  const live = !replay
  const bb = state.bigBlind

  const contenders = state.players.filter((p) => !p.out && !p.folded)
  const allInRunout = contenders.length >= 2 && bettingIsOver(state) && state.phase !== 'betting'
  const showdown = !!outcome && !outcome.uncontested
  const reveal = replay || showdown || allInRunout

  // Winning cards
  const winners = new Set<string>()
  const winCards = new Set<CardT>()
  if (outcome) {
    for (const pot of outcome.pots) for (const id of pot.winners) winners.add(id)
    if (showdown) for (const id of winners) outcome.hands[id]?.best.forEach((c) => winCards.add(c))
  }
  const awardDelay = outcome ? (outcome.uncontested ? DUR.collect + 0.1 : PACE.showdownReveal / 1000) : 0

  const deckSeat = state.dealer >= 0 ? seatOf(state.dealer) : 3
  const deckPos: Pt = {
    x: g.seats[deckSeat].x + (g.center.x - g.seats[deckSeat].x) * 0.42,
    y: g.seats[deckSeat].y + (g.center.y - g.seats[deckSeat].y) * 0.42,
  }
  const dealIndex = (pi: number, round: number) => {
    const j = state.dealOrder.indexOf(pi)
    return round * state.dealOrder.length + Math.max(0, j)
  }

  const { table: t } = g
  const radius = Math.min(t.w, t.h) * (g.portrait ? 0.42 : 0.36)
  const boardCardH = g.cardW * CARD_RATIO

  return (
    <div
      className="absolute inset-0 select-none"
      data-testid={replay ? 'replay-table' : 'table'}
      data-street={state.street}
      data-phase={state.phase}
      data-showdown={showdown ? '1' : '0'}
      data-hero-turn={heroTurn ? '1' : '0'}
    >
      {/* ---------- table surface ---------- */}
      <div
        className="absolute bg-rail shadow-neon-pink"
        style={{ left: t.x - 12, top: t.y - 12, width: t.w + 24, height: t.h + 24, borderRadius: radius + 12 }}
      />
      <div
        className="glass absolute overflow-hidden"
        style={{ left: t.x, top: t.y, width: t.w, height: t.h, borderRadius: radius }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,var(--color-felt-edge)_0%,var(--color-felt)_55%,var(--color-night-950)_120%)] opacity-80" />
        <div className="scanlines absolute inset-0 opacity-50" />
        <div
          className="absolute border border-neon-pink/45"
          style={{ inset: 10, borderRadius: Math.max(0, radius - 10) }}
        />
        <div
          className="absolute border border-dashed border-neon-cyan/15"
          style={{ inset: 22, borderRadius: Math.max(0, radius - 22) }}
        />
        {!g.portrait && g.heroCards[0].y - g.heroCardW * CARD_RATIO * 0.5 - (g.board[0].y + boardCardH * 0.5) > 56 && (
          <div
            className="absolute left-1/2 -translate-x-1/2 text-center font-display text-lg font-bold tracking-[0.35em] text-neon-pink/15"
            style={{ top: g.board[0].y - t.y + boardCardH * 0.5 + 16 }}
          >
            NEON HOLD&apos;EM
          </div>
        )}
      </div>

      {/* ---------- empty board slots ---------- */}
      {g.board.map((p, i) => (
        <Abs key={i} at={p}>
          <div
            className="rounded-card border-2 border-neon-pink/40 bg-night-950/25 shadow-[inset_0_0_14px_var(--color-neon-magenta)]"
            style={{ width: g.cardW, height: boardCardH, opacity: 0.55 }}
          />
        </Abs>
      ))}

      {/* ---------- pot ---------- */}
      <Abs at={g.potLabel} z={5}>
        <div className="font-display text-xl font-bold leading-none text-haze-100 text-glow-pink sm:text-2xl">
          {totalPot(state) > 0 ? (
            <>
              <span className="mr-2 text-xs tracking-widest text-haze-300">POT</span>
              <span className="num">
                <AnimatedNumber value={totalPot(state)} />
              </span>
            </>
          ) : null}
        </div>
      </Abs>
      <Pot key={`pot-${handKey}`} amount={state.pot} bb={bb} at={g.pot} />

      {/* ---------- deck + shuffle ---------- */}
      {live && state.phase !== 'idle' && (
        <motion.div
          className="absolute z-[6]"
          initial={false}
          animate={{ x: deckPos.x - g.cardW * 0.35, y: deckPos.y - g.cardW * 0.49, opacity: state.phase === 'handComplete' ? 0 : 1 }}
          transition={{ ...SPRING.soft, opacity: { duration: DUR.fade } }}
          style={{ left: 0, top: 0 }}
        >
          <div key={handKey} className="relative" style={{ width: g.cardW * 0.7, height: g.cardW * 0.98 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className="absolute left-0 top-0"
                style={{ marginTop: -i * 1.2, marginLeft: i * 0.4 }}
                animate={riffle(i % 2 === 0 ? -1 : 1, i)}
              >
                <CardBack width={g.cardW * 0.7} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ---------- dealer button ---------- */}
      {state.dealer >= 0 && (
        <motion.div
          className="absolute left-0 top-0 z-[7] grid h-7 w-7 place-items-center rounded-full bg-neon-amber font-display text-sm font-bold text-night-950 shadow-neon-amber ring-2 ring-night-950/60"
          initial={false}
          animate={{ x: g.buttons[seatOf(state.dealer)].x - 14, y: g.buttons[seatOf(state.dealer)].y - 14 }}
          transition={SPRING.soft}
          aria-label="Dealer button"
        >
          D
        </motion.div>
      )}

      {/* ---------- bets ---------- */}
      <AnimatePresence>
        {state.players.map((p, i) => {
          if (p.bet <= 0) return null
          const s = seatOf(i)
          const to = g.bets[s]
          const from = s === 0 ? { x: g.center.x, y: g.heroCards[0].y + 60 } : g.seats[s]
          return (
            <motion.div
              key={`${handKey}-${state.street}-${p.id}`}
              className="absolute left-0 top-0 z-[8]"
              initial={replay ? false : { x: from.x - 24, y: from.y - 18, opacity: 0, scale: 0.7 }}
              animate={{ x: to.x - 24, y: to.y - 18, opacity: 1, scale: 1 }}
              exit={{ x: g.pot.x - 24, y: g.pot.y - 18, opacity: 0, scale: 0.8, transition: { duration: DUR.collect, ease: EASE.in } }}
              transition={{ duration: DUR.chipSlide, ease: EASE.out }}
            >
              <div className="flex w-12 justify-center">
                <ChipStack amount={p.bet} bb={bb} scale={g.compact ? 0.8 : 1} />
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* ---------- pot → winner flights ---------- */}
      {live &&
        outcome &&
        outcome.pots.flatMap((pot, pi) =>
          Object.entries(pot.payouts).map(([id, amount]) => {
            const idx = state.players.findIndex((p) => p.id === id)
            const dest = g.seats[seatOf(idx)]
            return (
              <motion.div
                key={`${handKey}-award-${pi}-${id}`}
                className="pointer-events-none absolute left-0 top-0 z-[30]"
                initial={{ x: g.pot.x - 24, y: g.pot.y - 18, opacity: 0, scale: 0.9 }}
                animate={{
                  x: [g.pot.x - 24, g.pot.x - 24, dest.x - 24, dest.x - 24],
                  y: [g.pot.y - 18, g.pot.y - 18, dest.y - 18, dest.y - 18],
                  opacity: [0, 1, 1, 0],
                  scale: [0.9, 1.1, 1, 0.8],
                }}
                transition={{ duration: DUR.potToWinner + 0.6, delay: awardDelay + pi * 0.25, times: [0, 0.15, 0.75, 1], ease: EASE.inOut }}
              >
                <div className="flex w-12 justify-center">
                  <ChipStack amount={amount} bb={bb} labelClassName="!bg-neon-amber !text-night-950" label={`+${amount.toLocaleString()}`} />
                </div>
              </motion.div>
            )
          }),
        )}

      {/* ---------- board cards ---------- */}
      {state.board.map((c, i) => {
        const p = g.board[i]
        const isFlop = i < 3
        const flightDelay = replay ? 0 : DUR.collect + (isFlop ? i * DUR.boardStagger : 0)
        const flipDelay = replay ? 0 : flightDelay + DUR.dealFlight + (isFlop ? i * DUR.boardFlipGap : 0)
        const hl = showdown ? (winCards.has(c) ? 'win' : 'dim') : null
        return (
          <motion.div
            key={`${handKey}-b${i}`}
            className="absolute left-0 top-0 z-[12]"
            initial={replay ? false : { x: deckPos.x - g.cardW / 2, y: deckPos.y - boardCardH / 2, rotate: -12, opacity: 0, scale: 0.7 }}
            animate={{ x: p.x - g.cardW / 2, y: p.y - boardCardH / 2, rotate: 0, opacity: 1, scale: 1 }}
            transition={{ ...SPRING.settle, delay: flightDelay, opacity: { duration: 0.1, delay: flightDelay } }}
          >
            <motion.div animate={{ y: hl === 'win' ? -12 : 0 }} transition={{ duration: DUR.winGlow, ease: EASE.pop, delay: hl ? PACE.showdownReveal / 1000 - 0.4 : 0 }}>
              <Card card={c} faceUp width={g.cardW} flipDelay={flipDelay} highlight={hl} />
            </motion.div>
          </motion.div>
        )
      })}

      {/* ---------- hole cards ---------- */}
      <AnimatePresence>
        {state.players.flatMap((p, i) => {
          if (p.out || p.hole.length < 2 || p.folded) return []
          const s = seatOf(i)
          const isHero = i === heroIndex
          const w = isHero ? g.heroCardW : g.botCardW
          const h = w * CARD_RATIO
          return p.hole.map((c, r) => {
            const base = isHero ? g.heroCards[r] : { x: g.botCards[s].x + (r - 0.5) * w * 0.62, y: g.botCards[s].y }
            const rot = isHero ? (r === 0 ? -4 : 4) : r === 0 ? -7 : 7
            const k = dealIndex(i, r)
            const delay = replay ? 0 : dealDelay(k)
            const faceUp = isHero || reveal
            const hl = showdown ? (winCards.has(c) ? 'win' : winners.has(p.id) ? null : 'dim') : null
            return (
              <motion.div
                key={`${handKey}-${p.id}-${r}`}
                className={clsx('absolute left-0 top-0', isHero ? 'z-[22]' : 'z-[14]')}
                initial={replay ? false : { x: deckPos.x - w / 2, y: deckPos.y - h / 2, rotate: -25, opacity: 0, scale: 0.55 }}
                animate={{ x: base.x - w / 2, y: base.y - h / 2, rotate: rot, opacity: 1, scale: 1 }}
                exit={{
                  x: g.muck.x - w / 2,
                  y: g.muck.y - h / 2,
                  rotate: rot + 120,
                  opacity: 0,
                  scale: 0.5,
                  transition: { duration: DUR.fold, ease: EASE.in },
                }}
                transition={{ ...SPRING.settle, delay, opacity: { duration: 0.08, delay } }}
              >
                <motion.div
                  animate={{ y: hl === 'win' ? -14 : 0 }}
                  whileHover={isHero && live && !showdown ? hoverLift : undefined}
                  transition={{ duration: DUR.winGlow, ease: EASE.pop, delay: hl ? PACE.showdownReveal / 1000 - 0.4 : 0 }}
                >
                  <Card
                    card={c}
                    faceUp={faceUp}
                    width={w}
                    flipDelay={isHero ? delay + DUR.dealFlight + 0.15 * r + (replay ? 0 : 0.35) : reveal && !replay ? 0.2 : 0}
                    highlight={hl}
                  />
                </motion.div>
              </motion.div>
            )
          })
        })}
      </AnimatePresence>

      {/* ---------- seats ---------- */}
      {state.players.map((p, i) => {
        const s = seatOf(i)
        const isHero = i === heroIndex
        const meta = seatMeta[p.id]
        const at = isHero
          ? { x: g.seats[0].x, y: g.heroCards[0].y + g.heroCardW * CARD_RATIO * 0.5 + (g.compact ? 22 : 30) }
          : g.seats[s]
        const handName = showdown && !p.folded && outcome?.hands[p.id] ? outcome.hands[p.id].name.split(',')[0] : null
        const label = outcome?.uncontested && winners.has(p.id) ? 'WINS' : handName
        return (
          <Abs key={p.id} at={at} z={isHero ? 24 : 16}>
            <Seat
              player={p}
              avatar={meta?.avatar ?? { skin: 1, hair: 'black', style: 'short', accessory: 'none', outfit: 'pink' }}
              tag={meta?.tag}
              position={labels[i]}
              size={g.avatar}
              thinking={thinkingId === p.id}
              acting={state.phase === 'betting' && state.toAct === i && (isHero ? !!heroTurn : true)}
              isHero={isHero}
              winner={!!outcome && winners.has(p.id)}
              handLabel={label}
              stackDelay={outcome ? awardDelay + DUR.potToWinner : 0}
              compact={g.compact}
            />
          </Abs>
        )
      })}
    </div>
  )
}
