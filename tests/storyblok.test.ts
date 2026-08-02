import { describe, it, expect } from 'vitest'
import { mapStoriesToBundle } from '../src/content/storyblok'

const stories = [
  {
    slug: 'showcase-1',
    content: {
      component: 'showcase',
      title: '手工蠟燭',
      creator_link: { url: 'https://instagram.com/c' },
      pages: [
        { image: { filename: 'https://a.storyblok.com/f/1.jpg' }, caption: '描述一' },
      ],
    },
  },
  {
    slug: 'shelf-1',
    content: {
      component: 'shelf',
      title: '店主精選',
      books: [{ cover: { filename: 'https://a.storyblok.com/f/b.jpg' }, title: '書名', note: '短評' }],
    },
  },
  {
    slug: 'store-info',
    content: {
      component: 'store_info',
      address: '台東市中山路 123 號',
      hours: '週三至週日 11:00–19:00',
      instagram: { url: 'https://instagram.com/store' },
      map_link: { url: 'https://maps.google.com/?q=x' },
    },
  },
]

const olderNewsletter = {
  slug: 'newsletter-old',
  content: {
    component: 'newsletter',
    sent_at: '2026-07-18T05:40:00.000Z',
    subject: '小村碎碎念～舊一期',
    blocks: [
      { component: 'newsletter_paragraph', text: '舊一期內容。' },
    ],
  },
}

const newerNewsletter = {
  slug: 'newsletter-new',
  content: {
    component: 'newsletter',
    sent_at: '2026-07-19T05:40:00.000Z',
    subject: '小村碎碎念～最新一期',
    blocks: [
      { component: 'newsletter_paragraph', text: '最新一期內容。' },
      { component: 'newsletter_image', image: { filename: 'https://a.storyblok.com/f/2.jpg' }, alt: '市集' },
      { component: 'newsletter_link', label: '報名活動', href: { url: 'https://forms.gle/example' } },
      { component: 'newsletter_divider' },
    ],
  },
}

describe('mapStoriesToBundle', () => {
  it('依 showcase ID 排序，讓 showcase-1 至 showcase-3 由右往左排列', () => {
    const showcase2 = structuredClone(stories[0])
    showcase2.slug = 'showcase-2'
    const showcase3 = structuredClone(stories[0])
    showcase3.slug = 'showcase-3'

    const bundle = mapStoriesToBundle([showcase3, ...stories.slice(1), showcase2, stories[0]])

    expect(bundle.showcases.map((showcase) => showcase.id)).toEqual([
      'showcase-1',
      'showcase-2',
      'showcase-3',
    ])
  })

  it('maps newsletter stories in descending sentAt order without sourceMessageId', () => {
    const bundle = mapStoriesToBundle([...stories, olderNewsletter, newerNewsletter])

    expect(bundle.newsletters.map((item) => item.subject)).toEqual([
      '小村碎碎念～最新一期',
      '小村碎碎念～舊一期',
    ])
    expect(bundle.newsletters[0]).not.toHaveProperty('sourceMessageId')
  })

  it('rejects a newsletter sent_at that is not a string with a CMS-content error', () => {
    const malformedNewsletter = structuredClone(newerNewsletter) as any
    malformedNewsletter.content.sent_at = null

    expect(() => mapStoriesToBundle([...stories, malformedNewsletter])).toThrow(
      'CMS 內容格式錯誤：newsletter newsletter-new 的 sent_at 必須是字串',
    )
  })

  it('把三種 component 映射成 ContentBundle', () => {
    const bundle = mapStoriesToBundle(stories)
    expect(bundle.showcases[0]).toEqual({
      id: 'showcase-1',
      title: '手工蠟燭',
      creatorLink: 'https://instagram.com/c',
      pages: [{ image: 'https://a.storyblok.com/f/1.jpg', caption: '描述一' }],
    })
    expect(bundle.shelves[0].id).toBe('shelf-1')
    expect(bundle.storeInfo.address).toBe('台東市中山路 123 號')
  })

  it('creator_link 空值時省略 creatorLink', () => {
    const noLink = structuredClone(stories) as any
    noLink[0].content.creator_link = { url: '' }
    const bundle = mapStoriesToBundle(noLink)
    expect(bundle.showcases[0].creatorLink).toBeUndefined()
  })

  it('缺 store_info story 時丟出錯誤', () => {
    expect(() => mapStoriesToBundle(stories.slice(0, 2))).toThrow('store_info')
  })

  it('拒絕在執行期傳入非陣列的 stories 容器', () => {
    expect(() => mapStoriesToBundle({ stories } as unknown as unknown[])).toThrow('CMS 內容格式錯誤')
  })

  it.each([
    ['showcase', { ...stories[0], content: { ...stories[0].content, pages: null } }],
    ['shelf', { ...stories[1], content: { ...stories[1].content, books: null } }],
  ])('以描述性 CMS 錯誤拒絕格式錯誤的 %s', (_component, malformedStory) => {
    expect(() => mapStoriesToBundle([malformedStory, stories[2]])).toThrow('CMS 內容格式錯誤')
    expect(() => mapStoriesToBundle([malformedStory, stories[2]])).not.toThrow(/Cannot read|undefined|null/)
  })
})
