/**
 * ALL animation durations, easings, springs and variants live here.
 * Components and the store's pacing import from this file — never inline numbers.
 */
import type { Transition, Variants } from 'motion/react'

/** Seconds — used by motion components. */
export const DUR = {
  shuffle: 0.95,
  dealFlight: 0.42,
  dealStagger: 0.1,
  flip: 0.5,
  boardStagger: 0.13,
  boardFlipGap: 0.12,
  chipSlide: 0.45,
  collect: 0.42,
  potToWinner: 0.75,
  fold: 0.5,
  badge: 0.22,
  panel: 0.38,
  hover: 0.18,
  fade: 0.25,
  winGlow: 0.5,
  number: 0.6,
  screen: 0.5,
  /** Opacity snap when a flying card appears */
  appear: 0.1,
  /** CSS transitions for glow / dim state changes */
  cssGlow: 0.5,
  cssRing: 0.3,
} as const

/** CSS transition-duration helpers (for Tailwind transition-* classes). */
export const cssDur = (s: number) => ({ transitionDuration: `${s}s` })

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  in: [0.55, 0, 1, 0.45] as const,
  pop: [0.34, 1.56, 0.64, 1] as const,
}

export const SPRING = {
  settle: { type: 'spring', stiffness: 380, damping: 26, mass: 0.8 } satisfies Transition,
  soft: { type: 'spring', stiffness: 220, damping: 26 } satisfies Transition,
  panel: { type: 'spring', stiffness: 300, damping: 34 } satisfies Transition,
  button: { type: 'spring', stiffness: 500, damping: 30 } satisfies Transition,
}

/** Milliseconds — game pacing used by the store between engine steps. */
export const PACE = {
  /** Shuffle + time for one card to land, before per-card stagger. */
  dealBase: (DUR.shuffle + DUR.dealFlight + DUR.flip) * 1000,
  dealPerCard: DUR.dealStagger * 1000,
  afterAction: 420,
  collect: DUR.collect * 1000 + 150,
  flop: (DUR.boardStagger * 2 + DUR.dealFlight + DUR.flip + DUR.boardFlipGap * 2) * 1000 + 250,
  turnRiver: (DUR.dealFlight + DUR.flip) * 1000 + 250,
  runoutPause: 900,
  showdownReveal: 1100,
  summaryDelay: 2600,
  uncontestedSummaryDelay: 1600,
  replayStep: 1000,
} as const

/** Showdown choreography (seconds). */
export const SHOWDOWN = {
  /** When the winning five lift and glow. */
  winLift: PACE.showdownReveal / 1000 - 0.4,
  /** When pot chips start flying to the winner. */
  awardShowdown: PACE.showdownReveal / 1000,
  awardUncontested: DUR.collect + 0.1,
  /** Extra gap between side-pot awards. */
  awardStagger: 0.25,
  /** Total award flight incl. hover + fade at the seat. */
  awardFlight: DUR.potToWinner + 0.6,
  awardTimes: [0, 0.15, 0.75, 1],
  /** Bots' cards flip shortly after the reveal begins. */
  botReveal: 0.2,
} as const

/** Hero hole-card flip after the deal lands (seconds). */
export const heroFlipDelay = (dealDelaySec: number, round: number) =>
  dealDelaySec + DUR.dealFlight + 0.35 + 0.15 * round

/** Card deal delay (seconds) for the k-th card dealt this hand. */
export const dealDelay = (k: number) => DUR.shuffle + k * DUR.dealStagger

export const flipTransition: Transition = { duration: DUR.flip, ease: EASE.inOut }

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fade } },
  exit: { opacity: 0, transition: { duration: DUR.fade } },
}

export const panelVariants: Variants = {
  hidden: { x: 40, opacity: 0 },
  show: { x: 0, opacity: 1, transition: SPRING.panel },
  exit: { x: 30, opacity: 0, transition: { duration: DUR.fade } },
}

export const sheetVariants: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: SPRING.panel },
  exit: { y: '100%', transition: { duration: DUR.fade, ease: EASE.in } },
}

export const popVariants: Variants = {
  hidden: { scale: 0.6, opacity: 0, y: 6 },
  show: { scale: 1, opacity: 1, y: 0, transition: { duration: DUR.badge, ease: EASE.pop } },
  exit: { scale: 0.8, opacity: 0, transition: { duration: DUR.badge * 0.7 } },
}

export const screenVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DUR.screen, ease: EASE.out },
  },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: DUR.fade } },
}

export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.fade, ease: EASE.out } },
}

export const hoverLift = { y: -10, rotate: 0, transition: { duration: DUR.hover, ease: EASE.out } }

/** Win glow pulse for the winning five cards */
export const winPulse = {
  y: -14,
  transition: { duration: DUR.winGlow, ease: EASE.pop },
}

/** Shuffle: two halves of the deck split and riffle back together. */
export const riffle = (side: -1 | 1, i: number) => ({
  x: [0, side * 26, side * 26, 0, side * 18, 0],
  y: [0, -2 - i, -2 - i, 0, -1, 0],
  rotate: [0, side * 9, side * 9, 0, side * 6, 0],
  transition: {
    duration: DUR.shuffle,
    ease: EASE.inOut,
    times: [0, 0.22, 0.4, 0.62, 0.8, 1],
    delay: i * 0.012,
  },
})

/** Gentle idle bob for decorative cards on the landing screen. */
export const floatLoop = (i: number) => ({
  animate: { y: [0, -6, 0] },
  transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const, delay: i * 0.2 },
})

/** Landing fan: each card swings out from the stack. */
export const fanIn = (i: number): Transition => ({
  delay: 0.25 + i * 0.08,
  duration: DUR.panel * 1.6,
  ease: EASE.pop,
})
