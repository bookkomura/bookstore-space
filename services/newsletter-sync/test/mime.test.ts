import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import { parseNewsletterMime } from '../src/mime.js'
const fixturePath = new URL('./fixtures/newsletter.eml', import.meta.url)

async function fixtureRaw(): Promise<string> {
  return (await readFile(fixturePath)).toString('base64url')
}

function rawMime(html: string, messageId = '<newsletter@example.test>'): string {
  return Buffer.from(
    [
      'From: info.rewildesign@gmail.com',
      'To: reader@example.test',
      'Subject: 小村碎碎念測試',
      `Message-ID: ${messageId}`,
      'Date: Sat, 19 Jul 2026 05:40:25 +0000',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n'),
  ).toString('base64url')
}

describe('parseNewsletterMime', () => {
  it('retains safe fixture metadata, four CID attachments, and only HTTPS action links', async () => {
    const parsed = await parseNewsletterMime(await fixtureRaw())

    expect(parsed).toMatchObject({
      from: 'info.rewildesign@gmail.com',
      subject: '小村碎碎念～總是會到',
      sentAt: '2026-07-19T05:40:25.000Z',
    })
    expect(parsed.messageId).toMatch(/^<[^<>\s]+@[^<>\s]+>$/)
    expect(parsed).not.toHaveProperty('gmailMessageId')
    expect([...parsed.attachmentsByCid.keys()]).toEqual([
      'ii_mrrbokpd0',
      'ii_mrrbxm7k1',
      'ii_mrrc4xt92',
      'ii_mrrca4t33',
    ])
    expect(parsed.blocks.filter((block) => block.type === 'image').map((block) => block.cid)).toEqual([
      'ii_mrrbokpd0',
      'ii_mrrbxm7k1',
      'ii_mrrc4xt92',
      'ii_mrrca4t33',
    ])
    const links = parsed.blocks.filter((block) => block.type === 'link')
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((block) => new URL(block.href).protocol === 'https:')).toBe(true)
  })

  it('keeps fixture paragraphs before the CID images in source order', async () => {
    const parsed = await parseNewsletterMime(await fixtureRaw())
    const expectedCids = ['ii_mrrbokpd0', 'ii_mrrbxm7k1', 'ii_mrrc4xt92', 'ii_mrrca4t33']
    const firstParagraphIndex = parsed.blocks.findIndex(
      (block) => block.type === 'paragraph' && block.text.length > 0,
    )
    const imageIndexes = expectedCids.map((cid) =>
      parsed.blocks.findIndex((block) => block.type === 'image' && block.cid === cid),
    )

    expect(firstParagraphIndex).toBeGreaterThanOrEqual(0)
    expect(firstParagraphIndex).toBeLessThan(imageIndexes[0])
    expect(imageIndexes).toEqual([...imageIndexes].sort((left, right) => left - right))
    for (const index of imageIndexes) expect(index).toBeGreaterThan(firstParagraphIndex)

    for (const block of parsed.blocks) {
      if (block.type === 'image' && block.caption) {
        expect(parsed.blocks.indexOf(block)).toBeGreaterThanOrEqual(firstParagraphIndex)
      }
    }

    expect(parsed.blocks[imageIndexes[1]]).toEqual({
      type: 'image',
      cid: 'ii_mrrbxm7k1',
      alt: '0719-2.jpg',
      caption: '但，就在１８當天早些，長這樣，',
    })

    const expectedActionLinks = [
      { label: '７月場的頌缽', href: 'https://forms.gle/bowoKGVek8yKGx2k6' },
      { label: '大人晚自習', href: 'https://forms.gle/iSdSgK7x5cmjpGJz8' },
      { label: '荒野協會要來教你夏日節電', href: 'https://www.sow.org.tw/civicrm/event/info?reset=1&id=14210' },
      {
        label: '家族排列帶你走過中年危機',
        href: 'https://docs.google.com/forms/d/1i6tTl7sBgF-Uvzbj03LPbvtNezmJankzLXN2slxW6Cc/viewform?edit_requested=true',
      },
    ]
    const linkIndexes = expectedActionLinks.map((link) =>
      parsed.blocks.findIndex(
        (block) => block.type === 'link' && block.label === link.label && block.href === link.href,
      ),
    )

    expect(linkIndexes).toEqual([...linkIndexes].sort((left, right) => left - right))
    for (const index of linkIndexes) expect(index).toBeGreaterThan(imageIndexes[3])
  })

  it('preserves paragraph, image, caption, divider, and link order without emitting HTML', async () => {
    const parsed = await parseNewsletterMime(
      rawMime(
        '<p>前言</p><img src="cid:photo-1" alt="山景"><p>圖片說明</p><hr><a href="https://example.test/action">行動連結</a>',
      ),
    )

    expect(parsed.blocks).toEqual([
      { type: 'paragraph', text: '前言' },
      { type: 'image', cid: 'photo-1', alt: '山景', caption: '圖片說明' },
      { type: 'divider' },
      { type: 'link', label: '行動連結', href: 'https://example.test/action' },
    ])
    expect(JSON.stringify(parsed.blocks)).not.toContain('<')
  })

  it('does not treat a non-paragraph sibling as an image caption', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<img src="cid:photo-1" alt="山景"><span>不是圖片說明</span><p>後續段落</p>'),
    )

    expect(parsed.blocks).toEqual([
      { type: 'image', cid: 'photo-1', alt: '山景' },
      { type: 'paragraph', text: '後續段落' },
    ])
  })

  it('rejects unreadable body data and a missing or malformed Message-ID', async () => {
    await expect(parseNewsletterMime('not-a-message')).rejects.toThrow('Message-ID')
    await expect(parseNewsletterMime(rawMime('<p>內容</p>', 'not-an-rfc-message-id'))).rejects.toThrow(
      'Message-ID',
    )
    await expect(parseNewsletterMime(rawMime(''))).rejects.toThrow('readable newsletter body')
  })

  it('drops non-HTTPS anchors', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<p>安全內容</p><a href="http://example.test/insecure">不安全</a>'),
    )

    expect(parsed.blocks).toEqual([{ type: 'paragraph', text: '安全內容' }])
  })

  it('keeps colored, highlighted, and bold text in div paragraphs', async () => {
    const parsed = await parseNewsletterMime(
      rawMime(
        '<div>嗨～</div><div>阿～～<span style="color:red"><b>至少我們很好停車</b></span>（？</div>' +
        '<div><strong>空間新又大、光線美氣氛佳</strong>、</div>' +
        '<div>我們這個村，<font color="#ff00ff">有村民還有你</font>，</div>' +
        '<div>還有一大堆<mark>雨後春筍</mark>的有趣活動耶</div>',
      ),
    )

    expect(parsed.blocks).toEqual([
      { type: 'paragraph', text: '嗨～' },
      { type: 'paragraph', text: '阿～～至少我們很好停車（？' },
      { type: 'paragraph', text: '空間新又大、光線美氣氛佳、' },
      { type: 'paragraph', text: '我們這個村，有村民還有你，' },
      { type: 'paragraph', text: '還有一大堆雨後春筍的有趣活動耶' },
    ])
  })

  it('keeps inline link labels in the sentence and retains HTTPS action links', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<div>下周有<a href="https://example.test/civil"><span>民防</span></a>、' +
        '<a href="https://example.test/flowers">花藝</a>、讀書會</div>'),
    )

    expect(parsed.blocks).toEqual([
      { type: 'paragraph', text: '下周有民防、花藝、讀書會' },
      { type: 'link', label: '民防', href: 'https://example.test/civil' },
      { type: 'link', label: '花藝', href: 'https://example.test/flowers' },
    ])
  })

  it.each(['http://example.test', 'javascript:alert(1)', 'mailto:reader@example.test', 'invalid'])(
    'keeps inline text without emitting an unsafe link: %s',
    async (href) => {
      const parsed = await parseNewsletterMime(rawMime(`<div>參加<a href="${href}">活動</a>吧</div>`))

      expect(parsed.blocks).toEqual([{ type: 'paragraph', text: '參加活動吧' }])
    },
  )

  it('keeps nested blocks and surrounding text in source order without duplicates', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<div>開頭<span>文字</span><div><b>內層段落</b></div>接續文字' +
        '<p>另一段<em>文字</em></p><ul><li><div>項目一</div></li><li>項目二</li></ul>' +
        '圖片之前<img src="cid:photo-1" alt="山景"><span>圖片之後</span><hr>結尾</div>'),
    )

    expect(parsed.blocks).toEqual([
      { type: 'paragraph', text: '開頭文字' },
      { type: 'paragraph', text: '內層段落' },
      { type: 'paragraph', text: '接續文字' },
      { type: 'paragraph', text: '另一段文字' },
      { type: 'paragraph', text: '項目一' },
      { type: 'paragraph', text: '項目二' },
      { type: 'paragraph', text: '圖片之前' },
      { type: 'image', cid: 'photo-1', alt: '山景' },
      { type: 'paragraph', text: '圖片之後' },
      { type: 'divider' },
      { type: 'paragraph', text: '結尾' },
    ])
  })

  it('separates words around line breaks inside formatted text', async () => {
    const parsed = await parseNewsletterMime(rawMime('<div><span>first<br>second</span></div>'))

    expect(parsed.blocks).toEqual([{ type: 'paragraph', text: 'first second' }])
  })

  it('keeps standalone action links without repeating their labels as paragraphs', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<div><a href="https://example.test"><b>報名活動</b></a></div>'),
    )

    expect(parsed.blocks).toEqual([{ type: 'link', label: '報名活動', href: 'https://example.test' }])
  })

  it('retains CID images inside standalone anchors before their links', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<a href="https://example.test"><img src="cid:photo-1" alt="山景"></a>'),
    )

    expect(parsed.blocks).toEqual([
      { type: 'image', cid: 'photo-1', alt: '山景' },
      { type: 'link', label: '', href: 'https://example.test' },
    ])
  })

  it('consumes the entire formatted caption without repeating its nested blocks or links', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<p>前言</p><img src="cid:photo-1" alt="山景"><br>' +
        '<div><div><span style="color:red">圖片</span><a href="https://example.test">說明</a></div></div>' +
        '<div>後續段落</div>'),
    )

    expect(parsed.blocks).toEqual([
      { type: 'paragraph', text: '前言' },
      { type: 'image', cid: 'photo-1', alt: '山景', caption: '圖片說明' },
      { type: 'paragraph', text: '後續段落' },
    ])
  })

  it('drops script, style, and noscript content from paragraphs', async () => {
    const parsed = await parseNewsletterMime(
      rawMime('<p>安全文字<script>window.alert("x")</script><style>.hidden { display: none }</style><noscript>替代文字</noscript></p>'),
    )

    expect(parsed.blocks).toEqual([{ type: 'paragraph', text: '安全文字' }])
  })
})
