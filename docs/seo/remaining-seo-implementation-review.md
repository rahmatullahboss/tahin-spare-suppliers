# Tahin Spare — SEO completion and release review

## Scope and safety

Continuation of the already-implemented SEO program. This change is isolated on
`task/seo-remaining-20261024` from the reviewed `origin/master` at `93e2e6e`.
The existing dirty root `master` and other agents' worktrees were left untouched.
There is no production deployment and no CMS/database mutation in this batch.

## Verified production baseline

The public, read-only `npm run seo:snapshot` crawl found:

- Homepage, robots.txt and sitemap.xml: HTTP 200.
- **185 sitemap URLs**: 116 products, 11 categories, 42 brands, 5 blogs and 11 static.
- Zero sitemap non-200 URLs, noindex URLs, missing canonicals, canonical mismatches, off-host URLs, or fetch errors.
- GA4 runtime tag **not detected**. Google and Bing HTML verification tags **not detected**.
  **Absence of an HTML meta tag does not prove a DNS-verified Search Console domain property is unverified.**
- IndexNow key URL returned 404 (expected while no actual key is configured).
- This crawl makes **no claims** about Google indexed counts, rankings, traffic, leads or Core Web Vitals.

The connected GSC Wizard service currently rejects requests with `subscription_required`.
The most recent saved Search Console performance comparison is historical, not a
current-period outcome. No CTR, ranking or lead claims were fabricated.

## Implemented in this isolated batch

1. Activate the prepared weekly crawl design at `.github/workflows/seo-monitor.yml`.
   Runs Mondays 02:00 UTC after adoption on the repository's default branch.
   Reports unhealthy crawls as failed checks, retains JSON evidence, produces a
   human-readable job summary, and has **read-only repository permissions**.
   It does not deploy, index or mutate production data.
2. Harden the monitor against off-origin sitemap URLs (never fetch them), duplicate
   sitemap URLs, empty sitemaps, homepage outages, and X-Robots-Tag noindex responses.
3. Link the **existing five evidence-based buyer guides** from directly relevant,
   stocked category pages. Empty/unrelated categories are excluded; no new thin
   AI content or new product slug is created.
4. Refresh dependency lockfile within compatible declared ranges and override the
   vulnerable Miniflare 7.x Undici dependency to the patched 7.30.1.
   Do not force a Wrangler downgrade.

## Release verification

- New targeted regression tests: 4/4 PASS.
- Full test suite: 201/201 PASS.
- Production build: PASS.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `npx wrangler deploy --dry-run`: PASS.
- Production sitemap crawl: healthy.

## External or evidence-gated items

- **GA4:** an authorized owner must provide/configure the actual Measurement ID
  and verify `generate_lead` in Realtime/DebugView after a genuine successful
  enquiry. Do not substitute click events for completed leads.
- **Search Console:** restore connected access (GSC Wizard subscription or
  authorized project OAuth) and extract comparable periods of actual query/page
  CTR and indexing data before changing commercial titles just to chase CTR.
- **Index coverage:** review actual Search Console Page Indexing and sitemap warnings.
  Do not confuse deprecated sitemap `indexed=0` data with site-wide deindexation.
- **Bing/IndexNow:** configure owner-provided tokens or keys only if authorized.
- **Content expansion:** obtain original nameplate, maker/model/part references,
  images and procurement/inspection evidence from the inventory owner before
  publishing additional articles or commercial landing pages.
- **CWV:** get mobile/desktop real-user field data from CrUX or Search Console.
- **Scheduled monitor:** workflow cannot run on schedule until it reaches the
  default GitHub branch with the required workflow-file write permission.
- **Production:** compare remote tip, review changes, gain release approval, then
  merge and deploy through the existing guarded CI route; re-run production crawl.

## Evidence-led content priority queue (historical, not current rank)

Prior saved GSC analysis flagged `/category/spare-parts`, `/category/turbocharger`,
and the IOP Marine HPU 1500, Yanmar 6HAL-HTN, Twin Disc MG521, and Reintjes
inventory pages as candidates for verification. Refresh GSC and inventory data
before editing titles, claims or canonical URLs. The existing buyer guide links
now provide an additional factual navigation route for related searches.
