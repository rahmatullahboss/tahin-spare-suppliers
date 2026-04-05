import type { APIRoute } from "astro";
import { getRuntimeEnv } from "../lib/server/env";
import { listContent } from "../lib/server/repository";
import { ensureSchema } from "../lib/server/db";

const SITE_URL = "https://tahinspare.com";

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/about", priority: "0.8", changefreq: "monthly" },
  { url: "/products", priority: "0.9", changefreq: "weekly" },
  { url: "/services", priority: "0.7", changefreq: "monthly" },
  { url: "/enquiry", priority: "0.8", changefreq: "monthly" },
  { url: "/contact", priority: "0.7", changefreq: "monthly" },
  { url: "/blog", priority: "0.7", changefreq: "weekly" },
  { url: "/marine-propulsion-engines", priority: "0.8", changefreq: "weekly" },
  { url: "/marine-gearbox", priority: "0.8", changefreq: "weekly" },
  { url: "/marine-auxillary-engines", priority: "0.8", changefreq: "weekly" },
  { url: "/diesel-generator-sets", priority: "0.8", changefreq: "weekly" },
  { url: "/marine-spare-parts", priority: "0.8", changefreq: "weekly" },
  { url: "/hydraulic-crane-equipment", priority: "0.8", changefreq: "weekly" },
  { url: "/anchor-and-chain", priority: "0.8", changefreq: "weekly" },
  { url: "/marine-pump", priority: "0.8", changefreq: "weekly" },
];

export const GET: APIRoute = async (context) => {
  let dynamicPages: { url: string; priority: string; changefreq: string; lastmod?: string }[] = [];

  try {
    const env = getRuntimeEnv(context.locals);
    await ensureSchema(env);

    const [products, parts, blogPosts] = await Promise.all([
      listContent(env, "products"),
      listContent(env, "parts"),
      listContent(env, "blog"),
    ]);

    for (const product of products) {
      dynamicPages.push({
        url: `/products/${product.slug}`,
        priority: "0.7",
        changefreq: "weekly",
        lastmod: product.updatedAt ? new Date(product.updatedAt).toISOString().split("T")[0] : undefined,
      });
    }

    for (const part of parts) {
      dynamicPages.push({
        url: `/parts/${part.slug}`,
        priority: "0.6",
        changefreq: "weekly",
        lastmod: part.updatedAt ? new Date(part.updatedAt).toISOString().split("T")[0] : undefined,
      });
    }

    for (const post of blogPosts) {
      dynamicPages.push({
        url: `/blog/${post.slug}`,
        priority: "0.6",
        changefreq: "monthly",
        lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString().split("T")[0] : undefined,
      });
    }
  } catch {
    // If DB is unreachable, still return static pages
  }

  const allPages = [...STATIC_PAGES, ...dynamicPages];
  const today = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${page.lastmod ?? today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
