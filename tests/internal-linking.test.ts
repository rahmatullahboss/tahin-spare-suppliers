import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product detail keeps canonical category context and canonical URL metadata", async () => {
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(productPage, /getCategorySlug/);
  assert.match(productPage, /canonicalPath/);
  assert.match(productPage, /canonicalUrl=\{absoluteUrl\(canonicalPath\)\}/);
  assert.match(productPage, /Breadcrumbs/);
});

test("brand hub keeps canonical brand normalization without the later equipment-type UI grid", async () => {
  const brandPage = await source("src/pages/brands/[brand].astro");

  assert.match(brandPage, /canonicalizeBrand/);
  assert.match(brandPage, /Astro\.redirect\(`\/brands\/\$\{canonicalBrandSlug\}`/);
  assert.match(brandPage, /listProductSummaries/);
  assert.doesNotMatch(brandPage, /Browse .* by Equipment Type/);
  assert.doesNotMatch(brandPage, /brand-category-grid/);
});

test("category hub keeps real-brand canonical links in the earlier presentation", async () => {
  const categoryPage = await source("src/pages/category/[category].astro");

  assert.match(categoryPage, /Browse \{currentCategory\.value\} by Brand/);
  assert.match(categoryPage, /href=\{`\/brands\/\$\{toUrlSlug\(brand\)\}`\}/);
  assert.match(categoryPage, /listProductSummaries/);
  assert.doesNotMatch(categoryPage, /Find by Model or Part Number/);
});

test("products hub uses its earlier category-card UI while dedicated parts remain crawl-governed", async () => {
  const productsPage = await source("src/pages/products.astro");
  const partsPage = await source("src/pages/parts/index.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");

  assert.match(productsPage, /liveCategories\.map/);
  assert.match(productsPage, /listProductSummaries\(env, \{ limit: 1000 \}\)/);
  assert.doesNotMatch(productsPage, /parts-hub-cta/);
  assert.match(partsPage, /noindex=\{parts\.length === 0\}/);
  assert.match(sitemap, /if \(parts\.length > 0\).*\/parts/s);
});

test("sitewide footer preserves the previous visual item without linking the known empty noindex taxonomy", async () => {
  const footer = await source("src/components/Footer.astro");

  assert.match(footer, />Anchor and Chain<\/a>/);
  assert.doesNotMatch(footer, /\/category\/anchor-and-chain/);
});

test("brand-category permutations remain non-indexable", async () => {
  const programmatic = await source("src/pages/inventory/[brand]-[category].astro");

  assert.match(programmatic, /noindex/);
  assert.doesNotMatch(programmatic, /index, follow/i);
});
