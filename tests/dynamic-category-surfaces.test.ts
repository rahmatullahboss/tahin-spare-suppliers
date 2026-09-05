import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all public category-list surfaces read the canonical configured category list", async () => {
  const [homepage, products, footer, about, enquiry] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/pages/products.astro"),
    source("src/components/Footer.astro"),
    source("src/pages/about.astro"),
    source("src/pages/enquiry.astro")
  ]);

  assert.match(homepage, /listAllCategories/);
  assert.match(homepage, /categories\.map/);
  assert.match(products, /listAllCategories/);
  assert.match(products, /categories\.map/);
  assert.match(footer, /listAllCategories/);
  assert.match(footer, /footerCategories\.map/);
  assert.match(about, /listAllCategories/);
  assert.match(about, /offerCategories\.map/);
  assert.match(enquiry, /listAllCategories/);
  assert.match(enquiry, /categories\.map/);
});

test("category surfaces do not hide newly-created empty categories behind live-product filtering", async () => {
  const [homepage, products, footer, about] = await Promise.all([
    source("src/pages/index.astro"),
    source("src/pages/products.astro"),
    source("src/components/Footer.astro"),
    source("src/pages/about.astro")
  ]);

  for (const page of [homepage, products, footer, about]) {
    assert.doesNotMatch(page, /liveCategories/);
  }
});
