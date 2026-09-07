import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("product and blog CMS support multiple WebP R2 images with stale-object cleanup", async () => {
  const [schema, repository, editor, api, productPage, blogPage] = await Promise.all([
    source("src/lib/server/schema.sql"),
    source("src/lib/server/repository.ts"),
    source("src/components/admin/ContentEditor.astro"),
    source("src/lib/server/api.ts"),
    source("src/pages/products/[slug].astro"),
    source("src/pages/blog/[slug].astro"),
  ]);

  assert.match(schema, /products ADD COLUMN IF NOT EXISTS gallery_images JSONB/);
  assert.match(schema, /blog_posts ADD COLUMN IF NOT EXISTS gallery_images JSONB/);
  assert.match(repository, /galleryImages: ContentImage\[\]/);
  assert.match(repository, /normalizeGalleryImages/);
  assert.match(editor, /data-gallery-input/);
  assert.match(editor, /multiple data-gallery-input/);
  assert.match(editor, /MAX_GALLERY_IMAGES = 12/);
  assert.match(editor, /compressImageToWebp\(item\.file\)/);
  assert.match(editor, /galleryImages: nextGalleryImages/);
  assert.match(api, /contentMediaKeys/);
  assert.match(api, /staleKeys/);
  assert.match(productPage, /product\.galleryImages/);
  assert.match(productPage, /detail-gallery/);
  assert.match(blogPage, /post\.galleryImages/);
  assert.match(blogPage, /post-gallery/);
});

test("public brand reads no longer run per-brand write synchronization", async () => {
  const brands = await source("src/lib/server/brands.ts");

  assert.doesNotMatch(brands, /syncBrandsFromProducts/);
  assert.match(brands, /LEFT JOIN \(/);
  assert.match(brands, /GROUP BY LOWER\(TRIM\(brand\)\)/);
  assert.doesNotMatch(brands, /for \(const row of rows\)[\s\S]*UPDATE products/);
});
