import { CATEGORY_DISPLAY_ROWS_SQL, hasCategoryMemo, rememberCategoryRows } from "./categories";
import { getPageOverrides, normalizePageKey, parseOverrides, type PageOverrides } from "./page-overrides";
import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";

/** Share the footer catalogue and CMS override read when the route has not
 * already loaded its categories. No shared cross-request content cache.
 */
export async function getLayoutOverrides(env: RuntimeEnv, scope: object, rawPageKey: string): Promise<PageOverrides> {
  if (hasCategoryMemo(scope)) return getPageOverrides(env, rawPageKey);
  try {
    const pageKey = normalizePageKey(rawPageKey);
    await ensureSchema(env);
    const rows = await getDb(env).query(`
      SELECT c.*, NULL::jsonb AS overrides_json FROM (${CATEGORY_DISPLAY_ROWS_SQL}) c
      UNION ALL
      SELECT 'override', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, overrides_json
      FROM page_overrides WHERE page_key = $1
      ORDER BY row_kind, name
    `, [pageKey]);
    await rememberCategoryRows(scope, rows.filter(row => row.row_kind !== "override"));
    return parseOverrides(rows.find(row => row.row_kind === "override")?.overrides_json);
  } catch {
    // Preserve original override failure semantics and let Footer load
    // categories independently if the combined read failed.
    return getPageOverrides(env, rawPageKey);
  }
}
