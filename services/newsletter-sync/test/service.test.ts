import { describe, expect, it, vi } from 'vitest'

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
      claim: vi.fn().mockResolvedValue('claimed'),
      markPublished: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getCursor: vi.fn().mockResolvedValue('old-history'),
      setCursor: vi.fn().mockResolvedValue(undefined),
      enqueueDeployRetry: vi.fn().mockResolvedValue(undefined),
    },
    publisher: { publish: vi.fn().mockResolvedValue({ storyId: 99 }) },
    deployHook: vi.fn().mockResolvedValue(undefined),
  }
}

describe('NewsletterSyncService', () => {
  it('publishes a Message-ID once even when delivery repeats', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    repository.claim.mockResolvedValueOnce('claimed').mockResolvedValueOnce('duplicate')
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await service.process(message)
    await service.process(message)

    expect(publisher.publish).toHaveBeenCalledTimes(1)
    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 99)
    expect(deployHook).toHaveBeenCalledTimes(1)
  })

  it('does not deploy a failed asset upload and records a retryable failure', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    publisher.publish.mockRejectedValueOnce(new Error('asset upload failed'))
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).rejects.toThrow('asset upload failed')

    expect(deployHook).not.toHaveBeenCalled()
    expect(repository.markFailed).toHaveBeenCalledWith(message.messageId, expect.stringContaining('asset upload failed'))
  })

  it('records a deploy retry after publication without undoing or recreating the story', async () => {
    const { repository, publisher, deployHook } = createDependencies()
    deployHook.mockRejectedValueOnce(new Error('deploy unavailable')).mockResolvedValueOnce(undefined)
    const service = new NewsletterSyncService({ repository, publisher, deployHook })

    await expect(service.process(message)).resolves.toBe('published')
    await service.retryDeploy(99)

    expect(repository.markPublished).toHaveBeenCalledWith(message.messageId, 99)
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
})
