import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product pages keep truthful SEO facts without the later AI-summary UI block", async () => {
  const product = await source("src/pages/products/[slug].astro");

  assert.match(product, /resolvePublicAvailability/);
  assert.match(product, /Technical Specifications/);
  assert.match(product, /application\/ld\+json/);
  assert.match(product, /canonicalUrl=\{absoluteUrl\(canonicalPath\)\}/);
  assert.match(product, /Availability checked/);
  assert.match(product, /Condition checked/);
  assert.doesNotMatch(product, /Product at a Glance/);
});

test("brand and category pages keep canonical inventory SEO without added dashboard-style count UI", async () => {
  const brand = await source("src/pages/brands/[brand].astro");
  const category = await source("src/pages/category/[category].astro");

  assert.match(brand, /canonicalizeBrand/);
  assert.match(brand, /canonicalUrl=\{absoluteUrl\(canonicalPath\)\}/);
  assert.match(brand, /listProductSummaries/);
  assert.doesNotMatch(brand, /Current online inventory:/);
  assert.doesNotMatch(brand, /brand-category-links/);

  assert.match(category, /noindex=\{categoryProducts\.length === 0\}/);
  assert.match(category, /listProductSummaries/);
  assert.doesNotMatch(category, /Current online inventory:/);
  assert.doesNotMatch(category, /buyer-guidance/);
});

test("AI discoverability stays on canonical human-visible pages instead of AI-only hacks", async () => {
  const plan = await source("docs/superpowers/plans/2026-08-30-tahin-seo-growth-and-production-reconciliation-plan.md");
  assert.match(plan, /Do not prioritize/);
  assert.match(plan, /llms\.txt/);

  await assert.rejects(access(new URL("../public/llms.txt", import.meta.url)));
  await assert.rejects(access(new URL("../src/pages/llms.txt.ts", import.meta.url)));
});

test("first-party evidence and technical structured data remain available after UI restoration", async () => {
  const product = await source("src/pages/products/[slug].astro");
  const business = await source("src/pages/business-info.astro");
  const category = await source("src/pages/category/[category].astro");

  assert.match(product, /Technical Specifications/);
  assert.match(product, /figcaption/);
  assert.match(product, /application\/ld\+json/);
  assert.match(business, /Evidence & Condition Approach/);
  assert.match(category, /Frequently Asked Questions/);
});
