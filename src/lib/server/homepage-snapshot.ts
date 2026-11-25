import { CATEGORY_DISPLAY_ROWS_SQL, rememberCategoryRows } from "./categories";
import { mapBrandLogoRows } from "./brands";
import { mapHomepageContentRows } from "./page-content";
import { withDatabaseReader } from "./db";
import type { RuntimeEnv } from "./env";

// A single SQL statement avoids three separate PostgreSQL connections and
// retains the original category, brand and CMS mapping authorities.
export async function getHomepageSnapshot(env: RuntimeEnv, scope: object) {
  const rows = await withDatabaseReader(env, sql => sql.query(`
    SELECT c.*, NULL::text AS section_key, NULL::jsonb AS content_json, NULL::text AS logo_url
    FROM (${CATEGORY_DISPLAY_ROWS_SQL}) c
    UNION ALL
    SELECT 'brand', NULL, name, slug, NULL, NULL, NULL, NULL,
           NULL, NULL, NULL, NULL, NULL, logo_url
    FROM brands
    UNION ALL
    SELECT 'section', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           NULL, NULL, NULL, section_key, content_json::jsonb, NULL
    FROM page_sections WHERE page_key = $1
    ORDER BY row_kind, name
  `, ["home"]));
  const categories = await rememberCategoryRows(scope, rows.filter(row => row.row_kind === "category" || row.row_kind === "presentation"));
  const homeContent = mapHomepageContentRows(rows.filter(row => row.row_kind === "section"));
  const managedBrands = mapBrandLogoRows(rows.filter(row => row.row_kind === "brand"));
  return { categories, homeContent, managedBrands };
}
