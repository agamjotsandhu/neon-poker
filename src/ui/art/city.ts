/**
 * Procedural neon-noir pixel city (original art, generated at runtime).
 * Rendered at low resolution and scaled up with `image-rendering: pixelated`.
 */
import { createRng } from '../../engine/rng'
import { rgbOf } from '../palette'

type RGB = [number, number, number]

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16))

const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export interface CityLayout {
  w: number
  h: number
  horizon: number
  /** Antenna lights that blink (x, y). */
  beacons: [number, number][]
  /** Stars that twinkle. */
  stars: [number, number][]
  /** Neon signs that flicker: x, y, w, h, colour. */
  signs: { x: number; y: number; w: number; h: number; color: RGB }[]
}

export function renderCity(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7): CityLayout {
  const rng = createRng(seed)
  const img = ctx.createImageData(w, h)
  const d = img.data
  const portrait = h > w
  const horizon = Math.round(h * (portrait ? 0.6 : 0.64))

  const C = {
    skyTop: rgbOf('sky-top'),
    skyMid: rgbOf('sky-mid'),
    skyGlow: rgbOf('sky-glow'),
    far: rgbOf('building-far'),
    mid: rgbOf('building-mid'),
    near: rgbOf('building-near'),
    warm: rgbOf('window-warm'),
    cool: rgbOf('window-cool'),
    pink: rgbOf('window-pink'),
    neonPink: rgbOf('neon-pink'),
    neonCyan: rgbOf('neon-cyan'),
    amber: rgbOf('neon-amber'),
    red: rgbOf('neon-red'),
    star: rgbOf('haze-200'),
    deep: rgbOf('night-950'),
    moon: rgbOf('haze-100'),
  }

  const put = (x: number, y: number, c: RGB, a = 1) => {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    d[i] = d[i] * (1 - a) + c[0] * a
    d[i + 1] = d[i + 1] * (1 - a) + c[1] * a
    d[i + 2] = d[i + 2] * (1 - a) + c[2] * a
    d[i + 3] = 255
  }
  const rect = (x: number, y: number, rw: number, rh: number, c: RGB, a = 1) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) put(xx, yy, c, a)
  }

  // 1. Sky: dithered vertical gradient
  const bands: RGB[] = [C.skyTop, lerp(C.skyTop, C.skyMid, 0.5), C.skyMid, lerp(C.skyMid, C.skyGlow, 0.5), C.skyGlow]
  for (let y = 0; y < horizon; y++) {
    const t = Math.pow(y / horizon, 1.15) * (bands.length - 1)
    for (let x = 0; x < w; x++) {
      const idx = Math.min(bands.length - 1, Math.floor(t + BAYER4[y & 3][x & 3] - 0.5 + 0.5))
      put(x, y, bands[Math.max(0, idx)])
    }
  }

  // 2. Stars
  const stars: [number, number][] = []
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = Math.floor(rng() * w)
    const y = Math.floor(rng() * horizon * 0.5)
    put(x, y, C.star, 0.5 + rng() * 0.5)
    if (rng() < 0.3) stars.push([x, y])
  }

  // 3. Moon with dithered halo + cloud bands
  const mx = Math.round(w * (portrait ? 0.72 : 0.8))
  const my = Math.round(h * 0.16)
  const mr = Math.round(Math.min(w, h) * 0.07)
  for (let y = my - mr * 3; y <= my + mr * 3; y++) {
    for (let x = mx - mr * 3; x <= mx + mr * 3; x++) {
      const dist = Math.hypot(x - mx, y - my)
      if (dist <= mr) put(x, y, lerp(C.moon, C.neonPink, 0.18 + ((y - my) / mr) * 0.12))
      else if (dist < mr * 3) {
        const a = (1 - (dist - mr) / (mr * 2)) * 0.35
        if (BAYER4[y & 3][x & 3] < a * 1.6) put(x, y, C.neonPink, 0.25)
      }
    }
  }
  for (let k = 0; k < 4; k++) {
    const cy = Math.round(h * (0.12 + k * 0.07) + rng() * 6)
    const cx = Math.round(rng() * w)
    const cw = Math.round(w * (0.25 + rng() * 0.3))
    for (let x = cx - cw / 2; x < cx + cw / 2; x++) {
      const thick = 1 + ((Math.sin(x * 0.3 + k) + 1) * 1.2) | 0
      for (let t = 0; t < thick; t++) put(x, cy + t, lerp(C.skyMid, C.skyGlow, 0.35), 0.75)
    }
  }

  const beacons: [number, number][] = []
  const signs: CityLayout['signs'] = []

  // 4. Building layers
  const layer = (base: RGB, minH: number, maxH: number, minW: number, maxW: number, windowP: number, windowA: number, signP: number) => {
    let x = -Math.floor(rng() * 8)
    while (x < w) {
      const bw = Math.floor(minW + rng() * (maxW - minW))
      const bh = Math.floor(minH + rng() * (maxH - minH))
      const top = horizon - bh
      rect(x, top, bw, bh, base)
      // rooftop details
      if (rng() < 0.45) rect(x + 2, top - 2, Math.max(2, bw - 4), 2, base)
      if (rng() < 0.35) {
        const ax = x + Math.floor(bw / 2)
        const ah = 3 + Math.floor(rng() * 6)
        rect(ax, top - ah, 1, ah, base)
        put(ax, top - ah - 1, C.red)
        beacons.push([ax, top - ah - 1])
      }
      // edge highlight from the moon / neon
      rect(x + bw - 1, top, 1, bh, lerp(base, C.skyGlow, 0.25))
      // windows
      const gx = 2 + Math.floor(rng() * 2)
      const gy = 2 + Math.floor(rng() * 2)
      const palette = [C.warm, C.warm, C.cool, C.pink]
      for (let wy = top + 2; wy < horizon - 2; wy += gy) {
        for (let wx = x + 1; wx < x + bw - 1; wx += gx) {
          if (rng() < windowP) put(wx, wy, palette[Math.floor(rng() * palette.length)], windowA * (0.5 + rng() * 0.5))
        }
      }
      // vertical neon sign
      if (rng() < signP && bh > 24) {
        const sw = 4 + Math.floor(rng() * 2)
        const sh = Math.min(bh - 8, 14 + Math.floor(rng() * 16))
        const sx = rng() < 0.5 ? x - 1 : x + bw - sw + 1
        const sy = top + 4 + Math.floor(rng() * 6)
        const col = rng() < 0.6 ? C.neonPink : C.neonCyan
        rect(sx, sy, sw, sh, C.deep)
        for (let yy = sy; yy < sy + sh; yy++) {
          put(sx, yy, col)
          put(sx + sw - 1, yy, col)
        }
        for (let xx = sx; xx < sx + sw; xx++) {
          put(xx, sy, col)
          put(xx, sy + sh - 1, col)
        }
        for (let yy = sy + 2; yy < sy + sh - 2; yy += 2) {
          for (let xx = sx + 1; xx < sx + sw - 1; xx++) if (rng() < 0.55) put(xx, yy, col, 0.9)
        }
        // glow halo
        for (let yy = sy - 3; yy < sy + sh + 3; yy++)
          for (let xx = sx - 3; xx < sx + sw + 3; xx++)
            if (BAYER4[yy & 3][xx & 3] < 0.22) put(xx, yy, col, 0.35)
        signs.push({ x: sx, y: sy, w: sw, h: sh, color: col })
      }
      x += bw + Math.floor(rng() * 3)
    }
  }
  const H0 = horizon
  layer(C.far, H0 * 0.2, H0 * 0.55, 8, 20, 0.12, 0.45, 0)
  layer(C.mid, H0 * 0.15, H0 * 0.42, 10, 24, 0.28, 0.8, 0.35)

  // Near framing buildings (left + right), like a street receding into the city
  const nearW = Math.round(w * (portrait ? 0.2 : 0.13))
  const frame = (x0: number, dir: 1 | -1) => {
    const top = Math.round(h * 0.12)
    rect(x0, top, nearW, horizon - top, C.near)
    for (let wy = top + 4; wy < horizon - 3; wy += 5) {
      for (let k = 0; k < nearW - 4; k += 4) {
        const wx = x0 + 2 + k
        if (rng() < 0.55) {
          const col = rng() < 0.7 ? C.warm : C.pink
          rect(wx, wy, 2, 3, col, 0.65 + rng() * 0.3)
        }
      }
    }
    // balcony lines
    for (let wy = top + 8; wy < horizon; wy += 10) rect(x0, wy, nearW, 1, lerp(C.near, C.skyGlow, 0.3))
    // big neon sign hanging off the building
    const sx = dir === 1 ? x0 + nearW - 2 : x0 - 5
    const sy = top + Math.round((horizon - top) * 0.35)
    const sh = Math.round((horizon - top) * 0.32)
    const col = dir === 1 ? C.neonPink : C.neonCyan
    rect(sx, sy, 7, sh, C.deep)
    for (let yy = sy; yy < sy + sh; yy++) {
      put(sx, yy, col)
      put(sx + 6, yy, col)
    }
    rect(sx, sy, 7, 1, col)
    rect(sx, sy + sh - 1, 7, 1, col)
    for (let yy = sy + 2; yy < sy + sh - 3; yy += 4) {
      rect(sx + 2, yy, 3, 1, col)
      if (rng() < 0.7) put(sx + 2 + Math.floor(rng() * 3), yy + 1, col)
      if (rng() < 0.7) put(sx + 2 + Math.floor(rng() * 3), yy + 2, col)
    }
    for (let yy = sy - 4; yy < sy + sh + 4; yy++)
      for (let xx = sx - 4; xx < sx + 11; xx++) if (BAYER4[yy & 3][xx & 3] < 0.25) put(xx, yy, col, 0.3)
    signs.push({ x: sx, y: sy, w: 7, h: sh, color: col })
  }
  frame(0, 1)
  frame(w - nearW, -1)

  // Street lamps along the horizon
  for (let k = 0; k < 5; k++) {
    const lx = Math.round(w * (0.22 + k * 0.14) + (rng() - 0.5) * 6)
    const lh = Math.round(h * 0.09)
    rect(lx, horizon - lh, 1, lh, C.near)
    rect(lx - 2, horizon - lh, 3, 1, C.near)
    put(lx - 2, horizon - lh + 1, C.amber)
    for (let yy = -3; yy <= 3; yy++)
      for (let xx = -3; xx <= 3; xx++)
        if (Math.hypot(xx, yy) < 3.5 && BAYER4[(horizon - lh + yy) & 3][(lx + xx) & 3] < 0.4)
          put(lx - 2 + xx, horizon - lh + 1 + yy, C.amber, 0.35)
  }

  // Horizon haze
  for (let y = horizon - 6; y < horizon; y++)
    for (let x = 0; x < w; x++) if (BAYER4[y & 3][x & 3] < (y - (horizon - 6)) / 10) put(x, y, C.skyGlow, 0.35)

  // 5. Wet street: mirrored, rippled, darkened reflection
  for (let y = horizon; y < h; y++) {
    const dy = y - horizon
    const srcY = horizon - 1 - Math.floor(dy * 0.9)
    const ripple = Math.round(Math.sin(dy * 0.55) * (1 + dy * 0.04) + Math.sin(dy * 1.7) * 0.6)
    const fade = 0.42 + Math.min(0.45, dy / (h - horizon)) * 0.6
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.max(0, x + ripple))
      const si = (Math.max(0, srcY) * w + sx) * 4
      const c: RGB = [d[si], d[si + 1], d[si + 2]]
      const darkened = lerp(c, C.deep, fade)
      put(x, y, darkened)
    }
    // horizontal wet sheen lines
    if (dy % 7 === 3) for (let x = 0; x < w; x++) if (BAYER4[y & 3][x & 3] < 0.3) put(x, y, C.skyGlow, 0.18)
  }
  // Brighten reflected neon streaks (vertical smears under bright pixels)
  for (let y = horizon + 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = d[i] + d[i + 1] + d[i + 2]
      if (lum > 260 && rng() < 0.5) {
        const len = 1 + Math.floor(rng() * 3)
        for (let k = 1; k <= len; k++) put(x, y + k, [d[i], d[i + 1], d[i + 2]], 0.5)
      }
    }
  }

  ctx.putImageData(img, 0, 0)
  return { w, h, horizon, beacons, stars, signs }
}

export interface Drop {
  x: number
  y: number
  len: number
  speed: number
}

export function makeDrops(w: number, h: number, n: number, seed = 3): Drop[] {
  const rng = createRng(seed)
  return Array.from({ length: n }, () => ({
    x: rng() * w * 1.2,
    y: rng() * h,
    len: 3 + Math.floor(rng() * 5),
    speed: 2.2 + rng() * 2.4,
  }))
}

/** Draw one frame of animated details (rain, splashes, blinking beacons, twinkling stars, sign flicker). */
export function drawOverlay(ctx: CanvasRenderingContext2D, layout: CityLayout, drops: Drop[], t: number, advance: boolean) {
  const { w, h, horizon } = layout
  ctx.clearRect(0, 0, w, h)
  const rain = rgbOf('rain')
  ctx.fillStyle = `rgba(${rain[0]},${rain[1]},${rain[2]},0.32)`
  for (const d of drops) {
    if (advance) {
      d.y += d.speed
      d.x -= d.speed * 0.25
      if (d.y > h) {
        d.y = -d.len
        d.x = Math.random() * w * 1.2
      }
    }
    for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(d.x - k * 0.25), Math.round(d.y - k), 1, 1)
  }
  // splashes on the wet street
  ctx.fillStyle = `rgba(${rain[0]},${rain[1]},${rain[2]},0.4)`
  const splashes = Math.floor(w / 24)
  for (let i = 0; i < splashes; i++) {
    const sx = Math.floor(((Math.sin(i * 91.7 + Math.floor(t / 180) * 13.1) + 1) / 2) * w)
    const sy = horizon + 4 + Math.floor(((Math.sin(i * 47.3 + Math.floor(t / 180) * 7.7) + 1) / 2) * (h - horizon - 6))
    if ((i + Math.floor(t / 90)) % 3 === 0) ctx.fillRect(sx - 1, sy, 3, 1)
  }
  // blinking beacons
  const red = rgbOf('neon-red')
  layout.beacons.forEach(([x, y], i) => {
    const on = Math.floor(t / 700 + i * 0.37) % 2 === 0
    if (on) {
      ctx.fillStyle = `rgba(${red[0]},${red[1]},${red[2]},0.9)`
      ctx.fillRect(x, y, 1, 1)
      ctx.fillStyle = `rgba(${red[0]},${red[1]},${red[2]},0.25)`
      ctx.fillRect(x - 1, y - 1, 3, 3)
    }
  })
  // twinkling stars
  const star = rgbOf('haze-100')
  layout.stars.forEach(([x, y], i) => {
    const a = (Math.sin(t / 600 + i * 1.7) + 1) / 2
    if (a > 0.7) {
      ctx.fillStyle = `rgba(${star[0]},${star[1]},${star[2]},${(a - 0.7) * 3})`
      ctx.fillRect(x, y, 1, 1)
    }
  })
  // occasional neon flicker: briefly darken one sign
  const flick = Math.floor(t / 150)
  if (layout.signs.length && flick % 37 < 2) {
    const s = layout.signs[Math.floor(flick / 37) % layout.signs.length]
    const deep = rgbOf('night-950')
    ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},0.55)`
    ctx.fillRect(s.x, s.y, s.w, s.h)
  }
}
