import { SECURITY_HEADERS, addSecurityHeaders } from "./security-headers";
import type { EdgeResponseCache } from "./cache-policy";

export type PublicImageEnvironment = { MEDIA_BUCKET?: R2Bucket; MEDIA_PUBLIC_URL?: string };

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

/** Existing public raster media route. Undefined means continue ordinary routing. */
export async function servePublicImage(request: Request, media: PublicImageEnvironment, cache?: EdgeResponseCache, waitUntil?: (promise: Promise<void>) => void): Promise<Response | undefined> {
  const url = new URL(request.url);
  const pathname = url.pathname.toLowerCase();

  // Handle R2 image serving
  if (pathname.startsWith('/images/')) {
    const isRasterAsset = [...RASTER_CONTENT_TYPES.keys()].some((extension) => pathname.endsWith(extension));

    if (isRasterAsset) {
      // Image content is public. CDN-cache it at the edge to avoid repeat R2 reads.
      // Bypass range/query requests; never cache uploads or arbitrary API content.
      const imageCache = request.method === 'GET' && !request.headers.has('Range') && !url.search
        ? cache
        : undefined;
      if (imageCache) {
        try {
          const hit = await imageCache.match(request);
          if (hit) return addSecurityHeaders(hit);
        } catch (error) {
          console.error('Image edge cache lookup failed', error);
        }
      }
      const bucket = media.MEDIA_BUCKET;
      const mediaBaseUrl = media.MEDIA_PUBLIC_URL?.replace(/\/$/, '');

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
              const saving = imageCache.put(request, stored).catch((error: unknown) => {
                console.error('Image edge cache write failed', error);
              });
              if (waitUntil) waitUntil(saving);
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
          headers: request.headers,
          method: 'GET',
        });
        return addSecurityHeaders(cdnResponse);
      }
    }
  }

  return undefined;
}
