import { ContentBundleSchema, type ContentBundle } from './schema'

interface SbAsset {
  filename?: string
}

interface SbLink {
  url?: string
}

interface SbStory {
  slug: string
  content: {
    component: string
    [key: string]: unknown
  }
}

export function mapStoriesToBundle(rawStories: unknown[]): ContentBundle {
  const stories = rawStories as SbStory[]

  const showcases = stories
    .filter((story) => story.content.component === 'showcase')
    .map((story) => {
      const link = (story.content.creator_link as SbLink | undefined)?.url
      return {
        id: story.slug,
        title: story.content.title as string,
        pages: (story.content.pages as { image: SbAsset; caption: string }[]).map((page) => ({
          image: page.image.filename ?? '',
          caption: page.caption,
        })),
        ...(link ? { creatorLink: link } : {}),
      }
    })

  const shelves = stories
    .filter((story) => story.content.component === 'shelf')
    .map((story) => ({
      id: story.slug,
      title: story.content.title as string,
      books: (story.content.books as { cover: SbAsset; title: string; note: string }[]).map((book) => ({
        cover: book.cover.filename ?? '',
        title: book.title,
        note: book.note,
      })),
    }))

  const infoStory = stories.find((story) => story.content.component === 'store_info')
  if (!infoStory) throw new Error('CMS 缺少 store_info（實體店資訊）')

  const content = infoStory.content
  const storeInfo = {
    address: content.address as string,
    hours: content.hours as string,
    instagram: ((content.instagram as SbLink)?.url ?? '') as string,
    mapLink: ((content.map_link as SbLink)?.url ?? '') as string,
  }

  return ContentBundleSchema.parse({ showcases, shelves, storeInfo })
}
