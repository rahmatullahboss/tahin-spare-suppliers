import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all public category-list surfaces read the canonical configured category list", async () => {
  const [homepage, products, footer, about, enquiry] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/pages/products.astro"),
    source("src/components/Footer.astro"),
    source("src/pages/about.astro"),
    source("src/pages/enquiry.astro")
  ]);

  assert.match(homepage, /listAllCategories/);
  assert.match(homepage, /categories\.map/);
  assert.match(products, /listAllCategories/);
  assert.match(products, /categories\.map/);
  assert.match(footer, /listAllCategories/);
  assert.match(footer, /footerCategories\.map/);
  assert.match(about, /listAllCategories/);
  assert.match(about, /offerCategories\.map/);
  assert.match(enquiry, /listAllCategories/);
  assert.match(enquiry, /categories\.map/);
});

test("category surfaces do not hide newly-created empty categories behind live-product filtering", async () => {
  const [homepage, products, footer, about] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/pages/products.astro"),
    source("src/components/Footer.astro"),
    source("src/pages/about.astro")
  ]);

  for (const page of [homepage, products, footer, about]) {
    assert.doesNotMatch(page, /liveCategories/);
  }
});

test("category cards have one editable presentation and order shared by every public category surface", async () => {
  const [schema, repository, admin, api] = await Promise.all([
    source("src/lib/server/schema.sql"),
    source("src/lib/server/categories.ts"),
    source("src/pages/admin/categories.astro"),
    source("src/pages/api/admin/category-presentation.ts")
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS category_presentations/);
  assert.match(repository, /saveCategoryPresentation/);
  assert.match(repository, /reorderCategories/);
  assert.match(repository, /canonicalValue/);
  assert.match(admin, /Website Category Cards/);
  assert.match(admin, /data-move-category="up"/);
  assert.match(admin, /data-move-category="down"/);
  assert.match(admin, /data-card-image/);
  assert.match(admin, /canvas\.toBlob\(resolve, "image\/webp", 0\.82\)/);
  assert.match(api, /requireAdminRequest/);
  assert.match(api, /export const PATCH/);
});
