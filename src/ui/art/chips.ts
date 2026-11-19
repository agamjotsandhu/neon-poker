/** Chip denominations (as multiples of the big blind) mapped to theme colour tokens. */
const DENOMS: { mult: number; color: string; stripe: string }[] = [
  { mult: 100, color: 'chip-gold', stripe: 'night-900' },
  { mult: 25, color: 'chip-black', stripe: 'neon-pink' },
  { mult: 5, color: 'chip-blue', stripe: 'chip-white' },
  { mult: 1, color: 'chip-red', stripe: 'chip-white' },
  { mult: 0.5, color: 'chip-white', stripe: 'chip-blue' },
]

/** Break an amount into chip colours (largest first), capped for display. */
export function chipColumns(amount: number, bb: number, maxPerCol = 6, maxCols = 3): { color: string; stripe: string }[][] {
  const chips: { color: string; stripe: string }[] = []
  let left = amount
  for (const d of DENOMS) {
    const v = d.mult * bb
    if (v <= 0) continue
    let n = Math.floor(left / v + 1e-9)
    left -= n * v
    while (n-- > 0) chips.push({ color: d.color, stripe: d.stripe })
  }
  if (chips.length === 0 && amount > 0) chips.push({ color: DENOMS[4].color, stripe: DENOMS[4].stripe })
  const cols: { color: string; stripe: string }[][] = []
  for (let i = 0; i < chips.length && cols.length < maxCols; i += maxPerCol) cols.push(chips.slice(i, i + maxPerCol))
  return cols
}
