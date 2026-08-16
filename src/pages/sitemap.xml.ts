import type { APIRoute } from "astro";
import { toUrlSlug } from "../lib/seo";
import type { CustomCategory, DisplayCategory } from "../lib/categories";
import { listAllCategories, listAllSubcategories } from "../lib/server/categories";
import { getRuntimeEnv } from "../lib/server/env";
import { listAllContent, type ContentRecord } from "../lib/server/repository";

const SITE_URL = "https://tahinspare.com";

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/about", priority: "0.7", changefreq: "monthly" },
  { url: "/products", priority: "0.9", changefreq: "weekly" },
  { url: "/brands", priority: "0.8", changefreq: "weekly" },
  { url: "/services", priority: "0.6", changefreq: "monthly" },
  { url: "/enquiry", priority: "0.8", changefreq: "monthly" },
  { url: "/contact", priority: "0.6", changefreq: "monthly" },
  { url: "/blog", priority: "0.7", changefreq: "weekly" }
];

type SitemapPage = {
  url: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
};

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
  let products: ContentRecord[] = [];
  let parts: ContentRecord[] = [];
  let blogPosts: ContentRecord[] = [];
  let categories: DisplayCategory[] = [];
  let subcategories: CustomCategory[] = [];

  const results = await Promise.allSettled([
    listAllContent(env, "products"),
    listAllContent(env, "parts"),
    listAllContent(env, "blog"),
    listAllCategories(env),
    listAllSubcategories(env)
  ]);

  if (results[0].status === "fulfilled") products = results[0].value;
  else console.error("Sitemap product collection failed", results[0].reason);
  if (results[1].status === "fulfilled") parts = results[1].value;
  else console.error("Sitemap parts collection failed", results[1].reason);
  if (results[2].status === "fulfilled") blogPosts = results[2].value;
  else console.error("Sitemap blog collection failed", results[2].reason);
  if (results[3].status === "fulfilled") categories = results[3].value;
  else console.error("Sitemap category collection failed", results[3].reason);
  if (results[4].status === "fulfilled") subcategories = results[4].value;
  else console.error("Sitemap subcategory collection failed", results[4].reason);

  const dynamicPages: SitemapPage[] = [];

  products.forEach((product) => {
    dynamicPages.push({
      url: `/products/${product.slug}`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: isoDate(product.updatedAt)
    });
  });

  parts.forEach((part) => {
    dynamicPages.push({
      url: `/parts/${part.slug}`,
      priority: "0.7",
      changefreq: "weekly",
      lastmod: isoDate(part.updatedAt)
    });
  });

  blogPosts.forEach((post) => {
    dynamicPages.push({
      url: `/blog/${post.slug}`,
      priority: "0.6",
      changefreq: "monthly",
      lastmod: isoDate(post.updatedAt)
    });
  });

  categories.forEach((category) => {
    dynamicPages.push({
      url: `/category/${category.slug}`,
      priority: "0.8",
      changefreq: "weekly"
    });
  });

  subcategories.forEach((subcategory) => {
    const parent = categories.find((category) => category.id === subcategory.parentId);
    if (!parent) return;
    dynamicPages.push({
      url: `/category/${parent.slug}/${subcategory.slug}`,
      priority: "0.75",
      changefreq: "weekly"
    });
  });

  const brandSlugs = new Set(products.map((product) => product.brand ? toUrlSlug(product.brand) : "").filter(Boolean));
  brandSlugs.forEach((brandSlug) => {
    dynamicPages.push({ url: `/brands/${brandSlug}`, priority: "0.75", changefreq: "weekly" });
  });

  const pageMap = new Map<string, SitemapPage>();
  [...STATIC_PAGES, ...dynamicPages].forEach((page) => pageMap.set(page.url, page));
  const allPages = [...pageMap.values()];
  const today = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map((page) => `  <url>
    <loc>${xmlEscape(`${SITE_URL}${page.url}`)}</loc>
    <lastmod>${xmlEscape(page.lastmod ?? today)}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
};
