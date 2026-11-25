import type { DatabaseReader } from "./pg-adapter.ts";
import { CATEGORY_DISPLAY_ROWS_SQL } from "./category-display-sql.ts";

type Row = Record<string, unknown>;

/** Keep one database snapshot without emitting sparse fourteen-column rows. */
export async function readHomepageSnapshotRows(sql: DatabaseReader) {
  const [snapshot] = await sql.query(`
    SELECT
      (SELECT COALESCE(json_agg(c ORDER BY c.row_kind, c.name), '[]'::json)
       FROM (${CATEGORY_DISPLAY_ROWS_SQL}) c) AS categories,
      (SELECT COALESCE(json_agg(b ORDER BY b.name), '[]'::json)
       FROM (SELECT name, slug, logo_url FROM brands) b) AS brands,
      (SELECT COALESCE(json_agg(s), '[]'::json)
       FROM (SELECT section_key, content_json::jsonb AS content_json FROM page_sections WHERE page_key = $1) s) AS sections
  `, ["home"]);
  const categories = (snapshot?.categories ?? []) as Row[];
  for (const category of categories) {
    if (typeof category.created_at === "string") category.created_at = new Date(category.created_at).toISOString();
  }
  return { categories, brands: (snapshot?.brands ?? []) as Row[], sections: (snapshot?.sections ?? []) as Row[] };
}
