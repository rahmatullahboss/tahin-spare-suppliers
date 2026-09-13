# GSC SEO Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve commercial search equity, prevent product identity drift, and improve evidence-backed search snippets from the 2026-09-13 live GSC audit.

**Architecture:** Add pure SEO helpers for legacy URL authority, product identity validation, and category metadata. Product/admin routes consume the helpers without moving inventory truth into SEO code. All changes are regression-tested and documented against live GSC evidence.

**Tech Stack:** Astro 7, TypeScript/JavaScript, Node test runner, Neon-backed product CMS, Google Search Console.

**Spec:** `docs/superpowers/specs/2026-09-13-gsc-seo-hardening-design.md`

## Global Constraints

- Never fabricate Search Console metrics, inventory state, product model, public price, or currency.
- Current product lookup always wins over a legacy redirect mapping.
- Legacy redirects must be exact allowlisted 301 mappings.
- Identity validation reports conflicts; it does not decide which physical model is true.
- Product Offer schema stays absent unless truthful public price/currency data exists.
- Preserve existing unrelated work and use the isolated branch `fix/gsc-seo-hardening-20260913`.

---

### Task 1: Legacy product URL authority

**Files:** `src/lib/seo.ts`, `src/pages/products/[slug].astro`, `tests/seo-system.test.ts`

- [x] Add failing unit assertions for `resolveLegacyProductRedirect()` covering the MAN connecting-rod and Cummins VTA28 historical slugs, plus unknown/current slug fallthrough.
- [x] Run `node --experimental-strip-types --test tests/seo-system.test.ts` and confirm the helper is missing.
- [x] Implement the minimal exact mapping in `src/lib/seo.ts`.
- [x] Add a failing source assertion proving the product route consults the helper only after current-product lookup misses and before returning 404.
- [x] Wire `Astro.redirect(canonicalPath, 301)` for an allowlisted miss and rerun the focused test.

### Task 2: Product identity conflict guard

**Files:** `src/lib/seo.ts`, `src/components/admin/ContentEditor.astro`, `tests/seo-system.test.ts`

- [x] Add failing tests for a pure identity-conflict helper: NZ61 title/model vs `nz62` slug must fail; `VTA-28` vs `vta28` must pass; missing model must not invent a conflict.
- [x] Implement normalized model-token comparison conservatively in `src/lib/seo.ts`.
- [x] Add failing CMS source assertions proving validation runs before media upload/save.
- [x] Mirror the pure guard in the browser editor or expose equivalent deterministic logic; block save with an actionable message before uploads.
- [x] Rerun the focused SEO test.

### Task 3: Evidence-backed category snippets

**Files:** `src/lib/seo.ts`, `src/pages/category/[category].astro`, `tests/seo-system.test.ts`

- [x] Add failing tests for `resolveCategorySeo()` covering Spare Parts, Turbocharger, and generic fallback.
- [x] Implement concise truthful title/description overrides without inventory claims.
- [x] Update the category page to use the helper for title and description.
- [x] Run focused SEO tests and keep empty-category `noindex` behavior unchanged.

### Task 4: Production data remediation contract

**Files:** `docs/seo/gsc-live-audit-2026-09-13.md`, `docs/seo/tahin-seo-execution-log.md`

- [x] Record the read-only Neon evidence that the NZ62 slug record is actually NZ61 across name/model/SEO fields.
- [x] Define the intended canonical NZ61 slug and the required old-NZ62 301 mapping, but do not mutate production data inside a code-only commit.
- [x] Record that the MAN replacement record contains the connecting-rod specification, making the redirect evidence-based.
- [x] Record Search Console sitemap warnings and the representative URL Inspection results.

### Task 5: Full verification and evidence

**Files:** all changed files

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run `npm run seo:snapshot` against its configured production target.
- [x] Run `git diff --check`.
- [x] Review the final diff for unrelated changes and truthful claims.
- [x] Append implementation/test evidence to `docs/seo/tahin-seo-execution-log.md`.
- [x] Commit the completed implementation on the isolated branch.

## Post-deploy checks

1. Confirm both legacy product URLs return exact 301s.
2. Correct the NZ61 product slug through the controlled content workflow, then add its old NZ62 path to the redirect map before deployment that removes the old URL.
3. Re-run Google URL Inspection on the priority pages.
4. Review the four sitemap warnings and resubmit the current sitemap if needed.
5. Compare the next settled 28-day window against the audit without inferring hidden query clicks.
