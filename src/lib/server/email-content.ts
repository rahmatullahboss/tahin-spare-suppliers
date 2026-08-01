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
  return value.trim().replace(/^<|>$/g, "");
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
      if (tag !== "img" || name !== "src" || !value.toLowerCase().startsWith("cid:")) {
        return undefined;
      }

      const contentId = normalizeContentId(value.slice(4));
      const inlineAttachment = attachmentsByContentId.get(contentId);
      if (!inlineAttachment) return 'src=""';

      const src = attachmentUrl(emailId, inlineAttachment.id, source);
      return `src="${escapeAttrValue(src)}"`;
    },
  });

  return filter.process(html);
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
