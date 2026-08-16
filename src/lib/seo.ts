export const SITE_URL = "https://tahinspare.com";
export const SITE_NAME = "Tahin Spare Suppliers";

const TITLE_MAX_LENGTH = 70;
const META_MAX_LENGTH = 160;

export type ProductSeoSource = {
  title: string;
  brand?: string;
  modelNumber?: string;
  partNumber?: string;
  location?: string;
  seoTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  imageAlt?: string;
};

export type ResolvedProductSeo = {
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  imageAlt: string;
};

function cleanText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function truncateAtWord(value: string, maxLength: number): string {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) return normalized;

  const slice = normalized.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice = lastSpace >= Math.floor(maxLength * 0.65) ? slice.slice(0, lastSpace) : slice;
  return `${safeSlice.trimEnd()}…`;
}

export function buildDefaultSeoTitle(title: string): string {
  const normalizedTitle = cleanText(title) || "Marine Equipment";
  const suffix = ` | ${SITE_NAME}`;
  const buyerTitle = /\bfor sale\b/i.test(normalizedTitle) ? normalizedTitle : `${normalizedTitle} for Sale`;

  if (`${buyerTitle}${suffix}`.length <= TITLE_MAX_LENGTH) {
    return `${buyerTitle}${suffix}`;
  }

  const maxBuyerTitleLength = TITLE_MAX_LENGTH - suffix.length;
  return `${truncateAtWord(buyerTitle, maxBuyerTitleLength)}${suffix}`;
}

export function buildDefaultMetaDescription(source: Pick<ProductSeoSource, "title" | "location">): string {
  const title = cleanText(source.title) || "Marine equipment";
  const location = cleanText(source.location) || "Bangladesh";
  const description = `${title} available from ${SITE_NAME}, ${location}. Contact us for specifications, current availability, price and worldwide shipping.`;
  return truncateAtWord(description, META_MAX_LENGTH);
}

export function buildDefaultImageAlt(source: Pick<ProductSeoSource, "title" | "modelNumber" | "partNumber">): string {
  const title = cleanText(source.title) || "Marine equipment";
  const modelNumber = cleanText(source.modelNumber);
  const partNumber = cleanText(source.partNumber);
  const identifiers = [
    modelNumber ? `model ${modelNumber}` : "",
    partNumber ? `part ${partNumber}` : ""
  ].filter(Boolean);

  return identifiers.length > 0
    ? `${title}, ${identifiers.join(", ")} product photo`
    : `${title} product photo`;
}

export function resolveProductSeo(source: ProductSeoSource): ResolvedProductSeo {
  return {
    seoTitle: cleanText(source.seoTitle) || buildDefaultSeoTitle(source.title),
    metaDescription: cleanText(source.metaDescription) || buildDefaultMetaDescription(source),
    focusKeyword: cleanText(source.focusKeyword) || cleanText(source.title),
    imageAlt: cleanText(source.imageAlt) || buildDefaultImageAlt(source)
  };
}

export function toUrlSlug(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function schemaConditionUrl(condition: string | undefined): string | undefined {
  const normalized = cleanText(condition).toLowerCase();
  if (!normalized) return undefined;
  if (/\b(new|unused)\b/.test(normalized)) return "https://schema.org/NewCondition";
  if (/recondition|refurbish|overhaul/.test(normalized)) return "https://schema.org/RefurbishedCondition";
  if (/used|as removed|second[- ]hand/.test(normalized)) return "https://schema.org/UsedCondition";
  return undefined;
}

export function parseRelatedProductSlugs(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === "string").map(toUrlSlug).filter(Boolean))];
  }

  if (typeof value !== "string" || value.trim().length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parseRelatedProductSlugs(parsed);
  } catch {
    // Support the admin's comma-separated fallback and legacy text values.
  }

  return [...new Set(value.split(",").map(toUrlSlug).filter(Boolean))];
}

export function stringifyRelatedProductSlugs(value: unknown): string {
  return JSON.stringify(parseRelatedProductSlugs(value));
}

export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}
