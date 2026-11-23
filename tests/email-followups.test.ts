import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (file: string) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("follow-up backend requires explicit authenticated send of approved drafts", async () => {
  const route = await read("src/pages/api/admin/emails/followups.ts");
  assert.match(route, /requireAdminRequest\(context\)/);
  assert.match(route, /action === "send"/);
  assert.match(route, /WHERE id = \$1 AND status = 'approved'/);
  assert.match(route, /sendEmail\(env/);
  assert.match(route, /idempotencyKey: `followup\/\$\{id\}`/);
  assert.match(route, /status = 'uncertain'/);
  assert.match(route, /status = 'sending'[\s\S]*INTERVAL '15 minutes'/);
  assert.doesNotMatch(route, /setInterval\(|scheduled_at|cron:/);
});

test("follow-ups use real wire Message-ID and respect inbound responses", async () => {
  const helper = await read("src/lib/server/email-followups.ts");
  const webhook = await read("src/pages/api/webhooks/resend/inbound.ts");
  const route = await read("src/pages/api/admin/emails/followups.ts");
  assert.match(helper, /INTERVAL '7 days'/);
  assert.match(helper, /NOT EXISTS \(\s*SELECT 1 FROM inbound_emails i/);
  assert.match(helper, /resend\.emails\.get|emails\.get\(source\.resend_id\)/);
  assert.match(route, /"In-Reply-To": originalMessageId, "References": originalMessageId/);
  assert.match(webhook, /readInboundThreadHeaders\(received\.headers\)/);
  assert.match(webhook, /blockAnsweredFollowups/);
  assert.match(webhook, /headers, received\.created_at/);
  assert.match(helper, /s\.created_at <= \$2::timestamptz/);
});

test("bulk review page separates drafts, approval, and final send authorization", async () => {
  const page = await read("src/pages/admin/emails/followups.astro");
  assert.match(page, /Create selected drafts/);
  assert.match(page, /Approve selected/);
  assert.match(page, /Send selected approved/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /unsaved edits/);
  assert.match(page, /draft-subject/);
  assert.match(page, /draft-body/);
});

test("email schemas have persistent draft and threaded reply metadata", async () => {
  const schema = await read("src/lib/server/schema.sql");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS email_followup_drafts/);
  assert.match(schema, /CREATE UNIQUE INDEX IF NOT EXISTS idx_followup_active_source/);
  assert.match(schema, /in_reply_to_message_id/);
  assert.match(schema, /references_header/);
  assert.match(schema, /message_id TEXT/);
});

test("unanswered follow-up queue paginates the full eligible set and preserves batch selections", async () => {
  const helper = await read("src/lib/server/email-followups.ts");
  const api = await read("src/pages/api/admin/emails/followups.ts");
  const page = await read("src/pages/admin/emails/followups.astro");
  assert.match(helper, /COUNT\(\*\) AS total/);
  assert.match(helper, /OFFSET \$1/);
  assert.match(helper, /FOLLOWUP_PAGE_SIZE = 100/);
  assert.match(api, /countFollowupCandidates\(sql\)/);
  assert.match(api, /totalPages:/);
  assert.match(page, /id="candidate-next"/);
  assert.match(page, /id="candidate-prev"/);
  assert.match(page, /selectedCandidates = new Set<string>\(\)/);
  assert.match(page, /selectedCandidates\.add\(el\.value\)/);
  assert.match(page, /selectedCandidates\.delete\(result\.id\)/);
});

test("blog admin uses true server-side pagination instead of hiding older posts", async () => {
  const editor = await read("src/components/admin/ContentEditor.astro");
  const repo = await read("src/lib/server/repository.ts");
  assert.match(editor, /type === 'blog' \? PAGE_SIZE : 500/);
  assert.match(editor, /if \(type === 'blog' && searchQuery\) params\.set\('search', searchQuery\)/);
  assert.match(editor, /type === "blog" \? allItems : allItems\.slice/);
  assert.match(repo, /type === "blog"\) query \+= " WHERE deleted_at IS NULL"/);
});

test("blog posts are soft deleted with recovery instead of immediate purge", async () => {
  const repo = await read("src/lib/server/repository.ts");
  const api = await read("src/lib/server/api.ts");
  const restore = await read("src/pages/api/admin/blog-trash.ts");
  assert.match(repo, /UPDATE blog_posts SET deleted_at = NOW\(\)/);
  assert.match(repo, /if \(type === "blog"\) query \+= " WHERE deleted_at IS NULL"/);
  assert.match(repo, /type === "blog" \? "AND deleted_at IS NULL"/);
  assert.match(api, /if \(type !== "blog"\) await deleteMediaKeys/);
  assert.match(restore, /SET deleted_at = NULL/);
});
