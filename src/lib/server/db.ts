import { neon } from "@neondatabase/serverless";
import schemaSql from "./schema.sql?raw";
import type { RuntimeEnv } from "./env";

const schemaReady = new Map<string, Promise<void>>();

export function getDb(env: RuntimeEnv) {
  return neon(env.DATABASE_URL);
}

export async function ensureSchema(env: RuntimeEnv) {
  if (!schemaReady.has(env.DATABASE_URL)) {
    const promise = (async () => {
      const sql = getDb(env);
      const statements = schemaSql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await sql.query(statement);
      }
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
