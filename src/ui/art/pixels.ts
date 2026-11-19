/** Tiny bitmap helpers for drawing pixel art as SVG rects (merged per horizontal run). */
export type Bitmap = string[]

export interface Run {
  x: number
  y: number
  w: number
}

export function bitmapRuns(bm: Bitmap, on = 'X'): Run[] {
  const runs: Run[] = []
  bm.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] === on) {
        let w = 1
        while (row[x + w] === on) w++
        runs.push({ x, y, w })
        x += w
      } else x++
    }
  })
  return runs
}

export const SUIT_BITMAPS: Record<'c' | 'd' | 'h' | 's', Bitmap> = {
  h: [
    '.XX...XX.',
    'XXXX.XXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  d: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  s: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XX.X.XX.',
    '....X....',
    '...XXX...',
  ],
  c: [
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    'XX.XXX.XX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XX..X..XX',
    '....X....',
    '...XXX...',
  ],
}

/** Original 5×7 pixel glyphs for card ranks (10 is 7 wide). */
export const RANK_BITMAPS: Record<string, Bitmap> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  '2': ['.XXX.', 'X...X', '....X', '..XX.', '.X...', 'X....', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
  T: ['.X..XX.', 'XX.X..X', '.X.X..X', '.X.X..X', '.X.X..X', '.X.X..X', 'XXX.XX.'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
}
