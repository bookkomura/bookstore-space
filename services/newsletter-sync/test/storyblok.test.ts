import { describe, expect, it, vi } from 'vitest'

import { createStoryblokPublisher } from '../src/storyblok.js'

const newsletter = {
  messageId: '<private-message-id@example.test>',
  sentAt: '2026-07-19T05:40:25.000Z',
  subject: '小村碎碎念～總是會到 <private-message-id@example.test>',
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

    await expect(publisher.publish(newsletter)).resolves.toEqual({ storyId: 99 })

    const folderRequest = new URL(fetcher.mock.calls[0][0] as string)
    expect(folderRequest.pathname).toBe('/v1/spaces/space/stories')
    expect(folderRequest.searchParams.get('folder_only')).toBe('true')
    expect(folderRequest.searchParams.get('search')).toBe('newsletters')

    const signedAssetRequest = new Request(fetcher.mock.calls[1][0], fetcher.mock.calls[1][1])
    expect(await signedAssetRequest.json()).toEqual({ filename: 'market.jpg', validate_upload: 1 })
    expect(fetcher.mock.calls[2][0]).toBe('https://uploads.example.test/')

    const storyRequest = new Request(fetcher.mock.calls[4][0], fetcher.mock.calls[4][1])
    const payload = (await storyRequest.json()) as { publish: boolean; story: Record<string, unknown> }
    expect(payload.publish).toBe(true)
    expect(payload.story).toMatchObject({
      name: '小村碎碎念～總是會到',
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
    expect(String(payload.story.slug)).not.toContain(newsletter.messageId)
  })

  it('fails when Storyblok does not confirm the created story is published', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ stories: [{ id: 42, slug: 'newsletters', is_folder: true }] }))
      .mockResolvedValueOnce(jsonResponse({ story: { id: 99, published: false } }))
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

    await expect(publisher.publish(withoutAssets)).rejects.toThrow('did not confirm publication')
  })
})
