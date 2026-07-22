output "service_url" {
  description = "Authenticated Cloud Run URL used by the Pub/Sub push subscription."
  value       = google_cloud_run_v2_service.sync.uri
}

output "gmail_pubsub_topic" {
  description = "Gmail watch topic name to use when activating the mailbox watch."
  value       = google_pubsub_topic.gmail.id
}

output "renew_watch_job" {
  description = "Cloud Run Job name that renews the Gmail INBOX watch."
  value       = google_cloud_run_v2_job.renew_watch.name
}
