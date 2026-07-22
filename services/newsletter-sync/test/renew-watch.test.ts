import { describe, expect, it, vi } from 'vitest'

import { runRenewWatch } from '../src/renew-watch.js'

describe('runRenewWatch', () => {
  it('posts the exact bearer secret to the HTTPS renewal endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await runRenewWatch({
      taskUrl: 'https://sync.example/tasks',
      bearerSecret: 'renewal-secret',
      fetch,
    })

    expect(fetch).toHaveBeenCalledWith('https://sync.example/tasks/renew-watch', {
      method: 'POST',
      headers: { authorization: 'Bearer renewal-secret' },
    })
  })

  it('rejects a target URL that does not use HTTPS', async () => {
    const fetch = vi.fn()

    await expect(
      runRenewWatch({
        taskUrl: 'http://sync.example',
        bearerSecret: 'renewal-secret',
        fetch,
      }),
    ).rejects.toThrow('TASK_SERVICE_URL must use HTTPS')

    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends the Cloud Run identity separately from task bearer authentication', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await runRenewWatch({
      taskUrl: 'https://sync.example',
      bearerSecret: 'renewal-secret',
      cloudRunIdentityToken: 'identity-token',
      fetch,
    })

    expect(fetch).toHaveBeenCalledWith('https://sync.example/tasks/renew-watch', {
      method: 'POST',
      headers: {
        authorization: 'Bearer renewal-secret',
        'x-serverless-authorization': 'Bearer identity-token',
      },
    })
  })

  it('fails on a non-success response without including the bearer secret', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))

    await expect(
      runRenewWatch({
        taskUrl: 'https://sync.example',
        bearerSecret: 'renewal-secret',
        fetch,
      }),
    ).rejects.toThrow('renew watch request failed with status 503')
  })
})
