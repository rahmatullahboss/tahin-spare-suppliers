import { getCanonicalRedirectUrl } from "../canonical-url.ts";
import { addSecurityHeaders } from "./security-headers.ts";

export type CacheEntryEnvironment = {
  TAHIN_CUTOVER_FREEZE?: string;
  TAHIN_PREVIEW_READ_ONLY?: string;
  TAHIN_PREVIEW_LOCKED?: string;
};

function isNormalRuntime(env: CacheEntryEnvironment): boolean {
  return env.TAHIN_CUTOVER_FREEZE !== "true" &&
    env.TAHIN_PREVIEW_READ_ONLY !== "true" &&
    env.TAHIN_PREVIEW_LOCKED !== "true";
}

/** Preserve maintenance, preview and canonical redirect authority in Astro. */
export function canUseCatalogueEntryCache(request: Request, env: CacheEntryEnvironment): boolean {
  return isNormalRuntime(env) && !getCanonicalRedirectUrl(request.url);
}

/** Known unsupported legacy PHP paths have no application route.
 * Keep the branded 404 for all other paths, including catalogue slugs.
 */
export function fastPublicNotFound(request: Request, env: CacheEntryEnvironment): Response | undefined {
  if (!isNormalRuntime(env) || (request.method !== "GET" && request.method !== "HEAD")) return;
  const url = new URL(request.url);
  if (url.origin !== "https://tahinspare.com") return;
  if (!/^\/(?:[a-z0-9_-]+\.php|wp-(?:admin|content|includes)\/(?:[^/]+\/)*[^/]+\.php)$/i.test(url.pathname)) return;
  return addSecurityHeaders(new Response(request.method === "HEAD" ? null : "Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  }));
}
