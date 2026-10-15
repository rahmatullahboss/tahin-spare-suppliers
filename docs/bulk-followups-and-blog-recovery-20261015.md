# Tahin Spare: Bulk Follow-up & Blog Post Recovery (2026-10-15)

## Implemented

- Existing `/admin/emails/send` continues private per-recipient bulk delivery (up to 100 addresses per request, or the attachment batch cap).
- New `/admin/emails/followups` lists unanswered, eligible one-recipient conversations once the latest outbound email is at least 7 days old.
- Server-side reply detection matches an inbound sender to the recipient and the normalized conversation subject, or to an exact RFC Message-ID reference when available. Signed Resend receiving webhook stores `In-Reply-To` and `References` and suppresses matching pending drafts.
- A candidate with a newer outbound email, or a prior answer in the same conversation, is not eligible. Bounced/failed/suppressed/complained outbound mail is excluded.
- `Create selected drafts` creates a separate, editable, persisted draft per client, using a shared polite follow-up template. Batch maximum: 50 drafts. Unique partial index prevents a second active draft for the same source.
- All draft messages and subjects can be reviewed on a single screen; `Save edits` stores them, `Approve selected` explicitly marks them approved, and `Send selected approved` requires a second, separate authorization dialog. Batch sends are limited to 15 per click, executed individually per recipient.
- **No timers, scheduled jobs, implicit post-approval sends, or automatic follow-up sends.** The only send code path is the authenticated explicit `POST /api/admin/emails/followups` with `action=send`; it atomically claims only `approved` drafts.
- Each follow-up resolves a valid, *actual* Resend RFC `Message-ID` of the source sent email (webhook persisted or API backfill). Uses `In-Reply-To` and `References` headers plus unchanged normalized subject. Without a valid source message ID, no send occurs.
- A successful provider acceptance generates a row in `sent_emails` with `in_reply_to_sent_id` and `followup_draft_id`. Provider idempotency key uses `followup/<draft-id>` to prevent duplicate delivery. An ambiguous failure is left in `uncertain` for manual reconciliation: **no unattended retry**. Interrupted `sending` states older than 15 minutes are also moved to `uncertain` for manual review when the admin list loads.
- The existing signed Resend inbound handler still forwards received messages to the configured address. Reply suppression is independent of forwarding.
- New persistent columns and draft table are in `src/lib/server/schema.sql`; `ensureSchema` auto-applies revisions on the first request in an environment with authorized database credentials.

## Workflow

1. Go to **Admin → Emails → Follow-ups (7 days)**.
2. Refresh replies; select clients in the due list and create drafts.
3. Read/edit each plain-text message and subject. Saving an edited approved draft removes its approval, preventing accidentally sending stale content.
4. Select drafts and approve. Subject must retain the original conversation subject (except `Re:` prefix).
5. Select only approved, unchanged drafts; press **Send selected approved** and explicitly confirm.
6. Check the sent thread and provider delivery webhook. The system considers provider acceptance as *sent*, not guaranteed inbox delivery.
7. For **uncertain** rows, inspect the Resend provider record and database history before any manual reconciliation. Do not retry with a new idempotency key.

## Blog post disappearance and recoverability

The existing admin blog editor loaded only the newest 500 records, and its pagination then operated on that partial local dataset. Older, still-persisted posts could therefore appear missing. Blog now uses **server-side pagination and search** so older content can be reached without a hard 500-record ceiling. Products retain their existing listing behavior.

The prior `DELETE /api/blog/:id` immediately deleted the blog post DB row and its R2 images. The new behavior is:
- `blog_posts.deleted_at` performs a **soft delete** (Trash) and excludes trashed posts from public and normal admin blog listing.
- R2 images are **not deleted** on soft delete.
- Admin **Blog → View Trash & restore removed posts** lists stored trashed posts and restores selected entries with their original slug and media metadata. Restore queues an IndexNow notification.
- Ordinary post edits and titles keep existing behavior; manually editing a slug can change a public link and should be reviewed as a separate permalink-migration concern.
- **Previously hard-deleted content is not automatically recovered**. Recover it only from a verified Neon snapshot/backup or retained content copy; never fabricate records.

## Verification / outstanding production acceptance

- Astro/Cloudflare build passed locally on 2026-10-15.
- New focused follow-up and blog recovery contract tests: 6/6 passed.
- Full test suite at latest run: 178 passed, 1 unrelated failure because local `@modelcontextprotocol/sdk` dependency was unavailable for a Search Console MCP test.
- No production deployment, production Neon migrations, external email dispatch, or live recipient verification was performed by this implementation.
- Before production launch, deploy the new build in an authorized change window and confirm schema migration, a signed inbound reply, old Resend `message_id` lookup, due queue, bulk draft editing, approval-only behavior, an explicitly approved controlled send, SMTP inbox thread grouping (Gmail/Outlook), and Trash/Restore with a test post.
- Pay attention to concurrent incoming replies during an in-flight Resend send; provider acceptance and receiving are two independent systems. The server rechecks reply eligibility immediately before sending but cannot roll back an already accepted message.
- Legacy threads without a retrievable original RFC Message-ID are intentionally blocked to preserve truthful threading.
- The due page currently displays the newest 200 eligible conversations per request. Larger-scale pagination can be added when the client list exceeds this limit.
