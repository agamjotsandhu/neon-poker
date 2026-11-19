import { bitmapRuns, SUIT_BITMAPS } from '../art/pixels'
import { suitColor } from '../palette'
import type { Suit } from '../../engine/cards'

const RUNS = {
  c: bitmapRuns(SUIT_BITMAPS.c),
  d: bitmapRuns(SUIT_BITMAPS.d),
  h: bitmapRuns(SUIT_BITMAPS.h),
  s: bitmapRuns(SUIT_BITMAPS.s),
}

/** Draws a pixel suit inside an existing SVG at (x, y) with the given pixel size. */
export function PixelSuitGlyph({
  suit,
  x,
  y,
  px,
  fill,
}: {
  suit: Suit
  x: number
  y: number
  px: number
  fill?: string
}) {
  return (
    <g fill={fill ?? suitColor(suit)}>
      {RUNS[suit].map((r, i) => (
        <rect
          key={i}
          x={x + r.x * px}
          y={y + r.y * px}
          width={r.w * px + 0.02}
          height={px + 0.02}
        />
      ))}
    </g>
  )
}

/** Standalone inline suit icon (for text, outs lists, etc.). */
export function PixelSuit({
  suit,
  size = 12,
  className,
  color,
}: {
  suit: Suit
  size?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 9 9"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden
    >
      <PixelSuitGlyph suit={suit} x={0} y={suit === 'h' ? 0.5 : 0} px={1} fill={color} />
    </svg>
  )
}
