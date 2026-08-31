import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public inventory hot paths use lightweight product summaries instead of full product records", async () => {
  const repository = await source("src/lib/server/repository.ts");
  const homepage = await source("src/pages/index.astro");
  const productsHub = await source("src/pages/products.astro");
  const brandsHub = await source("src/pages/brands.astro");
  const category = await source("src/pages/category/[category].astro");
  const subcategory = await source("src/pages/category/[category]/[subcategory].astro");
  const brand = await source("src/pages/brands/[brand].astro");
  const product = await source("src/pages/products/[slug].astro");
  const inventoryCombination = await source("src/pages/inventory/[brand]-[category].astro");

  assert.match(repository, /export async function listProductSummaries/);
  assert.match(repository, /SELECT id, slug, name, short_description, image_url, updated_at, category, subcategory, brand, model_number, part_number, image_alt FROM products/);
  assert.match(homepage, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.match(productsHub, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.doesNotMatch(productsHub, /countContent\(env, 'parts'\)/);
  assert.match(brandsHub, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.match(category, /listProductSummaries\(env, \{ category: currentCategory\.value, limit: 1000 \}\)/);
  assert.match(subcategory, /listProductSummaries\(env, \{ category: parent\.value, limit: 1000 \}\)/);
  assert.match(brand, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.match(product, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.match(inventoryCombination, /listProductSummaries\(env, \{ category: currentCategory\.value, limit: 1000 \}\)/);
});

test("sitemap batches database collections into one Neon transaction", async () => {
  const sitemapData = await source("src/lib/server/sitemap-data.ts");
  const sitemapRoute = await source("src/pages/sitemap.xml.ts");
  const db = await source("src/lib/server/db.ts");

  assert.match(sitemapData, /sql\.transaction\(/);
  assert.match(sitemapData, /SELECT slug, updated_at, brand, category, subcategory FROM products/);
  assert.match(sitemapData, /SELECT slug, updated_at FROM parts/);
  assert.match(sitemapData, /SELECT slug, updated_at FROM blog_posts/);
  assert.match(sitemapData, /FROM categories ORDER BY/);
  assert.match(sitemapRoute, /getSitemapSnapshot\(env\)/);
  assert.doesNotMatch(sitemapRoute, /Promise\.allSettled/);
  assert.doesNotMatch(sitemapRoute, /listAllContent/);
  assert.match(db, /sql\.transaction\(statements\.map/);
});

test("IndexNow notifications leave the admin response critical path when Cloudflare waitUntil is available", async () => {
  const api = await source("src/lib/server/api.ts");
  const astroEnv = await source("src/env.d.ts");

  assert.match(astroEnv, /cfContext\?:/);
  assert.match(api, /context\.locals\.cfContext\?\.waitUntil/);
  assert.match(api, /queueContentChange/);
  assert.doesNotMatch(api, /await notifyContentChange/);
});
