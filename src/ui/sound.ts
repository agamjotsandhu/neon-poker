import { Howler } from 'howler'

/**
 * Tiny Web Audio synth for game sounds (no audio files). Everything is routed
 * through Howler's master gain so Howler.mute() is the single mute switch.
 */
type SoundName = 'deal' | 'chip' | 'flip' | 'win' | 'fold' | 'tick' | 'shuffle' | 'alert'

let noiseBuf: AudioBuffer | null = null

function ctx(): { ac: AudioContext; out: AudioNode } | null {
  try {
    if (!Howler.ctx) Howler.volume(Howler.volume()) // forces Howler to set up its AudioContext
    const ac = Howler.ctx
    if (!ac) return null
    if (ac.state === 'suspended') void ac.resume()
    return { ac, out: Howler.masterGain ?? ac.destination }
  } catch {
    return null
  }
}

function noise(ac: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf
  const len = Math.floor(ac.sampleRate * 0.5)
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate)
  const d = noiseBuf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noiseBuf
}

function burst(
  ac: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  freq: number,
  q: number,
  gain: number,
  type: BiquadFilterType = 'bandpass',
) {
  const src = ac.createBufferSource()
  src.buffer = noise(ac)
  const f = ac.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur + 0.02)
}

function tone(
  ac: AudioContext,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  gain: number,
  type: OscillatorType = 'square',
  slideTo?: number,
) {
  const o = ac.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
}

let enabled = true
export function setSoundEnabled(on: boolean) {
  enabled = on
  try {
    Howler.mute(!on)
  } catch {
    /* ignore */
  }
}

export function play(name: SoundName, delaySec = 0) {
  if (!enabled) return
  const c = ctx()
  if (!c) return
  const { ac, out } = c
  const t = ac.currentTime + delaySec
  switch (name) {
    case 'deal':
      burst(ac, out, t, 0.07, 3200, 1.2, 0.22, 'highpass')
      burst(ac, out, t + 0.01, 0.05, 1800, 2, 0.12)
      break
    case 'shuffle':
      for (let i = 0; i < 9; i++)
        burst(ac, out, t + i * 0.07, 0.05, 2600 + i * 90, 1.4, 0.12, 'highpass')
      break
    case 'flip':
      burst(ac, out, t, 0.09, 2400, 0.8, 0.18)
      tone(ac, out, t, 900, 0.04, 0.03, 'triangle', 1400)
      break
    case 'chip':
      tone(ac, out, t, 2200, 0.05, 0.06, 'triangle')
      tone(ac, out, t + 0.045, 2900, 0.05, 0.05, 'triangle')
      burst(ac, out, t, 0.03, 5000, 3, 0.08)
      break
    case 'fold':
      burst(ac, out, t, 0.18, 900, 0.7, 0.12, 'lowpass')
      break
    case 'tick':
      tone(ac, out, t, 1200, 0.03, 0.03, 'square')
      break
    case 'alert':
      tone(ac, out, t, 660, 0.09, 0.05, 'square')
      tone(ac, out, t + 0.1, 990, 0.12, 0.05, 'square')
      break
    case 'win': {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
      notes.forEach((f, i) => tone(ac, out, t + i * 0.085, f, 0.22, 0.07, 'square'))
      tone(ac, out, t + 0.45, 1567.98, 0.5, 0.05, 'triangle')
      break
    }
  }
}
