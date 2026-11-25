import { withDatabaseReader } from "./db";
import { CATEGORY_DISPLAY_ROWS_SQL, rememberCategoryRows, readSubcategories, resolveSubcategory } from "./categories";
import { readCategoryProductPage } from "./repository";
import { mapBrandLogoRows } from "./brands";
import { shouldShowCategoryBrandDirectory } from "../category-brand-directory";
import type { RuntimeEnv } from "./env";

// All reads use the existing projection and mapping authorities. The connection
// is closed before Astro renders; the category memo remains request-local.
export async function getCategoryPageData(env: RuntimeEnv, scope: object, slug: string, page: number) {
  return withDatabaseReader(env, async sql => {
    const categories = await rememberCategoryRows(scope, await sql.query(CATEGORY_DISPLAY_ROWS_SQL));
    const currentCategory = categories.find(category => category.slug === slug);
    if (!currentCategory) return null;
    const showBrandModelDirectory = shouldShowCategoryBrandDirectory(currentCategory);
    const subcategories = currentCategory.id ? await readSubcategories(sql, currentCategory.id) : [];
    const { directoryProducts: categoryProducts, visibleProducts } = await readCategoryProductPage(sql, { category: currentCategory.canonicalValue, page });
    const managedBrands = showBrandModelDirectory
      ? mapBrandLogoRows(await sql.query("SELECT name, slug, logo_url FROM brands ORDER BY name"))
      : [];
    return { currentCategory, showBrandModelDirectory, subcategories, categoryProducts, visibleProducts, managedBrands };
  });
}

export async function getSubcategoryPageData(env: RuntimeEnv, scope: object, parentSlug: string, subcategorySlug: string, page: number) {
  return withDatabaseReader(env, async sql => {
    const categories = await rememberCategoryRows(scope, await sql.query(CATEGORY_DISPLAY_ROWS_SQL));
    const parent = categories.find(category => category.slug === parentSlug);
    if (!parent?.id) return null;
    const result = resolveSubcategory(parent, await readSubcategories(sql, parent.id), subcategorySlug);
    if (!result) return null;
    const { directoryProducts: filteredProducts, visibleProducts } = await readCategoryProductPage(sql, {
      category: parent.canonicalValue,
      subcategory: result.subcategory.value,
      page,
    });
    return { ...result, filteredProducts, visibleProducts };
  });
}
