import clsx from 'clsx'
import { motion } from 'motion/react'
import type { Card as CardT } from '../../engine/cards'
import { cardToString } from '../../engine/cards'
import { flipTransition } from '../motion'
import { CardBackArt, CardFaceArt } from './CardArt'

export const CARD_RATIO = 70 / 50

interface Props {
  card: CardT | null
  faceUp: boolean
  width: number
  /** Extra delay before the flip animation (seconds). */
  flipDelay?: number
  highlight?: 'win' | 'dim' | null
  className?: string
}

/** A card with a real 3D flip between the original back and face art. */
export function Card({ card, faceUp, width, flipDelay = 0, highlight = null, className }: Props) {
  const height = width * CARD_RATIO
  const showFace = faceUp && card !== null
  return (
    <div
      className={clsx('relative [perspective:700px]', className)}
      style={{ width, height }}
      aria-label={showFace ? cardToString(card) : 'face-down card'}
      role="img"
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: showFace ? 180 : 0 }}
        transition={{ ...flipTransition, delay: showFace ? flipDelay : 0 }}
      >
        <div className="absolute inset-0 rounded-card shadow-card [backface-visibility:hidden]">
          <CardBackArt />
        </div>
        <div
          className={clsx(
            'absolute inset-0 rounded-card transition-[box-shadow,filter] duration-500 [backface-visibility:hidden] [transform:rotateY(180deg)]',
            highlight === 'win' ? 'shadow-card-win' : 'shadow-card',
            highlight === 'dim' && 'brightness-[0.45] saturate-50',
          )}
        >
          {card !== null && <CardFaceArt card={card} />}
        </div>
      </motion.div>
    </div>
  )
}
