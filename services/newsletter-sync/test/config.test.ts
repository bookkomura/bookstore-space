import { describe, expect, it } from 'vitest'

import { loadConfig } from '../src/config.js'
import { createApp } from '../src/index.js'

const validEnv: NodeJS.ProcessEnv = {
  GCP_PROJECT_ID: 'bookstore-space',
  GMAIL_USER_EMAIL: 'info.rewildesign@gmail.com',
  GMAIL_OAUTH_CLIENT_ID: 'client-id',
  GMAIL_OAUTH_CLIENT_SECRET: 'client-secret',
  GMAIL_OAUTH_REFRESH_TOKEN: 'refresh-token',
  STORYBLOK_SPACE_ID: '12345',
  STORYBLOK_MANAGEMENT_TOKEN: 'management-token',
  CLOUDFLARE_DEPLOY_HOOK_URL: 'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/example',
  GMAIL_PUBSUB_TOPIC: 'projects/bookstore-space/topics/newsletter-sync',
  REPLAY_SHARED_SECRET: 'replay-secret',
}

describe('loadConfig', () => {
  it('accepts required settings and fixed mailbox filter', () => {
    expect(loadConfig(validEnv)).toMatchObject({
      sender: 'info.rewildesign@gmail.com',
      subjectNeedle: '小村碎碎念',
    })
  })

  it.each(['http://example.test', '', undefined])('rejects unsafe deploy hook %s', (hook) => {
    expect(() => loadConfig({ ...validEnv, CLOUDFLARE_DEPLOY_HOOK_URL: hook })).toThrow(
      'CLOUDFLARE_DEPLOY_HOOK_URL',
    )
  })

  it.each(['GCP_PROJECT_ID', 'GMAIL_OAUTH_REFRESH_TOKEN', 'REPLAY_SHARED_SECRET'])(
    'rejects a missing required setting: %s',
    (name) => {
      const env = { ...validEnv }
      delete env[name]

      expect(() => loadConfig(env)).toThrow(name)
    },
  )
})

describe('createApp', () => {
  it('creates an app without reading process configuration', () => {
    expect(createApp()).toBeTypeOf('function')
  })
})
