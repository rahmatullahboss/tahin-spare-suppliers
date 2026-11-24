const CANONICAL_ORIGIN = new URL("https://tahinspare.com");
const CANONICAL_HOST = CANONICAL_ORIGIN.hostname.toLowerCase();

/** Preview-only fallback for existing public image URLs, never private media. */
export function getPublicPreviewImageUrl(pathname: string): string | undefined {
  if (!/^\/images\/(?:[a-z0-9_-][a-z0-9_.-]*\/)*[a-z0-9_-][a-z0-9_.-]*\.(?:webp|png|jpe?g|gif|svg|avif|ico)$/i.test(pathname)) return undefined;
  const url = new URL(CANONICAL_ORIGIN);
  url.pathname = pathname;
  return url.href;
}

export function getCanonicalRedirectUrl(input: string | URL): string | undefined {
  const url = input instanceof URL ? new URL(input.href) : new URL(input);
  const hostname = url.hostname.toLowerCase();
  const isPublicHost = hostname === CANONICAL_HOST || hostname === `www.${CANONICAL_HOST}`;

  if (!isPublicHost) return undefined;
  if (
    url.protocol === CANONICAL_ORIGIN.protocol
    && hostname === CANONICAL_HOST
    && url.port === ""
  ) {
    return undefined;
  }

  url.protocol = CANONICAL_ORIGIN.protocol;
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return url.href;
}
