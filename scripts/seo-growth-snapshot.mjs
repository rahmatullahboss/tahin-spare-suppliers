import { writeFile } from "node:fs/promises";

const DEFAULT_BASE_URL = "https://tahinspare.com";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 6;

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.SEO_BASE_URL || DEFAULT_BASE_URL,
    output: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base" && argv[index + 1]) options.baseUrl = argv[++index];
    else if (arg === "--output" && argv[index + 1]) options.output = argv[++index];
    else if (arg === "--timeout-ms" && argv[index + 1]) options.timeoutMs = Number(argv[++index]);
    else if (arg === "--concurrency" && argv[index + 1]) options.concurrency = Number(argv[++index]);
    else if (arg === "--help") {
      console.log("Usage: node scripts/seo-growth-snapshot.mjs [--base URL] [--output FILE] [--timeout-ms N] [--concurrency N]");
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 60000) {
    throw new Error("--timeout-ms must be between 1000 and 60000");
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 20) {
    throw new Error("--concurrency must be an integer between 1 and 20");
  }

  const base = new URL(options.baseUrl);
  base.pathname = "/";
  base.search = "";
  base.hash = "";
  options.baseUrl = base.toString().replace(/\/$/, "");
  return options;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractSitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

function normalizedUrl(value) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function htmlCanonical(html) {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    if (!/\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["']/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) return href.trim();
  }
  return "";
}

function hasNoindex(html) {
  const robotsTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return robotsTags.some((tag) => (
    /\bname\s*=\s*["']robots["']/i.test(tag)
    && /\bcontent\s*=\s*["'][^"']*\bnoindex\b[^"']*["']/i.test(tag)
  ));
}

function classifyUrl(urlValue) {
  const pathname = new URL(urlValue).pathname;
  if (/^\/products\/[^/]+$/.test(pathname)) return "product";
  if (/^\/category\/[^/]+\/[^/]+$/.test(pathname)) return "subcategory";
  if (/^\/category\/[^/]+$/.test(pathname)) return "category";
  if (/^\/brands\/[^/]+$/.test(pathname)) return "brand";
  if (/^\/parts\/[^/]+$/.test(pathname)) return "part";
  if (/^\/blog\/[^/]+$/.test(pathname)) return "blog";
  return "static";
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": "TahinSEOProductionMonitor/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return {
    response,
    text: await response.text(),
  };
}

async function crawlOne(urlValue, canonicalOrigin, timeoutMs) {
  const started = performance.now();
  try {
    const { response, text } = await fetchText(urlValue, timeoutMs);
    const contentType = response.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
    const canonical = isHtml ? htmlCanonical(text) : "";
    const canonicalAbsolute = canonical ? new URL(canonical, urlValue).toString() : "";
    const canonicalMismatch = Boolean(
      response.status === 200
      && isHtml
      && canonicalAbsolute
      && normalizedUrl(canonicalAbsolute) !== normalizedUrl(urlValue)
    );
    const noindexInSitemap = response.status === 200 && isHtml && hasNoindex(text);
    const missingCanonical = response.status === 200 && isHtml && !canonicalAbsolute;
    const url = new URL(urlValue);

    return {
      url: urlValue,
      type: classifyUrl(urlValue),
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      contentType,
      offCanonicalHost: url.origin !== canonicalOrigin,
      noindexInSitemap,
      canonical: canonicalAbsolute || null,
      canonicalMismatch,
      missingCanonical,
      error: null,
    };
  } catch (error) {
    return {
      url: urlValue,
      type: classifyUrl(urlValue),
      status: 0,
      durationMs: Math.round(performance.now() - started),
      contentType: "",
      offCanonicalHost: new URL(urlValue).origin !== canonicalOrigin,
      noindexInSitemap: false,
      canonical: null,
      canonicalMismatch: false,
      missingCanonical: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function crawlSitemapUrls(urls, canonicalOrigin, timeoutMs, concurrency) {
  const results = new Array(urls.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;
      results[index] = await crawlOne(urls[index], canonicalOrigin, timeoutMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length || 1) }, () => worker()));
  return results;
}

function countByType(results) {
  return results.reduce((counts, result) => {
    counts[result.type] = (counts[result.type] || 0) + 1;
    return counts;
  }, {});
}

async function buildSnapshot(options) {
  const generatedAt = new Date().toISOString();
  const canonicalOrigin = new URL(options.baseUrl).origin;
  const sitemapUrl = `${options.baseUrl}/sitemap.xml`;
  const robotsUrl = `${options.baseUrl}/robots.txt`;
  const homepageUrl = `${options.baseUrl}/`;
  const indexNowKeyUrl = `${options.baseUrl}/indexnow-key.txt`;

  const [sitemapResult, robotsResult, homepageResult, indexNowResult] = await Promise.all([
    fetchText(sitemapUrl, options.timeoutMs),
    fetchText(robotsUrl, options.timeoutMs),
    fetchText(homepageUrl, options.timeoutMs),
    fetchText(indexNowKeyUrl, options.timeoutMs),
  ]);

  const sitemapUrls = sitemapResult.response.status === 200
    ? extractSitemapUrls(sitemapResult.text)
    : [];
  const crawlResults = await crawlSitemapUrls(
    sitemapUrls,
    canonicalOrigin,
    options.timeoutMs,
    options.concurrency,
  );

  const non200 = crawlResults.filter((result) => result.status !== 200);
  const noindexInSitemap = crawlResults.filter((result) => result.noindexInSitemap);
  const canonicalMismatch = crawlResults.filter((result) => result.canonicalMismatch);
  const missingCanonical = crawlResults.filter((result) => result.missingCanonical);
  const offCanonicalHost = crawlResults.filter((result) => result.offCanonicalHost);
  const fetchErrors = crawlResults.filter((result) => result.error);

  const homepage = homepageResult.text;
  const measurement = {
    ga4RuntimeTagConfigured: /googletagmanager\.com\/gtag\/js\?id=G-[A-Z0-9]+/i.test(homepage),
    googleVerificationConfigured: /<meta\b[^>]*name=["']google-site-verification["']/i.test(homepage),
    bingVerificationConfigured: /<meta\b[^>]*name=["']msvalidate\.01["']/i.test(homepage),
    indexNowKeyStatus: indexNowResult.response.status,
  };

  const critical = {
    sitemapUnavailable: sitemapResult.response.status !== 200,
    robotsUnavailable: robotsResult.response.status !== 200,
    non200InSitemap: non200.length,
    noindexInSitemap: noindexInSitemap.length,
    canonicalMismatch: canonicalMismatch.length,
    missingCanonical: missingCanonical.length,
    offCanonicalHost: offCanonicalHost.length,
    fetchErrors: fetchErrors.length,
  };

  return {
    generatedAt,
    baseUrl: options.baseUrl,
    source: "public production crawl; no GA4/Search Console/Bing API data queried",
    endpoints: {
      homepageStatus: homepageResult.response.status,
      sitemapStatus: sitemapResult.response.status,
      robotsStatus: robotsResult.response.status,
      indexNowKeyStatus: indexNowResult.response.status,
    },
    measurement,
    sitemap: {
      urlCount: sitemapUrls.length,
      byType: countByType(crawlResults),
      non200Count: non200.length,
      noindexCount: noindexInSitemap.length,
      canonicalMismatchCount: canonicalMismatch.length,
      missingCanonicalCount: missingCanonical.length,
      offCanonicalHostCount: offCanonicalHost.length,
      fetchErrorCount: fetchErrors.length,
    },
    anomalies: {
      non200,
      noindexInSitemap,
      canonicalMismatch,
      missingCanonical,
      offCanonicalHost,
      fetchErrors,
    },
    critical,
    healthy: !Object.values(critical).some((value) => value === true || (typeof value === "number" && value > 0)),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await buildSnapshot(options);
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (options.output) await writeFile(options.output, json, "utf8");
  process.stdout.write(json);

  if (!snapshot.healthy) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
