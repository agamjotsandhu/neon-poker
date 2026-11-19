import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { drawOverlay, makeDrops, renderCity, type CityLayout } from '../art/city'

/** Full-screen procedural pixel city with animated rain (static when reduced motion is on). */
export function CityBackdrop({ dim = 0 }: { dim?: number }) {
  const baseRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.05,
  )

  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth * 1.05)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const base = baseRef.current
    const fx = fxRef.current
    if (!base || !fx) return
    const w = portrait ? 200 : 400
    const h = portrait ? 380 : 225
    base.width = fx.width = w
    base.height = fx.height = h
    const bctx = base.getContext('2d')
    const fctx = fx.getContext('2d')
    if (!bctx || !fctx) return
    let layout: CityLayout
    try {
      layout = renderCity(bctx, w, h, 11)
    } catch {
      return
    }
    const drops = makeDrops(w, h, Math.round((w * h) / 520))
    let raf = 0
    let last = 0
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (t - last < 40 || document.hidden) return // ~25fps is plenty for pixel rain
      last = t
      drawOverlay(fctx, layout, drops, t, true)
    }
    if (reduce) drawOverlay(fctx, layout, drops, 0, false)
    else raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [portrait, reduce])

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night-950"
      aria-hidden
    >
      <canvas ref={baseRef} className="pixelated absolute inset-0 h-full w-full object-cover" />
      <canvas ref={fxRef} className="pixelated absolute inset-0 h-full w-full object-cover" />
      {/* vignette + scanlines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-night-950)_100%)] opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night-950/80 to-transparent" />
      <div className="scanlines absolute inset-0 opacity-60" />
      {dim > 0 && <div className="absolute inset-0 bg-night-950" style={{ opacity: dim }} />}
    </div>
  )
}
