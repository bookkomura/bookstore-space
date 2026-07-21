import { ContentBundleSchema, type ContentBundle } from './schema'

interface SbStory {
  slug: string
  content: Record<string, unknown> & { component: string }
}

const CMS_CONTENT_ERROR = 'CMS 內容格式錯誤'

function invalidContent(detail: string): never {
  throw new Error(`${CMS_CONTENT_ERROR}：${detail}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStory(value: unknown, index: number): SbStory {
  if (!isRecord(value)) invalidContent(`stories[${index}] 必須是物件`)
  if (typeof value.slug !== 'string') invalidContent(`stories[${index}].slug 必須是字串`)
  if (!isRecord(value.content)) invalidContent(`stories[${index}].content 必須是物件`)
  if (typeof value.content.component !== 'string') {
    invalidContent(`stories[${index}].content.component 必須是字串`)
  }

  return { slug: value.slug, content: value.content as SbStory['content'] }
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalidContent(`${field} 必須是陣列`)
  return value
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) invalidContent(`${field} 必須是物件`)
  return value
}

function optionalUrl(value: unknown): string | undefined {
  return isRecord(value) && typeof value.url === 'string' ? value.url : undefined
}

function assetFilename(value: unknown, field: string): string {
  const asset = readRecord(value, field)
  return typeof asset.filename === 'string' ? asset.filename : ''
}

export function mapStoriesToBundle(rawStories: unknown[]): ContentBundle {
  if (!Array.isArray(rawStories)) invalidContent('stories 必須是陣列')
  const stories = rawStories.map(readStory)

  const showcases = stories
    .filter((story) => story.content.component === 'showcase')
    .map((story) => {
      const pages = readArray(story.content.pages, `showcase ${story.slug} 的 pages`)
      const link = optionalUrl(story.content.creator_link)

      return {
        id: story.slug,
        title: story.content.title,
        pages: pages.map((page, index) => {
          const item = readRecord(page, `showcase ${story.slug} 的 pages[${index}]`)
          return {
            image: assetFilename(item.image, `showcase ${story.slug} 的 pages[${index}].image`),
            caption: item.caption,
          }
        }),
        ...(link ? { creatorLink: link } : {}),
      }
    })

  const shelves = stories
    .filter((story) => story.content.component === 'shelf')
    .map((story) => {
      const books = readArray(story.content.books, `shelf ${story.slug} 的 books`)
      return {
        id: story.slug,
        title: story.content.title,
        books: books.map((book, index) => {
          const item = readRecord(book, `shelf ${story.slug} 的 books[${index}]`)
          return {
            cover: assetFilename(item.cover, `shelf ${story.slug} 的 books[${index}].cover`),
            title: item.title,
            note: item.note,
          }
        }),
      }
    })

  const newsletters = stories
    .filter((story) => story.content.component === 'newsletter')
    .map((story) => {
      const blocks = readArray(story.content.blocks, `newsletter ${story.slug} 的 blocks`)
      const sentAt = story.content.sent_at
      if (typeof sentAt !== 'string') {
        invalidContent(`newsletter ${story.slug} 的 sent_at 必須是字串`)
      }

      return {
        sentAt,
        subject: story.content.subject,
        blocks: blocks.map((block, index) => {
          const item = readRecord(block, `newsletter ${story.slug} 的 blocks[${index}]`)

          switch (item.component) {
            case 'newsletter_paragraph':
              return { type: 'paragraph' as const, text: item.text }
            case 'newsletter_image':
              return {
                type: 'image' as const,
                image: assetFilename(item.image, `newsletter ${story.slug} 的 blocks[${index}].image`),
                alt: item.alt,
                ...(typeof item.caption === 'string' ? { caption: item.caption } : {}),
              }
            case 'newsletter_link':
              return {
                type: 'link' as const,
                label: item.label,
                href: optionalUrl(item.href) ?? '',
              }
            case 'newsletter_divider':
              return { type: 'divider' as const }
            default:
              return { type: item.component }
          }
        }),
      }
    })

  newsletters.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt))

  const infoStory = stories.find((story) => story.content.component === 'store_info')
  if (!infoStory) throw new Error('CMS 缺少 store_info（實體店資訊）')

  const content = infoStory.content
  const result = ContentBundleSchema.safeParse({
    showcases,
    shelves,
    storeInfo: {
      address: content.address,
      hours: content.hours,
      instagram: optionalUrl(content.instagram) ?? '',
      mapLink: optionalUrl(content.map_link) ?? '',
    },
    newsletters,
  })

  if (!result.success) invalidContent('映射後的內容未通過驗證')
  return result.data
}
