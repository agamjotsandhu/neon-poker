import type { Grade } from '../coach/grade'

export const GRADE_CLS: Record<Grade, string> = {
  great: 'bg-neon-lime text-night-950',
  good: 'bg-neon-cyan text-night-950',
  mistake: 'bg-neon-amber text-night-950',
  blunder: 'bg-neon-red text-night-950',
}
