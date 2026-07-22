import { randomUUID } from 'node:crypto'

import type { ParsedBlock, ParsedNewsletter } from './mime.js'

export interface StoryblokPublisher {
  publish(parsed: ParsedNewsletter, publicationKey: string): Promise<{ storyId: number }>
}

export interface CreateStoryblokPublisherOptions {
  spaceId: string
  managementToken: string
  fetcher?: typeof fetch
  managementApiBaseUrl?: string
  folderSlug?: string
  uuid?: () => string
}

interface SignedUpload {
  id: number
  post_url: string
  fields: Record<string, string>
}

export function createStoryblokPublisher({
  spaceId,
  managementToken,
  fetcher = fetch,
  managementApiBaseUrl = 'https://mapi.storyblok.com/v1',
  folderSlug = 'newsletters',
  uuid = randomUUID,
}: CreateStoryblokPublisherOptions): StoryblokPublisher {
  const apiBase = managementApiBaseUrl.replace(/\/$/, '')
  const api = (path: string) => `${apiBase}/spaces/${encodeURIComponent(spaceId)}${path}`

  async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetcher(api(path), {
      ...init,
      headers: {
        Authorization: managementToken,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
    if (!response.ok) throw new Error(`Storyblok request failed (${response.status})`)
    return response.json()
  }

  async function findFolder(): Promise<{ id: number; fullSlug: string }> {
    const query = new URLSearchParams({ folder_only: 'true', search: folderSlug, per_page: '100' })
    const response = (await requestJson(`/stories?${query}`)) as { stories?: unknown }
    const folder = Array.isArray(response.stories)
      ? response.stories.find(
          (candidate): candidate is { id: unknown; slug: unknown; full_slug?: unknown; is_folder: unknown } =>
            typeof candidate === 'object' &&
            candidate !== null &&
            (candidate as { slug?: unknown }).slug === folderSlug &&
            (candidate as { is_folder?: unknown }).is_folder === true,
        )
      : undefined
    if (!folder || typeof folder.id !== 'number') {
      throw new Error(`Storyblok folder ${folderSlug} was not found`)
    }
    return { id: folder.id, fullSlug: typeof folder.full_slug === 'string' ? folder.full_slug : folderSlug }
  }

  async function findPublishedStory(fullSlug: string): Promise<number | null> {
    const query = new URLSearchParams({ by_slugs: fullSlug })
    const response = (await requestJson(`/stories?${query}`)) as { stories?: unknown }
    const story = Array.isArray(response.stories)
      ? response.stories.find(
          (candidate): candidate is { id: number; published: unknown } =>
            typeof candidate === 'object' && candidate !== null && typeof (candidate as { id?: unknown }).id === 'number',
        )
      : undefined
    if (!story) return null
    if (story.published !== true) throw new Error(`Storyblok story ${fullSlug} exists but is not published`)
    return story.id
  }

  async function uploadAttachment(attachment: { content: Buffer; filename: string; contentType: string }): Promise<string> {
    const signed = (await requestJson('/assets/', {
      method: 'POST',
      body: JSON.stringify({ filename: attachment.filename, validate_upload: 1 }),
    })) as Partial<SignedUpload>
    if (
      typeof signed.id !== 'number' ||
      typeof signed.post_url !== 'string' ||
      !signed.fields ||
      typeof signed.fields !== 'object'
    ) {
      throw new Error('Storyblok returned an invalid signed asset upload response')
    }

    const form = new FormData()
    for (const [key, value] of Object.entries(signed.fields)) form.append(key, value)
    form.append('file', new Blob([Uint8Array.from(attachment.content)], { type: attachment.contentType }), attachment.filename)
    const upload = await fetcher(signed.post_url, { method: 'POST', body: form })
    if (!upload.ok) throw new Error(`Storyblok asset upload failed (${upload.status})`)

    const completed = (await requestJson(`/assets/${signed.id}/finish_upload`)) as {
      asset?: { filename?: unknown }
    }
    const filename = completed.asset?.filename
    if (typeof filename !== 'string' || filename.length === 0) {
      throw new Error('Storyblok did not return an uploaded asset filename')
    }
    return filename
  }

  return {
    async publish(parsed, publicationKey) {
      assertMessageIdIsPrivate(parsed, publicationKey)
      const folder = await findFolder()
      const slug = `newsletter-${publicationKey}`
      const fullSlug = `${folder.fullSlug}/${slug}`
      const existingStoryId = await findPublishedStory(fullSlug)
      if (existingStoryId !== null) return { storyId: existingStoryId }

      const filenamesByCid = new Map<string, string>()
      for (const [cid, attachment] of parsed.attachmentsByCid) {
        filenamesByCid.set(cid, await uploadAttachment(attachment))
      }
      const blocks = parsed.blocks.map((block) => toStoryblokBlock(block, filenamesByCid, uuid))
      const story = {
        name: slug,
        slug,
        parent_id: folder.id,
        content: {
          _uid: uuid(),
          component: 'newsletter',
          sent_at: parsed.sentAt,
          subject: parsed.subject,
          blocks,
        },
      }
      try {
        const created = (await requestJson('/stories', {
          method: 'POST',
          body: JSON.stringify({ publish: true, story }),
        })) as { story?: { id?: unknown; published?: unknown } }
        if (typeof created.story?.id === 'number' && created.story.published === true) {
          return { storyId: created.story.id }
        }
      } catch (error) {
        const recoveredStoryId = await findPublishedStory(fullSlug)
        if (recoveredStoryId !== null) return { storyId: recoveredStoryId }
        throw error
      }
      const recoveredStoryId = await findPublishedStory(fullSlug)
      if (recoveredStoryId !== null) return { storyId: recoveredStoryId }
      throw new Error('Storyblok did not confirm publication of the newsletter story')
    },
  }
}

function assertMessageIdIsPrivate(parsed: ParsedNewsletter, publicationKey: string): void {
  const publicStrings = [
    publicationKey,
    parsed.subject,
    ...[...parsed.attachmentsByCid.values()].map((attachment) => attachment.filename),
  ]
  for (const block of parsed.blocks) {
    switch (block.type) {
      case 'paragraph':
        publicStrings.push(block.text)
        break
      case 'image':
        publicStrings.push(block.alt, ...(block.caption ? [block.caption] : []))
        break
      case 'link':
        publicStrings.push(block.label, block.href)
        break
      case 'divider':
        break
    }
  }
  if (publicStrings.some((value) => value.includes(parsed.messageId))) {
    throw new Error('Message-ID must not appear in public Storyblok payload fields')
  }
}

function toStoryblokBlock(block: ParsedBlock, filenamesByCid: ReadonlyMap<string, string>, uuid: () => string) {
  switch (block.type) {
    case 'paragraph':
      return { _uid: uuid(), component: 'newsletter_paragraph', text: block.text }
    case 'image': {
      const filename = filenamesByCid.get(block.cid)
      if (!filename) throw new Error(`Missing CID attachment for ${block.cid}`)
      const caption = block.caption
      return {
        _uid: uuid(),
        component: 'newsletter_image',
        image: { filename },
        alt: caption || '小村碎碎念圖片',
        ...(caption ? { caption } : {}),
      }
    }
    case 'link':
      return { _uid: uuid(), component: 'newsletter_link', label: block.label, href: { url: block.href } }
    case 'divider':
      return { _uid: uuid(), component: 'newsletter_divider' }
  }
}
