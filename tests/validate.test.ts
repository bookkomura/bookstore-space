import { describe, expect, it } from 'vitest'
import { validateContent } from '../src/content/validate'
import { ContentBundleSchema } from '../src/content/schema'
import { INTERACTION_ZONES } from '../src/game/sceneLayout'
import sample from '../scripts/sample-content.json'

const content = ContentBundleSchema.parse(sample)

describe('validateContent', () => {
  it('七個場景互動點與內容完全對應時回傳空陣列', () => {
    expect(validateContent(INTERACTION_ZONES, content)).toEqual([])
  })

  it('缺少商品時列出該 id', () => {
    const missing = {
      ...content,
      showcases: content.showcases.filter((item) => item.id !== 'showcase-5'),
    }
    expect(validateContent(INTERACTION_ZONES, missing).join('\n')).toContain('showcase-5')
  })

  it('多出場景不存在的商品時列出該 id', () => {
    const extra = {
      ...content,
      showcases: [
        ...content.showcases,
        { ...content.showcases[0], id: 'showcase-99', title: '多餘商品' },
      ],
    }
    expect(validateContent(INTERACTION_ZONES, extra).join('\n')).toContain('showcase-99')
  })

  it('重複 CMS id 時列出重複錯誤', () => {
    const duplicate = {
      ...content,
      showcases: [...content.showcases, { ...content.showcases[0] }],
    }
    expect(validateContent(INTERACTION_ZONES, duplicate).join('\n')).toContain('重複')
  })

  it('缺少唯一 info-1 時回報場景設定錯誤', () => {
    const noInfo = INTERACTION_ZONES.filter((zone) => zone.id !== 'info-1')
    expect(validateContent(noInfo, content).join('\n')).toContain('info-1')
  })
})
