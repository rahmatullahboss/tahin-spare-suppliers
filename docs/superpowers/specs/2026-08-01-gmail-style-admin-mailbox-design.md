# Gmail-Style Admin Mailbox Redesign

Date: 2026-08-01
Status: Approved direction — Option 2
Scope: Tahin Spare Suppliers admin email UI, thread model, sent/received media parity, and public-page blank-state reliability

## 1. Goal

Make the Tahin Spare admin email experience behave like a modern conversation-first mailbox while preserving the existing Tahin Spare visual identity and current Resend + Neon + Cloudflare architecture.

The redesign must solve two concrete defects:

1. Public pages can appear blank because reveal-animation CSS hides content until JavaScript adds `.visible`.
2. Inbound inline images and attachments can be displayed in admin threads, but outbound images/files are not persisted in a form the thread renderer can resolve, so sent content is incomplete after sending.

The target is not a literal Gmail clone. The interaction model should borrow Gmail's proven conversation, scanability, reply, attachment, and responsive patterns while remaining visually consistent with Tahin Spare.

## 2. Non-goals

This phase will not add archive, spam, labels, stars, snooze, mailbox rules, multi-account support, drafts synchronization, or a full IMAP client.

It will not replace Resend, Neon Postgres, Astro, or the existing admin authentication model.

It will not rewrite unrelated admin screens or overwrite unrelated uncommitted changes currently present in the repository.

## 3. Public blank-page reliability

### Root cause

`src/styles/global.css` defines `.reveal`, `.reveal-stagger`, `.reveal-left`, `.reveal-right`, and `.reveal-scale` as hidden by default. `src/layouts/MainLayout.astro` relies on `IntersectionObserver` to add `.visible`.

If the observer does not initialize, throws, is delayed, or does not report intersection as expected, meaningful content remains at `opacity: 0` and the user sees a page shell with blank content.

### Design

Reveal animation must become progressive enhancement instead of a rendering dependency.

- Content is visible by default.
- A small JS-enabled marker is applied early when reveal behavior is available.
- Only under that marker may reveal-enabled elements start hidden.
- If `IntersectionObserver` is unavailable, content remains visible.
- `prefers-reduced-motion: reduce` disables reveal transitions and forces final visible state.
- No arbitrary timeout is required for correctness.

This removes the blank-page failure mode rather than masking it with a delayed fallback.

## 4. Mailbox information architecture

The primary admin email route remains `/admin/emails`.

### Desktop layout

Use an operate-mode mailbox layout with three functional zones:

1. Top mailbox header
   - title and unread summary
   - primary Compose action
   - search field
   - refresh action if practical without introducing new backend state

2. Folder/navigation strip
   - Inbox
   - Sent
   - unread count badge for Inbox

3. Message list
   - compact rows optimized for scanning
   - sender/recipient
   - normalized subject
   - one-line body preview where available
   - attachment indicator when applicable
   - unread emphasis
   - delivery status for sent mail without making status the visual focus
   - context-aware date formatting

The current heavy table treatment will be replaced with a denser mail-list treatment that behaves more like an inbox than a CRUD data table.

### Mobile layout

- No horizontal table dependency.
- Each message becomes a touch-friendly list row/card.
- Sender/recipient and subject remain the strongest text.
- Metadata collapses into a secondary line.
- Compose remains easy to reach.
- Search uses full width.

## 5. Conversation/thread experience

The existing route `/admin/emails/thread/[source]/[id]` remains the canonical conversation view.

### Thread header

Show:

- back navigation
- subject
- customer/contact address
- total message count
- Reply action

### Message presentation

Messages remain chronological, oldest to newest, with the latest message nearest the reply action.

Each message card shows:

- avatar/initial indicator
- sender name/address
- recipient summary
- timestamp
- sent vs received distinction using subtle alignment/accent rather than large red/gold borders
- expandable detailed headers where practical
- sanitized HTML body
- inline images in the correct body location
- attachment section with thumbnails for safe images and file rows for other files

The user's own outbound messages and customer inbound messages must have feature parity for visible content.

### Reply flow

Reply continues to use the existing send route initially, but the visual treatment should feel connected to the thread:

- prefilled recipient
- normalized `Re:` subject
- reply linkage to the latest inbound message
- after successful send, redirect directly to the newly updated thread when the API returns the sent record id

A future inline composer can be added later without changing the data model designed here.

## 6. Outbound attachment persistence

### Current defect

`sent_emails` persists outbound HTML body but does not persist the attachment descriptors required to render sent attachments later.

The thread renderer currently creates outbound messages with an empty attachment array. Because the sent HTML contains `cid:` URLs for inline images, sanitization cannot resolve those content IDs and sent images disappear from the admin conversation.

### Required model

Persist a safe outbound attachment manifest for every sent email.

Add a `sent_emails.attachments_json` column with a default empty JSON array.

Each persisted descriptor should contain only the metadata and storage/provider identifiers required for later rendering, for example:

- local attachment id
- filename
- content type
- disposition (`inline` or `attachment`)
- content id for inline media
- provider attachment id or retrievable provider reference when available

Raw attachment bytes must not be duplicated into the database unless no provider-backed retrieval path exists and a separate durable object-storage design is explicitly introduced.

### Retrieval strategy

Use the application's existing private R2 media bucket for outbound attachment history.

Current Resend documentation exposes sent-email list/retrieve APIs for message metadata/content and supports sent-attachment download in the Resend dashboard, while the documented attachment list/retrieve API is specifically for received email. The application must therefore not depend on an undocumented sent-attachment retrieval API.

- generate the local sent-email id before provider submission
- store outbound inline images and files under a private `email/sent/<email-id>/...` R2 prefix
- persist only safe metadata + the private R2 object key in `sent_emails.attachments_json`
- expose an authenticated admin attachment endpoint for sent messages
- map persisted content IDs to that authenticated endpoint during sanitization/rendering
- if provider submission fails, best-effort delete any objects staged for that email
- if database persistence fails after provider acceptance, keep the deterministic provider/idempotency reference so a retry does not resend a duplicate message

R2 object keys must never be exposed directly to unauthenticated clients.

## 7. Unified attachment abstraction

Introduce a thread-safe attachment shape usable by both inbound and sent messages instead of hard-coding inbound-only logic.

Conceptually:

- `id`
- `filename`
- `contentType`
- `contentDisposition`
- `contentId`
- `source`
- authenticated download URL
- authenticated preview URL when safe

`sanitizeEmailHtml` or a new generalized sanitizer helper should accept a resolver capable of converting safe `cid:` references for either message direction.

Inbound behavior must not regress.

## 8. Thread grouping

Current grouping uses customer address + normalized subject and supplements sent replies with `in_reply_to_inbound_id`.

For this phase:

- preserve the current subject/address fallback for historical rows
- prefer explicit reply linkage where it exists
- do not require migration of all historical data to a new thread-id table
- ensure a sent reply remains visible in the same conversation even when opened from Sent

A dedicated conversation/thread table can be considered later if cross-subject threading or larger-scale mailbox behavior is needed.

## 9. Compose redesign

The compose page remains a focused mail composer rather than a generic admin form.

### Visual changes

- wider, cleaner message canvas
- compact To and Subject rows
- toolbar integrated with editor frame
- obvious image and attachment actions
- attachment chips/rows with filename and size
- primary Send action aligned like a mail client
- clearer sending/success/failure feedback

### Interaction requirements

- preserve current inline-image limits and validation
- preserve file-attachment limits and total-size validation
- maintain selection when inserting inline images
- remove stale inline-image payload entries if an image is deleted from the editor before send
- after send, use API response to navigate to the conversation rather than the mailbox list when possible

## 10. Visual direction

Mode: Operate.

Design characteristics:

- high scanability
- restrained surfaces
- minimal shadows
- neutral slate/white base from the existing admin UI
- Tahin Spare amber/gold as the primary action accent
- red reserved for destructive/error semantics, not normal inbound messages
- 14–16px primary reading text
- strong but compact subject hierarchy
- consistent 8px-based spacing rhythm
- visible keyboard focus states
- touch targets at least 40–44px where applicable

Avoid decorative gradients, oversized cards, excessive borders, and dashboard-style status badges that make the mailbox feel like a database table.

## 11. States and error handling

Every mailbox surface must explicitly support:

- loading
- empty inbox
- empty sent folder
- no search results
- API failure with retry affordance
- attachment unavailable
- broken/expired provider attachment reference
- empty email body
- delivery pending
- delivery failed/bounced

A missing attachment must not make the entire thread fail to render.

## 12. Security and content safety

- Keep admin authentication on every message and attachment route.
- Continue HTML sanitization before rendering email HTML.
- Allow only safe inline image MIME types for direct previews.
- Never inject untrusted attachment filename/content type into HTML without escaping.
- Keep external links sanitized and use safe target/rel behavior.
- Do not expose provider credentials or raw storage keys to the browser.
- Do not render SVG or active document formats inline.

## 13. Accessibility

- Message rows are keyboard reachable and activate predictably.
- Folder controls expose selected state.
- Search has an accessible label.
- Icons must have text alternatives/tooltips where needed.
- Unread state is conveyed by more than color alone.
- Focus rings remain visible.
- Reduced-motion users do not depend on animation to reveal content.

## 14. Testing strategy

Follow test-driven development for behavior changes.

Add regression coverage for at least:

1. public reveal content remains visible when reveal JS is unavailable
2. outbound attachment manifest serialization/persistence
3. sent inline image `cid:` resolution to an authenticated URL
4. sent non-image attachment download URL generation
5. inbound inline image behavior remains unchanged
6. sent replies are included in the same subject/customer thread
7. historical sent rows with no attachment manifest still render safely
8. sanitizer rejects unsafe sent attachment sources
9. mailbox API/list preview data remains safely escaped/rendered
10. build/type checks remain clean

Run focused email tests first, then the full test suite and production build.

## 15. Files expected to change

Likely scope:

- `src/styles/global.css`
- `src/layouts/MainLayout.astro`
- `src/pages/admin/emails.astro`
- `src/pages/admin/emails/send.astro`
- `src/pages/admin/emails/thread/[source]/[id].astro`
- `src/pages/api/admin/emails/index.ts`
- sent attachment API route(s)
- `src/lib/server/email-content.ts`
- `src/lib/server/email-service.ts`
- `src/lib/server/schema.sql`
- email-focused test files
- `docs/email-system.md`

Existing unrelated modified files must not be reverted or overwritten.

## 16. Acceptance criteria

The work is complete when all of the following are true:

- Public content cannot remain invisible because reveal JavaScript failed.
- Admin Inbox and Sent views read visually like a modern mailbox, not a CRUD table.
- A thread opened from either Inbox or Sent shows both customer and admin messages in order.
- Inline images sent by the admin are visible later inside that admin thread.
- Normal files sent by the admin are visible/downloadable later inside that admin thread.
- Inbound images and attachments continue working.
- Compose is visually and interaction-wise substantially closer to a modern mail client.
- Mobile mailbox/thread/compose views are usable without horizontal scrolling.
- Authentication and sanitization remain enforced.
- Focused tests, full tests, and production build pass before completion is claimed.
