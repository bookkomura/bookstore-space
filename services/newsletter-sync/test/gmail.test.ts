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
})
