import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("brand CMS persists canonical names and custom logos", async () => {
  const [schema, brandsServer, api] = await Promise.all([
    source("src/lib/server/schema.sql"),
    source("src/lib/server/brands.ts"),
    source("src/pages/api/admin/brands.ts")
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS brands/);
  assert.match(schema, /logo_url TEXT NOT NULL DEFAULT ''/);
  assert.match(schema, /logo_key TEXT NOT NULL DEFAULT ''/);
  assert.match(brandsServer, /syncBrandsFromProducts/);
  assert.match(brandsServer, /UPDATE products SET brand/);
  assert.match(brandsServer, /ensureBrandExists/);
  assert.match(api, /requireAdminRequest/);
  assert.match(api, /createBrand/);
  assert.match(api, /updateBrand/);
  assert.match(api, /deleteBrand/);
});

test("brand admin converts uploaded logos to WebP before R2 upload", async () => {
  const admin = await source("src/pages/admin/brands.astro");

  assert.match(admin, /<ImageUploader label="Brand Logo"/);
  assert.match(admin, /canvas\.toBlob\(resolve, "image\/webp", 0\.86\)/);
  assert.match(admin, /fetch\("\/api\/upload", \{ method: "POST"/);
  assert.match(admin, /Uploading logo to R2/);
  assert.match(admin, /fetch\("\/api\/admin\/brands"/);
});

test("product admin uses the canonical managed brand list", async () => {
  const [productsAdmin, editor] = await Promise.all([
    source("src/pages/admin/products.astro"),
    source("src/components/admin/ContentEditor.astro")
  ]);

  assert.match(productsAdmin, /listBrands\(env\)/);
  assert.match(productsAdmin, /brands=\{brands\}/);
  assert.match(editor, /data-brand list="brand-options"/);
  assert.match(editor, /<datalist id="brand-options">/);
  assert.match(editor, /brands\.map/);
  assert.match(editor, /New names are added to the canonical brand list on save/);
  assert.match(editor, /href="\/admin\/brands"/);
});

test("public brand surfaces prefer CMS logo overrides and keep static fallbacks", async () => {
  const [categoryPage, brandsPage, brandPage] = await Promise.all([
    source("src/pages/category/[category].astro"),
    source("src/pages/brands.astro"),
    source("src/pages/brands/[brand].astro")
  ]);

  assert.match(categoryPage, /managedBrand\?\.displayLogoUrl/);
  assert.match(categoryPage, /getBrandLogoAsset/);
  assert.match(brandsPage, /brand\.displayLogoUrl/);
  assert.match(brandPage, /managedBrand\?\.displayLogoUrl/);
});
