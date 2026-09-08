type CategoryIdentity = {
  slug?: string | null;
  value?: string | null;
  canonicalValue?: string | null;
};

const BRAND_DIRECTORY_CATEGORY_SLUGS = new Set([
  "marine-propulsion-engine",
  "auxiliary-engine",
  "marine-generator-set",
  "marine-generator-sets",
  "diesel-generator-set",
  "diesel-and-gas-generator-set",
  "diesel-gas-generator-set",
  "spare-parts",
]);

const BRAND_DIRECTORY_CATEGORY_NAMES = new Set([
  "marine propulsion engine",
  "auxiliary engine",
  "marine generator set",
  "marine generator sets",
  "diesel and gas generator set",
  "diesel and gas generator sets",
  "spare parts",
]);

function normalizeCategoryName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function shouldShowCategoryBrandDirectory(category: CategoryIdentity): boolean {
  const slug = category.slug?.trim().toLowerCase() ?? "";
  if (BRAND_DIRECTORY_CATEGORY_SLUGS.has(slug)) return true;

  const name = normalizeCategoryName(category.canonicalValue || category.value || "");
  return BRAND_DIRECTORY_CATEGORY_NAMES.has(name);
}
