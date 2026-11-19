import clsx from 'clsx'
import { motion } from 'motion/react'
import { memo } from 'react'
import { DUR, EASE } from '../motion'
import { chipColumns } from '../art/chips'
import { token } from '../palette'

const Chip = ({ color, stripe, y }: { color: string; stripe: string; y: number }) => (
  <g transform={`translate(0 ${y})`}>
    <rect x="1" y="4" width="20" height="4" fill={token(color)} />
    <rect x="1" y="4" width="20" height="4" fill={token('night-950')} opacity="0.35" />
    <rect x="4" y="4" width="3" height="4" fill={token(stripe)} opacity="0.8" />
    <rect x="15" y="4" width="3" height="4" fill={token(stripe)} opacity="0.8" />
    <ellipse cx="11" cy="4" rx="10" ry="3.6" fill={token(color)} />
    <ellipse
      cx="11"
      cy="4"
      rx="6.5"
      ry="2.2"
      fill="none"
      stroke={token(stripe)}
      strokeWidth="1.1"
      strokeDasharray="2 1.6"
    />
    <ellipse
      cx="11"
      cy="4"
      rx="10"
      ry="3.6"
      fill="none"
      stroke={token('night-950')}
      strokeOpacity="0.5"
      strokeWidth="0.6"
    />
  </g>
)

export const ChipPile = memo(function ChipPile({
  amount,
  bb,
  scale = 1,
}: {
  amount: number
  bb: number
  scale?: number
}) {
  const cols = chipColumns(amount, bb)
  const tallest = Math.max(1, ...cols.map((c) => c.length))
  const height = 9 + (tallest - 1) * 3
  const width = cols.length * 22 + (cols.length - 1) * 2
  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="block overflow-visible"
    >
      {cols.map((col, ci) => (
        <g key={ci} transform={`translate(${ci * 24} 0)`}>
          {col.map((c, i) => (
            <Chip key={i} color={c.color} stripe={c.stripe} y={height - 9 - i * 3} />
          ))}
        </g>
      ))}
    </svg>
  )
})

/** Chips + amount label. */
export function ChipStack({
  amount,
  bb,
  label,
  className,
  scale = 1,
  labelClassName,
}: {
  amount: number
  bb: number
  label?: string
  className?: string
  scale?: number
  labelClassName?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      <ChipPile amount={amount} bb={bb} scale={scale} />
      <motion.span
        key={amount}
        initial={{ scale: 1.25, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DUR.badge, ease: EASE.pop }}
        className={clsx(
          'num rounded-pixel bg-night-950/80 px-1.5 py-px text-xs leading-tight text-haze-100 ring-1 ring-haze-400/30',
          labelClassName,
        )}
      >
        {label ?? amount.toLocaleString()}
      </motion.span>
    </div>
  )
}
