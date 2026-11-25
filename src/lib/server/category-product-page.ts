import type { DatabaseReader } from "./pg-adapter.ts";
import { mapProductSummary, mapProductDirectoryEntry } from "./product-summary.ts";

export function productSummaryFilter(options?: { category?: string; subcategory?: string }) {
  const params: string[] = [];
  let where = "";
  if (options?.category) {
    params.push(options.category);
    const categoryParam = `$${params.length}`;
    let primaryMatch = `p.category = ${categoryParam}`;
    let additionalMatch = `pca.category_name = ${categoryParam}`;

    if (options?.subcategory) {
      params.push(options.subcategory);
      const subcategoryParam = `$${params.length}`;
      primaryMatch += ` AND p.subcategory = ${subcategoryParam}`;
      additionalMatch += ` AND pca.subcategory_name = ${subcategoryParam}`;
    }

    where = ` WHERE ((${primaryMatch}) OR EXISTS (
      SELECT 1
      FROM product_category_assignments pca
      WHERE pca.product_id = p.id AND ${additionalMatch}
    ))`;
  }
  return { where, params };
}

/** Preserve the newest 1,000 catalogue entries, with full card fields only for
 * the requested page. Both directory metadata and cards share one SQL snapshot.
 */
export async function readCategoryProductPage(sql: DatabaseReader, options: { category: string; subcategory?: string; page: number }) {
  const { where, params } = productSummaryFilter(options);
  const page = Math.max(1, Math.min(84, Math.floor(options.page) || 1));
  const offset = (page - 1) * 12;
  const start = "$" + (params.length + 1);
  const end = "$" + (params.length + 2);
  const rows = await sql.query(`
    WITH candidates AS MATERIALIZED (
      SELECT p.id, p.slug, p.name, p.image_url, p.brand, p.model_number, p.updated_at
      FROM products p ${where}
      ORDER BY p.updated_at DESC, p.id ASC LIMIT 1000
    ), numbered AS (
      SELECT candidates.*, row_number() OVER (ORDER BY updated_at DESC, id ASC) AS position
      FROM candidates
    )
    SELECT
      COALESCE(json_agg(json_build_array(n.slug, n.name, n.image_url, n.brand, n.model_number)
        ORDER BY n.position), '[]'::json) AS directory_rows,
      COALESCE(json_agg(json_build_object(
        'id', n.id, 'slug', n.slug, 'name', n.name, 'image_url', n.image_url,
        'brand', n.brand, 'model_number', n.model_number, 'updated_at', n.updated_at,
        'short_description', p.short_description, 'category', p.category,
        'subcategory', p.subcategory, 'part_number', p.part_number, 'image_alt', p.image_alt
      ) ORDER BY n.position) FILTER (WHERE n.position > ${start}::integer AND n.position <= ${end}::integer), '[]'::json) AS card_rows
    FROM numbered n
    LEFT JOIN products p ON p.id = n.id AND n.position > ${start}::integer AND n.position <= ${end}::integer
  `, [...params, offset, offset + 12]);
  const packed = rows[0];
  const directory = (packed?.directory_rows ?? []) as unknown[][];
  const cards = (packed?.card_rows ?? []) as Record<string, unknown>[];
  return {
    directoryProducts: directory.map(([slug, name, image_url, brand, model_number]) =>
      mapProductDirectoryEntry({ slug, name, image_url, brand, model_number })),
    visibleProducts: cards.map(row => mapProductSummary({
      ...row,
      // JSON timestamps bypass the adapter's Date normalization.
      updated_at: typeof row.updated_at === "string" ? new Date(row.updated_at).toISOString() : row.updated_at,
    })),
  };
}

