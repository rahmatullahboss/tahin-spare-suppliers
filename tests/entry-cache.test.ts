import assert from "node:assert/strict";
import test from "node:test";
import { canUseCatalogueEntryCache, fastPublicNotFound } from "../src/lib/server/entry-cache.ts";
import { isAnonymousCatalogRequest } from "../src/lib/server/cache-policy.ts";
import { addSecurityHeaders } from "../src/lib/server/security-headers.ts";

test("entry cache preserves maintenance, preview and canonical redirect priority", () => {
  const request = new Request("https://tahinspare.com/");
  assert.equal(canUseCatalogueEntryCache(request, {}), true);
  for (const key of ["TAHIN_CUTOVER_FREEZE","TAHIN_PREVIEW_READ_ONLY","TAHIN_PREVIEW_LOCKED"]) {
    assert.equal(canUseCatalogueEntryCache(request, {[key]:"true"}),false);
  }
  for (const url of ["http://tahinspare.com/","https://www.tahinspare.com/"]) {
    assert.equal(canUseCatalogueEntryCache(new Request(url),{}),false);
  }
});
test("entry cache eligibility still requires original anonymous policy", () => {
  for (const request of [
    new Request("https://tahinspare.com/admin"),
    new Request("https://tahinspare.com/",{headers:{Cookie:"tahin_admin_session=synthetic"}}),
    new Request("https://tahinspare.com/",{headers:{"Cache-Control":"no-cache"}}),
    new Request("https://tahinspare.com/",{method:"POST"}),
  ]) assert.equal(isAnonymousCatalogRequest(request),false);
});
test("unsupported PHP paths return cheap 404 without altering real routes or maintenance", async () => {
  for (const path of ["/wp-login.php","/rapid.php","/wp-content/plugins/example/index.php"]) {
    const response = fastPublicNotFound(new Request("https://tahinspare.com"+path),{});
    assert.equal(response?.status,404);
    assert.equal(response?.headers.get("X-Robots-Tag"),"noindex");
    assert.equal(response?.headers.get("X-Frame-Options"),"DENY");
    assert.equal(response?.headers.get("Cache-Control"),"private, no-store");
    assert.equal(await response?.text(),"Not Found");
  }
  for (const path of ["/","/products/engine.php","/api/admin","/wp-content/style.css","/unknown"]) {
    assert.equal(fastPublicNotFound(new Request("https://tahinspare.com"+path),{}),undefined);
  }
  const request = new Request("https://tahinspare.com/wp-login.php");
  for (const key of ["TAHIN_CUTOVER_FREEZE","TAHIN_PREVIEW_READ_ONLY","TAHIN_PREVIEW_LOCKED"]) {
    assert.equal(fastPublicNotFound(request,{[key]:"true"}),undefined);
  }
  assert.equal(fastPublicNotFound(new Request("https://www.tahinspare.com/wp-login.php"),{}),undefined);
  assert.equal(fastPublicNotFound(new Request("https://tahinspare.com/wp-login.php",{method:"POST"}),{}),undefined);
  assert.equal(fastPublicNotFound(new Request("https://tahinspare.com/wp-login.php",{method:"HEAD"}),{})?.body,null);
});

test("cached response preserves existing security and response metadata", async () => {
  const response = addSecurityHeaders(new Response("cached",{headers:{"Cache-Control":"private, no-store","X-Tahin-Catalogue-Cache":"HIT"}}));
  assert.equal(response.headers.get("X-Frame-Options"),"DENY");
  assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.equal(response.headers.get("X-Tahin-Catalogue-Cache"),"HIT");
  assert.equal(await response.text(),"cached");
});
