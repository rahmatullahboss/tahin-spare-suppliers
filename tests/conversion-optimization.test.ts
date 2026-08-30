import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCategoryBuyingGuidance } from "../src/lib/category-buying-guidance.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage proves current supply scope and serves named B2B buyers without unsupported brand claims", async () => {
  const homepage = await source("src/pages/index.astro");

  assert.match(homepage, /listProductSummaries/);
  assert.match(homepage, /liveCategories/);
  assert.match(homepage, /liveBrands/);
  assert.match(homepage, /ship owners/i);
  assert.match(homepage, /technical superintendents/i);
  assert.match(homepage, /procurement teams/i);
  assert.match(homepage, /Online Inventory Listings/i);
  assert.match(homepage, /Brands in Current Listings/i);
  assert.match(homepage, /What to Send for a Faster Quote/i);
  assert.doesNotMatch(homepage, /MAJOR BRANDS WE CARRY/i);
  assert.doesNotMatch(homepage, /rolls-royce\.svg|mtu-friedrichshafen|detroit-diesel-logo/i);
});

test("priority category guidance is category-specific rather than one generic template", () => {
  const spares = getCategoryBuyingGuidance("Spare Parts");
  const generators = getCategoryBuyingGuidance("Diesel & Gas Generator Set");
  const gearbox = getCategoryBuyingGuidance("Marine Gearbox");

  assert.match(spares.requestDetails.join(" "), /part number/i);
  assert.match(generators.requestDetails.join(" "), /voltage|frequency|kVA/i);
  assert.match(gearbox.requestDetails.join(" "), /ratio/i);
  assert.notDeepEqual(spares.requestDetails, generators.requestDetails);
  assert.notDeepEqual(generators.requestDetails, gearbox.requestDetails);
});

test("category pages render the unique buyer guidance and contextual RFQ", async () => {
  const categoryPage = await source("src/pages/category/[category].astro");

  assert.match(categoryPage, /getCategoryBuyingGuidance/);
  assert.match(categoryPage, /buyingGuidance/);
  assert.match(categoryPage, /What to Send for a Faster Quote/);
  assert.match(categoryPage, /Supply &(?:amp;)? Inspection Notes/);
  assert.match(categoryPage, /category=\$\{encodeURIComponent\(currentCategory\.value\)\}/);
});

test("product RFQ preserves exact buyer context and exposes a mobile conversion bar", async () => {
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(productPage, /quoteParams/);
  assert.match(productPage, /quoteParams\.set\("product"/);
  assert.match(productPage, /quoteParams\.set\("brand"/);
  assert.match(productPage, /quoteParams\.set\("category"/);
  assert.match(productPage, /quoteParams\.set\("model"/);
  assert.match(productPage, /quoteParams\.set\("part"/);
  assert.match(productPage, /mobile-quote-bar/);
  assert.match(productPage, /data-ga-event="request_quote_click"/);
  assert.match(productPage, /data-ga-event="whatsapp_product_click"/);
});

test("enquiry page preserves product model part brand and category context through conversion", async () => {
  const enquiryPage = await source("src/pages/enquiry.astro");

  assert.match(enquiryPage, /requestedCategory/);
  assert.match(enquiryPage, /requestedModel/);
  assert.match(enquiryPage, /requestedPart/);
  assert.match(enquiryPage, /data-enquiry-context/);
  assert.match(enquiryPage, /selected=\{cat\.value === requestedCategory\}/);
  assert.match(enquiryPage, /lead_context:/);
  assert.match(enquiryPage, /if \(res\.ok\)[\s\S]*generate_lead/);
});
