import { z } from 'zod'

export interface SyncConfig {
  projectId: string
  gmailUserEmail: string
  gmailOAuthClientId: string
  gmailOAuthClientSecret: string
  gmailOAuthRefreshToken: string
  storyblokSpaceId: string
  storyblokManagementToken: string
  cloudflareDeployHookUrl: string
  gmailPubsubTopic: string
  replaySharedSecret: string
  senders: readonly string[]
  subjectNeedle: '小村碎碎念'
}

const requiredString = z.string().min(1)

const environmentSchema = z.object({
  GCP_PROJECT_ID: requiredString,
  GMAIL_USER_EMAIL: requiredString,
  GMAIL_OAUTH_CLIENT_ID: requiredString,
  GMAIL_OAUTH_CLIENT_SECRET: requiredString,
  GMAIL_OAUTH_REFRESH_TOKEN: requiredString,
  STORYBLOK_SPACE_ID: requiredString,
  STORYBLOK_MANAGEMENT_TOKEN: requiredString,
  CLOUDFLARE_DEPLOY_HOOK_URL: z
    .string()
    .min(1, 'CLOUDFLARE_DEPLOY_HOOK_URL is required')
    .refine(
      (value) => {
        try {
          return new URL(value).protocol === 'https:'
        } catch {
          return false
        }
      },
      'CLOUDFLARE_DEPLOY_HOOK_URL must use HTTPS',
    ),
  GMAIL_PUBSUB_TOPIC: requiredString,
  REPLAY_SHARED_SECRET: requiredString,
})

export function loadConfig(env: NodeJS.ProcessEnv): SyncConfig {
  const values = environmentSchema.parse(env)

  return {
    projectId: values.GCP_PROJECT_ID,
    gmailUserEmail: values.GMAIL_USER_EMAIL,
    gmailOAuthClientId: values.GMAIL_OAUTH_CLIENT_ID,
    gmailOAuthClientSecret: values.GMAIL_OAUTH_CLIENT_SECRET,
    gmailOAuthRefreshToken: values.GMAIL_OAUTH_REFRESH_TOKEN,
    storyblokSpaceId: values.STORYBLOK_SPACE_ID,
    storyblokManagementToken: values.STORYBLOK_MANAGEMENT_TOKEN,
    cloudflareDeployHookUrl: values.CLOUDFLARE_DEPLOY_HOOK_URL,
    gmailPubsubTopic: values.GMAIL_PUBSUB_TOPIC,
    replaySharedSecret: values.REPLAY_SHARED_SECRET,
    senders: ['info.rewildesign@gmail.com', 'csc981.04@gmail.com'],
    subjectNeedle: '小村碎碎念',
  }
}
