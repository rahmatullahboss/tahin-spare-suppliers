// Read-only connectivity probe. Run only with a securely injected local secret.
// Requires: node --experimental-strip-types scripts/supabase-smoke.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPostgresSql } from "../src/lib/server/pg-adapter.ts";
import { resolveSupabaseConnection } from "../src/lib/server/supabase-connection.ts";

function schemaFingerprint(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function main() {
  if (!process.env.SUPABASE_DATABASE_URL) {
    throw new Error("SUPABASE_DATABASE_URL secret is not configured; no connection attempted");
  }
  const { connectionString, requireTls } = resolveSupabaseConnection({
    SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL,
  });
  assert.equal(requireTls, true);
  const sql = createPostgresSql(connectionString, { requireTls });
  const expectedVersion = schemaFingerprint(await readFile(
    new URL("../src/lib/server/schema.sql", import.meta.url), "utf8",
  ));
  const [role, schema, tables, products, inbound, sent, followups] = await sql.transaction([
    sql`SELECT current_user AS current_role, current_database() AS database_name`,
    sql`SELECT version FROM public.app_schema_meta WHERE key='main'`,
    sql`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'`,
    sql`SELECT count(*)::int AS n FROM public.products`,
    sql`SELECT count(*)::int AS n FROM public.inbound_emails`,
    sql`SELECT count(*)::int AS n FROM public.sent_emails`,
    sql`SELECT count(*)::int AS n FROM public.email_followup_drafts`,
  ]);
  assert.equal(role[0]?.current_role, "tahin_worker");
  assert.equal(role[0]?.database_name, "postgres");
  assert.equal(schema[0]?.version, expectedVersion);
  assert.equal(tables[0]?.n, 15);

  // Only metadata and aggregate counts, never private email contents or secrets.
  console.log(JSON.stringify({
    result: "READ_ONLY_SMOKE_PASS",
    schema: expectedVersion,
    tables: tables[0]?.n,
    products: products[0]?.n,
    inbound_emails: inbound[0]?.n,
    sent_emails: sent[0]?.n,
    followup_drafts: followups[0]?.n,
  }));
}

main().catch((error) => {
  // Avoid printing connection strings, SQL parameters, passwords, or private rows.
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unclassified";
  console.error(`Supabase read-only smoke failed (${code}); check private credentials and network diagnostics`);
  process.exitCode = 1;
});
