import { describe, expect, it, vi } from 'vitest'

import { createFirestoreSyncRepository } from '../src/repository.js'
import { NewsletterSyncService } from '../src/service.js'

const message = {
  gmailMessageId: 'gmail-1',
  labelIds: ['INBOX'],
  messageId: '<private-message-id@example.test>',
  sentAt: '2026-07-19T05:40:25.000Z',
  subject: '小村碎碎念～總是會到',
  from: 'info.rewildesign@gmail.com',
  blocks: [{ type: 'paragraph' as const, text: '內容' }],
  attachmentsByCid: new Map(),
}

function createDependencies() {
  return {
    repository: {
      claim: vi.fn().mockResolvedValue({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' }),
      markPublished: vi.fn().mockResolvedValue('marked'),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getCursor: vi.fn().mockResolvedValue('old-history'),
      setCursor: vi.fn().mockResolvedValue(undefined),
      enqueueDeployRetry: vi.fn().mockResolvedValue(undefined),
    },
    publisher: { publish: vi.fn().mockResolvedValue({ storyId: 99 }) },
    deployHook: vi.fn().mockResolvedValue(undefined),
  }
}

function createInMemoryFirestore() {
  const documents = new Map<string, Record<string, unknown>>()
  const document = (path: string) => ({ path })
  return {
    firestore: {
      collection: (collection: string) => ({ doc: (id: string) => document(`${collection}/${id}`) }),
      runTransaction: async <T>(callback: (transaction: {
        get: (reference: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>
        set: (reference: { path: string }, value: Record<string, unknown>, options: { merge: boolean }) => void
      }) => Promise<T>) =>
        callback({
          get: async (reference) => {
            const value = documents.get(reference.path)
            return { exists: value !== undefined, data: () => value }
          },
          set: (reference, value, options) => {
            documents.set(reference.path, options.merge ? { ...documents.get(reference.path), ...value } : value)
          },
        }),
    },
  }
}

describe('NewsletterSyncService', () => {
  it('rejects a stale lease token after the lease expires, even before another worker reclaims it', async () => {
    const { firestore } = createInMemoryFirestore()
    let currentTime = new Date('2026-07-19T00:00:00.000Z')
    const repository = createFirestoreSyncRepository(
      firestore as never,
      () => currentTime,
      () => 'opaque-lease-token',
    )
    const claim = await repository.claim(message.messageId, message.gmailMessageId)
    expect(claim.status).toBe('claimed')
    if (claim.status !== 'claimed') throw new Error('expected a lease claim')

    currentTime = new Date(currentTime.getTime() + 10 * 60 * 1000 + 1)

    await expect(repository.markPublished(message.messageId, claim.leaseToken, 99)).resolves.toBe('stale')
  })

  it('publishes a Message-ID once even when delivery repeats', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim.mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' }).mockResolvedValueOnce({ status: 'published', storyId: 99 })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await service.process(message)
    await service.process(message)

    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 'lease-1', 99)
    expect(deployHook).toHaveBeenCalledTimes(1)
  })

  it('does not deploy a failed asset upload and records a retryable failure', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    publisher.publish.mockRejectedValueOnce(new Error('asset upload failed'))
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('asset upload failed')

    expect(deployHook).not.toHaveBeenCalled()
    expect(repository.markFailed).toHaveBeenCalledWith(message.messageId, 'lease-1', expect.stringContaining('asset upload failed'))
  })

  it('records a deploy retry after publication without undoing or recreating the story', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    deployHook.mockRejectedValueOnce(new Error('deploy unavailable')).mockResolvedValueOnce(undefined)
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).resolves.toBe('published')
    await service.retryDeploy(99)

    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 'lease-1', 99)
    expect(repository.enqueueDeployRetry).toHaveBeenCalledWith(99)
    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(deployHook).toHaveBeenCalledTimes(2)
  })

  it('parses raw Gmail refs, filters ineligible mail, and advances the cursor after successful history sync', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    const gateway = {
      fetchHistorySince: vi.fn().mockResolvedValue([
        { gmailMessageId: 'eligible', raw: 'eligible-raw', labelIds: ['INBOX'] },
        { gmailMessageId: 'not-inbox', raw: 'not-inbox-raw', labelIds: ['UNREAD'] },
      ]),
    }
    const parseNewsletter = vi.fn().mockResolvedValue(message)
    const service = new NewsletterSyncService({ repository, publisher, deployHook, gateway, parseNewsletter })

    await expect(service.syncHistory('new-history')).resolves.toEqual({ examined: 2, published: 1, duplicates: 0 })

    expect(parseNewsletter).toHaveBeenCalledWith('eligible-raw')
    expect(parseNewsletter).toHaveBeenCalledWith('not-inbox-raw')
    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(repository.setCursor).toHaveBeenCalledWith('new-history')
  })

  it('marks the publication before calling the deploy hook', async () => {
    const { repository, publisher } = createDependencies()
    const events: string[] = []
    repository.markPublished.mockImplementation(async () => {
      events.push('marked')
      return 'marked'
    })
    const deployHook = vi.fn(async () => {
      events.push('deployed')
    })
    publisher.publish.mockImplementation(async () => {
      events.push('published')
      return { storyId: 99 }
    })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await service.process(message)

    expect(events).toEqual(['published', 'marked', 'deployed'])
  })

  it('reuses the persisted publication key after markPublished fails, so a retry can reconcile the same story', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'stable-key', leaseToken: 'expired-lease' })
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'stable-key', leaseToken: 'new-lease' })
    repository.markPublished.mockRejectedValueOnce(new Error('firestore temporarily unavailable')).mockResolvedValueOnce('marked')
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('firestore temporarily unavailable')
    await expect(service.process(message)).resolves.toBe('published')

    expect(publisher.publish).toHaveBeenNthCalledWith(1, message, 'stable-key')
    expect(publisher.publish).toHaveBeenNthCalledWith(2, message, 'stable-key')
    expect(repository.markPublished).toHaveBeenLastCalledWith(message.messageId, 'new-lease', 99)
  })

  it('does not deploy when a stale lease owner loses the fencing check', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.markPublished.mockResolvedValueOnce('stale')
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('lease was lost')
    expect(publisher.publish).toHaveBeenCalledWith(message, 'publication-key')
    expect(deployHook).not.toHaveBeenCalled()
  })

  it('does not advance the cursor when a live owner lease is in progress', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim.mockResolvedValueOnce({ status: 'in_progress' })
    const gateway = { fetchHistorySince: vi.fn().mockResolvedValue([{ gmailMessageId: 'eligible', raw: 'eligible-raw', labelIds: ['INBOX'] }]) }
    const parseNewsletter = vi.fn().mockResolvedValue(message)
    const service = new NewsletterSyncService({ repository, publisher, deployHook, gateway, parseNewsletter })

    await expect(service.syncHistory('new-history')).rejects.toThrow('currently being processed')
    expect(repository.setCursor).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })
})
