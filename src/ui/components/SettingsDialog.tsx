import clsx from 'clsx'
import type { ReactNode } from 'react'
import { BLIND_LEVELS, useGame, type Speed } from '../../store/gameStore'
import { ModeToggle } from './CoachPanel'
import { Modal, NeonButton } from './Modal'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-display text-sm text-haze-100">{label}</div>
        {hint && <div className="text-xs text-haze-400">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={clsx(
            'min-w-10 rounded-pixel px-2.5 py-1.5 font-display text-xs ring-1 transition',
            value === o.v ? 'bg-neon-pink text-night-950 ring-neon-pink' : 'bg-night-800 text-haze-200 ring-haze-400/25 hover:bg-night-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Table settings. Changes to bots / stacks / blinds apply when a new game starts. */
export function SettingsDialog({ inGame }: { inGame?: boolean }) {
  const open = useGame((s) => s.settingsOpen)
  const setOpen = useGame((s) => s.setSettingsOpen)
  const settings = useGame((s) => s.settings)
  const update = useGame((s) => s.updateSettings)
  const resetStats = useGame((s) => s.resetStats)
  const startGame = useGame((s) => s.startGame)

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Settings">
      <div className="divide-y divide-haze-400/10">
        <Row label="Opponents" hint="Bots at the table">
          <Segmented label="Opponents" value={settings.bots} options={[1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) }))} onChange={(bots) => update({ bots })} />
        </Row>
        <Row label="Starting stack" hint="In big blinds">
          <Segmented
            label="Starting stack"
            value={settings.startingStackBB}
            options={[20, 50, 100, 200].map((v) => ({ v, label: `${v} BB` }))}
            onChange={(startingStackBB) => update({ startingStackBB })}
          />
        </Row>
        <Row label="Blinds">
          <Segmented
            label="Blinds"
            value={settings.blindsIndex}
            options={BLIND_LEVELS.map((b, i) => ({ v: i, label: `${b.sb}/${b.bb}` }))}
            onChange={(blindsIndex) => update({ blindsIndex })}
          />
        </Row>
        <Row label="Game speed" hint="Bot thinking & pacing">
          <Segmented<Speed>
            label="Game speed"
            value={settings.speed}
            options={[
              { v: 'relaxed', label: 'Relaxed' },
              { v: 'normal', label: 'Normal' },
              { v: 'fast', label: 'Fast' },
            ]}
            onChange={(speed) => update({ speed })}
          />
        </Row>
        <Row label="Sound" hint="Synthesised chiptune effects">
          <Segmented label="Sound" value={settings.sound ? 'on' : 'off'} options={[{ v: 'on', label: 'On' }, { v: 'off', label: 'Off' }]} onChange={(v) => update({ sound: v === 'on' })} />
        </Row>
        <Row label="Coaching" hint="Coach: advice before you act. Quiz: act first, then get graded.">
          <ModeToggle mode={settings.mode} onChange={(mode) => update({ mode })} />
        </Row>
        <Row label="Session stats" hint="Saved on this device">
          <button onClick={resetStats} className="rounded-pixel bg-night-800 px-3 py-1.5 font-display text-xs text-neon-red ring-1 ring-neon-red/40 hover:bg-night-700">
            RESET STATS
          </button>
        </Row>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {inGame ? (
          <>
            <NeonButton
              onClick={() => {
                setOpen(false)
                startGame()
              }}
            >
              NEW GAME WITH THESE SETTINGS
            </NeonButton>
            <NeonButton tone="ghost" onClick={() => setOpen(false)}>
              DONE
            </NeonButton>
          </>
        ) : (
          <NeonButton onClick={() => setOpen(false)}>DONE</NeonButton>
        )}
      </div>
    </Modal>
  )
}
