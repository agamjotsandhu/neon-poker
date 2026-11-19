import { memo } from 'react'
import type { AvatarSpec } from '../../bots/personalities'
import { buildAvatar } from '../art/avatar'
import { token } from '../palette'

const cache = new Map<string, { y: number; x: number; w: number; c: string }[]>()
function runsFor(spec: AvatarSpec) {
  const key = JSON.stringify(spec)
  if (cache.has(key)) return cache.get(key)!
  const g = buildAvatar(spec)
  const runs: { y: number; x: number; w: number; c: string }[] = []
  g.forEach((row, y) => {
    let x = 0
    while (x < 16) {
      const c = row[x]
      if (c) {
        let w = 1
        while (row[x + w] === c) w++
        runs.push({ y, x, w, c })
        x += w
      } else x++
    }
  })
  cache.set(key, runs)
  return runs
}

/** Original procedural pixel-art portrait. */
export const PixelAvatar = memo(function PixelAvatar({
  spec,
  size,
}: {
  spec: AvatarSpec
  size: number
}) {
  const runs = runsFor(spec)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden
      className="block"
    >
      {runs.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={token(r.c)} />
      ))}
    </svg>
  )
})
