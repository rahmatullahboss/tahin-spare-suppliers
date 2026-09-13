# Tahin Spare Google Search Console Live Audit — 2026-09-13

## Source and scope

- Property: `sc-domain:tahinspare.com`
- Source: connected Google Search Console API through GSC Wizard.
- Latest settled Search Console date: `2026-09-10`.
- First incomplete date: `2026-09-11`.
- No performance metric in this document is guessed or backfilled.
- Query-level privacy filtering is material: 100% of query clicks and 75.8% of query impressions are hidden for the latest 28-day range; page totals remain complete.

## Performance summary

Current 28 days (`2026-08-14` to `2026-09-10`):

| Metric | Current | Previous 28d | Change |
| --- | ---: | ---: | ---: |
| Clicks | 104 | 55 | +89.1% |
| Impressions | 591 | 717 | -17.6% |
| CTR | 17.60% | 7.67% | +9.93 pp |
| Raw aggregate average position | 19.08 | 13.00 | worse by 6.09 |

The click gain is concentrated. Homepage clicks increased from 25 to 65 while homepage impressions stayed nearly flat (145 to 143), so broad commercial visibility has not improved at the same rate.

## Commercial opportunities

- `/category/spare-parts`: 71 impressions, 1 click, 1.41% CTR, average position 4.28.
- IOP Marine HPU 1500: 50 impressions, 0 clicks, position 7.28; previous period had 4 clicks at position 4.89.
- Yanmar 6HAL-HTN generator: 29 impressions, 1 click, position 5.69.
- Yanmar NZ61/NZ62 governor URL: 13 impressions, 0 clicks, position 6.77.
- Reconditioned Yanmar 6HAL-TN: 15 impressions, 0 clicks, position 8.20.
- Twin Disc MG521: 20 impressions, 1 click, position 8.85.
- Reintjes gearbox: 9 impressions, 0 clicks, position 14.11; visible query `used reintjes marine gearboxes` is position 17.33.
- Turbocharger category: 111 impressions, 2 clicks, 1.80% CTR, position 50.40, with supplier/exporter query demand visible.

## P0 technical findings

1. `/products/connecting-rod-for-man-b-w-5l-16-24` is live 404 although URL Inspection on 2026-09-13 reported it as submitted/indexed from a 2026-09-11 crawl. The previous period produced a click and the URL still has commercial query visibility.
2. The current replacement authority is `/products/man-b-w-5l16-24-genuine-spare-parts-5l-6l`; live database technical specifications explicitly include the MAN B&W 5L16/24 connecting rod and its part number.
3. Historical `/products/cummins-vta-28-d-m-marine-engine-815hp` is 404 while `/products/cummins-vta28-dm-815hp-marine-engine` is the current exact VTA28-DM 815HP record.
4. `/products/yanmar-nz62-hydraulic-governor-for-sale` conflicts with the live record: product name, model, SEO title, focus keyword and image alt all identify NZ61. The URL identity is therefore wrong and must not be "fixed" by inventing NZ62 product facts.

## Indexing, sitemap and device evidence

- Submitted sitemap: `https://tahinspare.com/sitemap.xml`.
- GSC sitemap record: last submitted 2026-05-07, last downloaded 2026-09-05, 0 errors, 4 warnings, 149 submitted and 0 indexed in the sitemap summary.
- Current sitemap performance fetch exposed 157 URLs; 38 received Search Console impressions in the latest 28 days.
- Representative URL Inspection passed for homepage, `/category/spare-parts`, and IOP HPU 1500; robots and indexing were allowed.
- `/hydraulic-crane-equipment` correctly resolves as a redirect to `/category/hydraulic-deck-crane-equipment`.
- Therefore `0 indexed` in the sitemap summary is not evidence of site-wide deindexation; it is an inconsistent sitemap/index reporting signal that must be monitored and reconciled.
- Mobile: 65 clicks, 211 impressions, 30.81% CTR, position 8.77.
- Desktop: 39 clicks, 380 impressions, 10.26% CTR, position 24.81.
- CrUX/Core Web Vitals field data was unavailable because the connected GSC Wizard instance has no CrUX API key configured. Synthetic timings are not substituted for field CWV.

## Priority order

- P0: preserve indexed commercial URL equity with exact redirects/restoration.
- P0/P1: remove NZ61/NZ62 identity conflict without fabricating model facts.
- P1: improve CTR and intent alignment for spare-parts and high-ranking zero-click product pages.
- P1: strengthen exact model/part-number internal linking and product identity consistency.
- P1: reconcile sitemap warnings and monitor priority URLs.
- P2: structured-data eligibility only when truthful public commercial fields exist; never invent price or currency.

Implementation is tracked in `docs/superpowers/specs/2026-09-13-gsc-seo-hardening-design.md` and `docs/superpowers/plans/2026-09-13-gsc-seo-hardening-plan.md`.

## Implementation and remediation contract

- Exact legacy product authority is preserved only for verified historical misses; current product lookup remains authoritative before redirects are considered.
- `connecting-rod-for-man-b-w-5l-16-24` maps to `/products/man-b-w-5l16-24-genuine-spare-parts-5l-6l`, whose live technical specifications explicitly include the MAN B&W 5L16/24 connecting rod.
- `cummins-vta-28-d-m-marine-engine-815hp` maps to `/products/cummins-vta28-dm-815hp-marine-engine`, the current exact VTA28-DM record.
- The Yanmar governor record is first-party consistent as NZ61 across name, model and SEO fields while the current slug says NZ62. The intended canonical slug is `/products/yanmar-nz61-hydraulic-governor-for-sale`.
- The old NZ62 URL must receive an exact 301 only in the same controlled release that changes the production product slug to NZ61; the code-only hardening commit does not mutate production inventory data.
- Product identity validation now treats the model field as the authoritative comparison input and blocks conflicting slug/title/SEO model codes without inventing a conflict when no model is supplied.
- The identity guard is enforced before media upload in the admin editor and again at the authenticated product API boundary.
- Category metadata now has evidence-backed commercial overrides for Spare Parts and Turbocharger; generic categories retain a truthful supplier/exporter fallback without unsupported stock claims.
- Product Offer schema remains absent because no truthful public price/currency contract exists.
