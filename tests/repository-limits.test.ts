import assert from "node:assert/strict";
import test from "node:test";

import { normalizeContentLimit } from "../src/lib/server/content-limit.ts";

test("normalizeContentLimit preserves the 1000-record public inventory request", () => {
  assert.equal(normalizeContentLimit(1000), 1000);
});

test("normalizeContentLimit keeps a bounded upper limit", () => {
  assert.equal(normalizeContentLimit(5000), 1000);
  assert.equal(normalizeContentLimit(0), 1);
  assert.equal(normalizeContentLimit(undefined), 20);
});
