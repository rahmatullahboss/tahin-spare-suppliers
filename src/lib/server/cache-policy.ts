/** Anonymous catalogue HTML caching, with a KV version for CMS invalidation. */
export const PUBLIC_CACHE_TTL = 43200;
export const CACHE_VERSION_KEY = "tahin:catalogue-cache-version:v1";

const PUBLIC_PATHS = new Set([
  "/", "/products", "/parts", "/brands", "/blog", "/about", "/services",
  "/business-info", "/privacy", "/terms", "/anchor-and-chain",
  "/diesel-generator-sets", "/hydraulic-crane-equipment",
  "/marine-auxillary-engines", "/marine-gearbox", "/marine-pump",
  "/marine-propulsion-engines", "/marine-spare-parts",
]);
const PUBLIC_PREFIXES = ["/products/", "/parts/", "/category/", "/brands/", "/blog/", "/inventory/"];
const WRITE_PATHS = new Set([
  "/api/products", "/api/parts", "/api/blog",
  "/api/admin/categories", "/api/admin/category-presentation",
  "/api/admin/brands", "/api/admin/blog-trash", "/api/page-overrides",
]);
const WRITE_PREFIXES = ["/api/products/", "/api/parts/", "/api/blog/", "/api/page-content/"];

export interface CacheVersionStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
export interface EdgeResponseCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export function isAnonymousCatalogRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("Authorization") || request.headers.has("Range")) return false;
  if (/(?:^|;\s*)tahin_admin_session(?:=|;|$)/i.test(request.headers.get("Cookie") ?? "")) return false;
  if (/\b(no-cache|no-store)\b/i.test(request.headers.get("Cache-Control") ?? "")) return false;
  if (/\bno-cache\b/i.test(request.headers.get("Pragma") ?? "")) return false;
  const url = new URL(request.url);
  if (url.search) return false;
  const path = url.pathname.toLowerCase();
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isCatalogMutation(request: Request): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
  const path = new URL(request.url).pathname.toLowerCase();
  return WRITE_PATHS.has(path) || WRITE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isCacheableHtml(response: Response): boolean {
  return response.status === 200 &&
    (response.headers.get("Content-Type") ?? "").toLowerCase().includes("text/html") &&
    !response.headers.has("Set-Cookie") &&
    !/\b(private|no-store)\b/i.test(response.headers.get("Cache-Control") ?? "");
}

export function revisionedKey(request: Request, revision: string): Request {
  const url = new URL(request.url);
  url.searchParams.set("__tahin_catalogue_revision", revision);
  return new Request(url.toString());
}

function visitorResponse(response: Response, status: "HIT" | "MISS"): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Tahin-Catalogue-Cache", status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Read from the edge cache before making any database calls. */
export async function serveCatalogHtml(options: {
  request: Request;
  render: () => Promise<Response>;
  versionStore?: CacheVersionStore;
  cache?: EdgeResponseCache;
  waitUntil?: (promise: Promise<void>) => void;
}): Promise<Response> {
  const { request, render, versionStore, cache, waitUntil } = options;
  if (!versionStore || !cache || !isAnonymousCatalogRequest(request)) return render();

  let revision: string;
  try {
    revision = (await versionStore.get(CACHE_VERSION_KEY)) ?? "initial";
  } catch (error) {
    console.error("Catalogue cache revision lookup failed", error);
    return render();
  }
  const key = revisionedKey(request, revision);
  try {
    const hit = await cache.match(key);
    if (hit) return visitorResponse(hit, "HIT");
  } catch (error) {
    console.error("Catalogue edge cache lookup failed", error);
    return render();
  }

  const response = await render();
  if (!isCacheableHtml(response)) return response;

  const stored = response.clone();
  stored.headers.set("Cache-Control", `public, max-age=${PUBLIC_CACHE_TTL}`);
  const save = cache.put(key, stored).catch((error: unknown) => {
    console.error("Catalogue edge cache write failed", error);
  });
  if (waitUntil) waitUntil(save);
  else await save;
  return visitorResponse(response, "MISS");
}

/** A successful catalogue edit changes the cache key without flushing other regions. */
export async function invalidateCatalogOnWrite(
  request: Request, response: Response, versionStore?: CacheVersionStore,
): Promise<void> {
  if (!versionStore || !isCatalogMutation(request) || !response.ok) return;
  await versionStore.put(CACHE_VERSION_KEY, crypto.randomUUID());
}
