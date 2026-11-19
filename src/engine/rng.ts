import type { Card } from './cards'
import { fullDeck } from './cards'

/** A function returning a float in [0, 1). */
export type Rng = () => number

/** mulberry32: tiny, fast, good-enough seeded PRNG. Same seed → same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive)
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1)
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

export function shuffledDeck(seed: number): Card[] {
  return shuffle(fullDeck(), createRng(seed))
}

/** Derive a fresh 32-bit seed (for UI use; tests pass explicit seeds). */
export function freshSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
