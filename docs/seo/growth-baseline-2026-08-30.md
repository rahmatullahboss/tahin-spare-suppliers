# Tahin Spare Suppliers — SEO Growth Baseline — 2026-08-30

## Evidence boundary

This baseline records only values directly verified from the production site or existing production certification. Search Console, GA4, Bing and external authority metrics are **Not available** until authorized account data is configured and reviewed. No ranking, impression, click, lead, backlink, customer, revenue or field Core Web Vitals value is estimated.

## Automated production crawl baseline

Snapshot command:

`npm run seo:snapshot -- --output <artifact-path>`

Snapshot generated: `2026-08-30T10:32:14.691Z`

| Metric | Baseline |
| --- | ---: |
| Homepage HTTP status | 200 |
| Robots HTTP status | 200 |
| Sitemap HTTP status | 200 |
| Sitemap canonical URL count | 149 |
| Product URLs in sitemap | 88 |
| Category URLs in sitemap | 10 |
| Brand URLs in sitemap | 40 |
| Static URLs in sitemap | 11 |
| Sitemap URLs returning non-200 | 0 |
| Sitemap URLs containing noindex | 0 |
| Sitemap canonical mismatches | 0 |
| Sitemap pages missing canonical | 0 |
| Sitemap URLs on non-canonical host | 0 |
| Sitemap fetch errors | 0 |
| IndexNow key endpoint | 404 — intentionally disabled/unconfigured |

The snapshot result was `healthy: true`.

## Search/measurement account baseline

| Source / metric | Baseline | Reason |
| --- | --- | --- |
| GA4 runtime Measurement ID | Not available | No authorized real `G-...` value configured yet. |
| Qualified organic RFQ/enquiry leads | Not available | Requires real GA4 attribution/reporting. |
| Organic WhatsApp product enquiries | Not available | Requires real GA4 organic-session attribution. |
| Organic landing-page conversion rate | Not available | Requires real GA4 sessions and qualified conversions. |
| Google Search Console property | Not available | External verification/account action pending. |
| Google sitemap submission state | Not available | External Search Console action pending. |
| Exact model/part-number clicks/impressions | Not available | Requires real Search Console query data. |
| Useful Google indexed inventory coverage | Not available | Production sitemap/crawl health is known, but Google indexation requires Search Console evidence. |
| High-impression commercial CTR | Not available | Requires real Search Console data. |
| Bing Webmaster property | Not available | External verification/account action pending. |
| Bing sitemap/index coverage | Not available | Requires real Bing Webmaster data. |
| Field Core Web Vitals pass rate | Not available | Requires Search Console/CrUX field data; synthetic timings are not substituted. |
| Google Business Profile state | Not available | External business-profile verification action. |
| Bing Places state | Not available | External business-profile verification action. |
| Legitimate industry mentions/backlinks | Not available | Must be evidenced from real external sources; none are invented here. |

## Production system baseline already certified

- Phase 8 implementation commit: `90016ac`.
- Phase 8 CI/CD run: `33306359684` — Verify, credential gate, deployment and production smoke passed.
- Phase 8 implementation Worker: `beed305e-e598-437a-a93a-d2739fa204c4`; the subsequent Phase 8 documentation-only CI deployment moved identical application code to Worker `56cf2211-aa1f-4101-a7a7-7e810b621322`, which was at 100% traffic when this baseline was captured.
- Inventory freshness, canonical brand normalization, truthful sitemap, Product structured data, buyer-facing guidance and unvalidated brand × category noindex/404 protections remain governed by regression tests.

## First comparison rule

The next report must compare like-for-like periods from the same external data source. If an external account becomes available after this baseline date, record its first verified export as the account baseline rather than backfilling or estimating earlier values.
