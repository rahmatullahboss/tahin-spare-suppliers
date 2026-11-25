import assert from "node:assert/strict";
import test from "node:test";
import { createRequestMemo } from "../src/lib/server/request-memo.ts";

test("page and footer share one read only within the same request", async () => {
  const memo = createRequestMemo<number>();
  const a = {}, b = {};
  let reads = 0;
  const load = async () => ++reads;
  assert.equal(memo.has(a), false);
  assert.deepEqual(await Promise.all([memo(a, load), memo(a, load)]), [1, 1]);
  assert.equal(memo.has(a), true);
  assert.equal(memo.has(b), false);
  assert.equal(await memo(a, load), 1);
  assert.equal(await memo(b, load), 2);
  assert.equal(reads, 2);
});

test("a failed request read can be retried and does not poison other requests", async () => {
  const memo = createRequestMemo<number>();
  const a = {};
  await assert.rejects(memo(a, async () => { throw new Error("database unavailable"); }));
  assert.equal(memo.has(a), false);
  assert.equal(await memo(a, async () => 42), 42);
  assert.equal(await memo({}, async () => 9), 9);
});
