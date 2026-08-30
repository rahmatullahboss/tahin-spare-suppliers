import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

import {
  canonicalizeBrand,
  cleanProductTitle,
  normalizeVerificationDate,
  resolvePublicAvailability,
} from "../src/lib/inventory-quality.ts";

test("canonicalizeBrand collapses real production aliases and typos", () => {
  assert.equal(canonicalizeBrand("Cat"), "Caterpillar");
  assert.equal(canonicalizeBrand("Caterpillar (CAT)"), "Caterpillar");
  assert.equal(canonicalizeBrand("Yamnar "), "Yanmar");
  assert.equal(canonicalizeBrand("YANMAR "), "Yanmar");
  assert.equal(canonicalizeBrand("Yanmar Diesel"), "Yanmar");
  assert.equal(canonicalizeBrand("Man-B&W"), "MAN B&W");
  assert.equal(canonicalizeBrand("Man B&W"), "MAN B&W");
  assert.equal(canonicalizeBrand("MAN B&W Diesel (Augsburg, Germany)"), "MAN B&W");
  assert.equal(canonicalizeBrand("Daitshu "), "Daihatsu");
  assert.equal(canonicalizeBrand("Diatshu "), "Daihatsu");
  assert.equal(canonicalizeBrand("Macgregor "), "MacGregor");
  assert.equal(canonicalizeBrand("McGregor "), "MacGregor");
  assert.equal(canonicalizeBrand("Caterpillar "), "Caterpillar");
});

test("canonicalizeBrand preserves intentional multi-brand identities", () => {
  assert.equal(canonicalizeBrand("MAN B&W and SULZER "), "MAN B&W and SULZER");
  assert.equal(canonicalizeBrand("Sulzer RTA & Mitsubishi UEC"), "Sulzer RTA & Mitsubishi UEC");
});

test("cleanProductTitle removes conservative editor update markers only", () => {
  assert.equal(cleanProductTitle("Connecting Rod For Man B&W 5L16 Update 24 "), "Connecting Rod For Man B&W 5L16");
  assert.equal(cleanProductTitle("Piston for MAN B&W 5L16 update 24 "), "Piston for MAN B&W 5L16");
  assert.equal(cleanProductTitle("[Updated 24] Yanmar 6N18 Engine"), "Yanmar 6N18 Engine");
  assert.equal(cleanProductTitle("Used 430ZJ Fuel Valve Test Pump Unit for Sale (60Mpa)"), "Used 430ZJ Fuel Valve Test Pump Unit for Sale (60Mpa)");
});

test("normalizeVerificationDate accepts real calendar dates and rejects unsafe values", () => {
  assert.equal(normalizeVerificationDate("2026-08-30"), "2026-08-30");
  assert.equal(normalizeVerificationDate("2026-08-30T12:00:00Z"), "2026-08-30");
  assert.equal(normalizeVerificationDate(new Date("2026-08-30T12:00:00Z")), "2026-08-30");
  assert.equal(normalizeVerificationDate("2026-02-30"), "");
  assert.equal(normalizeVerificationDate("not-a-date"), "");
  assert.equal(normalizeVerificationDate(""), "");
});

test("verified stock is downgraded when missing or stale verification evidence", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  assert.deepEqual(resolvePublicAvailability({
    availability: "Verified in Stock, June 2026",
    verifiedAt: "",
    now,
    maxAgeDays: 30,
  }), {
    label: "Contact to confirm current availability",
    fresh: false,
    positive: false,
    verifiedAt: "",
  });

  assert.deepEqual(resolvePublicAvailability({
    availability: "Verified in Stock",
    verifiedAt: "2026-07-01",
    now,
    maxAgeDays: 30,
  }), {
    label: "Contact to confirm current availability",
    fresh: false,
    positive: false,
    verifiedAt: "2026-07-01",
  });
});

test("fresh verified stock stays explicit and terminal unavailable states are preserved", () => {
  const now = new Date("2026-08-30T12:00:00Z");

  assert.deepEqual(resolvePublicAvailability({
    availability: "Verified in Stock",
    verifiedAt: "2026-08-20",
    now,
    maxAgeDays: 30,
  }), {
    label: "Verified in Stock",
    fresh: true,
    positive: true,
    verifiedAt: "2026-08-20",
  });

  assert.deepEqual(resolvePublicAvailability({
    availability: "Sold",
    verifiedAt: "2026-01-01",
    now,
    maxAgeDays: 30,
  }), {
    label: "Sold",
    fresh: true,
    positive: false,
    verifiedAt: "2026-01-01",
  });

  assert.deepEqual(resolvePublicAvailability({
    availability: "Not available",
    verifiedAt: "2026-08-20",
    now,
    maxAgeDays: 30,
  }), {
    label: "Not available",
    fresh: true,
    positive: false,
    verifiedAt: "2026-08-20",
  });
});

test("inventory verification metadata is persisted, editable and enforced publicly", async () => {
  const schema = await source("src/lib/server/schema.sql");
  const repository = await source("src/lib/server/repository.ts");
  const editor = await source("src/components/admin/ContentEditor.astro");
  const productPage = await source("src/pages/products/[slug].astro");
  const env = await source("src/lib/server/env.ts");

  assert.match(schema, /availability_verified_at\s+DATE/i);
  assert.match(schema, /condition_verified_at\s+DATE/i);
  assert.match(repository, /canonicalizeBrand/);
  assert.match(repository, /cleanProductTitle/);
  assert.match(repository, /availabilityVerifiedAt/);
  assert.match(repository, /conditionVerifiedAt/);
  assert.match(editor, /name="availabilityVerifiedAt"/);
  assert.match(editor, /name="conditionVerifiedAt"/);
  assert.match(editor, /data-availability-verified-at/);
  assert.match(editor, /data-condition-verified-at/);
  const brandPage = await source("src/pages/brands/[brand].astro");

  assert.match(productPage, /resolvePublicAvailability/);
  assert.match(productPage, /INVENTORY_VERIFICATION_MAX_AGE_DAYS/);
  assert.match(env, /INVENTORY_VERIFICATION_MAX_AGE_DAYS\?: string/);
  assert.match(brandPage, /canonicalizeBrand/);
  assert.match(brandPage, /Astro\.redirect\(`\/brands\/\$\{canonicalBrandSlug\}`,\s*301\)/);
});
