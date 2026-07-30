import { describe, expect, it } from 'vitest'
import { PLAYER_APPEARANCES, selectPlayerAppearance } from '../src/game/playerAppearance'

describe('player appearances', () => {
  it('contains exactly the five approved role IDs', () => {
    expect(PLAYER_APPEARANCES.map((appearance) => appearance.id)).toEqual([
      'visitor-male',
      'visitor-female',
      'friendly-alien',
      'big-yellow-dog',
      'orange-cat',
    ])
  })

  it.each([
    [0, 'visitor-male'],
    [0.2, 'visitor-female'],
    [0.4, 'friendly-alien'],
    [0.6, 'big-yellow-dog'],
    [0.8, 'orange-cat'],
    [0.999999, 'orange-cat'],
  ] as const)('selects %s as %s', (randomValue, expectedId) => {
    expect(selectPlayerAppearance(() => randomValue).id).toBe(expectedId)
  })
})
