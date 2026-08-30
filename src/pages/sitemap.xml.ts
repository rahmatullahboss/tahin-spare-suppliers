import type { APIRoute } from "astro";
import { toUrlSlug } from "../lib/seo";
import { getRuntimeEnv } from "../lib/server/env";
import { getSitemapSnapshot, type SitemapSnapshot } from "../lib/server/sitemap-data";

const SITE_URL = "https://tahinspare.com";

type SitemapPage = {
  url: string;
  lastmod?: string;
};

const STATIC_PAGES: SitemapPage[] = [
  { url: "/" },
  { url: "/about" },
  { url: "/products" },
  { url: "/brands" },
  { url: "/services" },
  { url: "/enquiry" },
  { url: "/contact" },
  { url: "/business-info" },
  { url: "/privacy" },
  { url: "/terms" },
  { url: "/blog" }
];

function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split("T")[0];
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async (context) => {
  const env = getRuntimeEnv(context.locals);
  let snapshot: SitemapSnapshot;
  try {
    snapshot = await getSitemapSnapshot(env);
  } catch (error) {
    console.error("Sitemap data collection failed", error);
    snapshot = { products: [], parts: [], blogPosts: [], categories: [], subcategories: [] };
  }
  const { products, parts, blogPosts, categories, subcategories } = snapshot;

  const dynamicPages: SitemapPage[] = [];

  products.forEach((product) => {
    dynamicPages.push({
      url: `/products/${product.slug}`,
      lastmod: isoDate(product.updatedAt)
    });
  });

  if (parts.length > 0) {
    dynamicPages.push({ url: "/parts" });
    parts.forEach((part) => {
      dynamicPages.push({
        url: `/parts/${part.slug}`,
        lastmod: isoDate(part.updatedAt)
      });
    });
  }

  blogPosts.forEach((post) => {
    dynamicPages.push({
      url: `/blog/${post.slug}`,
      lastmod: isoDate(post.updatedAt)
    });
  });

  categories.forEach((category) => {
    const categoryProducts = products.filter((product) => product.category === category.value);
    if (categoryProducts.length > 0) {
      dynamicPages.push({ url: `/category/${category.slug}` });
    }
  });

  subcategories.forEach((subcategory) => {
    const parent = categories.find((category) => category.id === subcategory.parentId);
    if (!parent) return;

    const subcategoryProducts = products.filter(
      (product) => product.category === parent.value && product.subcategory === subcategory.value
    );
    if (subcategoryProducts.length > 0) {
      dynamicPages.push({ url: `/category/${parent.slug}/${subcategory.slug}` });
    }
  });

  const brandSlugs = new Set(
    products.map((product) => product.brand ? toUrlSlug(product.brand) : "").filter(Boolean)
  );
  brandSlugs.forEach((brandSlug) => {
    dynamicPages.push({ url: `/brands/${brandSlug}` });
  });

  const pageMap = new Map<string, SitemapPage>();
  [...STATIC_PAGES, ...dynamicPages].forEach((page) => pageMap.set(page.url, page));
  const allPages = [...pageMap.values()];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((page) => `  <url>
    <loc>${xmlEscape(`${SITE_URL}${page.url}`)}</loc>${page.lastmod ? `
    <lastmod>${xmlEscape(page.lastmod)}</lastmod>` : ""}
  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
};
