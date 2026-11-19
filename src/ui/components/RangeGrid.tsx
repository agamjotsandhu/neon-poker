import clsx from 'clsx'
import { gridClass, type HandClass } from '../../coach/ranges'

/** 13×13 starting-hand chart. Suited upper-right, offsuit lower-left, pairs on the diagonal. */
export function RangeGrid({ raise, call, hero }: { raise: Set<HandClass>; call: Set<HandClass>; hero?: HandClass }) {
  return (
    <div className="grid grid-cols-13 gap-px rounded-pixel bg-night-950 p-px ring-1 ring-haze-400/20" role="grid" aria-label="Starting hand chart">
      {Array.from({ length: 169 }, (_, i) => {
        const r = Math.floor(i / 13)
        const c = i % 13
        const hc = gridClass(r, c)
        const isHero = hc === hero
        const inRaise = raise.has(hc)
        const inCall = call.has(hc)
        return (
          <div
            key={hc}
            role="gridcell"
            aria-label={`${hc}${inRaise ? ' raise' : inCall ? ' call' : ''}${isHero ? ' (your hand)' : ''}`}
            className={clsx(
              'num relative grid aspect-square place-items-center text-[7px] leading-none sm:text-[8px]',
              inRaise ? 'bg-neon-magenta/80 text-haze-100' : inCall ? 'bg-neon-teal/60 text-night-950' : r === c ? 'bg-night-700 text-haze-400' : 'bg-night-800 text-haze-400/70',
              isHero && 'z-10 scale-[1.35] rounded-[2px] !bg-neon-amber !text-night-950 shadow-neon-amber',
            )}
          >
            {hc.length === 3 ? hc.slice(0, 2) : hc}
          </div>
        )
      })}
    </div>
  )
}
