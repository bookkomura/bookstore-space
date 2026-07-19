import { describe, it, expect } from 'vitest'
import { parseInteractionZones } from '../src/game/mapParser'

const tiledMap = {
  layers: [
    { type: 'tilelayer', name: 'ground', data: [1] },
    {
      type: 'objectgroup',
      name: 'interactions',
      objects: [
        {
          name: 'showcase-1', x: 96, y: 96, width: 64, height: 64,
          properties: [{ name: 'type', type: 'string', value: 'showcase' }],
        },
        {
          name: 'info-1', x: 200, y: 96, width: 32, height: 32,
          properties: [{ name: 'type', type: 'string', value: 'info' }],
        },
      ],
    },
  ],
}

describe('parseInteractionZones', () => {
  it('抽出 interactions 層的物件為 Zone', () => {
    const zones = parseInteractionZones(tiledMap)
    expect(zones).toHaveLength(2)
    expect(zones[0]).toEqual({
      id: 'showcase-1', type: 'showcase', x: 96, y: 96, width: 64, height: 64,
      anchorX: 128, anchorY: 96,
    })
  })
  it('沒有 interactions 層時丟出錯誤', () => {
    expect(() => parseInteractionZones({ layers: [] })).toThrow('interactions')
  })
  it('物件缺 type 屬性時丟出錯誤並指名 id', () => {
    const bad = {
      layers: [{ type: 'objectgroup', name: 'interactions', objects: [{ name: 'x-1', x: 0, y: 0, width: 1, height: 1, properties: [] }] }],
    }
    expect(() => parseInteractionZones(bad)).toThrow('x-1')
  })
})
