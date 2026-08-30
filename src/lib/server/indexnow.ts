const SITE_URL = "https://tahinspare.com";
const SITE_HOST = "tahinspare.com";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/indexnow-key.txt`;

export type IndexNowEnv = {
  INDEXNOW_KEY?: string;
};

export type IndexNowContentType = "products" | "parts" | "blog";
export type IndexNowResult = "disabled" | "empty" | "accepted" | "rejected" | "error";

const CONTENT_PATHS: Record<IndexNowContentType, string> = {
  products: "products",
  parts: "parts",
  blog: "blog",
};

export function getIndexNowKey(env: IndexNowEnv): string {
  const key = env.INDEXNOW_KEY?.trim() ?? "";
  return /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : "";
}

export function contentPublicUrl(type: IndexNowContentType, slug: string): string {
  const normalizedSlug = slug.trim().replace(/^\/+|\/+$/g, "");
  return `${SITE_URL}/${CONTENT_PATHS[type]}/${encodeURIComponent(normalizedSlug).replace(/%2F/gi, "/")}`;
}

function canonicalUrls(urls: string[]): string[] {
  const unique = new Set<string>();

  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.host !== SITE_HOST) continue;
      url.hash = "";
      unique.add(url.toString());
    } catch {
      // Ignore malformed/non-canonical URLs rather than submitting them.
    }
  }

  return [...unique];
}

export async function notifyIndexNow(
  env: IndexNowEnv,
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const key = getIndexNowKey(env);
  if (!key) return "disabled";

  const urlList = canonicalUrls(urls);
  if (urlList.length === 0) return "empty";

  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify({
        host: SITE_HOST,
        key,
        keyLocation: INDEXNOW_KEY_LOCATION,
        urlList,
      }),
    });

    return response.status === 200 || response.status === 202 ? "accepted" : "rejected";
  } catch {
    return "error";
  }
}

export async function notifyContentChange(
  env: IndexNowEnv,
  type: IndexNowContentType,
  slugs: Array<string | undefined>,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const urls = slugs
    .map((slug) => slug?.trim() ?? "")
    .filter(Boolean)
    .map((slug) => contentPublicUrl(type, slug));

  return notifyIndexNow(env, urls, fetchImpl);
}
