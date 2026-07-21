import { describe, expect, it } from 'vitest'
import { validateContent } from '../src/content/validate'
import { ContentBundleSchema } from '../src/content/schema'
import { buildInteractionZones } from '../src/game/sceneLayout'
import sample from '../scripts/sample-content.json'

const content = ContentBundleSchema.parse(sample)
const zones = buildInteractionZones(content.showcases)

describe('validateContent', () => {
  it('八個場景互動點與內容完全對應時回傳空陣列', () => {
    expect(validateContent(zones, content)).toEqual([])
  })

  it('空 Showcase 內容與生成的場景互動點完全對應', () => {
    const empty = { ...content, showcases: [] }
    expect(validateContent(buildInteractionZones(empty.showcases), empty)).toEqual([])
  })

  it('缺少商品時列出該 id', () => {
    const missing = {
      ...content,
      showcases: content.showcases.filter((item) => item.id !== 'showcase-5'),
    }
    expect(validateContent(zones, missing).join('\n')).toContain('showcase-5')
  })

  it('多出場景不存在的商品時列出該 id', () => {
    const extra = {
      ...content,
      showcases: [
        ...content.showcases,
        { ...content.showcases[0], id: 'showcase-99', title: '多餘商品' },
      ],
    }
    expect(validateContent(zones, extra).join('\n')).toContain('showcase-99')
  })

  it('Showcase 使用 Shelf id 時回報沒有對應的 Showcase 互動點', () => {
    const extra = {
      ...content,
      showcases: [
        ...content.showcases,
        { ...content.showcases[0], id: 'shelf-1', title: '錯誤展示商品' },
      ],
    }
    expect(validateContent(zones, extra).join('\n')).toContain('shelf-1')
  })

  it('Shelf 使用 Showcase id 時回報沒有對應的 Shelf 互動點', () => {
    const extra = {
      ...content,
      shelves: [
        ...content.shelves,
        { ...content.shelves[0], id: 'showcase-1', title: '錯誤書架商品' },
      ],
    }
    expect(validateContent(zones, extra).join('\n')).toContain('showcase-1')
  })

  it('重複 CMS id 時列出重複錯誤', () => {
    const duplicate = {
      ...content,
      showcases: [...content.showcases, { ...content.showcases[0] }],
    }
    expect(validateContent(zones, duplicate).join('\n')).toContain('重複')
  })

  it('重複 Shelf CMS id 時列出重複錯誤', () => {
    const duplicate = {
      ...content,
      shelves: [...content.shelves, { ...content.shelves[0] }],
    }
    expect(validateContent(zones, duplicate).join('\n')).toContain('CMS Shelf id 重複')
  })

  it('重複場景互動點 id 時列出重複錯誤', () => {
    const duplicate = [...zones, { ...zones[0] }]
    expect(validateContent(duplicate, content).join('\n')).toContain('場景互動點 id 重複')
  })

  it('缺少唯一 info-1 時回報場景設定錯誤', () => {
    const noInfo = zones.filter((zone) => zone.id !== 'info-1')
    expect(validateContent(noInfo, content).join('\n')).toContain('info-1')
  })

  it('info 互動點使用錯誤 id 時回報場景設定錯誤', () => {
    const wrongInfo = zones.map((zone) => (
      zone.id === 'info-1' ? { ...zone, id: 'info-2' } : zone
    ))
    expect(validateContent(wrongInfo, content).join('\n')).toContain('info-1')
  })

  it('存在多個 info 互動點時回報場景設定錯誤', () => {
    const infoZone = zones.find((zone) => zone.type === 'info')!
    const multipleInfo = [...zones, { ...infoZone, id: 'info-2' }]
    expect(validateContent(multipleInfo, content).join('\n')).toContain('info-1')
  })

  it('缺少唯一 archive-1 時回報場景設定錯誤', () => {
    const noArchive = zones.filter((zone) => zone.id !== 'archive-1')
    expect(validateContent(noArchive, content).join('\n')).toContain('archive-1')
  })
})
