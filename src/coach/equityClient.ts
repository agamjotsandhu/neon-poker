import { monteCarloEquity, type EquityRequest, type EquityResult } from './equity'

/**
 * Runs Monte Carlo equity in a Web Worker so the UI never stutters.
 * Falls back to the main thread where Workers are unavailable (tests, SSR).
 */
let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (r: EquityResult) => void>()

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('./equity.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<{ id: number; result: EquityResult }>) => {
      const cb = pending.get(ev.data.id)
      pending.delete(ev.data.id)
      cb?.(ev.data.result)
    }
    worker.onerror = () => {
      worker = null
    }
  } catch {
    worker = null
  }
  return worker
}

export function computeEquity(req: EquityRequest): Promise<EquityResult> {
  const w = getWorker()
  if (!w) return Promise.resolve(monteCarloEquity(req))
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    w.postMessage({ id, req })
  })
}
