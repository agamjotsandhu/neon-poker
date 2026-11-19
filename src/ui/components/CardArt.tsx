import { memo, useId } from 'react'
import { rankChar, suitChar, type Card } from '../../engine/cards'
import { suitColor, token } from '../palette'
import { bitmapRuns, RANK_BITMAPS } from '../art/pixels'
import { PixelSuitGlyph } from './PixelSuit'

const RANK_RUNS = Object.fromEntries(Object.entries(RANK_BITMAPS).map(([k, v]) => [k, bitmapRuns(v)]))

const W = 50
const H = 70

/** Original cream card face: big pixel rank, pixel suits. */
export const CardFaceArt = memo(function CardFaceArt({ card }: { card: Card }) {
  const r = rankChar(card)
  const s = suitChar(card)
  const px = r === 'T' ? 1.85 : 2.2
  const color = suitColor(s)
  const gid = useId()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`${gid}-paper`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={token('card-cream')} />
          <stop offset="1" stopColor={token('card-shade')} />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="5" fill={`url(#${gid}-paper)`} stroke={token('card-edge')} strokeWidth="1" />
      <rect x="2.5" y="2.5" width={W - 5} height={H - 5} rx="3.5" fill="none" stroke={token('card-edge')} strokeOpacity="0.35" strokeWidth="0.75" />
      <g fill={color} shapeRendering="crispEdges">
        {RANK_RUNS[r].map((run, i) => (
          <rect key={i} x={4.5 + run.x * px} y={5 + run.y * px} width={run.w * px + 0.05} height={px + 0.05} />
        ))}
      </g>
      <PixelSuitGlyph suit={s} x={5} y={23} px={1.15} />
      <PixelSuitGlyph suit={s} x={19} y={34} px={3} />
      {/* worn-paper pixel speckles */}
      <g fill={token('card-edge')} opacity="0.25" shapeRendering="crispEdges">
        <rect x="40" y="8" width="1" height="1" />
        <rect x="8" y="58" width="1" height="1" />
        <rect x="44" y="30" width="1" height="1" />
        <rect x="30" y="14" width="1" height="1" />
      </g>
    </svg>
  )
})

/** Original card back: violet with a neon pixel lattice and emblem. */
export const CardBackArt = memo(function CardBackArt() {
  const gid = useId()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" aria-hidden>
      <defs>
        <pattern id={`${gid}-lat`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={token('card-back')} />
          <rect x="2" y="0" width="2" height="1" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="1" y="1" width="1" height="1" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="4" y="1" width="1" height="1" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="0" y="2" width="1" height="2" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="5" y="2" width="1" height="2" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="1" y="4" width="1" height="1" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="4" y="4" width="1" height="1" fill={token('neon-magenta')} opacity="0.55" />
          <rect x="2" y="5" width="2" height="1" fill={token('neon-magenta')} opacity="0.55" />
        </pattern>
        <radialGradient id={`${gid}-glow`}>
          <stop offset="0" stopColor={token('neon-pink')} stopOpacity="0.55" />
          <stop offset="1" stopColor={token('neon-pink')} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="5" fill={token('night-900')} stroke={token('neon-pink')} strokeWidth="1" />
      <rect x="3" y="3" width={W - 6} height={H - 6} rx="3" fill={`url(#${gid}-lat)`} />
      <rect x="3" y="3" width={W - 6} height={H - 6} rx="3" fill="none" stroke={token('neon-pink')} strokeOpacity="0.6" strokeWidth="0.75" />
      <circle cx={W / 2} cy={H / 2} r="15" fill={`url(#${gid}-glow)`} />
      <rect x={W / 2 - 9} y={H / 2 - 9} width="18" height="18" transform={`rotate(45 ${W / 2} ${H / 2})`} fill={token('night-900')} stroke={token('neon-pink')} strokeWidth="1" />
      <PixelSuitGlyph suit="s" x={W / 2 - 6.75} y={H / 2 - 6.75} px={1.5} fill={token('neon-pink')} />
    </svg>
  )
})
