const CANONICAL_ORIGIN = new URL("https://tahinspare.com");
const CANONICAL_HOST = CANONICAL_ORIGIN.hostname.toLowerCase();

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
