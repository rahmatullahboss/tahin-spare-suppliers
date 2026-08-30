import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product detail links canonical brand and category authorities", async () => {
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(productPage, /toUrlSlug/);
  assert.match(productPage, /href=\{`\/brands\/\$\{toUrlSlug\(product\.brand\)/);
  assert.match(productPage, /href=\{`\/category\/\$\{categorySlug\}`\}/);
});

test("brand hub exposes only live canonical category links", async () => {
  const brandPage = await source("src/pages/brands/[brand].astro");

  assert.match(brandPage, /listAllCategories/);
  assert.match(brandPage, /brandCategories/);
  assert.match(brandPage, /Browse .* by Equipment Type/);
  assert.match(brandPage, /href=\{`\/category\/\$\{category\.slug\}`\}/);
});

test("category hub links exact model or part-number inventory directly", async () => {
  const categoryPage = await source("src/pages/category/[category].astro");

  assert.match(categoryPage, /featuredInventory/);
  assert.match(categoryPage, /Find by Model or Part Number/);
  assert.match(categoryPage, /href=\{`\/products\/\$\{product\.slug\}`\}/);
});

test("products hub prioritizes live categories and conditionally links a parts catalog", async () => {
  const productsPage = await source("src/pages/products.astro");

  assert.match(productsPage, /liveCategories/);
  assert.match(productsPage, /listContent\(env, ['"]products['"]/);
  assert.match(productsPage, /listContent\(env, ['"]parts['"]/);
  assert.match(productsPage, /parts\.length > 0/);
  assert.match(productsPage, /href="\/parts"/);
});

test("parts get a crawlable hub only when inventory exists", async () => {
  const partsPage = await source("src/pages/parts/index.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");

  assert.match(partsPage, /listContent\(env, "parts"/);
  assert.match(partsPage, /noindex=\{parts\.length === 0\}/);
  assert.match(partsPage, /href=\{`\/parts\/\$\{part\.slug\}`\}/);
  assert.match(sitemap, /if \(parts\.length > 0\).*\/parts/s);
});

test("sitewide footer does not promote known empty noindex taxonomy", async () => {
  const footer = await source("src/components/Footer.astro");

  assert.doesNotMatch(footer, /\/category\/anchor-and-chain/);
});

test("phase 3 keeps brand-category permutations non-indexable", async () => {
  const programmatic = await source("src/pages/inventory/[brand]-[category].astro");

  assert.match(programmatic, /noindex/);
  assert.doesNotMatch(programmatic, /index, follow/i);
});
