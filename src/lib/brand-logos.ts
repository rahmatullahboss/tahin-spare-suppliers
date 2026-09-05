import { toUrlSlug } from "./seo.ts";

export type BrandLogoAsset = {
  brand: string;
  slug: string;
  url: string;
  alt: string;
};

const BRAND_LOGO_DEFINITIONS = [
  ["Yanmar", "/images/brands/yanmar-1.svg"],
  ["Caterpillar", "/images/brands/caterpillar-logo2.svg"],
  ["MAN B&W", "/images/brands/man-logo.svg"],
  ["Wartsila", "/images/brands/wartsila.svg"],
  ["Rolls Royce", "/images/brands/rolls-royce.svg"],
  ["MTU", "/images/brands/mtu-friedrichshafen-logo.svg"],
  ["Cummins", "/images/brands/cummins.svg"],
  ["Mitsubishi", "/images/brands/mitsubishi-1.svg"],
  ["Daihatsu", "/images/brands/daihatsu-3.svg"],
  ["Detroit Diesel", "/images/brands/detroit-diesel-logo.svg"]
] as const;

export const BRAND_LOGOS: BrandLogoAsset[] = BRAND_LOGO_DEFINITIONS.map(([brand, url]) => ({
  brand,
  slug: toUrlSlug(brand),
  url,
  alt: `${brand} logo`
}));

const BRAND_LOGO_BY_SLUG = new Map(BRAND_LOGOS.map((asset) => [asset.slug, asset] as const));

export function getBrandLogoAsset(brand: string): BrandLogoAsset | null {
  return BRAND_LOGO_BY_SLUG.get(toUrlSlug(brand)) ?? null;
}
