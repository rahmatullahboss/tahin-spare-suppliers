# Tahin Spare Search Console connector

This connector gives an AI a bounded, read-only view of Google Search Console data and public URL behavior for Tahin Spare Suppliers. It does not deploy code, submit indexing requests, validate fixes, or modify Search Console state.

## Included tools

The stdio MCP server in `scripts/search-console-mcp.mjs` exposes read-only operations for:

- connection status
- owned Search Console sites
- submitted sitemaps
- URL Inspection
- Search Analytics
- Page indexing CSV import and live URL audit
- direct public URL SEO audits

Google's API does not expose the full Page indexing issue table as a public report. For that workflow, export the affected URL table from Search Console as CSV and audit those URLs locally.

## CSV audit workflow

1. Export the affected URLs from Search Console.
2. Save the CSV somewhere under the configured project/import root.
3. Run:

```sh
npm run search-console:audit -- --csv reports/search-console-5xx.csv --output reports/search-console-5xx-audit.json
```

The audit checks owned URLs only and reports HTTP status, redirects, noindex, canonical state and fetch errors. Imports are bounded, deduplicated and restricted to `https://tahinspare.com`.

## OAuth and local credentials

Use Google OAuth with the minimum read-only Search Console scope. Keep client credentials and refresh credentials outside the repository in a local secret manager or protected configuration file.

The repository must never contain credential values, exported browser sessions, access tokens or refresh credentials.

If local authorization expires, rerun the project OAuth bootstrap:

```sh
cd /home/user/dev/tahin-spare-suppliers
npm run search-console:auth -- --port 53682
```

If the browser is on another machine, use a secure loopback tunnel to the server before opening the generated Google authorization URL.

## Local MCP registration

Register the MCP server in the client using:

```text
node /home/user/dev/tahin-spare-suppliers/scripts/search-console-mcp.mjs
```

Provide Search Console credentials through the client's private environment or secret manager. Keep the site property scoped to `sc-domain:tahinspare.com` and the public URL origin scoped to `https://tahinspare.com`.

## Safety boundary

The connector is intentionally read-only. It may gather Search Console evidence and live URL diagnostics so code fixes can be proposed and verified, but repository writes, deployment, indexing requests and Search Console validation remain separate explicit actions.
