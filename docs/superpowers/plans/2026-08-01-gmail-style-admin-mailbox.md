# Gmail-Style Admin Mailbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tahin Spare's admin mailbox a modern conversation-first email client, preserve outbound inline images/files for later viewing, and eliminate reveal-animation blank pages.

**Architecture:** Keep Astro + Neon + Resend. Persist sent attachment metadata in Neon and bytes in the existing private R2 `MEDIA_BUCKET`, serve sent files through authenticated admin routes, and generalize CID rendering so inbound and sent content share one safe thread renderer. Treat reveal animations as progressive enhancement so content is visible without JavaScript.

**Tech Stack:** Astro 6, TypeScript, Neon Postgres, Cloudflare R2/Workers, Resend 6.12.2, node:test, xss.

---

## File map

- `src/lib/server/sent-email-attachments.ts` — pure manifest parsing plus R2 staging/cleanup for outbound files.
- `src/lib/server/email-content.ts` — safe attachment descriptor parsing and inbound/sent CID URL resolution.
- `src/lib/server/schema.sql` — `sent_emails.attachments_json` schema extension.
- `src/pages/api/admin/emails/index.ts` — persist outbound attachment history and return richer sent-list rows.
- `src/pages/api/admin/emails/sent/[id]/attachments/[attachmentId].ts` — authenticated R2 preview/download endpoint.
- `src/pages/api/admin/emails/inbound/index.ts` — return attachment metadata needed by modern list rows.
- `src/pages/admin/emails/thread/[source]/[id].astro` — unified sent/received message renderer.
- `src/pages/admin/emails.astro` — modern mailbox list UI.
- `src/pages/admin/emails/send.astro` — modern composer UI and thread redirect after send.
- `src/styles/global.css`, `src/layouts/MainLayout.astro` — progressive-enhancement reveal behavior.
- `tests/email-sent-attachments.test.ts`, `tests/email-content.test.ts` — regression tests.
- `docs/email-system.md` — operational documentation.

### Task 1: Sent attachment manifest and R2 storage

**Files:**
- Create: `tests/email-sent-attachments.test.ts`
- Create: `src/lib/server/sent-email-attachments.ts`

- [ ] **Step 1: Write failing manifest tests**

Tests must assert that inline images keep their content IDs, normal files use attachment disposition, storage keys are private/deterministic under `email/sent/<email-id>/`, malformed JSON is ignored, and unsafe storage keys are rejected by the parser.

Core expected type:

```ts
export type StoredSentAttachment = {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition: "inline" | "attachment";
  contentId: string;
  storageKey: string;
};
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/email-sent-attachments.test.ts`
Expected: FAIL because `sent-email-attachments.ts` does not exist.

- [ ] **Step 3: Implement pure manifest helpers and R2 staging**

Implement:

```ts
export function buildStoredSentAttachmentManifest(
  emailId: string,
  inlineImages: InlineEmailImageInput[],
  fileAttachments: EmailFileAttachmentInput[]
): StoredSentAttachment[];

export function parseStoredSentAttachments(value: unknown): StoredSentAttachment[];

export async function storeSentEmailAttachments(
  bucket: R2Bucket,
  emailId: string,
  inlineImages: InlineEmailImageInput[],
  fileAttachments: EmailFileAttachmentInput[]
): Promise<StoredSentAttachment[]>;

export async function deleteStoredSentEmailAttachments(
  bucket: R2Bucket,
  attachments: StoredSentAttachment[]
): Promise<void>;
```

Use attachment IDs, never filenames, in object keys. Decode validated Base64 with `atob` into a `Uint8Array`. Put R2 objects with `httpMetadata.contentType` and custom metadata for disposition/content-id. On partial storage failure, delete already-written objects before rethrowing.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- tests/email-sent-attachments.test.ts`
Expected: PASS.

### Task 2: Persist sent attachment history safely

**Files:**
- Modify: `src/lib/server/schema.sql`
- Modify: `src/lib/server/email-service.ts`
- Modify: `src/pages/api/admin/emails/index.ts`
- Test: `tests/email-sent-attachments.test.ts`

- [ ] **Step 1: Add failing tests for file IDs and manifest serialization**

Extend `EmailFileAttachmentInput` to include an optional `id` so the browser-generated attachment identity survives API validation. Assert stored manifest JSON round-trips with the same file ID, MIME type, filename, disposition and content ID.

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/email-sent-attachments.test.ts tests/email-inline-images.test.ts`
Expected: FAIL until API/service types and manifest flow support normal attachment IDs.

- [ ] **Step 3: Extend schema**

Add:

```sql
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS attachments_json TEXT NOT NULL DEFAULT '[]';
```

- [ ] **Step 4: Persist attachments in POST `/api/admin/emails`**

After Resend accepts the message:

1. Check whether `resend_id` already exists; if so return its existing local id for idempotent retries.
2. Stage outbound files in R2 using the provider result's local id.
3. Insert `attachments_json` together with body/resend/reply linkage.
4. If DB persistence fails after staging, best-effort delete those staged R2 objects and rethrow.

The normal file mapper must preserve `id`:

```ts
id: typeof file.id === "string" ? file.id : `email-file-${crypto.randomUUID()}`
```

Sent-list GET should include `body` and `attachments_json` for text preview/attachment indicators.

- [ ] **Step 5: Confirm GREEN**

Run: `npm test -- tests/email-sent-attachments.test.ts tests/email-inline-images.test.ts`
Expected: PASS.

### Task 3: Unified safe CID rendering and sent attachment route

**Files:**
- Modify: `tests/email-content.test.ts`
- Modify: `src/lib/server/email-content.ts`
- Create: `src/pages/api/admin/emails/sent/[id]/attachments/[attachmentId].ts`
- Modify: `src/pages/admin/emails/thread/[source]/[id].astro`

- [ ] **Step 1: Write failing sent-CID tests**

Add tests proving:

```ts
sanitizeEmailHtml(
  '<img src="cid:outbound-photo">',
  [{ id: "photo-1", filename: "pump.jpg", contentType: "image/jpeg", contentDisposition: "inline", contentId: "outbound-photo" }],
  "sent-1",
  "sent"
)
```

produces `/api/admin/emails/sent/sent-1/attachments/photo-1`, while inbound still produces the existing inbound route. Also test unsupported image MIME types do not resolve as inline previews.

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/email-content.test.ts`
Expected: FAIL because sent source routing is unsupported.

- [ ] **Step 3: Generalize email-content attachment type and sanitizer**

Keep backward-compatible inbound parsing, add a sent parser, and change sanitizer signature to:

```ts
export function sanitizeEmailHtml(
  html: string,
  attachments: EmailAttachmentDescriptor[],
  emailId: string,
  source: "inbound" | "sent" = "inbound"
): string;
```

Resolve CID URLs to the authenticated route matching `source`.

- [ ] **Step 4: Add authenticated sent attachment endpoint**

The route must:

1. call `requireAdminRequest`
2. query `sent_emails.attachments_json` by local email id
3. parse with `parseStoredSentAttachments`
4. find exactly the requested attachment id
5. fetch only the manifest's validated `email/sent/<email-id>/...` R2 key
6. return 404 when metadata/object is missing
7. use safe `Content-Type`
8. use `inline` only for safe image previews unless `?download=1`, otherwise `attachment`
9. emit `Cache-Control: private, no-store`

- [ ] **Step 5: Update thread data mapping**

Select `attachments_json` for sent rows, parse it, sanitize sent body with source `sent`, and generate attachment URLs based on each message's source. Historical rows with `[]` must render normally.

- [ ] **Step 6: Confirm GREEN**

Run: `npm test -- tests/email-content.test.ts tests/email-sent-attachments.test.ts tests/email-inline-images.test.ts`
Expected: PASS.

### Task 4: Remove blank-page reveal dependency

**Files:**
- Create/Modify: `tests/ui-reveal-source.test.ts`
- Modify: `src/styles/global.css`
- Modify: `src/layouts/MainLayout.astro`

- [ ] **Step 1: Write a source regression test**

Read the two source files and assert:

- reveal elements are not globally hidden without a JS-ready ancestor selector
- the layout adds the JS-ready class before observing
- the layout guards `IntersectionObserver`
- reduced-motion CSS forces visible/non-transformed state
- no correctness timeout such as `setTimeout(...visible...)` remains

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/ui-reveal-source.test.ts`
Expected: FAIL against current global hidden CSS/current timeout fallback.

- [ ] **Step 3: Implement progressive enhancement**

Use a document class such as `.reveal-ready` so default CSS is visible and only JS-ready pages initialize reveal states. If `IntersectionObserver` is unavailable, remove/avoid the class. Add `prefers-reduced-motion: reduce` final-state rules.

Preserve unrelated uncommitted changes already present in `MainLayout.astro`.

- [ ] **Step 4: Confirm GREEN**

Run: `npm test -- tests/ui-reveal-source.test.ts`
Expected: PASS.

### Task 5: Redesign mailbox list

**Files:**
- Modify: `src/pages/api/admin/emails/inbound/index.ts`
- Modify: `src/pages/admin/emails.astro`

- [ ] **Step 1: Enrich inbox API**

Return `attachments_json` with inbound rows. Keep existing filtering/search/pagination semantics.

- [ ] **Step 2: Replace CRUD table with semantic mail list**

Build a compact mailbox shell with:

- Inbox/Sent folder tabs with `aria-selected`
- search input with visible/accessible label
- All/Unread/Read chips only for Inbox
- reload button
- message rows implemented as focusable links
- unread rows using font weight + dot/label, not color alone
- sender/recipient, subject, body preview, attachment indicator, timestamp, delivery status
- loading skeleton/list state
- empty search state
- failure state with Retry button

No raw email HTML is inserted; preview text is derived through DOM text content before display.

- [ ] **Step 3: Responsive behavior**

At mobile widths, keep sender + timestamp on line one, subject on line two, preview/meta on line three, with no horizontal scrolling.

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Astro production build succeeds.

### Task 6: Redesign thread and composer

**Files:**
- Modify: `src/pages/admin/emails/thread/[source]/[id].astro`
- Modify: `src/pages/admin/emails/send.astro`

- [ ] **Step 1: Thread UI**

Use a restrained Gmail-like reading hierarchy:

- sticky/compact back + Reply actions where practical
- subject + customer + message count
- initial avatar
- sender/recipient/timestamp header
- expandable `From/To` details
- body with safe image sizing
- attachment tiles/rows with image thumbnails
- subtle sent/received accent without heavy colored left borders

- [ ] **Step 2: Composer UI**

Reshape existing behavior without changing limits:

- compact To/Subject rows
- editor and toolbar as one surface
- icon/text controls with clear hover/focus states
- attachment chips/rows
- polished sending/success/error feedback
- mobile-safe action bar

- [ ] **Step 3: Remove stale inline payloads before submit**

Before POST, collect live `img[data-email-image-id]` IDs from the cloned editor and send only matching entries from `inlineImages`.

- [ ] **Step 4: Redirect to sent thread after success**

Use returned `data.id`:

```ts
window.location.href = `/admin/emails/thread/sent/${encodeURIComponent(data.id)}`;
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: PASS.

### Task 7: Documentation, design detector and full verification

**Files:**
- Modify: `docs/email-system.md`

- [ ] **Step 1: Document sent attachment storage**

Document private R2 prefix, authenticated attachment access, `attachments_json`, idempotent resend behavior, and that R2 history is application-owned rather than dependent on a sent-attachment retrieval API.

- [ ] **Step 2: Run Impeccable detector once on final changed UI targets**

Run:

```bash
node /Users/rahmatullahzisan/.agents/skills/impeccable/scripts/detect.mjs --json src/pages/admin/emails.astro src/pages/admin/emails/send.astro 'src/pages/admin/emails/thread/[source]/[id].astro' src/layouts/MainLayout.astro src/styles/global.css
```

Address actionable findings without unrelated redesign.

- [ ] **Step 3: Run focused email/UI tests**

Run: `npm test -- tests/email-content.test.ts tests/email-inline-images.test.ts tests/email-sent-attachments.test.ts tests/ui-reveal-source.test.ts`
Expected: all pass.

- [ ] **Step 4: Run full tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run production build**

Run: `npm run build`
Expected: PASS with no compilation errors.

- [ ] **Step 6: Review final diff**

Verify no unrelated existing modifications were reverted, no secrets/object keys are exposed, and the implementation matches the design spec acceptance criteria.
