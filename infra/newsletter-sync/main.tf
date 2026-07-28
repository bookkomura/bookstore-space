data "google_project" "current" {}

locals {
  service_name = "newsletter-sync"
  secret_ids = {
    gmail_oauth_client_id      = "newsletter-sync-gmail-oauth-client-id"
    gmail_oauth_client_secret  = "newsletter-sync-gmail-oauth-client-secret"
    gmail_oauth_refresh_token  = "newsletter-sync-gmail-oauth-refresh-token"
    storyblok_management_token = "newsletter-sync-storyblok-management-token"
    cloudflare_deploy_hook_url = "newsletter-sync-cloudflare-deploy-hook-url"
    replay_shared_secret       = "newsletter-sync-replay-shared-secret"
  }
  required_apis = toset([
    "cloudscheduler.googleapis.com",
    "firestore.googleapis.com",
    "gmail.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_apis

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  account_id   = "newsletter-sync-runtime"
  display_name = "Newsletter Sync Cloud Run runtime"
}

resource "google_service_account" "pubsub_push" {
  account_id   = "newsletter-sync-pubsub-push"
  display_name = "Newsletter Sync Pub/Sub push identity"
}

resource "google_service_account" "renew_watch_job" {
  account_id   = "newsletter-sync-renew-watch"
  display_name = "Newsletter Sync renewal job"
}

resource "google_service_account" "scheduler" {
  account_id   = "newsletter-sync-scheduler"
  display_name = "Newsletter Sync scheduler"
}

resource "google_secret_manager_secret" "runtime" {
  for_each = local.secret_ids

  secret_id = each.value
  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_iam_member" "runtime_accessor" {
  for_each = google_secret_manager_secret.runtime

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_secret_manager_secret_iam_member" "renew_watch_accessor" {
  secret_id = google_secret_manager_secret.runtime["replay_shared_secret"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.renew_watch_job.email}"
}

resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_pubsub_topic" "gmail" {
  name       = "gmail-newsletter-events"
  depends_on = [google_project_service.required]
}

resource "google_pubsub_topic_iam_member" "gmail_publisher" {
  topic  = google_pubsub_topic.gmail.name
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:gmail-api-push@system.gserviceaccount.com"
}

resource "google_cloud_run_v2_service" "sync" {
  name                = local.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GMAIL_USER_EMAIL"
        value = var.gmail_user_email
      }
      env {
        name  = "GMAIL_PUBSUB_TOPIC"
        value = google_pubsub_topic.gmail.id
      }
      env {
        name  = "STORYBLOK_SPACE_ID"
        value = var.storyblok_space_id
      }

      dynamic "env" {
        for_each = {
          GMAIL_OAUTH_CLIENT_ID      = "gmail_oauth_client_id"
          GMAIL_OAUTH_CLIENT_SECRET  = "gmail_oauth_client_secret"
          GMAIL_OAUTH_REFRESH_TOKEN  = "gmail_oauth_refresh_token"
          STORYBLOK_MANAGEMENT_TOKEN = "storyblok_management_token"
          CLOUDFLARE_DEPLOY_HOOK_URL = "cloudflare_deploy_hook_url"
          REPLAY_SHARED_SECRET       = "replay_shared_secret"
        }

        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_project_iam_member.runtime_firestore,
    google_secret_manager_secret_iam_member.runtime_accessor,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  project  = google_cloud_run_v2_service.sync.project
  location = google_cloud_run_v2_service.sync.location
  name     = google_cloud_run_v2_service.sync.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_push.email}"
}

resource "google_cloud_run_v2_service_iam_member" "renew_watch_invoker" {
  project  = google_cloud_run_v2_service.sync.project
  location = google_cloud_run_v2_service.sync.location
  name     = google_cloud_run_v2_service.sync.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.renew_watch_job.email}"
}

resource "google_service_account_iam_member" "pubsub_token_creator" {
  service_account_id = google_service_account.pubsub_push.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "gmail_push" {
  name  = "gmail-newsletter-events-push"
  topic = google_pubsub_topic.gmail.id

  ack_deadline_seconds = 20

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.sync.uri}/pubsub/gmail"

    oidc_token {
      service_account_email = google_service_account.pubsub_push.email
      audience              = google_cloud_run_v2_service.sync.uri
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_service_account_iam_member.pubsub_token_creator,
  ]
}

resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_job" "renew_watch" {
  name     = "newsletter-sync-renew-watch"
  location = var.region

  template {
    template {
      service_account = google_service_account.renew_watch_job.email
      timeout         = "300s"
      max_retries     = 1

      containers {
        image   = var.image
        command = ["node"]
        args    = ["dist/renew-watch.js"]

        env {
          name  = "TASK_SERVICE_URL"
          value = "${google_cloud_run_v2_service.sync.uri}/tasks"
        }
        env {
          name = "REPLAY_SHARED_SECRET"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.runtime["replay_shared_secret"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.renew_watch_accessor,
  ]
}

resource "google_cloud_run_v2_job_iam_member" "scheduler_invoker" {
  project  = google_cloud_run_v2_job.renew_watch.project
  location = google_cloud_run_v2_job.renew_watch.location
  name     = google_cloud_run_v2_job.renew_watch.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}

resource "google_service_account_iam_member" "scheduler_token_creator" {
  service_account_id = google_service_account.scheduler.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloudscheduler.iam.gserviceaccount.com"
}

resource "google_cloud_scheduler_job" "renew_watch" {
  name        = "newsletter-sync-renew-watch"
  description = "Starts the Cloud Run Job that renews the Gmail INBOX watch."
  schedule    = var.renew_watch_schedule
  time_zone   = var.scheduler_time_zone
  region      = var.region

  http_target {
    http_method = "POST"
    uri         = "https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${var.project_id}/jobs/${google_cloud_run_v2_job.renew_watch.name}:run"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  depends_on = [
    google_cloud_run_v2_job_iam_member.scheduler_invoker,
    google_service_account_iam_member.scheduler_token_creator,
  ]
}
