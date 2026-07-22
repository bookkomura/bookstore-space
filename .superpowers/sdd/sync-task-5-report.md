# Sync Task 5 implementation report

## Scope delivered

Implemented unapplied deployment provisioning and operations handoff for `newsletter-sync`. No Terraform apply was run and no cloud, Gmail, Storyblok, or Cloudflare service was contacted.

The Cloud Run Job reads `TASK_SERVICE_URL` and `REPLAY_SHARED_SECRET` only when its executable entrypoint runs. It rejects non-HTTPS targets, posts to `/tasks/renew-watch`, fails on non-success statuses, and does not log bearer values. To preserve the existing exact bearer task-route authentication while keeping the Cloud Run service private, the Job sends its Cloud Run identity in `X-Serverless-Authorization` and leaves `Authorization: Bearer <shared secret>` unchanged for the application.

## Changed paths

- `services/newsletter-sync/Dockerfile`
- `services/newsletter-sync/.env.example`
- `services/newsletter-sync/src/renew-watch.ts`
- `services/newsletter-sync/test/renew-watch.test.ts`
- `services/newsletter-sync/README.md`
- `infra/newsletter-sync/main.tf`
- `infra/newsletter-sync/variables.tf`
- `infra/newsletter-sync/versions.tf`
- `infra/newsletter-sync/outputs.tf`
- `infra/newsletter-sync/README.md`
- `.superpowers/sdd/sync-task-5-report.md`

The existing untracked plan `docs/superpowers/plans/2026-07-22-newsletter-sync-provisioning.md` was preserved and is not part of this implementation commit.

## Test-first evidence

### RED

Command run before `src/renew-watch.ts` existed:

```sh
npm --prefix services/newsletter-sync test -- test/renew-watch.test.ts
```

Observed result: failed suite with `Cannot find module '../src/renew-watch.js'`, zero collected tests. This was the intended missing-runner failure.

Before adding the Cloud Run identity header, the focused test was also run and failed only because `x-serverless-authorization` was absent; the pre-existing bearer/HTTPS/status tests passed.

### GREEN

```sh
npm --prefix services/newsletter-sync test -- test/renew-watch.test.ts
```

Observed result: `1 passed`, `4 passed` tests.

## Verification results

| Command | Result |
| --- | --- |
| `npm --prefix services/newsletter-sync test -- test/renew-watch.test.ts` | Passed: 1 file, 4 tests. |
| `npm --prefix services/newsletter-sync test` | Passed outside the sandbox: 7 files, 66 tests. Initial sandbox attempt failed only because Supertest could not bind `0.0.0.0` (`EPERM`); the allowed unsandboxed rerun passed. |
| `npm --prefix services/newsletter-sync run build` | Passed: `tsc -p tsconfig.json`. |
| `terraform fmt -check -recursive infra/newsletter-sync` | Not run: Terraform is unavailable in this environment; exact shell result: `zsh:1: command not found: terraform`. |
| `git diff --check` | Passed with no whitespace errors. |

## Review fix: Gmail topic publisher IAM and deployment verification docs

Added a topic-scoped `roles/pubsub.publisher` grant for `serviceAccount:gmail-api-push@system.gserviceaccount.com`, allowing Gmail to establish and publish mailbox watches to the declared Gmail topic. Updated the IAM documentation to describe that narrowly scoped grant.

Moved `gcloud run services get-iam-policy` out of pre-apply review and into an explicitly post-apply verification section, because the Cloud Run service does not exist on a first deployment before apply.

| Command | Result |
| --- | --- |
| `rg -n -F 'serviceAccount:gmail-api-push@system.gserviceaccount.com' infra/newsletter-sync/main.tf` | Passed: found the Gmail API push service-account member in the topic IAM binding. |
| `rg -n -F 'After the first full apply has created the Cloud Run service' infra/newsletter-sync/README.md` | Passed: found the explicit post-apply condition. |
| `git diff --check` | Passed with no whitespace errors. |
| `terraform fmt -check -recursive infra/newsletter-sync` | Not run: Terraform is unavailable in this environment; exact shell result: `zsh:1: command not found: terraform`. |

## Assumptions and concerns

- Terraform has not been formatted or validated locally because the `terraform` executable is unavailable. Run `terraform fmt -check -recursive infra/newsletter-sync` and `terraform validate` in an environment with Terraform 1.6+ and the Google provider before applying.
- Firestore's `(default)` database may be a one-time project resource. Operators must confirm it does not already exist before a first apply, or import it into state if it does.
- Image-registry reader IAM is intentionally outside this module because registry ownership varies; operators must grant the Cloud Run service agent access when using a private registry.
- Terraform creates only secret containers and IAM. All secret versions remain an out-of-band operator responsibility and no values are present in source or state configuration.

## Final re-review fix: deploy outbox acknowledgement and hook deadline

### Changed paths

- `services/newsletter-sync/src/service.ts`
- `services/newsletter-sync/test/service.test.ts`
- `.superpowers/sdd/sync-task-5-report.md`

### RED/GREEN

RED command, before production changes:

```sh
npm --prefix services/newsletter-sync test -- test/service.test.ts
```

Observed result: 2 failing regressions (17 passing). The parallel delivery test showed `syncHistory('901')` resolving and thereby acknowledging the Gmail cursor while the original deploy hook still held the outbox lease. The hanging-hook test showed the hook was invoked without an `AbortSignal` (`expected undefined to be true`).

GREEN command:

```sh
npm --prefix services/newsletter-sync test -- test/service.test.ts
```

Observed result: 1 file, 19 tests passed. A live deploy outbox lease now raises `DeployInProgressError`, so history sync remains retryable and does not set its cursor. Deploy hooks receive an `AbortSignal`; service execution races the hook against a nine-minute abort deadline, before the ten-minute Firestore lease. `createDeployHook` forwards that signal to `fetch`. A hanging original invocation is aborted, an expired unreleased lease is reclaimable, and its later settlement cannot mark the reclaimed outbox claim.

### Verification results

| Command | Result |
| --- | --- |
| `npm --prefix services/newsletter-sync test -- test/service.test.ts` | Passed: 1 file, 19 tests. |
| `npm --prefix services/newsletter-sync test` | Passed outside the sandbox: 7 files, 70 tests. The sandbox attempt failed only because Supertest could not bind `0.0.0.0` (`listen EPERM`); the permitted local rerun passed. |
| `npm --prefix services/newsletter-sync run build` | Passed: `tsc -p tsconfig.json`. |
| `git diff --check` | Passed with no whitespace errors. |
| Fixture diff/hash check | No fixture diff; `newsletter.eml` SHA-256 is `33e1dab313ac693e4c6a5081efac6a2be8bb3b75e911aad4c133f87b30e0c529`. |

### Constraints preserved

- No Terraform apply and no cloud calls were made.
- No bearer secret, Message-ID, or message content is logged by this change.
- The deploy-failure path releases the active claim where possible and preserves the existing cursor retry behavior.
- `services/newsletter-sync/test/fixtures/newsletter.eml` was not modified; its documented CRLF compatibility constraint remains non-blocking.

## Final branch review fixes

### RED/GREEN

- RED: `npm test -- test/service.test.ts test/gmail.test.ts` failed as intended: metadata filtering still returned and downloaded every history message, parallel duplicate deliveries invoked the deploy hook twice, and an ineligible malformed history ref reached strict MIME parsing. The repository lease regression also initially failed because `claimPendingDeploy` did not exist.
- GREEN: added Firestore transaction-backed deploy claims with opaque lease tokens and expiry/reclaim behavior. Only the active token can complete or release the outbox claim; deploy-hook failures release that claim and preserve the existing cursor retry semantics. Gmail now fetches `From`/`Subject` metadata and Inbox labels before raw MIME, and the service rechecks that metadata before strict parsing. Malformed eligible mail remains retryable.
- Documentation now gives separate post-apply IAM checks for the Cloud Run service, Cloud Run Job, and Gmail Pub/Sub topic, and scopes the deployer's `iam.serviceAccounts.actAs` prerequisite to the four attached service accounts.

### Verification results

| Command | Result |
| --- | --- |
| `npm test -- test/service.test.ts test/gmail.test.ts test/http.test.ts` | Passed outside the sandbox: 3 files, 38 tests. The sandbox attempt failed only because Supertest could not bind `0.0.0.0` (`listen EPERM: operation not permitted`). |
| `npm test` | Passed outside the sandbox: 7 files, 68 tests. |
| `npm run build` | Passed: `tsc -p tsconfig.json`. |
| `git diff --check` | Passed with no whitespace errors. |
