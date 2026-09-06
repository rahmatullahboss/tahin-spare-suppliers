import { BUSINESS_PROFILE } from "../business-profile";
import { ensureSchema, getDb } from "./db";
import type { RuntimeEnv } from "./env";

export type EmailSignatureSettings = {
  closing: string;
  personName: string;
  role: string;
  companyName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  logoUrl: string;
  logoKey: string;
};

export const DEFAULT_EMAIL_SIGNATURE: EmailSignatureSettings = {
  closing: "Thanks and Best Regards,",
  personName: BUSINESS_PROFILE.proprietor,
  role: "Proprietor",
  companyName: BUSINESS_PROFILE.name,
  phone: BUSINESS_PROFILE.phone.display,
  email: BUSINESS_PROFILE.email,
  website: BUSINESS_PROFILE.website.replace(/^https?:\/\//, ""),
  address: BUSINESS_PROFILE.address.singleLine,
  logoUrl: "/images/logo-512.png",
  logoKey: "",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value: string): string {
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

function parseJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
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

function normalizeSettings(raw: unknown): EmailSignatureSettings {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const text = (key: keyof EmailSignatureSettings, fallback: string, max = 2000) => {
    const value = typeof input[key] === "string" ? (input[key] as string) : fallback;
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
  };

  return {
    closing: text("closing", DEFAULT_EMAIL_SIGNATURE.closing, 500),
    personName: text("personName", DEFAULT_EMAIL_SIGNATURE.personName, 300),
    role: text("role", DEFAULT_EMAIL_SIGNATURE.role, 300),
    companyName: text("companyName", DEFAULT_EMAIL_SIGNATURE.companyName, 300),
    phone: text("phone", DEFAULT_EMAIL_SIGNATURE.phone, 300),
    email: text("email", DEFAULT_EMAIL_SIGNATURE.email, 320),
    website: text("website", DEFAULT_EMAIL_SIGNATURE.website, 500),
    address: text("address", DEFAULT_EMAIL_SIGNATURE.address, 1500),
    logoUrl: safeUrl(text("logoUrl", DEFAULT_EMAIL_SIGNATURE.logoUrl, 1500)),
    logoKey: text("logoKey", DEFAULT_EMAIL_SIGNATURE.logoKey, 500),
  };
}

export async function getEmailSignatureSettings(env: RuntimeEnv): Promise<EmailSignatureSettings> {
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `SELECT content_json FROM page_sections WHERE page_key = 'email' AND section_key = 'signature' LIMIT 1`
  );
  if (!rows[0]?.content_json) return { ...DEFAULT_EMAIL_SIGNATURE };
  return normalizeSettings({ ...DEFAULT_EMAIL_SIGNATURE, ...parseJson(rows[0].content_json) });
}

export async function saveEmailSignatureSettings(env: RuntimeEnv, raw: unknown): Promise<EmailSignatureSettings> {
  const settings = normalizeSettings(raw);
  await ensureSchema(env);
  const sql = getDb(env);
  const rows = await sql.query(
    `INSERT INTO page_sections (page_key, section_key, content_json, updated_at)
     VALUES ('email', 'signature', $1::jsonb, NOW())
     ON CONFLICT (page_key, section_key)
     DO UPDATE SET content_json = EXCLUDED.content_json, updated_at = NOW()
     RETURNING content_json`,
    [JSON.stringify(settings)]
  );
  return normalizeSettings(rows[0]?.content_json);
}

export function renderEmailSignatureHtml(settings: EmailSignatureSettings): string {
  const websiteHref = settings.website
    ? safeUrl(/^https?:\/\//i.test(settings.website) ? settings.website : `https://${settings.website}`)
    : "";
  const emailHref = settings.email ? `mailto:${encodeURIComponent(settings.email)}` : "";
  const phoneHref = settings.phone ? `tel:${settings.phone.replace(/[^+\d]/g, "")}` : "";
  const logoSrc = settings.logoUrl.startsWith("/")
    ? `${BUSINESS_PROFILE.website}${settings.logoUrl}`
    : settings.logoUrl;
  const logo = logoSrc
    ? `<td style="width:150px;padding:0 18px 0 0;vertical-align:top;border-right:1px solid #d1d5db;"><img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(settings.companyName)} logo" style="display:block;max-width:130px;max-height:84px;width:auto;height:auto;border:0;" /></td>`
    : "";

  const infoLines = [
    settings.personName ? `<strong style="font-size:14px;color:#111827;">${escapeHtml(settings.personName)}</strong>` : "",
    settings.role ? `<span style="color:#4b5563;">${escapeHtml(settings.role)}</span>` : "",
    settings.companyName ? `<strong style="color:#b11623;">${escapeHtml(settings.companyName)}</strong>` : "",
    phoneHref ? `<a href="${escapeHtml(phoneHref)}" style="color:#374151;text-decoration:none;">${escapeHtml(settings.phone)}</a>` : "",
    emailHref ? `<a href="${escapeHtml(emailHref)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(settings.email)}</a>` : "",
    websiteHref ? `<a href="${escapeHtml(websiteHref)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(settings.website)}</a>` : "",
    settings.address ? `<span style="color:#6b7280;">${escapeHtml(settings.address)}</span>` : "",
  ].filter(Boolean).join("<br />");

  return `
    <div data-tahin-email-signature="true" style="margin-top:28px;padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#374151;">
      <p style="margin:0 0 16px;font-weight:600;color:#111827;">${escapeHtml(settings.closing)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:680px;width:auto;">
        <tr>
          ${logo}
          <td style="padding:0 0 0 ${logo ? "18px" : "0"};vertical-align:top;">${infoLines}</td>
        </tr>
      </table>
    </div>
  `.trim();
}

export function appendEmailSignature(bodyHtml: string, signatureHtml: string): string {
  const cleaned = bodyHtml.replace(/<div\b[^>]*data-tahin-email-signature=["']true["'][\s\S]*$/i, "").trim();
  return `${cleaned}${signatureHtml ? `\n${signatureHtml}` : ""}`;
}
