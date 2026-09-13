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

export type ContentImage = {
  url: string;
  key: string;
  alt: string;
};

export type ProductCategoryAssignment = {
  category: string;
  subcategory?: string;
};

export type ContentRecord = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  imageKey: string;
  galleryImages: ContentImage[];
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
  additionalCategories?: ProductCategoryAssignment[];
};

export type ContentInput = {
  title: string;
  excerpt?: string;
  content?: string;
  imageUrl?: string;
  imageKey?: string;
  galleryImages?: ContentImage[];
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
  additionalCategories?: ProductCategoryAssignment[];
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
  additionalCategories: ProductCategoryAssignment[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

const MAX_GALLERY_IMAGES = 12;

function sanitizeMediaUrl(value: unknown): string {
  const url = asString(value).trim();
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url.slice(0, 2000);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? url.slice(0, 2000) : "";
  } catch {
    return "";
  }
}

export function normalizeGalleryImages(value: unknown): ContentImage[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const images: ContentImage[] = [];
  for (const item of raw.slice(0, MAX_GALLERY_IMAGES)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const url = sanitizeMediaUrl(record.url);
    if (!url) continue;
    images.push({
      url,
      key: asString(record.key).trim().slice(0, 500),
      alt: asString(record.alt).replace(/[\u0000-\u001F]/g, "").trim().slice(0, 1000),
    });
  }
  return images;
}

function normalizeProductCategoryAssignments(
  value: unknown,
  primaryCategory: string
): ProductCategoryAssignment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const assignments: ProductCategoryAssignment[] = [];

  for (const item of value.slice(0, 12)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const category = asString(record.category).replace(/[\u0000-\u001F]/g, "").trim().slice(0, 160);
    if (!category || category.toLowerCase() === primaryCategory.toLowerCase()) continue;
    const key = category.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const subcategory = asString(record.subcategory).replace(/[\u0000-\u001F]/g, "").trim().slice(0, 160);
    assignments.push({ category, ...(subcategory ? { subcategory } : {}) });
  }

  return assignments;
}

function normalizeProductFields(input: ContentInput): NormalizedProductFields {
  const category = input.category?.trim() || "Uncategorized";
  const subcategory = input.subcategory?.trim() ?? "";
  const additionalCategories = normalizeProductCategoryAssignments(input.additionalCategories, category);
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
    relatedProducts: stringifyRelatedProductSlugs(input.relatedProducts),
    additionalCategories
  };
}

async function syncProductCategoryAssignments(
  sql: ReturnType<typeof getDb>,
  productId: string,
  assignments: ProductCategoryAssignment[]
) {
  const statements = [
    sql`DELETE FROM product_category_assignments WHERE product_id = ${productId}`,
    ...assignments.map((assignment) => sql`
      INSERT INTO product_category_assignments (product_id, category_name, subcategory_name)
      VALUES (${productId}, ${assignment.category}, ${assignment.subcategory ?? ""})
    `)
  ];
  await sql.transaction(statements);
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
    galleryImages: normalizeGalleryImages(row.gallery_images),
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
    additionalCategories: normalizeProductCategoryAssignments(
      row.additional_categories,
      asString(row.category) || "Uncategorized"
    ),
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

  const productSelect = `SELECT p.*, COALESCE((
    SELECT jsonb_agg(jsonb_build_object('category', pca.category_name, 'subcategory', pca.subcategory_name) ORDER BY pca.category_name)
    FROM product_category_assignments pca
    WHERE pca.product_id = p.id
  ), '[]'::jsonb) AS additional_categories FROM products p`;
  let query = type === "products" ? productSelect : `SELECT * FROM ${config.table}`;
  const params: (string | number)[] = [];
  const columnPrefix = type === "products" ? "p." : "";

  if (options?.search) {
    query += ` WHERE ${columnPrefix}${config.titleColumn} ILIKE $1 OR ${columnPrefix}${config.excerptColumn} ILIKE $1`;
    params.push(`%${options.search}%`);
  }

  query += ` ORDER BY ${columnPrefix}updated_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const rows = await sql.query(query, params.length ? params : undefined);
  return rows.map((row) => mapRecord(type, row));
}

export async function listProductSummaries(
  env: RuntimeEnv,
  options?: { page?: number; limit?: number; category?: string; subcategory?: string }
): Promise<ContentRecord[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const page = Math.max(1, options?.page ?? 1);
  const limit = normalizeContentLimit(options?.limit);
  const offset = (page - 1) * limit;
  const params: string[] = [];
  let query = "SELECT p.id, p.slug, p.name, p.short_description, p.image_url, p.updated_at, p.category, p.subcategory, p.brand, p.model_number, p.part_number, p.image_alt FROM products p";

  if (options?.category) {
    params.push(options.category);
    const categoryParam = `$${params.length}`;
    let primaryMatch = `p.category = ${categoryParam}`;
    let additionalMatch = `pca.category_name = ${categoryParam}`;

    if (options?.subcategory) {
      params.push(options.subcategory);
      const subcategoryParam = `$${params.length}`;
      primaryMatch += ` AND p.subcategory = ${subcategoryParam}`;
      additionalMatch += ` AND pca.subcategory_name = ${subcategoryParam}`;
    }

    query += ` WHERE ((${primaryMatch}) OR EXISTS (
      SELECT 1
      FROM product_category_assignments pca
      WHERE pca.product_id = p.id AND ${additionalMatch}
    ))`;
  }

  query += ` ORDER BY p.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
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
  const query = type === "products"
    ? `SELECT p.*, COALESCE((
        SELECT jsonb_agg(jsonb_build_object('category', pca.category_name, 'subcategory', pca.subcategory_name) ORDER BY pca.category_name)
        FROM product_category_assignments pca WHERE pca.product_id = p.id
      ), '[]'::jsonb) AS additional_categories FROM products p WHERE p.slug = $1 LIMIT 1`
    : `SELECT * FROM ${table} WHERE slug = $1 LIMIT 1`;
  const rows = await sql.query(query, [slug]);
  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function getContentById(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  const query = type === "products"
    ? `SELECT p.*, COALESCE((
        SELECT jsonb_agg(jsonb_build_object('category', pca.category_name, 'subcategory', pca.subcategory_name) ORDER BY pca.category_name)
        FROM product_category_assignments pca WHERE pca.product_id = p.id
      ), '[]'::jsonb) AS additional_categories FROM products p WHERE p.id = $1 LIMIT 1`
    : `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`;
  const rows = await sql.query(query, [id]);
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
  const galleryImages = normalizeGalleryImages(input.galleryImages);
  const galleryJson = JSON.stringify(galleryImages);

  if (type === "products") {
    const product = normalizeProductFields(input);
    const rows = await sql.query(
      `INSERT INTO ${config.table} (
        id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, gallery_images,
        category, subcategory, brand, model_number, part_number, condition, availability,
        availability_verified_at, condition_verified_at, location, technical_specifications,
        application, seo_title, meta_description, focus_keyword, image_alt, related_products, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
        $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, NOW()
      ) RETURNING *`,
      [
        id, slug, normalizedTitle, excerpt, content, imageUrl, imageKey, galleryJson,
        product.category, product.subcategory, product.brand, product.modelNumber, product.partNumber,
        product.condition, product.availability, product.availabilityVerifiedAt, product.conditionVerifiedAt,
        product.location, product.technicalSpecifications, product.application, product.seoTitle,
        product.metaDescription, product.focusKeyword, product.imageAlt, product.relatedProducts
      ]
    );
    await syncProductCategoryAssignments(sql, id, product.additionalCategories);
    if (product.brand) await ensureBrandExists(env, product.brand);
    return mapRecord(type, { ...rows[0], additional_categories: product.additionalCategories });
  }

  const rows = await sql.query(
    `INSERT INTO ${config.table} (id, slug, ${config.titleColumn}, ${config.excerptColumn}, content, image_url, image_key, gallery_images, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
     RETURNING *`,
    [id, slug, input.title, excerpt, content, imageUrl, imageKey, galleryJson]
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
  const galleryImages = normalizeGalleryImages(input.galleryImages);
  const galleryJson = JSON.stringify(galleryImages);

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
           gallery_images = $7::jsonb,
           category = $8,
           subcategory = $9,
           brand = $10,
           model_number = $11,
           part_number = $12,
           condition = $13,
           availability = $14,
           availability_verified_at = $15,
           condition_verified_at = $16,
           location = $17,
           technical_specifications = $18,
           application = $19,
           seo_title = $20,
           meta_description = $21,
           focus_keyword = $22,
           image_alt = $23,
           related_products = $24,
           updated_at = NOW()
       WHERE id = $25
       RETURNING *`,
      [
        slug, normalizedTitle, excerpt, content, imageUrl, imageKey, galleryJson,
        product.category, product.subcategory, product.brand, product.modelNumber, product.partNumber,
        product.condition, product.availability, product.availabilityVerifiedAt, product.conditionVerifiedAt,
        product.location, product.technicalSpecifications, product.application, product.seoTitle,
        product.metaDescription, product.focusKeyword, product.imageAlt, product.relatedProducts, id
      ]
    );
    if (rows[0]) await syncProductCategoryAssignments(sql, id, product.additionalCategories);
    if (rows[0] && product.brand) await ensureBrandExists(env, product.brand);
    return rows[0] ? mapRecord(type, { ...rows[0], additional_categories: product.additionalCategories }) : null;
  }

  const rows = await sql.query(
    `UPDATE ${config.table}
     SET slug = $1,
         ${config.titleColumn} = $2,
         ${config.excerptColumn} = $3,
         content = $4,
         image_url = $5,
         image_key = $6,
         gallery_images = $7::jsonb,
         updated_at = NOW()
     WHERE id = $8
     RETURNING *`,
    [slug, input.title, excerpt, content, imageUrl, imageKey, galleryJson, id]
  );

  return rows[0] ? mapRecord(type, rows[0]) : null;
}

export async function deleteContent(env: RuntimeEnv, type: ContentType, id: string) {
  await ensureSchema(env);
  const sql = getDb(env);
  const { table } = CONTENT_TABLES[type];
  await sql.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
