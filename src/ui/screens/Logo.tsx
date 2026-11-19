import clsx from 'clsx'
import { PixelSuit } from '../components/PixelSuit'
import { token } from '../palette'

export function Logo({ size = 'sm' }: { size?: 'xs' | 'sm' | 'xl' }) {
  if (size === 'xl') {
    return (
      <div className="flex flex-col items-center leading-none">
        <div className="animate-flicker font-display text-[clamp(56px,12vw,128px)] font-bold tracking-[0.06em] text-neon-pink text-glow-pink">
          NEON
        </div>
        <div className="-mt-1 flex items-center gap-3 font-display text-[clamp(34px,7vw,76px)] font-bold tracking-[0.12em] text-haze-100 text-glow-cyan">
          <PixelSuit suit="s" size={36} color={token('neon-cyan')} className="hidden sm:block" />
          HOLD&apos;EM
          <PixelSuit suit="h" size={36} color={token('neon-pink')} className="hidden sm:block" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <PixelSuit suit="s" size={size === 'xs' ? 16 : 20} color={token('neon-pink')} />
      <span
        className={clsx(
          'font-display font-bold tracking-wider',
          size === 'xs' ? 'hidden text-base min-[440px]:inline' : 'text-lg',
        )}
      >
        <span className="text-neon-pink text-glow-pink">NEON</span>{' '}
        <span className="text-haze-100">HOLD&apos;EM</span>
      </span>
    </div>
  )
}
