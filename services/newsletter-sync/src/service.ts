import { isEligibleMessage, type GmailGateway } from './gmail.js'
import { parseNewsletterMime, type ParsedNewsletter } from './mime.js'
import type { StoryblokPublisher } from './storyblok.js'
import type { SyncRepository } from './repository.js'

export interface SyncResult {
  examined: number
  published: number
  duplicates: number
}

export type NewsletterDelivery = ParsedNewsletter & {
  gmailMessageId: string
  labelIds: readonly string[]
}

export type DeployHook = () => Promise<void>

export interface NewsletterSyncServiceDependencies {
  repository: SyncRepository
  publisher: StoryblokPublisher
  deployHook: DeployHook
  gateway?: GmailGateway
  parseNewsletter?: typeof parseNewsletterMime
}

export class NewsletterSyncService {
  private readonly parseNewsletter: typeof parseNewsletterMime

  constructor(private readonly dependencies: NewsletterSyncServiceDependencies) {
    this.parseNewsletter = dependencies.parseNewsletter ?? parseNewsletterMime
  }

  async process(message: NewsletterDelivery): Promise<'published' | 'duplicate' | 'ignored'> {
    if (!isEligibleMessage(message)) return 'ignored'

    const claim = await this.dependencies.repository.claim(message.messageId, message.gmailMessageId)
    if (claim.status === 'published') {
      await this.drainDeployOutbox(claim.publicationKey, claim.storyId)
      return 'duplicate'
    }
    if (claim.status === 'in_progress') throw new SyncInProgressError()

    let publication: { storyId: number }
    try {
      publication = await this.dependencies.publisher.publish(message, claim.publicationKey)
    } catch (error) {
      await this.dependencies.repository.markFailed(message.messageId, claim.leaseToken, errorMessage(error))
      throw error
    }

    const markResult = await this.dependencies.repository.markPublished(message.messageId, claim.leaseToken, publication.storyId)
    if (markResult !== 'marked') throw new Error('Publication lease was lost before it could be marked')
    await this.drainDeployOutbox(claim.publicationKey, publication.storyId)
    return 'published'
  }

  async syncHistory(historyId: string): Promise<SyncResult> {
    const gateway = this.dependencies.gateway
    if (!gateway) throw new Error('Gmail gateway is required to synchronize history')

    const cursor = await this.dependencies.repository.getCursor()
    if (!cursor) {
      await this.dependencies.repository.setCursor(historyId)
      return { examined: 0, published: 0, duplicates: 0 }
    }

    const references = await gateway.fetchHistorySince(cursor)
    const result: SyncResult = { examined: references.length, published: 0, duplicates: 0 }
    for (const reference of references) {
      if (!isEligibleMessage(reference)) continue
      const parsed = await this.parseNewsletter(reference.raw)
      const outcome = await this.process({ ...parsed, gmailMessageId: reference.gmailMessageId, labelIds: reference.labelIds })
      if (outcome === 'published') result.published += 1
      if (outcome === 'duplicate') result.duplicates += 1
    }
    await this.dependencies.repository.setCursor(historyId)
    return result
  }

  async retryDeploy(publicationKey: string, storyId: number): Promise<void> {
    await this.drainDeployOutbox(publicationKey, storyId)
  }

  private async drainDeployOutbox(publicationKey: string, storyId: number): Promise<void> {
    const claim = await this.dependencies.repository.claimPendingDeploy(publicationKey, storyId)
    if (claim.status === 'complete' || claim.status === 'in_progress') return
    if (claim.status === 'invalid') throw new Error('Deploy outbox story does not match the published story')
    try {
      await this.dependencies.deployHook()
    } catch (error) {
      await this.dependencies.repository.releasePendingDeploy(publicationKey, storyId, claim.leaseToken)
      throw error
    }
    const result = await this.dependencies.repository.markDeployComplete(publicationKey, storyId, claim.leaseToken)
    if (result !== 'marked') throw new Error('Deploy outbox lease was lost before it could be completed')
  }
}

export class SyncInProgressError extends Error {
  constructor() {
    super('Newsletter is currently being processed by an active lease')
    this.name = 'SyncInProgressError'
  }
}

export function createDeployHook(url: string, fetcher: typeof fetch = fetch): DeployHook {
  if (new URL(url).protocol !== 'https:') throw new Error('Deploy hook URL must use HTTPS')
  return async () => {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) throw new Error(`Deploy hook failed (${response.status})`)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
