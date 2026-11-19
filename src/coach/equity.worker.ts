/// <reference lib="webworker" />
import { monteCarloEquity, type EquityRequest } from './equity'

interface Msg {
  id: number
  req: EquityRequest
}

self.onmessage = (ev: MessageEvent<Msg>) => {
  const { id, req } = ev.data
  const result = monteCarloEquity(req)
  ;(self as unknown as Worker).postMessage({ id, result })
}
