# Admin Pages Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pagination to 4 non-email admin pages (enquiries, contact-messages, products, blog) following the existing email pages pattern.

**Architecture:** API endpoints gain `?page=&limit=` params. Frontend pages fetch paginated data via JavaScript and render pagination controls. `ContentEditor.astro` component gets built-in pagination for products/blog.

**Tech Stack:** Vanilla JavaScript (no framework), existing API pattern, existing CSS pagination styles.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/server/repository.ts` | `listContent` add LIMIT/OFFSET support |
| `src/lib/server/api.ts` | `createListHandler` read `page`/`limit` query params |
| `src/pages/api/admin/enquiries.ts` | Add COUNT query, pagination params |
| `src/pages/api/admin/contact-messages.ts` | Add COUNT query, pagination params |
| `src/components/admin/ContentEditor.astro` | Add pagination UI below items list |
| `src/pages/admin/enquiries.astro` | Convert to client-side fetch + pagination |
| `src/pages/admin/contact-messages.astro` | Convert to client-side fetch + pagination |

---

## Task 1: Add pagination to `listContent` in repository.ts

**Files:**
- Modify: `src/lib/server/repository.ts:68-74`

- [ ] **Step 1: Add page/limit params to listContent**

```typescript
export async function listContent(env: RuntimeEnv, type: ContentType, options?: { page?: number; limit?: number; search?: string }) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM ${table}`;
  const params: (string | number)[] = [];

  if (options?.search) {
    query += ` WHERE title ILIKE $1 OR excerpt ILIKE $1`;
    params.push(`%${options.search}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await sql.query(query, params.length ? params : undefined);
  return rows.map((row) => mapRecord(type, row));
}

export async function countContent(env: RuntimeEnv, type: ContentType, search?: string): Promise<number> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];

  let query = `SELECT COUNT(*) as total FROM ${table}`;
  const params: string[] = [];

  if (search) {
    query += ` WHERE title ILIKE $1 OR excerpt ILIKE $1`;
    params.push(`%${search}%`);
  }

  const rows = await sql.query(query, params.length ? params : undefined);
  return Number(rows[0]?.total ?? 0);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/repository.ts
git commit -m "feat: add pagination support to listContent and countContent"
```

---

## Task 2: Update `createListHandler` to return paginated response

**Files:**
- Modify: `src/lib/server/api.ts:31-38`

- [ ] **Step 1: Update GET handler to parse pagination params**

Change line ~33-38 from:
```typescript
if (context.request.method === "GET") {
  const env = getRuntimeEnv(context.locals);
  const items = await listContent(env, type);
  return Response.json({ items });
}
```

To:
```typescript
if (context.request.method === "GET") {
  const env = getRuntimeEnv(context.locals);
  const url = new URL(context.request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const search = url.searchParams.get("search") ?? undefined;

  const [items, total] = await Promise.all([
    listContent(env, type, { page, limit, search }),
    countContent(env, type, search)
  ]);

  const totalPages = Math.ceil(total / limit);
  return Response.json({ items, total, page, totalPages, limit });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/api.ts
git commit -m "feat: return paginated response with total/totalPages from list handler"
```

---

## Task 3: Add pagination to enquiries API

**Files:**
- Modify: `src/pages/api/admin/enquiries.ts`

- [ ] **Step 1: Rewrite GET handler with pagination**

```typescript
export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context.locals);
  const authenticated = await isAuthenticated(context.cookies, env.SESSION_SECRET);

  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb(env);
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search") ?? undefined;

    let countQuery = "SELECT COUNT(*) as total FROM enquiries";
    let query = `SELECT id, name, email, phone, equipment, message, created_at FROM enquiries`;
    const params: (string | number)[] = [];

    if (search) {
      const searchCondition = ` WHERE name ILIKE $1 OR email ILIKE $1 OR equipment ILIKE $1 OR message ILIKE $1`;
      countQuery += searchCondition;
      query += searchCondition;
      params.push(`%${search}%`);
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    }

    const [countResult, items] = await Promise.all([
      sql.query(countQuery, search ? [`%${search}%`] : undefined),
      sql.query(query, search ? [`%${search}%`, ...params] : params)
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return Response.json({ items, total, page, totalPages, limit });
  } catch {
    return Response.json(
      { error: "Failed to fetch enquiries." },
      { status: 500 }
    );
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/enquiries.ts
git commit -m "feat: add pagination to enquiries API with search support"
```

---

## Task 4: Add pagination to contact-messages API

**Files:**
- Modify: `src/pages/api/admin/contact-messages.ts`

- [ ] **Step 1: Rewrite GET handler with pagination**

```typescript
import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../../../lib/server/env";
import { getDb } from "../../../lib/server/db";
import { isAuthenticated } from "../../../lib/server/session";

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context.locals);
  const authenticated = await isAuthenticated(context.cookies, env.SESSION_SECRET);

  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb(env);
    const url = new URL(context.request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search") ?? undefined;

    let countQuery = "SELECT COUNT(*) as total FROM contact_messages";
    let query = `SELECT id, name, email, subject, message, created_at FROM contact_messages`;
    const params: string[] = [];

    if (search) {
      const searchCondition = ` WHERE name ILIKE $1 OR email ILIKE $1 OR subject ILIKE $1 OR message ILIKE $1`;
      countQuery += searchCondition;
      query += searchCondition;
      params.push(`%${search}%`);
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    }

    const [countResult, items] = await Promise.all([
      sql.query(countQuery, search ? [`%${search}%`] : undefined),
      sql.query(query, search ? [`%${search}%`, ...params] : params)
    ]);

    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / limit);

    return Response.json({ items, total, page, totalPages, limit });
  } catch {
    return Response.json(
      { error: "Failed to fetch messages." },
      { status: 500 }
    );
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/api/admin/contact-messages.ts
git commit -m "feat: add pagination to contact-messages API with search support"
```

---

## Task 5: Add pagination to ContentEditor.astro

**Files:**
- Modify: `src/components/admin/ContentEditor.astro`

**Changes:**
1. Add `PAGE_SIZE = 20` constant
2. Add `currentPage = 1` state
3. Update `loadItems()` to use `?page=&limit=` params
4. Add pagination render functions (same pattern as emails.astro)
5. Add pagination div below items list
6. Add search debounce resets to page 1

- [ ] **Step 1: Add pagination state and functions**

After line ~108 (after `let imageRemoved = false;`), add:

```javascript
let currentPage = 1;
const PAGE_SIZE = 20;
let totalPages = 1;
```

- [ ] **Step 2: Add pagination functions before loadItems**

```javascript
function renderPagination() {
  if (totalPages <= 1) {
    paginationEl.textContent = "";
    return;
  }

  paginationEl.textContent = "";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => goToPage(currentPage - 1));
  paginationEl.appendChild(prevBtn);

  const pages = getPageNumbers();
  pages.forEach((p) => {
    if (typeof p === "string") {
      const info = document.createElement("span");
      info.className = "page-info";
      info.textContent = "…";
      paginationEl.appendChild(info);
    } else {
      const btn = document.createElement("button");
      btn.textContent = String(p);
      if (p === currentPage) btn.style.fontWeight = "bold";
      btn.addEventListener("click", () => goToPage(p));
      paginationEl.appendChild(btn);
    }
  });

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.addEventListener("click", () => goToPage(currentPage + 1));
  paginationEl.appendChild(nextBtn);

  const info = document.createElement("span");
  info.className = "page-info";
  info.textContent = `Page ${currentPage} of ${totalPages}`;
  paginationEl.appendChild(info);
}

function getPageNumbers() {
  const pages = [1];
  if (totalPages <= 7) {
    for (let i = 2; i <= totalPages; i++) pages.push(i);
  } else {
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push("…");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("…");
    pages.push(totalPages);
  }
  return pages;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadItems();
}
```

- [ ] **Step 3: Add pagination div and update loadItems**

In the HTML template (before `</section>`), add after the items div:

```html
<div class="pagination" data-pagination></div>
```

In the script, after `const itemsEl = editor.querySelector("[data-items]");`, add:

```javascript
const paginationEl = editor.querySelector("[data-pagination]");
```

Update `loadItems()` to use pagination:

```javascript
const loadItems = async () => {
  const params = new URLSearchParams({ page: String(currentPage), limit: String(PAGE_SIZE) });
  const response = await fetch(`${endpoint}?${params}`);
  const data = await response.json();
  const items = data.items || [];
  totalPages = data.totalPages || 1;
  currentPage = data.page || 1;
  renderItems(items);
  renderPagination();
};
```

- [ ] **Step 4: Add CSS for pagination**

In the `<style>` section, add:

```css
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.pagination button {
  padding: 8px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.pagination button:hover:not(:disabled) {
  background: #f0f0f0;
}
.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pagination .page-info {
  padding: 8px 12px;
  color: #666;
  font-size: 14px;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/ContentEditor.astro
git commit -m "feat: add pagination to ContentEditor for products and blog"
```

---

## Task 6: Convert enquiries.astro to client-side pagination

**Files:**
- Modify: `src/pages/admin/enquiries.astro`

- [ ] **Step 1: Rewrite frontend to fetch from API**

Replace the server-side rendered list (lines 14-19 and the HTML template) with:
- Initial count fetch (no items fetch in SSR)
- JavaScript fetch + render pattern matching emails.astro

Full replacement of frontmatter to just auth check:
```astro
---
import AdminLayout from "../../layouts/AdminLayout.astro";
import { getRuntimeEnv } from "../../lib/server/env";
import { isAuthenticated } from "../../lib/server/session";
import { getDb } from "../../lib/server/db";

const env = getRuntimeEnv(Astro.locals);
const authenticated = await isAuthenticated(Astro.cookies, env.SESSION_SECRET);

if (!authenticated) {
  return Astro.redirect("/admin/login");
}

const sql = getDb(env);
const countResult = await sql.query(`SELECT COUNT(*) as total FROM enquiries`);
const total = countResult[0]?.total ?? 0;
---
```

Update HTML template and add full client-side rendering (same pattern as emails.astro but for enquiry cards).

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/enquiries.astro
git commit -m "feat: convert enquiries to client-side pagination"
```

---

## Task 7: Convert contact-messages.astro to client-side pagination

**Files:**
- Modify: `src/pages/admin/contact-messages.astro`

- [ ] **Step 1: Same pattern as Task 6 but for contact messages**

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/contact-messages.astro
git commit -m "feat: convert contact-messages to client-side pagination"
```

---

## Self-Review Checklist

- [ ] All API endpoints return `{ items, total, page, totalPages, limit }`
- [ ] `listContent` and `countContent` support page/limit/search
- [ ] `enquiries.astro` and `contact-messages.astro` fetch from API (not server-side render all)
- [ ] `ContentEditor.astro` shows pagination controls below items
- [ ] Page changes on filter/search reset to page 1
- [ ] 300ms debounce on search inputs
- [ ] All CSS pagination styles match existing `.pagination` styles from emails.astro