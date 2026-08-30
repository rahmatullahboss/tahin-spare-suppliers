import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("90-day cadence defines role owners, actions and weekly/monthly/quarterly frequencies", async () => {
  const cadence = await source("docs/seo/90-day-growth-cadence.md");

  assert.match(cadence, /Owner \(role\)/);
  assert.match(cadence, /Weekly/i);
  assert.match(cadence, /Monthly/i);
  assert.match(cadence, /Quarterly/i);
  assert.match(cadence, /Search Console query\/page review/i);
  assert.match(cadence, /GA4 lead\/conversion review/i);
  assert.match(cadence, /Bing Webmaster review/i);
  assert.match(cadence, /inventory freshness/i);
  assert.match(cadence, /internal-link/i);
  assert.match(cadence, /indexing anomaly/i);
  assert.match(cadence, /technical regression/i);
});

test("growth report template keeps unavailable external metrics explicitly blank", async () => {
  const report = await source("docs/seo/growth-report-template.md");

  assert.match(report, /Do not estimate or backfill missing analytics data/i);
  assert.match(report, /Qualified organic RFQ\/enquiry leads/);
  assert.match(report, /Organic WhatsApp product enquiries/);
  assert.match(report, /Exact model\/part-number clicks and impressions/);
  assert.match(report, /Useful indexed inventory coverage/);
  assert.match(report, /Core Web Vitals pass rate/);
  assert.match(report, /Not available/);
});

test("production SEO snapshot checks every sitemap URL without external analytics credentials", async () => {
  const script = await source("scripts/seo-growth-snapshot.mjs");
  const pkg = await source("package.json");

  assert.match(pkg, /"seo:snapshot": "node scripts\/seo-growth-snapshot\.mjs"/);
  assert.match(script, /extractSitemapUrls/);
  assert.match(script, /crawlSitemapUrls/);
  assert.match(script, /canonicalMismatch/);
  assert.match(script, /noindexInSitemap/);
  assert.match(script, /indexNowKeyStatus/);
  assert.doesNotMatch(script, /GOOGLE_ANALYTICS_API|SEARCH_CONSOLE_API|BING_API_KEY/);
});

test("weekly GitHub monitor template produces a crawl snapshot artifact and does not deploy", async () => {
  const workflow = await source("docs/seo/seo-monitor.github-actions.yml");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: ['"]0 2 \* \* 1['"]/);
  assert.match(workflow, /npm run seo:snapshot -- --output seo-growth-snapshot\.json/);
  assert.match(workflow, /actions\/upload-artifact/);
  assert.doesNotMatch(workflow, /wrangler deploy|astro build && wrangler deploy/);
});
