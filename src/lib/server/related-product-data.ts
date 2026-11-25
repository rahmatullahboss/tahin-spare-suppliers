import type { DatabaseReader } from "./pg-adapter.ts";
import { selectRelatedProductRows } from "./related-product-rows.ts";
import { mapProductSummary, type ProductSummary } from "./product-summary.ts";

export async function readRelatedProductSummaries(sql: DatabaseReader, product: { id: string; brand?: string; category?: string; relatedProducts?: string[] }): Promise<ProductSummary[]> {
  const slugs = product.relatedProducts ?? [];
  if (slugs.length === 0 && !product.brand) return [];
  // Preserve the old newest-1000 candidate window and category/brand semantics.
  // Filter category and explicit slugs in SQL; normalize legacy brand aliases in JS.
  const rows = await sql.query(`
    SELECT recent.* FROM (
      SELECT p.id, p.slug, p.updated_at, p.category, p.brand
      FROM products p ORDER BY p.updated_at DESC LIMIT 1000
    ) recent
    WHERE recent.id <> $1
      AND (recent.slug = ANY($2::text[]) OR
           ($3::boolean AND COALESCE(NULLIF(recent.category, ''), 'Uncategorized') = $4))
    ORDER BY recent.updated_at DESC
  `, [product.id, slugs, Boolean(product.brand), product.category ?? ""]);
  const selected = selectRelatedProductRows(rows, product);
  if (!selected.length) return [];
  const ids = selected.map(row => String(row.id));
  const details = await sql.query(`
    SELECT p.id, p.slug, p.name, p.short_description, p.image_url, p.updated_at,
           p.category, p.subcategory, p.brand, p.model_number, p.part_number, p.image_alt
    FROM products p WHERE p.id = ANY($1::text[])
  `, [ids]);
  const detailsById = new Map(details.map(row => [String(row.id), row]));
  // Recheck the matching authority after the second read in case a product
  // changed or was removed between the two statements.
  const ordered = ids.flatMap(id => {
    const row = detailsById.get(id);
    return row ? [row] : [];
  });
  return selectRelatedProductRows(ordered, product).map(mapProductSummary);
}

