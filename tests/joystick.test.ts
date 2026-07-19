import { describe, expect, it } from 'vitest'
import { joystickVector } from '../src/game/joystick'

describe('joystickVector', () => {
  it('拖到半徑一半回傳 0.5', () => {
    const v = joystickVector({ x: 100, y: 100 }, { x: 120, y: 100 }, 40)
    expect(v.x).toBeCloseTo(0.5)
    expect(v.y).toBeCloseTo(0)
  })

  it('拖超過半徑時 clamp 到 1', () => {
    const v = joystickVector({ x: 100, y: 100 }, { x: 300, y: 100 }, 40)
    expect(v.x).toBeCloseTo(1)
  })

  it('原地不動回傳零向量', () => {
    expect(joystickVector({ x: 100, y: 100 }, { x: 100, y: 100 }, 40)).toEqual({ x: 0, y: 0 })
  })
})
