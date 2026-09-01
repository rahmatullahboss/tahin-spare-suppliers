import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile navigation keeps the client-approved previous menu", async () => {
  const header = await source("src/components/Header.astro");

  for (const label of ["Home", "About Us", "Sell Equipments", "Our Services", "Enquiry", "Blog", "Contact Us"]) {
    assert.match(header, new RegExp(`>${label}<\\/a>`));
  }

  for (const laterLabel of ["Engines", "Gensets", "Spare Parts", "Hydraulics", "Brands", "Resources", "Request Quote"]) {
    assert.doesNotMatch(header, new RegExp(`>${laterLabel}<\\/a>`));
  }
});

test("product hero uses the clicked product image when available", async () => {
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(productPage, /class="page-hero-bg"/);
  assert.match(productPage, /src=\{product\.imageUrl\}/);
  assert.match(productPage, /product\.imageUrl\s*&&/);
  assert.match(productPage, /\.page-hero-bg\s*\{/);
  assert.match(productPage, /object-fit:\s*cover/);
});

test("footer no longer renders the Created by credit", async () => {
  const footer = await source("src/components/Footer.astro");

  assert.doesNotMatch(footer, /Created by/i);
  assert.doesNotMatch(footer, /digitalcare\.site/i);
});


test("generic warehouse hero is removed from client-facing public page backgrounds", async () => {
  const paths = [
    "src/pages/index.astro",
    "src/pages/services.astro",
    "src/pages/blog/index.astro",
    "src/pages/blog/[slug].astro",
    "src/pages/brands.astro",
    "src/pages/brands/[brand].astro",
    "src/pages/parts/index.astro",
    "src/pages/parts/[slug].astro",
    "src/pages/products/[slug].astro",
  ];

  const pages = await Promise.all(paths.map(source));
  for (const page of pages) assert.doesNotMatch(page, /warehouse\.webp/);

  assert.match(pages[0], /team-workshop.webp/);
  assert.match(pages[1], /team-workshop.webp/);
  assert.match(pages[2], /warehouse-yard.jpg/);
  assert.match(pages[3], /warehouse-yard.jpg/);
});
