import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getBrandLogoAsset } from "../src/lib/brand-logos.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("known marine brands resolve to real logo assets", () => {
  assert.match(getBrandLogoAsset("Cummins")?.url ?? "", /cummins\.svg$/);
  assert.match(getBrandLogoAsset("Caterpillar")?.url ?? "", /caterpillar-logo2\.svg$/);
  assert.equal(getBrandLogoAsset("Unknown Maker"), null);
});

test("top-level category pages group their own products by brand and model with logos", async () => {
  const page = await source("src/pages/category/[category].astro");

  assert.match(page, /brandModelDirectory/);
  assert.match(page, /categoryProducts\.reduce/);
  assert.match(page, /Browse \{currentCategory\.value\} by Brand & Model/);
  assert.match(page, /category-brand-logo/);
  assert.match(page, /category-brand-fallback/);
  assert.match(page, /\/products\/\$\{model\.slug\}/);
  assert.doesNotMatch(page, /brand-seo-links/);
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
