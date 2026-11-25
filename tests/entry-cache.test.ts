import assert from "node:assert/strict";
import test from "node:test";
import { canUseCatalogueEntryCache } from "../src/lib/server/entry-cache.ts";
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
test("cached response preserves existing security and response metadata", async () => {
  const response = addSecurityHeaders(new Response("cached",{headers:{"Cache-Control":"private, no-store","X-Tahin-Catalogue-Cache":"HIT"}}));
  assert.equal(response.headers.get("X-Frame-Options"),"DENY");
  assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.equal(response.headers.get("X-Tahin-Catalogue-Cache"),"HIT");
  assert.equal(await response.text(),"cached");
});
