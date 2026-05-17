/**
 * Single source of truth for all equipment categories.
 * Used by: admin ContentEditor, public /products page, category routes.
 */

export const DEFAULT_CATEGORY_IMAGE = '/images/marine-propulsion-engine.jpg';

export const CATEGORY_IMAGES: Record<string, string> = {
  'marine-propulsion-engine': '/images/marine-propulsion-engine.jpg',
  'marine-gearbox': '/images/marine-gearbox.jpg',
  'auxiliary-engine': '/images/auxiliary-engine.jpg',
  'diesel-generator-set': '/images/diesel-generator-set.jpg',
  'spare-parts': '/images/spare-parts-new.jpg',
  'hydraulic-deck-crane-equipment': '/images/hydraulic-crane-equipment.jpg',
  'anchor-and-chain': '/images/anchor-chain.jpg',
  'marine-pump': '/images/marine-pump.jpg',
};

export const EQUIPMENT_CATEGORIES = [
  { value: 'Marine Propulsion Engine', slug: 'marine-propulsion-engine' },
  { value: 'Marine Gearbox', slug: 'marine-gearbox' },
  { value: 'Auxiliary Engine', slug: 'auxiliary-engine' },
  { value: 'Diesel & Gas Generator Set', slug: 'diesel-generator-set' },
  { value: 'Spare Parts', slug: 'spare-parts' },
  { value: 'Hydraulic Deck Crane Equipment', slug: 'hydraulic-deck-crane-equipment' },
  { value: 'Anchor and Chain', slug: 'anchor-and-chain' },
  { value: 'Marine Pump', slug: 'marine-pump' },
] as const;

export type EquipmentCategoryValue = (typeof EQUIPMENT_CATEGORIES)[number]['value'];
export type EquipmentCategorySlug = (typeof EQUIPMENT_CATEGORIES)[number]['slug'];

export type CustomCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  imageKey: string;
  parentId: string;
  createdAt: string;
};

export type DisplayCategory = {
  id?: string;
  value: string;
  slug: string;
  imageUrl: string;
  imageKey: string;
  parentId?: string;
  createdAt?: string;
  isDefault: boolean;
};

export function mergeCategories(customCategories: CustomCategory[] = []): DisplayCategory[] {
  const defaults = EQUIPMENT_CATEGORIES.map((category) => ({
    ...category,
    imageUrl: CATEGORY_IMAGES[category.slug] ?? DEFAULT_CATEGORY_IMAGE,
    imageKey: '',
    isDefault: true
  }));

  const defaultSlugs = new Set(defaults.map((category) => category.slug));
  const custom = customCategories
    .filter((category) => !defaultSlugs.has(category.slug))
    .map((category) => ({
      id: category.id,
      value: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl || DEFAULT_CATEGORY_IMAGE,
      imageKey: category.imageKey,
      parentId: category.parentId,
      createdAt: category.createdAt,
      isDefault: false
    }));

  return [...defaults, ...custom];
}

export function findCategoryBySlug(categories: DisplayCategory[], slug: string) {
  return categories.find((category) => category.slug === slug) ?? null;
}

export function isReservedCategorySlug(slug: string) {
  return EQUIPMENT_CATEGORIES.some((category) => category.slug === slug);
}

/** Find category by its URL slug */
export function getCategoryBySlug(slug: string) {
  return mergeCategories().find((c) => c.slug === slug) ?? null;
}

/** Find category slug from its display value */
export function getCategorySlug(value: string, categories: DisplayCategory[] = mergeCategories()): string {
  return categories.find((c) => c.value === value)?.slug ?? value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
