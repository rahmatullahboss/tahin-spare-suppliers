import { canonicalizeBrand, cleanProductTitle } from "../inventory-quality.ts";
import { buildDefaultImageAlt } from "../seo.ts";

export type ProductSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  updatedAt: string;
  category: string;
  subcategory: string;
  brand: string;
  model_number: string;
  partNumber: string;
  imageAlt: string;
};

const asString = (value: unknown): string => value == null ? "" : String(value);

// Map only the actual summary projection. Full detail SEO, gallery, category
// assignment and verification date processing belong to the full record reader.
export function mapProductSummary(row: Record<string, unknown>): ProductSummary {
  const title = cleanProductTitle(asString(row.name));
  const modelNumber = asString(row.model_number);
  const partNumber = asString(row.part_number);
  return {
    id: asString(row.id),
    slug: asString(row.slug),
    title,
    excerpt: asString(row.short_description),
    imageUrl: asString(row.image_url),
    updatedAt: asString(row.updated_at),
    category: asString(row.category) || "Uncategorized",
    subcategory: asString(row.subcategory),
    brand: canonicalizeBrand(row.brand),
    model_number: modelNumber,
    partNumber,
    imageAlt: asString(row.image_alt).replace(/\s+/g, " ").trim() || buildDefaultImageAlt({title, modelNumber, partNumber}),
  };
}
