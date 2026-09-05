import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { HOMEPAGE_DEFAULTS, HOMEPAGE_SECTION_ORDER, isHomepageSectionKey } from "../src/lib/page-content.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage CMS has a bounded section allowlist with complete defaults", () => {
  assert.deepEqual(HOMEPAGE_SECTION_ORDER, [
    "hero",
    "who-we-are",
    "stock",
    "brands",
    "services",
    "export-logistics",
    "shipments",
    "equipment-cta",
    "why-choose-us"
  ]);
  assert.equal(isHomepageSectionKey("hero"), true);
  assert.equal(isHomepageSectionKey("anything-else"), false);
  assert.ok(HOMEPAGE_DEFAULTS.hero.slides.length >= 1);
  assert.ok(HOMEPAGE_DEFAULTS.shipments.images.length >= 1);
  assert.ok(HOMEPAGE_DEFAULTS.brands.logos.some((entry) => entry.brand === "Cummins" && entry.image.url));
  assert.ok(HOMEPAGE_DEFAULTS["equipment-cta"].backgroundImage.url);
  assert.match(HOMEPAGE_DEFAULTS.brands.directoryTitle, /models by brand/i);
});

test("homepage content is persisted as structured JSON instead of arbitrary page-builder markup", async () => {
  const [schema, repository] = await Promise.all([
    source("src/lib/server/schema.sql"),
    source("src/lib/server/page-content.ts")
  ]);

  assert.match(schema, /CREATE TABLE IF NOT EXISTS page_sections/);
  assert.match(schema, /PRIMARY KEY \(page_key, section_key\)/);
  assert.match(repository, /MAX_JSON_BYTES/);
  assert.match(repository, /sanitizeValue/);
  assert.match(repository, /sanitizeUrl/);
  assert.match(repository, /ON CONFLICT \(page_key, section_key\)/);
  assert.doesNotMatch(repository, /eval\(|new Function/);
});

test("inline CMS writes require admin authentication and only allow known homepage sections", async () => {
  const api = await source("src/pages/api/page-content/[page]/[section].ts");

  assert.match(api, /requireAdminRequest/);
  assert.match(api, /page !== "home" \|\| !isHomepageSectionKey\(section\)/);
  assert.match(api, /export const PUT/);
  assert.match(api, /saveHomepageSection/);
});

test("authenticated homepage exposes controlled inline edit buttons without exposing them to all visitors", async () => {
  const homepage = await source("src/pages/index.astro");

  assert.match(homepage, /isAuthenticated/);
  assert.match(homepage, /authenticated && <button[^>]+data-cms-edit="hero"/);
  assert.match(homepage, /data-cms-edit="shipments"/);
  assert.match(homepage, /data-cms-edit="equipment-cta"/);
  assert.match(homepage, /authenticated && <InlinePageEditor pageKey="home"/);
});

test("inline image replacement compresses browser uploads to WebP before authenticated R2 upload", async () => {
  const [inlineEditor, uploadApi] = await Promise.all([
    source("src/components/admin/InlinePageEditor.astro"),
    source("src/pages/api/upload.ts")
  ]);

  assert.match(inlineEditor, /canvas\.toBlob\(resolve, 'image\/webp', 0\.82\)/);
  assert.match(inlineEditor, /new File\(\[blob\].*\.webp/);
  assert.match(inlineEditor, /fetch\('\/api\/upload'/);
  assert.match(uploadApi, /requireAdminRequest/);
  assert.match(uploadApi, /MEDIA_BUCKET\.put/);
});

test("brand-model directory lives inside category pages and uses real brand logos when available", async () => {
  const [homepage, categoryPage, brandLogos] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/pages/category/[category].astro"),
    source("src/lib/brand-logos.ts")
  ]);

  assert.doesNotMatch(homepage, /modelDirectory|category-brand-directory/);
  assert.match(categoryPage, /const brandModelDirectory = \[\.\.\.categoryProducts\.reduce/);
  assert.match(categoryPage, /product\.model_number/);
  assert.match(categoryPage, /getBrandLogoAsset\(group\.brand\)/);
  assert.match(categoryPage, /class="category-brand-logo"/);
  assert.match(categoryPage, /href=\{`\/products\/\$\{model\.slug\}`\}/);
  assert.match(brandLogos, /Cummins/);
  assert.match(brandLogos, /caterpillar-logo2\.svg/);
});

test("inline CMS styles dynamic controls globally and keeps mobile fields full-width", async () => {
  const inlineEditor = await source("src/components/admin/InlinePageEditor.astro");

  assert.match(inlineEditor, /<style is:global>/);
  assert.match(inlineEditor, /\.cms-field input, \.cms-field textarea \{[^}]*width:100%/s);
  assert.match(inlineEditor, /font-size:16px/);
  assert.match(inlineEditor, /height:100dvh/);
  assert.match(inlineEditor, /\.cms-actions \{[^}]*position:sticky/s);
});
