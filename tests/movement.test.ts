import { describe, expect, it } from 'vitest'
import { computeVelocity } from '../src/game/movement'

describe('computeVelocity', () => {
  it('無輸入回傳零向量', () => {
    expect(computeVelocity({ x: 0, y: 0 }, 160)).toEqual({ x: 0, y: 0 })
  })

  it('單軸輸入回傳全速', () => {
    expect(computeVelocity({ x: 1, y: 0 }, 160)).toEqual({ x: 160, y: 0 })
  })

  it('對角輸入不超速（正規化）', () => {
    const v = computeVelocity({ x: 1, y: 1 }, 160)
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(160)
  })

  it('小於 1 的輸入按比例縮放（搖桿輕推）', () => {
    const v = computeVelocity({ x: 0.5, y: 0 }, 160)
    expect(v.x).toBeCloseTo(80)
  })
})
