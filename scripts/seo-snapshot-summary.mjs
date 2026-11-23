import { appendFile, readFile } from "node:fs/promises";

export function formatSeoSnapshotSummary(snapshot) {
  const count = (value) => Number.isInteger(value) ? value : "Not available";
  const status = (value) => value === true ? "Configured in public HTML" : "Not detected in public HTML";
  const anomalyFields = [
    ["Non-200 sitemap URLs", snapshot.sitemap?.non200Count],
    ["Noindex sitemap URLs", snapshot.sitemap?.noindexCount],
    ["Canonical mismatches", snapshot.sitemap?.canonicalMismatchCount],
    ["Missing canonicals", snapshot.sitemap?.missingCanonicalCount],
    ["Off-host sitemap URLs", snapshot.sitemap?.offCanonicalHostCount],
    ["Fetch errors", snapshot.sitemap?.fetchErrorCount]
  ];
  const lines = [
    "# Tahin Spare: weekly production SEO crawl",
    "",
    `**Result:** ${snapshot.healthy === true ? "Healthy" : "Action required"}`,
    `**Generated:** ${snapshot.generatedAt ?? "Unknown"}`,
    `**Sitemap URLs:** ${count(snapshot.sitemap?.urlCount)}`,
    `**Homepage HTTP:** ${count(snapshot.endpoints?.homepageStatus)}`,
    `**Sitemap HTTP:** ${count(snapshot.endpoints?.sitemapStatus)}`,
    `**Robots HTTP:** ${count(snapshot.endpoints?.robotsStatus)}`,
    "",
    "## Crawl anomalies",
    ...anomalyFields.map(([label, value]) => `- ${label}: ${count(value)}`),
    `- Duplicate sitemap URLs: ${count(snapshot.critical?.duplicateSitemapUrls)}`,
    `- Empty sitemap: ${snapshot.critical?.sitemapEmpty === true ? "Yes" : "No"}`,
    "",
    "## Measurement configuration (public HTML only)",
    `- GA4: ${status(snapshot.measurement?.ga4RuntimeTagConfigured)}`,
    `- Google verification tag: ${status(snapshot.measurement?.googleVerificationConfigured)}`,
    `- Bing verification tag: ${status(snapshot.measurement?.bingVerificationConfigured)}`,
    `- IndexNow key endpoint HTTP: ${count(snapshot.measurement?.indexNowKeyStatus)} (404 may mean unconfigured)`,
    "",
    "This crawl does not measure rankings, organic clicks, indexed coverage, conversions or Core Web Vitals. Review those in authorized Google/Bing analytics accounts.",
    ""
  ];
  return lines.join("\n");
}

async function main() {
  const input = process.argv[2] || "seo-growth-snapshot.json";
  const snapshot = JSON.parse(await readFile(input, "utf8"));
  const summary = formatSeoSnapshotSummary(snapshot);
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
}

if (process.argv[1]?.endsWith("/seo-snapshot-summary.mjs")) {
  main().catch((error) => {
    console.error("Unable to summarize SEO snapshot:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
