export type PlayerAppearanceId =
  | 'visitor-male'
  | 'visitor-female'
  | 'friendly-alien'
  | 'big-yellow-dog'
  | 'orange-cat'

export interface PlayerAppearance {
  id: PlayerAppearanceId
  textureKey: string
  assetUrl: string
}

export type RandomSource = () => number

export const PLAYER_FRAME_SIZE = 256

export const PLAYER_APPEARANCES: readonly PlayerAppearance[] = [
  {
    id: 'visitor-male',
    textureKey: 'player-visitor-male',
    assetUrl: new URL('../assets/player-visitor.png', import.meta.url).href,
  },
  {
    id: 'visitor-female',
    textureKey: 'player-visitor-female',
    assetUrl: new URL('../assets/player-visitor-female.png', import.meta.url).href,
  },
  {
    id: 'friendly-alien',
    textureKey: 'player-friendly-alien',
    assetUrl: new URL('../assets/player-friendly-alien.png', import.meta.url).href,
  },
  {
    id: 'big-yellow-dog',
    textureKey: 'player-big-yellow-dog',
    assetUrl: new URL('../assets/player-big-yellow-dog.png', import.meta.url).href,
  },
  {
    id: 'orange-cat',
    textureKey: 'player-orange-cat',
    assetUrl: new URL('../assets/player-orange-cat.png', import.meta.url).href,
  },
]

export function selectPlayerAppearance(random: RandomSource = Math.random): PlayerAppearance {
  const index = Math.min(PLAYER_APPEARANCES.length - 1, Math.floor(random() * PLAYER_APPEARANCES.length))
  return PLAYER_APPEARANCES[index]
}
