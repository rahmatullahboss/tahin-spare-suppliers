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

export type ProductIdentitySource = {
  slug?: string;
  title: string;
  modelNumber?: string;
  seoTitle?: string;
  focusKeyword?: string;
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

function normalizeIdentityCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractModelCodes(value: string | undefined): Array<{ raw: string; normalized: string; stem: string }> {
  const matches = cleanText(value).match(/\b(?=[a-z0-9/-]{3,}\b)(?=[a-z0-9/-]*[a-z])(?=[a-z0-9/-]*\d)[a-z0-9]+(?:[-/][a-z0-9]+)*\b/gi) ?? [];
  return matches.map((raw) => {
    const normalized = normalizeIdentityCode(raw);
    const stem = normalized.match(/^([a-z]+)\d/)?.[1]
      ?? normalized.match(/^\d+([a-z]+)/)?.[1]
      ?? "";
    return { raw, normalized, stem };
  });
}

export function findProductIdentityConflict(source: ProductIdentitySource): string | undefined {
  const modelCodes = extractModelCodes(source.modelNumber);
  if (modelCodes.length === 0) return undefined;

  const fields = [
    ["slug", source.slug?.replace(/-/g, " ")],
    ["title", source.title],
    ["SEO title", source.seoTitle],
    ["focus keyword", source.focusKeyword]
  ] as const;

  for (const modelCode of modelCodes) {
    for (const [fieldName, fieldValue] of fields) {
      if (!fieldValue) continue;
      const compactField = normalizeIdentityCode(fieldValue);
      if (compactField.includes(modelCode.normalized)) continue;

      const conflictingCode = extractModelCodes(fieldValue).find((candidate) => (
        Boolean(modelCode.stem)
        && candidate.stem === modelCode.stem
        && candidate.normalized !== modelCode.normalized
      ));
      if (conflictingCode) {
        return `Model ${modelCode.raw} conflicts with ${fieldName} model ${conflictingCode.raw}.`;
      }
    }
  }

  return undefined;
}

export function resolveCategorySeo(source: { slug: string; value: string }): { title: string; description: string } {
  if (source.slug === "spare-parts") {
    return {
      title: "Marine Spare Parts Supplier | Tahin Spare Suppliers",
      description: "Browse marine engine and equipment spare parts by brand and model. Request specifications, availability, price and worldwide shipping details from Tahin Spare Suppliers."
    };
  }
  if (source.slug === "turbocharger") {
    return {
      title: "Marine Turbocharger Supplier | Tahin Spare Suppliers",
      description: "Browse marine turbocharger listings by brand and model. Request condition, specifications, availability, price and shipping details from Tahin Spare Suppliers."
    };
  }
  return {
    title: `${source.value} Supplier & Exporter | ${SITE_NAME}`,
    description: `Browse current ${source.value} listings by brand and model. Request specifications, condition, availability, price and worldwide shipping from ${SITE_NAME}.`
  };
}

const LEGACY_PRODUCT_REDIRECTS: Readonly<Record<string, string>> = Object.freeze({
  "connecting-rod-for-man-b-w-5l-16-24": "/products/man-b-w-5l16-24-genuine-spare-parts-5l-6l",
  "cummins-vta-28-d-m-marine-engine-815hp": "/products/cummins-vta28-dm-815hp-marine-engine"
});

export function resolveLegacyProductRedirect(slug: string | undefined): string | undefined {
  const normalizedSlug = cleanText(slug).toLowerCase();
  return normalizedSlug ? LEGACY_PRODUCT_REDIRECTS[normalizedSlug] : undefined;
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
