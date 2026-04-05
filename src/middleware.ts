import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

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

  const response = await next();
  return addSecurityHeaders(response);
});
