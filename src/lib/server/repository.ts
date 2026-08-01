import { ensureSchema, getDb } from "./db";
import { slugify } from "./slug";
import type { RuntimeEnv } from "./env";
import { normalizeContentLimit } from "./content-limit";

const CONTENT_TABLES = {
  products: {
    table: "products",
    titleColumn: "name",
    excerptColumn: "short_description"
  },
  blog: {
    table: "blog_posts",
    titleColumn: "title",
    excerptColumn: "excerpt"
  }
} as const;

export type ContentType = keyof typeof CONTENT_TABLES;

export type ContentRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  imageKey: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
};

export type ContentInput = {
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  slug?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
};

function mapRecord(type: ContentType, row: Record<string, unknown>): ContentRecord {
  const config = CONTENT_TABLES[type];

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row[config.titleColumn]),
    excerpt: String(row[config.excerptColumn] ?? ""),
    content: String(row.content ?? ""),
    imageUrl: String(row.image_url ?? ""),
    imageKey: String(row.image_key ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(type === 'products' ? {
      category: String(row.category ?? "Uncategorized"),
      subcategory: String(row.subcategory ?? ""),
      brand: String(row.brand ?? ""),
      model_number: String(row.model_number ?? "")
    } : {})
  };
}

export async function listContent(env: RuntimeEnv, type: ContentType, options?: { page?: number; limit?: number; search?: string }) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const page = Math.max(1, options?.page ?? 1);
  const limit = normalizeContentLimit(options?.limit);
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM ${table}`;
  const params: (string | number)[] = [];

  if (options?.search) {
    query += ` WHERE title ILIKE $1 OR excerpt ILIKE $1`;
    params.push(`%${options.search}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await sql.query(query, params.length ? params : undefined);
  return rows.map((row) => mapRecord(type, row));
}

export async function countContent(env: RuntimeEnv, type: ContentType, search?: string): Promise<number> {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];

  let query = `SELECT COUNT(*) as total FROM ${table}`;
  const params: string[] = [];

  if (search) {
    query += ` WHERE title ILIKE $1 OR excerpt ILIKE $1`;
    params.push(`%${search}%`);
  }

  const rows = await sql.query(query, params.length ? params : undefined);
  return Number(rows[0]?.total ?? 0);
}

export async function getContentBySlug(env: RuntimeEnv, type: ContentType, slug: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const rows = await sql.query(`SELECT * FROM ${table} WHERE slug = $1 LIMIT 1`, [slug]);
  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function getContentById(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const rows = await sql.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function createContent(env: RuntimeEnv, type: ContentType, input: ContentInput) {
  await ensureSchema(env);
  const sql = getDb(env);
  const config = CONTENT_TABLES[type];
  const id = crypto.randomUUID();
  const slug = slugify(input.slug || input.title);
  const excerpt = input.excerpt ?? "";
  const content = input.content ?? "";
  const imageUrl = input.imageUrl ?? "";
  const imageKey = input.imageKey ?? "";
  const category = input.category ?? "Uncategorized";
  const subcategory = input.subcategory ?? "";
  const brand = input.brand ?? "";
  const model_number = input.model_number ?? "";

  let query = `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`;
  let params: (string | number)[] = [id, slug, input.title, excerpt, content, imageUrl, imageKey];

  if (type === 'products') {
    query = `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, category, subcategory, brand, model_number, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`;
    params = [id, slug, input.title, excerpt, content, imageUrl, imageKey, category, subcategory, brand, model_number];
  }

  const rows = await sql.query(query, params);

  return mapRecord(type, rows[0]);
}

export async function updateContent(
  env: RuntimeEnv,
  type: ContentType,
  id: string,
  input: ContentInput
) {
  await ensureSchema(env);
  const sql = getDb(env);
  const config = CONTENT_TABLES[type];
  const slug = slugify(input.slug || input.title);
  const excerpt = input.excerpt ?? "";
  const content = input.content ?? "";
  const imageUrl = input.imageUrl ?? "";
  const imageKey = input.imageKey ?? "";
  const category = input.category ?? "Uncategorized";
  const subcategory = input.subcategory ?? "";
  const brand = input.brand ?? "";
  const model_number = input.model_number ?? "";

  let query = `UPDATE ${config.table}
     SET slug = $1,
         ${config.titleColumn} = $2,
         ${config.excerptColumn} = $3,
         content = $4,
         image_url = $5,
         image_key = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`;
  let params: (string | number)[] = [slug, input.title, excerpt, content, imageUrl, imageKey, id];

  if (type === 'products') {
    query = `UPDATE ${config.table}
       SET slug = $1,
           ${config.titleColumn} = $2,
           ${config.excerptColumn} = $3,
           content = $4,
           image_url = $5,
           image_key = $6,
           category = $7,
           subcategory = $8,
           brand = $9,
           model_number = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`;
    params = [slug, input.title, excerpt, content, imageUrl, imageKey, category, subcategory, brand, model_number, id];
  }

  const rows = await sql.query(query, params);

  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function deleteContent(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
