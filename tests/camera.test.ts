import { describe, expect, it } from 'vitest'
import { calculateCameraZoom } from '../src/game/camera'

describe('calculateCameraZoom', () => {
  it('桌機採 cover zoom，畫面不露出世界外', () => {
    expect(calculateCameraZoom(1440, 900, false)).toBeCloseTo(1440 / 1572)
  })

  it('小桌機不把玩家縮得低於 0.65', () => {
    expect(calculateCameraZoom(640, 480, false)).toBe(0.65)
  })

  it('手機至少使用 1 倍局部跟隨', () => {
    expect(calculateCameraZoom(390, 844, true)).toBe(1)
    expect(calculateCameraZoom(844, 390, true)).toBe(1)
  })

  it('較大觸控 viewport 仍使用 cover zoom', () => {
    expect(calculateCameraZoom(1800, 1200, true)).toBeCloseTo(1200 / 1001)
  })
})
