# Admin Panel Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `/admin/**` surface intentionally usable on phones and tablets while preserving the current desktop admin experience and existing functionality.

**Architecture:** Keep the current Astro/vanilla-CSS structure and adapt the shared admin shell first so all routes inherit the same mobile navigation and viewport behavior. Then convert desktop-specific page layouts into responsive variants with CSS-first transformations, preserving existing DOM/data flows and introducing JavaScript only for the mobile navigation drawer. Use source-level regression tests to lock critical responsive contracts and run Impeccable’s detector after all UI edits.

**Tech Stack:** Astro 7, vanilla CSS, browser DOM APIs, Node test runner, Cloudflare adapter.

---

## File Map

**Shared shell/navigation**
- Modify `src/layouts/AdminLayout.astro` — mobile top bar, backdrop, drawer orchestration, safe-area/page frame.
- Modify `src/components/admin/AdminSidebar.astro` — drawer-compatible nav semantics, close control, mobile footer/logout affordance, desktop preservation.

**Editor/list surfaces**
- Modify `src/components/admin/ContentEditor.astro` — mobile ordering, card-like table rows, form controls, pagination, touch targets.
- Modify `src/components/TiptapEditor.astro` — toolbar/editor overflow and responsive content containment where needed.
- Modify `src/components/admin/ImageUploader.astro` — responsive image/input/actions if current styles can overflow.

**Page-specific surfaces**
- Modify `src/pages/admin/index.astro` — dashboard mobile hierarchy and actions.
- Modify `src/pages/admin/categories.astro` — category/subcategory card layout and actions.
- Modify `src/pages/admin/contact-messages.astro` — mobile sender/date/message/search/pagination behavior.
- Modify `src/pages/admin/enquiries.astro` — mobile sender/contact/meta/message/search/pagination behavior.
- Modify `src/pages/admin/emails.astro` — mailbox header/toolbar/list responsive hierarchy.
- Modify `src/pages/admin/emails/send.astro` — composer fields/editor/toolbar/attachments/footer responsiveness.
- Modify `src/pages/admin/emails/thread/[source]/[id].astro` — thread header/message/attachment/reply responsiveness.

**Regression tests**
- Create `tests/admin-responsive-source.test.ts` — source-level assertions for drawer controls, removal of mobile horizontal nav, responsive editor/list/form rules, overflow/touch target contracts.

---

### Task 1: Lock the shared mobile navigation contract with a failing source test

**Files:**
- Create: `tests/admin-responsive-source.test.ts`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Write the failing test for the shared drawer contract**

Create tests that read `AdminLayout.astro` and `AdminSidebar.astro` and assert the future structure exists:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(new URL("../src/layouts/AdminLayout.astro", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/admin/AdminSidebar.astro", import.meta.url), "utf8");

test("admin shell provides an accessible mobile drawer instead of horizontal navigation", () => {
  assert.match(layout, /data-admin-menu-toggle/);
  assert.match(layout, /aria-expanded="false"/);
  assert.match(layout, /data-admin-drawer-backdrop/);
  assert.match(sidebar, /data-admin-drawer/);
  assert.match(sidebar, /data-admin-menu-close/);
  assert.doesNotMatch(sidebar, /overflow-x:\s*auto[\s\S]*sidebar-nav/);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
```

Expected: FAIL because the drawer attributes/controls do not exist yet.

- [ ] **Step 3: Commit only after the test is intentionally RED is not required**

Do not commit a permanently failing state. Continue directly to Task 2.

---

### Task 2: Implement the shared mobile admin shell and slide-out drawer

**Files:**
- Modify: `src/layouts/AdminLayout.astro`
- Modify: `src/components/admin/AdminSidebar.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add the mobile top bar, backdrop, and accessible toggle to `AdminLayout.astro`**

The body structure should become conceptually:

```astro
<div class="admin-shell">
  <header class="admin-mobile-bar">
    <button
      type="button"
      class="admin-menu-toggle"
      data-admin-menu-toggle
      aria-controls="admin-navigation"
      aria-expanded="false"
      aria-label="Open admin navigation"
    >
      <span aria-hidden="true" class="menu-icon"></span>
    </button>
    <div class="admin-mobile-title">{title.replace(/^Admin\s*/i, "")}</div>
  </header>

  <AdminSidebar active={active} />
  <button
    type="button"
    class="admin-drawer-backdrop"
    data-admin-drawer-backdrop
    aria-label="Close admin navigation"
    tabindex="-1"
  ></button>

  <main class="admin-main">
    <slot />
  </main>
</div>
```

Add a small client script that:

```js
const toggle = document.querySelector("[data-admin-menu-toggle]");
const drawer = document.querySelector("[data-admin-drawer]");
const backdrop = document.querySelector("[data-admin-drawer-backdrop]");
const closeButton = document.querySelector("[data-admin-menu-close]");

const setOpen = (open) => {
  document.documentElement.classList.toggle("admin-drawer-open", open);
  drawer?.classList.toggle("is-open", open);
  backdrop?.classList.toggle("is-open", open);
  toggle?.setAttribute("aria-expanded", String(open));
};

toggle?.addEventListener("click", () => setOpen(true));
closeButton?.addEventListener("click", () => setOpen(false));
backdrop?.addEventListener("click", () => setOpen(false));
drawer?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setOpen(false);
});
```

Use a class-based scroll lock rather than inline body style so reduced-motion/safe-area behavior remains CSS-owned.

- [ ] **Step 2: Make `AdminSidebar.astro` a desktop sidebar and mobile drawer from the same markup**

Add:

```astro
<aside class="admin-sidebar" id="admin-navigation" data-admin-drawer>
  <div class="sidebar-brand">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
    <span>Admin Panel</span>
    <button type="button" class="sidebar-close" data-admin-menu-close aria-label="Close admin navigation">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  </div>
  <nav class="sidebar-nav" aria-label="Admin navigation">
    {navItems.map(item => (
      <a href={item.href} class:list={["sidebar-link", { active: active === item.id }]}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" set:html={getIcon(item.icon)} aria-hidden="true" />
        {item.name}
      </a>
    ))}
  </nav>
  <div class="sidebar-footer">
    <a href="/" class="sidebar-link" target="_blank" rel="noopener noreferrer">View Site</a>
    <button type="button" class="sidebar-link sidebar-logout" data-admin-shell-logout>Logout</button>
  </div>
</aside>
```

Wire `data-admin-shell-logout` to the existing logout endpoint in the layout script:

```js
logout?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/admin/login";
});
```

- [ ] **Step 3: Replace mobile horizontal nav CSS with drawer CSS**

At `<= 900px`:

```css
.admin-shell {
  grid-template-columns: 1fr;
  grid-template-rows: auto 1fr;
  min-width: 0;
}

.admin-mobile-bar {
  position: sticky;
  top: 0;
  z-index: 70;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(8px + env(safe-area-inset-top)) 14px 8px;
  background: rgba(255,255,255,.96);
  border-bottom: 1px solid #e2e8f0;
  backdrop-filter: blur(14px);
}

.admin-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: min(86vw, 320px);
  height: 100dvh;
  transform: translateX(-100%);
  transition: transform 180ms ease;
  box-shadow: 18px 0 40px rgba(15,23,42,.16);
}

.admin-sidebar.is-open { transform: translateX(0); }
.admin-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: block;
  border: 0;
  padding: 0;
  background: rgba(15, 23, 42, .42);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}
.admin-drawer-backdrop.is-open { opacity: 1; pointer-events: auto; }
html.admin-drawer-open,
html.admin-drawer-open body { overflow: hidden; }
.sidebar-nav { overflow-y: auto; overflow-x: hidden; }
.sidebar-link { min-height: 44px; }
```

At desktop widths, keep current `250px 1fr` grid and hide mobile-only controls/backdrop.

- [ ] **Step 4: Respect reduced motion**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  .admin-sidebar,
  .admin-drawer-backdrop { transition: none; }
}
```

- [ ] **Step 5: Run focused test and confirm GREEN**

Run:

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
```

Expected: PASS for drawer contract.

- [ ] **Step 6: Commit the shared shell change**

```bash
git add src/layouts/AdminLayout.astro src/components/admin/AdminSidebar.astro tests/admin-responsive-source.test.ts
git commit -m "feat: add responsive admin navigation drawer"
```

---

### Task 3: Make the dashboard intentionally mobile

**Files:**
- Modify: `src/pages/admin/index.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Extend the source test with dashboard mobile assertions**

Add an assertion that the dashboard defines phone-specific rules for stacked actions and single-column metrics:

```ts
const dashboard = readFileSync(new URL("../src/pages/admin/index.astro", import.meta.url), "utf8");

test("dashboard has explicit phone layout rules", () => {
  assert.match(dashboard, /@media \(max-width: 600px\)/);
  assert.match(dashboard, /\.quick-actions[\s\S]*flex-direction:\s*column/);
  assert.match(dashboard, /\.dashboard-grid[\s\S]*grid-template-columns:\s*1fr/);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run the focused test; expect failure for missing phone-specific rules.

- [ ] **Step 3: Add phone-level dashboard rules**

Add at `<= 600px`:

```css
.dashboard-header { gap: 14px; margin-bottom: 20px; }
.dashboard-header h1 { font-size: 24px; line-height: 1.2; }
.quick-actions { width: 100%; flex-direction: column; gap: 8px; }
.quick-actions .btn { min-height: 44px; display: flex; align-items: center; justify-content: center; }
.dashboard-grid { grid-template-columns: 1fr; gap: 12px; margin-bottom: 20px; }
.metric-card { padding: 18px; gap: 14px; }
.metric-icon { width: 56px; height: 56px; font-size: 30px; }
.dashboard-content-grid { gap: 16px; }
.category-breakdown, .recent-items { padding: 18px; }
.item-row { align-items: flex-start; gap: 12px; }
.item-info { min-width: 0; }
.item-info strong { overflow-wrap: anywhere; }
.view-link { flex-shrink: 0; }
```

- [ ] **Step 4: Run focused test and commit**

Expected: source test PASS.

```bash
git add src/pages/admin/index.astro tests/admin-responsive-source.test.ts
git commit -m "feat: adapt admin dashboard for mobile"
```

---

### Task 4: Transform Products/Blog editor into a mobile-first editing flow

**Files:**
- Modify: `src/components/admin/ContentEditor.astro`
- Modify if needed: `src/components/TiptapEditor.astro`
- Modify if needed: `src/components/admin/ImageUploader.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add RED tests for editor ordering, no mobile table overflow, and mobile-safe controls**

Add:

```ts
const contentEditor = readFileSync(new URL("../src/components/admin/ContentEditor.astro", import.meta.url), "utf8");

test("content editor becomes a card-style mobile list without horizontal table scrolling", () => {
  assert.match(contentEditor, /@media \(max-width: 600px\)/);
  assert.match(contentEditor, /\.editor-form[\s\S]*order:\s*-1/);
  assert.match(contentEditor, /\.items-table[\s\S]*display:\s*block/);
  assert.match(contentEditor, /\.item-row[\s\S]*display:\s*grid/);
  assert.doesNotMatch(contentEditor, /@media \(max-width: 600px\)[\s\S]*\.items-container\s*\{[^}]*overflow-x:\s*auto/);
});

test("content editor uses touch-friendly mobile controls", () => {
  assert.match(contentEditor, /font-size:\s*16px/);
  assert.match(contentEditor, /min-height:\s*44px/);
});
```

Run focused test; expect RED.

- [ ] **Step 2: Reorder the single-column editor on narrow screens**

At `<= 1100px` keep one column. At `<= 600px` add:

```css
.admin-main .editor-grid { display: flex; flex-direction: column; gap: 14px; }
.admin-main .editor-form { order: -1; width: 100%; }
.admin-main .editor-list { width: 100%; min-width: 0; }
```

- [ ] **Step 3: Convert the semantic table into mobile cards via CSS**

At `<= 600px`:

```css
.admin-main .items-container { overflow-x: visible; }
.admin-main .items-table,
.admin-main .items-table tbody,
.admin-main .items-table tr,
.admin-main .items-table td { display: block; width: 100%; }
.admin-main .items-table { min-width: 0; table-layout: auto; }
.admin-main .items-table thead { display: none; }
.admin-main .item-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px 12px;
  padding: 14px;
  border-bottom: 1px solid #e2e8f0;
}
.admin-main .item-row td { padding: 0; border: 0; }
.admin-main .item-row .col-img { grid-row: 1 / span 2; width: auto; }
.admin-main .item-row .col-title { min-width: 0; }
.admin-main .item-row .col-cat,
.admin-main .item-row .col-brand { display: inline-flex; width: auto; }
.admin-main .item-row .col-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
  text-align: left;
}
```

Do **not** hide category/brand on phones anymore; they move into the card metadata instead.

- [ ] **Step 4: Make search, form, buttons, and pagination phone-safe**

```css
.admin-main .list-toolbar { gap: 10px; padding: 12px; }
.admin-main .search-wrap { max-width: none; }
.admin-main .search-input,
.admin-main .field input,
.admin-main .field textarea,
.admin-main .field select { font-size: 16px; }
.admin-main .btn-action,
.admin-main .btn-save,
.admin-main .btn-reset,
.admin-main .btn-logout { min-height: 44px; }
.admin-main .actions { display: grid; grid-template-columns: 1fr 1fr; }
.admin-main .pagination { overflow-x: auto; justify-content: flex-start; }
.admin-main .pagination button { min-width: 44px; min-height: 44px; }
.admin-main .preview img { max-width: 100% !important; height: auto; }
```

- [ ] **Step 5: Harden Tiptap and image uploader containment**

Inspect their existing CSS before editing. Where needed add:

```css
[data-tiptap-wrapper] { min-width: 0; max-width: 100%; }
[data-tiptap-wrapper] .tiptap-toolbar { max-width: 100%; overflow-x: auto; }
[data-tiptap-wrapper] img { max-width: 100%; height: auto; }
```

For the uploader, ensure its file/button row wraps and every input/action stays within `max-width: 100%`.

- [ ] **Step 6: Run focused source test, then full test**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
npm test
```

Expected: all tests PASS.

- [ ] **Step 7: Commit editor responsiveness**

```bash
git add src/components/admin/ContentEditor.astro src/components/TiptapEditor.astro src/components/admin/ImageUploader.astro tests/admin-responsive-source.test.ts
git commit -m "feat: make admin editors mobile friendly"
```

Only stage Tiptap/ImageUploader if changed.

---

### Task 5: Adapt Categories for phone-width editing and nested records

**Files:**
- Modify: `src/pages/admin/categories.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add a RED source assertion for category actions and reduced subcategory indentation**

```ts
const categories = readFileSync(new URL("../src/pages/admin/categories.astro", import.meta.url), "utf8");

test("categories use mobile card actions and reduced nested indentation", () => {
  assert.match(categories, /@media \(max-width: 640px\)/);
  assert.match(categories, /\.cat-actions[\s\S]*grid-template-columns:\s*1fr 1fr/);
  assert.match(categories, /\.subcategory-list[\s\S]*margin-left:\s*0/);
  assert.match(categories, /min-height:\s*44px/);
});
```

Run and confirm RED.

- [ ] **Step 2: Add mobile category layout rules**

At `<= 640px`:

```css
.add-form,
.categories-section { padding: 16px; }
#category-form { max-width: none; }
#category-name,
#category-parent { width: 100%; box-sizing: border-box; font-size: 16px; }
.form-actions { display: grid; grid-template-columns: 1fr 1fr; }
.btn { min-height: 44px; padding: 10px 14px; }
.category-item,
.category-item.default {
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 10px 12px;
  padding: 12px;
}
.cat-thumb { width: 58px; height: 46px; }
.cat-slug { overflow-wrap: anywhere; }
.cat-actions {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
}
.edit-btn,
.delete-btn { min-height: 44px; }
.subcategory-list { margin-left: 0; padding-left: 10px; }
```

- [ ] **Step 3: Run test and commit**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
git add src/pages/admin/categories.astro tests/admin-responsive-source.test.ts
git commit -m "feat: adapt category admin for mobile"
```

---

### Task 6: Adapt Contact Messages and Enquiries list surfaces

**Files:**
- Modify: `src/pages/admin/contact-messages.astro`
- Modify: `src/pages/admin/enquiries.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add RED assertions for full-width search, overflow-safe contact data, and mobile pagination**

Add tests reading both files and checking for:

```ts
assert.match(source, /@media \(max-width: 600px\)/);
assert.match(source, /\.search-wrap[\s\S]*max-width:\s*none/);
assert.match(source, /overflow-wrap:\s*anywhere/);
assert.match(source, /\.pagination[\s\S]*overflow-x:\s*auto/);
```

Run and confirm RED.

- [ ] **Step 2: Add shared-pattern mobile rules to Contact Messages**

```css
@media (max-width: 600px) {
  .admin-main .page-header { margin-bottom: 16px; }
  .admin-main .card-toolbar { padding: 12px; }
  .admin-main .search-wrap { max-width: none; width: 100%; }
  .admin-main #search-input { min-height: 44px; font-size: 16px; }
  .admin-main .message-card { padding: 14px; }
  .admin-main .message-header { flex-direction: column; gap: 8px; }
  .admin-main .message-from { min-width: 0; align-items: flex-start; }
  .admin-main .message-email { overflow-wrap: anywhere; word-break: break-word; }
  .admin-main .message-subject,
  .admin-main .message-content { margin-left: 0; max-width: 100%; }
  .admin-main .pagination { overflow-x: auto; justify-content: flex-start; }
  .admin-main .pagination button { min-width: 44px; min-height: 44px; }
}
```

- [ ] **Step 3: Add equivalent mobile rules to Enquiries**

In addition to search/pagination:

```css
.admin-main .contact-info { min-width: 0; }
.admin-main .contact-info a,
.admin-main .phone { overflow-wrap: anywhere; word-break: break-word; }
.admin-main .equipment-badge { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.admin-main .enquiry-message,
.admin-main .enquiry-meta { margin-left: 0; }
```

- [ ] **Step 4: Run focused and full tests, then commit**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
npm test
git add src/pages/admin/contact-messages.astro src/pages/admin/enquiries.astro tests/admin-responsive-source.test.ts
git commit -m "feat: make admin message lists responsive"
```

---

### Task 7: Adapt the Gmail-style mailbox for mobile

**Files:**
- Modify: `src/pages/admin/emails.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add RED source assertions for mailbox stacking**

```ts
const mailbox = readFileSync(new URL("../src/pages/admin/emails.astro", import.meta.url), "utf8");

test("mailbox stacks toolbar and message rows on phones", () => {
  assert.match(mailbox, /@media \(max-width: 700px\)/);
  assert.match(mailbox, /\.mailbox-toolbar[\s\S]*flex-direction:\s*column/);
  assert.match(mailbox, /\.mail-row[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(mailbox, /\.search-field[\s\S]*width:\s*100%/);
});
```

Run and confirm RED.

- [ ] **Step 2: Add tablet/mobile toolbar behavior**

At `<= 700px`:

```css
.admin-main .mailbox-header { align-items: stretch; flex-direction: column; gap: 12px; }
.admin-main .compose-btn { width: 100%; min-height: 44px; }
.admin-main .mailbox-toolbar { align-items: stretch; flex-direction: column; gap: 10px; padding: 12px; }
.admin-main .folder-tabs { width: 100%; }
.admin-main .folder-tab { flex: 1; justify-content: center; min-height: 44px; }
.admin-main .mailbox-actions { width: 100%; }
.admin-main .search-field { width: 100%; }
.admin-main #search-input { min-height: 44px; font-size: 16px; }
.admin-main .refresh-btn { min-height: 44px; }
.admin-main .filter-strip { overflow-x: auto; padding: 8px 12px; }
```

- [ ] **Step 3: Convert message rows to stacked conversations**

```css
.admin-main .mail-row {
  grid-template-columns: 1fr;
  gap: 5px;
  min-height: 0;
  padding: 13px 14px;
}
.admin-main .mail-person-wrap { padding-right: 78px; }
.admin-main .mail-meta { position: absolute; top: 13px; right: 14px; }
.admin-main .mail-subject-line { display: block; }
.admin-main .mail-subject,
.admin-main .mail-snippet { white-space: normal; overflow: hidden; }
```

Ensure long filenames/person names use ellipsis/wrapping without forcing width.

- [ ] **Step 4: Run source test and commit**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
git add src/pages/admin/emails.astro tests/admin-responsive-source.test.ts
git commit -m "feat: adapt admin mailbox for mobile"
```

---

### Task 8: Adapt Email Compose for phones

**Files:**
- Modify: `src/pages/admin/emails/send.astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Inspect existing compose CSS and add RED assertions against actual class names**

The test must assert the implemented phone breakpoint contains:

- full-width composer shell
- 16px recipient/subject/editor fields
- toolbar wrapping/containment
- attachment wrapping
- 44px send action
- inline image `max-width: 100%`

Use exact selectors present in `send.astro`; do not invent parallel markup.

- [ ] **Step 2: Implement responsive compose rules**

Follow the existing class structure, applying equivalent rules:

```css
@media (max-width: 700px) {
  .composer-header { flex-direction: column; align-items: stretch; }
  .composer-surface { border-radius: 12px; }
  .composer-row { grid-template-columns: 1fr; gap: 6px; }
  .composer-row input { font-size: 16px; }
  .composer-toolbar { max-width: 100%; overflow-x: auto; }
  .composer-editor { min-height: 280px; font-size: 16px; overflow-wrap: anywhere; }
  .composer-editor img { max-width: 100%; height: auto; }
  .attachment-list { flex-wrap: wrap; }
  .composer-footer { flex-wrap: wrap; gap: 8px; }
  .send-button { min-height: 44px; }
}
```

Keep the actual existing selector names.

- [ ] **Step 3: Run source test and commit**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
git add src/pages/admin/emails/send.astro tests/admin-responsive-source.test.ts
git commit -m "feat: adapt email composer for mobile"
```

---

### Task 9: Adapt Email Thread for phones

**Files:**
- Modify: `src/pages/admin/emails/thread/[source]/[id].astro`
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Inspect actual thread selectors and add RED assertions**

Assert the mobile breakpoint includes:

- single-column thread header/actions
- message header wrapping
- body `min-width: 0` / `overflow-wrap`
- email body images `max-width: 100%`
- attachment rows wrapping
- reply/action minimum 44px touch target

- [ ] **Step 2: Add responsive thread constraints using existing selectors**

Equivalent target behavior:

```css
@media (max-width: 700px) {
  .thread-header { flex-direction: column; align-items: stretch; gap: 12px; }
  .thread-actions { width: 100%; }
  .thread-actions a,
  .thread-actions button { min-height: 44px; }
  .message-header { align-items: flex-start; flex-wrap: wrap; }
  .message-body { min-width: 0; overflow-wrap: anywhere; }
  .message-body img { max-width: 100% !important; height: auto !important; }
  .attachments { min-width: 0; }
  .attachment-row { flex-wrap: wrap; overflow-wrap: anywhere; }
}
```

Use the route’s current selectors rather than adding duplicate structures.

- [ ] **Step 3: Run focused test and commit**

```bash
node --experimental-strip-types --test tests/admin-responsive-source.test.ts
git add 'src/pages/admin/emails/thread/[source]/[id].astro' tests/admin-responsive-source.test.ts
git commit -m "feat: adapt email threads for mobile"
```

---

### Task 10: Add shared overflow and safe-area hardening

**Files:**
- Modify: `src/layouts/AdminLayout.astro`
- Modify as needed: changed admin pages/components from earlier tasks
- Test: `tests/admin-responsive-source.test.ts`

- [ ] **Step 1: Add a regression assertion for page-level overflow protection**

```ts
assert.match(layout, /\.admin-main[\s\S]*min-width:\s*0/);
assert.match(layout, /overflow-x:\s*clip|overflow-x:\s*hidden/);
```

Run and confirm RED if missing.

- [ ] **Step 2: Add the shared containment rules**

```css
.admin-shell,
.admin-main { min-width: 0; }
.admin-main { overflow-x: clip; }
.admin-main img,
.admin-main video,
.admin-main iframe { max-width: 100%; }

@media (max-width: 900px) {
  .admin-main {
    padding: 14px;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 480px) {
  .admin-main { padding-left: 12px; padding-right: 12px; }
}
```

Avoid `overflow-x: hidden` on controls that intentionally need internal horizontal scrolling; apply containment to the page frame instead.

- [ ] **Step 3: Run all source tests and full suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit containment hardening**

```bash
git add src/layouts/AdminLayout.astro tests/admin-responsive-source.test.ts
git commit -m "fix: harden admin viewport containment"
```

---

### Task 11: Run Impeccable mechanical detector and address actionable findings

**Files:**
- Potentially modify any changed UI file from Tasks 2–10.

- [ ] **Step 1: Run detector exactly once over changed UI targets**

Run:

```bash
node /Users/rahmatullahzisan/.agents/skills/impeccable/scripts/detect.mjs --json \
  src/layouts/AdminLayout.astro \
  src/components/admin/AdminSidebar.astro \
  src/components/admin/ContentEditor.astro \
  src/components/TiptapEditor.astro \
  src/components/admin/ImageUploader.astro \
  src/pages/admin/index.astro \
  src/pages/admin/categories.astro \
  src/pages/admin/contact-messages.astro \
  src/pages/admin/enquiries.astro \
  src/pages/admin/emails.astro \
  src/pages/admin/emails/send.astro \
  'src/pages/admin/emails/thread/[source]/[id].astro'
```

Expected: JSON array of findings or `[]`.

- [ ] **Step 2: Fix only actionable findings that affect this responsive scope**

Examples:
- insufficient touch target
- problematic transition property
- mobile overflow pattern
- inaccessible control state

Do not broaden into unrelated visual redesign.

- [ ] **Step 3: Do not rerun the detector unless the tool itself explicitly requires it**

Per Impeccable instruction, one mechanical run is the required pass. Validate subsequent fixes through tests/build/manual inspection.

- [ ] **Step 4: Commit detector-driven fixes if any**

```bash
git add src/layouts/AdminLayout.astro src/components/admin/AdminSidebar.astro src/components/admin/ContentEditor.astro src/components/TiptapEditor.astro src/components/admin/ImageUploader.astro src/pages/admin/index.astro src/pages/admin/categories.astro src/pages/admin/contact-messages.astro src/pages/admin/enquiries.astro src/pages/admin/emails.astro src/pages/admin/emails/send.astro 'src/pages/admin/emails/thread/[source]/[id].astro' tests/admin-responsive-source.test.ts
git commit -m "fix: address responsive admin design findings"
```

Skip the commit if there were no changes.

---

### Task 12: Final verification and responsive acceptance

**Files:**
- No planned source changes unless verification exposes a defect.

- [ ] **Step 1: Run full automated tests**

```bash
npm test
```

Expected: 0 failures.

- [ ] **Step 2: Run production dependency audit**

```bash
npm audit --omit=dev
```

Expected: 0 vulnerabilities.

- [ ] **Step 3: Run production Astro build**

```bash
npm run build
```

Expected: exit code 0. Existing unresolved runtime asset warnings for `/images/hero-bg.webp` and `/images/services-hero.jpg` may remain if unchanged and unrelated.

- [ ] **Step 4: Run Cloudflare deployment dry-run**

```bash
npx wrangler deploy --dry-run
```

Expected: exit code 0 and expected Worker bindings resolved.

- [ ] **Step 5: Check repository diff for scope discipline**

Review changed files and verify only responsive admin implementation/tests/docs are included. Preserve unrelated files if any appear.

- [ ] **Step 6: Manual/browser acceptance at representative widths**

Check these viewport sizes where browser tooling is available:

- 320 × 568
- 375 × 812
- 390 × 844
- 430 × 932
- 768 × 1024
- >= 1280 desktop

For each representative route verify:

- `/admin`
- `/admin/products`
- `/admin/categories`
- `/admin/contact-messages`
- `/admin/enquiries`
- `/admin/emails`
- `/admin/emails/send`
- one email thread

Acceptance checklist:

```text
[ ] drawer opens/closes via hamburger, close button, backdrop, Escape
[ ] no document-level horizontal scrolling
[ ] controls are touch-sized
[ ] mobile inputs do not trigger browser zoom
[ ] product/blog records need no horizontal table panning
[ ] category nesting remains readable
[ ] contact/enquiry addresses do not overflow
[ ] mailbox rows scan naturally on phones
[ ] compose/thread images and attachments remain inside viewport
[ ] desktop sidebar/layout remain unchanged
```

- [ ] **Step 7: If verification reveals defects, add a failing regression assertion first, then fix**

Do not patch a discovered responsive defect without locking it into `tests/admin-responsive-source.test.ts` where a stable source-level contract can represent it.

- [ ] **Step 8: Commit final verification fixes, if any**

```bash
git add src/layouts/AdminLayout.astro src/components/admin/AdminSidebar.astro src/components/admin/ContentEditor.astro src/components/TiptapEditor.astro src/components/admin/ImageUploader.astro src/pages/admin/index.astro src/pages/admin/categories.astro src/pages/admin/contact-messages.astro src/pages/admin/enquiries.astro src/pages/admin/emails.astro src/pages/admin/emails/send.astro 'src/pages/admin/emails/thread/[source]/[id].astro' tests/admin-responsive-source.test.ts
git commit -m "fix: finalize responsive admin behavior"
```

Skip if no final fixes were needed.
