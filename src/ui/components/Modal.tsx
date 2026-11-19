import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { DUR, EASE } from '../motion'
import { PixelIcon } from './PixelIcon'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  wide,
}: {
  open: boolean
  onClose?: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
  wide?: boolean
}) {
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fade }}
        >
          <div className="fixed inset-0 bg-night-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: DUR.panel, ease: EASE.out }}
            className={clsx(
              'glass relative w-full rounded-panel p-5 shadow-panel ring-1 ring-neon-pink/40 sm:p-6',
              wide ? 'max-w-3xl' : 'max-w-lg',
              className,
            )}
          >
            {(title || onClose) && (
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="font-display text-2xl font-bold leading-tight text-haze-100 text-glow-pink">
                  {title}
                </div>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="rounded-pixel p-1.5 text-haze-300 hover:bg-night-700 hover:text-haze-100"
                    aria-label="Close"
                  >
                    <PixelIcon name="close" size={14} />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function NeonButton({
  children,
  onClick,
  tone = 'pink',
  className,
  autoFocus,
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'pink' | 'cyan' | 'ghost' | 'lime'
  className?: string
  autoFocus?: boolean
  size?: 'md' | 'lg'
}) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: DUR.hover }}
      autoFocus={autoFocus}
      onClick={onClick}
      className={clsx(
        'pixel-corners font-display font-bold tracking-wider ring-2 ring-inset transition-[filter,background-color]',
        size === 'lg' ? 'px-8 py-3.5 text-lg' : 'px-5 py-2.5 text-sm',
        tone === 'pink' && 'bg-neon-pink text-night-950 ring-neon-pink hover:brightness-110',
        tone === 'cyan' && 'bg-neon-teal text-night-950 ring-neon-cyan hover:brightness-110',
        tone === 'lime' && 'bg-neon-lime text-night-950 ring-neon-lime hover:brightness-110',
        tone === 'ghost' && 'bg-night-800/80 text-haze-100 ring-haze-400/40 hover:bg-night-700',
        className,
      )}
    >
      {children}
    </motion.button>
  )
}
