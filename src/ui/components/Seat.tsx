import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import type { AvatarSpec } from '../../bots/personalities'
import type { ActionType, Player } from '../../engine/types'
import { cssDur, DUR, popVariants } from '../motion'
import { AnimatedNumber } from './AnimatedNumber'
import { PixelAvatar } from './PixelAvatar'

const BADGE: Record<ActionType, { text: string; cls: string }> = {
  fold: { text: 'FOLD', cls: 'bg-night-700 text-haze-300 ring-haze-400/40' },
  check: { text: 'CHECK', cls: 'bg-neon-teal text-night-950 ring-neon-cyan' },
  call: { text: 'CALL', cls: 'bg-neon-lime text-night-950 ring-neon-lime' },
  bet: { text: 'BET', cls: 'bg-neon-pink text-night-950 ring-neon-pink' },
  raise: { text: 'RAISE', cls: 'bg-neon-pink text-night-950 ring-neon-pink' },
  allin: { text: 'ALL-IN', cls: 'bg-neon-amber text-night-950 ring-neon-amber' },
}

interface Props {
  player: Player
  avatar: AvatarSpec
  tag?: string
  position?: string
  size: number
  thinking: boolean
  acting: boolean
  isHero: boolean
  winner: boolean
  handLabel?: string | null
  stackDelay?: number
  compact?: boolean
}

export function Seat({
  player,
  avatar,
  tag,
  position,
  size,
  thinking,
  acting,
  isHero,
  winner,
  handLabel,
  stackDelay = 0,
  compact,
}: Props) {
  const last = player.lastAction
  const badge = last ? BADGE[last.type] : null
  const amountText =
    last &&
    (last.type === 'call' || last.type === 'bet' || last.type === 'raise') &&
    last.amount > 0
      ? ` ${last.amount.toLocaleString()}`
      : ''
  const faded = player.folded || player.out

  return (
    <div
      className={clsx(
        'flex flex-col items-center transition-[opacity,filter]',
        faded && 'opacity-55 saturate-50',
      )}
      style={cssDur(DUR.cssGlow)}
    >
      {!isHero && (
        <div className="relative" style={{ width: size, height: size }}>
          <div
            className={clsx(
              'absolute inset-0 rounded-panel transition-shadow',
              winner ? 'shadow-neon-amber' : acting || thinking ? 'shadow-neon-cyan' : '',
            )}
            style={cssDur(DUR.cssRing)}
          />
          <div className="pixel-corners absolute inset-0 overflow-hidden bg-gradient-to-b from-night-600 to-night-800">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neon-magenta/30 to-transparent" />
            <div className="relative grid h-full w-full place-items-end justify-center">
              <PixelAvatar spec={avatar} size={size * 0.92} />
            </div>
          </div>
          {thinking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -right-3 -top-3 flex gap-0.5 rounded-pixel bg-haze-100 px-1.5 py-1 shadow-panel"
              aria-label={`${player.name} is thinking`}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-blink bg-night-900"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </motion.div>
          )}
        </div>
      )}

      <div className="relative -mt-1 h-0">
        <AnimatePresence mode="popLayout">
          {(badge || handLabel) && (
            <motion.div
              key={handLabel ?? `${last?.type}-${last?.amount}`}
              variants={popVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className={clsx(
                'absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-pixel px-2 py-0.5 font-display font-semibold tracking-wide ring-1',
                compact ? 'text-[10px]' : 'text-xs',
                handLabel
                  ? winner
                    ? 'bg-neon-amber text-night-950 ring-neon-amber'
                    : 'bg-night-800 text-haze-200 ring-haze-400/40'
                  : badge!.cls,
              )}
            >
              {handLabel ?? (
                <>
                  {badge!.text}
                  {amountText && <span className="num">{amountText}</span>}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className={clsx(
          'glass relative mt-2 flex flex-col items-center rounded-panel px-3 pb-1 pt-1.5 shadow-panel ring-1 transition-shadow',
          winner
            ? 'ring-neon-amber shadow-neon-amber'
            : acting
              ? 'ring-neon-cyan'
              : 'ring-haze-400/25',
          compact ? 'min-w-[72px]' : 'min-w-[96px]',
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={clsx(
              'font-display font-semibold leading-none text-haze-100',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {player.name}
          </span>
          {position && (position === 'SB' || position === 'BB') && (
            <span className="rounded-[2px] bg-night-600 px-1 font-display text-[9px] leading-tight text-haze-200">
              {position}
            </span>
          )}
        </div>
        <span
          className={clsx(
            'num leading-tight',
            compact ? 'text-sm' : 'text-lg',
            player.allIn ? 'text-neon-amber' : 'text-haze-100',
          )}
        >
          {player.out ? 'OUT' : <AnimatedNumber value={player.stack} delay={stackDelay} />}
        </span>
        {tag && !compact && (
          <span className="font-display text-[9px] tracking-widest text-haze-400">{tag}</span>
        )}
      </div>
    </div>
  )
}
