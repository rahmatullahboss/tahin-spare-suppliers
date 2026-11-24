import { canonicalizeBrand } from "../inventory-quality.ts";

type Row = Record<string, unknown>;
type ProductIdentity = { id: string; brand?: string; category?: string; relatedProducts?: string[] };

/** Candidates arrive newest-first. Preserve manual priority and legacy brand normalization. */
export function selectRelatedProductRows(rows: Row[], product: ProductIdentity): Row[] {
  const manualSlugs = new Set(product.relatedProducts ?? []);
  const manual: Row[] = [];
  const fallback: Row[] = [];
  for (const row of rows) {
    if (row.id === product.id) continue;
    if (manualSlugs.has(String(row.slug))) {
      manual.push(row);
      if (manual.length === 3) return manual;
    } else if (
      fallback.length < 3 && product.brand &&
      canonicalizeBrand(row.brand) === product.brand &&
      (String(row.category ?? "") || "Uncategorized") === product.category
    ) {
      fallback.push(row);
    }
  }
  return [...manual, ...fallback].slice(0, 3);
}
