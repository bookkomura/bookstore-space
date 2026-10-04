# Bounded content recovery

Owner Ask A-002 accepts the previously described parsing fix, deployment and restoration of existing missing words. No schema or infrastructure changes are needed.

Read-only inspection found 24 published Firestore claims with their original Gmail messages and existing newsletter stories. Twenty-three stored block lists exactly match the old parser. One list is exactly the old output minus its unchanged first three-character paragraph; the recovery script preserves that deletion, verified by exact comparison rather than fuzzy matching. All 24 source identities, sender/subject filters, public slug/component, published/no-draft state, image count/order and private Message-ID exclusion passed. Current archive labels and edited subject/date metadata are preserved. The photographed issue is Storyblok story 202994893283449.

The script at recover-content.mjs creates a dry-run plan only by default. It reuses existing image assets and unchanged block objects; all outer content metadata remains unchanged. Private full original content and proposed payloads live only in /private/tmp/newsletter-recovery-private with directory mode 0700 and file mode 0600. They contain no credentials and are not exported to the reviewer or committed. Neither Gmail IDs nor original Message-IDs enter public payloads or durable diagnostics.

Apply reads the frozen proposed payloads, verifies all stories again before the first write, then rechecks each one before PUT. A draft, changed content hash or changed timestamp aborts. It never force-updates locked stories, creates duplicate stories, uploads assets or changes Firestore claims. Each PUT publishes the restored content and is read back for exact content equality and metadata identity. Progress is saved privately after each successful update so a failure is recoverable. Existing API workflow: https://www.storyblok.com/docs/api/management/stories/update-a-story .

Rollback uses the original story content from the private backup, or the Storyblok version history. Service rollback returns traffic to newsletter-sync-storyblok2. After CMS verification, invoke the existing Cloudflare deploy hook once to rebuild the archive and inspect the published site.

Rejected smaller alternative: normal replay is idempotent and will skip published claims, so it cannot restore missing text. A wholesale republish would discard the leading deletion and risk manual edits; exact baseline matching plus the narrow deletion comparison avoids that.
