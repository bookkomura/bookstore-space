import { describe, expect, it, vi } from 'vitest'

import { createStoryblokPublisher } from '../src/storyblok.js'

const newsletter = {
  messageId: '<private-message-id@example.test>',
  sentAt: '2026-07-19T05:40:25.000Z',
  subject: '小村碎碎念～總是會到',
  from: 'info.rewildesign@gmail.com',
  blocks: [
    { type: 'paragraph' as const, text: '前言' },
    { type: 'image' as const, cid: 'photo-1', alt: '寄件人提供的替代文字', caption: '夏日市集' },
    { type: 'link' as const, label: '報名', href: 'https://example.test/register' },
    { type: 'divider' as const },
  ],
  attachmentsByCid: new Map([
    ['photo-1', { content: Buffer.from('image-bytes'), filename: 'market.jpg', contentType: 'image/jpeg' }],
  ]),
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('createStoryblokPublisher', () => {
  it('uploads CID assets then publishes a public newsletter payload with no Message-ID', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 42, slug: 'newsletters', is_folder: true }] }))
      .mockResolvedValueOnce(jsonResponse({ stories: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 7,
          post_url: 'https://uploads.example.test/',
          fields: { key: 'f/space/market.jpg', policy: 'signed-policy' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ asset: { id: 7, filename: 'https://a.storyblok.com/f/space/market.jpg' } }))
      .mockResolvedValueOnce(jsonResponse({ story: { id: 99, published: true } }))
    const publisher = createStoryblokPublisher({
      spaceId: 'space',
      managementToken: 'management-token',
      fetcher,
      uuid: () => 'uid-1',
    })

    await expect(publisher.publish(newsletter, 'publication-key')).resolves.toEqual({ storyId: 99 })

    const folderRequest = new URL(fetcher.mock.calls[0][0] as string)
    expect(folderRequest.pathname).toBe('/v1/spaces/space/stories')
    expect(folderRequest.searchParams.get('folder_only')).toBe('true')
    expect(folderRequest.searchParams.get('search')).toBe('newsletters')

    const existingStoryRequest = new URL(fetcher.mock.calls[1][0] as string)
    expect(existingStoryRequest.searchParams.get('by_slugs')).toBe('newsletters/newsletter-publication-key')

    const signedAssetRequest = new Request(fetcher.mock.calls[2][0], fetcher.mock.calls[2][1])
    expect(await signedAssetRequest.json()).toEqual({ filename: 'market.jpg', validate_upload: 1 })
    expect(fetcher.mock.calls[3][0]).toBe('https://uploads.example.test/')

    const storyRequest = new Request(fetcher.mock.calls[5][0], fetcher.mock.calls[5][1])
    const payload = (await storyRequest.json()) as { publish: boolean; story: Record<string, unknown> }
    expect(payload.publish).toBe(true)
    expect(payload.story).toMatchObject({
      name: 'newsletter-publication-key',
      slug: 'newsletter-publication-key',
      parent_id: 42,
      content: {
        component: 'newsletter',
        sent_at: newsletter.sentAt,
        subject: '小村碎碎念～總是會到',
        blocks: [
          { component: 'newsletter_paragraph', text: '前言' },
          {
            component: 'newsletter_image',
            image: { filename: 'https://a.storyblok.com/f/space/market.jpg' },
            alt: '夏日市集',
            caption: '夏日市集',
          },
          { component: 'newsletter_link', label: '報名', href: { url: 'https://example.test/register' } },
          { component: 'newsletter_divider' },
        ],
      },
    })
    expect(JSON.stringify(payload)).not.toContain(newsletter.messageId)
    expect(String(payload.story.slug)).toBe('newsletter-publication-key')
  })

  it('recovers a published story by deterministic slug when a create response is lost', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 42, slug: 'newsletters', is_folder: true }] }))
      .mockResolvedValueOnce(jsonResponse({ stories: [] }))
      .mockRejectedValueOnce(new Error('connection reset after create'))
      .mockResolvedValueOnce(
        jsonResponse({ stories: [{ id: 99, slug: 'newsletter-publication-key', published: true }] }),
      )
    const publisher = createStoryblokPublisher({
      spaceId: 'space',
      managementToken: 'management-token',
      fetcher,
      uuid: () => 'uid-1',
    })
    const withoutAssets = {
      ...newsletter,
      blocks: [{ type: 'paragraph' as const, text: '內容' }],
      attachmentsByCid: new Map(),
    }

    await expect(publisher.publish(withoutAssets, 'publication-key')).resolves.toEqual({ storyId: 99 })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('publishes and re-verifies an existing deterministic draft instead of creating another story', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 42, slug: 'newsletters', is_folder: true }] }))
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 99, slug: 'newsletter-publication-key', published: false }] }))
      .mockResolvedValueOnce(jsonResponse({ story: { id: 99 } }))
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 99, slug: 'newsletter-publication-key', published: true }] }))
    const publisher = createStoryblokPublisher({ spaceId: 'space', managementToken: 'management-token', fetcher, uuid: () => 'uid-1' })

    await expect(publisher.publish(newsletter, 'publication-key')).resolves.toEqual({ storyId: 99 })

    const publishRequest = new Request(fetcher.mock.calls[2][0], fetcher.mock.calls[2][1])
    expect(publishRequest.url).toBe('https://mapi.storyblok.com/v1/spaces/space/stories/99/publish')
    expect(publishRequest.method).toBe('GET')
    expect(fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/stories') && init?.method === 'POST')).toHaveLength(0)
  })

  it.each([
    ['subject', (issue: typeof newsletter) => ({ ...issue, subject: issue.messageId })],
    ['paragraph', (issue: typeof newsletter) => ({ ...issue, blocks: [{ type: 'paragraph' as const, text: issue.messageId }] })],
    ['image alt', (issue: typeof newsletter) => ({ ...issue, blocks: [{ type: 'image' as const, cid: 'photo-1', alt: issue.messageId }] })],
    ['image caption', (issue: typeof newsletter) => ({ ...issue, blocks: [{ type: 'image' as const, cid: 'photo-1', alt: 'alt', caption: issue.messageId }] })],
    ['link label', (issue: typeof newsletter) => ({ ...issue, blocks: [{ type: 'link' as const, label: issue.messageId, href: 'https://example.test' }] })],
    ['link href', (issue: typeof newsletter) => ({ ...issue, blocks: [{ type: 'link' as const, label: 'label', href: `https://example.test/${issue.messageId}` }] })],
    ['attachment filename', (issue: typeof newsletter) => ({ ...issue, attachmentsByCid: new Map([['photo-1', { content: Buffer.from('x'), filename: issue.messageId, contentType: 'image/jpeg' }]]) })],
  ])('rejects a Message-ID in public %s before making any Storyblok request', async (_, mutate) => {
    const fetcher = vi.fn<typeof fetch>()
    const publisher = createStoryblokPublisher({
      spaceId: 'space',
      managementToken: 'management-token',
      fetcher,
      uuid: () => 'uid-1',
    })

    await expect(publisher.publish(mutate(newsletter), 'publication-key')).rejects.toThrow('Message-ID')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a corrupt publication key containing the Message-ID before making any Storyblok request', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const publisher = createStoryblokPublisher({
      spaceId: 'space',
      managementToken: 'management-token',
      fetcher,
      uuid: () => 'uid-1',
    })

    await expect(publisher.publish(newsletter, newsletter.messageId)).rejects.toThrow('Message-ID')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
