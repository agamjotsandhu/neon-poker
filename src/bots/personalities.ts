export interface AvatarSpec {
  skin: 1 | 2 | 3 | 4
  hair: 'black' | 'brown' | 'blond' | 'pink' | 'white' | 'red'
  style: 'long' | 'short' | 'bun' | 'mohawk' | 'curly' | 'cap' | 'hood'
  accessory: 'none' | 'shades' | 'glasses' | 'visor' | 'earring' | 'scar'
  outfit: 'pink' | 'cyan' | 'purple' | 'amber' | 'lime'
}

export interface Personality {
  id: string
  name: string
  /** One-line description shown in the UI. */
  style: string
  tag: string
  /** Approx. share of hands played (0..1). Higher = looser. */
  looseness: number
  /** Probability of choosing aggressive actions with a qualifying hand. */
  aggression: number
  /** Probability of a pure bluff when checked to. */
  bluff: number
  /** Extra equity tolerance when calling (calling stations call light). */
  stickiness: number
  avatar: AvatarSpec
}

export const PERSONALITIES: Personality[] = [
  {
    id: 'nova',
    name: 'Nova',
    style: 'Tight-aggressive regular. Plays few hands, bets them hard.',
    tag: 'TAG',
    looseness: 0.2,
    aggression: 0.75,
    bluff: 0.08,
    stickiness: 0,
    avatar: { skin: 1, hair: 'black', style: 'long', accessory: 'none', outfit: 'pink' },
  },
  {
    id: 'rook',
    name: 'Rook',
    style: 'The rock. Waits for monsters; rarely bluffs.',
    tag: 'ROCK',
    looseness: 0.13,
    aggression: 0.35,
    bluff: 0.02,
    stickiness: -0.03,
    avatar: { skin: 3, hair: 'brown', style: 'bun', accessory: 'scar', outfit: 'amber' },
  },
  {
    id: 'jinx',
    name: 'Jinx',
    style: 'Maniac. Raises anything, bluffs constantly.',
    tag: 'MANIAC',
    looseness: 0.48,
    aggression: 0.85,
    bluff: 0.28,
    stickiness: 0.04,
    avatar: { skin: 2, hair: 'pink', style: 'mohawk', accessory: 'earring', outfit: 'lime' },
  },
  {
    id: 'mochi',
    name: 'Mochi',
    style: 'Calling station. Loves to see flops and hates to fold.',
    tag: 'STATION',
    looseness: 0.5,
    aggression: 0.15,
    bluff: 0.03,
    stickiness: 0.1,
    avatar: { skin: 4, hair: 'black', style: 'curly', accessory: 'glasses', outfit: 'cyan' },
  },
  {
    id: 'vex',
    name: 'Vex',
    style: 'Loose-aggressive thinker. Pressures weakness.',
    tag: 'LAG',
    looseness: 0.3,
    aggression: 0.62,
    bluff: 0.15,
    stickiness: 0.02,
    avatar: { skin: 1, hair: 'white', style: 'cap', accessory: 'shades', outfit: 'purple' },
  },
]

export const HUMAN_AVATAR: AvatarSpec = {
  skin: 2,
  hair: 'red',
  style: 'hood',
  accessory: 'visor',
  outfit: 'cyan',
}

export const personalityById = (id: string) => PERSONALITIES.find((p) => p.id === id)
