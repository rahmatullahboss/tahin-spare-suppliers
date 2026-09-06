import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";

export type PageOverride = {
  type: "text" | "image";
  text?: string;
  src?: string;
  alt?: string;
  key?: string;
};

export type PageOverrides = Record<string, PageOverride>;

const MAX_PAGE_KEY_LENGTH = 240;
const MAX_SELECTOR_LENGTH = 500;
const MAX_TEXT_LENGTH = 12_000;
const MAX_OVERRIDE_COUNT = 300;
const MAX_JSON_BYTES = 250_000;

export function normalizePageKey(value: unknown): string {
  const pageKey = typeof value === "string" ? value.trim() : "";
  if (!pageKey || pageKey.length > MAX_PAGE_KEY_LENGTH || !pageKey.startsWith("/")) {
    throw new Error("Invalid page path.");
  }
  return pageKey.split("?")[0] || "/";
}

function sanitizeImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
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

function sanitizeOverrides(value: unknown): PageOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Overrides must be an object.");
  }

  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OVERRIDE_COUNT);
  const output: PageOverrides = {};

  for (const [selector, raw] of entries) {
    if (!selector || selector.length > MAX_SELECTOR_LENGTH || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    if (item.type === "text") {
      output[selector] = {
        type: "text",
        text: typeof item.text === "string" ? item.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, MAX_TEXT_LENGTH) : "",
      };
    } else if (item.type === "image") {
      output[selector] = {
        type: "image",
        src: sanitizeImageUrl(item.src),
        alt: typeof item.alt === "string" ? item.alt.slice(0, 1000) : "",
        key: typeof item.key === "string" ? item.key.slice(0, 500) : "",
      };
    }
  }

  const bytes = new TextEncoder().encode(JSON.stringify(output)).byteLength;
  if (bytes > MAX_JSON_BYTES) throw new Error("Page edits are too large.");
  return output;
}

function parseOverrides(value: unknown): PageOverrides {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as PageOverrides;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as PageOverrides : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function getPageOverrides(env: RuntimeEnv, rawPageKey: string): Promise<PageOverrides> {
  const pageKey = normalizePageKey(rawPageKey);
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT overrides_json FROM page_overrides WHERE page_key = $1 LIMIT 1`,
    [pageKey]
  );
  return parseOverrides(rows[0]?.overrides_json);
}

export async function savePageOverrides(env: RuntimeEnv, rawPageKey: string, rawOverrides: unknown): Promise<PageOverrides> {
  const pageKey = normalizePageKey(rawPageKey);
  const overrides = sanitizeOverrides(rawOverrides);
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `INSERT INTO page_overrides (page_key, overrides_json, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (page_key)
     DO UPDATE SET overrides_json = EXCLUDED.overrides_json, updated_at = NOW()
     RETURNING overrides_json`,
    [pageKey, JSON.stringify(overrides)]
  );
  return parseOverrides(rows[0]?.overrides_json);
}
