# 小村碎碎念自動同步服務 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將符合指定寄件者與主旨的 Gmail 新郵件可靠地轉成已發布的 Storyblok newsletter，成功後觸發 Cloudflare Pages 部署。

**Architecture:** 建立獨立 TypeScript Cloud Run service。Gmail watch 發送至 Cloud Pub/Sub，IAM 保護的 push subscription 呼叫 service；Firestore 保存 History cursor、watch 到期與逐信 idempotent 狀態。服務取得 raw MIME、抽出受限閱讀 blocks、上傳 CID 圖片、發布 Storyblok story，最後呼叫 Cloudflare deploy hook；Cloud Scheduler 每日續期與回補。

**Tech Stack:** Node.js 22、TypeScript、Express、Google Cloud Run、Cloud Pub/Sub、Cloud Firestore、Cloud Scheduler、Gmail API、Storyblok Management API、Vitest、Docker、Terraform。

## Global Constraints

- 只處理寄件者 `info.rewildesign@gmail.com`、主旨含 `小村碎碎念` 的 Inbox 信件。
- `sourceMessageId` 是 Firestore 去重鍵；不得進 Storyblok、前端 JSON、公開日誌或 git。
- Gmail OAuth refresh token、Storyblok token、deploy hook、任務密鑰只存 Secret Manager。
- Cloud Run 僅接受具 IAM `run.invoker` 的 Pub/Sub / Scheduler service account；不可有 `allUsers`。
- 無正文、MIME 失敗、非 HTTPS URL、資產失敗、Storyblok publish 失敗，均不得公開半篇。
- 成功 publish 才觸發 deploy；deploy 失敗只建立可重試 hook job，不得重建 story。
- 每日續 Gmail watch；History API cursor 回補延遲/遺失推播；同一 Message-ID 永不重複發布。

---

## File structure

| File | Responsibility |
| --- | --- |
| `services/newsletter-sync/src/config.ts` | 唯一讀取、驗證 runtime 設定的邊界。 |
| `services/newsletter-sync/src/gmail.ts` | watch、history、raw message、候選篩選。 |
| `services/newsletter-sync/src/mime.ts` | MIME 到順序固定 newsletter blocks / CID 附件。 |
| `services/newsletter-sync/src/repository.ts` | Firestore cursor、lease、同步/部署 retry 狀態。 |
| `services/newsletter-sync/src/storyblok.ts` | Asset upload、newsletter story create/publish。 |
| `services/newsletter-sync/src/service.ts` | idempotent 同步編排。 |
| `services/newsletter-sync/src/http.ts` | Pub/Sub、renew、replay HTTP 邊界。 |
| `services/newsletter-sync/infra/*.tf` | Cloud Run、IAM、Pub/Sub、Firestore、Scheduler、secrets。 |

### Task 1: Scaffold a safe isolated service

**Files:**
- Create: `services/newsletter-sync/package.json`
- Create: `services/newsletter-sync/tsconfig.json`
- Create: `services/newsletter-sync/.env.example`
- Create: `services/newsletter-sync/src/config.ts`
- Create: `services/newsletter-sync/src/index.ts`
- Create: `services/newsletter-sync/test/config.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces `loadConfig(env): SyncConfig`, the only configuration reader.
- Produces `npm --prefix services/newsletter-sync test|build|start`.

Use this exact public shape; keep all values internal to the service process:

```ts
export interface SyncConfig {
  projectId: string; gmailUserEmail: string; gmailOAuthClientId: string
  gmailOAuthClientSecret: string; gmailOAuthRefreshToken: string
  storyblokSpaceId: string; storyblokManagementToken: string
  cloudflareDeployHookUrl: string; gmailPubsubTopic: string
  replaySharedSecret: string; sender: 'info.rewildesign@gmail.com'
  subjectNeedle: '小村碎碎念'
}
export function loadConfig(env: NodeJS.ProcessEnv): SyncConfig
```

- [ ] **Step 1: Write failing config tests**

```ts
it('accepts required settings and fixed mailbox filter', () => {
  expect(loadConfig(validEnv)).toMatchObject({
    sender: 'info.rewildesign@gmail.com', subjectNeedle: '小村碎碎念',
  })
})
it.each(['http://example.test', '', undefined])('rejects unsafe deploy hook %s', (hook) => {
  expect(() => loadConfig({ ...validEnv, CLOUDFLARE_DEPLOY_HOOK_URL: hook })).toThrow('CLOUDFLARE_DEPLOY_HOOK_URL')
})
```

- [ ] **Step 2: Run the test**

Run: `npm --prefix services/newsletter-sync test -- config.test.ts`

Expected: FAIL because the service and `loadConfig` do not exist.

- [ ] **Step 3: Implement package and strict config**

Use Node 22. Dependencies: `express`, `googleapis`, `@google-cloud/firestore`, `mailparser`, `cheerio`, `zod`; dev dependencies: `typescript`, `tsx`, `vitest`, `@types/express`, `@types/node`, `supertest`, `@types/supertest`. Zod-parse exactly: `GCP_PROJECT_ID`, `GMAIL_USER_EMAIL`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_MANAGEMENT_TOKEN`, `CLOUDFLARE_DEPLOY_HOOK_URL`, `GMAIL_PUBSUB_TOPIC`, and `REPLAY_SHARED_SECRET`. Hard-code sender and subject needle in source.

Add `.env`, `.env.*`, and `services/newsletter-sync/coverage/` to `.gitignore`. The example file lists variable names with empty values only. `index.ts` exports the eventual app factory and never loads config at module import.

- [ ] **Step 4: Verify**

Run: `npm --prefix services/newsletter-sync test -- config.test.ts && npm --prefix services/newsletter-sync run build`

Expected: PASS; build produces `dist/` and no secret appears in output.

- [ ] **Step 5: Commit**

```bash
git add .gitignore services/newsletter-sync
git commit -m "feat: scaffold newsletter sync service"
```

### Task 2: Parse only eligible Gmail messages

**Files:**
- Create: `services/newsletter-sync/src/gmail.ts`
- Create: `services/newsletter-sync/src/mime.ts`
- Create: `services/newsletter-sync/test/fixtures/newsletter.eml`
- Create: `services/newsletter-sync/test/gmail.test.ts`
- Create: `services/newsletter-sync/test/mime.test.ts`

**Interfaces:**
- Produces `isEligibleMessage({ from, subject, labelIds }): boolean` and `fetchHistorySince(historyId): Promise<GmailMessageRef[]>`.
- Produces `parseNewsletterMime(raw): ParsedNewsletter`; its blocks are paragraph/image/link/divider and image blocks may reference `cid`.
- `service.ts` consumes only eligible, parsed messages with a valid RFC Message-ID.

```ts
export type ParsedBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'image'; cid: string; alt: string; caption?: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'divider' }
export interface ParsedNewsletter {
  messageId: string; gmailMessageId: string; sentAt: string; subject: string
  blocks: ParsedBlock[]; attachmentsByCid: ReadonlyMap<string, { content: Buffer; filename: string; contentType: string }>
}
export class HistoryCursorExpiredError extends Error {}
```

- [ ] **Step 1: Write failing fixture tests**

Copy `/Users/pai/Downloads/小村碎碎念～總是會到.eml` unchanged to the fixture. Assert sender, subject, valid Message-ID, all four CID names, preserved text/image/caption ordering, and every `https://` action link. Add negatives for wrong sender, subject without `小村碎碎念`, missing `INBOX`, unreadable body, and an `http://` anchor.

- [ ] **Step 2: Run parser tests**

Run: `npm --prefix services/newsletter-sync test -- mime.test.ts gmail.test.ts`

Expected: FAIL because parser and eligibility functions are absent.

- [ ] **Step 3: Implement deterministic parser and history access**

Use `simpleParser(Buffer.from(raw, 'base64url'))`; reject absent/malformed `messageId`. Parse HTML in document order with Cheerio: nonempty `p,h1,h2,h3,h4,h5,h6,li` become paragraphs; `img[src^="cid:"]` becomes an image; its immediately following paragraph becomes caption; `a[href]` becomes a link only if `new URL(href).protocol === 'https:'`; `hr` becomes divider. If HTML produces no blocks, parse nonempty plaintext lines as paragraphs. Preserve no arbitrary HTML, CSS, script, event handler, or non-HTTPS URL.

Implement History API paging with `users.history.list({ userId: 'me', startHistoryId, historyTypes: ['messageAdded'] })`, deduplicate Gmail ids, then load each raw message using `users.messages.get({ userId: 'me', id, format: 'raw' })`. Eligibility requires exact sender, fixed subject substring, and `INBOX`. Convert Gmail History 404 to `HistoryCursorExpiredError`.

- [ ] **Step 4: Verify**

Run: `npm --prefix services/newsletter-sync test -- mime.test.ts gmail.test.ts`

Expected: PASS; fixture retains four images and only allowed links, every negative is rejected.

- [ ] **Step 5: Commit**

```bash
git add services/newsletter-sync/src/gmail.ts services/newsletter-sync/src/mime.ts services/newsletter-sync/test
git commit -m "feat: parse eligible newsletter emails"
```

### Task 3: Make publication idempotent and never half-public

**Files:**
- Create: `services/newsletter-sync/src/repository.ts`
- Create: `services/newsletter-sync/src/storyblok.ts`
- Create: `services/newsletter-sync/src/service.ts`
- Create: `services/newsletter-sync/test/storyblok.test.ts`
- Create: `services/newsletter-sync/test/service.test.ts`

**Interfaces:**
- Produces `SyncRepository.claim(messageId): Promise<'claimed' | 'duplicate'>`, `markPublished`, `markFailed`, cursor methods, and deploy retries.
- Produces `StoryblokPublisher.publish(parsed): Promise<{ storyId: number }>`.
- Produces `NewsletterSyncService.syncHistory(historyId): Promise<SyncResult>`.

```ts
export interface SyncRepository {
  claim(messageId: string): Promise<'claimed' | 'duplicate'>
  markPublished(messageId: string, storyId: number): Promise<void>
  markFailed(messageId: string, reason: string): Promise<void>
  getCursor(): Promise<string | null>; setCursor(historyId: string): Promise<void>
  enqueueDeployRetry(storyId: number): Promise<void>
}
export interface SyncResult { examined: number; published: number; duplicates: number }
```

- [ ] **Step 1: Write failing idempotency and failure tests**

```ts
it('publishes a Message-ID once even when delivery repeats', async () => {
  repo.claim.mockResolvedValueOnce('claimed').mockResolvedValueOnce('duplicate')
  await service.process(message); await service.process(message)
  expect(publisher.publish).toHaveBeenCalledTimes(1)
})
it('does not deploy a failed asset upload and records a retryable failure', async () => {
  publisher.publish.mockRejectedValueOnce(new Error('asset upload failed'))
  await expect(service.process(message)).rejects.toThrow('asset upload failed')
  expect(deployHook).not.toHaveBeenCalled()
  expect(repo.markFailed).toHaveBeenCalledWith(message.messageId, expect.stringContaining('asset upload failed'))
})
```

- [ ] **Step 2: Run service tests**

Run: `npm --prefix services/newsletter-sync test -- service.test.ts storyblok.test.ts`

Expected: FAIL because repository, publisher, and service are missing.

- [ ] **Step 3: Implement durable state and publishing**

Use Firestore documents `newsletterSyncState/cursor`, `newsletterMessages/{sha256(messageId)}`, and `newsletterDeployRetries/{storyId}`. The mail document keeps original Message-ID only server-side plus `processing|published|failed`, timestamps, retry count, Gmail id, error reason. `claim` is a transaction: published or nonexpired processing lease is duplicate; otherwise acquire a ten-minute lease.

Upload every CID attachment through Storyblok Asset Manager, obtain its filename URL, and create component `newsletter` under the configured `newsletters` folder with only `sent_at`, `subject`, and allowed `blocks`. Image alt is caption or `小村碎碎念圖片`. Create with `publish=1` (or publish immediately) and verify published before return. Never put Message-ID in story content, story name, or slug.

The service order is claim → upload/publish → mark published → POST empty JSON to the HTTPS deploy hook. Publish error marks failure and prevents hook. Hook error saves retry job but never undoes/recreates story; retry sends hook only.

- [ ] **Step 4: Verify**

Run: `npm --prefix services/newsletter-sync test -- service.test.ts storyblok.test.ts`

Expected: PASS for duplicate, asset failure, publish failure, hook retry, message-ID absence from payload, and publish-before-deploy ordering.

- [ ] **Step 5: Commit**

```bash
git add services/newsletter-sync/src/repository.ts services/newsletter-sync/src/storyblok.ts services/newsletter-sync/src/service.ts services/newsletter-sync/test
git commit -m "feat: publish newsletters idempotently"
```

### Task 4: Receive authenticated push and keep Gmail watch current

**Files:**
- Create: `services/newsletter-sync/src/http.ts`
- Modify: `services/newsletter-sync/src/index.ts`
- Create: `services/newsletter-sync/test/http.test.ts`

**Interfaces:**
- Produces `POST /pubsub/gmail`, `POST /tasks/renew-watch`, `POST /tasks/replay`, and `GET /healthz`.
- Cloud Run IAM protects Pub/Sub route; task routes also require an exact bearer secret until OIDC Scheduler deployment is live.

- [ ] **Step 1: Write failing endpoint tests**

```ts
it('decodes a Pub/Sub historyId and synchronizes it', async () => {
  await request(app).post('/pubsub/gmail')
    .send({ message: { data: Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64') } }).expect(204)
  expect(service.syncHistory).toHaveBeenCalledWith('123')
})
it('rejects unauthorised replay and saves renewed watch cursor', async () => {
  await request(app).post('/tasks/replay').expect(401)
  await request(app).post('/tasks/renew-watch').set('Authorization', `Bearer ${secret}`).expect(204)
  expect(repository.setWatch).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run endpoint tests**

Run: `npm --prefix services/newsletter-sync test -- http.test.ts`

Expected: FAIL because the app and routes do not exist.

- [ ] **Step 3: Implement bounded HTTP behavior**

Validate Pub/Sub envelope shape before base64 decoding. Malformed input returns 400; normal unexpected error returns 500 for Pub/Sub retry; success returns 204 only after bounded work queues or completes. Never accept a history ID supplied outside encoded Pub/Sub data.

Renew invokes Gmail `users.watch` using `labelIds: ['INBOX']` and the provisioned topic, then saves returned `historyId` and expiration. Replay starts at cursor; if it sees `HistoryCursorExpiredError`, query last 30 Inbox days with the same sender/subject filter in chronological order, then store the fresh cursor. Both task routes use `timingSafeEqual` bearer comparison and log only request id/status/count, never mail body, token, or Message-ID.

- [ ] **Step 4: Verify**

Run: `npm --prefix services/newsletter-sync test && npm --prefix services/newsletter-sync run build`

Expected: PASS for malformed push, authorization, 404 history expiry, and retryable error branches.

- [ ] **Step 5: Commit**

```bash
git add services/newsletter-sync/src/http.ts services/newsletter-sync/src/index.ts services/newsletter-sync/test/http.test.ts
git commit -m "feat: receive Gmail push notifications"
```

### Task 5: Provision the private production path

**Files:**
- Create: `services/newsletter-sync/Dockerfile`
- Create: `services/newsletter-sync/infra/main.tf`
- Create: `services/newsletter-sync/infra/variables.tf`
- Create: `services/newsletter-sync/infra/outputs.tf`
- Create: `services/newsletter-sync/infra/README.md`
- Create: `services/newsletter-sync/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces private Cloud Run service, Gmail-compatible Pub/Sub topic/push subscription, Firestore state, Scheduler task jobs, and Secret Manager mounts.

- [ ] **Step 1: Write infrastructure review check**

Add an infrastructure README checklist that requires `terraform validate`, `gcloud run services get-iam-policy`, and a dry-run Pub/Sub delivery. Add a config test that confirms errors/redacted config output never serialize keys matching `TOKEN|SECRET|REFRESH`.

- [ ] **Step 2: Run checks**

Run: `npm --prefix services/newsletter-sync test -- config.test.ts && terraform -chdir=services/newsletter-sync/infra validate`

Expected: initially FAIL until Terraform and redaction are implemented.

- [ ] **Step 3: Implement Terraform and operator handoff**

Provision Google APIs for Run/PubSub/Firestore/Scheduler/SecretManager/Gmail; dedicated runtime, Pub/Sub push, Scheduler accounts; `gmail-newsletter-events` topic; authenticated push subscription to `/pubsub/gmail`; Firestore Native; Secret Manager references (not values); Cloud Run; and two daily OIDC Scheduler jobs for renew/replay. Pub/Sub account gets only `roles/run.invoker`; do not bind `allUsers`. The image is Terraform input `image`, min instances 0, concurrency 1.

Document exact operator sequence: create Gmail OAuth credentials with readonly scope, obtain refresh token locally, create Secret Manager values, `terraform init`, `terraform apply -var image=...`, invoke renew watch, send fixture, inspect published Storyblok story, then confirm Cloudflare deployment and frontend archive. State that initial cursor setup must happen before enabling push.

- [ ] **Step 4: Run full verification**

Run: `npm --prefix services/newsletter-sync test && npm --prefix services/newsletter-sync run build && terraform -chdir=services/newsletter-sync/infra fmt -check && terraform -chdir=services/newsletter-sync/infra validate && npm test && npm run build`

Expected: all service/frontend tests pass, Terraform validates with provider credentials, and no route/IAM binding is public.

- [ ] **Step 5: Commit**

```bash
git add services/newsletter-sync README.md
git commit -m "feat: provision newsletter sync service"
```

## Spec coverage self-review

- Push, daily renewal, History cursor, and replay: Tasks 2 and 4.
- Exact filtering, MIME order, images/captions/links: Task 2.
- Asset upload, published Storyblok content, no partial article: Task 3.
- De-duplication, secret isolation, retry behavior, restricted ingress: Tasks 1, 3, 4, 5.
- Cloudflare deploy after publish only: Task 3.
- Cloud Run/PubSub/Firestore/Scheduler/IAM/operator setup: Task 5.
