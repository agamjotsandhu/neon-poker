import type { AvatarSpec } from '../../bots/personalities'

export type Grid = (string | null)[][]

const OUTFITS: Record<AvatarSpec['outfit'], [string, string]> = {
  pink: ['neon-magenta', 'neon-pink'],
  cyan: ['neon-teal', 'neon-cyan'],
  purple: ['night-500', 'haze-400'],
  amber: ['neon-orange', 'neon-amber'],
  lime: ['chip-green', 'neon-lime'],
}

const SKIN_SHADE: Record<number, string> = {
  1: 'skin-2',
  2: 'skin-3',
  3: 'skin-4',
  4: 'hair-black',
}

/** Builds a 16×16 pixel portrait from a spec. Each cell is a theme token name or null. */
export function buildAvatar(spec: AvatarSpec): Grid {
  const g: Grid = Array.from({ length: 16 }, () => Array<string | null>(16).fill(null))
  const set = (y: number, x: number, c: string | null) => {
    if (y >= 0 && y < 16 && x >= 0 && x < 16) g[y][x] = c
  }
  const fill = (y0: number, y1: number, x0: number, x1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(y, x, c)
  }
  const skin = `skin-${spec.skin}`
  const shade = SKIN_SHADE[spec.skin]
  const hair = `hair-${spec.hair}`
  const [outfit, outfitLight] = OUTFITS[spec.outfit]
  const ink = 'night-950'

  // body / outfit
  fill(13, 15, 2, 13, outfit)
  fill(13, 13, 2, 2, 'night-950')
  fill(13, 13, 13, 13, 'night-950')
  fill(13, 15, 7, 8, outfitLight)
  set(14, 6, outfitLight)
  set(14, 9, outfitLight)
  // neck
  fill(12, 12, 6, 9, shade)
  // face
  fill(4, 11, 4, 11, skin)
  set(4, 4, null)
  set(4, 11, null)
  set(11, 4, shade)
  set(11, 11, shade)
  fill(11, 11, 5, 10, skin)
  // ears
  set(7, 3, skin)
  set(8, 3, shade)
  set(7, 12, skin)
  set(8, 12, shade)
  // jaw shading
  fill(10, 11, 11, 11, shade)
  // eyes + brows
  set(7, 6, ink)
  set(8, 6, ink)
  set(7, 9, ink)
  set(8, 9, ink)
  set(7, 5, 'haze-100')
  set(7, 10, 'haze-100')
  fill(6, 6, 5, 6, hair)
  fill(6, 6, 9, 10, hair)
  // nose + mouth
  set(9, 8, shade)
  fill(10, 10, 7, 8, 'neon-red')

  switch (spec.style) {
    case 'short':
      fill(2, 4, 4, 11, hair)
      fill(3, 5, 3, 3, hair)
      fill(3, 5, 12, 12, hair)
      fill(5, 5, 4, 5, hair)
      break
    case 'long':
      fill(2, 4, 4, 11, hair)
      fill(3, 12, 3, 3, hair)
      fill(3, 12, 12, 12, hair)
      fill(4, 13, 2, 2, hair)
      fill(4, 13, 13, 13, hair)
      fill(5, 5, 4, 6, hair)
      fill(5, 5, 9, 11, hair)
      set(7, 3, hair)
      set(8, 3, hair)
      set(7, 12, hair)
      set(8, 12, hair)
      break
    case 'bun':
      fill(0, 1, 6, 9, hair)
      fill(2, 4, 4, 11, hair)
      fill(3, 5, 3, 3, hair)
      fill(3, 5, 12, 12, hair)
      set(5, 4, hair)
      set(5, 11, hair)
      break
    case 'mohawk':
      fill(0, 4, 7, 8, hair)
      fill(2, 4, 6, 9, hair)
      set(3, 5, shade)
      set(3, 10, shade)
      break
    case 'curly':
      fill(1, 4, 3, 12, hair)
      fill(0, 0, 5, 10, hair)
      fill(2, 8, 2, 2, hair)
      fill(2, 8, 13, 13, hair)
      fill(5, 6, 3, 3, hair)
      fill(5, 6, 12, 12, hair)
      fill(5, 5, 4, 11, hair)
      set(1, 3, null)
      set(1, 12, null)
      break
    case 'cap':
      fill(1, 4, 4, 11, outfit)
      fill(2, 3, 3, 12, outfit)
      fill(4, 4, 2, 12, outfitLight)
      fill(1, 1, 7, 8, outfitLight)
      fill(5, 6, 3, 3, hair)
      fill(5, 6, 12, 12, hair)
      break
    case 'hood':
      fill(1, 3, 4, 11, outfit)
      fill(2, 12, 2, 3, outfit)
      fill(2, 12, 12, 13, outfit)
      fill(1, 1, 5, 10, outfit)
      fill(4, 4, 4, 11, hair)
      fill(5, 5, 4, 5, hair)
      fill(5, 5, 10, 11, hair)
      fill(2, 2, 5, 10, outfitLight)
      break
  }

  switch (spec.accessory) {
    case 'shades':
      fill(7, 8, 4, 11, 'night-950')
      set(7, 5, 'neon-pink')
      set(7, 10, 'neon-pink')
      break
    case 'glasses':
      fill(6, 6, 4, 7, 'neon-cyan')
      fill(6, 6, 8, 11, 'neon-cyan')
      fill(9, 9, 4, 7, 'neon-cyan')
      fill(9, 9, 8, 11, 'neon-cyan')
      set(7, 4, 'neon-cyan')
      set(8, 4, 'neon-cyan')
      set(7, 11, 'neon-cyan')
      set(8, 11, 'neon-cyan')
      set(7, 7, 'neon-cyan')
      set(7, 8, 'neon-cyan')
      break
    case 'visor':
      fill(7, 8, 3, 12, 'neon-cyan')
      fill(7, 7, 5, 6, 'haze-100')
      break
    case 'earring':
      set(9, 12, 'neon-amber')
      set(10, 12, 'neon-amber')
      break
    case 'scar':
      set(5, 10, 'neon-red')
      set(6, 10, 'neon-red')
      set(8, 10, 'neon-red')
      break
  }
  return g
}
