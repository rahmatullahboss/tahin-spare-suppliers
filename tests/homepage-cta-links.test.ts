import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeHomepageCtaUrl } from "../src/lib/page-content.ts";

test("quote URLs recover malformed CMS destinations to the local enquiry page", () => {
  const invalidUrls: unknown[] = [
    undefined,
    null,
    "",
    "  ",
    "enquiry",
    "/enquiry",
    "//enquiry",
    "https://enquiry",
    "https://enquiry/",
    "http://enquiry",
    "https://enquiry?ref=homepage",
    "javascript:alert(1)",
    "data:text/html,payload",
    "//external.example.com/enquiry",
    "https://",
    42
  ];

  for (const value of invalidUrls) {
    assert.equal(normalizeHomepageCtaUrl(value), "/enquiry", String(value));
  }
});

test("quote URLs preserve legitimate local and external destinations", () => {
  assert.equal(normalizeHomepageCtaUrl("/enquiry?product=marine-engine"), "/enquiry?product=marine-engine");
  assert.equal(normalizeHomepageCtaUrl("/contact"), "/contact");
  assert.equal(normalizeHomepageCtaUrl(" https://tahinspare.com/enquiry "), "https://tahinspare.com/enquiry");
  assert.equal(normalizeHomepageCtaUrl("https://quotes.example.com/request"), "https://quotes.example.com/request");
});

test("both homepage quote CTAs normalize their URLs at render and saved CMS content is healed on read/write", async () => {
  const [homepage, server] = await Promise.all([
    readFile(new URL("../src/pages/index.astro", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/server/page-content.ts", import.meta.url), "utf8")
  ]);

  assert.match(homepage, /href=\{normalizeHomepageCtaUrl\(homeContent\.hero\.ctaUrl\)\}/);
  assert.match(homepage, /href=\{normalizeHomepageCtaUrl\(homeContent\["export-logistics"\]\.ctaUrl\)\}/);
  assert.match(server, /content\.hero\.ctaUrl = normalizeHomepageCtaUrl\(content\.hero\.ctaUrl\)/);
  assert.match(server, /content\["export-logistics"\]\.ctaUrl = normalizeHomepageCtaUrl/);
  assert.match(server, /merged\.ctaUrl = normalizeHomepageCtaUrl\(merged\.ctaUrl\)/);
});
