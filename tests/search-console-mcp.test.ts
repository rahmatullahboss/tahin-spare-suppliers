import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("Search Console MCP exposes only bounded read-only tools", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("scripts/search-console-mcp.mjs")],
    cwd: process.cwd(),
    stderr: "pipe",
    env: {
      ...process.env,
      GSC_ACCESS_TOKEN: "",
      GSC_CLIENT_ID: "",
      GSC_CLIENT_SECRET: "",
      GSC_REFRESH_TOKEN: "",
    },
  });
  const client = new Client({ name: "search-console-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "gsc_audit_indexing_export",
      "gsc_connection_status",
      "gsc_inspect_url",
      "gsc_list_sitemaps",
      "gsc_list_sites",
      "gsc_query_search_analytics",
      "seo_audit_urls",
    ]);

    const status = await client.callTool({ name: "gsc_connection_status", arguments: {} });
    assert.equal(status.isError, undefined);
    assert.match(String(status.content?.[0]?.text), /"configured": false/);
  } finally {
    await client.close();
  }
});
