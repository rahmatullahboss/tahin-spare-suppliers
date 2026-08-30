import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("schema bootstrap batches statements into one Neon transaction", async () => {
  const db = await source("src/lib/server/db.ts");
  const schema = await source("src/lib/server/schema.sql");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  assert.ok(statements.length > 50, "fixture must remain large enough to exercise the Cloudflare subrequest risk");
  assert.match(db, /sql\.transaction\(statements\.map\(\(statement\) => sql`\$\{sql\.unsafe\(statement\)\}`\)\)/);
  assert.doesNotMatch(db, /for \(const statement of statements\)[\s\S]*await sql\.query\(statement\)/);
});
