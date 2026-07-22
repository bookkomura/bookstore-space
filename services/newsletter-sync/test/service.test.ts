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
      markDeployComplete: vi.fn().mockResolvedValue('marked'),
      claimPendingDeploy: vi.fn().mockResolvedValue({
        status: 'claimed',
        publicationKey: 'publication-key',
        storyId: 99,
        leaseToken: 'deploy-lease-1',
      }),
      releasePendingDeploy: vi.fn().mockResolvedValue('marked'),
    },
    publisher: { publish: vi.fn().mockResolvedValue({ storyId: 99 }) },
    deployHook: vi.fn().mockResolvedValue(undefined),
  }
}

function createInMemoryFirestore() {
  const documents = new Map<string, Record<string, unknown>>()
  const document = (path: string) => ({
    path,
    get: async () => {
      const value = documents.get(path)
      return { exists: value !== undefined, data: () => value }
    },
  })
  return {
    documents,
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('NewsletterSyncService', () => {
  it('persists the Gmail watch cursor and expiration in private sync state', async () => {
    const { firestore, documents } = createInMemoryFirestore()
    const repository = createFirestoreSyncRepository(firestore as never, () => new Date('2026-07-19T00:00:00.000Z'))

    await repository.setWatch({ historyId: '300', expiration: '1785542400000' })

    await expect(repository.getWatch()).resolves.toEqual({ historyId: '300', expiration: '1785542400000' })
    expect(documents.get('newsletterSyncState/cursor')).toMatchObject({
      watchHistoryId: '300',
      watchExpiration: '1785542400000',
    })
  })

  it('keeps the newest numeric Gmail history cursor when deliveries complete out of order', async () => {
    const { firestore } = createInMemoryFirestore()
    const repository = createFirestoreSyncRepository(firestore as never, () => new Date('2026-07-19T00:00:00.000Z'))

    await repository.setCursor('900')
    await repository.setCursor('800')

    await expect(repository.getCursor()).resolves.toBe('900')
  })

  it('writes a pending deploy outbox record atomically with published state', async () => {
    const { firestore, documents } = createInMemoryFirestore()
    const repository = createFirestoreSyncRepository(firestore as never, () => new Date('2026-07-19T00:00:00.000Z'), () => 'opaque-key')
    const claim = await repository.claim(message.messageId, message.gmailMessageId)
    if (claim.status !== 'claimed') throw new Error('expected a lease claim')

    await expect(repository.markPublished(message.messageId, claim.leaseToken, 99)).resolves.toBe('marked')

    expect(documents.get('newsletterDeployOutbox/opaque-key')).toMatchObject({
      status: 'pending',
      storyId: 99,
      publicationKey: 'opaque-key',
    })
  })

  it('fences deploy completion to its holder and lets an expired deploy lease be reclaimed', async () => {
    const { firestore } = createInMemoryFirestore()
    let currentTime = new Date('2026-07-19T00:00:00.000Z')
    let token = 0
    const repository = createFirestoreSyncRepository(
      firestore as never,
      () => currentTime,
      () => `opaque-${++token}`,
    )
    const publication = await repository.claim(message.messageId, message.gmailMessageId)
    if (publication.status !== 'claimed') throw new Error('expected a publication lease claim')
    await repository.markPublished(message.messageId, publication.leaseToken, 99)

    const first = await repository.claimPendingDeploy(publication.publicationKey, 99)
    expect(first.status).toBe('claimed')
    if (first.status !== 'claimed') throw new Error('expected a deploy lease claim')
    await expect(repository.markDeployComplete(publication.publicationKey, 99, 'other-lease')).resolves.toBe('stale')
    await expect(repository.releasePendingDeploy(publication.publicationKey, 99, 'other-lease')).resolves.toBe('stale')

    currentTime = new Date(currentTime.getTime() + 10 * 60 * 1000 + 1)
    const reclaimed = await repository.claimPendingDeploy(publication.publicationKey, 99)
    expect(reclaimed.status).toBe('claimed')
    if (reclaimed.status !== 'claimed') throw new Error('expected an expired deploy lease to be reclaimed')
    await expect(repository.markDeployComplete(publication.publicationKey, 99, reclaimed.leaseToken)).resolves.toBe('marked')
  })

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
    repository.claim.mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' }).mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
    repository.claimPendingDeploy.mockResolvedValueOnce({
      status: 'claimed', publicationKey: 'publication-key', storyId: 99, leaseToken: 'deploy-lease-1',
    }).mockResolvedValueOnce({ status: 'complete' })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await service.process(message)
    await service.process(message)

    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 'lease-1', 99)
    expect(deployHook).toHaveBeenCalledTimes(1)
  })

  it('runs the deploy hook once and surfaces a retryable failure to the parallel duplicate delivery', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' })
      .mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
    repository.claimPendingDeploy
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', storyId: 99, leaseToken: 'deploy-lease-1' })
      .mockResolvedValueOnce({ status: 'in_progress' })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    const results = await Promise.allSettled([service.process(message), service.process(message)])

    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(deployHook).toHaveBeenCalledTimes(1)
    expect(repository.markDeployComplete).toHaveBeenCalledWith('publication-key', 99, 'deploy-lease-1')
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.objectContaining({ name: 'DeployInProgressError' }),
    })
  })

  it('does not acknowledge Gmail history while a parallel delivery holds the deploy outbox, then retries it after the holder fails', async () => {
    const { firestore } = createInMemoryFirestore()
    const repository = createFirestoreSyncRepository(firestore as never, () => new Date('2026-07-19T00:00:00.000Z'), () => 'opaque-key')
    await repository.setCursor('900')
    const hookStarted = deferred<void>()
    const firstHook = deferred<void>()
    const deployHook = vi.fn(() => {
      hookStarted.resolve()
      return firstHook.promise
    })
    const gateway = { fetchHistorySince: vi.fn().mockResolvedValue([{
      gmailMessageId: 'eligible', raw: 'eligible-raw', from: 'info.rewildesign@gmail.com', subject: '小村碎碎念', labelIds: ['INBOX'],
    }]) }
    const service = new NewsletterSyncService({
      repository,
      publisher: { publish: vi.fn().mockResolvedValue({ storyId: 99 }) },
      deployHook,
      gateway,
      parseNewsletter: vi.fn().mockResolvedValue(message),
    })

    const firstDelivery = service.process(message)
    await hookStarted.promise

    await expect(service.syncHistory('901')).rejects.toThrow('deploy')
    await expect(repository.getCursor()).resolves.toBe('900')

    firstHook.reject(new Error('deploy unavailable'))
    await expect(firstDelivery).rejects.toThrow('deploy unavailable')

    deployHook.mockResolvedValueOnce(undefined)
    await expect(service.syncHistory('901')).resolves.toEqual({ examined: 1, published: 0, duplicates: 1 })
    await expect(repository.getCursor()).resolves.toBe('901')
    expect(deployHook).toHaveBeenCalledTimes(2)
  })

  it('aborts a hanging deploy hook before its lease expires, then lets the expired lease be reclaimed without stale completion', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T00:00:00.000Z'))
    const { firestore } = createInMemoryFirestore()
    let token = 0
    const repository = createFirestoreSyncRepository(firestore as never, () => new Date(), () => `opaque-${++token}`)
    const publication = await repository.claim(message.messageId, message.gmailMessageId)
    if (publication.status !== 'claimed') throw new Error('expected a publication lease claim')
    await repository.markPublished(message.messageId, publication.leaseToken, 99)

    const staleHook = deferred<void>()
    const hookStarted = deferred<void>()
    const deployHook = vi.fn(() => {
      hookStarted.resolve()
      return deployHook.mock.calls.length === 1 ? staleHook.promise : Promise.resolve()
    })
    const firstService = new NewsletterSyncService({
      repository: { ...repository, releasePendingDeploy: vi.fn().mockResolvedValue('stale') },
      publisher: { publish: vi.fn() },
      deployHook,
    })
    const first = firstService.retryDeploy(publication.publicationKey, 99)
    const firstFailure = first.catch((error: unknown) => error)

    try {
      await hookStarted.promise
      await vi.advanceTimersByTimeAsync(9 * 60 * 1000)

      const signal = deployHook.mock.calls[0]?.[0] as AbortSignal | undefined
      expect(signal?.aborted).toBe(true)
      expect(await firstFailure).toMatchObject({ name: 'DeployHookTimeoutError' })

      await vi.advanceTimersByTimeAsync(60 * 1000 + 1)
      const retryService = new NewsletterSyncService({ repository, publisher: { publish: vi.fn() }, deployHook })
      await expect(retryService.retryDeploy(publication.publicationKey, 99)).resolves.toBeUndefined()

      staleHook.resolve()
      await Promise.resolve()
      await expect(repository.claimPendingDeploy(publication.publicationKey, 99)).resolves.toEqual({ status: 'complete' })
      expect(deployHook).toHaveBeenCalledTimes(2)
    } finally {
      staleHook.resolve()
      await firstFailure
      vi.useRealTimers()
    }
  })

  it('does not deploy a failed asset upload and records a retryable failure', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    publisher.publish.mockRejectedValueOnce(new Error('asset upload failed'))
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('asset upload failed')

    expect(deployHook).not.toHaveBeenCalled()
    expect(repository.markFailed).toHaveBeenCalledWith(message.messageId, 'lease-1', expect.stringContaining('asset upload failed'))
  })

  it('keeps the transactional outbox pending after a hook failure and drains it on the next delivery without recreating the story', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    deployHook.mockRejectedValueOnce(new Error('deploy unavailable')).mockResolvedValueOnce(undefined)
    repository.claim.mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' }).mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('deploy unavailable')
    expect(repository.markDeployComplete).not.toHaveBeenCalled()
    await expect(service.process(message)).resolves.toBe('duplicate')

    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 'lease-1', 99)
    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(deployHook).toHaveBeenCalledTimes(2)
    expect(repository.markDeployComplete).toHaveBeenCalledTimes(1)
  })

  it('does not advance the history cursor on a pending-outbox hook failure, then retries hook-only from published state', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim
      .mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
      .mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
    deployHook.mockRejectedValueOnce(new Error('deploy unavailable')).mockResolvedValueOnce(undefined)
    const gateway = { fetchHistorySince: vi.fn().mockResolvedValue([{
      gmailMessageId: 'eligible', raw: 'eligible-raw', from: 'info.rewildesign@gmail.com', subject: '小村碎碎念', labelIds: ['INBOX'],
    }]) }
    const parseNewsletter = vi.fn().mockResolvedValue(message)
    const service = new NewsletterSyncService({ repository, publisher, deployHook, gateway, parseNewsletter })

    await expect(service.syncHistory('new-history')).rejects.toThrow('deploy unavailable')
    expect(repository.setCursor).not.toHaveBeenCalled()
    expect(repository.markDeployComplete).not.toHaveBeenCalled()
    await expect(service.process(message)).resolves.toBe('duplicate')

    expect(publisher.publish).not.toHaveBeenCalled()
    expect(repository.markDeployComplete).toHaveBeenCalledWith('publication-key', 99, 'deploy-lease-1')
  })

  it('exposes a deploy-hook failure from retryDeploy and leaves the outbox pending', async () => {
    const { repository, deployHook } = createDependencies()
    deployHook.mockRejectedValueOnce(new Error('deploy unavailable'))
    const service = new NewsletterSyncService({ repository, publisher: { publish: vi.fn() }, deployHook })

    await expect(service.retryDeploy('publication-key', 99)).rejects.toThrow('deploy unavailable')
    expect(repository.markDeployComplete).not.toHaveBeenCalled()
  })

  it('drains the durable outbox on a later published delivery after interruption before the hook', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', leaseToken: 'lease-1' })
      .mockResolvedValueOnce({ status: 'published', storyId: 99, publicationKey: 'publication-key' })
    repository.claimPendingDeploy
      .mockRejectedValueOnce(new Error('worker interrupted before hook'))
      .mockResolvedValueOnce({ status: 'claimed', publicationKey: 'publication-key', storyId: 99, leaseToken: 'deploy-lease-1' })
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('worker interrupted before hook')
    await expect(service.process(message)).resolves.toBe('duplicate')

    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(deployHook).toHaveBeenCalledTimes(1)
    expect(repository.markDeployComplete).toHaveBeenCalledWith('publication-key', 99, 'deploy-lease-1')
  })

  it('skips malformed ineligible Gmail history refs before MIME parsing and advances the cursor', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    const gateway = {
      fetchHistorySince: vi.fn().mockResolvedValue([
        {
          gmailMessageId: 'eligible',
          raw: 'eligible-raw',
          from: 'info.rewildesign@gmail.com',
          subject: '小村碎碎念～總是會到',
          labelIds: ['INBOX'],
        },
        {
          gmailMessageId: 'not-inbox',
          raw: 'malformed-ineligible-raw',
          from: 'other@example.com',
          subject: 'not a newsletter',
          labelIds: ['UNREAD'],
        },
      ]),
    }
    const parseNewsletter = vi.fn().mockResolvedValue(message)
    const service = new NewsletterSyncService({ repository, publisher, deployHook, gateway, parseNewsletter })

    await expect(service.syncHistory('new-history')).resolves.toEqual({ examined: 2, published: 1, duplicates: 0 })

    expect(parseNewsletter).toHaveBeenCalledWith('eligible-raw')
    expect(parseNewsletter).not.toHaveBeenCalledWith('malformed-ineligible-raw')
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
    const gateway = { fetchHistorySince: vi.fn().mockResolvedValue([{
      gmailMessageId: 'eligible', raw: 'eligible-raw', from: 'info.rewildesign@gmail.com', subject: '小村碎碎念', labelIds: ['INBOX'],
    }]) }
    const parseNewsletter = vi.fn().mockResolvedValue(message)
    const service = new NewsletterSyncService({ repository, publisher, deployHook, gateway, parseNewsletter })

    await expect(service.syncHistory('new-history')).rejects.toThrow('currently being processed')
    expect(repository.setCursor).not.toHaveBeenCalled()
    expect(publisher.publish).not.toHaveBeenCalled()
  })
})
