/** Temporary maintenance fence for the single-writer database cutover. */
const PUBLIC_READ_PATHS = new Set([
  "/", "/about", "/services", "/brands", "/business-info", "/privacy", "/terms",
  "/products", "/parts", "/blog", "/contact", "/enquiry", "/sitemap.xml", "/robots.txt",
  "/anchor-and-chain", "/diesel-generator-sets", "/hydraulic-crane-equipment",
  "/marine-auxillary-engines", "/marine-gearbox", "/marine-propulsion-engines",
  "/marine-pump", "/marine-spare-parts",
  "/api/products", "/api/parts", "/api/blog", "/api/page-overrides",
]);

export function isCutoverReadAllowed(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  const path = pathname.replace(/\/$/, "") || "/";
  return PUBLIC_READ_PATHS.has(path)
    || /^\/(?:products|parts|brands|blog|inventory|category)\/[a-z0-9-]+$/.test(path)
    || /^\/category\/[a-z0-9-]+\/[a-z0-9-]+$/.test(path)
    || /^\/api\/page-content\/home\/[a-z0-9-]+$/.test(path)
    || /^\/images\/(?:[a-z0-9_-][a-z0-9_.-]*\/)*[a-z0-9_-][a-z0-9_.-]*\.(?:webp|png|jpe?g|gif|svg|avif|ico)$/i.test(path);
}
