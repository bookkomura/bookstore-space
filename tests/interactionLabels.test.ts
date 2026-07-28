import { describe, expect, it } from 'vitest'
import { ContentBundleSchema } from '../src/content/schema'
import {
  buildInteractionLabels,
  formatMarkerLabel,
} from '../src/game/interactionLabels'
import sample from '../scripts/sample-content.json'

const content = ContentBundleSchema.parse(sample)

describe('interactionLabels', () => {
  it('以 CMS title 建立五商品、書單與固定營業資訊名稱', () => {
    const labels = buildInteractionLabels(content)
    expect(labels['showcase-1']).toBe(content.showcases[0].title)
    expect(labels['showcase-5']).toBe('獨立刊物選集')
    expect(labels['shelf-1']).toBe(content.shelves[0].title)
    expect(labels['info-1']).toBe('營業資訊')
  })

  it('labels the archive entry', () => {
    expect(buildInteractionLabels(content)['archive-1']).toBe('小村碎碎念')
  })

  it('十一至二十字分成兩行', () => {
    expect(formatMarkerLabel('一二三四五六七八九十一二')).toBe(
      '一二三四五六七八九十\n一二',
    )
  })

  it('超過二十字時第二行以省略號結束', () => {
    expect(formatMarkerLabel('一二三四五六七八九十一二三四五六七八九十二一')).toBe(
      '一二三四五六七八九十\n一二三四五六七八九…',
    )
  })
})
