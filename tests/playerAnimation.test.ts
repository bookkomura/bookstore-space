import { describe, expect, it } from 'vitest'
import {
  facingFromVelocity,
  idleFrame,
  walkAnimation,
} from '../src/game/playerAnimation'

describe('playerAnimation', () => {
  it('以主軸速度決定四方向', () => {
    expect(facingFromVelocity(80, 20, 'down')).toBe('right')
    expect(facingFromVelocity(-80, 20, 'down')).toBe('left')
    expect(facingFromVelocity(20, -80, 'down')).toBe('up')
    expect(facingFromVelocity(20, 80, 'up')).toBe('down')
  })

  it('停止時保留上一個面向', () => {
    expect(facingFromVelocity(0, 0, 'left')).toBe('left')
  })

  it('四方向對應每列第一格與 walk key', () => {
    expect(idleFrame('down')).toBe(0)
    expect(idleFrame('left')).toBe(4)
    expect(idleFrame('right')).toBe(8)
    expect(idleFrame('up')).toBe(12)
    expect(walkAnimation('up')).toBe('walk-up')
  })
})
