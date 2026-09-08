import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getBrandLogoAsset } from "../src/lib/brand-logos.ts";
import { shouldShowCategoryBrandDirectory } from "../src/lib/category-brand-directory.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("known marine brands resolve to real logo assets", () => {
  assert.match(getBrandLogoAsset("Cummins")?.url ?? "", /cummins\.svg$/);
  assert.match(getBrandLogoAsset("Caterpillar")?.url ?? "", /caterpillar-logo2\.svg$/);
  assert.equal(getBrandLogoAsset("Unknown Maker"), null);
});

test("top-level category page keeps the brand/model directory implementation behind the approved-category gate", async () => {
  const page = await source("src/pages/category/[category].astro");

  assert.match(page, /shouldShowCategoryBrandDirectory\(currentCategory\)/);
  assert.match(page, /showBrandModelDirectory \? listBrands\(env\) : Promise\.resolve\(\[\]\)/);
  assert.match(page, /showBrandModelDirectory && brandModelDirectory\.length > 0/);
  assert.match(page, /brandModelDirectory/);
  assert.match(page, /categoryProducts\.reduce/);
  assert.match(page, /Browse \{currentCategory\.value\} by Brand & Model/);
  assert.match(page, /category-brand-logo/);
  assert.match(page, /category-brand-fallback/);
  assert.match(page, /\/products\/\$\{model\.slug\}/);
  assert.doesNotMatch(page, /brand-seo-links/);
});

test("brand/model directory is limited to the five approved category families", () => {
  for (const category of [
    { slug: "marine-propulsion-engine", value: "Marine Propulsion Engine" },
    { slug: "auxiliary-engine", value: "Auxiliary Engine" },
    { slug: "marine-generator-set", value: "Marine Generator Set" },
    { slug: "diesel-generator-set", value: "Diesel & Gas Generator Set" },
    { slug: "spare-parts", value: "Spare Parts" },
  ]) {
    assert.equal(shouldShowCategoryBrandDirectory(category), true, category.value);
  }

  for (const category of [
    { slug: "marine-gearbox", value: "Marine Gearbox" },
    { slug: "hydraulic-deck-crane-equipment", value: "Hydraulic Deck Crane Equipment" },
    { slug: "anchor-and-chain", value: "Anchor and Chain" },
    { slug: "marine-pump", value: "Marine Pump" },
    { slug: "custom-other-category", value: "Other Equipment" },
  ]) {
    assert.equal(shouldShowCategoryBrandDirectory(category), false, category.value);
  }
});

test("custom category naming variants still keep the approved generator directories", () => {
  assert.equal(
    shouldShowCategoryBrandDirectory({ slug: "custom-generator", canonicalValue: "Marine Generator Sets" }),
    true
  );
  assert.equal(
    shouldShowCategoryBrandDirectory({ slug: "custom-diesel-generator", canonicalValue: "Diesel and Gas Generator Set" }),
    true
  );
});

test("homepage restores the running brand-logo marquee without moving the brand-model directory back home", async () => {
  const homepage = await source("src/pages/index.astro");
  assert.match(homepage, /brands-marquee/);
  assert.match(homepage, /listBrands\(env\)/);
  assert.match(homepage, /brand\.displayLogoUrl/);
  assert.match(homepage, /@keyframes marquee-scroll/);
  assert.match(homepage, /\.recent-shipments-track[\s\S]*animation: marquee-scroll/);
  assert.doesNotMatch(homepage, /modelDirectory|model-directory-grid/);
});
