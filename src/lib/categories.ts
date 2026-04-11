/**
 * Single source of truth for all equipment categories.
 * Used by: admin ContentEditor, public /products page, category routes.
 */

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

/** Find category by its URL slug */
export function getCategoryBySlug(slug: string) {
  return EQUIPMENT_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/** Find category slug from its display value */
export function getCategorySlug(value: string): string {
  return EQUIPMENT_CATEGORIES.find((c) => c.value === value)?.slug ?? value.toLowerCase().replace(/\s+/g, '-');
}
