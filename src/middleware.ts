import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getCanonicalRedirectUrl } from './lib/canonical-url';
import { ensureSchema, getDb } from './lib/server/db';
import { getRuntimeEnv } from './lib/server/env';
import { SupabaseConfigurationError } from './lib/server/supabase-connection';
import { invalidateCatalogOnWrite, serveCatalogHtml } from './lib/server/cache-policy';

const RASTER_CONTENT_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

function getContentType(pathname: string) {
  const entry = [...RASTER_CONTENT_TYPES.entries()].find(([extension]) => pathname.endsWith(extension));
  return entry?.[1] ?? 'application/octet-stream';
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
};

function addSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  // Public catalogue QA only. No access to private records, forms, admin,
  // webhooks, or mutation endpoints until authenticated QA is available.
  if (env.TAHIN_PREVIEW_READ_ONLY === 'true' || env.TAHIN_PREVIEW_LOCKED === 'true') {
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    const readMethod = context.request.method === 'GET' || context.request.method === 'HEAD';
    if (readMethod && url.pathname === '/migration-health') {
      let stage = 'provider';
      try {
        const runtime = getRuntimeEnv(context.locals);
        if (runtime.DB_PROVIDER !== 'supabase') throw new Error('Wrong provider');
        stage = 'connection configuration';
        const sql = getDb(runtime);
        stage = 'database login';
        const identity = await sql.query("SELECT current_user = 'tahin_worker' AS role_ok");
        if (identity[0]?.role_ok !== true) throw new Error('Wrong role');
        stage = 'schema verification';
        await ensureSchema(runtime);
        stage = 'catalogue read';
        const rows = await sql.query('SELECT EXISTS (SELECT 1 FROM products) AS catalog_ok');
        if (rows[0]?.catalog_ok !== true) throw new Error('Verification failed');
        return addSecurityHeaders(new Response('Supabase connection and schema: PASS', { headers }));
      } catch (error) {
        // Return only fixed diagnostic categories. Never expose a driver error,
        // credential, connection URI, or database row in an HTTP response/log.
        const code = (error as { code?: string })?.code;
        const message = error instanceof Error ? error.message : '';
        const reason = error instanceof SupabaseConfigurationError ? error.message
          : stage === 'connection configuration' ? 'Unexpected connection configuration error'
          : code === '28P01' || code === '28000' || /password authentication failed|tenant or user not found/i.test(message) ? 'Authentication rejected'
          : /certificate|TLS|SSL/i.test(message) ? 'TLS verification failed'
          : /timeout|timed out/i.test(message) ? 'Connection timeout'
          : code === '42501' ? 'Permission denied'
          : code === '42P01' ? 'Required table missing'
          : code === 'ECONNREFUSED' || code === 'ENETUNREACH' || code === 'ENOTFOUND' ? 'Network connection failed'
          : 'Verification failed';
        console.warn('Supabase preview health:', stage, reason);
        return addSecurityHeaders(new Response(`Supabase FAIL — ${stage}: ${reason}`, { status: 503, headers }));
      }
    }
    const publicPage = /^\/(?:about|services|brands|business-info|privacy|terms|products|parts|blog|anchor-and-chain|diesel-generator-sets|hydraulic-crane-equipment|marine-auxillary-engines|marine-gearbox|marine-propulsion-engines|marine-pump|marine-spare-parts)?\/?$/.test(url.pathname)
      || /^\/(?:products|parts|brands|blog|inventory|category)\/[a-z0-9-]+\/?$/.test(url.pathname)
      || /^\/category\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(url.pathname);
    if (!readMethod || !publicPage) {
      return addSecurityHeaders(new Response('Read-only migration preview: this route is unavailable.', { status: 403, headers }));
    }
    const response = addSecurityHeaders(await next());
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
  const canonicalRedirectUrl = getCanonicalRedirectUrl(url);
  if (canonicalRedirectUrl) {
    return addSecurityHeaders(new Response(null, {
      status: 301,
      headers: { Location: canonicalRedirectUrl },
    }));
  }

  const pathname = url.pathname.toLowerCase();

  // Handle R2 image serving
  if (pathname.startsWith('/images/')) {
    const isRasterAsset = [...RASTER_CONTENT_TYPES.keys()].some((extension) => pathname.endsWith(extension));

    if (isRasterAsset) {
      // Image content is public. CDN-cache it at the edge to avoid repeat R2 reads.
      // Bypass range/query requests; never cache uploads or arbitrary API content.
      const imageCache = context.request.method === 'GET' && !context.request.headers.has('Range') && !url.search
        ? (typeof caches !== 'undefined' ? caches.default : undefined)
        : undefined;
      if (imageCache) {
        try {
          const hit = await imageCache.match(context.request);
          if (hit) return addSecurityHeaders(hit);
        } catch (error) {
          console.error('Image edge cache lookup failed', error);
        }
      }
      const bucket = env.MEDIA_BUCKET;
      const mediaBaseUrl = env.MEDIA_PUBLIC_URL?.replace(/\/$/, '');

      if (bucket) {
        try {
          const object = await bucket.get(url.pathname.slice(1));

          if (object) {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set('content-type', headers.get('content-type') ?? getContentType(pathname));
            headers.set('cache-control', 'public, max-age=31536000, immutable');
            headers.set('etag', object.httpEtag);

            // Add security headers to image responses too
            for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
              headers.set(key, value);
            }

            const imageResponse = new Response(object.body, { headers });
            if (imageCache) {
              const stored = imageResponse.clone();
              // Keep edge copy for seven days; the browser keeps immutable image URLs.
              stored.headers.set('Cache-Control', 'public, max-age=604800');
              const saving = imageCache.put(context.request, stored).catch((error: unknown) => {
                console.error('Image edge cache write failed', error);
              });
              if (context.locals.cfContext?.waitUntil) context.locals.cfContext.waitUntil(saving);
              else await saving;
            }
            return imageResponse;
          }
        } catch {
          // R2 error — fall through to CDN or next()
        }
      }

      if (mediaBaseUrl) {
        const cdnResponse = await fetch(`${mediaBaseUrl}${url.pathname}`, {
          headers: context.request.headers,
          method: 'GET',
        });
        return addSecurityHeaders(cdnResponse);
      }
    }
  }

  const cacheStore = env.SESSION;
  const edgeCache = typeof caches !== 'undefined' ? caches.default : undefined;
  const response = await serveCatalogHtml({
    request: context.request,
    render: () => next(),
    versionStore: cacheStore,
    cache: edgeCache,
    waitUntil: context.locals.cfContext?.waitUntil
      ? (promise) => context.locals.cfContext!.waitUntil(promise)
      : undefined,
  });

  try {
    await invalidateCatalogOnWrite(context.request, response, cacheStore);
  } catch (error) {
    // The data write already succeeded; do not turn it into a misleading 500.
    // A cached old revision may remain until TTL if KV is unavailable.
    console.error('Catalogue cache invalidation failed after a successful write', error);
  }
  return addSecurityHeaders(response);
});
