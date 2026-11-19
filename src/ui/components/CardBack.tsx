import clsx from 'clsx'
import { CARD_RATIO } from './Card'
import { CardBackArt } from './CardArt'

/** Static face-down card (deck, muck, decorations). */
export function CardBack({ width, className }: { width: number; className?: string }) {
  return (
    <div
      className={clsx('rounded-card shadow-card', className)}
      style={{ width, height: width * CARD_RATIO }}
      aria-hidden
    >
      <CardBackArt />
    </div>
  )
}
