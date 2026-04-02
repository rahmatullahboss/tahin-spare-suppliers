import { defineMiddleware } from 'astro:middleware';

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

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname.toLowerCase();

  if (!pathname.startsWith('/images/')) {
    return next();
  }

  const isRasterAsset = [...RASTER_CONTENT_TYPES.keys()].some((extension) => pathname.endsWith(extension));

  if (!isRasterAsset) {
    return next();
  }

  const bucket = context.locals.runtime?.env?.MEDIA_BUCKET;
  const mediaBaseUrl = context.locals.runtime?.env?.MEDIA_PUBLIC_URL?.replace(/\/$/, '');

  if (bucket) {
    const object = await bucket.get(url.pathname.slice(1));

    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('content-type', headers.get('content-type') ?? getContentType(pathname));
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      headers.set('etag', object.httpEtag);

      return new Response(object.body, {
        headers,
      });
    }
  }

  if (mediaBaseUrl) {
    return fetch(`${mediaBaseUrl}${url.pathname}`, {
      headers: context.request.headers,
      method: 'GET',
    });
  }

  return next();
});
