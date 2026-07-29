import { describe, expect, it } from 'vitest'
import { findNearestZone, type Zone } from '../src/game/zones'

const zones: Zone[] = [
  {
    id: 'showcase-1', type: 'showcase',
    x: 100, y: 100, width: 80, height: 80,
    anchorX: 170, anchorY: 120,
  },
  {
    id: 'showcase-2', type: 'showcase',
    x: 140, y: 100, width: 80, height: 80,
    anchorX: 150, anchorY: 120,
  },
]

describe('findNearestZone', () => {
  it('accepts poemUpload as an interaction zone type', () => {
    const zone: Zone = { id: 'poem-upload-1', type: 'poemUpload', x: 630, y: 590, width: 220, height: 64, anchorX: 730, anchorY: 690 }
    expect(findNearestZone(730, 600, [zone])).toEqual(zone)
  })

  it('accepts archive as an interaction zone type', () => {
    const archive: Zone = {
      id: 'archive-1', type: 'archive',
      x: 245, y: 105, width: 68, height: 135,
      anchorX: 279, anchorY: 171,
    }
    expect(findNearestZone(279, 171, [archive])).toEqual(archive)
  })

  it('區域不重疊時回傳包含座標的 zone', () => {
    expect(findNearestZone(110, 110, zones)?.id).toBe('showcase-1')
  })

  it('重疊時回傳互動錨點最近的 zone', () => {
    expect(findNearestZone(150, 130, zones)?.id).toBe('showcase-2')
  })

  it('等距時維持設定陣列順序', () => {
    expect(findNearestZone(160, 120, zones)?.id).toBe('showcase-1')
  })

  it('所有區域外回傳 null', () => {
    expect(findNearestZone(0, 0, zones)).toBeNull()
  })
})
