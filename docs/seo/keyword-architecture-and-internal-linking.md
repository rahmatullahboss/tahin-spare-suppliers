# Keyword Architecture & Internal Linking Contract

## Purpose

Tahin Spare Suppliers should rank by mapping each buyer intent to one canonical page type, not by generating a page for every keyword permutation. Internal links should help buyers and crawlers move from broad marine-equipment intent to exact brand/model/part inventory and then to an RFQ.

This document is the operating contract for Phase 3 of the 2026-08-30 SEO growth plan.

## Intent ownership

### Tier A — exact commercial inventory

Examples:

- `MAN B&W 5L16 connecting rod`
- `Yanmar [model] generator`
- `[part number] marine spare part`
- `[model] gearbox for sale`

Canonical owner: individual `/products/{slug}` or `/parts/{slug}` page.

Rules:

- One real inventory entity = one canonical detail URL.
- Brand, model and part number should appear as factual HTML text when known.
- Product pages link upward to the canonical brand and category authorities.
- Dedicated part pages are reachable through `/parts` when dedicated part records exist.

### Tier B — brand + equipment/category

Examples:

- `Yanmar marine spare parts`
- `MAN B&W spare parts supplier`
- `Caterpillar marine engine supplier`

Canonical owner: `/brands/{brand}` plus the existing canonical category page.

Do not create an indexable brand × category permutation by default. The existing `/inventory/{brand}-{category}` route remains `noindex` unless a future editorial decision proves that a combination has enough real inventory and unique technical buyer value to deserve its own authority page.

### Tier C — category + supplier/exporter/location

Examples:

- `marine spare parts supplier Bangladesh`
- `marine engine supplier Chattogram`
- `used marine engine exporter`
- `marine gearbox supplier Bangladesh`

Canonical owner: `/products`, `/category/{category}`, and relevant service/company pages.

The `/products` hub prioritizes categories with live inventory rather than internally promoting empty/noindex category pages.

### Tier D — procurement/research questions

Examples:

- how to identify the correct marine engine spare part from a model or part number
- what to verify before buying a used/reconditioned marine engine
- how to interpret a marine gearbox model plate or ratio
- packing/export documentation for heavy marine machinery from Bangladesh
- what inspection evidence can be supplied before shipment

Canonical owner: first-hand `/blog/{slug}` resources.

Current production blog inventory at the 2026-08-30 Phase 3 audit: **0 published posts**. Therefore Phase 3 does not fabricate generic guide pages or fake resource links. Guides should be published only when Tahin can add genuine workshop/procurement knowledge, original examples/photos, and useful sourcing evidence.

## Live inventory authority baseline — 2026-08-30

Production audit: **88 products**.

Top category clusters:

| Category | Live products |
| --- | ---: |
| Spare Parts | 28 |
| Diesel & Gas Generator Set | 21 |
| Hydraulic Deck Crane Equipment | 12 |
| Turbocharger | 6 |
| Marine Propulsion Engine | 6 |
| Marine Gearbox | 5 |
| Auxiliary Engine | 4 |
| Marine Pump | 4 |
| Alternator | 1 |
| Navigation Equipment | 1 |

Strong real brand/category clusters include:

| Brand/category | Live products |
| --- | ---: |
| MAN B&W / Spare Parts | 13 |
| Yanmar / Diesel & Gas Generator Set | 7 |
| Yanmar / Spare Parts | 6 |
| Caterpillar / Diesel & Gas Generator Set | 5 |
| MacGregor / Hydraulic Deck Crane Equipment | 3 |
| Sulzer / Spare Parts | 3 |
| Cummins / Marine Propulsion Engine | 2 |
| Caterpillar / Marine Propulsion Engine | 2 |
| Cummins / Diesel & Gas Generator Set | 2 |
| BBC (Brown Boveri) / Turbocharger | 2 |

These clusters justify stronger links between existing brand/category/product pages. They do **not** automatically justify creating separate indexable brand × category URLs.

## Internal linking graph

### Product → authority hubs

Every indexable product page should link directly to:

- its canonical brand page when a brand exists;
- its canonical category page when a category exists;
- manually selected or same-brand/category related inventory;
- its contextual RFQ/WhatsApp action.

### Brand → live categories + inventory

Every indexable brand page should:

- show current product inventory;
- derive equipment/category links from real products only;
- show live item counts per category;
- never link to an empty brand/category permutation merely for keywords.

### Category → real brands + exact inventory

Every indexable category page should:

- list all live product cards in crawlable HTML;
- link to canonical brand authorities built from actual listed brands;
- expose a concise `Find by Model or Part Number` block linking directly to real inventory records with model/part identifiers;
- remain `noindex` when it has no live product value.

### Products hub → live categories

The primary `/products` category grid should link only to categories with live product inventory. Empty/noindex taxonomy remains available to direct users when known, but it should not consume primary internal-link authority.

If dedicated `parts` records exist, `/products` conditionally links to `/parts`.

### Parts hub → part details

`/parts` is a conditional hub:

- `noindex` when no dedicated parts exist;
- linked from `/products` only when parts exist;
- included in the XML sitemap only when parts exist;
- links to every dedicated `/parts/{slug}` record so future indexable parts cannot become sitemap-only orphans.

### Guides → commercial pages

When first-hand guides are published, each guide should link only where genuinely relevant to:

- a category hub;
- a brand hub;
- representative current inventory;
- the RFQ page.

Do not insert unrelated commercial links merely to increase link counts.

## Breadcrumb contract

Indexable product, part, brand, category, subcategory and blog-detail surfaces retain breadcrumb navigation. Breadcrumbs should mirror the real hierarchy and use canonical URLs.

## Anti-patterns prohibited

- Mass generation of brand × category × location permutations.
- Indexable pages whose only distinction is a keyword variant.
- Linking empty/noindex taxonomy from every page.
- Sitemap-only detail pages with no crawlable hub path.
- Generic AI-written procurement guides without first-party operational value.
- Keyword-stuffed anchor text repeated unnaturally across the site.
- Creating a new URL when an existing product, brand, category, service or guide already owns the intent.

## Ongoing operating procedure

1. Add a new product to one real category and one canonical brand identity.
2. Let the product become reachable through the relevant live category and brand hub automatically.
3. Add exact model/part data when verified so category exact-inventory links become useful.
4. Use a dedicated `/parts/{slug}` only for a genuine part entity that merits a distinct record.
5. Publish a guide only with first-hand procurement/technical value.
6. Before creating any new SEO landing page, confirm no existing canonical page already owns the intent.
7. Re-run internal-linking regression tests whenever route architecture changes.
