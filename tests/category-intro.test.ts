import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { EQUIPMENT_CATEGORIES } from "../src/lib/categories.ts";
import { getCategoryIntroCopy, getCategoryIntroImage } from "../src/lib/category-intro.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every built-in category has a useful equipment guide and model-selection advice", () => {
  for (const category of EQUIPMENT_CATEGORIES) {
    const intro = getCategoryIntroCopy(category.slug, category.value);
    assert.match(intro.heading, new RegExp(category.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    assert.ok(intro.description.length >= 90, `${category.slug}: missing explanation`);
    assert.ok(intro.uses.length >= 95, `${category.slug}: missing actual use cases`);
    assert.ok(intro.guidance.length >= 55, `${category.slug}: missing procurement guidance`);
    assert.doesNotMatch(`${intro.description} ${intro.uses}`, /we have in stock|always available|100\+ countries/i);
  }
});

test("new categories and subcategories receive a useful generic guide without unsupported product claims", () => {
  const custom = getCategoryIntroCopy("custom-marine-item", "Custom Marine Item");
  const sub = getCategoryIntroCopy("impellers", "Impellers", "Marine Pump");
  assert.match(custom.heading, /Custom Marine Item/);
  assert.match(custom.guidance, /model/);
  assert.match(sub.heading, /Impellers/);
  assert.match(sub.description, /Marine Pump/);
  assert.doesNotMatch(sub.description, /in stock|guaranteed/i);
});

test("category guide image prefers a custom managed image, then catalog photos, then an existing local asset", () => {
  assert.equal(getCategoryIntroImage("https://example.com/managed.webp", ["/media/one.webp"]), "https://example.com/managed.webp");
  assert.equal(getCategoryIntroImage("/images/marine-gearbox.jpg", ["/media/one.webp"]), "/media/one.webp");
  assert.equal(getCategoryIntroImage("/images/anchor-chain.jpg", []), "/images/warehouse.webp");
  assert.equal(getCategoryIntroImage("", [undefined, "/media/second.webp"]), "/media/second.webp");
});

test("both category routes show the reusable intro immediately after the breadcrumb", async () => {
  const [category, subcategory, component] = await Promise.all([
    source("src/pages/category/[category].astro"),
    source("src/pages/category/[category]/[subcategory].astro"),
    source("src/components/CategoryIntroSection.astro")
  ]);
  for (const page of [category, subcategory]) {
    assert.match(page, /import CategoryIntroSection/);
    assert.match(page, /getCategoryIntroCopy/);
    assert.match(page, /getCategoryIntroImage/);
    assert.ok(page.indexOf("<Breadcrumbs") < page.indexOf("<CategoryIntroSection"));
    assert.match(page, /imageUrl=\{categoryIntroImage\}/);
    assert.match(page, /copy=\{categoryIntro\}/);
  }
  assert.match(component, /data-category-intro/);
  assert.match(component, /<figure[\s\S]*<img/);
  assert.match(component, /<h2>\{copy.heading\}<\/h2>/);
  assert.match(component, /<p class="category-intro-lead">\{copy.description\}<\/p>/);
  assert.match(component, /\{copy.uses\}/);
  assert.match(component, /\{copy.guidance\}/);
  assert.match(component, /@media \(max-width: 780px\)/);
  // No new top-level section: existing positional saved page edits stay mapped.
  assert.match(component, /<div class="category-intro-shell"[\s\S]*<section class="category-intro/);
});

test("the existing authenticated page editor can update intro text and replace an intro image", async () => {
  const [layout, editor, overrides, upload] = await Promise.all([
    source("src/layouts/MainLayout.astro"),
    source("src/components/admin/UniversalPageEditor.astro"),
    source("src/lib/server/page-overrides.ts"),
    source("src/pages/api/upload.ts")
  ]);
  assert.match(layout, /getPageOverrides/);
  assert.match(layout, /editable=\{pageEditingAuthenticated\}/);
  assert.match(editor, /root.querySelectorAll\('section'\)/);
  assert.match(editor, /h1,h2,h3,h4,h5,h6,p,li,[^']*img/);
  assert.match(editor, /Replace image/);
  assert.match(editor, /compressToWebp/);
  assert.match(editor, /fetch\('\/api\/page-overrides'/);
  assert.match(overrides, /INSERT INTO page_overrides/);
  assert.match(upload, /requireAdminRequest/);
});
