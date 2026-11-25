import { getCanonicalRedirectUrl } from "../canonical-url.ts";

export type CacheEntryEnvironment = {
  TAHIN_CUTOVER_FREEZE?: string;
  TAHIN_PREVIEW_READ_ONLY?: string;
  TAHIN_PREVIEW_LOCKED?: string;
};

/** Preserve maintenance, preview and canonical redirect authority in Astro.
 * Other requests can use the existing anonymous catalogue cache policy.
 */
export function canUseCatalogueEntryCache(request: Request, env: CacheEntryEnvironment): boolean {
  return env.TAHIN_CUTOVER_FREEZE !== "true" &&
    env.TAHIN_PREVIEW_READ_ONLY !== "true" &&
    env.TAHIN_PREVIEW_LOCKED !== "true" &&
    !getCanonicalRedirectUrl(request.url);
}
