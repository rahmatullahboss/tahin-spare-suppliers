import type { handle } from "@astrojs/cloudflare/handler";
import { serveCatalogHtml, isAnonymousCatalogRequest, type CacheVersionStore } from "./lib/server/cache-policy";
import { canUseCatalogueEntryCache, type CacheEntryEnvironment } from "./lib/server/entry-cache";
import { addSecurityHeaders } from "./lib/server/security-headers";

type WorkerEnvironment = Parameters<typeof handle>[1] & CacheEntryEnvironment & { SESSION?: CacheVersionStore };

export default {
  async fetch(request: Request, env: WorkerEnvironment, ctx: ExecutionContext): Promise<Response> {
    const render = async () => {
      const { handle } = await import("@astrojs/cloudflare/handler");
      return handle(request, env, ctx);
    };
    if (!env.SESSION || !canUseCatalogueEntryCache(request, env) || !isAnonymousCatalogRequest(request)) {
      return render();
    }
    const response = await serveCatalogHtml({
      request,
      render,
      versionStore: env.SESSION,
      cache: typeof caches !== "undefined" ? caches.default : undefined,
      waitUntil: promise => ctx.waitUntil(promise),
    });
    return addSecurityHeaders(response);
  },
};
