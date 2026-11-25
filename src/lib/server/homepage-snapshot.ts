import { rememberCategoryRows } from "./categories";
import { mapBrandLogoRows } from "./brands";
import { mapHomepageContentRows } from "./page-content";
import { withDatabaseReader } from "./db";
import type { RuntimeEnv } from "./env";
import { readHomepageSnapshotRows } from "./homepage-snapshot-rows";

// A single SQL statement avoids three separate PostgreSQL connections and
// retains the original category, brand and CMS mapping authorities.
export async function getHomepageSnapshot(env: RuntimeEnv, scope: object) {
  const rows = await withDatabaseReader(env, readHomepageSnapshotRows);
  const categories = await rememberCategoryRows(scope, rows.categories);
  const homeContent = mapHomepageContentRows(rows.sections);
  const managedBrands = mapBrandLogoRows(rows.brands);
  return { categories, homeContent, managedBrands };
}
