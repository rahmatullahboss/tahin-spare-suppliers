import assert from "node:assert/strict";
import test from "node:test";

import {
  SearchConsoleClient,
  auditUrls,
  parseIndexingCsv,
  resolveSafeImportPath,
} from "../scripts/search-console-client.mjs";

test("parses Search Console indexing exports into unique owned URLs", () => {
  const csv = [
    "URL,Reason,Last crawled",
    'https://tahinspare.com/products/cummins,Server error (5xx),2026-09-04',
    'https://tahinspare.com/products/cummins,Server error (5xx),2026-09-04',
    'https://tahinspare.com/category/marine-pump,Server error (5xx),2026-09-03',
    'https://other.example/page,Server error (5xx),2026-09-03',
  ].join("\n");

  assert.deepEqual(parseIndexingCsv(csv), {
    headers: ["URL", "Reason", "Last crawled"],
    records: [
      {
        url: "https://tahinspare.com/products/cummins",
        issue: "Server error (5xx)",
        values: {
          URL: "https://tahinspare.com/products/cummins",
          Reason: "Server error (5xx)",
          "Last crawled": "2026-09-04",
        },
      },
      {
        url: "https://tahinspare.com/category/marine-pump",
        issue: "Server error (5xx)",
        values: {
          URL: "https://tahinspare.com/category/marine-pump",
          Reason: "Server error (5xx)",
          "Last crawled": "2026-09-03",
        },
      },
    ],
    skippedRows: 1,
  });
});

test("rejects indexing imports outside the configured project root", () => {
  assert.equal(
    resolveSafeImportPath("reports/gsc.csv", "/srv/tahin-spare-suppliers"),
    "/srv/tahin-spare-suppliers/reports/gsc.csv",
  );
  assert.throws(
    () => resolveSafeImportPath("../secrets/gsc.csv", "/srv/tahin-spare-suppliers"),
    /inside the configured import root/,
  );
});

test("audits exported URLs and classifies 5xx, noindex, and canonical anomalies", async () => {
  const responses = new Map<string, Response>([
    [
      "https://tahinspare.com/products/cummins",
      new Response("upstream failed", { status: 502, headers: { "content-type": "text/plain" } }),
    ],
    [
      "https://tahinspare.com/category/marine-pump",
      new Response(
        '<html><head><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://tahinspare.com/products/pump"></head></html>',
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    ],
  ]);

  const report = await auditUrls(
    [
      "https://tahinspare.com/products/cummins",
      "https://tahinspare.com/category/marine-pump",
    ],
    {
      canonicalOrigin: "https://tahinspare.com",
      fetchImpl: async (input) => {
        const response = responses.get(String(input));
        if (!response) throw new Error("unexpected URL");
        return response;
      },
    },
  );

  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.serverErrors, 1);
  assert.equal(report.summary.noindex, 1);
  assert.equal(report.summary.canonicalMismatch, 1);
  assert.equal(report.results[0].status, 502);
  assert.deepEqual(report.results[0].issues, ["server_error_5xx"]);
  assert.deepEqual(report.results[1].issues, ["noindex", "canonical_mismatch"]);
});

test("Search Console client uses read-only OAuth bearer requests and official endpoints", async () => {
  const calls: Array<{ url: string; method: string; body?: string; authorization?: string }> = [];
  const client = new SearchConsoleClient({
    siteUrl: "sc-domain:tahinspare.com",
    tokenProvider: async () => "test-access-token",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
        authorization: new Headers(init?.headers).get("authorization") ?? undefined,
      });
      return new Response(JSON.stringify({ sites: [], inspectionResult: { indexStatusResult: {} } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.listSites();
  await client.inspectUrl("https://tahinspare.com/products/cummins");

  assert.equal(calls[0].url, "https://www.googleapis.com/webmasters/v3/sites");
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].authorization, "Bearer test-access-token");
  assert.equal(calls[1].url, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].authorization, "Bearer test-access-token");
  assert.deepEqual(JSON.parse(calls[1].body ?? "{}"), {
    inspectionUrl: "https://tahinspare.com/products/cummins",
    siteUrl: "sc-domain:tahinspare.com",
    languageCode: "en-US",
  });
});
