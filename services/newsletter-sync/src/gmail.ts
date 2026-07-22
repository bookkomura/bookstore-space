import type { gmail_v1 } from 'googleapis'

const NEWSLETTER_SENDER = 'info.rewildesign@gmail.com'
const SUBJECT_NEEDLE = '小村碎碎念'

export interface GmailMessageRef {
  gmailMessageId: string
  raw: string
  labelIds: readonly string[]
}

export interface GmailGateway {
  /** Returns raw refs; callers parse and apply sender/subject eligibility before syncing. */
  fetchHistorySince(startHistoryId: string): Promise<GmailMessageRef[]>
  renewInboxWatch(topicName: string): Promise<GmailWatch>
  findRecentInbox(days: number): Promise<GmailMessageRef[]>
}

export interface GmailWatch {
  historyId: string
  expiration: string
}

export class HistoryCursorExpiredError extends Error {
  constructor() {
    super('The Gmail history cursor has expired')
    this.name = 'HistoryCursorExpiredError'
  }
}

export function isEligibleMessage(input: {
  from: string
  subject: string
  labelIds: readonly string[]
}): boolean {
  return (
    input.from === NEWSLETTER_SENDER &&
    input.subject.includes(SUBJECT_NEEDLE) &&
    input.labelIds.includes('INBOX')
  )
}

export function createGmailGateway(client: gmail_v1.Gmail, userId = 'me'): GmailGateway {
  return {
    async fetchHistorySince(startHistoryId: string): Promise<GmailMessageRef[]> {
      const messageIds = new Set<string>()
      let pageToken: string | undefined

      try {
        do {
          const response = await client.users.history.list({
            userId,
            startHistoryId,
            historyTypes: ['messageAdded'],
            ...(pageToken ? { pageToken } : {}),
          })

          for (const history of response.data.history ?? []) {
            for (const added of history.messagesAdded ?? []) {
              const id = added.message?.id
              if (id) messageIds.add(id)
            }
          }
          pageToken = response.data.nextPageToken ?? undefined
        } while (pageToken)
      } catch (error) {
        if (isHistoryNotFound(error)) throw new HistoryCursorExpiredError()
        throw error
      }

      const messages: GmailMessageRef[] = []
      for (const gmailMessageId of messageIds) {
        const response = await client.users.messages.get({ userId, id: gmailMessageId, format: 'raw' })
        messages.push({
          gmailMessageId,
          raw: response.data.raw ?? '',
          labelIds: response.data.labelIds ?? [],
        })
      }
      return messages
    },

    async renewInboxWatch(topicName) {
      const response = await client.users.watch({
        userId,
        requestBody: { labelIds: ['INBOX'], topicName },
      })
      const { historyId, expiration } = response.data
      if (typeof historyId !== 'string' || typeof expiration !== 'string') {
        throw new Error('Gmail watch response did not include a cursor and expiration')
      }
      return { historyId, expiration }
    },

    async findRecentInbox(days) {
      const messageIds = new Set<string>()
      let pageToken: string | undefined
      const q = `in:inbox from:${NEWSLETTER_SENDER} subject:${SUBJECT_NEEDLE} newer_than:${days}d`

      do {
        const response = await client.users.messages.list({ userId, q, ...(pageToken ? { pageToken } : {}) })
        for (const message of response.data.messages ?? []) {
          if (message.id) messageIds.add(message.id)
        }
        pageToken = response.data.nextPageToken ?? undefined
      } while (pageToken)

      const messages = await Promise.all(
        [...messageIds].map(async (gmailMessageId) => {
          const response = await client.users.messages.get({ userId, id: gmailMessageId, format: 'raw' })
          return {
            gmailMessageId,
            raw: response.data.raw ?? '',
            labelIds: response.data.labelIds ?? [],
            internalDate: Number(response.data.internalDate ?? 0),
          }
        }),
      )
      return messages
        .sort((left, right) => left.internalDate - right.internalDate)
        .map(({ internalDate: _internalDate, ...message }) => message)
    },
  }
}

function isHistoryNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; response?: { status?: unknown } }
  return candidate.code === 404 || candidate.response?.status === 404
}
