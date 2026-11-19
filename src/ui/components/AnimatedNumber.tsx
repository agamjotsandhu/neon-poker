import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { DUR, EASE } from '../motion'

/** Tweens between numeric values (chip counts). */
export function AnimatedNumber({
  value,
  delay = 0,
  format = (n: number) => n.toLocaleString(),
}: {
  value: number
  delay?: number
  format?: (n: number) => string
}) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) {
      from.current = value
      const id = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(id)
    }
    const controls = animate(from.current, value, {
      duration: DUR.number,
      delay,
      ease: EASE.out,
      onUpdate: (v) => setShown(Math.round(v)),
    })
    from.current = value
    return () => controls.stop()
  }, [value, delay, reduce])
  return <>{format(shown)}</>
}
