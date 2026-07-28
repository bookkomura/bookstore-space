# Newsletter Sync service

This service receives authenticated Gmail Pub/Sub pushes at `POST /pubsub/gmail`, synchronizes eligible INBOX mail into Storyblok, and exposes bearer-protected task routes for watch renewal and replay. It is designed to run as the Cloud Run service and as the `renew-watch` Cloud Run Job described in [the infrastructure README](../../infra/newsletter-sync/README.md).

The complete runtime diagram, trigger explanation, account migration procedure,
cutover, rollback, and production verification checklist are documented in the
[cloud runbook](../../docs/newsletter-sync-cloud-runbook.md).

## Build and run

Build the deployable image from this directory:

```sh
docker build --tag newsletter-sync:local .
```

The container listens on `PORT` (Cloud Run supplies `8080`). The normal service command is `node dist/index.js`. The renewal job command is `node dist/renew-watch.js`; it obtains its Cloud Run identity from the metadata server, sends it in `X-Serverless-Authorization`, and keeps the existing task bearer value in `Authorization` for the application route.

## Runtime environment

The service requires these environment variables. The Terraform configuration supplies the values marked **Secret Manager** from secret references; it does not create secret versions or values.

| Variable | Source | Purpose |
| --- | --- | --- |
| `GCP_PROJECT_ID` | Terraform value | Firestore project. |
| `GMAIL_USER_EMAIL` | Terraform value | Gmail mailbox to watch. |
| `GMAIL_PUBSUB_TOPIC` | Terraform topic reference | Gmail watch topic. |
| `STORYBLOK_SPACE_ID` | Terraform value | Storyblok space. |
| `GMAIL_OAUTH_CLIENT_ID` | **Secret Manager** | Gmail OAuth client identifier. |
| `GMAIL_OAUTH_CLIENT_SECRET` | **Secret Manager** | Gmail OAuth client secret. |
| `GMAIL_OAUTH_REFRESH_TOKEN` | **Secret Manager** | Gmail OAuth refresh token. |
| `STORYBLOK_MANAGEMENT_TOKEN` | **Secret Manager** | Storyblok management credential. |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | **Secret Manager** | Cloudflare deploy-hook URL. |
| `REPLAY_SHARED_SECRET` | **Secret Manager** | Exact bearer value accepted by task routes. |

The renewal Job additionally requires `TASK_SERVICE_URL`, set by Terraform to the deployed service URL plus `/tasks`, and the same `REPLAY_SHARED_SECRET` through a Secret Manager reference. `.env.example` lists the runner name for local operational use but intentionally contains no values.

Never print or commit any credential, deploy-hook URL, bearer value, mail body, token, or mail message identifier. The service keeps source message identifiers in Firestore only; they must not be copied to Storyblok, frontend content, logs, Terraform outputs, or operator examples.

## Gmail OAuth and watch activation

Create a Google OAuth client for the mailbox outside Terraform and obtain a refresh token with the Gmail readonly scope. Store the OAuth details as secret versions after Terraform has created the containers. The watch uses the provisioned topic and is intentionally limited to `labelIds: ['INBOX']` by the service.

After infrastructure deployment and secret version creation, run the renewal Job once before relying on Pub/Sub delivery. This records the Gmail history cursor and creates the initial INBOX watch. Do not enable or test production Gmail push until this initial run succeeds.

## Manual operations

The scheduler is the normal watch-renewal mechanism. For a controlled replay, obtain the protected task URL and bearer value through approved operational channels, then invoke the existing route without echoing the secret:

```sh
curl --fail --silent --show-error --request POST "$TASK_SERVICE_URL/replay" \
  --header "Authorization: Bearer ${REPLAY_SHARED_SECRET:?set in a protected shell}"
```

This command intentionally contains only an environment-variable reference. Do not paste a bearer value into terminal history, scripts, logs, tickets, or documentation.
