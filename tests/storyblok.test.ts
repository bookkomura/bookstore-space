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

describe('mapStoriesToBundle', () => {
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
