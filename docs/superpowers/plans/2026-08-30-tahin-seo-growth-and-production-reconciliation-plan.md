# Tahin Spare Suppliers — SEO Growth & Production Reconciliation Plan

**Date:** 2026-08-30
**Site:** https://tahinspare.com
**Workspace:** `/home/user/dev/tahin-spare-suppliers`
**Current branch:** `master`
**Current local SEO commit:** `f04a4b1 feat: implement buyer-intent SEO system`
**Current remote baseline:** `origin/master` at `92b5ad5`
**Primary goal:** Grow qualified organic RFQ/WhatsApp enquiries from marine buyers searching by exact brand, model, part number, equipment category, and supplier/exporter intent.

## 1. Current state and key decision

The project already has a strong buyer-intent SEO foundation locally, but the current SEO commit is one commit ahead of `origin/master` and the live site still exposes older navigation/copy in search crawls. Therefore the next SEO phase must begin with production reconciliation rather than publishing more pages.

Current local verification on 2026-08-30:

- `npm test` — **64/64 PASS**
- `npm run build` — **PASS**
- Build completed successfully; Google Fonts fetch retried during build but did not fail the build.
- Existing untracked `.ai-bridge/`, `.codexpro-cloudflared.yml`, and `.codexpro.env` are pre-existing and must not be cleaned or overwritten casually.

Installed workspace marketing/SEO skills:

- `product-marketing`
- `seo-audit`
- `site-architecture`
- `schema`
- `programmatic-seo`
- `ai-seo`
- `analytics`

Additional available capability:

- `web-perf` for Core Web Vitals and page-performance profiling.

No additional SEO skill installation is required before starting this plan.

## 2. Current official best-practice constraints

This plan follows current Google/Bing guidance rather than older SEO folklore.

### Google Search / AI Search

- Core SEO fundamentals remain the foundation for Google AI Overviews and AI Mode; there is no special schema or AI text file required to appear.
- Prioritize unique, non-commodity, people-first content based on real experience and first-party facts.
- Do not create many near-identical pages just to cover every query/fan-out variation.
- Important content must be crawlable, internally linked, available as text, and supported by useful images/video where relevant.
- Structured data must match visible page content.

Official references:

- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content

### Sitemap

Google currently ignores sitemap `<priority>` and `<changefreq>`. `<lastmod>` is useful only when it is consistently and verifiably accurate.

Reference:

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

### Structured data

- Organization/WebSite entity markup should be concentrated on the homepage (or a single organization/about page where appropriate), not emitted redundantly on every page.
- Product snippet eligibility requires genuine `offers`, `review`, or `aggregateRating` data. Tahin is quote-based, so never fabricate an Offer/price merely for a rich result.
- FAQ rich results were deprecated in Google Search on 2026-05-07. Visible FAQs can remain if useful to buyers, but FAQPage JSON-LD should not be treated as an SEO growth lever.

References:

- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- https://developers.google.com/search/updates

### Core Web Vitals

Use real-user/field data and target the 75th percentile:

- LCP <= 2.5 s
- INP <= 200 ms
- CLS <= 0.1

Reference:

- https://web.dev/articles/vitals

### Bing / Copilot freshness

For fast-changing inventory, add Bing Webmaster Tools and evaluate IndexNow so new, updated, sold, or removed inventory URLs are signaled quickly. Sitemap and crawlable internal links remain required foundations.

Reference:

- https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a

---

# Execution plan

## Phase 0 — Production reconciliation and release gate (P0 / blocking)

### Objective

Make sure the already-completed buyer-intent SEO system is actually the production baseline before adding new SEO surface area.

### Work

1. Preserve all existing unknown/untracked files; do not reset, clean, or stash blindly.
2. Review `f04a4b1` against `origin/master` for accidental unrelated changes/secrets.
3. Resolve the previously documented GitHub/Cloudflare write/deploy credential blocker using an authorized route only.
4. Push/deploy through the existing CI/release path once credentials are available.
5. Post-deploy verify representative URLs:
   - `/`
   - `/products`
   - `/brands`
   - `/category/marine-propulsion-engine`
   - `/category/spare-parts`
   - one live product
   - one part
   - one blog post
   - one missing dynamic URL returning true 404
6. Verify that the production header uses buyer-oriented navigation and that the corrected truthful category condition copy is live.
7. Run production smoke and inspect any intermittent 5xx before continuing SEO expansion.

### Additional local copy cleanup before/with release

The local SEO commit still contains legacy wording in two visible areas:

- homepage: `Our Sell Equipments`
- footer: `Sell Equipments`

Replace with natural buyer-facing wording such as `Marine Equipment & Spare Parts` / `Products & Inventory`.

### Acceptance gate

Do not start mass content/pSEO work until local, `origin/master`, and production behavior are reconciled and the live site reflects the intended SEO baseline.

---

## Phase 1 — Technical indexation and structured-data hardening (P0/P1)

### 1.1 Sitemap truthfulness

Refactor `src/pages/sitemap.xml.ts`:

- Remove `<priority>` and `<changefreq>` because Google ignores them.
- Stop assigning today's date as fallback `lastmod` to pages that did not actually change.
- Emit `lastmod` only from real content/category/brand modification data when trustworthy.
- Include only canonical, indexable, useful URLs.
- Remove redirected, noindex, empty/thin, or duplicate routes from sitemap output.

### 1.2 Empty/thin taxonomy policy

Current production exposes category pages that can have no products but still render generic templated content. Define an explicit indexability contract:

A taxonomy page may be indexable only if it has meaningful unique buyer value, such as:

- live inventory, or
- substantial category-specific technical/procurement content with a real commercial purpose.

Short-term:

- `noindex` and omit empty/thin categories from sitemap.

Long-term:

- make valuable strategic categories genuinely useful, then return them to the index.

### 1.3 Entity schema scope

Refactor layout/entity schema:

- Render `WebSite` site-name markup on the homepage only.
- Render primary `Organization` / appropriate business entity markup on homepage (or one canonical organization page) rather than every route.
- Keep only demonstrably accurate fields.
- Remove subjective/unsupported `priceRange: "$$$"` for this quote-based B2B model unless the business can define and display a truthful range.
- Confirm all NAP/contact details match visible site data and external business profiles.

### 1.4 FAQ cleanup

- Keep visible FAQs only where they help actual buyers.
- Remove FAQPage JSON-LD dependency/tests as an SEO-rich-result requirement because Google deprecated FAQ rich results.
- Replace generic templated FAQ answers with category-specific factual answers where FAQs remain.

### 1.5 Product schema policy

- Keep truthful Product identity data: product name, brand, model, MPN/SKU, image, condition where known.
- Never fabricate price, currency, availability, reviews, or ratings.
- Treat Product JSON-LD as entity/semantic markup unless genuine Offer/review data later makes a page eligible for richer product results.
- Validate representative pages with Rich Results Test and schema.org validator.

### 1.6 Legacy route consolidation

Audit all old static equipment routes such as marine gearbox/auxiliary/pump pages:

- If a legacy route and dynamic category serve the same intent, prefer a clean 301 to the canonical authority when safe.
- Otherwise ensure canonical, visible copy, internal links, and indexability are consistent.
- Remove unsupported blanket claims from accessible legacy pages even when they are canonicalized elsewhere.

---

## Phase 2 — Inventory data quality and freshness (P0/P1)

For this site, inventory quality is SEO content quality. Exact model/part-number queries will only scale if the underlying data is normalized and fresh.

### 2.1 Brand/model normalization

Audit and canonicalize brand names and common variants/typos, including patterns such as:

- Yanmar vs misspellings
- MAN B&W naming variants
- Caterpillar vs CAT
- Daihatsu misspellings
- Wärtsilä/Wartsila normalization

Use a canonical brand identity for URL generation and structured data while preserving correct model/OEM display where needed.

### 2.2 Product naming quality

Remove internal/editorial noise from public product titles, such as update markers, temporary labels, duplicated keywords, or inconsistent capitalization.

Preferred title composition:

`[Brand] [Model] [Product/Part Type] [meaningful condition/commercial modifier]`

Only include `for sale`, `used`, `reconditioned`, etc. when true and useful.

### 2.3 Stock freshness contract

Add/standardize:

- availability state
- availability verified date
- condition verified date where relevant
- last content update

Define a stale-stock policy. Example implementation rule (business-configurable, not a Google rule): when a `Verified in Stock` claim has not been reconfirmed within the chosen operational window, automatically downgrade the public copy to `Contact to confirm current availability` until staff re-verifies it.

Do not allow months-old `Verified in Stock` labels to remain indefinitely.

### 2.4 Evidence-rich product pages

For high-value inventory, make real first-party evidence visible:

- multiple original product photos
- nameplate/model plate photo when available
- technical specifications
- measured dimensions/power/RPM/ratio where relevant
- condition/inspection notes
- what was actually tested/reconditioned
- application/compatibility notes when verified
- location
- packing/shipping evidence where available
- clear quote path

This creates non-commodity content that competitors and generic AI-generated pages cannot easily reproduce.

---

## Phase 3 — Keyword architecture and internal linking (P1)

Do not create one page for every keyword permutation. Map each search intent to one canonical page type.

### Intent tier A — Exact commercial inventory

Examples:

- `[brand] [model] marine engine`
- `[brand] [part number] spare part`
- `[model] gearbox for sale`

Target: individual product/part pages.

### Intent tier B — Brand + equipment/category

Examples:

- `Yanmar marine spare parts`
- `MAN B&W spare parts supplier`
- `Caterpillar marine engine supplier`

Target: existing brand/category architecture first. Create dedicated brand × category pages only when each page has enough real inventory and/or unique technical buyer value to stand on its own.

Do not auto-generate thousands of combinations.

### Intent tier C — Category + supplier/exporter/location

Examples:

- `marine spare parts supplier Bangladesh`
- `marine engine supplier Chattogram`
- `used marine engine exporter`
- `marine gearbox supplier Bangladesh`

Target: core category/service/hub pages.

### Intent tier D — Procurement/research questions

Create expert resource content around real sourcing knowledge, for example:

- how to identify the correct marine engine spare part from model/part number
- what buyers should verify before purchasing a used/reconditioned marine engine
- interpreting marine gearbox ratios and model plates
- packing/export documentation for heavy marine machinery from Bangladesh
- what inspection evidence Tahin can provide before shipment

These should use first-hand workshop/procurement knowledge, photos, real examples, and sources—not generic SEO articles.

### Internal linking

Build hub-and-spoke relationships:

- product -> brand + category + related parts
- category -> high-value brands/models + relevant guide
- brand -> live categories + current inventory
- guides -> relevant category/product/RFQ pages
- breadcrumbs on all indexable detail/taxonomy pages

No orphan indexable pages.

---

## Phase 4 — Core landing-page and conversion optimization (P1)

### Homepage

Make the homepage immediately explain:

1. what Tahin supplies,
2. where it operates from,
3. which buyers it serves,
4. what proof exists,
5. how to request a quote.

Replace unsupported superlatives such as `largest inventory` unless documentary proof exists.

### Category pages

Each priority category should have unique content that answers buyer questions:

- what is currently supplied
- common brands/models
- what conditions may be available
- which technical details buyers should send
- inspection/reconditioning scope when applicable
- export/packing process
- related inventory

Avoid identical templated paragraphs/FAQs across categories.

### Product pages

Keep title/H1/model/part number aligned. Put the decisive buyer facts near the top and make the RFQ CTA obvious on mobile.

### Enquiry conversion

Preserve product/brand context into RFQ, and measure successful enquiry rather than only clicks.

---

## Phase 5 — Trust, entity and authority signals (P1/P2)

Strengthen verifiable business credibility rather than adding marketing adjectives.

- Consistent company name, address, phone, email, founding information.
- Google Business Profile: claim/verify and keep NAP/photos/categories/hours accurate if not already complete.
- Bing Places/Webmaster setup where applicable.
- Real workshop/warehouse/team imagery.
- Explain the actual inspection/reconditioning workflow.
- Publish only certifications, tests, country coverage, customer counts, shipment numbers, or experience claims that can be substantiated.
- Add privacy/terms/business information pages where missing and commercially appropriate.
- Earn mentions/links from relevant marine industry directories, suppliers, associations, customers/partners, and shipping/industrial sources through legitimate relationships—not bulk link schemes.

---

## Phase 6 — Google AI Search / AI discoverability (P2)

Treat AI visibility as an outcome of strong Search + unique first-party information, not a separate hack.

### Do

- Keep important facts in visible text.
- Use clear headings, spec tables, concise factual paragraphs, descriptive image captions/ALT.
- Publish original inspection/procurement expertise and real inventory evidence.
- Maintain accurate structured data.
- Keep pages fast, crawlable, indexable, and internally linked.
- Review Search Console's generative-AI reporting when the property is eligible/available.

### Do not prioritize

- creating duplicate AI-only articles
- page-per-query fan-out spam
- `llms.txt` as a Google ranking tactic
- keyword stuffing
- fabricated citations/reviews/statistics

Google's 2026 guidance explicitly favors foundational SEO and unique non-commodity content over AEO/GEO gimmicks.

---

## Phase 7 — Search Console, GA4, Bing and measurement (P0/P1)

Complete the external account-side steps already documented in `docs/seo/google-search-setup-checklist.md`.

### Google Search Console

- verify Domain property if DNS access is available
- submit canonical sitemap
- inspect representative product/category/brand/blog URLs
- monitor Pages/Indexing, Core Web Vitals, structured-data issues, manual actions
- record current query/page baseline before large content changes
- use generative-AI performance reporting if/when available for this property

### GA4

- configure real `G-...` ID
- verify events in DebugView/Realtime
- mark `generate_lead` as the primary key event
- keep RFQ/WhatsApp clicks as supporting funnel events
- report landing page + source/medium + page type + lead conversion

### Bing

- verify Bing Webmaster Tools
- submit sitemap
- implement/test IndexNow for inventory create/update/delete/sold-state changes if operationally useful

### North-star KPIs

Prioritize business outcomes over vanity traffic:

1. qualified organic RFQ/enquiry leads
2. organic WhatsApp product enquiries
3. conversion rate from organic landing pages
4. clicks/impressions for exact model/part-number queries
5. useful indexed inventory coverage
6. CTR for high-impression commercial pages
7. stale/incorrect inventory rate
8. Core Web Vitals pass rate

---

## Phase 8 — Performance and crawl efficiency (P1/P2)

Use `web-perf`/Chrome profiling on:

- homepage
- a heavy category page
- a product detail page
- enquiry page

Require field targets at p75:

- LCP <= 2.5s
- INP <= 200ms
- CLS <= 0.1

Specific architecture review:

- Category routes currently can render up to 1,000 product cards in the HTML and paginate client-side. If inventory grows materially, move to crawlable/server-side pagination or a bounded initial result set with crawlable next-page URLs.
- Continue explicit image dimensions, responsive images, modern formats and lazy loading below the fold.
- Keep primary product image high priority only when it is the likely LCP element.

---

## Phase 9 — 90-day growth cadence

### Days 1–7

- reconcile/push/deploy `f04a4b1`
- fix remaining `Sell Equipments` copy
- production smoke + canonical/404/schema checks
- connect/verify Search Console + GA4 + Bing where credentials are available
- capture baseline metrics

### Days 8–21

- sitemap truthfulness refactor
- FAQPage markup cleanup
- entity schema scope cleanup
- empty/thin taxonomy noindex/sitemap exclusion
- legacy route consolidation
- brand/model normalization audit
- stale availability audit

### Days 22–45

- optimize the top commercial product pages using real first-party data/photos
- deepen the 4–6 highest-value category pages
- clean titles/slugs/brand entities without breaking indexed URLs; use redirects when a URL must change
- strengthen internal linking between product/category/brand/resource pages

### Days 46–90

- use Search Console query/impression data to choose the next pages instead of guessing
- selectively launch high-value brand × category landing pages only where unique value exists
- publish a small set of expert, evidence-rich procurement guides
- earn legitimate marine-industry mentions/links
- iterate titles/meta for high-impression low-CTR pages
- review lead conversion and CWV monthly

---

# Release and quality gates

Every SEO code batch must pass:

1. focused tests for the changed SEO contract
2. full `npm test`
3. `npm run build`
4. dependency/security gate used by the repo
5. Wrangler dry-run/release validation where applicable
6. `git diff --check`
7. adversarial review for fabricated claims, fake prices/stock, duplicate pages, accidental noindex/canonical regressions, and secrets
8. post-deploy production smoke
9. representative Search Console URL Inspection / Rich Results validation where relevant

# Definition of success

This initiative is successful when:

- the local buyer-intent SEO baseline is actually deployed to production;
- sitemap dates and indexability signals are truthful;
- empty/thin/duplicate taxonomy pages do not consume indexation unnecessarily;
- Organization/WebSite/Product structured data is accurate and not fabricated;
- public stock/condition claims have an operational freshness policy;
- brand/model/part-number data is normalized enough to produce stable canonical URLs;
- high-value pages contain first-party technical evidence rather than generic SEO filler;
- Search Console/GA4/Bing measurement is live;
- qualified organic enquiries rise while indexing quality, CTR, and CWV are monitored continuously.
