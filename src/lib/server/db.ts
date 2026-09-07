import { neon } from "@neondatabase/serverless";
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

export function getDb(env: RuntimeEnv) {
  return neon(env.DATABASE_URL);
}

export async function ensureSchema(env: RuntimeEnv) {
  if (!schemaReady.has(env.DATABASE_URL)) {
    const promise = (async () => {
      const sql = getDb(env);
      const [, versionRows] = await sql.transaction([
        sql`CREATE TABLE IF NOT EXISTS app_schema_meta (
          key TEXT PRIMARY KEY,
          version TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        sql`SELECT version FROM app_schema_meta WHERE key = 'main' LIMIT 1`,
      ]);

      if (String(versionRows?.[0]?.version ?? "") === SCHEMA_VERSION) {
        return;
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

    schemaReady.set(env.DATABASE_URL, promise);

    try {
      await promise;
    } catch (error) {
      schemaReady.delete(env.DATABASE_URL);
      throw error;
    }

    return;
  }

  await schemaReady.get(env.DATABASE_URL);
}
