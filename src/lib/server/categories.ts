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

type CategoryPresentationInput = {
  label?: string;
  imageUrl?: string;
  imageKey?: string;
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
  const baseCategories = mergeCategories(await listCustomCategories(env));
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT category_slug, label, image_url, image_key, sort_order FROM category_presentations`
  );
  const presentations = new Map(rows.map((row) => [String(row.category_slug), row] as const));

  return baseCategories
    .map((category, baseIndex) => {
      const presentation = presentations.get(category.slug);
      const savedSort = presentation?.sort_order;
      const sortOrder = savedSort == null || savedSort === "" ? baseIndex : Number(savedSort);
      const label = String(presentation?.label ?? "").trim();
      const imageUrl = String(presentation?.image_url ?? "").trim();
      const imageKey = String(presentation?.image_key ?? "").trim();
      return {
        ...category,
        value: label || category.value,
        imageUrl: imageUrl || category.imageUrl,
        imageKey: imageUrl ? imageKey : category.imageKey,
        presentationImageKey: imageUrl ? imageKey : "",
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : baseIndex,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value));
}

export async function saveCategoryPresentation(
  env: RuntimeEnv,
  slug: string,
  input: CategoryPresentationInput
): Promise<DisplayCategory> {
  const normalizedSlug = slug.trim();
  const baseCategories = mergeCategories(await listCustomCategories(env));
  const baseCategory = baseCategories.find((category) => category.slug === normalizedSlug);
  if (!baseCategory) throw new Error("Category not found");

  const label = input.label?.replace(/[\u0000-\u001F]/g, "").trim().slice(0, 160) ?? "";
  const imageUrl = input.imageUrl?.trim().slice(0, 2000) ?? "";
  const imageKey = input.imageKey?.trim().slice(0, 500) ?? "";

  await ensureSchema(env);
  const sql = getDb(env);
  await sql.query(
    `INSERT INTO category_presentations (category_slug, label, image_url, image_key, sort_order, updated_at)
     VALUES ($1, $2, $3, $4, NULL, NOW())
     ON CONFLICT (category_slug)
     DO UPDATE SET label = EXCLUDED.label, image_url = EXCLUDED.image_url, image_key = EXCLUDED.image_key, updated_at = NOW()`,
    [normalizedSlug, label, imageUrl, imageKey]
  );

  const categories = await listAllCategories(env);
  const saved = categories.find((category) => category.slug === normalizedSlug);
  if (!saved) throw new Error("Category presentation could not be loaded");
  return saved;
}

export async function reorderCategories(env: RuntimeEnv, orderedSlugs: string[]): Promise<DisplayCategory[]> {
  const categories = await listAllCategories(env);
  const knownSlugs = new Set(categories.map((category) => category.slug));
  const normalized = orderedSlugs.map((slug) => String(slug).trim()).filter(Boolean);
  if (normalized.length !== categories.length || new Set(normalized).size !== categories.length) {
    throw new Error("Category order must include every top-level category exactly once");
  }
  if (normalized.some((slug) => !knownSlugs.has(slug))) throw new Error("Category order contains an unknown category");

  await ensureSchema(env);
  const sql = getDb(env);
  await sql.transaction(
    normalized.map((slug, index) => sql`
      INSERT INTO category_presentations (category_slug, label, image_url, image_key, sort_order, updated_at)
      VALUES (${slug}, '', '', '', ${index}, NOW())
      ON CONFLICT (category_slug)
      DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
    `)
  );
  return listAllCategories(env);
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
      canonicalValue: subcategory.name,
      slug: subcategory.slug,
      imageUrl: subcategory.imageUrl || parent.imageUrl,
      imageKey: subcategory.imageKey,
      parentId: subcategory.parentId,
      createdAt: subcategory.createdAt,
      sortOrder: 0,
      isDefault: false,
    },
  };
}

export async function deleteCustomCategory(env: RuntimeEnv, id: string): Promise<CustomCategory | null> {
  await ensureSchema(env);
  const sql = getDb(env);
  const existingRows = await sql.query(
    `SELECT id, name, slug, image_url, image_key, parent_id, created_at FROM categories WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!existingRows[0]) return null;
  const existing = mapCustomCategory(existingRows[0]);

  await sql.transaction([
    sql`DELETE FROM categories WHERE parent_id = ${id}`,
    sql`DELETE FROM category_presentations WHERE category_slug = ${existing.slug}`,
    sql`DELETE FROM categories WHERE id = ${id}`,
  ]);
  return existing;
}
