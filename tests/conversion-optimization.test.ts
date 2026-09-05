import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCategoryBuyingGuidance } from "../src/lib/category-buying-guidance.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage keeps the client content structure without the category-specific brand directory", async () => {
  const [homepage, cmsDefaults] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/lib/page-content.ts")
  ]);

  assert.match(homepage, /getHomepageContent/);
  assert.match(homepage, /listAllCategories/);
  assert.match(homepage, /categories\.map/);
  assert.doesNotMatch(homepage, /liveCategories/);
  assert.doesNotMatch(homepage, /listProductSummaries/);
  assert.match(cmsDefaults, /REQUEST A QUOTE/);
  assert.match(cmsDefaults, /MARINE ENGINE & SPARE PARTS/);
  assert.doesNotMatch(homepage, /brands-marquee/);
  assert.doesNotMatch(homepage, /modelDirectory/);
  assert.doesNotMatch(homepage, /Browse Engine Models by Brand/i);
  assert.doesNotMatch(homepage, /MAJOR BRANDS WE CARRY/i);
  assert.doesNotMatch(homepage, /buyer-proof/);
  assert.doesNotMatch(homepage, /live-brand-grid/);
  assert.doesNotMatch(homepage, /quote-prep-section/);
});

test("category-specific procurement guidance remains available as backend content logic", () => {
  const spares = getCategoryBuyingGuidance("Spare Parts");
  const generators = getCategoryBuyingGuidance("Diesel & Gas Generator Set");
  const gearbox = getCategoryBuyingGuidance("Marine Gearbox");

  assert.match(spares.requestDetails.join(" "), /part number/i);
  assert.match(generators.requestDetails.join(" "), /voltage|frequency|kVA/i);
  assert.match(gearbox.requestDetails.join(" "), /ratio/i);
  assert.notDeepEqual(spares.requestDetails, generators.requestDetails);
  assert.notDeepEqual(generators.requestDetails, gearbox.requestDetails);
});

test("category pages use the earlier FAQ presentation and keep technical indexability rules", async () => {
  const categoryPage = await source("src/pages/category/[category].astro");

  assert.match(categoryPage, /Frequently Asked Questions/);
  assert.match(categoryPage, /noindex=\{categoryProducts\.length === 0\}/);
  assert.match(categoryPage, /listProductSummaries/);
  assert.doesNotMatch(categoryPage, /buyer-guidance/);
  assert.doesNotMatch(categoryPage, /category-quote-link/);
});

test("product page keeps normal quote actions without the later fixed mobile conversion bar", async () => {
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(productPage, /data-ga-event="request_quote_click"/);
  assert.match(productPage, /data-ga-event="whatsapp_product_click"/);
  assert.match(productPage, /resolvePublicAvailability/);
  assert.doesNotMatch(productPage, /mobile-quote-bar/);
  assert.doesNotMatch(productPage, /quoteParams/);
});

test("enquiry keeps product and brand prefill plus successful GA lead tracking without the added context card", async () => {
  const enquiryPage = await source("src/pages/enquiry.astro");

  assert.match(enquiryPage, /requestedProduct/);
  assert.match(enquiryPage, /requestedBrand/);
  assert.match(enquiryPage, /enquiryContext/);
  assert.match(enquiryPage, /if \(res\.ok\)[\s\S]*generate_lead/);
  assert.doesNotMatch(enquiryPage, /enquiry-context-card/);
  assert.doesNotMatch(enquiryPage, /data-enquiry-context/);
});
