# Cloud Run newsletter-sync startup investigation

## Observations

- The full Terraform apply created service accounts, Secret Manager IAM, and began creating the Cloud Run service.
- Cloud Run revision `newsletter-sync-00001-2l6` failed its startup health check because the user-provided container did not listen on `PORT=8080`.
- The image was built locally from `services/newsletter-sync/Dockerfile` and pushed to Artifact Registry with tag `bdf84a5`.
- The application entrypoint is `node dist/index.js`; the source uses `process.env.PORT ?? '8080'` and calls `listen`.
- Six runtime Secret Manager containers were populated before the full apply.

## Hypotheses

### H1: The container exits during startup because a runtime environment value is missing or invalid (ROOT HYPOTHESIS)
- Supports: `loadConfig(process.env)` validates ten required values before the server starts; Cloud Run injects the values through Secret Manager references.
- Conflicts: all six Secret Manager containers have been populated, but the deployed revision logs have not yet been inspected.
- Test: read the failed revision logs and look for a Zod/configuration error or Secret Manager injection error.

### H2: The image was built for an incompatible CPU architecture
- Supports: the image was built on Apple Silicon (`darwin_arm64`), and no explicit platform was supplied to `docker build`.
- Conflicts: an architecture failure normally reports an `exec format error` rather than only a port timeout.
- Test: inspect the pushed image architecture and compare it with the Cloud Run runtime error logs.

### H3: The Node process starts but fails before `listen` due to an entrypoint or dependency problem
- Supports: the Dockerfile copies only `dist` into the runtime image, so an incorrect build output or module-resolution error would occur before listening.
- Conflicts: the Docker build completed successfully, including TypeScript compilation.
- Test: run the exact image locally with non-secret placeholder environment values and inspect its startup output.

### H4: Cloud Run is not passing the expected port
- Supports: the platform error mentions the port contract.
- Conflicts: the application explicitly reads `PORT` and defaults to `8080`, while Terraform declares container port `8080`.
- Test: inspect the failed revision configuration and local startup behavior.

## Experiments

### E1: Read the failed Cloud Run revision logs
- Result: confirmed H2.
- Evidence: Cloud Run reported `failed to load /usr/local/bin/docker-entrypoint.sh: exec format error`.
- Interpretation: the image architecture is incompatible with the Cloud Run runtime; the application never reached Node startup or the port listener.

## Root Cause

The image was built on Apple Silicon as an ARM image and deployed to Cloud Run, which could not execute its entrypoint.

The first replacement attempt was then blocked because the tainted Cloud Run service had Terraform deletion protection enabled.

## Fix

Rebuild the image explicitly for `linux/amd64` and deploy it under a new immutable tag.

Temporarily set Cloud Run deletion protection to `false` so Terraform can replace the failed service; restore protection after the healthy service is deployed.

The first attempt still failed because Terraform tried to destroy the tainted service before applying the deletion-protection change. The next experiment is to remove the taint without deleting the resource, then apply the protection and image update in place.

After the amd64 service update succeeded, Google provider `6.50.0` failed while expanding values that depend on the newly known Cloud Run URL. The failing resources were the renewal Job's `TASK_SERVICE_URL` and the Pub/Sub push endpoint/audience. State inspection shows the Cloud Run service and prerequisites exist, while the renewal Job, Pub/Sub subscription, and Scheduler job are not yet in state.

The remaining resources were applied successfully after the Cloud Run URL became known, and deletion protection is restored to `true` in configuration.

The first `newsletter-sync-renew-watch` Cloud Run Job execution started successfully but exited with code 1. The application error logs are still needed to distinguish authentication, Cloud Run invocation, and Gmail/Pub/Sub watch failures.

The attached execution logs show the Job reached Cloud Run and received HTTP 500. The Job's Secret Manager injection and identity-token path are therefore working; the service's handler currently suppresses the underlying Gmail/Firestore exception, so the next diagnostic is the Gmail system publisher IAM binding.

The Gmail system publisher binding is present on `gmail-newsletter-events`. Because the handler still hides the downstream exception, a temporary privacy-safe error message will be logged for the renewal route only.

The diagnostic renewal execution logged `invalid_client` from the Gmail OAuth flow. This confirms the deployed Gmail client credentials and refresh token do not form a valid matching set; Pub/Sub IAM and Cloud Run invocation are not the current blockers.

The Gmail Client ID, Client Secret, and Refresh Token were regenerated from the same Web Client and updated as new Secret Manager versions. A new revision is required so Cloud Run reads the latest secret versions.

After redeploying the new revision, the renewal execution still reports `invalid_client`. This means the values used by OAuth Playground and the values deployed to Cloud Run are still not provably the exact same client pair; the next experiment is to use the Web Client's downloaded JSON as the single source of truth.

The operator confirms the Client ID and Secret appear identical. The next experiment compares SHA-256 hashes of the downloaded Web Client JSON fields against the exact bytes stored in Secret Manager, without displaying credential values.

The SHA-256 comparisons showed that both Secret Manager values differed from the downloaded Web Client JSON. The wrong JSON file had been used. The Client ID and Client Secret were then imported directly from the correct JSON as new Secret Manager versions, and a new refresh token was authorized for `bookkomura@gmail.com` with the Gmail readonly scope.

### E2: Deploy a new revision using the corrected OAuth secret set
- Expected confirmation: the renewal job completes and Gmail Watch is registered.
- Expected rejection: the job still reports `invalid_client`, indicating that the runtime is not resolving the corrected versions or that the refresh token belongs to a different client.
- Change under test: only the container image tag changes, forcing Cloud Run and the renewal Job to create revisions that resolve the latest Secret Manager versions.
- Result: confirmed. Execution `newsletter-sync-renew-watch-hqsd5` completed successfully with one of one tasks complete.
- Interpretation: the corrected Client ID, Client Secret, and Refresh Token are a valid matching OAuth set, and Gmail Watch initialization is operational.

## OAuth Root Cause

The `invalid_client` failures were caused by importing Client ID and Client Secret values from the wrong downloaded OAuth JSON file, so the deployed credentials did not match the refresh token's Web Client.

## Pub/Sub Push Investigation

### Observations

- A controlled eligible test message was sent after Gmail Watch initialization succeeded.
- Cloud Run received repeated authenticated requests at `/pubsub/gmail` on revision `newsletter-sync-00005-bwh`.
- Every observed request returned HTTP 400 in about 3 ms, so the request is rejected by `parseHistoryId` before Gmail history synchronization, Firestore publication state, Storyblok, or Cloudflare.
- Terraform configures the standard wrapped Pub/Sub push format; `no_wrapper` is not enabled.

### Hypotheses

#### P1: The Gmail notification `data` uses valid but unpadded Base64 that the canonical-only validator rejects (ROOT HYPOTHESIS)
- Supports: HTTP 400 is produced only when the envelope/data/history ID fails parsing; the validator requires padding and a length divisible by four.
- Conflicts: Pub/Sub normally documents message data as standard Base64.
- Test: inspect one pending subscription message structurally and report only Base64 length/modulo and decoded field types.

#### P2: The deployed subscription sends an unwrapped payload
- Supports: an unwrapped body would not contain `message.data` and would produce this exact 400.
- Conflicts: Terraform has no `no_wrapper` block.
- Test: inspect the pending message envelope keys and the live subscription configuration.

#### P3: Gmail emits `historyId` with a non-string JSON type
- Supports: the parser rejects numeric history IDs.
- Conflicts: Gmail notification examples use a string.
- Test: decode one pending message and report only the JSON field names and types, not values.

#### P4: Express does not parse the request as JSON
- Supports: an undefined or buffer body would produce the same 400.
- Conflicts: Pub/Sub wrapped pushes normally use `application/json`, and `express.json()` is installed.
- Test: if the pending message is structurally valid, add one temporary privacy-safe shape log at the HTTP boundary.

### Experiments

#### E3: Inspect the live subscription and pull one pending message
- Live configuration confirms the expected push endpoint and OIDC audience and does not show `noWrapper`; P2 is rejected.
- Pub/Sub rejected `subscriptions pull` with `FAILED_PRECONDITION` because this subscription type does not support pull, so the payload-structure portion was inconclusive.
- Next experiment: add a temporary boundary log containing only body/data types, key names, lengths, and Base64 validity.

#### E4: Log the live Pub/Sub envelope shape
- Result: the body is parsed JSON with `message` and `subscription`; `message.data` is a string with valid canonical Base64, length 76 and modulo four equal to zero.
- Interpretation: P1, P2, and P4 are rejected. Parsing fails after Base64 validation, leaving decoded JSON shape/type as the root boundary.
- Next experiment: log only decoded key names and the JSON type of `historyId`.

#### E5: Inspect decoded field types
- Result: the decoded Gmail notification contains `emailAddress` and `historyId`, and the live `historyId` JSON type is `number`.
- Interpretation: P3 is confirmed. The service rejected every valid Gmail push because `parseHistoryId` accepted only a string.

### Pub/Sub Root Cause

Gmail emits the watched mailbox's `historyId` as a JSON number in the live Pub/Sub notification, while the HTTP boundary accepted only a non-empty string.

### Pub/Sub Fix

- Added a regression test proving numeric Gmail history IDs are normalized to strings before synchronization.
- The test failed with the original HTTP 400 behavior, then passed after the minimal parser change.
- Removed all temporary payload and OAuth diagnostic logging.
- Full newsletter-sync verification passed: 7 test files, 71 tests, and TypeScript compilation.
- Deployed image `bdf84a5-historyid-amd64`; live Pub/Sub delivery advanced from HTTP 400 to HTTP 500, confirming the payload parser fix and exposing the next downstream setup boundary.

## Storyblok Publication Investigation

### Observations

- Firestore contains one newsletter message with status `failed`.
- The privacy-safe persisted reason is `Storyblok folder newsletters was not found`.
- Pub/Sub continues retrying the same notification, so the message can recover after the Storyblok content structure is completed.
- After the folder was created, the retry advanced into asset upload and failed with `Storyblok did not return an uploaded asset filename`.
- The failure occurs after the signed upload request and S3 upload return success, at the `finish_upload` response boundary.

### Hypotheses

#### S1: `finish_upload` returns the asset fields at a different nesting level than the client expects (ROOT HYPOTHESIS)
- Supports: the request succeeds but `completed.asset?.filename` is missing.
- Conflicts: current official Storyblok documentation describes an `asset.filename` response.
- Test: inspect only top-level and nested response key names/types from one retry.

#### S2: The asset is created but validation is asynchronous, so `finish_upload` temporarily omits `filename`
- Supports: the S3 upload succeeds and repeated retries create/encounter asset state after upload.
- Conflicts: the official endpoint is documented to return a minimal completed asset.
- Test: list recent assets and inspect whether they already have string `filename`/`public_url` fields.

#### S3: The request uses an outdated `validate_upload`/finish flow
- Supports: Storyblok's upload APIs have evolved and the signed response may already contain the usable public asset URL.
- Conflicts: current official documentation still describes optional `validate_upload=1` followed by `finish_upload`.
- Test: compare the signed and finish response shape to current documentation without logging values.

#### S4: The Storyblok token can upload but cannot read the finished asset representation
- Supports: token scopes can differ by operation.
- Conflicts: insufficient access normally produces a non-2xx response, while this path reached a successful JSON response.
- Test: read the recent asset list using the same token and report only status and field types.

### Experiments

#### E6: Read recent Storyblok assets using the runtime token
- Result: HTTP 200; recent assets exist and expose `filename` as a string.
- Interpretation: S2 and S4 are rejected. S3's upload flow remains valid; the response parsing boundary is the likely fault.

#### E7: Re-run `finish_upload` for the newest completed asset and inspect only response keys/types
- Result: HTTP 200 with top-level keys `id`, `alt`, `copyright`, `filename`, `focus`, `is_private`, and `title`; there is no nested `asset` object.
- Interpretation: S1 is confirmed. The live API response differs from the documented nested shape expected by the client.

### Storyblok Root Cause

The live Storyblok `finish_upload` endpoint returns the minimal asset object at the response root, while the publisher read only `completed.asset.filename`.

### Storyblok Fix

- Added a regression test that mirrors the observed top-level response and fails with the original `Storyblok did not return an uploaded asset filename` error.
- Updated the publisher to accept both top-level `filename` and the documented nested `asset.filename`.
- Full newsletter-sync verification passed: 7 test files, 72 tests, and TypeScript compilation.
- Deployed image `bdf84a5-storyblok-amd64`.

## End-to-End Verification

- Latest Pub/Sub deliveries on revision `newsletter-sync-00009-j9n` return HTTP 204.
- Firestore newsletter message status is `published`.
- Firestore deploy outbox status is `complete`, confirming the Cloudflare deploy hook returned success.
- Direct Storyblok Management API verification returned HTTP 200 with `published: true`, full slug under `newsletters/`, component `newsletter`, and 45 content blocks.
