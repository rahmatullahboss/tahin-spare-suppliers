# Tahin Spare Suppliers Buyer-Intent SEO Design

**Date:** 2026-08-16
**Status:** Approved by client requirements / implementation in progress
**Primary goal:** Make real Tahin Spare inventory discoverable for exact marine engine, generator, equipment, model and part-number searches, then convert qualified visitors into RFQ/WhatsApp enquiries.

## 1. Business and search intent

Primary buyers are Ship Owners, Technical Superintendents, Fleet Managers, Procurement/Purchasing Managers, Marine Engineers, Chief Engineers, Technical Managers, and Ship Management Companies.

Priority search intent includes:

- marine engine for sale
- used marine engine for sale
- reconditioned marine engine
- marine diesel engine supplier
- marine engine supplier Bangladesh
- marine engine exporter
- marine spare parts supplier
- ship spare parts supplier
- marine engine spare parts
- marine equipment supplier Bangladesh
- exact brand + model searches, for example `Cummins VTA-28 Marine Engine`
- exact part-number searches

The SEO system must optimize for useful, buyer-specific inventory pages rather than doorway pages or pages produced only by replacing keywords.

## 2. Current-state findings

### Already present

- Astro server-rendered site on Cloudflare.
- HTTPS production origin at `https://tahinspare.com`.
- `robots.txt` with sitemap reference and admin/API exclusions.
- Dynamic `sitemap.xml.ts` route.
- Self-referencing canonical support in `MainLayout.astro`.
- Organization/WebSite JSON-LD in the main layout.
- Dedicated public product pages under `/products/{slug}`.
- Dynamic category/subcategory routes.
- Existing brand-category inventory routes.
- Product images, RFQ flow, WhatsApp floating contact, blog, and CMS/admin.
- Several category and individual inventory URLs are already discoverable/indexed in Google.

### Critical gaps

1. Product CMS does not persist Part Number, Condition, Availability, Location, Technical Specifications, Application, SEO Title, Meta Description, Focus Keyword, Image ALT, or manual Related Products.
2. Product pages therefore cannot expose the client's complete structured inventory contract.
3. Current Product JSON-LD advertises an artificial USD price of `0` plus hard-coded `InStock`/`UsedCondition`; schema must not state facts that are not supplied by the product record.
4. Condition and availability are hard-coded in visible HTML, which can become stale or inaccurate.
5. Repository `ContentType` does not currently include `parts`, while parts routes and sitemap call it. This can make sitemap dynamic collection fail as a group.
6. Sitemap collection currently uses normal paginated limits instead of a complete inventory export.
7. Missing hero asset references (`/images/services-hero.jpg`, `/images/hero-bg.webp`) create broken-resource/build warnings.
8. No repository configuration exists for Google Analytics 4 measurement ID or Google Search Console verification token.
9. Missing product/blog slugs redirect to index pages rather than returning a true 404, creating soft-404 risk.
10. Header information architecture still uses the generic label `Sell Equipments` instead of buyer-oriented inventory navigation.
11. No first-class Brands hub or brand-level browse route.
12. Product/category/blog pages lack consistent BreadcrumbList structured data.

## 3. Design principles

### Stable URLs first

Existing indexed `/products/{slug}` URLs remain canonical. We will not force a high-risk URL migration only to imitate the example `/marine-engines/...` path. Category, subcategory, Brands and breadcrumbs establish the requested hierarchy while preserving accumulated URL signals and external links.

### One inventory fact owner

Product facts are persisted once in the product record and reused by:

- visible product specifications,
- title/meta generation,
- image ALT,
- Product JSON-LD,
- related-product selection,
- internal linking.

No schema-only stock, condition or price claim may exist without matching visible/product data.

### Manual override + safe automation

SEO fields support manual editing, but empty fields receive deterministic defaults:

- SEO title: `{Product Name} for Sale | Tahin Spare Suppliers`
- focus keyword: product name
- meta description: product-name-led buyer copy mentioning Tahin Spare Suppliers, Bangladesh, specifications/availability and worldwide shipping
- image ALT: descriptive product name + model/part number where available
- slug: existing slugify behavior from product name or explicit override

Automation is a baseline, not a license to create duplicate/thin content. Product Description, Technical Specifications, Application, real photos and exact identifiers remain product-specific inputs.

### Truthful schema

Product JSON-LD contains only available facts. Because Tahin Spare is quote-based and does not publish a real product price, the implementation must not invent an `Offer` price. Product schema will include Product identity, brand, model, part number/MPN, image, description, category, condition where safely mappable, and additional properties such as availability/location/application when present.

BreadcrumbList schema will reflect visible navigation. Blog posts receive BlogPosting schema when the stored data supports it.

## 4. Product data contract

Additive product columns, safe for existing records:

| Field | Storage | Default/fallback |
|---|---|---|
| `part_number` | text | empty |
| `condition` | text | `Contact for condition` when absent at render time |
| `availability` | text | `Contact for current availability` when absent |
| `location` | text | `Chattogram, Bangladesh` when absent |
| `technical_specifications` | text | empty |
| `application` | text | empty |
| `seo_title` | text | generated |
| `meta_description` | text | generated |
| `focus_keyword` | text | generated |
| `image_alt` | text | generated |
| `related_products` | text/JSON array of product slugs | empty, then contextual fallback |

Existing category, subcategory, brand and `model_number` remain authoritative.

## 5. Public page information architecture

```text
Home
├── Marine Engines
│   ├── Marine Propulsion Engine
│   └── Auxiliary Engine
├── Marine Generators / Gensets
├── Marine Spare Parts
├── Deck Crane / Hydraulic Equipment
├── Brands
│   └── Brand inventory pages
├── Marine Industry Blog / Resources
├── Contact
└── Request a Quote

Category
└── Sub-category (when configured)
    └── Individual Product
```

Every individual product remains a distinct indexable HTML page. Product/model/part-number values must be HTML text, never only pixels inside an image.

## 6. Internal linking

- Main navigation links to high-value commercial hubs.
- Category pages link to subcategories, product pages and brand inventory.
- Brand pages link to relevant product pages.
- Product pages link back through breadcrumbs and to explicitly related products; contextual same-brand/category fallback is allowed.
- Blog/resource content should link to relevant commercial category/product pages when editorially useful.
- Sitemap contains canonical indexable hubs and inventory pages only.

## 7. Technical SEO contract

### Crawl/index

- `robots.txt` allows public content and blocks admin/API paths.
- XML sitemap contains complete canonical inventory, categories/subcategories, brands and blog URLs.
- Every public page gets an absolute HTTPS canonical.
- Missing dynamic entities return HTTP 404 rather than redirecting as soft 404s.
- Duplicate legacy category pages are not promoted in sitemap; canonical consolidation is preferred without breaking inbound URLs.

### Core Web Vitals / mobile

Code-level targets:

- avoid broken render-blocking assets,
- specify image dimensions/aspect ratios where possible,
- lazy-load below-the-fold images,
- prioritize the primary product image,
- keep mobile controls and product layouts responsive,
- avoid unnecessary client JavaScript.

Field performance must still be monitored after deployment through Search Console/PageSpeed because real-user CWV cannot be certified from source code alone.

### Analytics and Search Console

Support optional runtime environment values:

- `GOOGLE_ANALYTICS_ID` — GA4 web stream measurement ID (`G-...`)
- `GOOGLE_SITE_VERIFICATION` — Search Console HTML meta verification token

When values are absent the site remains functional and emits no fake tracking identifier. Creating/owning the Google properties and submitting the sitemap require the client's Google account access and are deployment/account actions, not values to invent in source control.

## 8. Schema graph

- Site-wide: WebSite + Organization/LocalBusiness.
- Product: Product + BreadcrumbList.
- Category/brand: BreadcrumbList and normal semantic HTML; no unsupported fake product offers.
- Blog detail: BlogPosting + BreadcrumbList.
- FAQ schema only where the questions/answers are visibly present and factually accurate.

## 9. Content quality and AI-search readiness

Pages should answer exact procurement questions using extractable HTML:

- What is the item?
- Brand/model/part number?
- Condition?
- Current availability wording?
- Location?
- Technical specifications?
- Application?
- How to request a quote?
- Is worldwide shipping/export available?

Do not generate hundreds of near-identical model pages without real inventory facts. Real product photos and unique technical descriptions are the strongest future CMS inputs for both traditional search and AI retrieval.

## 10. Acceptance criteria

Implementation is complete when:

1. All requested product/CMS SEO fields persist through DB → API → admin → public page.
2. Empty SEO fields receive editable defaults.
3. The Cummins example pattern can be represented without source-code changes.
4. Product schema contains no fabricated price/stock facts.
5. Breadcrumbs and BreadcrumbList exist on product/category/brand/blog detail routes.
6. Brands hub and brand pages exist and link to inventory.
7. Sitemap can enumerate all products/parts/blog/category/subcategory/brand canonical URLs and no longer fails on `parts`.
8. Missing dynamic records respond as 404.
9. Broken hero asset references are eliminated.
10. GA4/GSC hooks are implemented with environment-backed configuration.
11. Buyer-intent main navigation and a buyer-focused `/products` hub are implemented.
12. Product/brand RFQ context reaches the enquiry form and successful enquiries/WhatsApp/RFQ clicks have GA4 event hooks.
13. Automated tests cover the SEO data contract and high-risk source invariants.
14. `npm test` and `npm run build` pass without the previous missing-hero warnings.
15. Progress YAML records all completed work and clearly separates code-complete work from external Google-account/deployment credentials.
