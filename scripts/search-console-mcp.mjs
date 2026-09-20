import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  DEFAULT_ALLOWED_ORIGIN,
  DEFAULT_SITE_URL,
  SEARCH_CONSOLE_READONLY_SCOPE,
  auditIndexingExport,
  auditUrls,
  createSearchConsoleClient,
} from "./search-console-client.mjs";

function jsonResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: message }) }] };
}

function withErrorBoundary(handler) {
  return async (input) => {
    try {
      return jsonResult(await handler(input));
    } catch (error) {
      return errorResult(error);
    }
  };
}

export function createSearchConsoleMcpServer(env = process.env, fetchImpl = fetch) {
  const server = new McpServer(
    { name: "tahin-spare-search-console", version: "1.0.0" },
    {
      instructions: "Read-only Tahin Spare Search Console and public SEO diagnostics. Do not modify code, deploy, or submit validation requests from these tools.",
    },
  );
  const client = createSearchConsoleClient(env, fetchImpl);
  const siteUrl = env.GSC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  const allowedOrigin = env.GSC_ALLOWED_ORIGIN?.trim() || DEFAULT_ALLOWED_ORIGIN;

  server.tool(
    "gsc_connection_status",
    "Report Search Console connector configuration without exposing credentials.",
    {},
    async () => jsonResult({
      siteUrl,
      allowedOrigin,
      oauth: {
        configured: Boolean(env.GSC_ACCESS_TOKEN?.trim() || env.GSC_TOKEN_FILE?.trim() || env.GSC_REFRESH_TOKEN?.trim()),
        mode: env.GSC_ACCESS_TOKEN?.trim() ? "access_token" : env.GSC_TOKEN_FILE?.trim() ? "token_file" : env.GSC_REFRESH_TOKEN?.trim() ? "refresh_token" : "missing",
        requiredScope: SEARCH_CONSOLE_READONLY_SCOPE,
      },
      capabilities: ["list_sites", "list_sitemaps", "inspect_url", "query_search_analytics", "import_indexing_csv", "audit_public_urls"],
      writeActions: [],
    }),
  );

  server.tool(
    "gsc_list_sites",
    "List Search Console properties available to the authorized Google account.",
    {},
    withErrorBoundary(() => client.listSites()),
  );

  server.tool(
    "gsc_list_sitemaps",
    "List submitted Search Console sitemaps for a property.",
    { siteUrl: z.string().min(1).optional() },
    withErrorBoundary(({ siteUrl: requestedSiteUrl }) => client.listSitemaps(requestedSiteUrl || siteUrl)),
  );

  server.tool(
    "gsc_inspect_url",
    "Inspect one Tahin Spare URL's current Google index status using Search Console URL Inspection.",
    {
      inspectionUrl: z.string().url(),
      siteUrl: z.string().min(1).optional(),
      languageCode: z.string().min(2).max(16).optional(),
    },
    withErrorBoundary(({ inspectionUrl, siteUrl: requestedSiteUrl, languageCode }) => client.inspectUrl(inspectionUrl, requestedSiteUrl || siteUrl, languageCode || "en-US")),
  );

  server.tool(
    "gsc_query_search_analytics",
    "Query read-only Search Console clicks, impressions, CTR, and position data.",
    {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dimensions: z.array(z.string()).max(5).optional(),
      type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
      rowLimit: z.number().int().min(1).max(25000).optional(),
      startRow: z.number().int().min(0).optional(),
      siteUrl: z.string().min(1).optional(),
    },
    withErrorBoundary((input) => client.querySearchAnalytics(input)),
  );

  server.tool(
    "seo_audit_urls",
    "Fetch bounded public URL diagnostics for exported Search Console URLs: HTTP status, 5xx, redirects, noindex, canonical, and fetch errors.",
    {
      urls: z.array(z.string().url()).min(1).max(100),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
      concurrency: z.number().int().min(1).max(20).optional(),
    },
    withErrorBoundary(({ urls, timeoutMs, concurrency }) => auditUrls(urls, {
      canonicalOrigin: allowedOrigin,
      timeoutMs,
      concurrency,
      fetchImpl,
    })),
  );

  server.tool(
    "gsc_audit_indexing_export",
    "Read a Search Console indexing CSV inside the configured project root and audit its owned URLs. This is read-only and never changes the repository.",
    {
      csvPath: z.string().min(1),
      timeoutMs: z.number().int().min(1000).max(60000).optional(),
      concurrency: z.number().int().min(1).max(20).optional(),
    },
    withErrorBoundary(({ csvPath, timeoutMs, concurrency }) => auditIndexingExport(csvPath, {
      allowedRoot: env.GSC_IMPORT_ROOT?.trim() || process.cwd(),
      canonicalOrigin: allowedOrigin,
      timeoutMs,
      concurrency,
      fetchImpl,
    })),
  );

  return server;
}

const server = createSearchConsoleMcpServer();
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
