import { pathToFileURL } from 'node:url'

export interface RenewWatchInput {
  taskUrl: string
  bearerSecret: string
  cloudRunIdentityToken?: string
  fetch?: typeof globalThis.fetch
}

export async function runRenewWatch(input: RenewWatchInput): Promise<void> {
  const url = renewalWatchUrl(input.taskUrl)

  const headers: Record<string, string> = { authorization: `Bearer ${input.bearerSecret}` }
  if (input.cloudRunIdentityToken) headers['x-serverless-authorization'] = `Bearer ${input.cloudRunIdentityToken}`

  const response = await (input.fetch ?? globalThis.fetch)(url.toString(), {
    method: 'POST',
    headers,
  })

  if (!response.ok) throw new Error(`renew watch request failed with status ${response.status}`)
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}

function renewalWatchUrl(taskUrl: string): URL {
  const url = new URL('/tasks/renew-watch', withTrailingSlash(taskUrl))
  if (url.protocol !== 'https:') throw new Error('TASK_SERVICE_URL must use HTTPS')
  return url
}

function loadRenewWatchInput(env: NodeJS.ProcessEnv): RenewWatchInput {
  if (!env.TASK_SERVICE_URL) throw new Error('TASK_SERVICE_URL is required')
  if (!env.REPLAY_SHARED_SECRET) throw new Error('REPLAY_SHARED_SECRET is required')

  return { taskUrl: env.TASK_SERVICE_URL, bearerSecret: env.REPLAY_SHARED_SECRET }
}

async function readCloudRunIdentityToken(taskUrl: string): Promise<string> {
  const audience = renewalWatchUrl(taskUrl).origin
  const endpoint = new URL('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity')
  endpoint.searchParams.set('audience', audience)
  endpoint.searchParams.set('format', 'full')

  const response = await globalThis.fetch(endpoint, { headers: { 'Metadata-Flavor': 'Google' } })
  if (!response.ok) throw new Error(`Cloud Run identity token request failed with status ${response.status}`)

  return response.text()
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const input = loadRenewWatchInput(process.env)
  readCloudRunIdentityToken(input.taskUrl)
    .then((cloudRunIdentityToken) => runRenewWatch({ ...input, cloudRunIdentityToken }))
    .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'renew watch request failed'
    console.error(JSON.stringify({ status: 'renew-watch-failed', message }))
    process.exitCode = 1
  })
}
