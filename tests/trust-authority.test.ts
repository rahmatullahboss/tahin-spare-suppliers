import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { BUSINESS_PROFILE } from "../src/lib/business-profile.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("business identity has one normalized source of truth", () => {
  assert.equal(BUSINESS_PROFILE.name, "Tahin Spare Suppliers");
  assert.equal(BUSINESS_PROFILE.email, "sales@tahinspare.com");
  assert.equal(BUSINESS_PROFILE.phone.e164, "+8801710917904");
  assert.equal(BUSINESS_PROFILE.whatsapp.primary.e164, "+8801787429268");
  assert.match(BUSINESS_PROFILE.address.singleLine, /Bhatiary, Sitakunda, Chattogram, Bangladesh/);
  assert.equal(BUSINESS_PROFILE.establishedYear, 1990);
});

test("organization schema and public contact surfaces consume the normalized business profile", async () => {
  const layout = await source("src/layouts/MainLayout.astro");
  const footer = await source("src/components/Footer.astro");
  const contact = await source("src/pages/contact.astro");
  const enquiry = await source("src/pages/enquiry.astro");

  for (const page of [layout, contact]) {
    assert.match(page, /BUSINESS_PROFILE/);
  }

  assert.match(layout, /BUSINESS_PROFILE\.social\.facebook/);
  assert.match(layout, /BUSINESS_PROFILE\.social\.linkedin/);
  assert.doesNotMatch(contact, /\+88-01710917904/);
  assert.match(footer, /BUSINESS_PROFILE\.email/);
  assert.match(footer, /BUSINESS_PROFILE\.address\.singleLine/);
  assert.match(enquiry, /BUSINESS_PROFILE\.email/);
  assert.match(enquiry, /BUSINESS_PROFILE\.address\.singleLine/);
});

test("trust and policy pages remain crawlable after restoring the previous footer UI", async () => {
  const business = await source("src/pages/business-info.astro");
  const privacy = await source("src/pages/privacy.astro");
  const terms = await source("src/pages/terms.astro");
  const footer = await source("src/components/Footer.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");

  assert.match(business, /Business Information/);
  assert.match(business, /quote-based/i);
  assert.match(business, /BUSINESS_PROFILE/);
  assert.match(privacy, /contact and enquiry forms/i);
  assert.match(privacy, /Google Analytics/i);
  assert.match(terms, /not a binding offer/i);
  assert.match(terms, /written quotation/i);
  assert.match(sitemap, /\/business-info/);
  assert.match(sitemap, /\/privacy/);
  assert.match(sitemap, /\/terms/);
  assert.doesNotMatch(footer, /href="\/(?:business-info|privacy|terms)"/);
});

test("about page uses first-party evidence without unsupported superlatives or stale inventory claims", async () => {
  const about = await source("src/pages/about.astro");

  assert.doesNotMatch(about, /grown into a global name/i);
  assert.doesNotMatch(about, /highest quality/i);
  assert.doesNotMatch(about, /legacy of trust, quality, and reliability/i);
  assert.doesNotMatch(about, /High-quality reconditioned marine gearboxes/i);
  assert.doesNotMatch(about, /Quality anchors and chains/i);
  assert.match(about, /warehouse-yard\.jpg/);
  assert.match(about, /team-workshop\.webp/);
  assert.match(about, /product-specific/i);
});

test("services scope stays conditional and evidence-based", async () => {
  const services = await source("src/pages/services.astro");

  assert.doesNotMatch(services, /Load testing &amp; performance verification<\/li>/);
  assert.doesNotMatch(services, /Brands: Yanmar/);
  assert.match(services, /when included in the agreed scope/i);
  assert.match(services, /supporting evidence/i);
  assert.match(services, /destination-specific/i);
});
