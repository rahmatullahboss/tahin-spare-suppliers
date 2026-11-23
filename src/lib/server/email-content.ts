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
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // An invalid escape must not make the entire email fail to render.
  }
  return decoded.trim().replace(/^<|>$/g, "").toLowerCase();
}

function relativeImageFilename(value: string): string {
  const raw = value.trim();
  // Never treat a remote URL, absolute path or navigation target as an
  // attachment filename: matching is strictly limited to bare filenames.
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(raw)) return "";
  const filename = raw.split(/[?#]/, 1)[0]?.replace(/^\.\//, "") ?? "";
  if (!filename || filename.includes("/") || filename.includes("\\")) return "";
  try {
    return decodeURIComponent(filename).toLowerCase();
  } catch {
    return "";
  }
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
  const inlineAttachments = attachments.filter((attachment) => {
    return isSafeInlineImageContentType(attachment.contentType);
  });
  const attachmentsByContentId = new Map(
    inlineAttachments
      .filter((attachment) => attachment.contentId)
      .map((attachment) => [normalizeContentId(attachment.contentId), attachment])
  );
  // A bare filename is a common reference in received email HTML. Only use
  // a filename when it uniquely identifies a safe attachment in this email.
  const attachmentsByFilename = new Map<string, InboundEmailAttachment>();
  const ambiguousFilenames = new Set<string>();
  for (const attachment of inlineAttachments) {
    const filename = attachment.filename.toLowerCase();
    if (attachmentsByFilename.has(filename)) ambiguousFilenames.add(filename);
    else attachmentsByFilename.set(filename, attachment);
  }
  for (const filename of ambiguousFilenames) attachmentsByFilename.delete(filename);

  const resolveAttachment = (value: string): InboundEmailAttachment | undefined => {
    if (/^cid:/i.test(value.trim())) {
      return attachmentsByContentId.get(normalizeContentId(value.trim().slice(4)));
    }
    const filename = relativeImageFilename(value);
    return filename ? attachmentsByFilename.get(filename) : undefined;
  };

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
      if (!((tag === "img" && name === "src") || (tag === "a" && name === "href"))) {
        return undefined;
      }

      const inlineAttachment = resolveAttachment(value);
      if (inlineAttachment) {
        const url = attachmentUrl(emailId, inlineAttachment.id, source);
        return `${name}="${escapeAttrValue(url)}"`;
      }

      // A missing CID or an empty image hyperlink must never resolve to the
      // current conversation page when clicked.
      if (tag === "a" && (!value.trim() || /^cid:/i.test(value.trim()))) return "";
      if (tag === "img" && /^cid:/i.test(value.trim())) return 'src=""';
      return undefined;
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
