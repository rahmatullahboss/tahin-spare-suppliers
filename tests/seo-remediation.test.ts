import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSnapshot, crawlSitemapUrls } from "../scripts/seo-growth-snapshot.mjs";
import { formatSeoSnapshotSummary } from "../scripts/seo-snapshot-summary.mjs";
import { resolveCategoryBuyerGuide } from "../src/lib/seo.ts";

const site = "https://tahinspare.com";
const fixture = (paths) => `<?xml version="1.0"?><urlset>${paths.map((path) => `<url><loc>${site}${path}</loc></url>`).join("")}</urlset>`;

function responseFor(path, paths, { homepageStatus = 200, noindexProduct = false } = {}) {
  if (path === "/sitemap.xml") return new Response(fixture(paths), { status: 200, headers: { "content-type": "application/xml" } });
  if (path === "/robots.txt") return new Response("User-agent: *\\nAllow: /", { status: 200 });
  if (path === "/indexnow-key.txt") return new Response("", { status: 404 });
  const url = `${site}${path}`;
  return new Response(`<!doctype html><html><head><link rel="canonical" href="${url}"></head><body>Marine equipment</body></html>`, {
    status: path === "/" ? homepageStatus : 200,
    headers: {
      "content-type": "text/html",
      ...(noindexProduct && path.startsWith("/products/") ? { "x-robots-tag": "noindex" } : {})
    }
  });
}

test("production crawl rejects off-origin sitemap URLs before making requests", async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("must not fetch"); };
  try {
    const [result] = await crawlSitemapUrls(["http://127.0.0.1/private"], site, 1000, 1);
    assert.equal(requests, 0);
    assert.equal(result.offCanonicalHost, true);
    assert.equal(result.status, 0);
    assert.match(result.error, /not fetched/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("SEO crawl marks empty and duplicate sitemaps unhealthy and reads x-robots-tag", async () => {
  const previousFetch = globalThis.fetch;
  let paths = ["/"];
  let options = {};
  globalThis.fetch = async (rawUrl) => responseFor(new URL(String(rawUrl)).pathname, paths, options);
  const input = { baseUrl: site, timeoutMs: 1000, concurrency: 2 };
  try {
    const healthy = await buildSnapshot(input);
    assert.equal(healthy.healthy, true);
    assert.equal(healthy.sitemap.urlCount, 1);
    paths = [];
    const empty = await buildSnapshot(input);
    assert.equal(empty.healthy, false);
    assert.equal(empty.critical.sitemapEmpty, true);
    paths = ["/", "/"];
    const duplicate = await buildSnapshot(input);
    assert.equal(duplicate.healthy, false);
    assert.equal(duplicate.critical.duplicateSitemapUrls, 1);
    paths = ["/products/sample"];
    options = { noindexProduct: true };
    const noindex = await buildSnapshot(input);
    assert.equal(noindex.healthy, false);
    assert.equal(noindex.sitemap.noindexCount, 1);
    options = { homepageStatus: 503 };
    const homepageDown = await buildSnapshot(input);
    assert.equal(homepageDown.critical.homepageUnavailable, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("active SEO monitor reports and preserves evidence without deploying", async () => {
  const workflow = await readFile(new URL("../.github/workflows/seo-monitor.yml", import.meta.url), "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /seo-growth-snapshot.json/);
  assert.match(workflow, /seo-snapshot-summary.mjs/);
  assert.match(workflow, /upload-artifact/);
  assert.match(workflow, /steps.crawl.outcome != 'success'/);
  assert.doesNotMatch(workflow, /wrangler deploy/);

  const summary = formatSeoSnapshotSummary({
    generatedAt: "2026-10-24T00:00:00Z",
    healthy: false,
    sitemap: { urlCount: 2, non200Count: 1 },
    endpoints: { homepageStatus: 200, sitemapStatus: 200, robotsStatus: 200 },
    measurement: { ga4RuntimeTagConfigured: false, indexNowKeyStatus: 404 },
    critical: { duplicateSitemapUrls: 0 }
  });
  assert.match(summary, /Action required/);
  assert.match(summary, /GA4: Not detected/);
  assert.match(summary, /does not measure rankings/);
});

test("existing buyer guides are discoverable only from matching commercial categories", async () => {
  const mapped = {
    "spare-parts": "marine-spare-parts-identification-checklist",
    "turbocharger": "how-to-identify-marine-turbocharger",
    "marine-gearbox": "marine-gearbox-identification-checklist",
    "marine-propulsion-engine": "reconditioned-marine-engine-buying-checklist",
    "hydraulic-deck-crane-equipment": "marine-hydraulic-power-unit-hpu-quote-checklist"
  };
  for (const [slug, guideSlug] of Object.entries(mapped)) {
    const guide = resolveCategoryBuyerGuide(slug);
    assert.equal(guide?.href, `/blog/${guideSlug}`);
    const article = await readFile(new URL(`../src/pages/blog/${guideSlug}.astro`, import.meta.url), "utf8");
    assert.match(article, /StaticBlogArticle|BlogPosting/);
  }
  assert.equal(resolveCategoryBuyerGuide("anchor-and-chain"), undefined);
  const category = await readFile(new URL("../src/pages/category/[category].astro", import.meta.url), "utf8");
  assert.match(category, /categoryProducts.length > 0 \? resolveCategoryBuyerGuide/);
  assert.match(category, /href=\{categoryBuyerGuide.href\}/);
});
