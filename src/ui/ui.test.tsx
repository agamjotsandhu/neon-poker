import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseRange } from '../coach/ranges'
import { parseCards } from '../engine/cards'
import { chipColumns } from './art/chips'
import { buildAvatar } from './art/avatar'
import { Card } from './components/Card'
import { RangeGrid } from './components/RangeGrid'
import { computeGeometry, SEAT_MAP } from './geometry'

describe('RangeGrid', () => {
  it('renders 169 cells and marks the hero hand', () => {
    render(<RangeGrid raise={parseRange('AA,KK,AKs')} call={parseRange('QQ')} hero="AKs" />)
    expect(screen.getAllByRole('gridcell')).toHaveLength(169)
    expect(screen.getByLabelText('AKs raise (your hand)')).toBeInTheDocument()
    expect(screen.getByLabelText('QQ call')).toBeInTheDocument()
  })
})

describe('Card', () => {
  it('labels face-up and face-down cards for screen readers', () => {
    const [c] = parseCards('Qh')
    const { rerender } = render(<Card card={c} faceUp width={50} />)
    expect(screen.getByRole('img', { name: 'Qh' })).toBeInTheDocument()
    rerender(<Card card={c} faceUp={false} width={50} />)
    expect(screen.getByRole('img', { name: 'face-down card' })).toBeInTheDocument()
  })
})

describe('art helpers', () => {
  it('breaks chip amounts into denominations', () => {
    const cols = chipColumns(135, 10)
    const chips = cols.flat()
    // bb = 10 → 135 = 2 × 50 (blue) + 3 × 10 (red) + 1 × 5 (white)
    expect(chips.filter((c) => c.color === 'chip-blue')).toHaveLength(2)
    expect(chips.filter((c) => c.color === 'chip-red')).toHaveLength(3)
    expect(chips.filter((c) => c.color === 'chip-white')).toHaveLength(1)
  })
  it('caps very large stacks for display', () => {
    expect(chipColumns(10_000_000, 1).flat().length).toBeLessThanOrEqual(18)
  })
  it('builds a 16×16 avatar', () => {
    const g = buildAvatar({
      skin: 1,
      hair: 'pink',
      style: 'mohawk',
      accessory: 'shades',
      outfit: 'cyan',
    })
    expect(g).toHaveLength(16)
    expect(g.every((r) => r.length === 16)).toBe(true)
  })
})

describe('table geometry', () => {
  it('keeps every seat inside the stage at desktop and phone sizes', () => {
    for (const [w, h] of [
      [1050, 760],
      [390, 640],
      [820, 980],
    ]) {
      const g = computeGeometry(w, h)
      for (const s of g.seats) {
        expect(s.x).toBeGreaterThanOrEqual(0)
        expect(s.x).toBeLessThanOrEqual(w)
        expect(s.y).toBeGreaterThanOrEqual(0)
        expect(s.y).toBeLessThanOrEqual(h)
      }
      expect(g.portrait).toBe(h > w * 1.05)
    }
  })
  it('maps 2–6 players onto distinct seats with the hero at the bottom', () => {
    for (let n = 2; n <= 6; n++) {
      expect(SEAT_MAP[n]).toHaveLength(n)
      expect(SEAT_MAP[n][0]).toBe(0)
      expect(new Set(SEAT_MAP[n]).size).toBe(n)
    }
  })
})
