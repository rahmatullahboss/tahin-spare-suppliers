import { neon } from "@neondatabase/serverless";
import { createPostgresSql, withPostgresReader, type DatabaseReader } from "./pg-adapter";
import { resolveSupabaseConnection } from "./supabase-connection";
import schemaSql from "./schema.sql?raw";
import type { RuntimeEnv } from "./env";

const schemaReady = new Map<string, Promise<void>>();

function schemaFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const SCHEMA_VERSION = schemaFingerprint(schemaSql);

export function getDb(env: RuntimeEnv): ReturnType<typeof neon> {
  if (env.DB_PROVIDER === "supabase") {
    const connection = resolveSupabaseConnection(env);
    return createPostgresSql(connection.connectionString, { requireTls: connection.requireTls }) as unknown as ReturnType<typeof neon>;
  }
  if (env.DB_PROVIDER === "aiven") {
    if (!env.AIVEN_HYPERDRIVE?.connectionString) {
      throw new Error("Aiven selected, but AIVEN_HYPERDRIVE binding is unavailable");
    }
    return createPostgresSql(env.AIVEN_HYPERDRIVE.connectionString) as unknown as ReturnType<typeof neon>;
  }
  if (!env.DATABASE_URL) throw new Error("Neon database URL is missing");
  return neon(env.DATABASE_URL);
}

/** Explicit read scope; existing writers and transactions keep their original adapter. */
export async function withDatabaseReader<T>(env: RuntimeEnv, operation: (reader: DatabaseReader) => Promise<T>): Promise<T> {
  if (env.DB_PROVIDER === "supabase") {
    const connection = resolveSupabaseConnection(env);
    return withPostgresReader(connection.connectionString, { requireTls: connection.requireTls }, async reader => {
      // The restricted Supabase role only validates metadata. Reuse this
      // request's connection for the cold check; never run migrations here.
      await ensureSchema(env, reader);
      return operation(reader);
    });
  }
  await ensureSchema(env);
  if (env.DB_PROVIDER === "aiven") {
    if (!env.AIVEN_HYPERDRIVE?.connectionString) throw new Error("Aiven selected, but AIVEN_HYPERDRIVE binding is unavailable");
    return withPostgresReader(env.AIVEN_HYPERDRIVE.connectionString, {}, operation);
  }
  const sql = getDb(env);
  return operation({ query: async (text, params) => await sql.query(text, params) });
}

export async function ensureSchema(env: RuntimeEnv, scopedReader?: DatabaseReader) {
  const databaseKey = env.DB_PROVIDER === "supabase"
    ? resolveSupabaseConnection(env).connectionString
    : env.DB_PROVIDER === "aiven" ? env.AIVEN_HYPERDRIVE?.connectionString : env.DATABASE_URL;
  if (!databaseKey) throw new Error("Active database connection is missing");
  if (!schemaReady.has(databaseKey)) {
    const promise = (async () => {
      const sql = getDb(env);
      // Hot paths do only a read on a cold Worker isolate, not a DDL transaction.
      // Schema creation remains available for newly provisioned installations.
      let deployedVersion = "";
      try {
        const reader = env.DB_PROVIDER === "supabase" && scopedReader ? scopedReader : sql;
        const rows = await reader.query("SELECT version FROM app_schema_meta WHERE key = 'main' LIMIT 1");
        deployedVersion = String(rows?.[0]?.version ?? "");
      } catch (error) {
        const code = (error as { code?: string })?.code;
        const message = error instanceof Error ? error.message : "";
        if (code !== "42P01" && !/relation .*app_schema_meta.* does not exist/i.test(message)) {
          throw error;
        }
        if (env.DB_PROVIDER === "supabase") {
          throw new Error("Supabase schema metadata missing: restore reviewed schema before cutover");
        }
        await sql`CREATE TABLE IF NOT EXISTS app_schema_meta (
          key TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      }

      if (deployedVersion === SCHEMA_VERSION) {
        return;
      }
      // Supabase has a restricted backend role. Schema updates must be applied
      // as reviewed migrations, never by the public request path.
      if (env.DB_PROVIDER === "supabase") {
        throw new Error("Supabase schema mismatch: apply reviewed migration before cutover");
      }

      const statements = schemaSql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);

      if (statements.length > 0) {
        await sql.transaction(statements.map((statement) => sql`${sql.unsafe(statement)}`));
      }

      await sql`
        INSERT INTO app_schema_meta (key, version, updated_at)
        VALUES ('main', ${SCHEMA_VERSION}, NOW())
        ON CONFLICT (key)
        DO UPDATE SET version = EXCLUDED.version, updated_at = NOW()
      `;
    })();

    schemaReady.set(databaseKey, promise);

    try {
      await promise;
    } catch (error) {
      schemaReady.delete(databaseKey);
      throw error;
    }

    return;
  }

  await schemaReady.get(databaseKey);
}
