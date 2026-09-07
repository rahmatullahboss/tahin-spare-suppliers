import { getBrandLogoAsset } from "../brand-logos";
import { canonicalizeBrand } from "../inventory-quality";
import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";
import { slugify } from "./slug";

export type BrandRecord = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  logoKey: string;
  displayLogoUrl: string;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

type BrandInput = {
  name: string;
  logoUrl?: string;
  logoKey?: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normalizeBrandInput(input: BrandInput) {
  const name = canonicalizeBrand(input.name);
  const slug = slugify(name);

  if (!name) throw new Error("Name is required");
  if (!slug) throw new Error("Name must contain at least one letter or number");

  return {
    name,
    slug,
    logoUrl: input.logoUrl?.trim() ?? "",
    logoKey: input.logoKey?.trim() ?? ""
  };
}

function mapBrand(row: Record<string, unknown>, productCount: number): BrandRecord {
  const name = asString(row.name);
  const customLogoUrl = asString(row.logo_url);
  const fallbackLogo = getBrandLogoAsset(name)?.url ?? "";

  return {
    id: asString(row.id),
    name,
    slug: asString(row.slug),
    logoUrl: customLogoUrl,
    logoKey: asString(row.logo_key),
    displayLogoUrl: customLogoUrl || fallbackLogo,
    productCount,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export async function ensureBrandExists(env: RuntimeEnv, rawName: string): Promise<void> {
  const { name, slug } = normalizeBrandInput({ name: rawName });
  const sql = getDb(env);
  await ensureSchema(env);
  await sql.query(
    `INSERT INTO brands (id, name, slug, logo_url, logo_key, created_at, updated_at)
     VALUES ($1, $2, $3, '', '', NOW(), NOW())
     ON CONFLICT (slug) DO NOTHING`,
    [crypto.randomUUID(), name, slug]
  );
}

export async function listBrands(env: RuntimeEnv): Promise<BrandRecord[]> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(`
    SELECT
      b.id,
      b.name,
      b.slug,
      b.logo_url,
      b.logo_key,
      b.created_at,
      b.updated_at,
      COALESCE(p.product_count, 0) AS product_count
    FROM brands b
    LEFT JOIN (
      SELECT LOWER(TRIM(brand)) AS brand_key, COUNT(*)::int AS product_count
      FROM products
      WHERE TRIM(brand) <> ''
      GROUP BY LOWER(TRIM(brand))
    ) p ON p.brand_key = LOWER(TRIM(b.name))
    ORDER BY b.name
  `);

  return rows.map((row) => mapBrand(row, Number(row.product_count ?? 0)));
}

export async function getBrandBySlug(env: RuntimeEnv, slug: string): Promise<BrandRecord | null> {
  const brands = await listBrands(env);
  return brands.find((brand) => brand.slug === slug) ?? null;
}

export async function createBrand(env: RuntimeEnv, input: BrandInput): Promise<BrandRecord> {
  await ensureSchema(env);
  const sql = getDb(env);
  const normalized = normalizeBrandInput(input);
  const id = crypto.randomUUID();
  const rows = await sql.query(
    `INSERT INTO brands (id, name, slug, logo_url, logo_key, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, name, slug, logo_url, logo_key, created_at, updated_at`,
    [id, normalized.name, normalized.slug, normalized.logoUrl, normalized.logoKey]
  );
  return mapBrand(rows[0], 0);
}

export async function updateBrand(env: RuntimeEnv, id: string, input: BrandInput): Promise<BrandRecord | null> {
  await ensureSchema(env);
  const sql = getDb(env);
  const normalized = normalizeBrandInput(input);
  const existingRows = await sql.query(`SELECT id, name, slug, logo_url, logo_key FROM brands WHERE id = $1 LIMIT 1`, [id]);
  const existing = existingRows[0];
  if (!existing) return null;

  const conflictRows = await sql.query(`SELECT id FROM brands WHERE slug = $1 AND id <> $2 LIMIT 1`, [normalized.slug, id]);
  if (conflictRows.length > 0) throw new Error("A brand with this name already exists");

  const oldName = asString(existing.name);
  await sql.transaction([
    sql`UPDATE brands
        SET name = ${normalized.name}, slug = ${normalized.slug}, logo_url = ${normalized.logoUrl}, logo_key = ${normalized.logoKey}, updated_at = NOW()
        WHERE id = ${id}`,
    sql`UPDATE products SET brand = ${normalized.name} WHERE LOWER(TRIM(brand)) = LOWER(${oldName})`
  ]);

  const rows = await sql.query(
    `SELECT id, name, slug, logo_url, logo_key, created_at, updated_at FROM brands WHERE id = $1 LIMIT 1`,
    [id]
  );
  const countRows = await sql.query(`SELECT COUNT(*) AS total FROM products WHERE LOWER(TRIM(brand)) = LOWER($1)`, [normalized.name]);
  return rows[0] ? mapBrand(rows[0], Number(countRows[0]?.total ?? 0)) : null;
}

export async function deleteBrand(env: RuntimeEnv, id: string): Promise<BrandRecord | null> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT id, name, slug, logo_url, logo_key, created_at, updated_at FROM brands WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;

  const name = asString(rows[0].name);
  const countRows = await sql.query(`SELECT COUNT(*) AS total FROM products WHERE LOWER(TRIM(brand)) = LOWER($1)`, [name]);
  const productCount = Number(countRows[0]?.total ?? 0);
  if (productCount > 0) {
    throw new Error(`Cannot delete ${name} while ${productCount} product${productCount === 1 ? "" : "s"} use this brand`);
  }

  await sql.query(`DELETE FROM brands WHERE id = $1`, [id]);
  return mapBrand(rows[0], 0);
}
