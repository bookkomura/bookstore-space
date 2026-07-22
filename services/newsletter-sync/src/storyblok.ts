import { randomUUID } from 'node:crypto'

import type { ParsedBlock, ParsedNewsletter } from './mime.js'

export interface StoryblokPublisher {
  publish(parsed: ParsedNewsletter): Promise<{ storyId: number }>
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

  async function findFolderId(): Promise<number> {
    const query = new URLSearchParams({ folder_only: 'true', search: folderSlug, per_page: '100' })
    const response = (await requestJson(`/stories?${query}`)) as { stories?: unknown }
    const folder = Array.isArray(response.stories)
      ? response.stories.find(
          (candidate): candidate is { id: unknown; slug: unknown; is_folder: unknown } =>
            typeof candidate === 'object' &&
            candidate !== null &&
            (candidate as { slug?: unknown }).slug === folderSlug &&
            (candidate as { is_folder?: unknown }).is_folder === true,
        )
      : undefined
    if (!folder || typeof folder.id !== 'number') {
      throw new Error(`Storyblok folder ${folderSlug} was not found`)
    }
    return folder.id
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
    async publish(parsed) {
      const folderId = await findFolderId()
      const filenamesByCid = new Map<string, string>()
      for (const [cid, attachment] of parsed.attachmentsByCid) {
        filenamesByCid.set(cid, await uploadAttachment(attachment))
      }
      const blocks = parsed.blocks.map((block) => toStoryblokBlock(block, filenamesByCid, uuid))
      const subject = publicSubject(parsed.subject, parsed.messageId)
      const story = {
        name: subject,
        slug: `newsletter-${new Date(parsed.sentAt).getTime()}-${uuid()}`,
        parent_id: folderId,
        content: {
          _uid: uuid(),
          component: 'newsletter',
          sent_at: parsed.sentAt,
          subject,
          blocks,
        },
      }
      const created = (await requestJson('/stories', {
        method: 'POST',
        body: JSON.stringify({ publish: true, story }),
      })) as { story?: { id?: unknown; published?: unknown } }
      if (typeof created.story?.id !== 'number' || created.story.published !== true) {
        throw new Error('Storyblok did not confirm publication of the newsletter story')
      }
      return { storyId: created.story.id }
    },
  }
}

function publicSubject(subject: string, messageId: string): string {
  const sanitized = subject.replaceAll(messageId, '').replace(/\s+/g, ' ').trim()
  return sanitized || '小村碎碎念'
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
