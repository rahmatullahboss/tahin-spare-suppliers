# Tahin Spare Suppliers — 90-Day SEO Growth Cadence

## Purpose

This operating system turns the production SEO foundation into a repeatable 90-day growth process. It prioritizes qualified buyer enquiries and useful indexed inventory over vanity traffic. It must never invent rankings, impressions, clicks, leads, reviews, backlinks, stock, shipment counts, prices, certifications or revenue.

External platform data is used only when an authorized account is connected and the metric can be exported or viewed directly. If Search Console, GA4 or Bing data is unavailable, record it as **Not available** and continue the code-controlled inventory, crawl and content-quality work.

## Owner roles

- **SEO operator** — owns Search Console/Bing review, query/page opportunity triage, reporting and indexing-anomaly follow-up.
- **Inventory owner** — owns stock/condition verification evidence, stale-listing decisions and product-record accuracy.
- **Content operator** — owns first-party product/category enrichment, procurement guidance and internal-link maintenance.
- **Developer** — owns automated crawl monitoring, technical regression gates, performance/crawl fixes and production verification.
- **Business owner** — owns commercial priority, legitimate external profiles/mentions, and approval of evidence-backed authority work.

## Operating cadence

| Frequency | Owner (role) | Action | Evidence / output | Escalation trigger |
| --- | --- | --- | --- | --- |
| Weekly | SEO operator | Search Console query/page review: compare commercial queries, landing pages, impressions, clicks, CTR and indexing signals when authorized data is available. | Weekly growth report with source/date. | New indexing loss, sharp page/query decline, or high-impression commercial page with materially weak CTR. |
| Weekly | SEO operator | GA4 lead/conversion review: review successful `generate_lead`, RFQ click and WhatsApp supporting events for organic sessions when GA4 is configured. | Lead/conversion section in weekly report. | Tracking disappears, successful forms are not measured, or organic landing pages receive traffic but no measurable conversion path. |
| Weekly | SEO operator | Bing Webmaster review: inspect search performance, crawl/index coverage and sitemap state when account access exists. | Bing section in weekly report. | Sitemap/crawl errors, unexpected deindexing or material query opportunity. |
| Weekly | Developer | Run `npm run seo:snapshot`; once the prepared GitHub workflow template is installed, review its artifact for sitemap URL count, non-200 URLs, noindex-in-sitemap, canonical mismatch and measurement-hook state. Until then, run the same command manually each week. | `seo-growth-snapshot.json`. | Any sitemap URL is non-200, noindex, off-host, or canonically mismatched. |
| Weekly | Inventory owner | Inventory freshness review, prioritizing positive availability claims and high-value/high-impression products first. Reverify evidence or downgrade the public availability state according to the freshness policy. | Updated product verification dates/evidence or explicit downgrade. | Positive stock evidence is stale/missing, item is sold/reserved, or condition changed. |
| Weekly | Content operator | Enrich priority product/category pages only with first-party technical/procurement evidence: nameplate data, model/part references, verified condition/availability, application, dimensions/specifications, packing or inspection evidence when actually available. | Evidence-backed page update. | Required evidence is missing or would force generic/unsupported copy. |
| Weekly | Content operator | Internal-link maintenance: ensure updated product pages link to canonical brand/category authorities and priority hubs expose real current inventory, models or part numbers. | Link review recorded in weekly report. | Orphaned indexable page, stale taxonomy link, or link to an empty/noindex surface. |
| Weekly | SEO operator + Developer | Indexing anomaly check: compare intended sitemap URLs with Search Console/Bing coverage when available and the automated production crawl snapshot. | Anomaly log with affected URL, source and action. | Sitemap URL missing from index for a sustained period, indexed URL is no longer intended, or crawler/search-engine signals disagree. |
| Monthly | Developer | Technical regression: run full tests, production build, dependency audit, Wrangler dry-run, production crawl snapshot and representative custom-domain smoke. | Monthly technical checkpoint. | Any release gate fails, crawl output changes unexpectedly, schema bootstrap batching regresses, or indexability/canonical contract changes. |
| Monthly | SEO operator + Content operator | Commercial-page review: rank candidate pages by real impressions/clicks/leads, inventory value and evidence availability; improve only the highest justified opportunities. | Prioritized page queue with reason/source. | Proposed work depends on guessed search volume or duplicated keyword permutations. |
| Monthly | SEO operator | Core Web Vitals review from Search Console/CrUX when available. Use field p75 targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1. | CWV section with field source and date. | Any priority template fails field CWV or materially regresses. |
| Monthly | Inventory owner + Content operator | Stale/deleted inventory handling: sold/unavailable items get truthful terminal state or removal strategy; deleted URLs must not remain in sitemap and should return the intended status/redirect. | Inventory cleanup list and resulting URL behavior. | Deleted/sold item remains positively advertised, sitemap contains dead URL, or redirect points to unrelated content. |
| Quarterly | Business owner + SEO operator | Authority/entity review: Google Business Profile, Bing Places, organization/NAP consistency and legitimate marine-industry mentions/links. | Verified external profile/mention inventory. | Incorrect business identity, lost profile verification, spam/fake-link proposal, or unsupported claim. |
| Quarterly | Business owner + SEO operator + Developer | 90-day retrospective: review KPI evidence, production health, winning/losing pages, inventory accuracy and next-quarter priorities. | Signed-off next 90-day backlog. | Strategy is being driven by vanity metrics instead of qualified buyer outcomes. |

### GitHub monitor activation boundary

The ready-to-enable workflow template is `docs/seo/seo-monitor.github-actions.yml`. Installing it as `.github/workflows/seo-monitor.yml` requires a GitHub credential that is allowed to create/update Actions workflow files. The currently available HTTPS OAuth credential lacks the required `workflow` scope and the available SSH key is read-only, so this installation remains an external credential action. The underlying `npm run seo:snapshot` monitor is fully executable now and should be run manually each week until the workflow can be installed.

## 90-day sequence

### Days 1–7 — Measurement and baseline

1. Run the production SEO snapshot and store the artifact.
2. Configure real GA4/Search Console/Bing/IndexNow values only when authorized values exist.
3. Record the first external baseline from each connected platform; leave unavailable fields as **Not available**.
4. Verify sitemap submission/ownership status in Google and Bing.
5. Confirm conversion events after real successful test enquiries without creating fake leads in production reporting.

### Days 8–21 — Indexing and inventory hygiene

1. Reconcile sitemap crawl output with Search Console/Bing coverage.
2. Resolve non-200/noindex/canonical anomalies before creating new landing pages.
3. Run the inventory freshness review and downgrade stale positive-stock claims.
4. Review deleted/sold inventory URL handling.
5. Maintain canonical brand normalization and existing noindex policy for unvalidated brand × category permutations.

### Days 22–45 — Evidence-rich commercial pages

1. Select the top commercial product/category opportunities using real query/page data when available; otherwise prioritize by current inventory value and evidence readiness, not guessed rankings.
2. Enrich priority pages with first-party technical and procurement evidence.
3. Strengthen internal links from brand/category hubs to exact useful inventory.
4. Do not change an established product slug merely for keywords. If a URL must change for a verified business reason, use an explicit redirect and validate the old and new URL.

### Days 46–90 — Data-led expansion

1. Use Search Console query/impression evidence to choose the next pages rather than keyword fan-out.
2. Create a brand × category page only if it has real current inventory plus unique buyer value sufficient to graduate from the existing noindex contract.
3. Publish only a small number of evidence-rich technical/procurement resources supported by first-party experience or documentation.
4. Iterate titles/meta for high-impression low-CTR commercial pages based on real Search Console evidence.
5. Review lead conversion and field CWV monthly.
6. Pursue legitimate marine-industry mentions/links; never manufacture reviews, citations or backlinks.

## KPI definitions

1. **Qualified organic RFQ/enquiry leads** — successful enquiry/contact conversions attributable to organic search using real analytics attribution; exclude test/spam leads.
2. **Organic WhatsApp product enquiries** — measured WhatsApp product/contact click events from organic sessions. A click is a supporting conversion signal, not proof of a completed sale.
3. **Organic landing-page conversion rate** — qualified organic lead conversions divided by organic landing sessions for the same reporting period when both values are available from the same analytics source.
4. **Exact model/part-number clicks and impressions** — Search Console clicks/impressions for real model or part-number query families tied to current inventory.
5. **Useful indexed inventory coverage** — intended indexable inventory URLs confirmed indexed divided by intended indexable inventory URLs. Sitemap inclusion alone is not counted as Google/Bing indexation.
6. **High-impression commercial CTR** — Search Console CTR for commercial pages/queries with enough real impressions to justify a decision; do not invent a universal minimum sample size.
7. **Stale/incorrect inventory rate** — inventory records failing the documented freshness/accuracy review divided by audited inventory records for that review batch.
8. **Core Web Vitals pass rate** — proportion of priority URL groups passing field CWV in Search Console/CrUX; synthetic timings are diagnostic only and are not substituted for field CWV.

## Decision rules

- Prefer fixing indexing/canonical/availability truth before adding new pages.
- No doorway pages, thin keyword permutations or AI-only duplicate pages.
- Brand × category pages remain noindex unless individually validated for unique value.
- A page is enriched only from real inventory, first-party evidence or clearly sourced technical facts that the business is authorized to publish.
- Search performance changes must be compared using consistent date ranges and the same data source.
- Missing analytics evidence is written as **Not available**, never estimated.
- Every material code batch keeps the existing test/build/audit/Wrangler/diff/review/production-smoke release gates.
