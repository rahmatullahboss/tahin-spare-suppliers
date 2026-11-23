# Tahin Spare email follow-up — verification and release gate (2026-10-19)

## Scope and source state

Reviewed `src/pages/admin/emails/followups.astro`, `src/pages/api/admin/emails/followups.ts`,
`src/lib/server/email-followups.ts`, email sender/webhook/schema, documented workflow, and tests.
The working copy is on `master` with **pre-existing dirty/untracked changes**, including the follow-up
implementation. Preserve those files and unrelated blog changes; do not assume that source on
`origin/master` is identical to the deployed Worker.

## Verified evidence

- Read-only check against Neon project **tahin** on 2026-10-19:
  - 318 outbound rows; 313 outbound rows at least 7 days old with nonempty provider ID;
    53 source Message-IDs stored.
  - 182 inbound rows; 0 with saved `in_reply_to_message_id` or `references_header`.
    Zero thread headers alone does **not** prove that inbound reply ingestion is broken:
    many rows predate the new header columns.
  - 53 follow-up rows: 53 drafts, 0 approved, 0 sent, 0 uncertain.
    This does not prove someone clicked Approve; no click/audit records establish that.
  - 216 due candidates returned by the current eligibility SQL on a read-only query.
  - 37 inbound rows have a matching sender/normalized subject after an outgoing email.
  - Production read-only SQL confirmed that extra whitespace in a subject produced different keys under the old SQL normalization, even though JavaScript normalized it; the shared SQL helper now collapses whitespace.
- Connected Resend app shows only an unrelated verified domain, not `tahinspare.com`.
  No live Tahin Spare provider or SMTP test was attempted from that account.
- Prior tests used source-pattern assertions rather than running the API. Added 9
  focused functional/contract tests with isolated database/provider test doubles, covering:
  create → edit → approve → unchanged save → explicit send → blocked replay;
  edit revokes approval; replied client blocks send; ambiguous send is quarantined;
  multi-client 15-send boundary; concurrent duplicate sends; selection/unsaved safety;
  normalized subject parity; unauthorized clients blocked. All 9 passed.
- Entire local suite **189/189 PASS**; `npm run build` **PASS**.
  Neither is a claim of live inbox delivery.

## Corrections applied in the working tree

1. `PATCH action=save` now retains an existing approval when subject/body are unchanged,
   while actual edits atomically return the row to draft and clear approval.
2. Bulk save/approve requests process in bounded groups of four, show progress, and
   collect per-recipient failures instead of taking a single long sequential path.
3. Added `Select approved (up to 15)` and prevented Select all from including
   locked/uncertain draft rows. Draft selections now persist across successful
   save/approve reloads; unsaved content cannot be silently discarded on failed
   edits, refresh, or send.
4. Draft creation now uses bounded groups of four instead of up to 50 serial
   database/provider requests, with per-client success/failure outcomes.
5. A shared `normalizedEmailSubjectSql` helper is used in eligibility and thread
   viewer queries to match JavaScript subject normalization.
6. Added real handler-level regression tests in
   `tests/email-followups-functional.test.ts`.

## Outstanding release-blocking end-to-end acceptance

**NOT VERIFIED** — Do not report production-ready or deploy just on this evidence.

1. Verify the correct Tahin Spare Resend account/domain, active API permissions,
   incoming receiving route and signed webhook event configuration.
2. Use approved, owned test inboxes only (never the 53 existing client drafts or 216
   real due candidates) to perform a controlled full browser-and-API workflow.
3. Confirm separate persisted client drafts; editing and approval; explicit send only;
   selection batches of 15 and provider acceptance.
4. Inspect the real `Message-ID`, `In-Reply-To`, `References`, Gmail/Outlook grouping,
   deliverability webhook, and sent/history persistence for test messages.
5. Send a controlled inbound reply and verify it suppresses the matching follow-up
   while leaving unrelated conversations available.
6. Test inbound attachments/forwarding, webhook retry and uncertain-provider
   reconciliation; verify the true Resend status rather than auto-retrying.
7. Regression-check the related blog Trash/Restore workflow with synthetic content.
8. Arrange clean integration of the existing dirty branch files with the owner before
   commit/merge or deployment.

**Safety**: Never approve or send existing customer drafts as part of E2E testing.
Provider acceptance is not proof of mailbox delivery.
