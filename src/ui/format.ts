import { cardToString } from '../engine/cards'
import type { GameState, HandEvent, Street } from '../engine/types'

export const STREET_LABEL: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
}

const prettyCard = (c: number) => {
  const s = cardToString(c)
  const sym = { c: '♣', d: '♦', h: '♥', s: '♠' }[s[1] as 'c' | 'd' | 'h' | 's']
  return (s[0] === 'T' ? '10' : s[0]) + sym
}
export const prettyCards = (cs: readonly number[]) => cs.map(prettyCard).join(' ')

export function describeEvent(e: HandEvent, state: Pick<GameState, 'players'>): string {
  const name = (id: string) => {
    const p = state.players.find((x) => x.id === id)
    return p ? (p.isHuman ? 'You' : p.name) : id
  }
  const verb3 = (id: string, you: string, they: string) => (name(id) === 'You' ? you : they)
  switch (e.kind) {
    case 'start':
      return `Hand #${e.handNumber} — ${name(e.dealerId)} ${verb3(e.dealerId, 'have', 'has')} the button`
    case 'blind':
      return `${name(e.playerId)} ${verb3(e.playerId, 'post', 'posts')} the ${e.blind === 'SB' ? 'small' : 'big'} blind (${e.amount.toLocaleString()})`
    case 'street':
      return `${STREET_LABEL[e.street]}: ${prettyCards(e.cards)}`
    case 'refund':
      return `${e.amount.toLocaleString()} uncalled returned to ${name(e.playerId)}`
    case 'win':
      return `${name(e.playerId)} ${verb3(e.playerId, 'win', 'wins')} ${e.amount.toLocaleString()}${e.handName ? ` with ${e.handName}` : ''}`
    case 'action': {
      const n = name(e.playerId)
      const you = n === 'You'
      switch (e.action) {
        case 'fold':
          return `${n} ${you ? 'fold' : 'folds'}`
        case 'check':
          return `${n} ${you ? 'check' : 'checks'}`
        case 'call':
          return `${n} ${you ? 'call' : 'calls'} ${e.paid.toLocaleString()}`
        case 'bet':
          return `${n} ${you ? 'bet' : 'bets'} ${e.to.toLocaleString()}`
        case 'raise':
          return `${n} ${you ? 'raise' : 'raises'} to ${e.to.toLocaleString()}`
        case 'allin':
          return `${n} ${you ? 'go' : 'goes'} all-in (${e.to.toLocaleString()})`
      }
    }
  }
  return ''
}
