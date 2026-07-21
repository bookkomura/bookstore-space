import { describe, it, expect } from 'vitest'
import { ContentBundleSchema, NewsletterSchema } from '../src/content/schema'
import sample from '../scripts/sample-content.json'

describe('ContentBundleSchema', () => {
  it('accepts safe newsletter blocks and rejects HTTP links', () => {
    const issue = {
      sentAt: '2026-07-19T05:40:00.000Z',
      subject: '小村碎碎念～總是會到',
      blocks: [
        { type: 'paragraph', text: '總是會到。' },
        { type: 'image', image: 'https://a.storyblok.com/f/1.jpg', alt: '市集', caption: '夏日市集' },
        { type: 'link', label: '報名活動', href: 'https://forms.gle/example' },
        { type: 'divider' },
      ],
    }

    expect(NewsletterSchema.safeParse(issue).success).toBe(true)
    expect(NewsletterSchema.safeParse({
      ...issue,
      blocks: [{ type: 'link', label: 'x', href: 'http://bad.test' }],
    }).success).toBe(false)
  })

  it('接受合法的 sample content', () => {
    expect(() => ContentBundleSchema.parse(sample)).not.toThrow()
  })

  it('拒絕 pages 為空陣列的 showcase', () => {
    const bad = structuredClone(sample) as any
    bad.showcases[0].pages = []
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })

  it('creatorLink 可省略', () => {
    const ok = structuredClone(sample) as any
    delete ok.showcases[0].creatorLink
    expect(() => ContentBundleSchema.parse(ok)).not.toThrow()
  })

  it('接受零到十筆 Showcase，但拒絕第十一筆', () => {
    const empty = { ...sample, showcases: [] }
    expect(ContentBundleSchema.safeParse(empty).success).toBe(true)

    const eleven = {
      ...sample,
      showcases: Array.from({ length: 11 }, (_, index) => ({
        ...sample.showcases[0], id: `showcase-${index}`,
      })),
    }
    expect(ContentBundleSchema.safeParse(eleven).success).toBe(false)
  })

  it('拒絕缺 storeInfo 的 bundle', () => {
    const bad = structuredClone(sample) as any
    delete bad.storeInfo
    expect(() => ContentBundleSchema.parse(bad)).toThrow()
  })
})
