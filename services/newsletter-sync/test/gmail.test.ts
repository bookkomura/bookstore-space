import { describe, expect, it, vi } from 'vitest'

import {
  HistoryCursorExpiredError,
  createGmailGateway,
  isEligibleMessage,
} from '../src/gmail.js'

describe('isEligibleMessage', () => {
  it('accepts only the configured newsletter in Inbox', () => {
    expect(
      isEligibleMessage({
        from: 'info.rewildesign@gmail.com',
        subject: '小村碎碎念～總是會到',
        labelIds: ['INBOX', 'UNREAD'],
      }),
    ).toBe(true)
  })

  it.each([
    { from: 'other@example.com', subject: '小村碎碎念～總是會到', labelIds: ['INBOX'] },
    { from: 'info.rewildesign@gmail.com', subject: '週報', labelIds: ['INBOX'] },
    { from: 'info.rewildesign@gmail.com', subject: '小村碎碎念～總是會到', labelIds: ['UNREAD'] },
  ])('rejects ineligible metadata: %#', (input) => {
    expect(isEligibleMessage(input)).toBe(false)
  })
})

describe('createGmailGateway', () => {
  it('pages added messages, deduplicates ids, and returns raw Inbox refs', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          history: [
            { messagesAdded: [{ message: { id: 'one' } }, { message: { id: 'two' } }] },
            { messagesAdded: [{ message: { id: 'one' } }] },
          ],
          nextPageToken: 'next-page',
        },
      })
      .mockResolvedValueOnce({
        data: { history: [{ messagesAdded: [{ message: { id: 'three' } }] }] },
      })
    const get = vi.fn(async ({ id }: { id: string }) => ({
      data: { raw: `${id}-raw`, labelIds: ['INBOX'] },
    }))
    const client = { users: { history: { list }, messages: { get } } }

    const gateway = createGmailGateway(client as never, 'mailbox@example.com')

    await expect(gateway.fetchHistorySince('456')).resolves.toEqual([
      { gmailMessageId: 'one', raw: 'one-raw', labelIds: ['INBOX'] },
      { gmailMessageId: 'two', raw: 'two-raw', labelIds: ['INBOX'] },
      { gmailMessageId: 'three', raw: 'three-raw', labelIds: ['INBOX'] },
    ])
    expect(list).toHaveBeenNthCalledWith(1, {
      userId: 'mailbox@example.com',
      startHistoryId: '456',
      historyTypes: ['messageAdded'],
    })
    expect(list).toHaveBeenNthCalledWith(2, {
      userId: 'mailbox@example.com',
      startHistoryId: '456',
      historyTypes: ['messageAdded'],
      pageToken: 'next-page',
    })
    expect(get).toHaveBeenCalledTimes(3)
    expect(get).toHaveBeenCalledWith({ userId: 'mailbox@example.com', id: 'one', format: 'raw' })
  })

  it('maps an expired Gmail history cursor to a dedicated error', async () => {
    const error = Object.assign(new Error('history unavailable'), { code: 404 })
    const client = { users: { history: { list: vi.fn().mockRejectedValue(error) }, messages: { get: vi.fn() } } }
    const gateway = createGmailGateway(client as never)

    await expect(gateway.fetchHistorySince('456')).rejects.toBeInstanceOf(HistoryCursorExpiredError)
  })

  it('renews an Inbox-only watch on the provisioned topic', async () => {
    const watch = vi.fn().mockResolvedValue({ data: { historyId: '300', expiration: '1785542400000' } })
    const client = { users: { watch } }
    const gateway = createGmailGateway(client as never, 'mailbox@example.com')

    await expect(gateway.renewInboxWatch('projects/bookstore-space/topics/newsletter-sync')).resolves.toEqual({
      historyId: '300',
      expiration: '1785542400000',
    })
    expect(watch).toHaveBeenCalledWith({
      userId: 'mailbox@example.com',
      requestBody: { labelIds: ['INBOX'], topicName: 'projects/bookstore-space/topics/newsletter-sync' },
    })
  })

  it('finds recent matching Inbox messages in chronological order', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ data: { messages: [{ id: 'newer' }], nextPageToken: 'next-page' } })
      .mockResolvedValueOnce({ data: { messages: [{ id: 'older' }] } })
    const get = vi.fn(async ({ id }: { id: string }) => ({
      data: {
        raw: `${id}-raw`,
        labelIds: ['INBOX'],
        internalDate: id === 'older' ? '100' : '200',
      },
    }))
    const client = { users: { messages: { list, get } } }
    const gateway = createGmailGateway(client as never, 'mailbox@example.com')

    await expect(gateway.findRecentInbox(30)).resolves.toEqual([
      { gmailMessageId: 'older', raw: 'older-raw', labelIds: ['INBOX'] },
      { gmailMessageId: 'newer', raw: 'newer-raw', labelIds: ['INBOX'] },
    ])
    expect(list).toHaveBeenNthCalledWith(1, {
      userId: 'mailbox@example.com',
      q: 'in:inbox from:info.rewildesign@gmail.com subject:小村碎碎念 newer_than:30d',
    })
    expect(list).toHaveBeenNthCalledWith(2, {
      userId: 'mailbox@example.com',
      q: 'in:inbox from:info.rewildesign@gmail.com subject:小村碎碎念 newer_than:30d',
      pageToken: 'next-page',
    })
  })

  it('fails retryably before downloading raw MIME when the recent Inbox result exceeds its safety limit', async () => {
    const messages = Array.from({ length: 101 }, (_, index) => ({ id: `message-${index}` }))
    const list = vi.fn().mockResolvedValue({ data: { messages } })
    const get = vi.fn()
    const client = { users: { messages: { list, get } } }
    const gateway = createGmailGateway(client as never, 'mailbox@example.com')

    await expect(gateway.findRecentInbox(30)).rejects.toThrow('Recent Inbox result exceeds the 100-message safety limit')

    expect(get).not.toHaveBeenCalled()
  })
})
