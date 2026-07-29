import { describe, expect, it } from 'vitest'
import {
  buildInteractionZones,
  COLLISION_RECTS,
  INTERACTION_ZONES,
  MAX_SHOWCASE_SLOTS,
  PLAYER_SPAWN,
  SHOWCASE_SLOT_ANCHORS,
  STATIC_INTERACTION_ZONES,
  WORLD_SIZE,
} from '../src/game/sceneLayout'

describe('sceneLayout', () => {
  it('使用核准背景尺寸與右側入口出生點', () => {
    expect(WORLD_SIZE).toEqual({ width: 1572, height: 1001 })
    expect(PLAYER_SPAWN).toEqual({ x: 1205, y: 250 })
  })

  it('定義五商品、店長選書、營業資訊、檔案室與詩集桌共九區', () => {
    expect(INTERACTION_ZONES.map((zone) => zone.id)).toEqual([
      'showcase-1',
      'showcase-2',
      'showcase-3',
      'showcase-4',
      'showcase-5',
      'shelf-1',
      'info-1',
      'archive-1',
      'poem-upload-1',
    ])
  })

  it('places poem upload at the middle square table', () => {
    expect(STATIC_INTERACTION_ZONES.find((zone) => zone.id === 'poem-upload-1')).toEqual(
      { id: 'poem-upload-1', type: 'poemUpload', x: 630, y: 590, width: 220, height: 64, anchorX: 730, anchorY: 690 },
    )
  })

  it('keeps the poem upload approach reachable while anchoring its marker on the table', () => {
    const zone = STATIC_INTERACTION_ZONES.find((item) => item.id === 'poem-upload-1')!
    const table = COLLISION_RECTS.find((item) => item.id === 'table-lower-middle')!
    expect(zone.y).toBeLessThan(table.y)
    expect(zone.anchorX).toBeGreaterThanOrEqual(table.x)
    expect(zone.anchorX).toBeLessThanOrEqual(table.x + table.width)
    expect(zone.anchorY).toBeGreaterThanOrEqual(table.y)
    expect(zone.anchorY).toBeLessThanOrEqual(table.y + table.height)
  })

  it('has one archive entry beside the left bookshelf', () => {
    const archive = STATIC_INTERACTION_ZONES.find((zone) => zone.id === 'archive-1')
    expect(archive).toEqual({ id: 'archive-1', type: 'archive', x: 200, y: 510, width: 72, height: 160, anchorX: 140, anchorY: 550, })
    const bookshelf = COLLISION_RECTS.find((rect) => rect.id === 'shelves-left')!
    expect(archive!.x).toBeGreaterThanOrEqual(bookshelf.x + bookshelf.width)
  })

  it('由右至左為三筆 Showcase 建立置中的書櫃互動點', () => {
    const zones = buildInteractionZones([
      { id: 'first' }, { id: 'second' }, { id: 'third' },
    ])
    expect(zones.filter((zone) => zone.type === 'showcase')).toEqual([
      { id: 'first', type: 'showcase', x: 1021, y: 270, width: 72, height: 64, anchorX: 1057, anchorY: 163 },
      { id: 'second', type: 'showcase', x: 945, y: 270, width: 72, height: 64, anchorX: 981, anchorY: 163 },
      { id: 'third', type: 'showcase', x: 869, y: 270, width: 72, height: 64, anchorX: 905, anchorY: 163 },
    ])
  })

  it('沒有 Showcase 時不建立 Showcase 互動點', () => {
    expect(buildInteractionZones([]).filter((zone) => zone.type === 'showcase')).toEqual([])
  })

  it('十個 Showcase 一一使用十個書櫃中心點', () => {
    const zones = buildInteractionZones(
      Array.from({ length: MAX_SHOWCASE_SLOTS }, (_, index) => ({ id: `item-${index}` })),
    ).filter((zone) => zone.type === 'showcase')
    expect(zones.map((zone) => zone.anchorX)).toEqual(SHOWCASE_SLOT_ANCHORS)
    expect(zones.every((zone) => zone.anchorY === 163)).toBe(true)
  })

  it('商品 1 在最右側，向左依序至商品 5', () => {
    const xs = INTERACTION_ZONES
      .filter((zone) => zone.type === 'showcase')
      .map((zone) => zone.anchorX)
    expect(xs).toEqual([...xs].sort((a, b) => b - a))
  })

  it('將店主精選放在長桌右側、紫衣客人旁', () => {
    expect(INTERACTION_ZONES.find((zone) => zone.id === 'shelf-1')).toEqual({
      id: 'shelf-1',
      type: 'shelf',
      x: 1020,
      y: 360,
      width: 170,
      height: 160,
      anchorX: 950,
      anchorY: 412,
    })
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
