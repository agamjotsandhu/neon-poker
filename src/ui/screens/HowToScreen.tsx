import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { parseCards } from '../../engine/cards'
import { useGame } from '../../store/gameStore'
import { Card } from '../components/Card'
import { NeonButton } from '../components/Modal'
import { PixelIcon } from '../components/PixelIcon'
import { DUR, EASE, listItem, listStagger } from '../motion'
import { Logo } from './Logo'

/** [name, cards, how many of the 5 cards matter, description, 7-card probability] */
const RANKINGS: [string, string, number, string, string][] = [
  ['Royal Flush', 'AhKhQhJhTh', 5, 'A-K-Q-J-10, all the same suit. Unbeatable.', '0.003%'],
  ['Straight Flush', '9s8s7s6s5s', 5, 'Five in a row, all one suit.', '0.03%'],
  ['Four of a Kind', 'QcQdQhQs7d', 4, 'Four cards of the same rank.', '0.17%'],
  ['Full House', 'KcKdKs4h4c', 5, 'Three of a kind plus a pair.', '2.6%'],
  ['Flush', 'Ad9d7d4d2d', 5, 'Five cards of one suit, any order.', '3.0%'],
  ['Straight', 'Tc9d8h7s6c', 5, 'Five in a row, mixed suits. A-2-3-4-5 is the lowest.', '4.6%'],
  ['Three of a Kind', '8c8h8sKdQc', 3, 'Three cards of the same rank.', '4.8%'],
  ['Two Pair', 'JcJs5d5hAc', 4, 'Two different pairs.', '23.5%'],
  ['Pair', 'AcAdKs9h4c', 2, 'Two cards of the same rank.', '43.8%'],
  ['High Card', 'AsJd8c5h3d', 1, 'Nothing made — the highest card plays.', '17.4%'],
]

const RULES: { title: string; body: string }[] = [
  {
    title: 'The goal',
    body: 'Win chips by having the best five-card hand at showdown, or by betting so that everyone else folds.',
  },
  {
    title: 'Blinds',
    body: 'The two players left of the dealer button post forced bets — the small blind and big blind — so there is always something to win.',
  },
  {
    title: 'Hole cards',
    body: 'Everyone gets two private cards. Players act clockwise, starting left of the big blind.',
  },
  {
    title: 'The streets',
    body: 'Preflop → Flop (3 shared cards) → Turn (1) → River (1). There is a round of betting after each.',
  },
  {
    title: 'Your options',
    body: 'Fold (give up), Check (pass if no bet), Call (match the bet), Bet / Raise (put in more). In No-Limit you can bet up to your whole stack — all-in.',
  },
  {
    title: 'Showdown',
    body: 'If more than one player remains after the river, hands are revealed. Your best five of seven cards (two hole cards + five board cards) plays.',
  },
  {
    title: 'Side pots',
    body: 'An all-in player can only win what they matched from each opponent; extra chips form a side pot the others play for.',
  },
  {
    title: 'Position',
    body: 'Acting last is a big advantage — you see what everyone did first. That is why the Button plays the most hands.',
  },
]

const COACHING: { title: string; body: string }[] = [
  {
    title: 'Coach mode',
    body: 'On your turn the coach explains your hand, shows the opening chart or your equity, counts your outs and recommends a play — with the reasoning.',
  },
  {
    title: 'Quiz mode',
    body: 'You act first, then the coach grades the decision: Great, Good, Mistake or Blunder, and explains why.',
  },
  {
    title: 'Pot odds',
    body: 'If you must call 50 into a pot of 100, you risk 50 to win 150 — you need 50 ÷ 150 = 33% equity to break even.',
  },
  {
    title: 'Rule of 2 & 4',
    body: 'Multiply your outs by 4 on the flop (two cards to come) or by 2 on the turn to estimate your chance to hit.',
  },
  {
    title: 'Keyboard',
    body: 'F = Fold, C = Check / Call, R = Bet / Raise (uses the slider amount). Enter deals the next hand. ← → step through replays.',
  },
  {
    title: 'Honest disclaimer',
    body: 'Advice is a heuristic built from standard ranges and Monte Carlo equity — a strong teacher, not a solver.',
  },
]

const TABS = ['Rules', 'Hand rankings', 'Coach & controls'] as const

export function HowToScreen() {
  const setScreen = useGame((s) => s.setScreen)
  const start = useGame((s) => s.startGame)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Rules')

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <button
          onClick={() => setScreen('landing')}
          className="flex items-center gap-2 rounded-pixel px-2 py-1.5 font-display text-sm text-haze-300 hover:bg-night-800 hover:text-haze-100"
        >
          <PixelIcon name="prev" size={12} /> BACK
        </button>
        <div className="ml-auto">
          <Logo size="xs" />
        </div>
      </header>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-8 sm:px-6">
        <div className="glass mx-auto max-w-4xl rounded-panel p-4 shadow-panel ring-1 ring-neon-pink/30 sm:p-7">
          <h1 className="font-display text-3xl font-bold text-haze-100 text-glow-pink sm:text-4xl">
            How to play
          </h1>
          <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={clsx(
                  'rounded-pixel px-3 py-1.5 font-display text-sm ring-1 transition',
                  tab === t
                    ? 'bg-neon-pink text-night-950 ring-neon-pink'
                    : 'bg-night-800 text-haze-200 ring-haze-400/25 hover:bg-night-700',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: DUR.fade, ease: EASE.out }}
              className="mt-5"
            >
              {tab === 'Rules' && <InfoGrid items={RULES} />}
              {tab === 'Coach & controls' && <InfoGrid items={COACHING} />}
              {tab === 'Hand rankings' && (
                <motion.ol
                  variants={listStagger}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-2"
                >
                  {RANKINGS.map(([name, cards, used, desc, prob], i) => (
                    <motion.li
                      key={name}
                      variants={listItem}
                      className="flex flex-col gap-2 rounded-panel bg-night-900/70 p-2.5 ring-1 ring-haze-400/10 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="flex items-center gap-3 sm:w-52">
                        <span className="num w-6 text-lg text-neon-pink">{i + 1}</span>
                        <div>
                          <div className="font-display text-base font-semibold text-haze-100">
                            {name}
                          </div>
                          <div className="text-[11px] text-haze-400">{prob} of 7-card hands</div>
                        </div>
                      </div>
                      <div className="flex gap-1 pl-9 sm:pl-0">
                        {parseCards(cards).map((c, k) => (
                          <Card
                            key={c}
                            card={c}
                            faceUp
                            width={38}
                            highlight={k < used ? null : 'dim'}
                          />
                        ))}
                      </div>
                      <p className="pl-9 text-sm leading-snug text-haze-300 sm:pl-0">{desc}</p>
                    </motion.li>
                  ))}
                </motion.ol>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex flex-wrap gap-2">
            <NeonButton onClick={start}>▶ PLAY NOW</NeonButton>
            <NeonButton tone="ghost" onClick={() => setScreen('landing')}>
              BACK TO LOBBY
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoGrid({ items }: { items: { title: string; body: string }[] }) {
  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="grid gap-3 sm:grid-cols-2"
    >
      {items.map((r) => (
        <motion.div
          key={r.title}
          variants={listItem}
          className="rounded-panel bg-night-900/70 p-4 ring-1 ring-haze-400/10"
        >
          <div className="font-display text-base font-semibold text-neon-cyan">{r.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-haze-200">{r.body}</p>
        </motion.div>
      ))}
    </motion.div>
  )
}
