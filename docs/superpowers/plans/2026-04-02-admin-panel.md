# Same Repo Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-admin panel to the existing Astro site so the client can log in, upload WebP-compressed images to R2, and manage products, parts, and blog posts that go live immediately.

**Architecture:** Convert the Astro site to Cloudflare-compatible server mode, add password-based cookie auth, use Neon for content data, and use R2 for image storage. Keep the public site and admin UI in the same repo, with admin pages under `/admin` and write APIs under `/api`.

**Tech Stack:** Astro, Cloudflare adapter/runtime, Neon serverless driver, R2, signed cookies, vanilla Astro pages/forms.

---

### Task 1: Runtime And Dependency Setup

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`
- Create: `src/env.d.ts`
- Create: `wrangler.jsonc`

- [ ] Add Astro Cloudflare adapter and server-compatible dependencies.
- [ ] Configure Astro for Cloudflare server output.
- [ ] Add typed environment/binding declarations for `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `MEDIA_BUCKET`.
- [ ] Add Wrangler bindings scaffold for local/dev deployment.

### Task 2: Backend Foundations

**Files:**
- Create: `src/lib/server/env.ts`
- Create: `src/lib/server/db.ts`
- Create: `src/lib/server/auth.ts`
- Create: `src/lib/server/session.ts`
- Create: `src/lib/server/slug.ts`
- Create: `src/lib/server/repository.ts`
- Create: `src/lib/server/schema.sql`

- [ ] Implement environment access helpers.
- [ ] Implement Neon client wrapper and schema bootstrap guidance.
- [ ] Implement single-admin password verification and signed session cookies.
- [ ] Implement shared CRUD helpers for products, parts, and blog posts.

### Task 3: API Endpoints

**Files:**
- Create: `src/pages/api/auth/login.ts`
- Create: `src/pages/api/auth/logout.ts`
- Create: `src/pages/api/upload.ts`
- Create: `src/pages/api/products.ts`
- Create: `src/pages/api/products/[id].ts`
- Create: `src/pages/api/parts.ts`
- Create: `src/pages/api/parts/[id].ts`
- Create: `src/pages/api/blog.ts`
- Create: `src/pages/api/blog/[id].ts`

- [ ] Add auth endpoints for login/logout.
- [ ] Add R2 upload endpoint that accepts browser-generated WebP files.
- [ ] Add CRUD endpoints for products, parts, and blog posts.

### Task 4: Admin UI

**Files:**
- Create: `src/layouts/AdminLayout.astro`
- Create: `src/components/admin/AdminSidebar.astro`
- Create: `src/components/admin/ImageUploader.astro`
- Create: `src/components/admin/ContentEditor.astro`
- Create: `src/pages/admin/login.astro`
- Create: `src/pages/admin/index.astro`
- Create: `src/pages/admin/products.astro`
- Create: `src/pages/admin/parts.astro`
- Create: `src/pages/admin/blog.astro`

- [ ] Add login page and auth guard.
- [ ] Add dashboard and CRUD forms/tables for each content type.
- [ ] Add browser-side image compression to WebP before upload.

### Task 5: Public Content Wiring And Verification

**Files:**
- Modify: `src/pages/products.astro`
- Create: `src/pages/products/[slug].astro`
- Create: `src/pages/parts/[slug].astro`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[slug].astro`

- [ ] Read live content from Neon for public pages.
- [ ] Ensure create/update actions appear immediately on the public site.
- [ ] Verify build/runtime behavior and document required env vars.
