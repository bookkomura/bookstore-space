import { describe, it, expect } from 'vitest'
import { findZone, type Zone } from '../src/game/zones'

const zones: Zone[] = [
  { id: 'showcase-1', type: 'showcase', x: 100, y: 100, width: 64, height: 64 },
  { id: 'shelf-1', type: 'shelf', x: 300, y: 100, width: 64, height: 64 },
]

describe('findZone', () => {
  it('點在區域內回傳該 zone', () => {
    expect(findZone(110, 110, zones)?.id).toBe('showcase-1')
  })
  it('點在邊界上（含）回傳該 zone', () => {
    expect(findZone(100, 100, zones)?.id).toBe('showcase-1')
    expect(findZone(164, 164, zones)?.id).toBe('showcase-1')
  })
  it('點在所有區域外回傳 null', () => {
    expect(findZone(0, 0, zones)).toBeNull()
  })
})
