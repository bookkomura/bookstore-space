import { randomUUID, timingSafeEqual } from 'node:crypto'

import express, { type Express, type Request } from 'express'

import { HistoryCursorExpiredError, type GmailGateway } from './gmail.js'
import { parseNewsletterMime } from './mime.js'
import type { WatchState } from './repository.js'
import type { NewsletterDelivery, NewsletterSyncService, SyncResult } from './service.js'

type Logger = {
  info(event: { requestId: string; status: number; count: number }): void
  error(event: { requestId: string; status: number; count: number }): void
}

export interface HttpDependencies {
  config: Pick<{ gmailPubsubTopic: string; replaySharedSecret: string }, 'gmailPubsubTopic' | 'replaySharedSecret'>
  service: Pick<NewsletterSyncService, 'process' | 'syncHistory'>
  gateway: Pick<GmailGateway, 'findRecentInbox' | 'renewInboxWatch'>
  repository: {
    getWatch(): Promise<WatchState | null>
    setWatch(watch: WatchState): Promise<void>
    setCursor(historyId: string): Promise<void>
  }
  parseNewsletter?: (raw: string) => Promise<Omit<NewsletterDelivery, 'gmailMessageId' | 'labelIds'>>
  logger?: Logger
}

const defaultLogger: Logger = {
  info: () => undefined,
  error: () => undefined,
}

export function createHttpApp(dependencies: HttpDependencies): Express {
  const app = express()
  const logger = dependencies.logger ?? defaultLogger
  const parseNewsletter = dependencies.parseNewsletter ?? parseNewsletterMime
  app.use(express.json({ limit: '1mb' }))

  app.get('/healthz', (_request, response) => response.status(200).json({ ok: true }))

  app.post('/pubsub/gmail', async (request, response) => {
    const requestId = requestIdentifier()
    const historyId = parseHistoryId(request.body)
    if (!historyId) {
      logger.info({ requestId, status: 400, count: 0 })
      response.sendStatus(400)
      return
    }
    try {
      const result = await dependencies.service.syncHistory(historyId)
      logger.info({ requestId, status: 204, count: result.examined })
      response.sendStatus(204)
    } catch {
      logger.error({ requestId, status: 500, count: 0 })
      response.sendStatus(500)
    }
  })

  app.post('/tasks/renew-watch', async (request, response) => {
    const requestId = requestIdentifier()
    if (!isAuthorized(request, dependencies.config.replaySharedSecret)) {
      logger.info({ requestId, status: 401, count: 0 })
      response.sendStatus(401)
      return
    }
    try {
      const watch = await dependencies.gateway.renewInboxWatch(dependencies.config.gmailPubsubTopic)
      await dependencies.repository.setWatch(watch)
      await dependencies.repository.setCursor(watch.historyId)
      logger.info({ requestId, status: 204, count: 0 })
      response.sendStatus(204)
    } catch {
      logger.error({ requestId, status: 500, count: 0 })
      response.sendStatus(500)
    }
  })

  app.post('/tasks/replay', async (request, response) => {
    const requestId = requestIdentifier()
    if (!isAuthorized(request, dependencies.config.replaySharedSecret)) {
      logger.info({ requestId, status: 401, count: 0 })
      response.sendStatus(401)
      return
    }
    try {
      const watch = await dependencies.repository.getWatch()
      if (!watch) throw new Error('No Gmail watch cursor is available')
      let count = 0
      try {
        const result = await dependencies.service.syncHistory(watch.historyId)
        count = result.examined
      } catch (error) {
        if (!(error instanceof HistoryCursorExpiredError)) throw error
        const messages = await dependencies.gateway.findRecentInbox(30)
        for (const message of messages) {
          const parsed = await parseNewsletter(message.raw)
          await dependencies.service.process({ ...parsed, gmailMessageId: message.gmailMessageId, labelIds: message.labelIds })
        }
        await dependencies.repository.setCursor(watch.historyId)
        count = messages.length
      }
      logger.info({ requestId, status: 204, count })
      response.sendStatus(204)
    } catch {
      logger.error({ requestId, status: 500, count: 0 })
      response.sendStatus(500)
    }
  })

  return app
}

function parseHistoryId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const data = (body as { message?: { data?: unknown } }).message?.data
  if (typeof data !== 'string' || !isCanonicalBase64(data)) return null
  try {
    const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
    return typeof decoded?.historyId === 'string' && decoded.historyId.length > 0 ? decoded.historyId : null
  } catch {
    return null
  }
}

function isCanonicalBase64(value: string): boolean {
  return value.length > 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
}

function isAuthorized(request: Request, secret: string): boolean {
  const authorization = request.get('authorization')
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authorization ?? '')
  return received.length === expected.length && timingSafeEqual(received, expected)
}

function requestIdentifier(): string {
  return randomUUID()
}
