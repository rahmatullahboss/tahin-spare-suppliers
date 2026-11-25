import assert from "node:assert/strict";
import test from "node:test";
import { markInboundMessagesRead, readInboundCounts } from "../src/lib/server/inbound-read-state.ts";

test("thread read state is batched and only selected unread messages change", async () => {
  let calls = 0;
  const sql = { async query(text: string, params?: unknown[]) {
    calls++;
    assert.match(text, /WHERE id = ANY\(\$1::text\[\]\) AND is_read = false/);
    assert.deepEqual(params, [["a","b"]]);
    return [{id:"a"}];
  }};
  assert.equal(await markInboundMessagesRead(sql, []),0);
  assert.equal(await markInboundMessagesRead(sql, ["a","b","a",""]),1);
  assert.equal(calls,1);
});

test("mailbox counts are read in a single statement", async () => {
  let calls = 0;
  const sql = { async query(text: string) {
    calls++;
    assert.match(text, /COUNT\(\*\) FILTER \(WHERE is_read = false\)/);
    return [{total:"9",unread:"3"}];
  }};
  assert.deepEqual(await readInboundCounts(sql),{total:"9",unreadCount:"3"});
  assert.equal(calls,1);
});
