import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import { HistoryCursorExpiredError } from '../src/gmail.js'
import { createHttpApp } from '../src/http.js'

const secret = 'replay-secret'

function createDependencies() {
  return {
    config: { gmailPubsubTopic: 'projects/bookstore-space/topics/newsletter-sync', replaySharedSecret: secret },
    service: {
      syncHistory: vi.fn().mockResolvedValue({ examined: 0, published: 0, duplicates: 0 }),
      process: vi.fn().mockResolvedValue('published'),
    },
    gateway: {
      renewInboxWatch: vi.fn().mockResolvedValue({ historyId: '300', expiration: '2026-08-01T00:00:00.000Z' }),
      findRecentInbox: vi.fn().mockResolvedValue([]),
    },
    repository: {
      getWatch: vi.fn().mockResolvedValue({ historyId: '200', expiration: '2026-07-30T00:00:00.000Z' }),
      setWatch: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn().mockResolvedValue(undefined),
    },
    parseNewsletter: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn() },
  }
}

describe('createHttpApp', () => {
  it('returns health status without loading runtime configuration', async () => {
    const dependencies = createDependencies()

    await request(createHttpApp(dependencies)).get('/healthz').expect(200, { ok: true })
  })

  it('decodes a Pub/Sub historyId and synchronizes it', async () => {
    const dependencies = createDependencies()
    const data = Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64')

    await request(createHttpApp(dependencies)).post('/pubsub/gmail').send({ message: { data } }).expect(204)

    expect(dependencies.service.syncHistory).toHaveBeenCalledWith('123')
  })

  it.each([
    {},
    { message: {} },
    { message: { data: 'not valid base64' } },
    { message: { data: Buffer.from(JSON.stringify({ emailAddress: 'mailbox@example.com' })).toString('base64') } },
  ])('rejects malformed Pub/Sub payloads', async (body) => {
    const dependencies = createDependencies()

    await request(createHttpApp(dependencies)).post('/pubsub/gmail').send(body).expect(400)

    expect(dependencies.service.syncHistory).not.toHaveBeenCalled()
  })

  it('returns retryable failure when Pub/Sub synchronization fails', async () => {
    const dependencies = createDependencies()
    dependencies.service.syncHistory.mockRejectedValueOnce(new Error('temporary outage'))
    const data = Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64')

    await request(createHttpApp(dependencies)).post('/pubsub/gmail').send({ message: { data } }).expect(500)
  })

  it('rejects unauthorised replay and saves renewed watch cursor', async () => {
    const dependencies = createDependencies()
    const app = createHttpApp(dependencies)

    await request(app).post('/tasks/replay').expect(401)
    await request(app).post('/tasks/renew-watch').set('Authorization', `Bearer ${secret}`).expect(204)

    expect(dependencies.gateway.renewInboxWatch).toHaveBeenCalledWith('projects/bookstore-space/topics/newsletter-sync')
    expect(dependencies.repository.setWatch).toHaveBeenCalledWith({
      historyId: '300',
      expiration: '2026-08-01T00:00:00.000Z',
    })
    expect(dependencies.repository.setCursor).toHaveBeenCalledWith('300')
  })

  it('replays to the latest watch cursor', async () => {
    const dependencies = createDependencies()

    await request(createHttpApp(dependencies))
      .post('/tasks/replay')
      .set('Authorization', `Bearer ${secret}`)
      .expect(204)

    expect(dependencies.service.syncHistory).toHaveBeenCalledWith('200')
  })

  it('recovers an expired history cursor with chronological Inbox messages', async () => {
    const dependencies = createDependencies()
    dependencies.service.syncHistory.mockRejectedValueOnce(new HistoryCursorExpiredError())
    dependencies.gateway.findRecentInbox.mockResolvedValueOnce([
      { gmailMessageId: 'first', raw: 'first-raw', labelIds: ['INBOX'] },
      { gmailMessageId: 'second', raw: 'second-raw', labelIds: ['INBOX'] },
    ])
    dependencies.parseNewsletter
      .mockResolvedValueOnce({ messageId: '<first>', gmailMessageId: 'parsed-first', labelIds: [] })
      .mockResolvedValueOnce({ messageId: '<second>', gmailMessageId: 'parsed-second', labelIds: [] })

    await request(createHttpApp(dependencies))
      .post('/tasks/replay')
      .set('Authorization', `Bearer ${secret}`)
      .expect(204)

    expect(dependencies.gateway.findRecentInbox).toHaveBeenCalledWith(30)
    expect(dependencies.service.process).toHaveBeenNthCalledWith(1, {
      messageId: '<first>',
      gmailMessageId: 'first',
      labelIds: ['INBOX'],
    })
    expect(dependencies.service.process).toHaveBeenNthCalledWith(2, {
      messageId: '<second>',
      gmailMessageId: 'second',
      labelIds: ['INBOX'],
    })
    expect(dependencies.repository.setCursor).toHaveBeenCalledWith('200')
  })
})
