import { bitmapRuns, type Bitmap } from '../art/pixels'

const ICONS = {
  soundOn: ['....X....', '...XX..X.', 'XXXXX.X.X', 'XXXXX.X.X', 'XXXXX.X.X', 'XXXXX.X.X', '...XX..X.', '....X....', '.........'],
  soundOff: ['....X....', '...XX....', 'XXXXX.X.X', 'XXXXX..X.', 'XXXXX.X.X', 'XXXXX....', '...XX....', '....X....', '.........'],
  history: ['XXXXXXX..', 'X.....X..', 'X.XXX.X..', 'X.....X..', 'X.XXX.X..', 'X.....X..', 'X.XX..X..', 'X.....X..', 'XXXXXXX..'],
  gear: ['...X.X...', '.XXXXXXX.', '.XX...XX.', 'XX.....XX', '.X..X..X.', 'XX.....XX', '.XX...XX.', '.XXXXXXX.', '...X.X...'],
  exit: ['XXXXX....', 'X...X....', 'X...X..X.', 'X...XXXXX', 'X...X..X.', 'X...X....', 'X...X....', 'XXXXX....', '.........'],
  play: ['XX.......', 'XXXX.....', 'XXXXXX...', 'XXXXXXXX.', 'XXXXXXXXX', 'XXXXXXXX.', 'XXXXXX...', 'XXXX.....', 'XX.......'],
  pause: ['XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.', 'XXX..XXX.'],
  prev: ['X......X.', 'X.....XX.', 'X....XXX.', 'X...XXXX.', 'X..XXXXX.', 'X...XXXX.', 'X....XXX.', 'X.....XX.', 'X......X.'],
  next: ['.X......X', '.XX.....X', '.XXX....X', '.XXXX...X', '.XXXXX..X', '.XXXX...X', '.XXX....X', '.XX.....X', '.X......X'],
  close: ['X.......X', '.X.....X.', '..X...X..', '...X.X...', '....X....', '...X.X...', '..X...X..', '.X.....X.', 'X.......X'],
  replay: ['..XXXXX..', '.X.....X.', 'X.......X', 'X..X....X', 'X..XX...X', 'X..XXX..X', 'XX.XX....', 'XXXX...X.', 'XXX.XXX..'],
  book: ['XXXX.XXXX', 'X..X.X..X', 'X.XX.XX.X', 'X..X.X..X', 'X.XX.XX.X', 'X..X.X..X', 'X..X.X..X', 'XXXXXXXXX', '.........'],
} satisfies Record<string, Bitmap>

export type IconName = keyof typeof ICONS
const RUNS = Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, bitmapRuns(v)])) as Record<IconName, ReturnType<typeof bitmapRuns>>

export function PixelIcon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 9 9" shapeRendering="crispEdges" className={className} aria-hidden fill="currentColor">
      {RUNS[name].map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  )
}
