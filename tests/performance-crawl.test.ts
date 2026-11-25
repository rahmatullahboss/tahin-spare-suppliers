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
  assert.match(repository, /SELECT p\.id, p\.slug, p\.name, p\.short_description, p\.image_url, p\.updated_at, p\.category, p\.subcategory, p\.brand, p\.model_number, p\.part_number, p\.image_alt FROM products p/);
  assert.match(homepage, /getHomepageSnapshot\(env, Astro\.locals\)/);
  assert.doesNotMatch(homepage, /listProductSummaries/);
  assert.match(productsHub, /listAllCategories\(env, Astro\.locals\)/);
  assert.doesNotMatch(productsHub, /listProductSummaries/);
  assert.doesNotMatch(productsHub, /countContent\(env, 'parts'\)/);
  assert.match(brandsHub, /listBrands\(env\)/);
  assert.doesNotMatch(brandsHub, /listProductSummaries/);
  const categoryData = await source("src/lib/server/category-page-data.ts");
  assert.match(category, /getCategoryPageData\(env, Astro\.locals/);
  assert.match(subcategory, /getSubcategoryPageData\(env, Astro\.locals/);
  assert.match(categoryData, /readCategoryProductPage\(sql, \{ category: currentCategory\.canonicalValue, page \}\)/);
  assert.match(categoryData, /readCategoryProductPage\(sql, \{[\s\S]*category: parent\.canonicalValue,[\s\S]*subcategory: result\.subcategory\.value,[\s\S]*page,[\s\S]*\}\)/);
  const categoryProducts = await source("src/lib/server/category-product-page.ts");
  assert.match(categoryProducts, /WITH candidates AS MATERIALIZED/);
  assert.match(categoryProducts, /LEFT JOIN products p ON p.id = n.id AND n.position > /);
  assert.match(categoryProducts, /json_agg\(json_build_array/);
  assert.match(categoryProducts, /FILTER \(WHERE n.position > /);
  assert.match(brand, /listBrandProductSummaries\(env, brandSlug\)/);
  assert.match(repository, /SELECT p.id, p.brand FROM products p/);
  assert.match(repository, /toUrlSlug\(canonicalizeBrand\(row.brand\)\)/);
  assert.match(product, /getProductPageData\(env, slug,/);
  assert.match(repository, /withDatabaseReader\(env, async \(sql\) => \{[\s\S]*readContentBySlug\(sql, "products", slug\)[\s\S]*readRelatedProductSummaries\(sql, product\)/);
  assert.doesNotMatch(product, /listProductSummaries/);
  const relatedData = await source("src/lib/server/related-product-data.ts");
  assert.match(relatedData, /SELECT p\.id, p\.slug, p\.updated_at, p\.category, p\.brand/);
  assert.match(relatedData, /selectRelatedProductRows\(ordered, product\)\.map/);
  assert.match(inventoryCombination, /listBrandProductSummaries\(env, brand, currentCategory\.canonicalValue\)/);
});

test("sitemap batches database collections into one Neon transaction", async () => {
  const sitemapData = await source("src/lib/server/sitemap-data.ts");
  const sitemapRoute = await source("src/pages/sitemap.xml.ts");
  const db = await source("src/lib/server/db.ts");

  assert.match(sitemapData, /sql\.transaction\(/);
  assert.match(sitemapData, /SELECT p\.slug, p\.updated_at, p\.brand, p\.category, p\.subcategory, COALESCE\(/);
  assert.match(sitemapData, /FROM product_category_assignments pca/);
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
