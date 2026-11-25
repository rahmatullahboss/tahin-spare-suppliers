import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isCompletedInboundReplay } from "../src/lib/server/inbound-replay.ts";

test("only completed forwarding permits a replay fast path", async () => {
  for (const state of ["pending", "processing", "failed", "forwarded", "missing"]) {
    const sql = { async query(text: string, params: string[]) {
      assert.match(text, /resend_email_id = \$1 AND forward_status = 'forwarded'/);
      assert.deepEqual(params, ["synthetic-email"]);
      return state === "forwarded" ? [{completed: 1}] : [];
    }};
    assert.equal(await isCompletedInboundReplay(sql, "synthetic-email"), state === "forwarded", state);
  }
});

test("unknown ID and database errors cannot be mistaken for completed forwards", async () => {
  const sql = { async query(): Promise<Record<string, unknown>[]> { throw new Error("database offline"); }};
  assert.equal(await isCompletedInboundReplay(sql, ""), false);
  await assert.rejects(isCompletedInboundReplay(sql, "synthetic-email"), /database offline/);
});

test("verified webhook fast path precedes provider fetch, while existing claim and failure recovery remain", async () => {
  const source = await readFile(new URL("../src/pages/api/webhooks/resend/inbound.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("verifyResendWebhook(env, rawBody") < source.indexOf("await isCompletedInboundReplay"));
  assert.ok(source.indexOf("await isCompletedInboundReplay") < source.indexOf("await getReceivedEmail"));
  assert.match(source, /forward_status IN \('pending', 'failed'\)/);
  assert.match(source, /INTERVAL '5 minutes'/);
  assert.match(source, /SET forward_status = 'failed'/);
  assert.match(source, /SET forward_status = 'forwarded'/);
});
