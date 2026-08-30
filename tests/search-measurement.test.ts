import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  contentPublicUrl,
  getIndexNowKey,
  notifyIndexNow,
} from "../src/lib/server/indexnow.ts";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("runtime measurement configuration supports Google and Bing without fake defaults", async () => {
  const serverEnv = await source("src/lib/server/env.ts");
  const astroEnv = await source("src/env.d.ts");
  const layout = await source("src/layouts/MainLayout.astro");
  const example = await source("wrangler.example.jsonc");

  for (const envSource of [serverEnv, astroEnv]) {
    assert.match(envSource, /GOOGLE_ANALYTICS_ID\?: string/);
    assert.match(envSource, /GOOGLE_SITE_VERIFICATION\?: string/);
    assert.match(envSource, /BING_SITE_VERIFICATION\?: string/);
    assert.match(envSource, /INDEXNOW_KEY\?: string/);
  }

  assert.match(layout, /runtimeEnv\.BING_SITE_VERIFICATION/);
  assert.match(layout, /name="msvalidate\.01"/);
  assert.match(example, /"BING_SITE_VERIFICATION": ""/);
  assert.match(example, /"INDEXNOW_KEY": ""/);
});

test("successful contact and enquiry submissions use GA4 recommended generate_lead", async () => {
  const contact = await source("src/pages/contact.astro");
  const enquiry = await source("src/pages/enquiry.astro");

  assert.match(contact, /if \(res\.ok\)[\s\S]*gtag\?\.\('event', 'generate_lead'/);
  assert.match(contact, /lead_source: 'website_contact'/);
  assert.match(enquiry, /if \(res\.ok\)[\s\S]*gtag\?\.\('event', 'generate_lead'/);
  assert.match(enquiry, /lead_source: 'website_enquiry'/);
});

test("IndexNow maps canonical public content URLs and rejects unusable keys", () => {
  assert.equal(contentPublicUrl("products", "abc-123"), "https://tahinspare.com/products/abc-123");
  assert.equal(contentPublicUrl("parts", "pump-seal"), "https://tahinspare.com/parts/pump-seal");
  assert.equal(contentPublicUrl("blog", "buyer-guide"), "https://tahinspare.com/blog/buyer-guide");
  assert.equal(getIndexNowKey({ INDEXNOW_KEY: "" }), "");
  assert.equal(getIndexNowKey({ INDEXNOW_KEY: "short" }), "");
  assert.equal(getIndexNowKey({ INDEXNOW_KEY: "valid-key-123456" }), "valid-key-123456");
});

test("IndexNow notification is a no-op without an authorized key", async () => {
  let calls = 0;
  const result = await notifyIndexNow(
    { INDEXNOW_KEY: "" },
    ["https://tahinspare.com/products/example"],
    async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    },
  );

  assert.equal(result, "disabled");
  assert.equal(calls, 0);
});

test("IndexNow submits only canonical Tahin URLs with explicit key location", async () => {
  let requestUrl = "";
  let payload: Record<string, unknown> = {};

  const result = await notifyIndexNow(
    { INDEXNOW_KEY: "valid-key-123456" },
    [
      "https://tahinspare.com/products/example",
      "https://tahinspare.com/products/example",
      "https://evil.example/not-ours",
    ],
    async (input, init) => {
      requestUrl = String(input);
      payload = JSON.parse(String(init?.body));
      return new Response(null, { status: 202 });
    },
  );

  assert.equal(result, "accepted");
  assert.equal(requestUrl, "https://api.indexnow.org/indexnow");
  assert.deepEqual(payload, {
    host: "tahinspare.com",
    key: "valid-key-123456",
    keyLocation: "https://tahinspare.com/indexnow-key.txt",
    urlList: ["https://tahinspare.com/products/example"],
  });
});

test("content admin API notifies IndexNow after create update and delete", async () => {
  const api = await source("src/lib/server/api.ts");
  const keyRoute = await source("src/pages/indexnow-key.txt.ts");

  assert.match(api, /notifyContentChange/);
  assert.match(api, /await notifyContentChange\(env, type, \[item\.slug\]\)/);
  assert.match(api, /existingItem\?\.slug/);
  assert.match(api, /await notifyContentChange\(env, type, .*item\.slug/);
  assert.match(keyRoute, /getIndexNowKey/);
  assert.match(keyRoute, /status: 404/);
  assert.match(keyRoute, /text\/plain/);
});
