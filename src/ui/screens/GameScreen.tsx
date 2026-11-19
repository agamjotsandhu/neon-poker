import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { BLIND_LEVELS, useGame } from '../../store/gameStore'
import { ActionBar } from '../components/ActionBar'
import { CoachPanel, CoachSheet, ModeToggle } from '../components/CoachPanel'
import { HandHistory, ReplayOverlay } from '../components/HandHistory'
import { HandSummary } from '../components/HandSummary'
import { PixelIcon, type IconName } from '../components/PixelIcon'
import { SettingsDialog } from '../components/SettingsDialog'
import { Table } from '../components/Table'
import { Logo } from './Logo'

function useWide() {
  const q = '(min-width: 1100px)'
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

function IconButton({ icon, label, onClick, active }: { icon: IconName; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'grid h-9 w-9 place-items-center rounded-pixel ring-1 transition',
        active === false ? 'bg-night-900/80 text-haze-400 ring-haze-400/20' : 'bg-night-800/80 text-haze-200 ring-haze-400/25 hover:bg-night-700 hover:text-haze-100',
      )}
    >
      <PixelIcon name={icon} size={16} />
    </button>
  )
}

function TopBar({ wide }: { wide: boolean }) {
  const game = useGame((s) => s.game)
  const settings = useGame((s) => s.settings)
  const toggleSound = useGame((s) => s.toggleSound)
  const setHistoryOpen = useGame((s) => s.setHistoryOpen)
  const setSettingsOpen = useGame((s) => s.setSettingsOpen)
  const setMode = useGame((s) => s.setMode)
  const leave = useGame((s) => s.leaveGame)
  const blinds = BLIND_LEVELS[settings.blindsIndex]
  return (
    <header className="relative z-30 flex items-center gap-3 px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2 sm:px-4">
      <button onClick={leave} className="shrink-0" aria-label="Back to lobby">
        <Logo size={wide ? 'sm' : 'xs'} />
      </button>
      <div className="hidden items-center gap-3 font-display text-xs text-haze-300 sm:flex">
        <span className="rounded-pixel bg-night-900/70 px-2 py-1 ring-1 ring-haze-400/15">
          HAND <b className="num text-haze-100">#{game?.handNumber ?? 0}</b>
        </span>
        <span className="rounded-pixel bg-night-900/70 px-2 py-1 ring-1 ring-haze-400/15">
          BLINDS <b className="num text-haze-100">{blinds.sb}/{blinds.bb}</b>
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {!wide && <ModeToggle mode={settings.mode} onChange={setMode} small />}
        <IconButton icon="history" label="Hand history" onClick={() => setHistoryOpen(true)} />
        <IconButton icon={settings.sound ? 'soundOn' : 'soundOff'} label={settings.sound ? 'Mute sound' : 'Unmute sound'} onClick={toggleSound} active={settings.sound} />
        <IconButton icon="gear" label="Settings" onClick={() => setSettingsOpen(true)} />
        <IconButton icon="exit" label="Leave table" onClick={leave} />
      </div>
    </header>
  )
}

export function GameScreen() {
  const game = useGame((s) => s.game)
  const heroIndex = useGame((s) => s.heroIndex)
  const seatMeta = useGame((s) => s.seatMeta)
  const thinkingId = useGame((s) => s.thinkingId)
  const heroTurn = useGame((s) => s.heroTurn)
  const handKey = useGame((s) => s.handKey)
  const wide = useWide()

  return (
    <div className="flex h-full flex-col">
      <TopBar wide={wide} />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1" aria-label="Poker table">
          {game && <Table state={game} heroIndex={heroIndex} seatMeta={seatMeta} thinkingId={thinkingId} heroTurn={heroTurn} handKey={handKey} />}
          {!wide && <CoachSheet />}
        </main>
        {wide && <CoachPanel />}
      </div>
      <ActionBar />
      <HandSummary />
      <HandHistory />
      <ReplayOverlay />
      <SettingsDialog inGame />
    </div>
  )
}
