import assert from "node:assert/strict";
import test from "node:test";
import {
  CACHE_VERSION_KEY, PUBLIC_CACHE_TTL, isAnonymousCatalogRequest,
  isCatalogMutation, isCacheableHtml, serveCatalogHtml,
  invalidateCatalogOnWrite, type CacheVersionStore, type EdgeResponseCache,
} from "../src/lib/server/cache-policy.ts";

const req = (path: string, init?: RequestInit) => new Request(`https://tahinspare.com${path}`, init);
const html = (value = "catalogue") =>
  new Response(`<html>${value}</html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

test("only anonymous, canonical public HTML is cache eligible", () => {
  for (const path of ["/", "/products", "/products/engine", "/category/spare-parts", "/brands/yamaha", "/blog/tips", "/inventory/marine-spare-parts"]) {
    assert.equal(isAnonymousCatalogRequest(req(path)), true, path);
  }
  for (const path of ["/admin", "/admin/emails", "/api/products", "/api/admin/enquiries", "/contact", "/enquiry", "/products/engine?preview=1", "/not-found"]) {
    assert.equal(isAnonymousCatalogRequest(req(path)), false, path);
  }
  assert.equal(isAnonymousCatalogRequest(req("/", { method: "POST" })), false);
  assert.equal(isAnonymousCatalogRequest(req("/", { headers: { Authorization: "Bearer secret" } })), false);
  assert.equal(isAnonymousCatalogRequest(req("/", { headers: { Cookie: "theme=dark; tahin_admin_session=abc" } })), false);
  assert.equal(isAnonymousCatalogRequest(req("/", { headers: { "Cache-Control": "no-cache" } })), false);
});

test("private, error, cookie-bearing or JSON responses are not stored", () => {
  assert.equal(isCacheableHtml(html()), true);
  assert.equal(isCacheableHtml(new Response("error", { status: 500, headers: { "Content-Type": "text/html" } })), false);
  assert.equal(isCacheableHtml(new Response("{}", { headers: { "Content-Type": "application/json" } })), false);
  assert.equal(isCacheableHtml(new Response("<html></html>", { headers: { "Content-Type": "text/html", "Set-Cookie": "session=abc" } })), false);
  assert.equal(isCacheableHtml(new Response("<html></html>", { headers: { "Content-Type": "text/html", "Cache-Control": "private" } })), false);
});

test("edge cache skips repeated database rendering and invalidates after CMS change", async () => {
  const versions = new Map<string, string>();
  const responses = new Map<string, Response>();
  const versionStore: CacheVersionStore = {
    get: async (k) => versions.get(k) ?? null,
    put: async (k, v) => { versions.set(k, v); },
  };
  const cache: EdgeResponseCache = {
    match: async (request) => responses.get(request.url)?.clone(),
    put: async (request, response) => { responses.set(request.url, response.clone()); },
  };
  let renders = 0;
  const render = async () => html(`version-${++renders}`);
  const options = { request: req("/products/marine-engine"), render, versionStore, cache };
  const miss = await serveCatalogHtml(options);
  assert.equal(miss.headers.get("X-Tahin-Catalogue-Cache"), "MISS");
  const hit = await serveCatalogHtml(options);
  assert.equal(hit.headers.get("X-Tahin-Catalogue-Cache"), "HIT");
  assert.equal(await hit.text(), "<html>version-1</html>");
  assert.equal(renders, 1);
  assert.equal(hit.headers.get("Cache-Control"), "private, no-store");
  assert.equal(responses.size, 1);
  assert.match(responses.values().next().value?.headers.get("Cache-Control") ?? "", new RegExp(String(PUBLIC_CACHE_TTL)));

  await invalidateCatalogOnWrite(req("/api/products/abc", { method: "PUT" }), new Response("ok"), versionStore);
  assert.ok(versions.get(CACHE_VERSION_KEY));
  const updated = await serveCatalogHtml(options);
  assert.equal(updated.headers.get("X-Tahin-Catalogue-Cache"), "MISS");
  assert.equal(await updated.text(), "<html>version-2</html>");
  assert.equal(renders, 2);
});

test("authenticated requests bypass the cache and failed CMS writes do not invalidate it", async () => {
  let puts = 0;
  let renders = 0;
  const versionStore: CacheVersionStore = {
    get: async () => "v1",
    put: async () => { puts += 1; },
  };
  const cache: EdgeResponseCache = { match: async () => html("stale"), put: async () => { throw new Error("must not put"); } };
  const result = await serveCatalogHtml({
    request: req("/", { headers: { Cookie: "tahin_admin_session=valid" } }),
    versionStore, cache, render: async () => html(`admin-${++renders}`),
  });
  assert.equal(await result.text(), "<html>admin-1</html>");
  assert.equal(renders, 1);
  assert.equal(result.headers.get("X-Tahin-Catalogue-Cache"), null);
  await invalidateCatalogOnWrite(req("/api/blog", { method: "POST" }), new Response("failed", { status: 500 }), versionStore);
  await invalidateCatalogOnWrite(req("/api/admin/emails", { method: "POST" }), new Response("ok"), versionStore);
  assert.equal(puts, 0);
  assert.equal(isCatalogMutation(req("/api/page-content/home/hero", { method: "PUT" })), true);
  assert.equal(isCatalogMutation(req("/api/admin/category-presentation", { method: "PATCH" })), true);
});

test("KV lookup outage renders normally instead of serving a stale page", async () => {
  const result = await serveCatalogHtml({
    request: req("/category/spare-parts"),
    versionStore: { get: async () => { throw new Error("KV offline"); }, put: async () => {} },
    cache: { match: async () => html("old"), put: async () => {} },
    render: async () => html("fresh"),
  });
  assert.equal(await result.text(), "<html>fresh</html>");
});
