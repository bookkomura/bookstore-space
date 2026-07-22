variable "project_id" {
  description = "Google Cloud project that hosts newsletter-sync resources."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Cloud Scheduler."
  type        = string
  default     = "asia-east1"
}

variable "image" {
  description = "Immutable container image reference for newsletter-sync."
  type        = string
}

variable "gmail_user_email" {
  description = "Mailbox watched by Gmail; this is not a secret."
  type        = string
}

variable "storyblok_space_id" {
  description = "Storyblok space ID used by the runtime; this is not a secret."
  type        = string
}

variable "renew_watch_schedule" {
  description = "Cron schedule for Gmail watch renewal. Gmail watches expire, so renew before expiry."
  type        = string
  default     = "0 3 * * *"
}

variable "scheduler_time_zone" {
  description = "IANA time zone used by the renewal schedule."
  type        = string
  default     = "Etc/UTC"
}
