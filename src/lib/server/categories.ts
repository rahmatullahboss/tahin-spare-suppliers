import { isReservedCategorySlug, mergeCategories, type CustomCategory, type DisplayCategory } from "../categories";
import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";
import { slugify } from "./slug";

type CategoryInput = {
  name: string;
  imageUrl?: string;
  imageKey?: string;
  parentId?: string;
};

function mapCustomCategory(row: Record<string, unknown>): CustomCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    imageUrl: String(row.image_url ?? ""),
    imageKey: String(row.image_key ?? ""),
    parentId: String(row.parent_id ?? ""),
    createdAt: String(row.created_at)
  };
}

function normalizeCategoryInput(input: CategoryInput) {
  const name = input.name.trim();
  const slug = slugify(name);

  if (!name) {
    throw new Error("Name is required");
  }

  if (!slug) {
    throw new Error("Name must contain at least one letter or number");
  }

  if (isReservedCategorySlug(slug)) {
    throw new Error("Default category names are reserved");
  }

  return {
    name,
    slug,
    imageUrl: input.imageUrl?.trim() ?? "",
    imageKey: input.imageKey?.trim() ?? "",
    parentId: input.parentId?.trim() ?? ""
  };
}

export async function listCustomCategories(env: RuntimeEnv): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(`SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id IS NULL ORDER BY name`);
  return rows.map((row) => mapCustomCategory(row));
}

export async function listAllCategories(env: RuntimeEnv): Promise<DisplayCategory[]> {
  return mergeCategories(await listCustomCategories(env));
}

export async function findCategoryBySlug(env: RuntimeEnv, slug: string): Promise<DisplayCategory | null> {
  const categories = await listAllCategories(env);
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function listSubcategories(env: RuntimeEnv, parentId: string): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id = $1 ORDER BY name`,
    [parentId]
  );
  return rows.map((row) => mapCustomCategory(row));
}

export async function listAllSubcategories(env: RuntimeEnv): Promise<CustomCategory[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE parent_id IS NOT NULL ORDER BY name`
  );
  return rows.map((row) => mapCustomCategory(row));
}

export async function createCustomCategory(env: RuntimeEnv, input: CategoryInput): Promise<CustomCategory> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { name, slug, imageUrl, imageKey, parentId } = normalizeCategoryInput(input);

  if (parentId) {
    const parentRows = await sql.query(
      `SELECT id, parent_id FROM categories WHERE id = $1`,
      [parentId]
    );
    if (parentRows.length === 0) throw new Error("Parent category not found");
    if (parentRows[0].parent_id) throw new Error("Cannot create subcategory under a subcategory");
  }

  const id = crypto.randomUUID();
  const rows = await sql.query(
    `INSERT INTO categories (id, name, slug, image_url, image_key, parent_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [id, name, slug, imageUrl, imageKey, parentId || null]
  );
  return mapCustomCategory(rows[0]);
}

export async function updateCustomCategory(env: RuntimeEnv, id: string, input: CategoryInput): Promise<CustomCategory | null> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { name, slug, imageUrl, imageKey, parentId } = normalizeCategoryInput(input);

  if (parentId) {
    if (parentId === id) throw new Error("Category cannot be its own parent");
    const parentRows = await sql.query(
      `SELECT id, parent_id FROM categories WHERE id = $1`,
      [parentId]
    );
    if (parentRows.length === 0) throw new Error("Parent category not found");
    if (parentRows[0].parent_id) throw new Error("Cannot create subcategory under a subcategory");
  }

  const rows = await sql.query(
    `UPDATE categories SET name = $1, slug = $2, image_url = $3, image_key = $4, parent_id = $5 WHERE id = $6 RETURNING *`,
    [name, slug, imageUrl, imageKey, parentId || null, id]
  );
  return rows[0] ? mapCustomCategory(rows[0]) : null;
}

export async function findSubcategoryBySlug(
  env: RuntimeEnv,
  parentSlug: string,
  subcategorySlug: string
): Promise<{ parent: DisplayCategory; subcategory: DisplayCategory } | null> {
  const parent = await findCategoryBySlug(env, parentSlug);
  if (!parent || !parent.id) return null;

  const subcategories = await listSubcategories(env, parent.id);
  const subcategory = subcategories.find((s) => s.slug === subcategorySlug);
  if (!subcategory) return null;

  return {
    parent,
    subcategory: {
      id: subcategory.id,
      value: subcategory.name,
      slug: subcategory.slug,
      imageUrl: subcategory.imageUrl || parent.imageUrl,
      imageKey: subcategory.imageKey,
      parentId: subcategory.parentId,
      createdAt: subcategory.createdAt,
      isDefault: false,
    },
  };
}

export async function deleteCustomCategory(env: RuntimeEnv, id: string): Promise<boolean> {
  await ensureSchema(env);
  const sql = getDb(env);
  await sql.query(`DELETE FROM categories WHERE parent_id = $1`, [id]);
  const rows = await sql.query(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}
