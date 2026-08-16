# Tahin Spare Suppliers Buyer-Intent SEO Implementation Plan

**Date:** 2026-08-16
**Design:** `docs/superpowers/specs/2026-08-16-tahin-seo-buyer-intent-design.md`
**Progress ledger:** `docs/seo/tahin-seo-progress.yaml`

## Phase 0 — Baseline and context

- [x] Install MarketingSkills SEO skill set into `.agents/skills/`.
- [x] Create `.agents/product-marketing.md` from current codebase, live site and client requirements.
- [x] Run baseline tests.
- [x] Run baseline build and record broken asset warnings.
- [x] Audit current DB/repository/API/admin/product/category/blog/sitemap/layout paths.
- [x] Verify relevant current Google Search guidance before designing schema/canonical/CWV behavior.

Baseline evidence:

- `npm test`: 51/51 passing before SEO changes.
- `npm run build`: passing, with unresolved `/images/services-hero.jpg` and `/images/hero-bg.webp` warnings.

## Phase 1 — SEO domain model and safe defaults

**Status: Complete.**

1. Add `src/lib/seo.ts` with pure helpers for:
   - default SEO title,
   - default meta description,
   - focus keyword,
   - image ALT,
   - brand URL slug,
   - condition → schema.org mapping,
   - canonical absolute image URL helpers where useful.
2. Extend `products` through additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements.
3. Add `parts` to repository `CONTENT_TABLES` so existing parts API/sitemap calls are valid.
4. Extend product `ContentRecord` and `ContentInput` with typed SEO/inventory fields.
5. Parse/store manual related products as a JSON array of product slugs.
6. Generate safe SEO defaults in the repository when manual values are blank.

## Phase 2 — Admin/CMS product upload SEO

**Status: Complete.**

Update `ContentEditor.astro` product mode with:

- Product Name
- Brand
- Model
- Part Number
- Condition
- Availability
- Location
- Category / Subcategory
- Product Description / Details
- Technical Specifications
- Application
- SEO Title
- Meta Description
- Focus Keyword
- SEO URL / Slug
- Image ALT Text
- Related Products (product slugs)

Behavior:

- Existing records continue to edit normally.
- Manual values are preserved.
- `Generate SEO Defaults` fills safe defaults into blank SEO fields.
- Server-side generation remains the final fallback if the browser helper is not used.
- Product image upload remains the existing R2 path.

## Phase 3 — Public product SEO and conversion

**Status: Complete.**

Update `/products/[slug]`:

1. Use stored/generated SEO title and meta description.
2. Preserve canonical `/products/{slug}`.
3. Return true 404 for missing records.
4. Render Brand, Model, Part Number, Condition, Availability, Location and Category in HTML.
5. Render Application and Technical Specifications as visible text sections.
6. Use stored/generated image ALT.
7. Use accurate Product JSON-LD with no fabricated price.
8. Add visible breadcrumbs + BreadcrumbList JSON-LD.
9. Add RFQ and product-specific WhatsApp CTA.
10. Resolve manual related-product slugs first; fall back to same-brand/category products.
11. Reserve primary-image layout dimensions and prioritize above-fold image loading.

## Phase 4 — Site architecture and internal linking

**Status: Complete.**

1. Add reusable `Breadcrumbs.astro` component.
2. Add `/brands` hub with live unique brands and inventory counts.
3. Add `/brands/[brand]` live brand inventory route.
4. Replace `Sell Equipments` navigation with buyer-oriented commercial navigation:
   - Marine Engines
   - Generators
   - Spare Parts
   - Deck Crane / Hydraulic
   - Brands
   - Resources
   - Request a Quote
5. Add breadcrumbs to category/subcategory and blog detail pages.
6. Keep existing indexed product URLs stable.
7. Consolidate legacy duplicate category signals by omitting legacy duplicates from sitemap and assigning canonical targets where appropriate rather than deleting inbound URLs.
8. Reposition `/products` from the legacy `Sell Equipments` wording to a buyer-focused Marine Engines, Generators & Spare Parts hub with breadcrumb and image layout reservation.

## Phase 5 — Sitemap, robots, 404 and structured data

**Status: Complete.**

1. Fix dynamic sitemap collection to enumerate all inventory/blog content in bounded 1,000-row batches.
2. Include canonical category/subcategory pages.
3. Include `/brands` and brand pages.
4. Keep individual product/part/blog pages.
5. Avoid one failing collection removing all dynamic sitemap entries.
6. Harden `robots.txt` admin/API exclusions and sitemap declaration.
7. Return 404 on missing dynamic product/part/blog/category/subcategory/brand records.
8. Make category FAQ text/schema factually conditional rather than claiming every unit is reconditioned/in stock.
9. Add BlogPosting schema on blog detail.

## Phase 6 — GA4, Search Console and measurement hooks

**Status: Code complete; real Google account identifiers/verification remain external.**

1. Extend runtime env typing with optional:
   - `GOOGLE_ANALYTICS_ID`
   - `GOOGLE_SITE_VERIFICATION`
2. Render Search Console verification meta only when configured.
3. Render official GA4 Google tag only when a valid-looking `G-...` ID is configured.
4. Add commented/example configuration to `wrangler.example.jsonc`, never fake production IDs.
5. Emit buyer-conversion analytics when GA4 is configured:
   - `generate_lead` after a successful enquiry submission,
   - product RFQ click,
   - product/part WhatsApp click,
   - enquiry-page WhatsApp click.
6. Preserve product/brand context when an RFQ CTA opens `/enquiry`.
7. Document account-side completion steps:
   - create/select GA4 property + web stream,
   - copy measurement ID into secret/config,
   - verify Search Console property,
   - submit `https://tahinspare.com/sitemap.xml`,
   - confirm indexing/CWV/structured-data reports after deployment.

## Phase 7 — CWV and broken-resource cleanup

**Status: Complete.**

1. Replace all references to missing hero assets with existing optimized imagery.
2. Add image dimensions/aspect-ratio reservation on high-reuse product cards/category cards.
3. Keep grid images lazy; make primary detail image eager/high-priority.
4. Ensure no new render-blocking JS is added.
5. Rebuild and require previous unresolved hero warnings to disappear.

## Phase 8 — Automated certification

**Status: Complete.**

Add focused SEO tests for:

- all DB SEO columns exist,
- `parts` is a supported repository content type,
- safe title/meta defaults,
- CMS exposes every required product field,
- product page uses CMS fields,
- no `price: "0"` or equivalent fabricated offer remains,
- Product/Breadcrumb schema present,
- sitemap uses complete limits and category/brand paths,
- GA4/GSC are environment-backed,
- no missing hero asset references remain,
- buyer-oriented navigation links and `/products` hub copy exist,
- product/brand enquiry context and GA4 conversion event hooks exist.

Then run:

1. `npm test`
2. `npm run build`
3. `npm audit --audit-level=high` where network/package registry is available
4. Review git diff for accidental unrelated edits or committed secrets

## Phase 9 — Progress and deployment boundary

**Status: Implementation certified; production delivery uses the existing master-branch CI deployment workflow. Google-account actions remain external.**

Update `docs/seo/tahin-seo-progress.yaml` after every material phase.

Code completion can be certified locally. These items require external account/production access and are not to be fabricated:

- actual GA4 measurement ID,
- actual Google Search Console verification token,
- Search Console property ownership verification,
- sitemap submission inside the client's Google account,
- post-deploy field CWV metrics,
- post-deploy indexing/rich-results validation.

If deployment is explicitly requested/authorized, deploy only after tests/build/audit pass and then run production smoke/search validation. Otherwise leave a deploy-ready implementation with exact account-side checklist.
