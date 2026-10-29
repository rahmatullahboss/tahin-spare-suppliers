/** Cloudflare edge caching for anonymous, long-lived public catalogue data. */
export const PUBLIC_CACHE_TTL = 12 * 60 * 60;
export const CACHE_VERSION_KEY = "tahin:catalogue-cache-version:v1";
export const REVISION_MEMO_TTL_MS = 30_000;

const PUBLIC_PATHS = new Set([
  "/", "/products", "/parts", "/brands", "/blog", "/about", "/services",
  "/business-info", "/privacy", "/terms", "/anchor-and-chain",
  "/diesel-generator-sets", "/hydraulic-crane-equipment", "/sitemap.xml",
  "/marine-auxillary-engines", "/marine-gearbox", "/marine-pump",
  "/marine-propulsion-engines", "/marine-spare-parts",
]);
const PUBLIC_PREFIXES = ["/products/", "/parts/", "/category/", "/brands/", "/blog/", "/inventory/"];
const JSON_LIST_PATHS = new Set(["/api/products", "/api/parts", "/api/blog"]);
const JSON_HOMEPAGE_SECTION = /^\/api\/page-content\/home\/[a-z0-9-]+$/;
const TRACKING_KEYS = new Set(["fbclid", "gclid", "msclkid", "yclid"]);

const CONTENT_WRITE_PATHS = new Set([
  "/api/products", "/api/parts", "/api/blog",
  "/api/admin/categories", "/api/admin/category-presentation",
  "/api/admin/brands", "/api/admin/blog-trash", "/api/page-overrides",
]);
const CONTENT_WRITE_PREFIXES = ["/api/products/", "/api/parts/", "/api/blog/", "/api/page-content/"];

export interface CacheVersionStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
export interface EdgeResponseCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

const revisionMemo = new WeakMap<CacheVersionStore, { value: string; until: number }>();
const revisionFlights = new WeakMap<CacheVersionStore, Promise<string>>();

function publicCacheUrl(request: Request): URL | null {
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();
  const html = PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
  const jsonList = JSON_LIST_PATHS.has(path);
  const jsonSection = JSON_HOMEPAGE_SECTION.test(path);

  if (!html && !jsonList && !jsonSection) return null;

  if (jsonSection) return url.search ? null : url;
  if (jsonList) {
    // Search strings have unbounded cardinality; do not turn them into edge-cache keys.
    const seen = new Set<string>();
    for (const [key, value] of url.searchParams) {
      if ((key !== "page" && key !== "limit") || seen.has(key)) return null;
      seen.add(key);
      if (!/^[0-9]{1,4}$/.test(value) || Number(value) < 1) return null;
      if (key === "limit" && Number(value) > 100) return null;
    }
    return url;
  }

  // Tracking parameters do not affect catalogue HTML; normalize them to one key.
  for (const key of url.searchParams.keys()) {
    if (!key.toLowerCase().startsWith("utm_") && !TRACKING_KEYS.has(key.toLowerCase())) {
      return null; // Genuine filters, previews and unknown parameters bypass cache.
    }
  }
  url.search = "";
  return url;
}

export function isAnonymousCatalogRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.has("Authorization") || request.headers.has("Range")) return false;
  if (/(?:^|;\s*)tahin_admin_session(?:=|;|$)/i.test(request.headers.get("Cookie") ?? "")) return false;
  if (/\b(no-cache|no-store)\b/i.test(request.headers.get("Cache-Control") ?? "")) return false;
  if (/\bno-cache\b/i.test(request.headers.get("Pragma") ?? "")) return false;
  return publicCacheUrl(request) !== null;
}

export function isCatalogMutation(request: Request): boolean {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return false;
  const path = new URL(request.url).pathname.toLowerCase();
  return CONTENT_WRITE_PATHS.has(path) ||
    CONTENT_WRITE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isCacheableHtml(response: Response): boolean {
  return response.status === 200 &&
    (response.headers.get("Content-Type") ?? "").toLowerCase().includes("text/html") &&
    !response.headers.has("Set-Cookie") &&
    !/\b(private|no-store)\b/i.test(response.headers.get("Cache-Control") ?? "");
}

export function isCacheablePublicResponse(request: Request, response: Response): boolean {
  if (response.status !== 200 || response.headers.has("Set-Cookie") ||
      /\b(private|no-store)\b/i.test(response.headers.get("Cache-Control") ?? "")) return false;
  const path = new URL(request.url).pathname.toLowerCase();
  const mime = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (path === "/sitemap.xml") return mime.includes("xml");
  if (JSON_LIST_PATHS.has(path) || JSON_HOMEPAGE_SECTION.test(path)) {
    return mime.includes("application/json");
  }
  return mime.includes("text/html");
}

export function revisionedKey(request: Request, revision: string): Request {
  const url = publicCacheUrl(request) ?? new URL(request.url);
  url.searchParams.set("__tahin_catalogue_revision", revision);
  return new Request(url.toString(), { method: "GET" });
}

async function loadRevision(store: CacheVersionStore): Promise<string> {
  const memo = revisionMemo.get(store);
  if (memo && memo.until > Date.now()) return memo.value;
  const pending = revisionFlights.get(store);
  if (pending) return pending;
  const lookup = store.get(CACHE_VERSION_KEY).then((value) => {
    const revision = value ?? "initial";
    revisionMemo.set(store, { value: revision, until: Date.now() + REVISION_MEMO_TTL_MS });
    return revision;
  });
  revisionFlights.set(store, lookup);
  try {
    return await lookup;
  } finally {
    revisionFlights.delete(store);
  }
}

function visitorResponse(response: Response, status: "HIT" | "MISS"): Response {
  const headers = new Headers(response.headers);
  // Browser must revalidate with edge after CMS edits; edge response remains cached.
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Tahin-Catalogue-Cache", status);
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}

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
    revision = await loadRevision(versionStore);
  } catch (error) {
    console.error("Catalogue revision lookup failed; using normal render", error);
    return render();
  }

  const key = revisionedKey(request, revision);
  try {
    const hit = await cache.match(key);
    if (hit) return visitorResponse(hit, "HIT");
  } catch (error) {
    console.error("Catalogue edge lookup failed; using normal render", error);
    return render();
  }

  const response = await render();
  if (!isCacheablePublicResponse(request, response)) return response;

  const stored = response.clone();
  stored.headers.set("Cache-Control", "public, max-age=" + PUBLIC_CACHE_TTL);
  stored.headers.delete("X-Tahin-Catalogue-Cache");
  const writing = cache.put(key, stored).catch((error: unknown) => {
    console.error("Catalogue edge cache write failed", error);
  });
  if (waitUntil) waitUntil(writing);
  else await writing;
  return visitorResponse(response, "MISS");
}

/** Invalidate on successful CMS writes only, never on failed/unauthorized attempts. */
export async function invalidateCatalogOnWrite(
  request: Request, response: Response, versionStore?: CacheVersionStore,
): Promise<void> {
  if (!versionStore || !isCatalogMutation(request) || !response.ok) return;
  const revision = crypto.randomUUID();
  await versionStore.put(CACHE_VERSION_KEY, revision);
  revisionMemo.set(versionStore, { value: revision, until: Date.now() + REVISION_MEMO_TTL_MS });
}
