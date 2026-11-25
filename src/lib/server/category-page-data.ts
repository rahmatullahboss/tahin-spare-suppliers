import { withDatabaseReader } from "./db";
import { CATEGORY_DISPLAY_ROWS_SQL, rememberCategoryRows, readSubcategories, resolveSubcategory, listAllCategories } from "./categories";
import { readCategoryProductPage } from "./repository";
import { mapBrandLogoRows } from "./brands";
import { shouldShowCategoryBrandDirectory } from "../category-brand-directory";
import type { RuntimeEnv } from "./env";
import { readPageOverrides, type PageOverrides } from "./page-overrides";
import { readLayoutSnapshot } from "./layout-snapshot";
import type { DatabaseReader } from "./pg-adapter";

async function preloadOverrides(sql: DatabaseReader, pagePath: string | undefined) {
  if (!pagePath) return undefined;
  try { return await readPageOverrides(sql, pagePath); }
  catch { return undefined; } // MainLayout retains its original fallback.
}

// The layout snapshot already contains the entire public category directory.
async function readCategoryLayout(env: RuntimeEnv, sql: DatabaseReader, scope: object, pagePath?: string) {
  if (pagePath) {
    try {
      const pageOverrides = await readLayoutSnapshot(sql, scope, pagePath);
      return { categories: await listAllCategories(env, scope), pageOverrides };
    } catch {
      // Preserve independent category and override failure handling.
    }
  }
  return {
    categories: await rememberCategoryRows(scope, await sql.query(CATEGORY_DISPLAY_ROWS_SQL)),
    pageOverrides: undefined as PageOverrides | undefined,
  };
}

// All reads use the existing projection and mapping authorities. The connection
// is closed before Astro renders; the category memo remains request-local.
export async function getCategoryPageData(env: RuntimeEnv, scope: object, slug: string, page: number, pagePath?: string) {
  return withDatabaseReader(env, async sql => {
    const { categories, pageOverrides: preloadedOverrides } = await readCategoryLayout(env, sql, scope, pagePath);
    const currentCategory = categories.find(category => category.slug === slug);
    if (!currentCategory) return null;
    const showBrandModelDirectory = shouldShowCategoryBrandDirectory(currentCategory);
    const subcategories = currentCategory.id ? await readSubcategories(sql, currentCategory.id) : [];
    const { directoryProducts: categoryProducts, visibleProducts } = await readCategoryProductPage(sql, { category: currentCategory.canonicalValue, page });
    const managedBrands = showBrandModelDirectory
      ? mapBrandLogoRows(await sql.query("SELECT name, slug, logo_url FROM brands ORDER BY name"))
      : [];
    const pageOverrides = preloadedOverrides ?? await preloadOverrides(sql, pagePath);
    return { currentCategory, showBrandModelDirectory, subcategories, categoryProducts, visibleProducts, managedBrands, pageOverrides };
  });
}

export async function getSubcategoryPageData(env: RuntimeEnv, scope: object, parentSlug: string, subcategorySlug: string, page: number, pagePath?: string) {
  return withDatabaseReader(env, async sql => {
    const { categories, pageOverrides: preloadedOverrides } = await readCategoryLayout(env, sql, scope, pagePath);
    const parent = categories.find(category => category.slug === parentSlug);
    if (!parent?.id) return null;
    const result = resolveSubcategory(parent, await readSubcategories(sql, parent.id), subcategorySlug);
    if (!result) return null;
    const { directoryProducts: filteredProducts, visibleProducts } = await readCategoryProductPage(sql, {
      category: parent.canonicalValue,
      subcategory: result.subcategory.value,
      page,
    });
    const pageOverrides = preloadedOverrides ?? await preloadOverrides(sql, pagePath);
    return { ...result, filteredProducts, visibleProducts, pageOverrides };
  });
}
