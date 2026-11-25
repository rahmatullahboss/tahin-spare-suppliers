import { HOMEPAGE_DEFAULTS, HOMEPAGE_SECTION_ORDER, normalizeHomepageCtaUrl, type HomepageContent, type HomepageSectionKey } from "../page-content.ts";

export function parseStoredJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// The target has already been detached from defaults. Merge nested objects
// without repeatedly serializing the same default subtree.
function mergeInto(target: Record<string, unknown>, override: unknown): void {
  if (!override || typeof override !== "object" || Array.isArray(override)) return;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const baseValue = target[key];
    if (baseValue && value && typeof baseValue === "object" && typeof value === "object" &&
        !Array.isArray(baseValue) && !Array.isArray(value)) {
      mergeInto(baseValue as Record<string, unknown>, value);
    } else {
      target[key] = value;
    }
  }
}

export function deepMerge<T>(base: T, override: unknown): T {
  const output = clone(base);
  mergeInto(output as Record<string, unknown>, override);
  return output;
}

export function mapHomepageContentRows(rows: Record<string, unknown>[]): HomepageContent {
  const byKey = new Map(rows.map(row => [String(row.section_key), parseStoredJson(row.content_json)]));
  const content = clone(HOMEPAGE_DEFAULTS);
  for (const key of HOMEPAGE_SECTION_ORDER) {
    mergeInto(content[key] as unknown as Record<string, unknown>, byKey.get(key));
  }
  content.hero.ctaUrl = normalizeHomepageCtaUrl(content.hero.ctaUrl);
  content["export-logistics"].ctaUrl = normalizeHomepageCtaUrl(content["export-logistics"].ctaUrl);
  return content;
}

export function mapHomepageSection<K extends HomepageSectionKey>(section: K, stored: unknown): HomepageContent[K] {
  const content = deepMerge(HOMEPAGE_DEFAULTS[section], parseStoredJson(stored));
  if (section === "hero" || section === "export-logistics") {
    const cta = content as HomepageContent["hero"] | HomepageContent["export-logistics"];
    cta.ctaUrl = normalizeHomepageCtaUrl(cta.ctaUrl);
  }
  return content;
}
