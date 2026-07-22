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

## Assumptions and concerns

- Terraform has not been formatted or validated locally because the `terraform` executable is unavailable. Run `terraform fmt -check -recursive infra/newsletter-sync` and `terraform validate` in an environment with Terraform 1.6+ and the Google provider before applying.
- Firestore's `(default)` database may be a one-time project resource. Operators must confirm it does not already exist before a first apply, or import it into state if it does.
- Image-registry reader IAM is intentionally outside this module because registry ownership varies; operators must grant the Cloud Run service agent access when using a private registry.
- Terraform creates only secret containers and IAM. All secret versions remain an out-of-band operator responsibility and no values are present in source or state configuration.
