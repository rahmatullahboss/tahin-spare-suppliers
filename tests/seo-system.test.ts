import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCanonicalRedirectUrl } from "../src/lib/canonical-url.ts";
import {
  buildDefaultMetaDescription,
  buildDefaultSeoTitle,
  findProductIdentityConflict,
  parseRelatedProductSlugs,
  resolveCategorySeo,
  resolveLegacyProductRedirect,
  resolveProductSeo,
  schemaConditionUrl,
  toUrlSlug
} from "../src/lib/seo.ts";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public URL canonicalization converges protocol and host without touching local development", async () => {
  assert.equal(
    getCanonicalRedirectUrl("http://tahinspare.com/products?brand=Yanmar#results"),
    "https://tahinspare.com/products?brand=Yanmar#results"
  );
  assert.equal(
    getCanonicalRedirectUrl("https://www.tahinspare.com/category/spare-parts"),
    "https://tahinspare.com/category/spare-parts"
  );
  assert.equal(getCanonicalRedirectUrl("https://tahinspare.com/category/spare-parts"), undefined);
  assert.equal(getCanonicalRedirectUrl("http://localhost:4321/category/spare-parts"), undefined);

  const middleware = await source("src/middleware.ts");
  assert.match(middleware, /getCanonicalRedirectUrl\(url\)/);
  assert.match(middleware, /status:\s*301/);
});

test("product SEO defaults follow the buyer-intent Cummins example", () => {
  const title = buildDefaultSeoTitle("Cummins VTA-28 Marine Engine");
  const description = buildDefaultMetaDescription({
    title: "Cummins VTA-28 Marine Engine",
    location: "Bangladesh"
  });

  assert.equal(title, "Cummins VTA-28 Marine Engine for Sale | Tahin Spare Suppliers");
  assert.match(description, /^Cummins VTA-28 Marine Engine available from Tahin Spare Suppliers, Bangladesh\./);
  assert.ok(description.length <= 160);
});

test("manual SEO fields override generated defaults without losing image fallback", () => {
  const seo = resolveProductSeo({
    title: "Caterpillar 3512 Marine Engine",
    modelNumber: "3512",
    seoTitle: "Custom CAT 3512 SEO Title",
    metaDescription: "Custom description for procurement buyers.",
    focusKeyword: "CAT 3512 marine engine"
  });

  assert.equal(seo.seoTitle, "Custom CAT 3512 SEO Title");
  assert.equal(seo.metaDescription, "Custom description for procurement buyers.");
  assert.equal(seo.focusKeyword, "CAT 3512 marine engine");
  assert.match(seo.imageAlt, /Caterpillar 3512 Marine Engine/);
});

test("condition schema mapping does not invent an unknown condition", () => {
  assert.equal(schemaConditionUrl("Reconditioned"), "https://schema.org/RefurbishedCondition");
  assert.equal(schemaConditionUrl("Used / As Removed"), "https://schema.org/UsedCondition");
  assert.equal(schemaConditionUrl("New"), "https://schema.org/NewCondition");
  assert.equal(schemaConditionUrl("Contact us"), undefined);
});

test("related product slugs are normalized and deduplicated", () => {
  assert.deepEqual(
    parseRelatedProductSlugs("Cummins VTA-28, cummins-vta-28, CAT 3512"),
    ["cummins-vta-28", "cat-3512"]
  );
  assert.equal(toUrlSlug("MAN B&W 6S50MC-C"), "man-b-w-6s50mc-c");
});

test("legacy product redirects preserve exact historical commercial URL authority", () => {
  assert.equal(
    resolveLegacyProductRedirect("connecting-rod-for-man-b-w-5l-16-24"),
    "/products/man-b-w-5l16-24-genuine-spare-parts-5l-6l"
  );
  assert.equal(
    resolveLegacyProductRedirect("cummins-vta-28-d-m-marine-engine-815hp"),
    "/products/cummins-vta28-dm-815hp-marine-engine"
  );
  assert.equal(
    resolveLegacyProductRedirect("yanmar-nz62-hydraulic-governor-for-sale"),
    "/products/yanmar-nz61-hydraulic-governor-for-sale"
  );
  assert.equal(resolveLegacyProductRedirect("cummins-vta28-dm-815hp-marine-engine"), undefined);
  assert.equal(resolveLegacyProductRedirect("unknown-product"), undefined);
});

test("product identity guard catches conflicting model codes without inventing conflicts", () => {
  assert.match(
    findProductIdentityConflict({
      slug: "yanmar-nz62-hydraulic-governor-for-sale",
      title: "Yanmar NZ61 Hydraulic Governor for Sale",
      modelNumber: "Yanmar NZ61 Governor",
      seoTitle: "Yanmar NZ61 Hydraulic Governor for Sale | Tahin Spare Suppliers"
    }) ?? "",
    /NZ61.*NZ62/i
  );

  assert.equal(findProductIdentityConflict({
    slug: "used-cummins-vta-28-marine-engine",
    title: "Cummins VTA28 Marine Engine For Sale",
    modelNumber: "Cummins VTA-28"
  }), undefined);

  assert.equal(findProductIdentityConflict({
    slug: "marine-governor-stock",
    title: "Yanmar Hydraulic Governor",
    modelNumber: ""
  }), undefined);
});

test("category SEO resolves commercial search intent without unsupported stock claims", () => {
  assert.deepEqual(resolveCategorySeo({ slug: "spare-parts", value: "Spare Parts" }), {
    title: "Marine Spare Parts Supplier | Tahin Spare Suppliers",
    description: "Browse marine engine and equipment spare parts by brand and model. Request specifications, availability, price and worldwide shipping details from Tahin Spare Suppliers."
  });
  assert.deepEqual(resolveCategorySeo({ slug: "turbocharger", value: "Turbocharger" }), {
    title: "Marine Turbocharger Supplier | Tahin Spare Suppliers",
    description: "Browse marine turbocharger listings by brand and model. Request condition, specifications, availability, price and shipping details from Tahin Spare Suppliers."
  });
  assert.deepEqual(resolveCategorySeo({ slug: "marine-pump", value: "Marine Pump" }), {
    title: "Marine Pump Supplier & Exporter | Tahin Spare Suppliers",
    description: "Browse current Marine Pump listings by brand and model. Request specifications, condition, availability, price and worldwide shipping from Tahin Spare Suppliers."
  });
});

test("database schema contains the complete product SEO and procurement contract", async () => {
  const schema = await source("src/lib/server/schema.sql");
  for (const column of [
    "part_number",
    "condition",
    "availability",
    "location",
    "technical_specifications",
    "application",
    "seo_title",
    "meta_description",
    "focus_keyword",
    "image_alt",
    "related_products"
  ]) {
    assert.match(schema, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}\\b`));
  }
});

test("repository supports parts and paginated full-content enumeration", async () => {
  const repository = await source("src/lib/server/repository.ts");
  assert.match(repository, /parts:\s*\{[\s\S]*?table:\s*"parts"/);
  assert.match(repository, /export async function listAllContent/);
  assert.match(repository, /const batchSize = 1000/);
  assert.match(repository, /partNumber\?: string/);
  assert.match(repository, /resolveProductSeo/);
});

test("product CMS exposes all required SEO-ready upload fields", async () => {
  const editor = await source("src/components/admin/ContentEditor.astro");
  for (const marker of [
    "data-part-number",
    "data-condition",
    "data-availability",
    "data-location",
    "data-application",
    "data-technical-specifications",
    "data-seo-title",
    "data-meta-description",
    "data-focus-keyword",
    "data-image-alt",
    "data-related-products",
    "data-generate-seo"
  ]) {
    assert.match(editor, new RegExp(marker));
  }
  assert.match(editor, /item\.partNumber\?\.toLowerCase\(\)\.includes\(searchQuery\)/);
  assert.match(editor, /findProductIdentityConflict/);
  assert.match(editor, /identityConflict[\s\S]*return;/);
  assert.ok(editor.indexOf("identityConflict") < editor.indexOf("if (selectedFile)"));
});

test("product API rejects identity conflicts before repository writes", async () => {
  const api = await source("src/lib/server/api.ts");
  assert.match(api, /findProductIdentityConflict/);
  assert.match(api, /validateProductIdentityInput/);
  assert.match(api, /status:\s*400/);
  assert.ok(api.indexOf("validateProductIdentityInput") < api.indexOf("createContent(env, type, body)"));
  assert.ok(api.indexOf("validateProductIdentityInput") < api.indexOf("updateContent(env, type, id, body)"));
});

test("product detail is truthful, structured and buyer-conversion ready", async () => {
  const productPage = await source("src/pages/products/[slug].astro");
  assert.doesNotMatch(productPage, /"price"\s*:\s*"0"/);
  assert.doesNotMatch(productPage, /"offers"\s*:/);
  assert.match(productPage, /"@type": "Product"/);
  assert.match(productPage, /"mpn": product\.partNumber/);
  assert.match(productPage, /<Breadcrumbs items=/);
  assert.match(productPage, /Part Number/);
  assert.match(productPage, /Technical Specifications/);
  assert.match(productPage, /WhatsApp This Product/);
  assert.match(productPage, /fetchpriority="high"/);
});

test("missing historical product slugs permanently redirect before the generic 404", async () => {
  const productPage = await source("src/pages/products/[slug].astro");
  assert.match(productPage, /resolveLegacyProductRedirect/);
  assert.match(productPage, /Astro\.redirect\(legacyRedirect,\s*301\)/);
  assert.ok(productPage.indexOf("resolveLegacyProductRedirect") < productPage.indexOf('new Response("Product not found"'));
});

test("technical SEO has environment-backed Google hooks and complete sitemap collections", async () => {
  const layout = await source("src/layouts/MainLayout.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");
  const env = await source("src/lib/server/env.ts");
  const exampleConfig = await source("wrangler.example.jsonc");

  assert.match(env, /GOOGLE_ANALYTICS_ID\?: string/);
  assert.match(env, /GOOGLE_SITE_VERIFICATION\?: string/);
  assert.match(layout, /google-site-verification/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js/);
  assert.match(exampleConfig, /"GOOGLE_ANALYTICS_ID": ""/);
  assert.match(exampleConfig, /"GOOGLE_SITE_VERIFICATION": ""/);
  assert.match(sitemap, /getSitemapSnapshot\(env\)/);
  assert.doesNotMatch(sitemap, /Promise\.allSettled/);
  assert.doesNotMatch(sitemap, /listAllContent/);
  assert.match(sitemap, /\/brands\/\$\{brandSlug\}/);
  assert.match(sitemap, /\/category\/\$\{parent\.slug\}\/\$\{subcategory\.slug\}/);
  assert.doesNotMatch(sitemap, /<priority>/);
  assert.doesNotMatch(sitemap, /<changefreq>/);
  assert.doesNotMatch(sitemap, /lastmod\s*\?\?\s*today/);
  assert.match(sitemap, /categoryProducts\.length > 0/);
  assert.match(sitemap, /subcategoryProducts\.length > 0/);
});

test("schema scope and thin taxonomy indexation stay truthful", async () => {
  const layout = await source("src/layouts/MainLayout.astro");
  const categoryPage = await source("src/pages/category/[category].astro");
  const subcategoryPage = await source("src/pages/category/[category]/[subcategory].astro");

  assert.match(layout, /const isHomepage = Astro\.url\.pathname === ['\"]\/['\"]/);
  assert.doesNotMatch(layout, /"priceRange"/);
  assert.match(layout, /isHomepage\s*&&[\s\S]*organizationSchema/);
  assert.match(categoryPage, /resolveCategorySeo/);
  assert.match(categoryPage, /title=\{categorySeo\.title\}/);
  assert.match(categoryPage, /description=\{categorySeo\.description\}/);
  assert.match(categoryPage, /noindex=\{categoryProducts\.length === 0\}/);
  assert.match(subcategoryPage, /noindex=\{filteredProducts\.length === 0\}/);
  assert.doesNotMatch(categoryPage, /"@type": "FAQPage"/);
  assert.doesNotMatch(subcategoryPage, /"@type": "FAQPage"/);
  assert.match(categoryPage, /Frequently Asked Questions/);
  assert.doesNotMatch(categoryPage, /buyer-guidance|What to Send for a Faster Quote/);
  assert.match(subcategoryPage, /Frequently Asked Questions/);
});

test("client-approved navigation and structured-content hubs preserve SEO reach", async () => {
  const header = await source("src/components/Header.astro");
  const footer = await source("src/components/Footer.astro");
  const homepage = await source("src/pages/index.astro");
  const productsHub = await source("src/pages/products.astro");
  const brands = await source("src/pages/brands.astro");
  const brandPage = await source("src/pages/brands/[brand].astro");
  const blog = await source("src/pages/blog/[slug].astro");

  assert.match(header, />About Us<\/a>/);
  assert.match(header, />Sell Equipments<\/a>/);
  assert.match(header, />Our Services<\/a>/);
  assert.match(header, />Enquiry<\/a>/);
  assert.match(header, />Blog<\/a>/);
  assert.match(header, />Contact Us<\/a>/);
  assert.match(productsHub, /Marine Engines, Generators & Spare Parts/);
  assert.doesNotMatch(productsHub, /Sell Equipments/);
  assert.doesNotMatch(homepage, /Sell Equipments/);
  assert.doesNotMatch(footer, /Sell Equipments/);
  assert.match(homepage, /Marine Equipment & Spare Parts/);
  assert.match(footer, /Products & Inventory/);
  assert.match(footer, /listAllCategories/);
  assert.match(footer, /footerCategories\.map/);
  assert.match(footer, /href=\{`\/category\/\$\{category\.slug\}`\}/);
  assert.doesNotMatch(footer, /href="\/(marine-propulsion-engines|marine-gearbox|marine-auxillary-engines|diesel-generator-sets|marine-spare-parts|hydraulic-crane-equipment|anchor-and-chain|marine-pump)"/);
  assert.match(brands, /Marine Equipment Brands/);
  assert.match(brandPage, /Brand inventory not found/);
  assert.match(blog, /"@type": "BlogPosting"/);
  assert.match(blog, /<Breadcrumbs items=/);
});

test("first-party spare-parts identification guide is public, internally linked and in the sitemap", async () => {
  const article = await source("src/pages/blog/marine-spare-parts-identification-checklist.astro");
  const blogIndex = await source("src/pages/blog/index.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");

  assert.match(article, /"@type": "BlogPosting"/);
  assert.match(article, /canonicalPath = "\/blog\/marine-spare-parts-identification-checklist"/);
  assert.match(article, /href="\/category\/spare-parts"/);
  assert.match(article, /href="\/enquiry"/);
  assert.match(blogIndex, /marine-spare-parts-identification-checklist/);
  assert.match(sitemap, /\/blog\/marine-spare-parts-identification-checklist/);
});

test("additional first-party marine buying guides are public, internally linked and in the sitemap", async () => {
  const blogIndex = await source("src/pages/blog/index.astro");
  const sitemap = await source("src/pages/sitemap.xml.ts");
  const articles = [
    {
      path: "src/pages/blog/how-to-identify-marine-turbocharger.astro",
      slug: "how-to-identify-marine-turbocharger",
      requiredLink: "/category/turbocharger"
    },
    {
      path: "src/pages/blog/marine-gearbox-identification-checklist.astro",
      slug: "marine-gearbox-identification-checklist",
      requiredLink: "/category/marine-gearbox"
    },
    {
      path: "src/pages/blog/marine-hydraulic-power-unit-hpu-quote-checklist.astro",
      slug: "marine-hydraulic-power-unit-hpu-quote-checklist",
      requiredLink: "/products/iop-marine-hpu-1500-high-pressure-hydraulic-pump"
    },
    {
      path: "src/pages/blog/reconditioned-marine-engine-buying-checklist.astro",
      slug: "reconditioned-marine-engine-buying-checklist",
      requiredLink: "/products/reconditioned-yanmar-6hal-tn-marine-generator-set-for-sale"
    }
  ];

  for (const item of articles) {
    const article = await source(item.path);
    assert.match(article, new RegExp(`canonicalPath = "/blog/${item.slug}"`));
    assert.match(article, new RegExp(`href="${item.requiredLink.replaceAll("/", "\\/")}"`));
    assert.match(blogIndex, new RegExp(item.slug));
    assert.match(sitemap, new RegExp(`/blog/${item.slug}`));
  }

  const sharedLayout = await source("src/components/blog/StaticBlogArticle.astro");
  assert.match(sharedLayout, /"@type": "BlogPosting"/);
  assert.match(sharedLayout, /canonicalUrl=\{absoluteUrl\(canonicalPath\)\}/);
  assert.match(sharedLayout, /href="\/enquiry"/);
});

test("core marketing pages avoid unsupported universal and superlative claims", async () => {
  const homepage = await source("src/pages/index.astro");
  const about = await source("src/pages/about.astro");
  const services = await source("src/pages/services.astro");
  const combined = `${homepage}\n${about}\n${services}`;

  assert.doesNotMatch(combined, /vast inventory|most competitive|ready for immediate dispatch|every product undergoes|every part is inspected, tested and certified|all kinds of reconditioned|trusted exporter|all commercial & shipping documents provided|competitive freight rates|for all engine types|Fast<br\/>Clearance/i);
});

test("buyer enquiry context and conversion analytics are wired", async () => {
  const layout = await source("src/layouts/MainLayout.astro");
  const enquiry = await source("src/pages/enquiry.astro");
  const productPage = await source("src/pages/products/[slug].astro");

  assert.match(layout, /\[data-ga-event\]/);
  assert.match(enquiry, /searchParams\.get\('product'\)/);
  assert.match(enquiry, /searchParams\.get\('brand'\)/);
  assert.match(enquiry, /analyticsWindow\.gtag\?\.\('event', 'generate_lead'/);
  assert.match(enquiry, /data-ga-event="whatsapp_contact_click"/);
  assert.match(productPage, /data-ga-event="request_quote_click"/);
  assert.match(productPage, /data-ga-event="whatsapp_product_click"/);
});

test("missing hero asset references are fully removed", async () => {
  const files = [
    "src/pages/index.astro",
    "src/pages/services.astro",
    "src/pages/marine-propulsion-engines.astro",
    "src/pages/marine-spare-parts.astro",
    "src/pages/marine-auxillary-engines.astro",
    "src/pages/diesel-generator-sets.astro",
    "src/pages/blog/index.astro",
    "src/pages/blog/[slug].astro",
    "src/pages/parts/[slug].astro",
    "src/pages/products/[slug].astro"
  ];

  for (const file of files) {
    const text = await source(file);
    assert.doesNotMatch(text, /\/images\/(services-hero\.jpg|hero-bg\.webp)/, file);
  }
});

test("legacy category pages permanently redirect to dynamic category authority", async () => {
  const expected = new Map([
    ["src/pages/marine-propulsion-engines.astro", "/category/marine-propulsion-engine"],
    ["src/pages/marine-gearbox.astro", "/category/marine-gearbox"],
    ["src/pages/marine-auxillary-engines.astro", "/category/auxiliary-engine"],
    ["src/pages/diesel-generator-sets.astro", "/category/diesel-generator-set"],
    ["src/pages/marine-spare-parts.astro", "/category/spare-parts"],
    ["src/pages/hydraulic-crane-equipment.astro", "/category/hydraulic-deck-crane-equipment"],
    ["src/pages/anchor-and-chain.astro", "/category/anchor-and-chain"],
    ["src/pages/marine-pump.astro", "/category/marine-pump"]
  ]);

  for (const [file, canonicalPath] of expected) {
    const text = await source(file);
    assert.match(text, new RegExp(`Astro\\.redirect\\(['\"]${canonicalPath}['\"],\\s*301\\)`));
  }
});

test("unvalidated brand-category programmatic pages cannot become indexable thin pages", async () => {
  const inventoryPage = await source("src/pages/inventory/[brand]-[category].astro");

  assert.match(inventoryPage, /categoryProducts\.length === 0/);
  assert.match(inventoryPage, /status:\s*404/);
  assert.match(inventoryPage, /noindex=\{true\}/);
  assert.doesNotMatch(inventoryPage, /world's largest|vast stock|Certified Reconditioned|ready for worldwide export/i);
});
