import { ensureSchema, getDb } from "./db";
import { slugify } from "./slug";
import type { RuntimeEnv } from "./env";

const CONTENT_TABLES = {
  products: {
    table: "products",
    titleColumn: "name",
    excerptColumn: "short_description"
  },
  parts: {
    table: "parts",
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
  createdAt: string;
  updatedAt: string;
};

export type ContentInput = {
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  slug?: string;
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function listContent(env: RuntimeEnv, type: ContentType) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const rows = await sql.query(`SELECT * FROM ${table} ORDER BY updated_at DESC`);
  return rows.map((row) => mapRecord(type, row));
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

  const rows = await sql.query(
    `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [id, slug, input.title, excerpt, content, imageUrl]
  );

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

  const rows = await sql.query(
    `UPDATE ${config.table}
     SET slug = $1,
         ${config.titleColumn} = $2,
         ${config.excerptColumn} = $3,
         content = $4,
         image_url = $5,
         updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [slug, input.title, excerpt, content, imageUrl, id]
  );

  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function deleteContent(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
