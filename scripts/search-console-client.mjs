import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export const DEFAULT_SITE_URL = "sc-domain:tahinspare.com";
export const DEFAULT_ALLOWED_ORIGIN = "https://tahinspare.com";
export const SEARCH_CONSOLE_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const WEBMASTERS_API = "https://www.googleapis.com/webmasters/v3";
const URL_INSPECTION_API = "https://searchconsole.googleapis.com/v1";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 4;
const MAX_AUDIT_URLS = 100;

export class SearchConsoleError extends Error {
  constructor(message, status = 0, endpoint = "") {
    super(message);
    this.name = "SearchConsoleError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

function nonEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => nonEmpty(value))) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => nonEmpty(value))) rows.push(row);
  return rows;
}

function normalizedHeader(value) {
  return nonEmpty(value).replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findHeaderIndex(headers, candidates) {
  return headers.findIndex((header) => candidates.includes(normalizedHeader(header)));
}

function normalizeHttpUrl(value) {
  const url = new URL(nonEmpty(value));
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only HTTP(S) URLs are supported");
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function parseIndexingCsv(csv, allowedOrigin = DEFAULT_ALLOWED_ORIGIN) {
  const rows = parseCsvRows(csv);
  const headerIndex = rows.findIndex((row) => findHeaderIndex(row, ["url", "page", "top pages", "example", "affected page", "affected pages"]) >= 0);
  if (headerIndex < 0) throw new Error("Search Console export has no URL column");

  const headers = rows[headerIndex].map((header) => nonEmpty(header));
  const urlIndex = findHeaderIndex(headers, ["url", "page", "top pages", "example", "affected page", "affected pages"]);
  const issueIndex = findHeaderIndex(headers, ["reason", "issue", "issue type", "status", "details"]);
  const records = [];
  const seen = new Set();
  let skippedRows = 0;

  for (const values of rows.slice(headerIndex + 1)) {
    const valueMap = Object.fromEntries(headers.map((header, index) => [header, nonEmpty(values[index] ?? "")]));
    const rawUrl = values[urlIndex] ?? "";
    if (!nonEmpty(rawUrl)) {
      skippedRows += 1;
      continue;
    }

    let url;
    try {
      url = normalizeHttpUrl(rawUrl);
    } catch {
      skippedRows += 1;
      continue;
    }

    if (new URL(url).origin !== allowedOrigin || seen.has(url)) {
      if (new URL(url).origin !== allowedOrigin) skippedRows += 1;
      continue;
    }

    seen.add(url);
    records.push({
      url,
      issue: issueIndex >= 0 ? nonEmpty(values[issueIndex] ?? "") : "",
      values: valueMap,
    });
  }

  return { headers, records, skippedRows };
}

export function resolveSafeImportPath(filePath, allowedRoot = process.cwd()) {
  const root = resolve(allowedRoot);
  const candidate = resolve(root, filePath);
  const candidateRelative = relative(root, candidate);
  if (isAbsolute(candidateRelative) || candidateRelative === ".." || candidateRelative.startsWith(`..${"/"}`)) {
    throw new Error("CSV path must stay inside the configured import root");
  }
  return candidate;
}

export async function readIndexingCsv(filePath, allowedRoot = process.cwd()) {
  const safePath = resolveSafeImportPath(filePath, allowedRoot);
  const rootPath = await realpath(allowedRoot);
  const actualPath = await realpath(safePath);
  const actualRelative = relative(rootPath, actualPath);
  if (isAbsolute(actualRelative) || actualRelative === ".." || actualRelative.startsWith(`..${"/"}`)) {
    throw new Error("CSV path must resolve inside the configured import root");
  }
  return parseIndexingCsv(await readFile(actualPath, "utf8"));
}

function assertDate(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${fieldName} must be an ISO date (YYYY-MM-DD)`);
  }
}

function allowedOriginFromEnv(env) {
  return nonEmpty(env.GSC_ALLOWED_ORIGIN) || DEFAULT_ALLOWED_ORIGIN;
}

export function createGoogleTokenProvider(env = process.env, fetchImpl = fetch) {
  const accessToken = nonEmpty(env.GSC_ACCESS_TOKEN);
  if (accessToken) return async () => accessToken;

  const tokenFile = nonEmpty(env.GSC_TOKEN_FILE);
  if (tokenFile) {
    let fileProvider;
    return async () => {
      if (!fileProvider) {
        const fileConfig = JSON.parse(await readFile(tokenFile, "utf8"));
        fileProvider = createRefreshTokenProvider({
          clientId: fileConfig.client_id,
          clientSecret: fileConfig.client_secret,
          refreshToken: fileConfig.refresh_token,
          tokenUri: fileConfig.token_uri || GOOGLE_TOKEN_ENDPOINT,
          fetchImpl,
        });
      }
      return fileProvider();
    };
  }

  const clientId = nonEmpty(env.GSC_CLIENT_ID);
  const clientSecret = nonEmpty(env.GSC_CLIENT_SECRET);
  const refreshToken = nonEmpty(env.GSC_REFRESH_TOKEN);
  if (!clientId && !clientSecret && !refreshToken) {
    return async () => {
      throw new SearchConsoleError("Configure GSC_ACCESS_TOKEN or GSC_CLIENT_ID/GSC_CLIENT_SECRET/GSC_REFRESH_TOKEN", 401);
    };
  }
  if (!clientId || !clientSecret || !refreshToken) {
    return async () => {
      throw new SearchConsoleError("GSC OAuth refresh requires client id, client secret, and refresh token", 401);
    };
  }

  return createRefreshTokenProvider({ clientId, clientSecret, refreshToken, fetchImpl });
}

function createRefreshTokenProvider({ clientId, clientSecret, refreshToken, tokenUri = GOOGLE_TOKEN_ENDPOINT, fetchImpl = fetch }) {
  let cachedToken = "";
  let expiresAt = 0;
  return async () => {
    if (cachedToken && Date.now() < expiresAt) return cachedToken;
    const response = await fetchImpl(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.access_token !== "string") {
      const message = typeof payload.error_description === "string" ? payload.error_description : "Google OAuth token refresh failed";
      throw new SearchConsoleError(message, response.status, tokenUri);
    }
    cachedToken = payload.access_token;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    expiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
    return cachedToken;
  };
}

export class SearchConsoleClient {
  constructor({ siteUrl = DEFAULT_SITE_URL, tokenProvider, fetchImpl = fetch, allowedOrigin = DEFAULT_ALLOWED_ORIGIN } = {}) {
    this.siteUrl = nonEmpty(siteUrl) || DEFAULT_SITE_URL;
    this.tokenProvider = tokenProvider ?? createGoogleTokenProvider();
    this.fetchImpl = fetchImpl;
    this.allowedOrigin = allowedOrigin;
  }

  async request(endpoint, init = {}) {
    const token = await this.tokenProvider();
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await this.fetchImpl(endpoint, { ...init, headers });
    const text = await response.text();
    let payload = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { text };
      }
    }
    if (!response.ok) {
      const message = payload && typeof payload.error?.message === "string" ? payload.error.message : `Search Console request failed (${response.status})`;
      throw new SearchConsoleError(message, response.status, endpoint);
    }
    return payload;
  }

  async listSites() {
    return this.request(`${WEBMASTERS_API}/sites`);
  }

  async listSitemaps(siteUrl = this.siteUrl) {
    return this.request(`${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
  }

  async inspectUrl(inspectionUrl, siteUrl = this.siteUrl, languageCode = "en-US") {
    const normalizedUrl = normalizeHttpUrl(inspectionUrl);
    if (new URL(normalizedUrl).origin !== this.allowedOrigin) {
      throw new Error(`inspectionUrl must stay on ${this.allowedOrigin}`);
    }
    return this.request(`${URL_INSPECTION_API}/urlInspection/index:inspect`, {
      method: "POST",
      body: JSON.stringify({ inspectionUrl: normalizedUrl, siteUrl, languageCode }),
    });
  }

  async querySearchAnalytics({ startDate, endDate, dimensions = [], type = "web", rowLimit = 1000, startRow = 0, siteUrl = this.siteUrl } = {}) {
    assertDate(startDate, "startDate");
    assertDate(endDate, "endDate");
    if (startDate > endDate) throw new Error("startDate must not be after endDate");
    if (!Array.isArray(dimensions) || dimensions.some((dimension) => typeof dimension !== "string")) throw new Error("dimensions must be a string array");
    if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 25000) throw new Error("rowLimit must be between 1 and 25000");
    if (!Number.isInteger(startRow) || startRow < 0) throw new Error("startRow must be a non-negative integer");
    return this.request(`${WEBMASTERS_API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      body: JSON.stringify({ startDate, endDate, dimensions, type, rowLimit, startRow }),
    });
  }
}

export function createSearchConsoleClient(env = process.env, fetchImpl = fetch) {
  return new SearchConsoleClient({
    siteUrl: nonEmpty(env.GSC_SITE_URL) || DEFAULT_SITE_URL,
    allowedOrigin: allowedOriginFromEnv(env),
    tokenProvider: createGoogleTokenProvider(env, fetchImpl),
    fetchImpl,
  });
}

function canonicalFromHtml(html, pageUrl) {
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const tag = linkTags.find((candidate) => /\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["']/i.test(candidate));
  const href = tag?.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
  return href ? normalizeHttpUrl(new URL(href.trim(), pageUrl).toString()) : "";
}

function hasNoindex(html) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return metaTags.some((tag) => /\bname\s*=\s*["']robots["']/i.test(tag) && /\bcontent\s*=\s*["'][^"']*\bnoindex\b[^"']*["']/i.test(tag));
}

function issueList(status, noindex, canonicalMismatch, missingCanonical, error) {
  const issues = [];
  if (error) issues.push("fetch_error");
  else if (status >= 500) issues.push("server_error_5xx");
  else if (status >= 400) issues.push(status === 404 ? "not_found" : "http_error");
  else if (status >= 300) issues.push("redirect");
  if (noindex) issues.push("noindex");
  if (canonicalMismatch) issues.push("canonical_mismatch");
  if (missingCanonical) issues.push("missing_canonical");
  return issues;
}

async function auditOne(url, canonicalOrigin, timeoutMs, fetchImpl) {
  const started = performance.now();
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      headers: { "user-agent": "TahinSearchConsoleConnector/1.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
    const canonical = isHtml ? canonicalFromHtml(body, url) : "";
    const noindex = isHtml && hasNoindex(body);
    const canonicalMismatch = response.status === 200 && Boolean(canonical) && canonical !== url;
    const missingCanonical = response.status === 200 && isHtml && !canonical;
    const result = {
      url,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      contentType,
      location: response.headers.get("location"),
      server: response.headers.get("server"),
      noindex,
      canonical: canonical || null,
      canonicalMismatch,
      missingCanonical,
      issues: issueList(response.status, noindex, canonicalMismatch, missingCanonical, null),
      error: null,
    };
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      url,
      status: 0,
      durationMs: Math.round(performance.now() - started),
      contentType: "",
      location: null,
      server: null,
      noindex: false,
      canonical: null,
      canonicalMismatch: false,
      missingCanonical: false,
      issues: issueList(0, false, false, false, message),
      error: message,
    };
  }
}

export async function auditUrls(urls, { canonicalOrigin = DEFAULT_ALLOWED_ORIGIN, timeoutMs = DEFAULT_TIMEOUT_MS, concurrency = DEFAULT_CONCURRENCY, fetchImpl = fetch } = {}) {
  if (!Array.isArray(urls)) throw new Error("urls must be an array");
  if (urls.length > MAX_AUDIT_URLS) throw new Error(`A maximum of ${MAX_AUDIT_URLS} URLs can be audited per call`);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20) throw new Error("concurrency must be between 1 and 20");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) throw new Error("timeoutMs must be between 1000 and 60000");

  const normalizedUrls = [...new Set(urls.map((url) => normalizeHttpUrl(url)))];
  if (normalizedUrls.some((url) => new URL(url).origin !== canonicalOrigin)) throw new Error(`All URLs must stay on ${canonicalOrigin}`);
  const results = new Array(normalizedUrls.length);
  let cursor = 0;

  async function worker() {
    while (cursor < normalizedUrls.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await auditOne(normalizedUrls[current], canonicalOrigin, timeoutMs, fetchImpl);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, normalizedUrls.length || 1) }, () => worker()));
  const summary = {
    total: results.length,
    serverErrors: results.filter((result) => result.issues.includes("server_error_5xx")).length,
    fetchErrors: results.filter((result) => result.issues.includes("fetch_error")).length,
    noindex: results.filter((result) => result.issues.includes("noindex")).length,
    canonicalMismatch: results.filter((result) => result.issues.includes("canonical_mismatch")).length,
    missingCanonical: results.filter((result) => result.issues.includes("missing_canonical")).length,
  };
  return { generatedAt: new Date().toISOString(), source: "public HTTP audit of Search Console export URLs", summary, results };
}

export async function auditIndexingExport(filePath, options = {}) {
  const imported = await readIndexingCsv(filePath, options.allowedRoot ?? process.cwd());
  const report = await auditUrls(imported.records.map((record) => record.url), options);
  return { import: imported, audit: report };
}
