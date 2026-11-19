/**
 * Canvas/SVG art reads colours from the Tailwind theme tokens (CSS variables)
 * so there is a single source of truth. `token('neon-pink')` → 'var(--color-neon-pink)'
 * for SVG/CSS; `resolveToken('neon-pink')` → '#ff3df2' for canvas.
 */
export const token = (name: string) => `var(--color-${name})`

const cache = new Map<string, string>()
export function resolveToken(name: string): string {
  if (cache.has(name)) return cache.get(name)!
  let v: string
  try {
    v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
  } catch {
    v = ''
  }
  if (v) cache.set(name, v)
  return v || 'transparent'
}

/** Parse #rrggbb → [r,g,b] */
export function rgbOf(name: string): [number, number, number] {
  const hex = resolveToken(name).replace('#', '')
  if (hex.length !== 6) return [128, 128, 128]
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

export const rgba = (name: string, a: number) => {
  const [r, g, b] = rgbOf(name)
  return `rgba(${r},${g},${b},${a})`
}

export const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a)
  const y = rgbOf(b)
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

/** Suit ink colour as a CSS token reference. */
export const suitColor = (s: 'c' | 'd' | 'h' | 's') =>
  s === 'h' || s === 'd' ? token('suit-red') : token('card-ink')
