import { describe, expect, it } from 'vitest'
import {
  COLLISION_RECTS,
  INTERACTION_ZONES,
  PLAYER_SPAWN,
  WORLD_SIZE,
} from '../src/game/sceneLayout'

describe('sceneLayout', () => {
  it('使用核准背景尺寸與左上入口出生點', () => {
    expect(WORLD_SIZE).toEqual({ width: 1572, height: 1001 })
    expect(PLAYER_SPAWN).toEqual({ x: 270, y: 300 })
  })

  it('定義五商品、店長選書與營業資訊共七區', () => {
    expect(INTERACTION_ZONES.map((zone) => zone.id)).toEqual([
      'showcase-1',
      'showcase-2',
      'showcase-3',
      'showcase-4',
      'showcase-5',
      'shelf-1',
      'info-1',
    ])
  })

  it('商品 1 在最右側，向左依序至商品 5', () => {
    const xs = INTERACTION_ZONES
      .filter((zone) => zone.type === 'showcase')
      .map((zone) => zone.anchorX)
    expect(xs).toEqual([...xs].sort((a, b) => b - a))
  })

  it('碰撞體 ID 唯一且完全位於世界內', () => {
    expect(new Set(COLLISION_RECTS.map((rect) => rect.id)).size).toBe(COLLISION_RECTS.length)
    for (const rect of COLLISION_RECTS) {
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(WORLD_SIZE.width)
      expect(rect.y + rect.height).toBeLessThanOrEqual(WORLD_SIZE.height)
    }
  })
})
