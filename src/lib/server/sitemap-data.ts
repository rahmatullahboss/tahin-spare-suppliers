import { mergeCategories, type CustomCategory, type DisplayCategory } from "../categories";
import { canonicalizeBrand } from "../inventory-quality";
import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";

export type SitemapContentRecord = {
  slug: string;
  updatedAt: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  categoryAssignments?: { category: string; subcategory?: string }[];
};

export type SitemapSnapshot = {
  products: SitemapContentRecord[];
  parts: SitemapContentRecord[];
  blogPosts: SitemapContentRecord[];
  categories: DisplayCategory[];
  subcategories: CustomCategory[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function parseCategoryAssignments(value: unknown): { category: string; subcategory?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const category = asString(record.category).trim();
    if (!category) return [];
    const subcategory = asString(record.subcategory).trim();
    return [{ category, ...(subcategory ? { subcategory } : {}) }];
  });
}

function mapContentRow(row: Record<string, unknown>, includeProductFields = false): SitemapContentRecord {
  const record: SitemapContentRecord = {
    slug: asString(row.slug),
    updatedAt: asString(row.updated_at),
  };

  if (includeProductFields) {
    record.brand = canonicalizeBrand(row.brand);
    record.category = asString(row.category);
    record.subcategory = asString(row.subcategory);
    record.categoryAssignments = parseCategoryAssignments(row.category_assignments);
  }

  return record;
}

function mapCustomCategory(row: Record<string, unknown>): CustomCategory {
  return {
    id: asString(row.id),
    name: asString(row.name),
    slug: asString(row.slug),
    imageUrl: asString(row.image_url),
    imageKey: asString(row.image_key),
    parentId: asString(row.parent_id),
    createdAt: asString(row.created_at),
  };
}

export async function getSitemapSnapshot(env: RuntimeEnv): Promise<SitemapSnapshot> {
  await ensureSchema(env);
  const sql = getDb(env);
  const [productRows, partRows, blogRows, categoryRows] = await sql.transaction([
    sql`SELECT p.slug, p.updated_at, p.brand, p.category, p.subcategory, COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', pca.category_name, 'subcategory', pca.subcategory_name) ORDER BY pca.category_name)
      FROM product_category_assignments pca
      WHERE pca.product_id = p.id
    ), '[]'::jsonb) AS category_assignments
    FROM products p ORDER BY p.updated_at DESC`,
    sql`SELECT slug, updated_at FROM parts ORDER BY updated_at DESC`,
    sql`SELECT slug, updated_at FROM blog_posts ORDER BY updated_at DESC`,
    sql`SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories ORDER BY name`,
  ]);

  const customCategories = categoryRows.map((row) => mapCustomCategory(row));
  const parentCategories = customCategories.filter((category) => !category.parentId);
  const subcategories = customCategories.filter((category) => Boolean(category.parentId));

  return {
    products: productRows.map((row) => mapContentRow(row, true)),
    parts: partRows.map((row) => mapContentRow(row)),
    blogPosts: blogRows.map((row) => mapContentRow(row)),
    categories: mergeCategories(parentCategories),
    subcategories,
  };
}
