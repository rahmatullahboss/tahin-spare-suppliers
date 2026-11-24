import assert from "node:assert/strict";
import test from "node:test";
import { selectRelatedProductRows } from "../src/lib/server/related-product-rows.ts";

const row = (id: string, brand: string, category: string) => ({ id, slug: id, brand, category });

test("related cards preserve manual priority, legacy brand aliases, order and limit", () => {
  const rows = [
    row("self", "Caterpillar", "Engines"),
    row("a", "CAT", "Engines"),
    row("wrong-category", "CAT", "Parts"),
    row("b", "Caterpiller", "Engines"),
    row("manual", "Other", "Parts"),
    row("c", "Caterpillar", "Engines"),
  ];
  assert.deepEqual(selectRelatedProductRows(rows, {
    id: "self", brand: "Caterpillar", category: "Engines", relatedProducts: ["self", "manual"],
  }).map(r => r.id), ["manual", "a", "b"]);
});

test("manual selection works without a brand and fallback handles empty category", () => {
  const rows = [row("a", "Yamnar", ""), row("b", "Yanmar", "Uncategorized"), row("c", "Yanmar", "Parts")];
  assert.deepEqual(selectRelatedProductRows(rows, { id: "self", relatedProducts: ["c"] }).map(r => r.id), ["c"]);
  assert.deepEqual(selectRelatedProductRows(rows, { id: "self", brand: "Yanmar", category: "Uncategorized" }).map(r => r.id), ["a", "b"]);
  assert.deepEqual(selectRelatedProductRows(rows, { id: "self" }), []);
});
