export interface Pt {
  x: number
  y: number
}

export interface Geometry {
  w: number
  h: number
  portrait: boolean
  compact: boolean
  table: { x: number; y: number; w: number; h: number }
  center: Pt
  /** Six visual seats clockwise from bottom-centre (0 = hero). */
  seats: Pt[]
  bets: Pt[]
  botCards: Pt[]
  buttons: Pt[]
  pot: Pt
  potLabel: Pt
  board: Pt[]
  muck: Pt
  heroCards: Pt[]
  cardW: number
  heroCardW: number
  botCardW: number
  avatar: number
}

/** Which visual seats are used for N players (players are clockwise from the hero). */
export const SEAT_MAP: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

export function computeGeometry(w: number, h: number): Geometry {
  const portrait = h > w * 1.05
  const compact = Math.min(w, h) < 560

  let tw: number, th: number, tx: number, ty: number
  if (portrait) {
    tw = w * 0.78
    th = Math.min(h * 0.67, tw * 1.85)
    tx = (w - tw) / 2
    ty = h * 0.11 + (h * 0.67 - th) / 2
  } else {
    th = Math.min(h * 0.6, w * 0.4)
    tw = Math.min(w * 0.8, th * 2.15)
    tx = (w - tw) / 2
    ty = h * 0.14
  }
  const cx = tx + tw / 2
  const center = { x: cx, y: ty + th * 0.5 }

  const seats: Pt[] = portrait
    ? [
        { x: cx, y: ty + th + h * 0.02 },
        { x: tx, y: ty + th * 0.76 },
        { x: tx, y: ty + th * 0.24 },
        { x: cx, y: ty - h * 0.02 },
        { x: tx + tw, y: ty + th * 0.24 },
        { x: tx + tw, y: ty + th * 0.76 },
      ]
    : [
        { x: cx, y: ty + th + h * 0.04 },
        { x: tx - tw * 0.005, y: ty + th * 0.74 },
        { x: tx - tw * 0.005, y: ty + th * 0.22 },
        { x: cx, y: ty - h * 0.045 },
        { x: tx + tw * 1.005, y: ty + th * 0.22 },
        { x: tx + tw * 1.005, y: ty + th * 0.74 },
      ]

  const avatar = compact ? 38 : Math.min(60, Math.max(44, h * 0.062))
  const cardW = portrait ? Math.min(tw * 0.16, 62) : Math.min(tw * 0.075, th * 0.2, 84)
  const heroCardW = portrait ? Math.min(w * 0.19, 86) : Math.min(cardW * 1.3, 104)
  const botCardW = portrait ? Math.max(26, cardW * 0.62) : Math.max(30, cardW * 0.6)

  const boardY = portrait ? ty + th * 0.47 : ty + th * 0.47
  const gap = cardW * 0.14
  const board = Array.from({ length: 5 }, (_, i) => ({ x: cx + (i - 2) * (cardW + gap), y: boardY }))
  const potLabel = { x: cx, y: boardY - cardW * 1.4 * 0.5 - (portrait ? 30 : 34) }
  const pot = { x: cx + (portrait ? 0 : 0), y: potLabel.y - (portrait ? 26 : 30) }

  const heroCardsY = portrait ? ty + th - heroCardW * 0.95 : ty + th - heroCardW * 0.55
  const heroCards = [
    { x: cx - heroCardW * 0.52, y: heroCardsY },
    { x: cx + heroCardW * 0.52, y: heroCardsY },
  ]

  const bets = seats.map((s, i) => {
    if (i === 0) return { x: cx + heroCardW * 1.5, y: heroCardsY - heroCardW * 0.2 }
    if (i === 3) return lerp(s, center, portrait ? 0.36 : 0.42)
    if (portrait && (i === 1 || i === 5)) return lerp(s, { x: cx, y: boardY }, 0.52)
    return lerp(s, { x: cx, y: boardY }, portrait ? 0.4 : 0.3)
  })

  const botCards = seats.map((s, i) => {
    if (portrait && i !== 0 && i !== 3) {
      // Tuck beside (upper seats) or above (lower seats) the avatar so they never cover the board or hero cards
      const dir = s.x < cx ? 1 : -1
      if (i === 2 || i === 4) return { x: s.x + dir * (avatar * 0.5 + botCardW * 0.95), y: s.y - avatar * 0.62 }
      return { x: s.x + dir * avatar * 0.25, y: s.y - avatar * 1.55 }
    }
    const off = portrait ? botCardW * 1.45 : botCardW * 2.05
    if (i === 3) return { x: s.x + (portrait ? botCardW * 1.6 : botCardW * 2.2), y: s.y + (portrait ? 18 : 22) }
    if (i === 0) return heroCards[0]
    const dir = s.x < cx ? 1 : -1
    return { x: s.x + dir * off, y: s.y + (portrait ? 30 : 4) }
  })

  const buttons = seats.map((s, i) => {
    if (i === 0) return { x: cx - heroCardW * 1.45, y: heroCardsY + heroCardW * 0.35 }
    if (i === 3) return { x: s.x - (portrait ? 54 : 70), y: s.y + (portrait ? 40 : 46) }
    const b = lerp(s, center, portrait ? 0.26 : 0.17)
    return { x: b.x, y: b.y + (i === 1 || i === 5 ? -34 : 38) }
  })

  return {
    w,
    h,
    portrait,
    compact,
    table: { x: tx, y: ty, w: tw, h: th },
    center,
    seats,
    bets,
    botCards,
    buttons,
    pot,
    potLabel,
    board,
    muck: { x: cx, y: boardY + cardW * 1.1 },
    heroCards,
    cardW,
    heroCardW,
    botCardW,
    avatar,
  }
}
