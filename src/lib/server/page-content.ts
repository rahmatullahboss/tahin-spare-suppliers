import { HOMEPAGE_DEFAULTS, HOMEPAGE_SECTION_ORDER, type HomepageContent, type HomepageSectionKey } from "../page-content";
import type { RuntimeEnv } from "./env";
import { ensureSchema, getDb } from "./db";

const MAX_JSON_BYTES = 120_000;
const MAX_STRING_LENGTH = 8_000;
const MAX_ARRAY_LENGTH = 40;
const URL_KEY_PATTERN = /(?:^|_)(?:url|href)$/i;
const CAMEL_URL_KEY_PATTERN = /(?:Url|URL)$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== "object" || Array.isArray(override)) return clone(base);
  const output: Record<string, unknown> = clone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    const baseValue = output[key];
    if (
      baseValue &&
      value &&
      typeof baseValue === "object" &&
      typeof value === "object" &&
      !Array.isArray(baseValue) &&
      !Array.isArray(value)
    ) {
      output[key] = deepMerge(baseValue, value);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}

function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? trimmed : "";
  } catch {
    return "";
  }
}

function sanitizeValue(value: unknown, key = "", depth = 0): unknown {
  if (depth > 8) return null;
  if (typeof value === "string") {
    const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, MAX_STRING_LENGTH);
    return URL_KEY_PATTERN.test(key) || CAMEL_URL_KEY_PATTERN.test(key) ? sanitizeUrl(normalized) : normalized;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, key, depth + 1));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      if (!/^[a-zA-Z0-9_-]+$/.test(childKey)) continue;
      next[childKey] = sanitizeValue(childValue, childKey, depth + 1);
    }
    return next;
  }
  return null;
}

function parseStoredJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function getHomepageContent(env: RuntimeEnv): Promise<HomepageContent> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    "SELECT section_key, content_json FROM page_sections WHERE page_key = $1",
    ["home"]
  );
  const byKey = new Map(rows.map((row) => [String(row.section_key), parseStoredJson(row.content_json)]));
  const content = clone(HOMEPAGE_DEFAULTS);
  for (const key of HOMEPAGE_SECTION_ORDER) {
    const stored = byKey.get(key);
    if (stored) content[key] = deepMerge(content[key], stored) as never;
  }
  return content;
}

export async function getHomepageSection(env: RuntimeEnv, section: HomepageSectionKey) {
  const content = await getHomepageContent(env);
  return content[section];
}

export async function saveHomepageSection(env: RuntimeEnv, section: HomepageSectionKey, rawContent: unknown) {
  const serializedRaw = JSON.stringify(rawContent ?? {});
  if (new TextEncoder().encode(serializedRaw).byteLength > MAX_JSON_BYTES) {
    throw new Error("Section content is too large.");
  }

  const sanitized = sanitizeValue(rawContent, section);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    throw new Error("Section content must be an object.");
  }

  const merged = deepMerge(HOMEPAGE_DEFAULTS[section], sanitized);
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `INSERT INTO page_sections (page_key, section_key, content_json, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (page_key, section_key)
     DO UPDATE SET content_json = EXCLUDED.content_json, updated_at = NOW()
     RETURNING content_json`,
    ["home", section, JSON.stringify(merged)]
  );

  return deepMerge(HOMEPAGE_DEFAULTS[section], parseStoredJson(rows[0]?.content_json));
}
