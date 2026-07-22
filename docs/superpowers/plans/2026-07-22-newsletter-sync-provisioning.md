# Newsletter Sync Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supply a reproducible Cloud Run deployment shape and documentation for Gmail-driven newsletter synchronization without applying external resources.

**Architecture:** The existing Express service runs in Cloud Run. Gmail Pub/Sub calls its authenticated push endpoint. A separate Cloud Run Job, started by Cloud Scheduler using IAM, reads the task bearer secret from Secret Manager and calls the service's renewal endpoint; this prevents the scheduler configuration from containing the secret.

**Tech Stack:** Node.js 22, TypeScript, Express, Google Cloud Run, Cloud Run Jobs, Pub/Sub, Firestore, Secret Manager, Cloud Scheduler, Terraform Google provider.

## Global Constraints

- Only provisioning code and documentation; do not apply Terraform or call external services.
- `sourceMessageId` remains Firestore-private and is excluded from Storyblok, frontend, logs, Terraform outputs, and documentation examples.
- Existing task endpoints remain exact bearer-secret authenticated with timing-safe comparison.
- Gmail watch is INBOX-only and uses the configured Pub/Sub topic.
- Push subscription calls `POST /pubsub/gmail` with an OIDC identity limited to Cloud Run invocation.
- Terraform creates secret containers and IAM, not secret values or versions.
- The scheduler never contains the task bearer secret.

---

### Task 1: Deployable service, renewal job, infrastructure and operations docs

**Files:**
- Create: `services/newsletter-sync/Dockerfile`
- Create: `services/newsletter-sync/src/renew-watch.ts`
- Create: `services/newsletter-sync/test/renew-watch.test.ts`
- Create: `services/newsletter-sync/README.md`
- Create: `infra/newsletter-sync/*.tf`
- Create: `infra/newsletter-sync/README.md`
- Modify: `services/newsletter-sync/.env.example`

**Interfaces:**
- Consumes: `POST /tasks/renew-watch` accepts `Authorization: Bearer <REPLAY_SHARED_SECRET>`.
- Produces: `runRenewWatch(dependencies)` or equivalent DI-friendly function that reads environment only in its executable entrypoint.

- [ ] **Step 1: Write a failing runner test**

```ts
it('posts the exact bearer secret to the HTTPS renewal endpoint', async () => {
  await runRenewWatch({ taskUrl: 'https://sync.example/tasks', bearerSecret: 'secret', fetch })
  expect(fetch).toHaveBeenCalledWith(
    'https://sync.example/tasks/renew-watch',
    expect.objectContaining({ method: 'POST', headers: { authorization: 'Bearer secret' } }),
  )
})
```

- [ ] **Step 2: Run the test and verify it fails because the runner is absent**

Run: `npm --prefix services/newsletter-sync test -- test/renew-watch.test.ts`

Expected: FAIL because `runRenewWatch` cannot be imported.

- [ ] **Step 3: Implement the minimal DI-friendly runner**

```ts
export async function runRenewWatch(input: { taskUrl: string; bearerSecret: string; fetch?: typeof globalThis.fetch }): Promise<void> {
  const url = new URL('/tasks/renew-watch', input.taskUrl.endsWith('/') ? input.taskUrl : `${input.taskUrl}/`)
  if (url.protocol !== 'https:') throw new Error('TASK_SERVICE_URL must use HTTPS')
  const response = await (input.fetch ?? globalThis.fetch)(url, { method: 'POST', headers: { authorization: `Bearer ${input.bearerSecret}` } })
  if (!response.ok) throw new Error(`renew watch request failed with status ${response.status}`)
}
```

Keep the direct executable entrypoint responsible for reading `TASK_SERVICE_URL` and `REPLAY_SHARED_SECRET`, with no secret logging.

- [ ] **Step 4: Run runner tests and the service suite**

Run: `npm --prefix services/newsletter-sync test -- test/renew-watch.test.ts` then `npm --prefix services/newsletter-sync test`

Expected: PASS.

- [ ] **Step 5: Add Dockerfile, Terraform, and operational documentation**

Use a Node 22 multi-stage image. Terraform must declare API enablement, Cloud Run service/job, Firestore, Pub/Sub topic/subscription with OIDC, Secret Manager containers/IAM, scheduler job that invokes the renewal Cloud Run Job with OAuth, and least-privilege service accounts. Document prerequisite secret-version creation outside Terraform, variables, deployment order, Gmail OAuth and watch activation, and replay/rollback commands.

- [ ] **Step 6: Format, build, inspect and commit**

Run: `terraform fmt -check -recursive infra/newsletter-sync`, `npm --prefix services/newsletter-sync run build`, and `git diff --check`.

Commit with a conventional message such as `feat: provision newsletter sync service`.
