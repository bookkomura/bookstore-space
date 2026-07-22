# Newsletter Sync Terraform

This directory declares, but does not apply, the Google Cloud resources for newsletter synchronization. It creates the Cloud Run service and renewal Job, Firestore Native database, Gmail Pub/Sub topic and authenticated push subscription, Secret Manager containers and access IAM, Cloud Scheduler renewal trigger, and the narrowly scoped service accounts needed by each component.

It intentionally never contains secret values or `google_secret_manager_secret_version` resources. Secret versions must be supplied through an approved out-of-band process.

## Required APIs and IAM

Terraform enables these APIs: Cloud Run, Cloud Scheduler, Firestore, Gmail, IAM Credentials, Pub/Sub, and Secret Manager.

The IAM model is intentionally separated:

| Identity | Permissions |
| --- | --- |
| Runtime service account | Firestore user and access to the six runtime secret containers. |
| Pub/Sub push service account | Cloud Run invoker on this service only. |
| Renewal Job service account | Access to the renewal bearer secret and Cloud Run invoker on this service only. |
| Scheduler service account | Cloud Run invoker on this Job only. |
| Google-managed Pub/Sub and Scheduler agents | Token-creation permission only for their respective caller service accounts. |

Pub/Sub pushes to `POST /pubsub/gmail` with an OIDC token whose audience is the deployed service URL. No `allUsers` Cloud Run IAM binding is created. The renewal Job gets an identity token from Cloud Run metadata and places it in `X-Serverless-Authorization`; Cloud Run consumes that header for IAM while the service still receives the exact bearer header it already requires at `POST /tasks/renew-watch`.

## Inputs

| Variable | Required | Meaning |
| --- | --- | --- |
| `project_id` | Yes | Target GCP project. |
| `region` | No | Cloud Run/Scheduler region; defaults to `asia-east1`. |
| `image` | Yes | Immutable image reference built from `services/newsletter-sync/Dockerfile`. |
| `gmail_user_email` | Yes | Watched mailbox; not a secret. |
| `storyblok_space_id` | Yes | Storyblok space; not a secret. |
| `renew_watch_schedule` | No | Cron schedule, default daily at `03:00`. |
| `scheduler_time_zone` | No | IANA schedule zone, default `Etc/UTC`. |

The following Secret Manager container IDs are fixed so runtime configuration is auditable: `newsletter-sync-gmail-oauth-client-id`, `newsletter-sync-gmail-oauth-client-secret`, `newsletter-sync-gmail-oauth-refresh-token`, `newsletter-sync-storyblok-management-token`, `newsletter-sync-cloudflare-deploy-hook-url`, and `newsletter-sync-replay-shared-secret`.

## Bootstrap and deployment order

1. Authenticate Terraform using an operator identity permitted to enable APIs and create the declared resources. Do not use a runtime service account.
2. Initialize Terraform and create only API enablement and empty secret containers:

   ```sh
   terraform init
   terraform apply \
     -target=google_project_service.required \
     -target=google_secret_manager_secret.runtime \
     -var project_id=PROJECT_ID \
     -var image=IMAGE_REFERENCE \
     -var gmail_user_email=MAILBOX_ADDRESS \
     -var storyblok_space_id=STORYBLOK_SPACE_ID
   ```

3. Add one approved secret version to each named container out of band. Keep values out of shell history, Terraform variables, state, source control, and CI output. Verify the Cloudflare deploy-hook value is the complete HTTPS hook URL.
4. Build and publish the image through the approved image registry workflow, then apply the full configuration:

   ```sh
   terraform apply \
     -var project_id=PROJECT_ID \
     -var image=IMAGE_REFERENCE \
     -var gmail_user_email=MAILBOX_ADDRESS \
     -var storyblok_space_id=STORYBLOK_SPACE_ID
   ```

5. Run `gcloud run jobs execute newsletter-sync-renew-watch --region=REGION --wait` once. Confirm a successful Job execution before Gmail push is relied on; this activates the INBOX-only watch and persists its initial cursor.
6. In Gmail, ensure the OAuth consent and refresh token are authorized for the watched mailbox with the readonly scope. The Gmail watch topic is the `gmail_pubsub_topic` Terraform output; do not substitute another topic.
7. Confirm the Pub/Sub subscription targets `/pubsub/gmail`, then observe a controlled eligible message through the normal privacy-safe operational logs. Do not copy message identifiers or email content into logs or tickets.

For a private registry, also grant the Cloud Run service agent read access to that image repository before the full apply. This is registry-specific and deliberately outside this module's broad IAM scope.

## Scheduler behavior, rollback, and replay

Cloud Scheduler calls the Cloud Run Jobs API with its own OAuth identity. It never receives `REPLAY_SHARED_SECRET`; the Job reads that value from Secret Manager immediately before posting to `/tasks/renew-watch`. The default schedule is daily and should remain more frequent than Gmail watch expiry.

Pause automatic renewal during an incident:

```sh
gcloud scheduler jobs pause newsletter-sync-renew-watch --location=REGION
```

Resume it after the service, OAuth authorization, and secret versions are known good:

```sh
gcloud scheduler jobs resume newsletter-sync-renew-watch --location=REGION
```

To renew manually, execute the Cloud Run Job as in the bootstrap sequence. To replay history, use the protected `/tasks/replay` route as documented in the [service README](../../services/newsletter-sync/README.md), only from an approved operator shell. If history has expired, the existing replay route performs its bounded INBOX recovery and renews the watch after successful processing.

Rollback application code by deploying a previously verified immutable image through the `image` input and applying Terraform again. Do not roll back by deleting Firestore state, Pub/Sub messages, or secret containers; those actions can make recovery destructive. Review Cloud Run Job execution and Scheduler logs for status only, never secret values, message identifiers, or mail content.

## Pre-apply review

Before a real apply, run:

```sh
terraform fmt -check -recursive
terraform validate
gcloud run services get-iam-policy newsletter-sync --region=REGION
```

Confirm the policy grants `roles/run.invoker` only to the Pub/Sub push and renewal Job service accounts, confirms the Job invokes through the scheduler account, and does not add a public invoker. Exercise Pub/Sub delivery only through an approved non-production verification procedure.
