import { load } from 'cheerio'
import { simpleParser } from 'mailparser'

export type ParsedBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'image'; cid: string; alt: string; caption?: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'divider' }

export interface ParsedNewsletter {
  messageId: string
  sentAt: string
  subject: string
  from: string
  blocks: ParsedBlock[]
  attachmentsByCid: ReadonlyMap<
    string,
    { content: Buffer; filename: string; contentType: string }
  >
}

const PARAGRAPH_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li'
const MESSAGE_ID = /^<[^<>\s@]+@[^<>\s@]+>$/

export async function parseNewsletterMime(raw: string): Promise<ParsedNewsletter> {
  const message = await simpleParser(Buffer.from(raw, 'base64url'), { skipImageLinks: true })
  const messageId = message.messageId?.trim() ?? ''
  if (!MESSAGE_ID.test(messageId)) throw new Error('A valid RFC Message-ID is required')

  const from = message.from?.value[0]?.address ?? ''
  const subject = message.subject ?? ''
  const sentAt = message.date?.toISOString()
  if (!sentAt) throw new Error('A readable sent date is required')

  const attachmentsByCid = new Map<string, { content: Buffer; filename: string; contentType: string }>()
  for (const attachment of message.attachments) {
    const cid = normalizeCid(attachment.cid)
    if (!cid) continue
    attachmentsByCid.set(cid, {
      content: attachment.content,
      filename: attachment.filename ?? cid,
      contentType: attachment.contentType,
    })
  }

  const blocks = parseHtmlBlocks(typeof message.html === 'string' ? message.html : '')
  if (blocks.length === 0 && typeof message.text === 'string') {
    for (const line of message.text.split(/\r?\n/)) {
      const text = normalizeText(line)
      if (text) blocks.push({ type: 'paragraph', text })
    }
  }

  if (blocks.length === 0) throw new Error('A readable newsletter body with blocks is required')

  return {
    messageId,
    sentAt,
    subject,
    from,
    blocks,
    attachmentsByCid,
  }
}

function parseHtmlBlocks(html: string): ParsedBlock[] {
  if (!html) return []

  const $ = load(html)
  $('script,style,noscript').remove()
  const captionElements = new Set<unknown>()
  const blocks: ParsedBlock[] = []

  $(`${PARAGRAPH_SELECTOR},div,img[src^="cid:"],a[href],hr`).each((_, element) => {
    if (captionElements.has(element)) return
    const node = $(element)

    if (element.tagName === 'img') {
      const cid = normalizeCid(node.attr('src')?.slice('cid:'.length))
      if (!cid) return
      const captionNode = followingCaptionNode(node)
      const caption = captionNode.length === 1 ? normalizeText(captionNode.text()) : ''
      if (caption) captionElements.add(captionNode.get(0))
      blocks.push({
        type: 'image',
        cid,
        alt: normalizeText(node.attr('alt') ?? ''),
        ...(caption ? { caption } : {}),
      })
      return
    }

    if (element.tagName === 'a') {
      const href = node.attr('href')
      if (!href || !isHttpsUrl(href)) return
      blocks.push({ type: 'link', label: normalizeText(node.text()), href })
      return
    }

    if (element.tagName === 'hr') {
      blocks.push({ type: 'divider' })
      return
    }

    const text = normalizeText(element.tagName === 'div' ? directText(node) : node.text())
    if (text) blocks.push({ type: 'paragraph', text })
  })

  return blocks
}

function directText(node: ReturnType<ReturnType<typeof load>>): string {
  return node
    .contents()
    .filter((_, child) => child.type === 'text')
    .text()
}

function followingCaptionNode(node: ReturnType<ReturnType<typeof load>>) {
  const next = node.next()
  if (next.is(`${PARAGRAPH_SELECTOR},div`)) return next
  return next.is('br') ? next.next(`${PARAGRAPH_SELECTOR},div`).first() : next
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeCid(value: string | undefined): string | undefined {
  const cid = value?.trim().replace(/^<|>$/g, '')
  return cid || undefined
}
