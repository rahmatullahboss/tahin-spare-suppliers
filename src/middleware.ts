import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getCanonicalRedirectUrl } from './lib/canonical-url';
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

            return new Response(object.body, { headers });
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
