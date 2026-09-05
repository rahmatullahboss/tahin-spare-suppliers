import { ensureSchema, getDb } from "./db";
import { slugify } from "./slug";
import type { RuntimeEnv } from "./env";
import { normalizeContentLimit } from "./content-limit";
import { parseRelatedProductSlugs, resolveProductSeo, stringifyRelatedProductSlugs } from "../seo";
import { canonicalizeBrand, cleanProductTitle, normalizeVerificationDate } from "../inventory-quality";
import { ensureBrandExists } from "./brands";

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
  imageKey: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  model_number?: string;
  partNumber?: string;
  condition?: string;
  availability?: string;
  availabilityVerifiedAt?: string;
  conditionVerifiedAt?: string;
  location?: string;
  technicalSpecifications?: string;
  application?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  imageAlt?: string;
  relatedProducts?: string[];
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
  partNumber?: string;
  condition?: string;
  availability?: string;
  availabilityVerifiedAt?: string;
  conditionVerifiedAt?: string;
  location?: string;
  technicalSpecifications?: string;
  application?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  imageAlt?: string;
  relatedProducts?: string[];
};

type NormalizedProductFields = {
  category: string;
  subcategory: string;
  brand: string;
  modelNumber: string;
  partNumber: string;
  condition: string;
  availability: string;
  availabilityVerifiedAt: string | null;
  conditionVerifiedAt: string | null;
  location: string;
  technicalSpecifications: string;
  application: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  imageAlt: string;
  relatedProducts: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeProductFields(input: ContentInput): NormalizedProductFields {
  const category = input.category?.trim() || "Uncategorized";
  const subcategory = input.subcategory?.trim() ?? "";
  const brand = canonicalizeBrand(input.brand);
  const modelNumber = input.model_number?.trim() ?? "";
  const partNumber = input.partNumber?.trim() ?? "";
  const condition = input.condition?.trim() ?? "";
  const availability = input.availability?.trim() ?? "";
  const availabilityVerifiedAt = normalizeVerificationDate(input.availabilityVerifiedAt) || null;
  const conditionVerifiedAt = normalizeVerificationDate(input.conditionVerifiedAt) || null;
  const location = input.location?.trim() ?? "";
  const technicalSpecifications = input.technicalSpecifications?.trim() ?? "";
  const application = input.application?.trim() ?? "";
  const seo = resolveProductSeo({
    title: input.title,
    brand,
    modelNumber,
    partNumber,
    location: location || "Bangladesh",
    seoTitle: input.seoTitle,
    metaDescription: input.metaDescription,
    focusKeyword: input.focusKeyword,
    imageAlt: input.imageAlt
  });

  return {
    category,
    subcategory,
    brand,
    modelNumber,
    partNumber,
    condition,
    availability,
    availabilityVerifiedAt,
    conditionVerifiedAt,
    location,
    technicalSpecifications,
    application,
    seoTitle: seo.seoTitle,
    metaDescription: seo.metaDescription,
    focusKeyword: seo.focusKeyword,
    imageAlt: seo.imageAlt,
    relatedProducts: stringifyRelatedProductSlugs(input.relatedProducts)
  };
}

function mapRecord(type: ContentType, row: Record<string, unknown>): ContentRecord {
  const config = CONTENT_TABLES[type];
  const rawTitle = asString(row[config.titleColumn]);
  const title = type === "products" ? cleanProductTitle(rawTitle) : rawTitle;
  const commonRecord: ContentRecord = {
    id: asString(row.id),
    slug: asString(row.slug),
    title,
    excerpt: asString(row[config.excerptColumn]),
    content: asString(row.content),
    imageUrl: asString(row.image_url),
    imageKey: asString(row.image_key),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };

  if (type !== "products") return commonRecord;

  const brand = canonicalizeBrand(row.brand);
  const modelNumber = asString(row.model_number);
  const partNumber = asString(row.part_number);
  const location = asString(row.location);
  const seo = resolveProductSeo({
    title,
    brand,
    modelNumber,
    partNumber,
    location: location || "Bangladesh",
    seoTitle: asString(row.seo_title),
    metaDescription: asString(row.meta_description),
    focusKeyword: asString(row.focus_keyword),
    imageAlt: asString(row.image_alt)
  });

  return {
    ...commonRecord,
    category: asString(row.category) || "Uncategorized",
    subcategory: asString(row.subcategory),
    brand,
    model_number: modelNumber,
    partNumber,
    condition: asString(row.condition),
    availability: asString(row.availability),
    availabilityVerifiedAt: normalizeVerificationDate(row.availability_verified_at),
    conditionVerifiedAt: normalizeVerificationDate(row.condition_verified_at),
    location,
    technicalSpecifications: asString(row.technical_specifications),
    application: asString(row.application),
    seoTitle: seo.seoTitle,
    metaDescription: seo.metaDescription,
    focusKeyword: seo.focusKeyword,
    imageAlt: seo.imageAlt,
    relatedProducts: parseRelatedProductSlugs(row.related_products)
  };
}

export async function listContent(
  env: RuntimeEnv,
  type: ContentType,
  options?: { page?: number; limit?: number; search?: string }
) {
  await ensureSchema(env);
  const sql = getDb(env);
  const config = CONTENT_TABLES[type];
  const page = Math.max(1, options?.page ?? 1);
  const limit = normalizeContentLimit(options?.limit);
  const offset = (page - 1) * limit;

  let query = `SELECT * FROM ${config.table}`;
  const params: (string | number)[] = [];

  if (options?.search) {
    query += ` WHERE ${config.titleColumn} ILIKE $1 OR ${config.excerptColumn} ILIKE $1`;
    params.push(`%${options.search}%`);
  }

  query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await sql.query(query, params.length ? params : undefined);
  return rows.map((row) => mapRecord(type, row));
}

export async function listProductSummaries(
  env: RuntimeEnv,
  options?: { page?: number; limit?: number; category?: string }
): Promise<ContentRecord[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const page = Math.max(1, options?.page ?? 1);
  const limit = normalizeContentLimit(options?.limit);
  const offset = (page - 1) * limit;
  const params: string[] = [];
  let query = "SELECT id, slug, name, short_description, image_url, updated_at, category, subcategory, brand, model_number, part_number, image_alt FROM products";

  if (options?.category) {
    query += " WHERE category = $1";
    params.push(options.category);
  }

  query += ` ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
  const rows = await sql.query(query, params.length ? params : undefined);
  return rows.map((row) => mapRecord("products", row));
}

export async function listAllContent(env: RuntimeEnv, type: ContentType): Promise<ContentRecord[]> {
  const batchSize = 1000;
  const records: ContentRecord[] = [];
  let page = 1;

  while (true) {
    const batch = await listContent(env, type, { page, limit: batchSize });
    records.push(...batch);
    if (batch.length < batchSize) break;
    page += 1;
  }

  return records;
}

export async function countContent(env: RuntimeEnv, type: ContentType, search?: string): Promise<number> {
  await ensureSchema(env);
  const sql = getDb(env);
  const config = CONTENT_TABLES[type];

  let query = `SELECT COUNT(*) as total FROM ${config.table}`;
  const params: string[] = [];

  if (search) {
    query += ` WHERE ${config.titleColumn} ILIKE $1 OR ${config.excerptColumn} ILIKE $1`;
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
  const normalizedTitle = type === "products" ? cleanProductTitle(input.title) : input.title.trim();
  const slug = slugify(input.slug || normalizedTitle);
  const excerpt = input.excerpt ?? "";
  const content = input.content ?? "";
  const imageUrl = input.imageUrl ?? "";
  const imageKey = input.imageKey ?? "";

  if (type === "products") {
    const product = normalizeProductFields(input);
    const rows = await sql.query(
      `INSERT INTO ${config.table} (
        id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key,
        category, subcategory, brand, model_number, part_number, condition, availability,
        availability_verified_at, condition_verified_at, location, technical_specifications,
        application, seo_title, meta_description, focus_keyword, image_alt, related_products, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, NOW()
      ) RETURNING *`,
      [
        id, slug, normalizedTitle, excerpt, content, imageUrl, imageKey,
        product.category, product.subcategory, product.brand, product.modelNumber, product.partNumber,
        product.condition, product.availability, product.availabilityVerifiedAt, product.conditionVerifiedAt,
        product.location, product.technicalSpecifications, product.application, product.seoTitle,
        product.metaDescription, product.focusKeyword, product.imageAlt, product.relatedProducts
      ]
    );
    if (product.brand) await ensureBrandExists(env, product.brand);
    return mapRecord(type, rows[0]);
  }

  const rows = await sql.query(
    `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [id, slug, input.title, excerpt, content, imageUrl, imageKey]
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
  const normalizedTitle = type === "products" ? cleanProductTitle(input.title) : input.title.trim();
  const slug = slugify(input.slug || normalizedTitle);
  const excerpt = input.excerpt ?? "";
  const content = input.content ?? "";
  const imageUrl = input.imageUrl ?? "";
  const imageKey = input.imageKey ?? "";

  if (type === "products") {
    const product = normalizeProductFields(input);
    const rows = await sql.query(
      `UPDATE ${config.table}
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
           part_number = $11,
           condition = $12,
           availability = $13,
           availability_verified_at = $14,
           condition_verified_at = $15,
           location = $16,
           technical_specifications = $17,
           application = $18,
           seo_title = $19,
           meta_description = $20,
           focus_keyword = $21,
           image_alt = $22,
           related_products = $23,
           updated_at = NOW()
       WHERE id = $24
       RETURNING *`,
      [
        slug, normalizedTitle, excerpt, content, imageUrl, imageKey,
        product.category, product.subcategory, product.brand, product.modelNumber, product.partNumber,
        product.condition, product.availability, product.availabilityVerifiedAt, product.conditionVerifiedAt,
        product.location, product.technicalSpecifications, product.application, product.seoTitle,
        product.metaDescription, product.focusKeyword, product.imageAlt, product.relatedProducts, id
      ]
    );
    if (rows[0] && product.brand) await ensureBrandExists(env, product.brand);
    return rows[0] ? mapRecord(type, rows[0]) : null;
  }

  const rows = await sql.query(
    `UPDATE ${config.table}
     SET slug = $1,
         ${config.titleColumn} = $2,
         ${config.excerptColumn} = $3,
         content = $4,
         image_url = $5,
         image_key = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [slug, input.title, excerpt, content, imageUrl, imageKey, id]
  );

  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function deleteContent(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
