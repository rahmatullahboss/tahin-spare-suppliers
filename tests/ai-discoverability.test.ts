import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product pages expose a concise visible factual summary with verification boundaries", async () => {
  const product = await source("src/pages/products/[slug].astro");

  assert.match(product, /Product at a Glance/);
  assert.match(product, /Recorded condition:/);
  assert.match(product, /Current availability:/);
  assert.match(product, /Price is quote-based/);
  assert.match(product, /Availability last checked/);
  assert.match(product, /Condition last checked/);
  assert.match(product, /confirm.*written quotation/i);
});

test("brand hubs state current first-party inventory evidence in visible text", async () => {
  const brand = await source("src/pages/brands/[brand].astro");

  assert.match(brand, /Current online inventory:/);
  assert.match(brand, /brandProducts\.length/);
  assert.match(brand, /brandCategories\.length/);
  assert.match(brand, /published listings/i);
});

test("category hubs state current listing and brand counts in visible text", async () => {
  const category = await source("src/pages/category/[category].astro");

  assert.match(category, /Current online inventory:/);
  assert.match(category, /categoryProducts\.length/);
  assert.match(category, /displayBrands\.length/);
  assert.match(category, /published listings/i);
});

test("AI discoverability stays on canonical human-visible pages instead of AI-only hacks", async () => {
  const plan = await source("docs/superpowers/plans/2026-08-30-tahin-seo-growth-and-production-reconciliation-plan.md");
  assert.match(plan, /Do not prioritize/);
  assert.match(plan, /llms\.txt/);

  await assert.rejects(access(new URL("../public/llms.txt", import.meta.url)));
  await assert.rejects(access(new URL("../src/pages/llms.txt.ts", import.meta.url)));
});

test("existing first-party evidence and structured data remain visible and truthful", async () => {
  const product = await source("src/pages/products/[slug].astro");
  const business = await source("src/pages/business-info.astro");
  const category = await source("src/pages/category/[category].astro");

  assert.match(product, /Technical Specifications/);
  assert.match(product, /figcaption/);
  assert.match(product, /application\/ld\+json/);
  assert.match(business, /Evidence & Condition Approach/);
  assert.match(category, /What to Send for a Faster Quote/);
});
