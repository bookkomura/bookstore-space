# Tracker

## Identity

- **Work key:** A-002-newsletter-text-fix.

- **Active Ask:** A-002.

- **Goal:** Fix missing formatted newsletter text, verify and review the change, then address deployment and recovery of affected existing stories.

- **Last update:** 2026-10-04 16:35:46 Asia/Taipei.

- **Evidence commit:** 2ef8faa45ace6d483cf292f7bea53d39d6dd4e6b.

## Overall state

- **State:** complete.

- **Reason:** Parser fix, application image deployment and all 24 CMS restorations are proven complete.

- **Total:** 3.

- **Completed:** 3.

- **Remaining:** 0.

## Accepted task checklist

- [x] **T-1:** Preserve formatted and inline-link text in complete newsletter paragraphs without duplicating nested block text; scope is MIME parser and meaningful regression tests, retaining existing block schema, HTTPS-only clickable links, script/style filtering, CID images, captions, and ordering; proof is red-first regressions, full newsletter-sync suite, TypeScript build, and an independent review of the exact fix commit. Source: A-002. Proof: RUN-006.

- [x] **T-2:** Deploy the verified parsing fix to the existing newsletter-sync service; scope is the existing service's application image and documented deployment process, without infrastructure or account changes; proof is correct project/service identity, immutable image/revision, and successful deployment verification. Source: A-002. Proof: RUN-007.

- [x] **T-3:** Recover missing text in affected existing Storyblok newsletters from their original Gmail messages; scope is eligible newsletters with demonstrably incomplete parser-produced content, preserving source identifiers privately and avoiding duplicate stories or needless uploads; proof is a reviewed dry run, recoverable original content, and read-back of updated content. Source: A-002. Proof: RUN-008, RUN-009.

## Accepted scope changes

- None.

## Current recovery

- **Current item:** none.

- **Last proven result:** Updated full suite passed 84 tests; all 24 recovery inputs passed image/identity checks, and amd64 image smoke/hash matched the tested parser.

- **Active blocker or running process:** none.

- **Next safe action:** none.

- **Expected changed files:** services/newsletter-sync/src/mime.ts, services/newsletter-sync/test/mime.test.ts, .agentflow/features/newsletter-diagnosis/newsletter-diagnosis.devlog.md, .agentflow/features/newsletter-diagnosis/artifacts/A-002-newsletter-text-fix/.

## Completion proof

- **All accepted tasks checked:** yes.

- **Blocking accepted decision:** none.

- **Operation running:** no.

- **Next action remaining:** none.

- **Evidence status:** complete.

- **Judgment:** complete.

## Update meaning

- Saving this tracker is a recovery checkpoint, not a stop signal.

- Work continues with the next unfinished item unless an independent stop condition applies.
