import { AnimatePresence, motion } from 'motion/react'
import type { Pt } from '../geometry'
import { DUR, EASE } from '../motion'
import { ChipPile } from './ChipStack'

/** Collected chips in the middle (bets from previous streets). */
export function Pot({ amount, bb, at }: { amount: number; bb: number; at: Pt }) {
  return (
    <AnimatePresence>
      {amount > 0 && (
        <motion.div
          className="pointer-events-none absolute z-[9] -translate-x-1/2 -translate-y-1/2"
          style={{ left: at.x, top: at.y }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: DUR.fade } }}
          transition={{ duration: DUR.collect, ease: EASE.out, delay: DUR.collect * 0.8 }}
        >
          <ChipPile amount={amount} bb={bb} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
