/**
 * Cards are encoded as integers 0..51 for speed:
 *   rank index = card >> 2   (0 = Two … 12 = Ace)
 *   suit index = card & 3    (0 = clubs, 1 = diamonds, 2 = hearts, 3 = spades)
 */
export type Card = number

export type Suit = 'c' | 'd' | 'h' | 's'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A'

export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
export const SUITS: readonly Suit[] = ['c', 'd', 'h', 's']

export const RANK_NAMES = [
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Jack',
  'Queen',
  'King',
  'Ace',
] as const

export const RANK_PLURALS = [
  'Twos',
  'Threes',
  'Fours',
  'Fives',
  'Sixes',
  'Sevens',
  'Eights',
  'Nines',
  'Tens',
  'Jacks',
  'Queens',
  'Kings',
  'Aces',
] as const

export const SUIT_NAMES: Record<Suit, string> = {
  c: 'clubs',
  d: 'diamonds',
  h: 'hearts',
  s: 'spades',
}

export const SUIT_SYMBOLS: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' }

export const rankOf = (c: Card): number => c >> 2
export const suitOf = (c: Card): number => c & 3
export const makeCard = (rank: number, suit: number): Card => (rank << 2) | suit

export const rankChar = (c: Card): Rank => RANKS[rankOf(c)]
export const suitChar = (c: Card): Suit => SUITS[suitOf(c)]

export function cardToString(c: Card): string {
  return RANKS[rankOf(c)] + SUITS[suitOf(c)]
}

export function parseCard(s: string): Card {
  const r = RANKS.indexOf(s[0].toUpperCase() as Rank)
  const su = SUITS.indexOf(s[1].toLowerCase() as Suit)
  if (r < 0 || su < 0 || s.length !== 2) throw new Error(`Bad card: ${s}`)
  return makeCard(r, su)
}

/** "AsKd Qh" or "As Kd" → cards */
export function parseCards(s: string): Card[] {
  const clean = s.replace(/[\s,]/g, '')
  const out: Card[] = []
  for (let i = 0; i < clean.length; i += 2) out.push(parseCard(clean.slice(i, i + 2)))
  return out
}

export function fullDeck(): Card[] {
  return Array.from({ length: 52 }, (_, i) => i)
}

export const isRed = (c: Card): boolean => {
  const s = suitOf(c)
  return s === 1 || s === 2
}
