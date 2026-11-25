import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveSupabaseConnection } from "../src/lib/server/supabase-connection.ts";
import { getPublicPreviewImageUrl } from "../src/lib/canonical-url.ts";
import { isCutoverReadAllowed } from "../src/lib/cutover-fence.ts";

test("Cutover fence blocks writes, admin GET side effects and webhooks but preserves public reads", () => {
  for (const path of ["/", "/category/spare-parts", "/images/marine-engine.webp", "/api/products", "/contact"]) assert.equal(isCutoverReadAllowed("GET", path), true);
  for (const path of ["/admin", "/admin/emails/thread/inbound/id", "/api/admin/emails/inbound/id", "/api/admin/emails/followups", "/api/webhooks/resend/inbound", "/mcp", "/api/upload", "/migration-qa"]) assert.equal(isCutoverReadAllowed("GET", path), false);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.equal(isCutoverReadAllowed(method, "/api/products"), false);
});

test("Preview restores public production images without redirecting private or unsafe paths", () => {
  for (const path of ["/images/marine-engine.webp", "/images/diesel-generator.webp", "/images/shipments/shipment-01.webp", "/images/brands/yanmar-1.svg"]) {
    assert.equal(getPublicPreviewImageUrl(path), `https://tahinspare.com${path}`);
  }
  for (const path of ["/api/admin/emails", "/images/../api/private.png", "/images/%2e%2e/private.png", "/images/a%2fb.png", "//other.example/image.webp", "/images/file.pdf", "/images/photo.webp?token=secret"]) {
    assert.equal(getPublicPreviewImageUrl(path), undefined);
  }
});

const source = async (file: string) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const valid = "postgres://tahin_worker.xpfowzrwjbojbgtekoim:placeholder@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("Supabase release config preserves production resources and isolates preview QA", async () => {
  const db = await source("src/lib/server/db.ts");
  const env = await source("src/lib/server/env.ts");
  const wrangler = await source("wrangler.jsonc");

  assert.match(db, /env\.DB_PROVIDER === "supabase"/);
  assert.match(db, /resolveSupabaseConnection\(env\)/);
  assert.match(db, /createPostgresSql\(connection\.connectionString, \{ requireTls: connection\.requireTls \}\)/);
  assert.match(env, /"neon" \| "aiven" \| "supabase"/);
  assert.match(env, /SUPABASE_DATABASE_URL\?: string/);
  const config = JSON.parse(wrangler);
  assert.equal(config.vars?.DB_PROVIDER, "supabase");
  assert.equal(config.vars?.TAHIN_PREVIEW_LOCKED, undefined);
  assert.deepEqual(config.kv_namespaces, [{ binding: "SESSION", id: "e8d999cbc9f74919ab062abb24b976c9" }]);
  assert.deepEqual(config.r2_buckets, [{ binding: "MEDIA_BUCKET", bucket_name: "tahin-spare-suppliers-media" }]);
  assert.equal(config.name, "tahin-spare-suppliers");
  const preview = config.previews;
  assert.equal(config.env?.["supabase-preview"], undefined);
  assert.equal(preview?.vars?.DB_PROVIDER, "supabase");
  assert.equal(preview?.vars?.TAHIN_PREVIEW_READ_ONLY, "true");
  assert.equal(config.vars?.TAHIN_PREVIEW_READ_ONLY, undefined);
  const middleware = await source("src/middleware.ts");
  assert.match(middleware, /env\.TAHIN_PREVIEW_READ_ONLY === 'true'/);
  assert.match(middleware, /if \(!readMethod \|\| !publicPage\)/);
  assert.match(middleware, /await ensureSchema\(runtime\)/);
  assert.match(middleware, /await import\('\.\/lib\/server\/db'\)/);
  assert.doesNotMatch(middleware, /^import .*from '\.\/lib\/server\/(?:db|supabase-connection)'/m);
  assert.ok(middleware.indexOf("if (env.TAHIN_PREVIEW_READ_ONLY") < middleware.indexOf("const canonicalRedirectUrl ="));
  assert.equal(preview?.route, undefined);
  assert.equal(preview?.routes, undefined);
  assert.deepEqual(preview?.hyperdrive, [{ binding: "SUPABASE_HYPERDRIVE", id: "4b2bf739409f4562b7d1a012a84d8a4f" }]);
  assert.deepEqual(config.hyperdrive, preview.hyperdrive);
  assert.deepEqual(preview?.kv_namespaces, [{ binding: "SESSION", id: "a497da7b883d4e01aaa3a087693e20ac" }]);
  assert.deepEqual(preview?.r2_buckets, [{ binding: "MEDIA_BUCKET", bucket_name: "tahin-spare-suppliers-supabase-preview-media-bucket" }]);
  assert.notEqual(preview.kv_namespaces[0].id, config.kv_namespaces[0].id);
  assert.notEqual(preview.r2_buckets[0].bucket_name, config.r2_buckets[0].bucket_name);
  assert.doesNotMatch(wrangler, /"SUPABASE_DATABASE_URL"/);
});

test("Supabase direct connection targets the private Tahin role and verifies TLS", async () => {
  const connection = resolveSupabaseConnection({ SUPABASE_DATABASE_URL: valid });
  assert.equal(connection.requireTls, true);
  assert.equal(new URL(connection.connectionString).port, "6543");
  assert.equal(new URL(connection.connectionString).searchParams.has("sslmode"), false);
  const adapter = await source("src/lib/server/pg-adapter.ts");
  assert.match(adapter, /ssl: \{ rejectUnauthorized: true \}/);
  assert.match(adapter, /connectionTimeoutMillis: 10000/);
  // The backend uses unnamed parameterized pg queries, compatible with Supavisor transaction mode.
  assert.doesNotMatch(adapter, /name:\s*["']/);
});

test("Supabase direct session pooler is an explicit fallback", () => {
  const connection = resolveSupabaseConnection({
    SUPABASE_DATABASE_URL: valid.replace(":6543/", ":5432/"),
  });
  assert.equal(new URL(connection.connectionString).port, "5432");
  assert.equal(connection.requireTls, true);
});

test("Wrong database, owner role, plaintext, disabled TLS and absent credentials fail closed", () => {
  const invalid = [
    valid.replace("tahin_worker.", "postgres."),
    valid.replace("xpfowzrwjbojbgtekoim", "otherproject"),
    valid.replace(".pooler.supabase.com", ".other-host.com"),
    valid.replace(":6543/", ":4444/"),
    valid.replace("/postgres?", "/neondb?"),
    valid.replace("postgres://", "http://"),
    valid.replace("sslmode=require", "sslmode=disable"),
    valid.replace(":placeholder@", ":@"),
  ];
  for (const SUPABASE_DATABASE_URL of invalid) {
    assert.throws(() => resolveSupabaseConnection({ SUPABASE_DATABASE_URL }));
  }
  assert.throws(() => resolveSupabaseConnection({}));
});

test("Actual Singapore pooler format and safe field-specific diagnostics", () => {
  const uri = valid.replace("aws-0-", "aws-1-").replace("postgres://", "postgresql://");
  assert.equal(new URL(resolveSupabaseConnection({ SUPABASE_DATABASE_URL: ` ${uri}\n` }).connectionString).hostname, "aws-1-ap-southeast-1.pooler.supabase.com");
  assert.throws(() => resolveSupabaseConnection({ SUPABASE_DATABASE_URL: uri.replace("tahin_worker.", "postgres.") }), /Wrong username/);
  assert.throws(() => resolveSupabaseConnection({ SUPABASE_DATABASE_URL: uri.replace(":placeholder@", ":%5BNEW-PASSWORD%5D@") }), /Password placeholder/);
  assert.throws(() => resolveSupabaseConnection({ SUPABASE_DATABASE_URL: `${uri}&user=postgres` }), /Unexpected connection option/);
  assert.throws(() => resolveSupabaseConnection({}), /missing from the active Preview runtime/);
});

test("An explicit Hyperdrive binding takes precedence over a stale direct pooler secret", () => {
  const fallback = resolveSupabaseConnection({
    SUPABASE_HYPERDRIVE: { connectionString: "postgres://preview-only" },
  });
  assert.equal(fallback.requireTls, false);
  assert.equal(fallback.connectionString, "postgres://preview-only");
  const direct = resolveSupabaseConnection({
    SUPABASE_DATABASE_URL: valid,
    SUPABASE_HYPERDRIVE: { connectionString: "postgres://preview-only" },
  });
  assert.equal(direct.requireTls, false);
  assert.equal(direct.connectionString, "postgres://preview-only");
  assert.throws(() => resolveSupabaseConnection({ SUPABASE_DATABASE_URL: valid, SUPABASE_HYPERDRIVE: { connectionString: "" } }), /binding has no connection string/);
});

test("Supabase does not execute request-time DDL on missing or changed schema", async () => {
  const db = await source("src/lib/server/db.ts");
  assert.match(db, /Supabase schema metadata missing: restore reviewed schema before cutover/);
  assert.match(db, /if \(env\.DB_PROVIDER === "supabase"\)\s*\{\s*throw new Error\("Supabase schema mismatch/);
  assert.match(db, /if \(deployedVersion === SCHEMA_VERSION\)/);
});
