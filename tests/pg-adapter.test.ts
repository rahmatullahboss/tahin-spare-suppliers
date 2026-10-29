import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresSql } from "../src/lib/server/pg-adapter.ts";

const url = process.env.PG_ADAPTER_TEST_URL;


test("PostgreSQL 18 adapter reads a full restored Neon snapshot", { skip: !url }, async () => {
  const host = url ? new URL(url).hostname : "";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host));
  const sql = createPostgresSql(url!);
  const [metadata, products, brands, email, followups] = await sql.transaction([
    sql`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'`,
    sql`SELECT count(*)::int AS count FROM products`,
    sql`SELECT count(*)::int AS count FROM brands`,
    sql`SELECT count(*)::int AS count FROM inbound_emails`,
    sql`SELECT count(*)::int AS count FROM email_followup_drafts`,
  ]);
  assert.equal(metadata[0].count, 15);
  assert.equal(products[0].count, 116);
  assert.equal(brands[0].count, 52);
  assert.equal(email[0].count, 201);
  assert.equal(followups[0].count, 56);
});

test("PostgreSQL adapter supports lazy tagged SQL, raw query and transactions", { skip: !url }, async () => {
  // This integration test is intentionally restricted to disposable local DBs.
  const host = url ? new URL(url).hostname : "";
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(host), "Test database must be localhost");

  const sql = createPostgresSql(url!);
  await sql.query("CREATE TABLE IF NOT EXISTS tahin_adapter_test (id integer PRIMARY KEY, name text NOT NULL)");
  try {
    await sql.query("DELETE FROM tahin_adapter_test");
    const pending = sql`INSERT INTO tahin_adapter_test (id, name) VALUES (${1}, ${"test-one"})`;
    assert.equal(pending.text.includes("$1"), true);

    assert.equal((await sql.query("SELECT count(*)::int AS n FROM tahin_adapter_test"))[0].n, 0);
    await pending;
    const names = await sql.transaction([
      sql`INSERT INTO tahin_adapter_test (id, name) VALUES (${2}, ${"test-two"})`,
      sql`SELECT name FROM tahin_adapter_test ORDER BY id`,
    ]);
    assert.deepEqual(names[1].map((row) => row.name), ["test-one", "test-two"]);

    await assert.rejects(sql.transaction([
      sql`INSERT INTO tahin_adapter_test (id, name) VALUES (${3}, ${"rollback-me"})`,
      sql`INSERT INTO tahin_adapter_test (id, name) VALUES (${1}, ${"duplicate"})`,
    ]));
    const rows = await sql.query("SELECT id FROM tahin_adapter_test ORDER BY id");
    assert.deepEqual(rows.map((row) => row.id), [1, 2]);

    assert.equal((await sql`${sql.unsafe("SELECT 7 AS result")}`)[0].result, 7);
    const timestamp = (await sql`SELECT NOW() AS checked_at`)[0].checked_at;
    assert.equal(typeof timestamp, "string");
    assert.equal(String(timestamp).slice(4, 5), "-");
    assert.equal(String(timestamp).includes("T"), true);
  } finally {
    await sql.query("DROP TABLE tahin_adapter_test");
  }
});
