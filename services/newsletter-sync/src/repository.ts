import { createHash, randomUUID } from 'node:crypto'

import { FieldValue, type Firestore } from '@google-cloud/firestore'

export type ClaimResult =
  | { status: 'claimed'; publicationKey: string; leaseToken: string }
  | { status: 'published'; storyId: number }
  | { status: 'in_progress' }

export type MarkResult = 'marked' | 'stale'

export interface SyncRepository {
  claim(messageId: string, gmailMessageId?: string): Promise<ClaimResult>
  markPublished(messageId: string, leaseToken: string, storyId: number): Promise<MarkResult>
  markFailed(messageId: string, leaseToken: string, reason: string): Promise<MarkResult>
  getCursor(): Promise<string | null>
  setCursor(historyId: string): Promise<void>
  enqueueDeployRetry(storyId: number): Promise<void>
}

const PROCESSING_LEASE_MS = 10 * 60 * 1000

export function messageDocumentId(messageId: string): string {
  return createHash('sha256').update(messageId).digest('hex')
}

export function createFirestoreSyncRepository(
  firestore: Firestore,
  now: () => Date = () => new Date(),
  opaqueToken: () => string = randomUUID,
): SyncRepository {
  const cursor = firestore.collection('newsletterSyncState').doc('cursor')

  return {
    async claim(messageId, gmailMessageId) {
      const message = firestore.collection('newsletterMessages').doc(messageDocumentId(messageId))
      return firestore.runTransaction(async (transaction): Promise<ClaimResult> => {
        const snapshot = await transaction.get(message)
        const data = snapshot.data()
        const currentTime = now()
        const leaseExpiresAt = asDate(data?.processingLeaseExpiresAt)
        if (data?.status === 'published' && typeof data.storyId === 'number') {
          return { status: 'published', storyId: data.storyId }
        }
        if (data?.status === 'processing' && leaseExpiresAt !== null && leaseExpiresAt > currentTime) {
          return { status: 'in_progress' }
        }

        const publicationKey = typeof data?.publicationKey === 'string' ? data.publicationKey : opaqueToken()
        const leaseToken = opaqueToken()

        transaction.set(
          message,
          {
            messageId,
            ...(gmailMessageId ? { gmailMessageId } : {}),
            status: 'processing',
            publicationKey,
            leaseToken,
            processingLeaseExpiresAt: new Date(currentTime.getTime() + PROCESSING_LEASE_MS),
            updatedAt: currentTime,
            ...(snapshot.exists ? {} : { createdAt: currentTime, retryCount: 0 }),
          },
          { merge: true },
        )
        return { status: 'claimed', publicationKey, leaseToken }
      })
    },

    async markPublished(messageId, leaseToken, storyId) {
      const message = firestore.collection('newsletterMessages').doc(messageDocumentId(messageId))
      return firestore.runTransaction(async (transaction): Promise<MarkResult> => {
        const snapshot = await transaction.get(message)
        const currentTime = now()
        const data = snapshot.data()
        const leaseExpiresAt = asDate(data?.processingLeaseExpiresAt)
        if (
          data?.status !== 'processing' ||
          data?.leaseToken !== leaseToken ||
          leaseExpiresAt === null ||
          leaseExpiresAt <= currentTime
        ) {
          return 'stale'
        }
        transaction.set(
          message,
          {
            status: 'published',
            storyId,
            publishedAt: currentTime,
            processingLeaseExpiresAt: null,
            updatedAt: currentTime,
          },
          { merge: true },
        )
        return 'marked'
      })
    },

    async markFailed(messageId, leaseToken, reason) {
      const message = firestore.collection('newsletterMessages').doc(messageDocumentId(messageId))
      return firestore.runTransaction(async (transaction): Promise<MarkResult> => {
        const snapshot = await transaction.get(message)
        const currentTime = now()
        const data = snapshot.data()
        const leaseExpiresAt = asDate(data?.processingLeaseExpiresAt)
        if (
          data?.status !== 'processing' ||
          data?.leaseToken !== leaseToken ||
          leaseExpiresAt === null ||
          leaseExpiresAt <= currentTime
        ) {
          return 'stale'
        }
        transaction.set(
          message,
          {
            status: 'failed',
            errorReason: reason,
            failedAt: currentTime,
            processingLeaseExpiresAt: null,
            retryCount: FieldValue.increment(1),
            updatedAt: currentTime,
          },
          { merge: true },
        )
        return 'marked'
      })
    },

    async getCursor() {
      const snapshot = await cursor.get()
      const historyId = snapshot.data()?.historyId
      return typeof historyId === 'string' ? historyId : null
    },

    async setCursor(historyId) {
      await cursor.set({ historyId, updatedAt: now() }, { merge: true })
    },

    async enqueueDeployRetry(storyId) {
      await firestore.collection('newsletterDeployRetries').doc(String(storyId)).set(
        {
          storyId,
          status: 'pending',
          lastErrorAt: now(),
          attempts: FieldValue.increment(1),
        },
        { merge: true },
      )
    },
  }
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate
    if (typeof toDate === 'function') {
      const date = toDate.call(value)
      return date instanceof Date ? date : null
    }
  }
  return null
}
