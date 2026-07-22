import { pathToFileURL } from 'node:url'

import { Firestore } from '@google-cloud/firestore'
import { google } from 'googleapis'
import express, { type Express } from 'express'

import { loadConfig, type SyncConfig } from './config.js'
import { createGmailGateway } from './gmail.js'
import { createHttpApp } from './http.js'
import { createFirestoreSyncRepository } from './repository.js'
import { createDeployHook, NewsletterSyncService } from './service.js'
import { createStoryblokPublisher } from './storyblok.js'

export function createApp(): Express {
  return express()
}

export function createRuntimeApp(config: SyncConfig): Express {
  const auth = new google.auth.OAuth2(config.gmailOAuthClientId, config.gmailOAuthClientSecret)
  auth.setCredentials({ refresh_token: config.gmailOAuthRefreshToken })
  const gateway = createGmailGateway(google.gmail({ version: 'v1', auth }), config.gmailUserEmail)
  const repository = createFirestoreSyncRepository(new Firestore({ projectId: config.projectId }))
  const service = new NewsletterSyncService({
    repository,
    gateway,
    publisher: createStoryblokPublisher({
      spaceId: config.storyblokSpaceId,
      managementToken: config.storyblokManagementToken,
    }),
    deployHook: createDeployHook(config.cloudflareDeployHookUrl),
  })
  return createHttpApp({
    config,
    service,
    gateway,
    repository,
    logger: {
      info: (event) => console.info(JSON.stringify(event)),
      error: (event) => console.error(JSON.stringify(event)),
    },
  })
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT ?? '8080')
  createRuntimeApp(loadConfig(process.env)).listen(port, () => console.info(JSON.stringify({ status: 'listening', port })))
}
