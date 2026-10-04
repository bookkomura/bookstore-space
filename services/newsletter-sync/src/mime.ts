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
  type Paragraph = { text: string; links: Extract<ParsedBlock, { type: 'link' }>[] }

  function flush(paragraph?: Paragraph) {
    if (!paragraph) return
    const text = normalizeText(paragraph.text)
    const linkText = normalizeText(paragraph.links.map((link) => link.label).join(''))
    // A standalone action link already carries its label; inline links need the full sentence.
    if (text && (paragraph.links.length === 0 || text !== linkText)) {
      blocks.push({ type: 'paragraph', text })
    }
    blocks.push(...paragraph.links)
    paragraph.text = ''
    paragraph.links = []
  }

  function walk(nodes: ReturnType<typeof $>, paragraph?: Paragraph) {
    nodes.each((_, element) => {
      if (captionElements.has(element)) return
      if (element.type === 'text') {
        if (paragraph) paragraph.text += element.data
        return
      }
      if (element.type !== 'tag') return
      const node = $(element)

      if (node.is(`${PARAGRAPH_SELECTOR},div`)) {
        flush(paragraph)
        const nested: Paragraph = { text: '', links: [] }
        walk(node.contents(), nested)
        flush(nested)
        return
      }

      if (node.is('img[src^="cid:"]')) {
        const cid = normalizeCid(node.attr('src')?.slice('cid:'.length))
        if (!cid) return
        flush(paragraph)
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

      if (element.tagName === 'hr') {
        flush(paragraph)
        blocks.push({ type: 'divider' })
        return
      }

      const href = node.attr('href')
      if (element.tagName === 'a' && href !== undefined) {
        walk(node.contents(), paragraph)
        if (isHttpsUrl(href)) {
          const link = { type: 'link' as const, label: normalizeText(node.text()), href }
          if (paragraph) paragraph.links.push(link)
          else blocks.push(link)
        }
        return
      }

      if (element.tagName === 'br' && paragraph) paragraph.text += ' '
      else walk(node.contents(), paragraph)
    })
  }

  walk($.root().contents())

  return blocks
}

function followingCaptionNode(node: ReturnType<ReturnType<typeof load>>) {
  const next = node.next()
  const captionSelector = `${PARAGRAPH_SELECTOR},div`
  return next.is('br') ? next.next(captionSelector).first() : next.filter(captionSelector)
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
