# GSC-Driven SEO Hardening Design

## Goal

Convert the 2026-09-13 live Google Search Console findings into durable code and content safeguards without fabricating inventory, ranking, pricing, or indexing facts.

## Scope

This change covers four bounded concerns:

1. Preserve historical product URL authority through an explicit legacy-product redirect registry.
2. Prevent product slug/model/title identity conflicts from being silently saved in the admin CMS.
3. Improve buyer-intent metadata for selected high-opportunity category/product surfaces using truthful existing fields.
4. Record GSC evidence, sitemap/indexing limitations, and post-release verification steps.

It does not create fake public prices, alter inventory availability, mutate Search Console metrics, or add schema claims that cannot be supported by first-party data.

## URL authority design

A small pure SEO helper owns historical product-slug redirects. Product detail resolution checks the current product first. Only when that lookup misses does it consult the allowlisted legacy mapping and issue a permanent 301 to a known canonical replacement.

Initial evidence-backed mappings:

- `connecting-rod-for-man-b-w-5l-16-24` -> `man-b-w-5l16-24-genuine-spare-parts-5l-6l`
- `cummins-vta-28-d-m-marine-engine-815hp` -> `cummins-vta28-dm-815hp-marine-engine`

## Product identity guard

Product identity is derived from the visible title, model number and slug. The guard is deliberately conservative: when a model token such as `NZ61` appears consistently in title/model but the slug contains a conflicting sibling token such as `nz62`, the CMS must stop save and tell the operator to correct the slug or product facts.

The guard must not infer which model is true. For the current Yanmar record, first-party database fields consistently say NZ61, so the canonical URL should become an NZ61 slug and the old NZ62 path should permanently redirect to it when the record is renamed.

The validation helper is pure and unit-testable. The browser editor calls it before uploads/network save so a bad identity cannot create unnecessary media writes.

## Search snippet design

Existing SEO defaults remain truthful and buyer-oriented. Selected category pages may supply explicit metadata overrides where GSC shows a clear intent opportunity, while keeping category content driven by real inventory.

`Spare Parts` should explicitly target marine-engine/spare-parts supplier intent. Turbocharger copy may target supplier/exporter intent only through current inventory and existing category language; it must not name brands/models that are not actually listed.

Product metadata should keep exact product/model text first, followed by a commercial modifier such as `for Sale` only when the source title already supports that product identity. Current 70-character generator behavior remains bounded; no keyword stuffing is added.

## Indexing and structured data

Search Console sitemap `0 indexed` is treated as inconsistent reporting, not proof of deindexation, because representative URL Inspection passes and 38 sitemap URLs have GSC impressions. No code change will pretend to fix this number.

Product `Offer` schema remains absent unless real public price and currency are available. The existing truthful Product schema is retained.

## Verification contract

Every behavior change is test-first. Required regression evidence:

- Redirect helper returns only allowlisted canonical paths and ignores unknown/current slugs.
- Product route checks a missing slug against the redirect helper before returning 404.
- Identity validation flags NZ61/NZ62-style conflicts but accepts equivalent punctuation variants such as `VTA-28` and `vta28`.
- CMS runs identity validation before image upload or content save.
- Category metadata override remains limited to evidence-backed categories and falls back to the existing generic pattern.
- Existing truthful schema test continues to prove that fake `offers`/price data is absent.
- Full `npm test`, `npm run build`, and `npm run seo:snapshot` must pass before completion.

## Release verification

After deployment, verify the two historical product URLs return 301 to exact canonical replacements, inspect the renamed Yanmar URL if changed, resubmit/review the sitemap in GSC, and compare the next settled 28-day window against this audit. Search Console query privacy filtering must remain an explicit limitation in reporting.
