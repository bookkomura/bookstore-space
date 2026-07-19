import { describe, it, expect } from 'vitest'
import { validateContent } from '../src/content/validate'
import { ContentBundleSchema } from '../src/content/schema'
import sample from '../scripts/sample-content.json'

const mapWith = (objects: { name: string; type: string }[]) => ({
  layers: [{
    type: 'objectgroup', name: 'interactions',
    objects: objects.map((o, i) => ({
      name: o.name, x: i * 100, y: 0, width: 64, height: 64,
      properties: [{ name: 'type', type: 'string', value: o.type }],
    })),
  }],
})

const content = ContentBundleSchema.parse(sample)

describe('validateContent', () => {
  it('地圖與內容完全對應時回傳空陣列', () => {
    const map = mapWith([
      { name: 'showcase-1', type: 'showcase' },
      { name: 'showcase-2', type: 'showcase' },
      { name: 'shelf-1', type: 'shelf' },
      { name: 'info-1', type: 'info' },
    ])
    expect(validateContent(map, content)).toEqual([])
  })

  it('地圖互動點在 CMS 找不到內容時列出該 id', () => {
    const map = mapWith([{ name: 'showcase-99', type: 'showcase' }])
    const errors = validateContent(map, content)
    expect(errors.some((e) => e.includes('showcase-99'))).toBe(true)
  })

  it('CMS 內容在地圖上沒有互動點時列出該 id', () => {
    const map = mapWith([
      { name: 'showcase-1', type: 'showcase' },
      { name: 'showcase-2', type: 'showcase' },
    ])
    const errors = validateContent(map, content)
    expect(errors.some((e) => e.includes('shelf-1'))).toBe(true)
  })
})
