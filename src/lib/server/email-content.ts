import xssModule from "xss";

const {
  escapeAttrValue,
  FilterXSS,
  safeAttrValue: defaultSafeAttrValue,
} = xssModule as unknown as typeof import("xss");

export interface InboundEmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  contentDisposition: string;
  contentId: string;
  size?: number;
}

const SAFE_INLINE_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isSafeInlineImageContentType(value: string): boolean {
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return SAFE_INLINE_IMAGE_CONTENT_TYPES.has(normalized);
}

function normalizeContentId(value: string): string {
  let normalized = value.trim();
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // A malformed sender-controlled URI must not prevent rendering.
  }
  return normalized.replace(/^<|>$/g, "").toLowerCase();
}

// The provider may preserve raster images both in the received attachment
// manifest and as original data URIs in the HTML. Match uniquely by exact
// MIME type and decoded byte length before assigning an authenticated URL.
const EMBEDDED_IMAGE_TAG = /<img\b[^>]*?\bsrc\s*=\s*(["'])data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})\1/gi;
const MAX_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;

function embeddedBase64Bytes(value: string): number {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const bytes = (value.length / 4) * 3 - padding;
  return bytes > 0 && bytes <= MAX_EMBEDDED_IMAGE_BYTES ? bytes : 0;
}

function exactEmbeddedImageAttachment(
  base64: string,
  contentType: string,
  attachments: InboundEmailAttachment[]
): InboundEmailAttachment | undefined {
  const size = embeddedBase64Bytes(base64);
  if (!size || !isSafeInlineImageContentType(contentType)) return undefined;
  const matches = attachments.filter((attachment) =>
    attachment.size === size
    && attachment.contentType.split(";", 1)[0]?.trim().toLowerCase() === contentType.toLowerCase()
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** Safely recover a legacy inline raster image from private message HTML. */
export function recoverEmbeddedInlineImage(
  html: string,
  attachments: InboundEmailAttachment[],
  attachmentId: string
): { contentType: string; bytes: Uint8Array } | null {
  for (const match of html.matchAll(EMBEDDED_IMAGE_TAG)) {
    const mime = match[2];
    const encoded = match[3];
    const candidate = exactEmbeddedImageAttachment(encoded, mime, attachments);
    if (!candidate || candidate.id !== attachmentId) continue;
    try {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const isPng = mime.toLowerCase() === "image/png"
        && bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
      const isJpeg = mime.toLowerCase() === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216;
      const isGif = mime.toLowerCase() === "image/gif" && bytes.length >= 6
        && String.fromCharCode(...bytes.slice(0, 6)).startsWith("GIF8");
      const isWebp = mime.toLowerCase() === "image/webp" && bytes.length >= 12
        && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
        && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
      if (bytes.length === candidate.size && (isPng || isJpeg || isGif || isWebp)) {
        return { contentType: mime.toLowerCase(), bytes };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function sanitizeEmailHeader(value: string, maxLength: number = 200): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export type EmailMessageSource = "inbound" | "sent";

function attachmentUrl(
  emailId: string,
  attachmentId: string,
  source: EmailMessageSource = "inbound"
): string {
  return `/api/admin/emails/${source}/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

export function parseInboundAttachments(value: unknown): InboundEmailAttachment[] {
  if (typeof value !== "string" || !value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Record<string, unknown> => {
        return typeof item === "object" && item !== null && typeof item.id === "string";
      })
      .map((item) => ({
        id: item.id as string,
        filename: typeof item.filename === "string" ? item.filename : "attachment",
        contentType: typeof item.content_type === "string"
          ? item.content_type
          : "application/octet-stream",
        contentDisposition: typeof item.content_disposition === "string"
          ? item.content_disposition
          : "attachment",
        contentId: typeof item.content_id === "string"
          ? normalizeContentId(item.content_id)
          : "",
        ...(typeof item.size === "number" && Number.isSafeInteger(item.size)
          && item.size > 0 && item.size <= MAX_EMBEDDED_IMAGE_BYTES ? { size: item.size } : {}),
      }));
  } catch {
    return [];
  }
}

export function sanitizeEmailHtml(
  html: string,
  attachments: InboundEmailAttachment[],
  emailId: string,
  source: EmailMessageSource = "inbound"
): string {
  const attachmentsByContentId = new Map(
    attachments
      .filter((attachment) => {
        return attachment.contentId && isSafeInlineImageContentType(attachment.contentType);
      })
      .map((attachment) => [normalizeContentId(attachment.contentId), attachment])
  );

  // Do not whitelist data: URLs. Rewrite only exact, unique manifest matches
  // to the same authenticated attachment endpoint used by CID images.
  const rewrittenHtml = html.replace(EMBEDDED_IMAGE_TAG, (tag, _quote: string, mime: string, encoded: string) => {
    const attachment = exactEmbeddedImageAttachment(encoded, mime, attachments);
    if (!attachment) return tag;
    const dataStart = tag.search(/data:image\//i);
    if (dataStart < 0) return tag;
    const dataLength = `data:${mime};base64,${encoded}`.length;
    const target = attachmentUrl(emailId, attachment.id, source);
    return tag.slice(0, dataStart) + target + tag.slice(dataStart + dataLength);
  });

  const filter = new FilterXSS({
    whiteList: {
      p: [], br: [], div: [], span: [], strong: [], b: [], em: [], i: [], u: [], s: [],
      h1: [], h2: [], h3: [], h4: [], ul: [], ol: [], li: [], blockquote: [],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      table: [], thead: [], tbody: [], tfoot: [], tr: [],
      th: ["colspan", "rowspan"], td: ["colspan", "rowspan"],
      hr: [], pre: [], code: [],
    },
    css: false,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
    safeAttrValue: (tag, name, value, cssFilter) => {
      if (name === "src") {
        const safeSource = /^(https?:\/\/|\/)/i.test(value);
        if (!safeSource) return "";
      }

      if (name === "href") {
        const safeLink = /^(https?:\/\/|mailto:|\/|#)/i.test(value);
        if (!safeLink) return "";
      }

      return defaultSafeAttrValue(tag, name, value, cssFilter);
    },
    onTagAttr: (tag, name, value) => {
      if (tag === "a" && name === "href" && (!value.trim() || /^cid:/i.test(value.trim()))) {
        return "";
      }
      if (tag !== "img" || name !== "src" || !/^cid:/i.test(value)) {
        return undefined;
      }

      const contentId = normalizeContentId(value.slice(4));
      const inlineAttachment = attachmentsByContentId.get(contentId);
      if (!inlineAttachment) return 'src=""';

      const src = attachmentUrl(emailId, inlineAttachment.id, source);
      return `src="${escapeAttrValue(src)}"`;
    },
  });

  return filter.process(rewrittenHtml);
}

export function plainTextEmailToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, "<br>");
}
