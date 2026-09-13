import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("products support normalized many-to-many category assignments without duplicating products", async () => {
  const [schema, repository] = await Promise.all([
    source("src/lib/server/schema.sql"),
    source("src/lib/server/repository.ts")
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS product_category_assignments/);
  assert.match(schema, /PRIMARY KEY \(product_id, category_name\)/);
  assert.match(schema, /REFERENCES products\(id\) ON DELETE CASCADE/);
  assert.match(repository, /additionalCategories\?: ProductCategoryAssignment\[\]/);
  assert.match(repository, /syncProductCategoryAssignments/);
  assert.match(repository, /product_category_assignments/);
});

test("category reads include primary and additional category assignments", async () => {
  const repository = await source("src/lib/server/repository.ts");

  assert.match(repository, /EXISTS\s*\(\s*SELECT 1\s+FROM product_category_assignments/i);
  assert.match(repository, /subcategory\?: string/);
  assert.match(repository, /options\?\.subcategory/);
});

test("admin product editor can choose multiple additional categories with optional subcategories", async () => {
  const editor = await source("src/components/admin/ContentEditor.astro");

  assert.match(editor, /Additional Categories/);
  assert.match(editor, /data-additional-categories/);
  assert.match(editor, /additionalCategories/);
  assert.match(editor, /subcategory/);
});

test("subcategory and sitemap surfaces use assignment-aware product lookup", async () => {
  const [subcategoryPage, sitemap] = await Promise.all([
    source("src/pages/category/[category]/[subcategory].astro"),
    source("src/lib/server/sitemap-data.ts")
  ]);

  assert.match(subcategoryPage, /listProductSummaries\(env, \{[\s\S]*subcategory:/);
  assert.doesNotMatch(subcategoryPage, /filter\(\(p\) => p\.subcategory === currentSubcategory\.value\)/);
  assert.match(sitemap, /product_category_assignments/);
  assert.match(sitemap, /categoryAssignments/);
});
